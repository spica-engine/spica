import {Identity, IdentityInitialization, ApikeyInitialization, IndexResult} from "./interface";
import {
  initialize as _initialize,
  checkInitialized,
  HttpService,
  Axios
} from "@spica-devkit/internal_common";

let authorization;

let service: HttpService;

const identitySegment = "passport/identity";

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

export function verifyToken(token: string, baseUrl?: string) {
  const _baseUrl = baseUrl ? baseUrl : service ? service.baseUrl : undefined;

  if (!_baseUrl) {
    throw new Error("You should pass the base url of the server or call the initialize method.");
  }

  const req = new Axios({baseURL: _baseUrl});

  return req.get(`${identitySegment}/verify`, {headers: {Authorization: token}});
}

export function login(
  identifier: string,
  password: string,
  tokenLifeSpan?: number
): Promise<string> {
  checkInitialized(authorization);

  return service
    .post<{token: string}>("/passport/identify", {
      identifier,
      password,
      expires: tokenLifeSpan
    })
    .then(response => response.token);
}

export function get(id: string): Promise<Identity> {
  checkInitialized(authorization);

  return service.get<Identity>(`${identitySegment}/${id}`);
}

export function getAll(queryParams: object = {}): Promise<Identity[] | IndexResult<Identity>> {
  checkInitialized(authorization);

  return service.get<Identity[] | IndexResult<Identity>>(identitySegment, {
    params: queryParams
  });
}

export async function insert(identity: Identity): Promise<Identity> {
  checkInitialized(authorization);

  const insertedIdentity = await service.post<Identity>(identitySegment, identity);

  return policy.attach(insertedIdentity._id, identity.policies).then(policies => {
    insertedIdentity.policies = policies;
    return insertedIdentity;
  });
}

export function update(id: string, identity: Identity): Promise<Identity> {
  checkInitialized(authorization);

  return service.put<Identity>(`${identitySegment}/${id}`, identity);
}

export function remove(id: string): Promise<any> {
  checkInitialized(authorization);

  return service.delete(`${identitySegment}/${id}`);
}

// policy attach detach
export namespace policy {
  export function attach(identityId: string, policyIds: string[] = []): Promise<string[]> {
    checkInitialized(authorization);

    const promises: Promise<Identity>[] = [];
    const attachedPolicies = new Set<string>();

    for (const policyId of policyIds) {
      const promise = service
        .put<any>(`${identitySegment}/${identityId}/policy/${policyId}`, {})
        .then(() => attachedPolicies.add(policyId))
        .catch(e => {
          console.error(`Failed to attach policy with id ${policyId}: `, e);
          return e;
        });
      promises.push(promise);
    }

    return Promise.all(promises).then(() => Array.from(attachedPolicies));
  }

  export function detach(identityId: string, policyIds: string[] = []): Promise<string[]> {
    checkInitialized(authorization);

    const promises: Promise<Identity>[] = [];
    const detachedPolicies = new Set<string>();

    for (const policyId of policyIds) {
      const promise = service
        .delete(`${identitySegment}/${identityId}/policy/${policyId}`)
        .then(() => detachedPolicies.add(policyId))
        .catch(e => {
          console.error(`Failed to detach policy with id ${policyId}: `, e);
          return e;
        });
      promises.push(promise);
    }

    return Promise.all(promises).then(() => Array.from(detachedPolicies));
  }
}
