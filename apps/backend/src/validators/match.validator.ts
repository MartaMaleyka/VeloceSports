import { z } from 'zod';
import { MATCH_TYPES, MatchStatus } from '@velocesport/shared';

export const listMatchesQuerySchema = z.object({
  search: z.string().trim().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  status: z
    .enum([
      MatchStatus.SCHEDULED,
      MatchStatus.IN_PROGRESS,
      MatchStatus.FINISHED,
      MatchStatus.CANCELLED,
    ])
    .optional(),
  matchType: z.enum(MATCH_TYPES).optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)')
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)')
    .optional(),
});

export const matchIdParamSchema = z.object({
  matchId: z.coerce.number().int().positive(),
});

export const createMatchBodySchema = z.object({
  categoryId: z.number().int().positive(),
  opponent: z.string().trim().min(1, 'El rival es obligatorio').max(150),
  matchDatetime: z.string().min(1, 'Fecha y hora obligatorias'),
  location: z.string().trim().max(255).nullable().optional(),
  matchType: z.enum(MATCH_TYPES),
  notes: z.string().trim().max(5000).nullable().optional(),
  periodsCount: z.number().int().min(1).max(9).nullable().optional(),
  periodDurationMinutes: z.number().int().min(1).max(120).nullable().optional(),
});

export const updateMatchBodySchema = z
  .object({
    categoryId: z.number().int().positive().optional(),
    opponent: z.string().trim().min(1).max(150).optional(),
    matchDatetime: z.string().min(1).optional(),
    location: z.string().trim().max(255).nullable().optional(),
    matchType: z.enum(MATCH_TYPES).optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    periodsCount: z.number().int().min(1).max(9).nullable().optional(),
    periodDurationMinutes: z.number().int().min(1).max(120).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Debe enviar al menos un campo' });

export const updateMatchStatusBodySchema = z.object({
  status: z.enum([
    MatchStatus.SCHEDULED,
    MatchStatus.IN_PROGRESS,
    MatchStatus.FINISHED,
    MatchStatus.CANCELLED,
  ]),
});
