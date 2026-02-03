import {Injectable, NotFoundException, BadRequestException} from "@nestjs/common";
import {UserService} from "../user.service";
import {VerificationService} from "../verification.service";
import {UserConfigService} from "../config.service";

@Injectable()
export class PasswordlessService {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly userConfigService: UserConfigService,
    private userService: UserService
  ) {}

  async start(username: string, strategy: string) {
    const config = await this.userConfigService.getPasswordlessLoginConfig();

    if (!config?.isActive) {
      throw new BadRequestException("Passwordless login is not enabled");
    }

    const provider = config.provider;
    const user = await this.findUserByUsername(username);
    if (!user) {
      throw new NotFoundException(`No user found with username: ${username}`);
    }

    const providerField = (user as any)[provider];

    if (!providerField || !providerField.encrypted) {
      throw new BadRequestException(`User does not have a verified provider`);
    }

    const value = this.userService.decryptField(providerField);

    try {
      const sendResult = await this.verificationService.startVerificationProcess(
        user._id,
        value,
        strategy,
        provider,
        "passwordless_login"
      );

      return {
        message: sendResult.message,
        metadata: sendResult.metadata
      };
    } catch (error) {
      console.error(`Error starting passwordless verification via ${provider}:`, error);
      throw new BadRequestException("Failed to send verification code");
    }
  }

  async verify(username: string, strategy: string, code: string) {
    const config = await this.userConfigService.getPasswordlessLoginConfig();

    if (!config?.isActive) {
      throw new BadRequestException("Passwordless login is not enabled");
    }

    const provider = config.provider;

    const user = await this.findUserByUsername(username);

    if (!user) {
      throw new NotFoundException(`No user found with username: ${username}`);
    }

    this.userService.checkUserIsBlocked(user);
    this.userService.checkUserBan(user);

    try {
      await this.verificationService.confirmVerificationProcess(
        user._id,
        code,
        strategy,
        provider,
        "passwordless_login"
      );

      const [refreshToken] = await Promise.all([
        this.userService.signRefreshToken(user),
        this.userService.updateOne({_id: user._id}, {$set: {lastLogin: new Date()}})
      ]);

      const accessToken = this.userService.sign(user);

      return {
        token: accessToken.token,
        scheme: accessToken.scheme,
        issuer: accessToken.issuer,
        refreshToken: refreshToken.token
      };
    } catch (error) {
      console.error("Error verifying passwordless login", error);
      throw new BadRequestException("Failed to complete passwordless login. Please try again.");
    }
  }

  private findUserByUsername(username: string) {
    return this.userService.findOne({username: username});
  }
}
