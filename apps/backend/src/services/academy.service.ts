import { academyRepository } from '../repositories/academy.repository.js';
import { platformService } from './platform.service.js';
import { NotFoundError } from '../types/index.js';

export interface AcademyDto {
  id: number;
  name: string;
  slug: string;
  status: string;
  timezone: string;
  locale: string;
  currency: string;
}

export class AcademyService {
  async getCurrentAcademy(tenantId: number): Promise<AcademyDto> {
    const academy = await academyRepository.findByTenantId(tenantId);
    if (!academy) {
      throw new NotFoundError('Academia no encontrada');
    }
    return this.toDto(academy);
  }

  async getAcademyById(tenantId: number, academyId: number): Promise<AcademyDto> {
    const academy = await academyRepository.findByIdScoped(tenantId, academyId);
    if (!academy) {
      throw new NotFoundError('Academia no encontrada');
    }
    return this.toDto(academy);
  }

  async listAllAcademiesForPlatform(): Promise<AcademyDto[]> {
    const academies = await platformService.listAcademies();
    return academies.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      status: a.status,
      timezone: a.timezone,
      locale: a.locale,
      currency: a.currency,
    }));
  }

  private toDto(academy: {
    id: number;
    name: string;
    slug: string;
    status: string;
    timezone: string;
    locale: string;
    currency: string;
  }): AcademyDto {
    return {
      id: academy.id,
      name: academy.name,
      slug: academy.slug,
      status: academy.status,
      timezone: academy.timezone,
      locale: academy.locale,
      currency: academy.currency,
    };
  }
}

export const academyService = new AcademyService();
