import {Injectable, NotFoundException, BadRequestException} from "@nestjs/common";
import {UserService} from "../user.service";
import {VerificationService} from "../verification.service";
import {UserConfigService} from "../config.service";

@Injectable()
export class PasswordlessLoginService {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly userConfigService: UserConfigService,
    private userService: UserService
  ) {}

  async start(username: string, provider: "email" | "phone") {
    const {providerConfig, user} = await this.validateAndGetUser(username, provider);

    const providerField = (user as any)[provider];

    await this.userService.isUserVerifiedProvider(user, provider);

    const value = this.userService.decryptField(providerField);

    try {
      const sendResult = await this.verificationService.startVerificationProcess(
        user._id,
        value,
        providerConfig.strategy,
        provider,
        "passwordless_login"
      );

      return {
        message: sendResult.message,
        metadata: sendResult.metadata
      };
    } catch (error) {
      console.error(
        `Error starting passwordless verification via ${providerConfig.provider}:`,
        error
      );
      throw new BadRequestException("Failed to send verification code");
    }
  }

  async verify(username: string, code: string, provider: "email" | "phone") {
    const {providerConfig, user} = await this.validateAndGetUser(username, provider);

    this.userService.checkUserIsBlocked(user);
    this.userService.checkUserBan(user);

    try {
      await this.verificationService.confirmVerificationProcess(
        user._id,
        code,
        providerConfig.strategy,
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

  private async validateAndGetUser(username: string, provider: "email" | "phone") {
    const errorMessage = "Passwordless login is not configured properly.";
    const config = await this.userConfigService.getPasswordlessLoginConfig();

    if (!config) {
      throw new BadRequestException(errorMessage);
    }

    if (!config.passwordlessLoginProvider || !Array.isArray(config.passwordlessLoginProvider)) {
      throw new BadRequestException(errorMessage);
    }

    const providerConfig = config.passwordlessLoginProvider.find(p => p.provider === provider);

    if (!providerConfig) {
      throw new BadRequestException(errorMessage);
    }

    const user = await this.findUserByUsername(username);

    if (!user) {
      throw new NotFoundException(`No user found`);
    }

    return {providerConfig, user};
  }

  private findUserByUsername(username: string) {
    return this.userService.findOne({username: username});
  }
}
