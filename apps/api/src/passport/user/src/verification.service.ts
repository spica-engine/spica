import {Injectable, NotFoundException, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService, ObjectId} from "@spica-server/database";
import {UserVerification, UserOptions, USER_OPTIONS} from "@spica-server/interface/passport/user";
import {hash} from "@spica-server/core/schema";
import {MailerService} from "@spica-server/mailer";
import {UserService} from "./user.service";
import {randomInt} from "crypto";

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

      await this.insertOne({
        userId: id,
        destination: value,
        expiredAt: new Date(Date.now() + 5 * 60 * 1000),
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
    // First, check if a verification exists for this user/provider
    const verification = await this.findOne({
      userId: id,
      channel: provider,
      purpose: "verify",
      active: true
    });

    if (!verification) {
      throw new NotFoundException(
        "No active verification found for this user and provider. Please request a new verification code."
      );
    }

    // Check if verification has expired
    if (verification.expiredAt <= new Date()) {
      throw new NotFoundException(
        "Verification code has expired. Please request a new verification code."
      );
    }

    // Check if attempt limit has been reached
    if (verification.attempts >= 5) {
      throw new NotFoundException(
        "Too many verification attempts. Please request a new verification code."
      );
    }

    // Increment attempts
    await this.updateOne(
      {_id: verification._id},
      {$inc: {attempts: 1}}
    );

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
