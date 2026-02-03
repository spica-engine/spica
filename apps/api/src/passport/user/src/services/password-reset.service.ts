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
    provider: string,
    strategy: string
  ): Promise<{message: string}> {
    const user = await this.userService.findOne({username});
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const providerField = user[provider];
    if (!providerField) {
      throw new BadRequestException(`User does not have a verified ${provider}.`);
    }

    if (!("encrypted" in providerField)) {
      throw new BadRequestException(`User ${provider} is not properly configured.`);
    }

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
    strategy: string,
    newPassword: string
  ) {
    try {
      const provider = await this.userConfigService.getResetPasswordConfig();
      if (!provider) {
        throw new BadRequestException("Reset password provider is not configured.");
      }
      const user = await this.userService.findOne({username});
      if (!user) {
        throw new NotFoundException("User not found");
      }

      const providerField = user[provider];
      if (!providerField || !("encrypted" in providerField)) {
        throw new BadRequestException(`User does not have a verified ${provider}.`);
      }

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
}
