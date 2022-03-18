import {
  IdentityCreate,
  IdentityGet,
  IdentityInitialization,
  ApikeyInitialization,
  IndexResult,
  LoginWithStrategyResponse,
  IdentityUpdate
} from "./interface";
import {
  initialize as _initialize,
  checkInitialized,
  HttpService,
  Axios
} from "@spica-devkit/internal_common";
import {Strategy} from "./interface";
import {Observable} from "rxjs";

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

export async function loginWithStrategy(id: string): Promise<LoginWithStrategyResponse> {
  checkInitialized(authorization);

  const {url, state} = await service.get<{url: string; state: string}>(
    `/passport/strategy/${id}/url`
  );

  const token: Observable<string> = new Observable(observer => {
    service
      .post<{token: string}>("/passport/identify", {
        state
      })
      .then(({token}) => {
        observer.next(token);
        observer.complete();
      })
      .catch(e => observer.error(e));
  });

  return {
    url,
    token
  };
}

export function getStrategies() {
  return service.get<Strategy[]>("/passport/strategies");
}

export function get(id: string): Promise<IdentityGet> {
  checkInitialized(authorization);

  return service.get<IdentityGet>(`${identitySegment}/${id}`);
}

export function getAll(queryParams?: {
  paginate?: false;
  limit?: number;
  skip?: number;
  filter?: object;
  sort?: object;
}): Promise<IdentityGet[]>;
export function getAll(queryParams?: {
  paginate?: true;
  limit?: number;
  skip?: number;
  filter?: object;
  sort?: object;
}): Promise<IndexResult<IdentityGet>>;
export function getAll(
  queryParams: {
    paginate?: boolean;
    limit?: number;
    skip?: number;
    filter?: object;
    sort?: object;
  } = {}
): Promise<IdentityGet[] | IndexResult<IdentityGet>> {
  checkInitialized(authorization);

  return service.get<IdentityGet[] | IndexResult<IdentityGet>>(identitySegment, {
    params: queryParams
  });
}

export async function insert(identity: IdentityCreate): Promise<IdentityGet> {
  checkInitialized(authorization);

  const insertedIdentity = await service.post<IdentityGet>(identitySegment, identity);

  return policy.attach(insertedIdentity._id, identity.policies).then(policies => {
    insertedIdentity.policies = policies;
    return insertedIdentity;
  });
}

export async function update(id: string, identity: IdentityUpdate): Promise<IdentityGet> {
  checkInitialized(authorization);

  const existingIdentity = await service.get<IdentityGet>(`${identitySegment}/${id}`);

  await policy.detach(id, existingIdentity.policies || []);

  const updatedIdentity = await service.put<IdentityGet>(`${identitySegment}/${id}`, identity);

  return policy.attach(id, identity.policies || []).then(policies => {
    updatedIdentity.policies = policies;
    return updatedIdentity;
  });
}

export function remove(id: string): Promise<any> {
  checkInitialized(authorization);

  return service.delete(`${identitySegment}/${id}`);
}

// policy attach detach
export namespace policy {
  export function attach(identityId: string, policyIds: string[] = []): Promise<string[]> {
    checkInitialized(authorization);

    const promises: Promise<IdentityGet>[] = [];
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

    const promises: Promise<IdentityGet>[] = [];
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
