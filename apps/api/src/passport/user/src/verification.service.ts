import {Injectable, NotFoundException, Inject, BadRequestException} from "@nestjs/common";
import {BaseCollection, DatabaseService, ObjectId} from "@spica-server/database";
import {
  UserVerification,
  UserOptions,
  USER_OPTIONS,
  VerificationMessage
} from "@spica-server/interface/passport/user";
import {hash, encrypt, decrypt, BaseEncryptedData} from "@spica-server/core/encryption";
import {randomInt} from "crypto";
import {VerificationProviderRegistry} from "./providers";
import {UserConfigService} from "./config.service";

interface MagicLinkPayload {
  userId: string;
  value: string;
  provider: string;
  purpose: string;
  exp: number;
}

interface VerificationStrategyHandler {
  validatePreConditions(provider: string): Promise<void>;
  generateCode(id: ObjectId, value: string, provider: string, purpose: string): string;
  buildSendPayload(rawCode: string, value: string, provider: string): Partial<VerificationMessage>;
}

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

    const handler = this.getStrategyHandler(strategy);

    if (handler.validatePreConditions) {
      await handler.validatePreConditions(provider);
    }

    const rawCode = handler.generateCode(id, value, provider, purpose);
    const hashedCode = hash(rawCode, this.getHashSecret());

    const record = await this.upsertVerificationRecord(
      id,
      value,
      strategy,
      provider,
      purpose,
      hashedCode
    );

    await this.enforceAttemptLimit(record);

    const sendPayload = handler.buildSendPayload(rawCode, value, provider);
    return this.sendVerification(verificationProvider, value, provider, sendPayload, record._id);
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

  async confirmMagicLinkVerification(token: string): Promise<{
    userId: ObjectId;
    destination: string;
    verifiedField: string;
    strategy: string;
    provider: string;
  }> {
    const payload = this.decryptMagicLinkToken(token);
    return this.confirmVerificationProcess(
      new ObjectId(payload.userId),
      token,
      "MagicLink",
      payload.provider,
      payload.purpose
    );
  }

  private getStrategyHandler(strategy: string): VerificationStrategyHandler {
    switch (strategy) {
      case "Otp":
        return {
          validatePreConditions: provider => this.checkStrategyEnabled(provider, "Otp"),
          generateCode: () => this.random6Digit(),
          buildSendPayload: (code, _value, provider) => ({
            code,
            metadata: {
              subject: "Spica verification code",
              text: `Your verification code for ${provider} is: ${code}`
            }
          })
        };
      case "MagicLink":
        return {
          validatePreConditions: provider => this.checkStrategyEnabled(provider, "MagicLink"),
          generateCode: (id, value, provider, purpose) => {
            if (!this.userOptions.publicUrl) {
              throw new BadRequestException(
                "Public URL is not configured. Magic link verification requires a public URL."
              );
            }
            return this.generateMagicLinkToken(id, value, provider, purpose);
          },
          buildSendPayload: (token, _value, provider) => {
            const magicLinkUrl = `${this.userOptions.publicUrl}/passport/user/verify-magic-link?token=${token}`;
            return {
              magicLinkUrl,
              metadata: {
                subject: `Spica ${provider} verification`,
                text: `Verify your ${provider} by clicking this link: ${magicLinkUrl}`
              }
            };
          }
        };
      default:
        throw new BadRequestException(`Unknown verification strategy: '${strategy}'`);
    }
  }

  private async upsertVerificationRecord(
    id: ObjectId,
    value: string,
    strategy: string,
    provider: string,
    purpose: string,
    hashedCode: string
  ) {
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

    if (!result) {
      throw new BadRequestException("Failed to create verification record.");
    }

    return result;
  }

  private async enforceAttemptLimit(record: UserVerification) {
    const maxAttempts = await this.getUserConfigMaxAttempts();
    if (record.requestCount > maxAttempts) {
      throw new BadRequestException(
        "Too many verification attempts. Please wait a bit before trying again."
      );
    }
  }

  private async sendVerification(
    verificationProvider: ReturnType<VerificationProviderRegistry["getProvider"]>,
    destination: string,
    provider: string,
    sendPayload: Partial<VerificationMessage>,
    recordId: ObjectId
  ) {
    try {
      const sendResult = await verificationProvider.send({
        destination,
        provider,
        ...sendPayload
      } as VerificationMessage);

      if (!sendResult.success) {
        await this.findOneAndDelete({_id: recordId});
        throw new Error(sendResult.message || "Failed to send verification");
      }

      return {
        message: sendResult.message || "Verification sent successfully",
        value: destination,
        metadata: sendResult.metadata
      };
    } catch (error) {
      console.error(`Error sending verification via ${provider}:`, error);
      await this.findOneAndDelete({_id: recordId});
      throw new BadRequestException(error.message || `Failed to send verification via ${provider}`);
    }
  }

  private generateMagicLinkToken(
    userId: ObjectId,
    value: string,
    provider: string,
    purpose: string
  ): string {
    const secret = this.getEncryptionSecret();
    const ttl = this.userOptions.verificationCodeExpiresIn || this.TTL_INDEX_EXPIRES_IN;

    const payload: MagicLinkPayload = {
      userId: userId.toHexString(),
      value,
      provider,
      purpose,
      exp: Date.now() + ttl * 1000
    };

    const encrypted = encrypt(JSON.stringify(payload), secret);

    const combined = JSON.stringify({
      encrypted: encrypted.encrypted,
      iv: encrypted.iv,
      authTag: encrypted.authTag
    });

    return Buffer.from(combined).toString("base64url");
  }

  private decryptMagicLinkToken(token: string): MagicLinkPayload {
    const secret = this.getEncryptionSecret();

    let encryptedData: BaseEncryptedData;
    try {
      const decoded = Buffer.from(token, "base64url").toString("utf-8");
      encryptedData = JSON.parse(decoded);
    } catch {
      throw new BadRequestException("Invalid magic link token format.");
    }

    let payload: MagicLinkPayload;
    try {
      const decrypted = decrypt(encryptedData, secret);
      payload = JSON.parse(decrypted);
    } catch {
      throw new BadRequestException("Invalid or tampered magic link token.");
    }

    if (!payload.exp || Date.now() > payload.exp) {
      throw new BadRequestException("Magic link has expired.");
    }

    if (!payload.userId || !payload.value || !payload.provider || !payload.purpose) {
      throw new BadRequestException("Incomplete magic link token payload.");
    }

    return payload;
  }

  private async checkStrategyEnabled(provider: string, strategy: string): Promise<void> {
    const config = await this.userConfigService.getProviderVerificationConfig();
    if (!config) {
      throw new BadRequestException(
        "Provider verification config is not set. Please configure providerVerificationConfig to enable the strategy."
      );
    }

    const providerConfig = config.find(c => c.provider === provider && c.strategy === strategy);

    if (!providerConfig) {
      throw new BadRequestException(
        `${strategy} strategy is not enabled for provider '${provider}'. Update providerVerificationConfig to enable it.`
      );
    }
  }

  private random6Digit(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, "0");
  }

  private getHashSecret(): string {
    if (!this.userOptions.verificationHashSecret) {
      throw new Error(
        "User hash secret is not configured. Please set USER_VERIFICATION_HASH_SECRET"
      );
    }
    return this.userOptions.verificationHashSecret;
  }

  private getEncryptionSecret(): string {
    if (!this.userOptions.providerEncryptionSecret) {
      throw new BadRequestException(
        "Provider encryption secret is not configured. Please set USER_PROVIDER_ENCRYPTION_SECRET."
      );
    }
    return this.userOptions.providerEncryptionSecret;
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
