import {ObjectId} from "@spica-server/database";
import {VerificationService} from "../verification.service";
import {Injectable} from "@nestjs/common";
import {UserService} from "../user.service";

@Injectable()
export class ProviderVerificationService {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly userService: UserService
  ) {}

  async startCredentialsVerification(
    id: ObjectId,
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
    id?: ObjectId,
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
    userId: ObjectId,
    destination: string,
    verifiedField: string,
    provider: string
  ): Promise<{message: string; provider: string; destination: string}> {
    const encryptedData = this.userService.encryptField(destination);
    const hashedValue = this.userService.hashProviderValue(destination);

    await this.userService.updateOne(
      {_id: userId},
      {
        $set: {
          [verifiedField]: {
            encrypted: encryptedData.encrypted,
            iv: encryptedData.iv,
            authTag: encryptedData.authTag,
            createdAt: new Date(),
            hash: hashedValue
          }
        }
      }
    );

    return {
      message: "Verification completed successfully",
      provider,
      destination
    };
  }
}
