import {UserCreate, UserGet, TokenScheme} from "./interface";
import {initialize as _initialize, checkInitialized, Axios} from "@spica-devkit/internal_common";
import {
  ApikeyInitialization,
  HttpService,
  UserInitialization
} from "@spica-server/interface/function/packages";
import {deepCopyJSON} from "@spica-server/core/copy";

let authorization;

let service: HttpService;

const userSegment = "passport/user";

/**
 * Initialize the auth module with API key or user credentials.
 * Required for sign-up operations.
 *
 * @param options - Initialization options (ApikeyInitialization or UserInitialization)
 */
export function initialize(options: ApikeyInitialization | UserInitialization) {
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
 * Verify a token without requiring initialization.
 * Can be called independently as it doesn't need authorization.
 *
 * @param token - The authentication token to verify
 * @param baseUrl - Optional base URL of the server
 * @param headers - Optional headers to include in the request
 * @returns Promise resolving to verified token information
 */
export function verifyToken(token: string, baseUrl?: string, headers: object = {}) {
  const _baseUrl = baseUrl ? baseUrl : service ? service.baseUrl : undefined;

  if (!_baseUrl) {
    throw new Error("You should pass the base url of the server or call the initialize method.");
  }

  const req = new Axios({baseURL: _baseUrl});

  return req.get(`${userSegment}/verify`, {headers: {Authorization: token, ...headers}});
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
  checkInitialized(authorization);

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
  checkInitialized(authorization);

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
    checkInitialized(authorization);

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
    checkInitialized(authorization);

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
