import {Identity} from "./interface";
import fetch from "node-fetch";

import {
  initialize as _initialize,
  checkInitialized,
  ApikeyInitialization,
  IdentityInitialization
} from "@spica-devkit/internal_common";

let authorization;
let url;
let loginUrl;

export function initialize(options: ApikeyInitialization | IdentityInitialization) {
  const {authorization:_authorization, publicUrl} = _initialize(options);
  authorization = _authorization;
  url = publicUrl + "/passport/identity";
  loginUrl = publicUrl + "/passport/identify";
}

export function get(id: string): Promise<Identity> {
  checkInitialized(authorization);

  const request = {
    method: "get",
    headers: {
      Authorization: authorization
    }
  };

  return fetch(url + "/" + id, request).then(res => res.json());
}

export function login() {}

export function getAll(queryParams: object = {}): Promise<Identity> {
  checkInitialized(authorization);

  const fullUrl = new URL(url);

  for (const [key, value] of Object.entries(queryParams)) {
    fullUrl.searchParams.append(key, encodeURIComponent(value));
  }

  const request = {
    method: "get",
    headers: {
      Authorization: authorization
    }
  };

  return fetch(fullUrl, request).then(res => res.json());
}

export function insert(identity: Identity): Promise<Identity> {
  checkInitialized(authorization);

  const request = {
    method: "post",
    body: JSON.stringify(identity),
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json"
    }
  };

  return fetch(url, request).then(res => res.json());
}

export function update(id: string, identity: Identity): Promise<Identity> {
  checkInitialized(authorization);

  const request = {
    method: "put",
    body: JSON.stringify(identity),
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json"
    }
  };
  return fetch(url + "/" + id, request).then(res => res.json());
}

export function remove(id: string): Promise<any> {
  checkInitialized(authorization);

  const request = {
    method: "delete",
    headers: {
      Authorization: authorization
    }
  };
  return fetch(url + "/" + id, request);
}
