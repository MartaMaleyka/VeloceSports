import type { CreateMatchBody, MatchDto } from './match.js';
import type {
  CategoryDto,
  CreateCategoryBody,
  CreateTenantUserBody,
  PlayerDto,
  TenantUserDto,
} from './tenant.js';

/** Máximo de filas por petición de alta masiva. */
export const BULK_MAX_ITEMS = 200;
/** Usuarios: el hash de cada contraseña temporal es costoso, se limita más. */
export const BULK_MAX_USERS = 100;

export interface BulkCreateRequest<T> {
  items: T[];
  /** true = solo valida, no crea nada (para revisar el lote antes de guardarlo). */
  dryRun?: boolean;
}

export interface BulkRowError {
  /** Posición de la fila en `items` (base 0). */
  index: number;
  /** Campo con el problema; ausente si afecta a toda la fila. */
  field?: string;
  code: string;
  message: string;
}

export interface BulkCreated<R> {
  index: number;
  item: R;
}

/**
 * Resultado de un alta masiva.
 * - Si alguna fila no pasa la validación previa, no se crea ninguna (`created` vacío).
 * - Si el lote es válido, se crea fila a fila; un fallo inesperado en una fila se informa
 *   en `errors` y el resto sigue.
 */
export interface BulkCreateResult<R> {
  dryRun: boolean;
  created: BulkCreated<R>[];
  errors: BulkRowError[];
  summary: { total: number; created: number; failed: number };
}

/** Jugador en alta masiva: los padres se indican por email (cuentas ya existentes). */
export interface BulkCreatePlayerItem {
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  jerseyNumber: number;
  position?: string | null;
  categoryId: number;
  parentEmails?: string[];
}

export type BulkCreateUserItem = CreateTenantUserBody;
export type BulkCreateCategoryItem = Omit<CreateCategoryBody, 'coachUserId'>;
export type BulkCreateMatchItem = CreateMatchBody;

export interface BulkCreatedUserDto {
  user: TenantUserDto;
  temporaryPassword: string;
}

export type BulkCreatePlayersResult = BulkCreateResult<PlayerDto>;
export type BulkCreateUsersResult = BulkCreateResult<BulkCreatedUserDto>;
export type BulkCreateCategoriesResult = BulkCreateResult<CategoryDto>;
export type BulkCreateMatchesResult = BulkCreateResult<MatchDto>;
