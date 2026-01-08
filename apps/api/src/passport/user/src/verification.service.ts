import {Injectable, NotFoundException} from "@nestjs/common";
import {BaseCollection, DatabaseService, ObjectId} from "@spica-server/database";
import {UserVerification} from "@spica-server/interface/passport/user";
import {hash} from "@spica-server/core/schema";
import {MailerService} from "@spica-server/mailer";
import {UserService} from "./user.service";
@Injectable()
export class VerificationService extends BaseCollection<UserVerification>("verification") {
  constructor(
    db: DatabaseService,
    private mailerService: MailerService,
    private userService: UserService
  ) {
    super(db);
  }

  async startAuthProviderVerification(id: ObjectId, value: string, provider: string) {
    const code = this.random6Digit();
    const hashedCode = hash(code, "verifyHashSecret"); //Todo! change secret
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

    const isCodeValid = hash(code, "verifyHashSecret") === verification.code; //Todo! change secret

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

  private random6Digit() {
    return Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0");
  }
}
