import {Injectable, NotFoundException, Inject, BadRequestException} from "@nestjs/common";
import {BaseCollection, DatabaseService, ObjectId} from "@spica-server/database";
import {UserVerification, UserOptions, USER_OPTIONS} from "@spica-server/interface/passport/user";
import {hash} from "@spica-server/core/schema";
import {randomInt} from "crypto";
import {VerificationProviderRegistry} from "./providers";
import {UserConfigService} from "./config.service";

@Injectable()
export class VerificationService extends BaseCollection<UserVerification>("verification") {
  private readonly TTL_INDEX_EXPIRES_IN = 300;
  constructor(
    db: DatabaseService,
    private readonly providerRegistry: VerificationProviderRegistry,
    @Inject(USER_OPTIONS) private userOptions: UserOptions,
    private readonly userConfigService: UserConfigService
  ) {
    super(db, {
      afterInit: () =>
        this.upsertTTLIndex(this.userOptions.verificationCodeExpiresIn || this.TTL_INDEX_EXPIRES_IN)
    });
  }

  async startVerificationProcess(
    id: ObjectId,
    value: string,
    strategy: string,
    provider: string,
    purpose: string
  ) {
    const verificationProvider = this.providerRegistry.getProvider(provider);
    if (!verificationProvider.validateDestination(value)) {
      throw new BadRequestException(
        `Invalid destination format for provider '${provider}'. Please provide a valid ${provider} address.`
      );
    }
    const code = this.random6Digit();
    const hashedCode = hash(code, this.getHashSecret());

    const result = await this.findOneAndUpdate(
      {
        userId: id,
        strategy: strategy,
        purpose: purpose,
        is_used: false
      },
      {
        $setOnInsert: {
          userId: id,
          destination: value,
          provider: provider,
          purpose: purpose,
          strategy: strategy,
          createdAt: new Date()
        },
        $inc: {
          requestCount: 1
        },
        $set: {
          code: hashedCode
        }
      },
      {
        upsert: true,
        returnDocument: "after"
      }
    );

    const verification = result;

    if (!verification) {
      throw new Error("Failed to create verification record");
    }
    const maxAttempts = await this.getUserConfigMaxAttempts();
    if (verification.requestCount > maxAttempts) {
      throw new BadRequestException(
        "Too many verification attempts. Please wait a bit before trying again."
      );
    }

    try {
      const sendResult = await verificationProvider.send({
        destination: value,
        code,
        provider,
        metadata: {
          subject: "Spica verification code",
          text: `Your verification code for ${provider} is: ${code}`
        }
      });

      if (!sendResult.success) {
        await this.findOneAndDelete({_id: verification._id});
        throw new Error(sendResult.message || "Failed to send verification code");
      }

      return {
        message: sendResult.message || "Verification code sent successfully",
        value,
        metadata: sendResult.metadata
      };
    } catch (error) {
      console.error(`Error sending verification via ${provider}:`, error);
      await this.findOneAndDelete({_id: verification._id});
      throw new BadRequestException(
        error.message || `Failed to send verification code via ${provider}`
      );
    }
  }

  async confirmVerificationProcess(
    id: ObjectId,
    code: string,
    strategy: string,
    provider: string,
    purpose: string
  ): Promise<{
    userId: ObjectId;
    destination: string;
    verifiedField: string;
    strategy: string;
    provider: string;
  }> {
    const verification = await this.findOneAndUpdate(
      {
        userId: id,
        strategy: strategy,
        provider: provider,
        purpose: purpose,
        is_used: false
      },
      {
        $set: {is_used: true}
      }
    );

    if (!verification) {
      throw new NotFoundException("No verification found");
    }

    const isCodeValid = hash(code, this.getHashSecret()) === verification.code;

    if (!isCodeValid) {
      throw new BadRequestException("Invalid verification code");
    }

    try {
      const verifiedField = this.providerRegistry.getProvider(provider).name;
      return {
        userId: verification.userId,
        destination: verification.destination,
        verifiedField,
        strategy,
        provider
      };
    } catch (error) {
      console.error("Error during verification process:", error);
      throw new Error("Error during verification process");
    }
  }

  private random6Digit(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, "0");
  }

  private getHashSecret(): string {
    if (!this.userOptions.hashSecret) {
      throw new Error("User hash secret is not configured. Please set USER_HASH_SECRET");
    }
    return this.userOptions.hashSecret;
  }

  private async getUserConfigMaxAttempts(): Promise<number> {
    const config = await this.userConfigService.get();
    const maxAttempt = config?.options?.["verificationProcessMaxAttempt"];

    if (!maxAttempt) {
      throw new Error("User max attempt count not found.");
    }

    return maxAttempt;
  }
}
