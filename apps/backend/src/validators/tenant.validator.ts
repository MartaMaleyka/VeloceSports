import { z } from 'zod';
import { IdSchema, EmailSchema, SlugSchema, DateSchema } from './common.validator.js';

export const CreatePlayerBodySchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  jerseyNumber: z.number().int().min(1).max(99),
  dateOfBirth: z.string().date().optional(),
  position: z.string().max(50).optional(),
  email: EmailSchema.optional(),
  parentEmail: EmailSchema.optional(),
  notes: z.string().max(1000).optional(),
});

export const UpdatePlayerBodySchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  jerseyNumber: z.number().int().min(1).max(99).optional(),
  position: z.string().max(50).optional(),
  email: EmailSchema.optional(),
  parentEmail: EmailSchema.optional(),
  notes: z.string().max(1000).optional(),
});

export const CreateCategoryBodySchema = z.object({
  name: z.string().min(1).max(100),
  ageGroup: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
});

export const UpdateCategoryBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  ageGroup: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
});

export const CreateObservationBodySchema = z.object({
  playerId: IdSchema,
  observation: z.string().min(1).max(5000),
  category: z.enum(['performance', 'behavior', 'technical', 'tactical']).optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export const UpdateObservationBodySchema = z.object({
  observation: z.string().min(1).max(5000).optional(),
  category: z.enum(['performance', 'behavior', 'technical', 'tactical']).optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export const CreateReportBodySchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1).max(5000).optional(),
  categoryIds: z.array(IdSchema).optional(),
  playerIds: z.array(IdSchema).optional(),
  dateRange: z.object({
    startDate: z.string().date(),
    endDate: z.string().date(),
  }).optional(),
  format: z.enum(['pdf', 'csv', 'json']).default('pdf'),
});

export const CreatePlayerPhotoBodySchema = z.object({
  playerId: IdSchema,
  url: z.string().url(),
  isPrimary: z.boolean().default(false),
});

export const UpdatePlayerPhotoBodySchema = z.object({
  url: z.string().url().optional(),
  isPrimary: z.boolean().optional(),
});
