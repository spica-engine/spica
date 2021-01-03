import {Identity, IdentityInitialization, ApikeyInitialization, IndexResult} from "./interface";

import {
  initialize as _initialize,
  checkInitialized,
  buildUrl,
  http
} from "@spica-devkit/internal_common";

let authorization;

let url;

let loginUrl;

let defaultHeaders;

let writeHeaders;

export function initialize(options: ApikeyInitialization | IdentityInitialization) {
  const {authorization: _authorization, publicUrl} = _initialize(options);

  authorization = _authorization;
  url = publicUrl + "/passport/identity";
  loginUrl = publicUrl + "/passport/identify";

  defaultHeaders = {
    Authorization: authorization
  };

  writeHeaders = {...defaultHeaders, "Content-Type": "application/json"};
}

export function login(identifier: string, password: string): Promise<string> {
  checkInitialized(authorization);

  return http
    .post(loginUrl, {
      body: JSON.stringify({identifier, password}),
      headers: {
        "Content-Type": "application/json"
      }
    })
    .then(response => response.token);
}

export function get(id: string): Promise<Identity> {
  checkInitialized(authorization);

  return http.get<Identity>(`${url}/${id}`, {headers: defaultHeaders});
}

export function getAll(queryParams: object = {}): Promise<Identity[] | IndexResult<Identity>> {
  checkInitialized(authorization);

  const fullUrl = buildUrl(url, queryParams);

  return http.get<Identity[] | IndexResult<Identity>>(fullUrl, {headers: defaultHeaders});
}

export async function insert(identity: Identity): Promise<Identity> {
  checkInitialized(authorization);

  const insertedIdentity = await http.post<Identity>(url, {
    body: JSON.stringify(identity),
    headers: writeHeaders
  });

  return policy.attach(insertedIdentity._id, identity.policies).then(policies => {
    insertedIdentity.policies = policies;
    return insertedIdentity;
  });
}

export function update(id: string, identity: Identity): Promise<Identity> {
  checkInitialized(authorization);

  return http.put<Identity>(`${url}/${id}`, {
    body: JSON.stringify(identity),
    headers: writeHeaders
  });
}

export function remove(id: string): Promise<any> {
  checkInitialized(authorization);

  return http.del(`${url}/${id}`, {headers: defaultHeaders});
}

// policy attach detach
export namespace policy {
  export function attach(identityId: string, policyIds: string[] = []): Promise<string[]> {
    checkInitialized(authorization);

    const promises: Promise<Identity>[] = [];
    const attachedPolicies = new Set<string>();

    for (const policyId of policyIds) {
      const promise = http
        .put<any>(`${url}/${identityId}/policy/${policyId}`, {headers: defaultHeaders})
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
      const promise = http
        .del(`${url}/${identityId}/policy/${policyId}`, {headers: defaultHeaders})
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
