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

function pickAudienceText(row: PlayerMatchInsightRow, audience: Audience): string {
  if (audience === 'player') return row.player_text;
  if (audience === 'parent') return row.parent_text;
  return row.coach_text;
}

function readyDto(row: PlayerMatchInsightRow, audience: Audience): PlayerMatchInsightDto {
  // mysql2 ya deserializa las columnas JSON a objetos JS; nunca vienen como string.
  const facts = row.facts_json as { hasEnoughData: boolean };
  return {
    status: 'ready',
    text: pickAudienceText(row, audience),
    generationSource: row.generation_source,
    generatedAt: (row.generated_at ?? row.updated_at).toISOString(),
    hasEnoughData: facts.hasEnoughData,
  };
}

const pendingDto: PlayerMatchInsightDto = {
  status: 'pending',
  text: null,
  generationSource: null,
  generatedAt: null,
  hasEnoughData: null,
};

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
    return this.getOrGenerate(tenantId, playerId, matchId, parentUserId, reportCard, options, 'parent');
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
    return this.getOrGenerate(
      actor.tenantId,
      playerId,
      matchId,
      actor.user.userId,
      reportCard,
      options,
      'coach',
    );
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
    return this.getOrGenerate(
      tenantId,
      playerId,
      matchId,
      viewerUserId,
      reportCard,
      options,
      'player',
    );
  }

  /**
   * Nunca bloquea esperando al modelo: si hace falta generar, dispara el trabajo en
   * segundo plano y responde "pending" de inmediato. El cliente hace polling del
   * mismo endpoint (con forceRegenerate=false) hasta que quede "ready". Esto evita
   * depender del timeout de cualquier proxy/reverse-proxy delante del backend.
   */
  private async getOrGenerate(
    tenantId: number,
    playerId: number,
    matchId: number,
    requestedByUserId: number,
    reportCard: PlayerMatchReportCardDto,
    options: GetOrGenerateOptions,
    audience: Audience,
  ): Promise<PlayerMatchInsightDto> {
    const forceRegenerate = options.forceRegenerate ?? false;
    const locale = options.locale ?? 'es';

    if (!forceRegenerate) {
      const cached = await playerMatchInsightRepository.findByPlayerAndMatch(
        tenantId,
        playerId,
        matchId,
      );
      if (cached?.status === 'ready') return readyDto(cached, audience);
    }

    const gotLock = await playerMatchInsightRepository.tryMarkGenerating(
      tenantId,
      playerId,
      matchId,
      requestedByUserId,
    );

    if (gotLock) {
      void this.generateAndPersist(tenantId, playerId, matchId, requestedByUserId, reportCard, locale);
    }

    return pendingDto;
  }

  private async generateAndPersist(
    tenantId: number,
    playerId: number,
    matchId: number,
    requestedByUserId: number,
    reportCard: PlayerMatchReportCardDto,
    locale: Locale,
  ): Promise<void> {
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido al generar el análisis';
      await playerMatchInsightRepository.markFailed(tenantId, playerId, matchId, message);
    }
  }
}

export const playerMatchInsightService = new PlayerMatchInsightService();
