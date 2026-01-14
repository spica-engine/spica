import {Injectable, NotFoundException, Inject, BadRequestException} from "@nestjs/common";
import {BaseCollection, DatabaseService, ObjectId} from "@spica-server/database";
import {UserVerification, UserOptions, USER_OPTIONS} from "@spica-server/interface/passport/user";
import {hash} from "@spica-server/core/schema";
import {UserService} from "./user.service";
import {randomInt} from "crypto";
import {VerificationProviderRegistry} from "./providers";

@Injectable()
export class VerificationService extends BaseCollection<UserVerification>("verification") {
  private readonly MAX_ATTEMPTS = 5;

  constructor(
    db: DatabaseService,
    private readonly providerRegistry: VerificationProviderRegistry,
    private userService: UserService,
    @Inject(USER_OPTIONS) private userOptions: UserOptions
  ) {
    super(db, {afterInit: () => this.upsertTTLIndex(this.userOptions.verificationCodeExpiresIn)});
  }

  async startAuthProviderVerification(id: ObjectId, value: string, provider: string) {
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
        channel: provider,
        purpose: "verify",
        is_used: false
      },
      {
        $setOnInsert: {
          userId: id,
          destination: value,
          purpose: "verify",
          channel: provider,
          attempts: 0,
          createdAt: new Date()
        },
        $inc: {
          verificationCount: 1
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

    if (verification.verificationCount > this.MAX_ATTEMPTS) {
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
        throw new Error(sendResult.message || "Failed to send verification code");
      }

      return {
        message: sendResult.message || "Verification code sent successfully",
        value,
        metadata: sendResult.metadata
      };
    } catch (error) {
      console.error(`Error sending verification via ${provider}:`, error);
      throw new BadRequestException(
        error.message || `Failed to send verification code via ${provider}`
      );
    }
  }

  async verifyAuthProvider(id: ObjectId, code: string, provider: string) {
    const verification = await this.findOneAndUpdate(
      {
        userId: id,
        channel: provider,
        purpose: "verify",
        is_used: false,
        attempts: {$lt: this.MAX_ATTEMPTS}
      },
      {
        $inc: {attempts: 1}
      }
    );

    if (!verification) {
      throw new NotFoundException("No verification found");
    }

    const isCodeValid = hash(code, this.getHashSecret()) === verification.code;

    if (!isCodeValid) {
      throw new Error("Invalid verification code");
    }

    try {
      await Promise.all([
        this.updateOne({_id: verification._id}, {$set: {is_used: true}}),

        this.userService.updateOne(
          {_id: verification.userId},
          {
            $set: {
              email: {
                value: verification.destination,
                createdAt: new Date(),
                verified: true
              }
            }
          }
        )
      ]);
      return {
        message: "Verification completed successfully"
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
}
