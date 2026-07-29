/**
 * src/presentation/controllers/LicenseController.ts
 *
 * Controlador para endpoints de licencia.
 */

import { RequestLicenseUseCase } from '../../application/use-cases/RequestLicenseUseCase';
import { RequestLicenseRequestDTO } from '../../application/dtos/LicenseDTOs';

export class LicenseController {
  constructor(private requestLicenseUseCase: RequestLicenseUseCase) {}

  async requestLicense(request: RequestLicenseRequestDTO): Promise<{
    status: number;
    body: unknown;
  }> {
    try {
      const result = await this.requestLicenseUseCase.execute(request);
      return { status: 201, body: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error interno';
      return { status: 400, body: { error: message } };
    }
  }
}