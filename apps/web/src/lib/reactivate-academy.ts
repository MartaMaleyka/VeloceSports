import type { ReactivateAcademyResultDto } from '@velocesport/shared';
import { PlatformApiError, platformFetch } from './platform-api';

export async function reactivateAcademy(
  academyId: number,
  acknowledgeOverdueInvoices: boolean,
): Promise<ReactivateAcademyResultDto> {
  return platformFetch<ReactivateAcademyResultDto>(`academies/${academyId}/reactivate`, {
    method: 'POST',
    body: JSON.stringify({ acknowledgeOverdueInvoices }),
  });
}
