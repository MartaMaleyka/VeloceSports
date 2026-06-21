/**
 * Patrón base de repositorio multi-tenant.
 * Todo repositorio operativo DEBE recibir tenantId como parámetro obligatorio.
 */
export abstract class TenantScopedRepository {
  protected assertTenantId(tenantId: number): void {
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      throw new Error('tenantId es obligatorio y debe ser un entero positivo');
    }
  }
}
