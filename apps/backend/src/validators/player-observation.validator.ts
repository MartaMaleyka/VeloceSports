import { z } from 'zod';
import { parentPlayerIdParamSchema } from './parent.validator.js';

export const playerObservationPlayerParamSchema = z.object({
  playerId: z.coerce.number().int().positive(),
});

export const playerObservationIdParamSchema = z.object({
  observationId: z.coerce.number().int().positive(),
});

export const listPlayerObservationsQuerySchema = z.object({
  matchId: z.coerce.number().int().positive().optional(),
});

export const createPlayerObservationBodySchema = z.object({
  content: z.string().trim().min(1, 'El contenido es obligatorio').max(5000),
  matchId: z.number().int().positive().nullable().optional(),
});

export const updatePlayerObservationBodySchema = z.object({
  content: z.string().trim().min(1, 'El contenido es obligatorio').max(5000),
});

export const parentListObservationsParamsSchema = parentPlayerIdParamSchema;
