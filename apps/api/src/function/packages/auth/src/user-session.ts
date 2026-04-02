import {
  UserGet,
  VerificationStrategy,
  Provider,
  VerificationStartResponse,
  VerificationCompleteResponse,
  PasswordResetStartResponse,
  PasswordResetCompleteResponse,
  TokenScheme
} from "./interface";
import {HttpService} from "@spica-server/interface/function/packages";
import {deepCopyJSON} from "@spica-server/core/copy";
import {UserSelfUpdate} from "@spica-server/interface/passport/user";

const userSegment = "passport/user";

/**
 * Represents an authenticated user session created after signIn or completePasswordlessLogin.
 * Provides self-referencing methods that operate on the current user without requiring
 * explicit ID or username parameters — designed for client-side usage.
 */
export class UserSession {
  private _token: string;
  private readonly _userId: string;
  private readonly _username: string;
  private readonly _service: HttpService;

  constructor(params: {token: string; userId: string; username: string; service: HttpService}) {
    this._token = params.token;
    this._userId = params.userId;
    this._username = params.username;
    this._service = params.service;
  }

  get token(): string {
    return this._token;
  }

  get userId(): string {
    return this._userId;
  }

  get username(): string {
    return this._username;
  }

  private getAuthHeaders(headers?: object): object {
    return {
      Authorization: `USER ${this._token}`,
      ...headers
    };
  }

  /**
   * Get the current user's profile.
   */
  get(headers?: object): Promise<UserGet> {
    return this._service.get<UserGet>(`${userSegment}/${this._userId}`, {
      headers: this.getAuthHeaders(headers)
    });
  }

  /**
   * Update the current user's password.
   */
  async updatePassword(password: string, headers?: object): Promise<UserGet> {
    const user: UserSelfUpdate = deepCopyJSON({password});

    return this._service.put<UserGet>(`${userSegment}/${this._userId}/self`, user, {
      headers: this.getAuthHeaders(headers)
    });
  }

  /**
   * Refresh the current session's access token.
   * Updates the internal token so subsequent calls use the new token automatically.
   */
  async refreshAccessToken(headers?: object): Promise<string> {
    const response = await this._service.post<TokenScheme>(
      `${userSegment}/session/refresh`,
      {},
      {
        headers: this.getAuthHeaders(headers),
        withCredentials: true
      }
    );

    this._token = response.token;
    return response.token;
  }

  /**
   * Start email verification for the current user.
   */
  addEmail(
    value: string,
    strategy: VerificationStrategy,
    headers?: object
  ): Promise<VerificationStartResponse> {
    return this._service.post<VerificationStartResponse>(
      `${userSegment}/${this._userId}/start-provider-verification`,
      {value, provider: "email", strategy, purpose: "verification"},
      {headers: this.getAuthHeaders(headers)}
    );
  }

  /**
   * Complete email verification for the current user.
   */
  verifyEmail(
    code: string,
    strategy: VerificationStrategy,
    headers?: object
  ): Promise<VerificationCompleteResponse> {
    return this._service.post<VerificationCompleteResponse>(
      `${userSegment}/${this._userId}/verify-provider`,
      {code, provider: "email", strategy, purpose: "verification"},
      {headers: this.getAuthHeaders(headers)}
    );
  }

  /**
   * Start phone number verification for the current user.
   */
  addPhoneNumber(
    value: string,
    strategy: VerificationStrategy,
    headers?: object
  ): Promise<VerificationStartResponse> {
    return this._service.post<VerificationStartResponse>(
      `${userSegment}/${this._userId}/start-provider-verification`,
      {value, provider: "phone", strategy, purpose: "verification"},
      {headers: this.getAuthHeaders(headers)}
    );
  }

  /**
   * Complete phone number verification for the current user.
   */
  verifyPhoneNumber(
    code: string,
    strategy: VerificationStrategy,
    headers?: object
  ): Promise<VerificationCompleteResponse> {
    return this._service.post<VerificationCompleteResponse>(
      `${userSegment}/${this._userId}/verify-provider`,
      {code, provider: "phone", strategy, purpose: "verification"},
      {headers: this.getAuthHeaders(headers)}
    );
  }

  /**
   * Complete a password reset for the current user with a verification code and new password.
   */
  completePasswordReset(
    code: string,
    newPassword: string,
    provider: Provider,
    headers?: object
  ): Promise<PasswordResetCompleteResponse> {
    return this._service.post<PasswordResetCompleteResponse>(
      `${userSegment}/forgot-password/verify`,
      {username: this._username, code, newPassword, provider},
      {headers: this.getAuthHeaders(headers)}
    );
  }
}
