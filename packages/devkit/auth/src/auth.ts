import {
  UserCreate,
  UserGet,
  TokenScheme,
  VerifiedToken,
  VerificationStrategy,
  Provider,
  VerificationStartResponse,
  VerificationCompleteResponse,
  PasswordResetStartResponse,
  PasswordResetCompleteResponse,
  PasswordlessLoginStartResponse,
  PasswordlessLoginCompleteResponse
} from "./interface";
import {UserSession} from "./user-session";
import {initialize as _initialize, checkInitialized} from "@spica-devkit/internal_common";
import {
  ApikeyInitialization,
  HttpService,
  IdentityInitialization,
  PublicInitialization,
  UserInitialization
} from "@spica-server/interface-function-packages";
import {deepCopyJSON} from "@spica-server/core-copy";
import {UserSelfUpdate} from "@spica-server/interface-passport-user";
let authorization;

let service: HttpService;

const userSegment = "passport/user";

/**
 * Initialize the auth module with API key or identity credentials.
 * Required for sign-up operations.
 *
 * @param options - Initialization options (ApikeyInitialization or IdentityInitialization)
 */
export function initialize(
  options: ApikeyInitialization | IdentityInitialization | UserInitialization | PublicInitialization
) {
  const {authorization: _authorization, service: _service} = _initialize(options);

  authorization = _authorization;

  service = _service;

  service.setWriteDefaults({
    headers: {
      "Content-Type": "application/json"
    }
  });
}

/**
 * Verify an authentication token.
 * Requires prior initialization call, but does not require authorization.
 *
 * @param token - The authentication token to verify
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to verified token information
 */
export function verifyToken(token: string, headers: object = {}) {
  checkInitialized(authorization, service, {skipAuthCheck: true});
  return service.get(`${userSegment}/verify`, {headers: {Authorization: token, ...headers}});
}

/**
 * Sign in with username and password.
 * Returns a UserSession instance that provides self-referencing methods for
 * the authenticated user. Access the raw token via `session.token`.
 *
 * @param username - User's username
 * @param password - User's password
 * @param tokenLifeSpan - Optional token lifetime in seconds
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to a UserSession with the authenticated user's context
 */
export async function signIn(
  username: string,
  password: string,
  tokenLifeSpan?: number,
  headers?: object
): Promise<UserSession> {
  checkInitialized(authorization, service, {skipAuthCheck: true});
  const response = await service.post<TokenScheme>(
    "/passport/login",
    {
      username,
      password,
      expires: tokenLifeSpan
    },
    {headers}
  );

  const verified = await service.get<VerifiedToken>(`${userSegment}/verify`, {
    headers: {Authorization: response.token, ...(headers || {})}
  });

  return new UserSession({
    token: response.token,
    userId: verified._id,
    username: verified.username,
    service
  });
}

/**
 * Sign up a new user.
 * Requires prior initialization call with API key.
 *
 * @param user - User data to create (username, password)
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to created user information (without password)
 */
export async function signUp(user: UserCreate, headers?: object): Promise<UserGet> {
  checkInitialized(authorization, service);

  user = deepCopyJSON(user);

  const createdUser = await service.post<UserGet>(`${userSegment}`, user, {headers});

  return createdUser;
}

/**
 * Get user by ID.
 * @param id - User ID to retrieve
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to user information (without password)
 */
export function get(id: string, headers?: object): Promise<UserGet> {
  checkInitialized(authorization, service);

  return service.get<UserGet>(`${userSegment}/${id}`, {headers});
}

/**
 * Update user password.
 * Note: This function only allows password updates. Users can only update their own password.
 *
 * @param id - User ID to update
 * @param user - Update data containing only the new password
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to updated user information (without password)
 */
export async function updatePassword(
  id: string,
  user: UserSelfUpdate,
  headers?: object
): Promise<UserGet> {
  checkInitialized(authorization, service);

  user = deepCopyJSON(user);

  const updatedUser = await service.put<UserGet>(`${userSegment}/${id}/self`, user, {
    headers
  });

  return updatedUser;
}

/**
 * Refresh an access token using a refresh token.
 * This function is designed for browser usage, wont be working in Node.js environment due to cookie handling.
 *
 * @param accessToken - The current (possibly expired) access token
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to the new access token
 */
export async function refreshAccessToken(accessToken: string, headers?: object): Promise<string> {
  checkInitialized(authorization, service);

  const response = await service.post<TokenScheme>(
    `${userSegment}/session/refresh`,
    {},
    {
      headers: {
        Authorization: accessToken,
        ...headers
      },
      withCredentials: true
    }
  );

  return response.token;
}
/**
 * Update a user's username.
 * Requires prior initialization call with appropriate authorization.
 *
 * @param id - User ID to update
 * @param username - New username for the user
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to updated user information (without password)
 */
export async function updateUsername(
  id: string,
  username: string,
  headers?: object
): Promise<UserGet> {
  checkInitialized(authorization, service);

  const updatedUser = await service.put<UserGet>(
    `${userSegment}/${id}`,
    {username},
    {
      headers
    }
  );

  return updatedUser;
}

/**
 * Ban a user until a specific date.
 * User will not be able to log in until the ban expires.
 * Requires prior initialization call with appropriate authorization.
 *
 * @param id - User ID to ban
 * @param bannedUntil - Date when the ban expires (user can log in after this date)
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to updated user information (without password)
 */
export async function ban(id: string, bannedUntil: Date, headers?: object): Promise<UserGet> {
  checkInitialized(authorization, service);

  const updatedUser = await service.put<UserGet>(
    `${userSegment}/${id}`,
    {bannedUntil: bannedUntil.toISOString()},
    {
      headers
    }
  );

  return updatedUser;
}

/**
 * Deactivate all JWT tokens issued before a specific date.
 * This forces users to re-authenticate after a security incident or password change.
 * Requires prior initialization call with appropriate authorization.
 *
 * @param id - User ID whose tokens should be deactivated
 * @param deactivateJwtsBefore - Date before which all JWTs are considered invalid
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to updated user information (without password)
 */
export async function deactivateUserTokens(
  id: string,
  deactivateJwtsBefore: Date,
  headers?: object
): Promise<UserGet> {
  checkInitialized(authorization, service);

  const updatedUser = await service.put<UserGet>(
    `${userSegment}/${id}`,
    {deactivateJwtsBefore: Math.floor(deactivateJwtsBefore.getTime() / 1000)},
    {
      headers
    }
  );

  return updatedUser;
}

/**
 * Start email verification for a user.
 * Sends a verification code or magic link to the specified email address.
 *
 * @param id - User ID to add email for
 * @param value - Email address to verify
 * @param strategy - Verification strategy ("Otp" or "MagicLink")
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to verification start response
 */
export function addEmail(
  id: string,
  value: string,
  strategy: VerificationStrategy,
  headers?: object
): Promise<VerificationStartResponse> {
  checkInitialized(authorization, service);

  return service.post<VerificationStartResponse>(
    `${userSegment}/${id}/start-provider-verification`,
    {value, provider: "email", strategy, purpose: "verification"},
    {headers}
  );
}

/**
 * Complete email verification for a user.
 * Validates the verification code or magic link token.
 *
 * @param id - User ID to verify email for
 * @param code - Verification code or magic link token
 * @param strategy - Verification strategy ("Otp" or "MagicLink")
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to verification complete response
 */
export function verifyEmail(
  id: string,
  code: string,
  strategy: VerificationStrategy,
  headers?: object
): Promise<VerificationCompleteResponse> {
  checkInitialized(authorization, service);

  return service.post<VerificationCompleteResponse>(
    `${userSegment}/${id}/verify-provider`,
    {code, provider: "email", strategy, purpose: "verification"},
    {headers}
  );
}

/**
 * Start phone number verification for a user.
 * Sends a verification code to the specified phone number.
 *
 * @param id - User ID to add phone number for
 * @param value - Phone number to verify
 * @param strategy - Verification strategy ("Otp" or "MagicLink")
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to verification start response
 */
export function addPhoneNumber(
  id: string,
  value: string,
  strategy: VerificationStrategy,
  headers?: object
): Promise<VerificationStartResponse> {
  checkInitialized(authorization, service);

  return service.post<VerificationStartResponse>(
    `${userSegment}/${id}/start-provider-verification`,
    {value, provider: "phone", strategy, purpose: "verification"},
    {headers}
  );
}

/**
 * Complete phone number verification for a user.
 * Validates the verification code.
 *
 * @param id - User ID to verify phone number for
 * @param code - Verification code
 * @param strategy - Verification strategy ("Otp" or "MagicLink")
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to verification complete response
 */
export function verifyPhoneNumber(
  id: string,
  code: string,
  strategy: VerificationStrategy,
  headers?: object
): Promise<VerificationCompleteResponse> {
  checkInitialized(authorization, service);

  return service.post<VerificationCompleteResponse>(
    `${userSegment}/${id}/verify-provider`,
    {code, provider: "phone", strategy, purpose: "verification"},
    {headers}
  );
}

/**
 * Request a password reset.
 * Sends a verification code to the user's verified email or phone.
 *
 * @param username - Username of the account to reset
 * @param provider - Provider to send the code via ("email" or "phone")
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to password reset start response
 */
export function requestPasswordReset(
  username: string,
  provider: Provider,
  headers?: object
): Promise<PasswordResetStartResponse> {
  checkInitialized(authorization, service, {skipAuthCheck: true});

  return service.post<PasswordResetStartResponse>(
    `${userSegment}/forgot-password/start`,
    {username, provider},
    {headers}
  );
}

/**
 * Complete a password reset with verification code and new password.
 *
 * @param username - Username of the account to reset
 * @param code - Verification code received via email or phone
 * @param newPassword - New password to set
 * @param provider - Provider used for verification ("email" or "phone")
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to password reset complete response
 */
export function completePasswordReset(
  username: string,
  code: string,
  newPassword: string,
  provider: Provider,
  headers?: object
): Promise<PasswordResetCompleteResponse> {
  checkInitialized(authorization, service, {skipAuthCheck: true});

  return service.post<PasswordResetCompleteResponse>(
    `${userSegment}/forgot-password/verify`,
    {username, code, newPassword, provider},
    {headers}
  );
}

/**
 * Start a passwordless login flow.
 * Sends a verification code to the user's verified email or phone.
 *
 * @param username - Username of the account to log in
 * @param provider - Provider to send the code via ("email" or "phone")
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to passwordless login start response
 */
export function passwordlessLogin(
  username: string,
  provider: Provider,
  headers?: object
): Promise<PasswordlessLoginStartResponse> {
  checkInitialized(authorization, service, {skipAuthCheck: true});

  return service.post<PasswordlessLoginStartResponse>(
    `${userSegment}/passwordless-login/start`,
    {username, provider},
    {headers}
  );
}

/**
 * Complete a passwordless login with verification code.
 * Returns a UserSession instance that provides self-referencing methods for
 * the authenticated user. Access the raw token via `session.token`.
 *
 * @param username - Username of the account to log in
 * @param code - Verification code received via email or phone
 * @param provider - Provider used for verification ("email" or "phone")
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to a UserSession with the authenticated user's context
 */
export async function completePasswordlessLogin(
  username: string,
  code: string,
  provider: Provider,
  headers?: object
): Promise<UserSession> {
  checkInitialized(authorization, service, {skipAuthCheck: true});

  const response = await service.post<PasswordlessLoginCompleteResponse>(
    `${userSegment}/passwordless-login/verify`,
    {username, code, provider},
    {headers}
  );

  const verified = await service.get<VerifiedToken>(`${userSegment}/verify`, {
    headers: {
      ...(headers || {}),
      Authorization: response.token
    }
  });

  return new UserSession({
    token: response.token,
    userId: verified._id,
    username: verified.username,
    service
  });
}
