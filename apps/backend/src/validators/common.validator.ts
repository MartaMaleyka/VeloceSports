import { z } from 'zod';

export const UUIDSchema = z.string().uuid('Invalid UUID format');

export const EmailSchema = z
  .string()
  .email('Invalid email format')
  .toLowerCase()
  .trim();

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[0-9]/, 'Password must contain number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain special character');

export const JerseyNumberSchema = z.number().int().min(1).max(99);

export const PhoneSchema = z
  .string()
  .regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
    'Invalid phone number format');

export const DateSchema = z.string().datetime('Invalid date format');

export const TimezoneSchema = z.string().regex(
  /^[A-Za-z_]+\/[A-Za-z_]+$/,
  'Invalid timezone format (e.g., America/New_York)',
);

export const LocaleSchema = z.enum(['es', 'en', 'pt']);

export const CurrencySchema = z.enum(['USD', 'EUR', 'MXN', 'BRL', 'ARS']);

export const SlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format')
  .min(1)
  .max(255);

export const IdSchema = z.number().int().positive('ID must be a positive integer');

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).refine(
  (data) => {
    if (!data.startDate || !data.endDate) return true;
    return new Date(data.startDate) <= new Date(data.endDate);
  },
  { message: 'Start date must be before or equal to end date' },
);
