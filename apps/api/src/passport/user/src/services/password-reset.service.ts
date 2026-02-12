import {Injectable, BadRequestException, NotFoundException} from "@nestjs/common";
import {UserService} from "../user.service";
import {VerificationService} from "../verification.service";
import {UserConfigService} from "../config.service";

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly userService: UserService,
    private readonly userConfigService: UserConfigService,
    private readonly verificationService: VerificationService
  ) {}

  async startForgotPasswordProcess(
    username: string,
    provider: "email" | "phone"
  ): Promise<{message: string}> {
    const {user, strategy} = await this.validateUserAndProvider(username, provider);

    await this.userService.isUserVerifiedProvider(user, provider);

    const providerField = user[provider] as any;
    const decryptedValue = this.userService.decryptField({
      encrypted: providerField.encrypted,
      iv: providerField.iv,
      authTag: providerField.authTag
    });

    await this.verificationService.startVerificationProcess(
      user._id,
      decryptedValue,
      strategy,
      provider,
      "password_reset"
    );

    return {
      message: "Reset password verification code sent successfully."
    };
  }

  async verifyAndResetPassword(
    username: string,
    code: string,
    newPassword: string,
    provider: "email" | "phone"
  ) {
    try {
      const {user, strategy} = await this.validateUserAndProvider(username, provider);

      await this.userService.isUserVerifiedProvider(user, provider);

      const response = await this.verificationService.confirmVerificationProcess(
        user._id,
        code,
        strategy,
        provider,
        "password_reset"
      );

      const passwordUpdates = await this.userService.handlePasswordUpdate(
        response.userId,
        newPassword,
        true
      );
      await this.userService.findOneAndUpdate({_id: response.userId}, {$set: passwordUpdates});
    } catch (error) {
      console.error("Error during password reset:", error);
      throw new BadRequestException("Failed to reset password.");
    }

    return {
      message: "Password has been reset successfully. You can now log in with your new password."
    };
  }

  private async validateUserAndProvider(
    username: string,
    provider: "email" | "phone"
  ): Promise<{user: any; strategy: string}> {
    const errorMessage = "Provider or Reset password is not configured properly.";
    const user = await this.userService.findOne({username});
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const resetPasswordProviders = await this.userConfigService.getResetPasswordConfig();
    if (!resetPasswordProviders || resetPasswordProviders.length === 0) {
      throw new BadRequestException(errorMessage);
    }

    const providerConfig = resetPasswordProviders.find(p => p.provider === provider);
    if (!providerConfig) {
      throw new BadRequestException(errorMessage);
    }

    return {user, strategy: providerConfig.strategy};
  }
}
