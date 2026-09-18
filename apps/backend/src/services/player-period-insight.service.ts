import { createHash } from 'node:crypto';
import {
  buildPeriodInsightFacts,
  type CoachAnalysisFiltersDto,
  type CoachPlayerAnalysisDetailDto,
  type PlayerPeriodInsightDto,
} from '@velocesport/shared';
import { env } from '../config/env.js';
import { generatePlayerPeriodInsight } from '../lib/ollama-client.js';
import {
  playerPeriodInsightRepository,
  type PlayerPeriodInsightRow,
} from '../repositories/player-period-insight.repository.js';
import { coachAnalysisService } from './coach-analysis.service.js';
import type { AuthUser } from '../types/index.js';
import type { CoachAnalysisQuery } from '../validators/coach-analysis.validator.js';

interface AnalysisActor {
  user: AuthUser;
  tenantId: number;
}

type Locale = 'es' | 'en';

interface GetOrGenerateOptions {
  forceRegenerate?: boolean;
  locale?: Locale;
}

function readyDto(row: PlayerPeriodInsightRow): PlayerPeriodInsightDto {
  // mysql2 ya deserializa las columnas JSON a objetos JS; nunca vienen como string.
  const facts = row.facts_json as { hasEnoughData: boolean };
  return {
    status: 'ready',
    text: row.insight_text,
    generationSource: row.generation_source,
    generatedAt: (row.generated_at ?? row.updated_at).toISOString(),
    hasEnoughData: facts.hasEnoughData,
  };
}

const pendingDto: PlayerPeriodInsightDto = {
  status: 'pending',
  text: null,
  generationSource: null,
  generatedAt: null,
  hasEnoughData: null,
};

function hashFilters(filters: CoachAnalysisFiltersDto): string {
  const normalized = {
    categoryId: filters.categoryId ?? null,
    matchId: filters.matchId ?? null,
    dateFrom: filters.dateFrom ?? null,
    dateTo: filters.dateTo ?? null,
    actionCode: filters.actionCode ?? null,
    impact: filters.impact ?? null,
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export class PlayerPeriodInsightService {
  async getOrGenerateForStaff(
    actor: AnalysisActor,
    playerId: number,
    query: CoachAnalysisQuery,
    options: GetOrGenerateOptions = {},
  ): Promise<PlayerPeriodInsightDto> {
    const detail = await coachAnalysisService.getPlayerDetail(actor, playerId, query);
    const filtersHash = hashFilters(detail.filters);

    const forceRegenerate = options.forceRegenerate ?? false;
    const locale = options.locale ?? 'es';

    if (!forceRegenerate) {
      const cached = await playerPeriodInsightRepository.findByPlayerAndFilters(
        actor.tenantId,
        playerId,
        filtersHash,
      );
      if (cached?.status === 'ready') return readyDto(cached);
    }

    const gotLock = await playerPeriodInsightRepository.tryMarkGenerating(
      actor.tenantId,
      playerId,
      filtersHash,
      actor.user.userId,
    );

    if (gotLock) {
      void this.generateAndPersist(
        actor.tenantId,
        playerId,
        filtersHash,
        actor.user.userId,
        detail,
        locale,
      );
    }

    return pendingDto;
  }

  private async generateAndPersist(
    tenantId: number,
    playerId: number,
    filtersHash: string,
    requestedByUserId: number,
    detail: CoachPlayerAnalysisDetailDto,
    locale: Locale,
  ): Promise<void> {
    try {
      const facts = buildPeriodInsightFacts(detail);
      const factsJson = JSON.stringify(facts);
      const { text, source } = await generatePlayerPeriodInsight(facts, locale);

      await playerPeriodInsightRepository.upsertReady({
        tenantId,
        playerId,
        filtersHash,
        factsJson,
        insightText: text,
        modelName: source === 'ollama' ? env.OLLAMA_MODEL : 'fallback',
        generationSource: source,
        requestedByUserId,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido al generar el análisis';
      await playerPeriodInsightRepository.markFailed(tenantId, playerId, filtersHash, message);
    }
  }
}

export const playerPeriodInsightService = new PlayerPeriodInsightService();
