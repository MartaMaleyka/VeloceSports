import { z } from 'zod';
import { MatchLineupRole } from '@velocesport/shared';

const attendanceEntrySchema = z.object({
  playerId: z.coerce.number().int().positive(),
  attended: z.boolean(),
  lineup: z.enum([MatchLineupRole.STARTER, MatchLineupRole.SUBSTITUTE]).nullable().optional(),
  matchJerseyNumber: z.coerce.number().int().min(1).max(99).nullable().optional(),
});

export const saveMatchAttendanceBodySchema = z.object({
  entries: z.array(attendanceEntrySchema).min(1).max(50),
});

export type SaveMatchAttendanceBodyInput = z.infer<typeof saveMatchAttendanceBodySchema>;
