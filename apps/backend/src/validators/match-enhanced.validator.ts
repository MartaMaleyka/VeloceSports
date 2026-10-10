import { z } from 'zod';
import { IdSchema } from './common.validator.js';
import { MatchStatus } from '@velocesport/shared';

export const CreateGameActionBodySchema = z.object({
  playerId: IdSchema,
  actionCode: z.number().int().positive(),
  minute: z.number().int().min(0).max(999),
  period: z.number().int().positive(),
  notes: z.string().max(500).optional(),
});

export const UpdateGameActionBodySchema = z.object({
  minute: z.number().int().min(0).max(999).optional(),
  period: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

export const CreateMatchAttendanceBodySchema = z.object({
  playerId: IdSchema,
  status: z.enum(['present', 'absent', 'injured', 'other']),
  notes: z.string().max(500).optional(),
});

export const UpdateMatchAttendanceBodySchema = z.object({
  status: z.enum(['present', 'absent', 'injured', 'other']).optional(),
  notes: z.string().max(500).optional(),
});

export const QueryMatchFiltersSchema = z.object({
  status: z.enum([MatchStatus.SCHEDULED, MatchStatus.IN_PROGRESS, MatchStatus.FINISHED, MatchStatus.CANCELLED]).optional(),
  categoryId: IdSchema.optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  opponent: z.string().max(100).optional(),
  sort: z.enum(['date', 'opponent', 'status']).default('date'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export const BulkCreateMatchesBodySchema = z.object({
  matches: z.array(z.object({
    opponent: z.string().min(1).max(255),
    matchDatetime: z.string().datetime(),
    location: z.string().max(255),
    categoryId: IdSchema,
    matchType: z.enum(['friendly', 'league', 'tournament', 'other']),
    notes: z.string().max(1000).optional(),
  })).min(1).max(100),
});
