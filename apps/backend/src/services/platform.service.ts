import type {
  AcademyDetailDto,
  AcademyListItemDto,
  AcademyStatus,
  CreateAcademyResponseDto,
  CreatePlatformUserResponseDto,
  PlatformUserDto,
  ReactivateAcademyResultDto,
} from '@velocesport/shared';
import {
  UserStatus,
  UserRole,
} from '@velocesport/shared';
import {
  type AcademyListFilters,
} from '../repositories/academy.repository.js';
import { academyService } from './academy.service.js';
import { accountApprovalService } from './account-approval.service.js';
import { platformUserService } from './platform-user.service.js';
import type {
  CreateAcademyBody,
  CreateAcademyUserBody,
  CreateSuperAdminBody,
  ReactivateAcademyBody,
  UpdateAcademyBody,
} from '../validators/platform.validator.js';
import {
  type AcademyListPageDto,
  type AcademyListSortKey,
  type PaginationParams,
} from '@velocesport/shared';

export class PlatformService {
  async listAcademies(filters?: AcademyListFilters): Promise<AcademyListItemDto[]> {
    return academyService.listAcademies(filters);
  }

  async listAcademiesPage(
    filters: AcademyListFilters,
    options: { sort?: AcademyListSortKey; direction?: 'asc' | 'desc'; pagination: PaginationParams },
  ): Promise<AcademyListPageDto> {
    return academyService.listAcademiesPage(filters, options);
  }

  async getAcademy(academyId: number): Promise<AcademyDetailDto> {
    return academyService.getAcademy(academyId);
  }

  async createAcademyWithAdmin(
    actorUserId: number,
    input: CreateAcademyBody,
  ): Promise<CreateAcademyResponseDto> {
    return academyService.createAcademyWithAdmin(actorUserId, input);
  }

  async updateAcademy(
    actorUserId: number,
    academyId: number,
    input: UpdateAcademyBody,
  ): Promise<AcademyDetailDto> {
    return academyService.updateAcademy(actorUserId, academyId, input);
  }

  async updateAcademyStatus(
    actorUserId: number,
    academyId: number,
    status: AcademyStatus,
  ): Promise<AcademyDetailDto> {
    return academyService.updateAcademyStatus(actorUserId, academyId, status);
  }

  async reactivateAcademy(
    actorUserId: number,
    academyId: number,
    input: ReactivateAcademyBody,
  ): Promise<ReactivateAcademyResultDto> {
    return academyService.reactivateAcademy(actorUserId, academyId, input);
  }

  async approveAccount(
    actorUserId: number,
    academyId: number,
  ): Promise<AcademyDetailDto> {
    return accountApprovalService.approveAccount(
      actorUserId,
      academyId,
      (id) => this.getAcademy(id),
    );
  }

  async rejectAccount(
    actorUserId: number,
    academyId: number,
    reason: string | null,
  ): Promise<AcademyDetailDto> {
    return accountApprovalService.rejectAccount(
      actorUserId,
      academyId,
      reason,
      (id) => this.getAcademy(id),
    );
  }

  async listAcademyUsers(
    academyId: number,
    filters?: { search?: string; role?: typeof UserRole.ACADEMY_ADMIN; status?: typeof UserStatus.ACTIVE },
  ): Promise<PlatformUserDto[]> {
    return platformUserService.listAcademyUsers(academyId, filters);
  }

  async createAcademyUser(
    actorUserId: number,
    academyId: number,
    input: CreateAcademyUserBody,
  ): Promise<CreatePlatformUserResponseDto> {
    return platformUserService.createAcademyUser(actorUserId, academyId, input);
  }

  async updateAcademyUserStatus(
    actorUserId: number,
    academyId: number,
    userId: number,
    status: typeof UserStatus.ACTIVE | typeof UserStatus.INACTIVE,
  ): Promise<PlatformUserDto> {
    return platformUserService.updateAcademyUserStatus(actorUserId, academyId, userId, status);
  }

  async listSuperAdmins(): Promise<PlatformUserDto[]> {
    return platformUserService.listSuperAdmins();
  }

  async createSuperAdmin(
    actorUserId: number,
    input: CreateSuperAdminBody,
  ): Promise<CreatePlatformUserResponseDto> {
    return platformUserService.createSuperAdmin(actorUserId, input);
  }

  async updateSuperAdminStatus(
    actorUserId: number,
    targetUserId: number,
    status: typeof UserStatus.ACTIVE | typeof UserStatus.INACTIVE,
  ): Promise<PlatformUserDto> {
    return platformUserService.updateSuperAdminStatus(actorUserId, targetUserId, status);
  }
}

export const platformService = new PlatformService();
