import {Id} from "@spica-server/interface-data";
import {VerificationService} from "../verification.service.js";
import {Inject, Injectable} from "@nestjs/common";
import {USER_REPOSITORY, UserRepository} from "@spica-server/interface-passport-user";
import {UserService} from "../user.service.js";

@Injectable()
export class ProviderVerificationService {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly userService: UserService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository
  ) {}

  async startCredentialsVerification(
    id: Id,
    value: string,
    strategy: string,
    provider: string,
    purpose: string
  ): Promise<{message: string; value: string; metadata: Record<string, any>}> {
    return this.verificationService.startVerificationProcess(
      id,
      value,
      strategy,
      provider,
      purpose
    );
  }

  async validateCredentialsVerification(
    code: string,
    strategy: string,
    id?: Id,
    provider?: string,
    purpose?: string
  ): Promise<{message: string; provider: string; destination: string}> {
    const response =
      strategy === "MagicLink"
        ? await this.verificationService.confirmMagicLinkVerification(code)
        : await this.verificationService.confirmVerificationProcess(
            id,
            code,
            strategy,
            provider,
            purpose
          );

    return this.persistVerifiedProvider(
      response.userId,
      response.destination,
      response.verifiedField,
      response.provider
    );
  }

  private async persistVerifiedProvider(
    userId: Id,
    destination: string,
    verifiedField: string,
    provider: string
  ): Promise<{message: string; provider: string; destination: string}> {
    const encryptedData = this.userService.encryptField(destination);

    await this.users.setFields(userId, {
      [verifiedField]: encryptedData,
      [`${verifiedField}_verified_at`]: new Date()
    });

    return {
      message: "Verification completed successfully",
      provider,
      destination
    };
  }
}
