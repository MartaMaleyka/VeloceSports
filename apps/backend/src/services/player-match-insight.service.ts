import { createHash } from 'node:crypto';
import {
  buildInsightFacts,
  type PlayerMatchInsightDto,
  type PlayerMatchReportCardDto,
} from '@velocesport/shared';
import { env } from '../config/env.js';
import { generatePlayerMatchInsight } from '../lib/ollama-client.js';
import {
  playerMatchInsightRepository,
  type PlayerMatchInsightRow,
} from '../repositories/player-match-insight.repository.js';
import { playerMatchReportService } from './player-match-report.service.js';
import { ConflictError } from '../types/index.js';
import type { AuthUser } from '../types/index.js';

interface ReportActorContext {
  user: AuthUser;
  tenantId: number;
}

type Audience = 'player' | 'parent' | 'coach';
type Locale = 'es' | 'en';

interface GetOrGenerateOptions {
  forceRegenerate?: boolean;
  locale?: Locale;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickAudienceText(row: PlayerMatchInsightRow, audience: Audience): string {
  if (audience === 'player') return row.player_text;
  if (audience === 'parent') return row.parent_text;
  return row.coach_text;
}

function rowToDto(row: PlayerMatchInsightRow, audience: Audience): PlayerMatchInsightDto {
  const facts = JSON.parse(row.facts_json) as { hasEnoughData: boolean };
  return {
    text: pickAudienceText(row, audience),
    generationSource: row.generation_source,
    generatedAt: (row.generated_at ?? row.updated_at).toISOString(),
    hasEnoughData: facts.hasEnoughData,
  };
}

export class PlayerMatchInsightService {
  async getOrGenerateForParent(
    tenantId: number,
    parentUserId: number,
    playerId: number,
    matchId: number,
    options: GetOrGenerateOptions = {},
  ): Promise<PlayerMatchInsightDto> {
    const reportCard = await playerMatchReportService.getReportCardForParent(
      tenantId,
      parentUserId,
      playerId,
      matchId,
    );
    const row = await this.getOrGenerate(
      tenantId,
      playerId,
      matchId,
      parentUserId,
      reportCard,
      options,
    );
    return rowToDto(row, 'parent');
  }

  async getOrGenerateForStaff(
    actor: ReportActorContext,
    matchId: number,
    playerId: number,
    options: GetOrGenerateOptions = {},
  ): Promise<PlayerMatchInsightDto> {
    const reportCard = await playerMatchReportService.getReportCardForStaff(
      actor,
      matchId,
      playerId,
    );
    const row = await this.getOrGenerate(
      actor.tenantId,
      playerId,
      matchId,
      actor.user.userId,
      reportCard,
      options,
    );
    return rowToDto(row, 'coach');
  }

  async getOrGenerateForViewer(
    tenantId: number,
    viewerUserId: number,
    playerId: number,
    matchId: number,
    options: GetOrGenerateOptions = {},
  ): Promise<PlayerMatchInsightDto> {
    const reportCard = await playerMatchReportService.getReportCardForViewer(
      tenantId,
      viewerUserId,
      playerId,
      matchId,
    );
    const row = await this.getOrGenerate(
      tenantId,
      playerId,
      matchId,
      viewerUserId,
      reportCard,
      options,
    );
    return rowToDto(row, 'player');
  }

  private async getOrGenerate(
    tenantId: number,
    playerId: number,
    matchId: number,
    requestedByUserId: number,
    reportCard: PlayerMatchReportCardDto,
    options: GetOrGenerateOptions,
  ): Promise<PlayerMatchInsightRow> {
    const forceRegenerate = options.forceRegenerate ?? false;
    const locale = options.locale ?? 'es';

    if (!forceRegenerate) {
      const cached = await playerMatchInsightRepository.findByPlayerAndMatch(
        tenantId,
        playerId,
        matchId,
      );
      if (cached && cached.status === 'ready') return cached;
    }

    const gotLock = await playerMatchInsightRepository.tryMarkGenerating(
      tenantId,
      playerId,
      matchId,
      requestedByUserId,
    );

    if (!gotLock) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await sleep(1500);
        const row = await playerMatchInsightRepository.findByPlayerAndMatch(
          tenantId,
          playerId,
          matchId,
        );
        if (row && row.status === 'ready') return row;
      }
      throw new ConflictError('El análisis se está generando, intenta de nuevo en unos segundos');
    }

    try {
      const facts = buildInsightFacts(reportCard);
      const factsJson = JSON.stringify(facts);
      const factsHash = createHash('sha256').update(factsJson).digest('hex');
      const { result, source } = await generatePlayerMatchInsight(facts, locale);

      await playerMatchInsightRepository.upsertReady({
        tenantId,
        playerId,
        matchId,
        factsJson,
        factsHash,
        playerText: result.player,
        parentText: result.parent,
        coachText: result.coach,
        modelName: source === 'ollama' ? env.OLLAMA_MODEL : 'fallback',
        generationSource: source,
        requestedByUserId,
      });

      const row = await playerMatchInsightRepository.findByPlayerAndMatch(
        tenantId,
        playerId,
        matchId,
      );
      if (!row) throw new Error('No se pudo leer el análisis recién generado');
      return row;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al generar el análisis';
      await playerMatchInsightRepository.markFailed(tenantId, playerId, matchId, message);
      throw error;
    }
  }
}

export const playerMatchInsightService = new PlayerMatchInsightService();
