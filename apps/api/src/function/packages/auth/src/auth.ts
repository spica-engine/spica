import {UserCreate, UserGet, TokenScheme, UserUpdate} from "./interface";
import {initialize as _initialize, checkInitialized, Axios} from "@spica-devkit/internal_common";
import {
  ApikeyInitialization,
  HttpService,
  IdentityInitialization,
  PublicInitialization,
  UserInitialization
} from "@spica-server/interface/function/packages";
import {deepCopyJSON} from "@spica-server/core/copy";

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
 * Requires prior initialization call.
 *
 * @param username - User's username
 * @param password - User's password
 * @param tokenLifeSpan - Optional token lifetime in seconds
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to authentication token
 */
export async function signIn(
  username: string,
  password: string,
  tokenLifeSpan?: number,
  headers?: object
): Promise<string> {
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

  return response.token;
}

/**
 * Sign up a new user.
 * Requires prior initialization call with API key.
 *
 * @param user - User data to create (username, password, optional attributes)
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to created user information (without password)
 */
export async function signUp(user: UserCreate, headers?: object): Promise<UserGet> {
  checkInitialized(authorization, service);

  user = deepCopyJSON(user);
  delete user.policies;

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
  checkInitialized(authorization, service, {skipAuthCheck: true});

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
export async function update(id: string, user: UserUpdate, headers?: object): Promise<UserGet> {
  checkInitialized(authorization, service, {skipAuthCheck: true});

  user = deepCopyJSON(user);

  const updatedUser = await service.put<UserGet>(`${userSegment}/${id}`, user, {
    headers
  });

  return updatedUser;
}

/**
 * Remove a user by ID.
 * Requires prior initialization call with API key.
 *
 * @param id - User ID to remove
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving when user is removed
 */
export function remove(id: string, headers?: object): Promise<any> {
  checkInitialized(authorization, service);

  return service.delete(`${userSegment}/${id}`, {headers});
}
