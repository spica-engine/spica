export interface VerificationMessage {
  destination: string;
  code: string;
  provider: string;
  metadata?: Record<string, any>;
}

export interface VerificationResult {
  success: boolean;
  message?: string;
  metadata?: Record<string, any>;
}

export interface VerificationProvider {
  readonly name: string;

  /**
   * Send a verification code through this provider's channel
   * @param message - Verification message details
   * @returns Promise resolving to the result of the send operation
   */
  send(message: VerificationMessage): Promise<VerificationResult>;

  /**
   * Validate that the destination is in the correct format for this provider
   * @param destination - The destination to validate
   * @returns True if valid, false otherwise
   */
  validateDestination(destination: string): boolean;
}
