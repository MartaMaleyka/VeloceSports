import type { ActionImpact } from './statuses.js';

export const ActionCatalogStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type ActionCatalogStatus = (typeof ActionCatalogStatus)[keyof typeof ActionCatalogStatus];

export interface BaseActionCatalogEntry {
  code: number;
  name: string;
  description: string;
  impact: ActionImpact;
  notifiable: boolean;
}

/** Catálogo base sembrado al crear cada tenant (dominio.md) */
export const BASE_ACTION_CATALOG: readonly BaseActionCatalogEntry[] = [
  { code: 1, name: 'Gol', description: 'Gol anotado', impact: 'positive', notifiable: true },
  { code: 2, name: 'Asistencia', description: 'Asistencia de gol', impact: 'positive', notifiable: true },
  { code: 3, name: 'Pase completado', description: 'Pase exitoso', impact: 'positive', notifiable: false },
  { code: 4, name: 'Pase errado', description: 'Pase fallido', impact: 'negative', notifiable: false },
  { code: 5, name: 'Tiro al arco', description: 'Tiro dirigido al arco', impact: 'positive', notifiable: true },
  { code: 6, name: 'Tiro desviado', description: 'Tiro fuera del arco', impact: 'neutral', notifiable: false },
  { code: 7, name: 'Falta cometida', description: 'Falta cometida por el jugador', impact: 'negative', notifiable: false },
  { code: 8, name: 'Falta recibida', description: 'Falta recibida a favor', impact: 'positive', notifiable: false },
  { code: 9, name: 'Pérdida de balón', description: 'Pérdida de posesión', impact: 'negative', notifiable: false },
  { code: 10, name: 'Intercepción', description: 'Interceptación de pase', impact: 'positive', notifiable: true },
  { code: 11, name: 'Quite', description: 'Recuperación limpia del balón', impact: 'positive', notifiable: true },
  { code: 12, name: 'Despeje', description: 'Despeje defensivo', impact: 'positive', notifiable: false },
  { code: 13, name: 'Recuperación del balón', description: 'Recuperación del balón en juego', impact: 'positive', notifiable: true },
  { code: 14, name: 'Atajada', description: 'Atajada del portero', impact: 'positive', notifiable: true },
  { code: 15, name: 'Salida incorrecta', description: 'Salida errada desde atrás', impact: 'negative', notifiable: false },
] as const;

export interface ActionCatalogDto {
  id: number;
  code: number;
  name: string;
  description: string | null;
  impact: ActionImpact;
  notifiable: boolean;
  status: ActionCatalogStatus;
  /** true si existe al menos un game_action que la referencia */
  isUsed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActionCatalogKpisDto {
  activeCount: number;
  notifiableCount: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
}

export interface CreateActionCatalogBody {
  code: number;
  name: string;
  description?: string | null;
  impact: ActionImpact;
  notifiable: boolean;
}

export interface UpdateActionCatalogBody {
  code?: number;
  name?: string;
  description?: string | null;
  impact?: ActionImpact;
  notifiable?: boolean;
}

export interface UpdateActionCatalogStatusBody {
  status: ActionCatalogStatus;
}

export type ActionCatalogListFilters = {
  search?: string;
  impact?: ActionImpact;
  status?: ActionCatalogStatus;
};
