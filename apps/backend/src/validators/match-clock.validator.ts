import { z } from 'zod';
import { MatchClockCommand } from '@velocesport/shared';

export const matchClockCommandBodySchema = z.discriminatedUnion('command', [
  z.object({ command: z.literal(MatchClockCommand.PAUSE) }),
  z.object({ command: z.literal(MatchClockCommand.RESUME) }),
  z.object({ command: z.literal(MatchClockCommand.NEXT_PERIOD) }),
  z.object({
    command: z.literal(MatchClockCommand.ADJUST),
    minute: z.number().int().min(0).max(120),
  }),
]);
