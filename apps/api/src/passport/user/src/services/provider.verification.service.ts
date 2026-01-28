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
    return await this.verificationService.startVerificationProcess(
      id,
      value,
      strategy,
      provider,
      purpose
    );
  }

  async validateCredentialsVerification(
    id: ObjectId,
    code: string,
    strategy: string,
    provider: string,
    purpose: string
  ): Promise<{message: string; provider: string; destination: string}> {
    const response = await this.verificationService.confirmVerificationProcess(
      id,
      code,
      strategy,
      provider,
      purpose
    );

    const encryptedData = this.userService.encryptField(response.destination);

    await this.userService.updateOne(
      {_id: response.userId},
      {
        $set: {
          [response.verifiedField]: {
            encrypted: encryptedData.encrypted,
            iv: encryptedData.iv,
            authTag: encryptedData.authTag,
            salt: encryptedData.salt,
            hash: encryptedData.hash,
            createdAt: new Date()
          }
        }
      }
    );

    return {
      message: "Verification completed successfully",
      provider: response.provider,
      destination: response.destination
    };
  }
}
