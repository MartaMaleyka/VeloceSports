import { CategoryStatus } from '@velocesport/shared';
import { categoryRepository } from '../repositories/category.repository.js';
import { ValidationError } from '../types/index.js';

/**
 * La categoría debe existir en la academia y estar activa para asignarla a un jugador
 * o a un partido. Si ya era la categoría actual se acepta aunque esté inactiva, para
 * no bloquear la edición de otros campos.
 */
export async function assertAssignableCategory(
  tenantId: number,
  categoryId: number,
  currentCategoryId: number | null = null,
): Promise<void> {
  const category = await categoryRepository.findById(tenantId, categoryId);
  if (!category) {
    throw new ValidationError('La categoría seleccionada no pertenece a esta academia');
  }
  if (category.status !== CategoryStatus.ACTIVE && categoryId !== currentCategoryId) {
    throw new ValidationError('La categoría seleccionada está inactiva', 'CATEGORY_INACTIVE');
  }
}

/** RN-05: un jugador activo necesita una categoría activa para participar. */
export async function assertCategoryForActivePlayer(
  tenantId: number,
  categoryId: number | null | undefined,
): Promise<void> {
  if (categoryId == null) {
    throw new ValidationError(
      'Asigna una categoría al jugador para poder activarlo',
      'PLAYER_CATEGORY_REQUIRED',
    );
  }
  const category = await categoryRepository.findById(tenantId, categoryId);
  if (!category) {
    throw new ValidationError('La categoría seleccionada no pertenece a esta academia');
  }
  if (category.status !== CategoryStatus.ACTIVE) {
    throw new ValidationError(
      'La categoría del jugador está inactiva. Asígnale una categoría activa para activarlo.',
      'CATEGORY_INACTIVE',
    );
  }
}
