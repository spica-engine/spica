import {Identity} from "./interface";

import {
  initialize as _initialize,
  checkInitialized,
  ApikeyInitialization,
  IdentityInitialization,
  buildUrl,
  http,
  IndexResult
} from "../../common/index";

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

  return policy.attach(insertedIdentity._id, identity.policies);
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
  export function attach(identityId: string, policyIds: string[] = []): Promise<Identity> {
    checkInitialized(authorization);

    const promises: Promise<Identity>[] = [];

    for (const policyId of policyIds) {
      const promise = http
        .put<Identity>(`${url}/${identityId}/policy/${policyId}`, {headers: defaultHeaders})
        .catch(e => {
          console.log(`Failed to attach policy with id ${policyId}: `, e);
          return e;
        });
      promises.push(promise);
    }

    // return the identity which has the most policy length 
    return Promise.all(promises).then(identities => identities[identities.length - 1]);
  }
}
