import {Injectable, NotFoundException, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService, ObjectId} from "@spica-server/database";
import {UserVerification, UserOptions, USER_OPTIONS} from "@spica-server/interface/passport/user";
import {hash} from "@spica-server/core/schema";
import {MailerService} from "@spica-server/mailer";
import {UserService} from "./user.service";
import {randomInt} from "crypto";

const DEFAULT_VERIFICATION_CODE_EXPIRES_IN_SECONDS = 300;

@Injectable()
export class VerificationService extends BaseCollection<UserVerification>("verification") {
  constructor(
    db: DatabaseService,
    private mailerService: MailerService,
    private userService: UserService,
    @Inject(USER_OPTIONS) private userOptions: UserOptions
  ) {
    super(db);
  }

  async startAuthProviderVerification(id: ObjectId, value: string, provider: string) {
    const code = this.random6Digit();
    const hashedCode = hash(code, this.getHashSecret());
    try {
      const result = await this.mailerService.sendMail({
        to: value,
        subject: "Spica verification code",
        text: `Your verification code for ${provider} is: ${code}`
      });

      const success =
        result.accepted?.length > 0 && (!result.rejected || result.rejected.length === 0);

      if (!success) {
        throw new Error("Mail was not accepted by SMTP");
      }

      const expiresInMs = (this.userOptions.verificationCodeExpiresIn || DEFAULT_VERIFICATION_CODE_EXPIRES_IN_SECONDS) * 1000;
      
      await this.insertOne({
        userId: id,
        destination: value,
        expiredAt: new Date(Date.now() + expiresInMs),
        attempts: 0,
        code: hashedCode,
        channel: provider,
        purpose: "verify",
        active: true
      });

      return {
        message: "Verification code sent successfully",
        value
      };
    } catch (error) {
      console.error("Error sending verification email:", error);
      throw error;
    }
  }

  async verifyAuthProvider(id: ObjectId, code: string, provider: string) {
    const verification = await this.findOneAndUpdate(
      {
        userId: id,
        channel: provider,
        purpose: "verify",
        active: true,
        attempts: {$lt: 5},
        expiredAt: {$gt: new Date()}
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

    await this.updateOne({_id: verification._id}, {$set: {active: false}});

    await this.userService.updateOne(
      {_id: verification.userId},
      {
        $set: {
          email: {
            value: verification.destination,
            created_at: new Date(),
            verified: true
          }
        }
      }
    );
    return {
      message: "Verification completed successfully"
    };
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
