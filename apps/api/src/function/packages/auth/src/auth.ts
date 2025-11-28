import {UserCreate, UserGet, TokenScheme} from "./interface";
import {initialize as _initialize, checkInitialized, Axios} from "@spica-devkit/internal_common";
import {
  ApikeyInitialization,
  HttpService,
  IdentityInitialization
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
export function initialize(options: ApikeyInitialization | IdentityInitialization) {
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
  const desiredPolicies = user.policies;
  delete user.policies;

  const createdUser = await service.post<UserGet>(`${userSegment}`, user, {headers});

  return policy.attach(createdUser._id, desiredPolicies).then(policies => {
    createdUser.policies = policies;
    return createdUser;
  });
}

// policy attach detach
export namespace policy {
  export function attach(
    userId: string,
    policyIds: string[] = [],
    headers?: object
  ): Promise<string[]> {
    checkInitialized(authorization, service);

    const promises: Promise<UserGet>[] = [];
    const attachedPolicies = new Set<string>();

    for (const policyId of policyIds) {
      const promise = service
        .put<any>(`${userSegment}/${userId}/policy/${policyId}`, {}, {headers})
        .then(() => attachedPolicies.add(policyId))
        .catch(e => {
          console.error(`Failed to attach policy with id ${policyId}: `, e);
          return e;
        });
      promises.push(promise);
    }

    return Promise.all(promises).then(() => Array.from(attachedPolicies));
  }

  export function detach(
    userId: string,
    policyIds: string[] = [],
    headers?: object
  ): Promise<string[]> {
    checkInitialized(authorization, service);

    const promises: Promise<UserGet>[] = [];
    const detachedPolicies = new Set<string>();

    for (const policyId of policyIds) {
      const promise = service
        .delete(`${userSegment}/${userId}/policy/${policyId}`, {headers})
        .then(() => detachedPolicies.add(policyId))
        .catch(e => {
          console.error(`Failed to detach policy with id ${policyId}: `, e);
          return e;
        });
      promises.push(promise);
    }

    return Promise.all(promises).then(() => Array.from(detachedPolicies));
  }
}
