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

  async startForgotPasswordProcess(username: string): Promise<{message: string}> {
    const {user, config} = await this.validateAndGetUser(username);

    const providerField = user[config.provider] as any;
    this.userService.isUserVerifiedProvider(user, config.provider);

    const decryptedValue = this.userService.decryptField({
      encrypted: providerField.encrypted,
      iv: providerField.iv,
      authTag: providerField.authTag
    });

    await this.verificationService.startVerificationProcess(
      user._id,
      decryptedValue,
      config.strategy,
      config.provider,
      "password_reset"
    );

    return {
      message: "Reset password verification code sent successfully."
    };
  }

  async verifyAndResetPassword(username: string, code: string, newPassword: string) {
    try {
      const {user, config} = await this.validateAndGetUser(username);

      this.userService.isUserVerifiedProvider(user, config.provider);
      const response = await this.verificationService.confirmVerificationProcess(
        user._id,
        code,
        config.strategy,
        config.provider,
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

  private async validateAndGetUser(username: string) {
    const config = await this.userConfigService.getResetPasswordConfig();
    if (!config) {
      throw new BadRequestException("Reset password provider is not configured.");
    }

    const user = await this.userService.findOne({username});
    if (!user) {
      throw new NotFoundException("User not found");
    }

    return {user, config};
  }
}
