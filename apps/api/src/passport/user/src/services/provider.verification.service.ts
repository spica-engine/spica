import {ObjectId} from "@spica-server/database";
import {VerificationService} from "../verification.service";
import {BadRequestException, Injectable} from "@nestjs/common";
import {UserService} from "../user.service";

@Injectable()
export class ProviderVerificationService {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly userService: UserService
  ) {}

  async verifyProvider(
    id: ObjectId,
    code: string,
    strategy: "Otp",
    provider: string
  ): Promise<{message: string; provider: string; destination: string}> {
    const response = await this.verificationService.verifyProvider(
      id,
      code,
      strategy,
      provider,
      "verify"
    );

    await this.userService.updateOne(
      {_id: response.userId},
      {
        $set: {
          [response.verifiedField]: {
            value: response.destination,
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
