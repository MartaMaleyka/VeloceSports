import {
  MatchLineupRole,
  MatchStatus,
  PlayerStatus,
  UserRole,
  type MatchAttendanceDto,
  type MatchAttendanceEntryDto,
  type MatchAttendanceSummaryDto,
  type SaveMatchAttendanceBody,
} from '@velocesport/shared';
import { coachCategoryRepository } from '../repositories/coach-category.repository.js';
import { matchRepository, type MatchWithCategoryRow } from '../repositories/match.repository.js';
import {
  matchAttendanceRepository,
  type MatchAttendanceRow,
} from '../repositories/match-attendance.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import { auditService } from './audit.service.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type AuthUser,
} from '../types/index.js';
import { userHasRole } from '../utils/role-check.js';

interface AttendanceActorContext {
  user: AuthUser;
  tenantId: number;
}

export class MatchAttendanceService {
  private auditCtx(actor: AttendanceActorContext) {
    return { userId: actor.user.userId, tenantId: actor.tenantId };
  }

  private isMatchLocked(status: MatchWithCategoryRow['status']): boolean {
    return status === MatchStatus.FINISHED || status === MatchStatus.CANCELLED;
  }

  private async assertMatchViewAccess(
    actor: AttendanceActorContext,
    matchId: number,
  ): Promise<MatchWithCategoryRow> {
    const row = await matchRepository.findById(actor.tenantId, matchId);
    if (!row) throw new NotFoundError('Partido no encontrado');

    if (
      !userHasRole(actor.user, UserRole.ACADEMY_ADMIN) &&
      userHasRole(actor.user, UserRole.COACH)
    ) {
      const assigned = await coachCategoryRepository.isCoachAssignedToCategory(
        actor.tenantId,
        actor.user.userId,
        row.category_id,
      );
      if (!assigned) {
        throw new ForbiddenError(
          'No eres el entrenador asignado a la categoría de este partido',
        );
      }
    }

    return row;
  }

  /** Permiso de edición: coach asignado a la categoría vía coach_categories (multi-rol incluido). */
  private async isCoachOfMatchCategory(
    actor: AttendanceActorContext,
    categoryId: number,
  ): Promise<boolean> {
    return coachCategoryRepository.isCoachAssignedToCategory(
      actor.tenantId,
      actor.user.userId,
      categoryId,
    );
  }

  private computeSummary(entries: MatchAttendanceEntryDto[]): MatchAttendanceSummaryDto {
    let presentCount = 0;
    let starterCount = 0;
    let substituteCount = 0;

    for (const entry of entries) {
      if (entry.attended) presentCount += 1;
      if (entry.attended && entry.lineup === MatchLineupRole.STARTER) starterCount += 1;
      if (entry.attended && entry.lineup === MatchLineupRole.SUBSTITUTE) substituteCount += 1;
    }

    return { presentCount, starterCount, substituteCount };
  }

  private mergeEntries(
    activePlayers: Awaited<ReturnType<typeof playerRepository.findByTenantId>>,
    attendanceRows: MatchAttendanceRow[],
    inactiveWithAttendance: Awaited<ReturnType<typeof playerRepository.findByTenantId>>,
  ): MatchAttendanceEntryDto[] {
    const attendanceByPlayer = new Map(attendanceRows.map((r) => [r.player_id, r]));
    const playerMap = new Map<number, (typeof activePlayers)[number]>();

    for (const p of activePlayers) playerMap.set(p.id, p);
    for (const p of inactiveWithAttendance) {
      if (!playerMap.has(p.id)) playerMap.set(p.id, p);
    }

    const sorted = [...playerMap.values()].sort((a, b) => {
      const ln = a.last_name.localeCompare(b.last_name);
      if (ln !== 0) return ln;
      return a.first_name.localeCompare(b.first_name);
    });

    return sorted.map((player) => {
      const saved = attendanceByPlayer.get(player.id);
      const defaultJersey = Number(player.jersey_number);

      return {
        playerId: player.id,
        playerFirstName: player.first_name,
        playerLastName: player.last_name,
        playerStatus: player.status,
        defaultJerseyNumber: defaultJersey,
        attended: saved ? Boolean(saved.attended) : false,
        lineup: saved?.lineup ?? null,
        matchJerseyNumber: saved?.match_jersey_number ?? (saved ? null : defaultJersey),
        attendanceId: saved?.id ?? null,
      };
    });
  }

  async getAttendance(actor: AttendanceActorContext, matchId: number): Promise<MatchAttendanceDto> {
    const match = await this.assertMatchViewAccess(actor, matchId);
    const canEditCoach = await this.isCoachOfMatchCategory(actor, match.category_id);
    const canEdit = canEditCoach && !this.isMatchLocked(match.status);

    const [activePlayers, attendanceRows] = await Promise.all([
      playerRepository.findByTenantId(actor.tenantId, {
        categoryId: match.category_id,
        status: PlayerStatus.ACTIVE,
      }),
      matchAttendanceRepository.findByMatchId(actor.tenantId, matchId),
    ]);

    const savedPlayerIds = new Set(attendanceRows.map((r) => r.player_id));
    const inactiveIds = [...savedPlayerIds].filter(
      (id) => !activePlayers.some((p) => p.id === id),
    );

    let inactiveWithAttendance: Awaited<ReturnType<typeof playerRepository.findByTenantId>> = [];
    if (inactiveIds.length > 0) {
      const allInactive = await playerRepository.findByTenantId(actor.tenantId, {
        categoryId: match.category_id,
      });
      inactiveWithAttendance = allInactive.filter((p) => inactiveIds.includes(p.id));
    }

    const entries = this.mergeEntries(activePlayers, attendanceRows, inactiveWithAttendance);

    return {
      matchId,
      canEdit,
      editable: canEdit,
      categoryId: match.category_id,
      categoryName: match.category_name,
      summary: this.computeSummary(entries),
      entries,
    };
  }

  private validateJerseyCollisions(
    normalized: Array<{
      playerId: number;
      attended: boolean;
      matchJerseyNumber: number | null;
    }>,
  ): void {
    const jerseyToPlayers = new Map<number, number[]>();

    for (const entry of normalized) {
      if (!entry.attended || entry.matchJerseyNumber == null) continue;
      const list = jerseyToPlayers.get(entry.matchJerseyNumber) ?? [];
      list.push(entry.playerId);
      jerseyToPlayers.set(entry.matchJerseyNumber, list);
    }

    const collisions: Array<{ jersey: number; playerIds: number[] }> = [];
    for (const [jersey, playerIds] of jerseyToPlayers) {
      if (playerIds.length > 1) {
        collisions.push({ jersey, playerIds });
      }
    }

    if (collisions.length > 0) {
      const details = collisions.map((c) => ({
        jersey: c.jersey,
        playerIds: c.playerIds,
      }));
      throw new ValidationError(
        'Hay dorsales duplicados entre jugadores presentes. Cada dorsal debe ser único en el partido.',
        'JERSEY_COLLISION',
        { collisions: details },
      );
    }
  }

  async saveAttendance(
    actor: AttendanceActorContext,
    matchId: number,
    input: SaveMatchAttendanceBody,
  ): Promise<MatchAttendanceDto> {
    const match = await this.assertMatchViewAccess(actor, matchId);

    const isCoach = await this.isCoachOfMatchCategory(actor, match.category_id);
    if (!isCoach) {
      throw new ForbiddenError(
        'Solo el entrenador asignado a esta categoría puede marcar la asistencia',
      );
    }

    if (this.isMatchLocked(match.status)) {
      throw new ValidationError(
        'No se puede editar la asistencia de un partido finalizado o cancelado',
      );
    }

    const current = await this.getAttendance(actor, matchId);
    const allowedPlayerIds = new Set(current.entries.map((e) => e.playerId));

    for (const entry of input.entries) {
      if (!allowedPlayerIds.has(entry.playerId)) {
        throw new ValidationError('Uno o más jugadores no pertenecen a la categoría del partido');
      }
    }

    const patchByPlayer = new Map(input.entries.map((e) => [e.playerId, e]));

    const normalized = current.entries.map((existing) => {
      const patch = patchByPlayer.get(existing.playerId);
      if (!patch) return existing;

      const attended = patch.attended;
      let lineup = patch.lineup ?? null;
      let matchJerseyNumber =
        patch.matchJerseyNumber !== undefined
          ? patch.matchJerseyNumber
          : existing.matchJerseyNumber ?? existing.defaultJerseyNumber;

      if (!attended) {
        lineup = null;
        matchJerseyNumber = null;
      } else if (lineup == null) {
        matchJerseyNumber = matchJerseyNumber ?? existing.defaultJerseyNumber;
      }

      return {
        ...existing,
        attended,
        lineup: attended ? lineup : null,
        matchJerseyNumber: attended ? matchJerseyNumber : null,
      };
    });

    this.validateJerseyCollisions(
      normalized.map((e) => ({
        playerId: e.playerId,
        attended: e.attended,
        matchJerseyNumber: e.matchJerseyNumber,
      })),
    );

    const toUpsert = normalized
      .filter((e) => patchByPlayer.has(e.playerId))
      .map((e) => ({
        playerId: e.playerId,
        attended: e.attended,
        lineup: e.lineup,
        matchJerseyNumber: e.matchJerseyNumber,
      }));

    const beforeRows = await matchAttendanceRepository.findByMatchId(actor.tenantId, matchId);

    await matchAttendanceRepository.upsertBatch(actor.tenantId, matchId, toUpsert);

    await auditService.log(
      this.auditCtx(actor),
      'match_attendance',
      matchId,
      'update',
      {
        entries: beforeRows.map((r) => ({
          playerId: r.player_id,
          attended: Boolean(r.attended),
          lineup: r.lineup,
          matchJerseyNumber: r.match_jersey_number,
        })),
      },
      {
        entries: toUpsert,
      },
    );

    return this.getAttendance(actor, matchId);
  }
}

export const matchAttendanceService = new MatchAttendanceService();
