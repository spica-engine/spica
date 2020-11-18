import {Identity} from "./interface";
import fetch from "node-fetch";

let apikey;
let url;

export function initialize(options: {apikey: string; publicUrl?: string}) {
  apikey = `APIKEY ${options.apikey}`;

  let _publicUrl = options.publicUrl || process.env.__INTERNAL__SPICA__PUBLIC_URL__;
  if (!_publicUrl) {
    throw new Error(
      "The <__INTERNAL__SPICA__PUBLIC_URL__> variable and public url was not given. "
    );
  }

  url = `${_publicUrl}/passport/identity`;
}

function checkInitialized() {
  if (!apikey) {
    throw new Error("You should call initialize method with apikey before this action.");
  }
}

export function get(id: string): Promise<Identity> {
  checkInitialized();

  let request = {
    method: "get",
    headers: {
      Authorization: apikey
    }
  };

  return fetch(url + "/" + id, request).then(res => res.json());
}

export function getAll(queryParams: object = {}): Promise<Identity> {
  checkInitialized();

  let fullUrl = new URL(url);

  for (const [key, value] of Object.entries(queryParams)) {
    fullUrl.searchParams.append(key, JSON.stringify(value));
  }

  let request = {
    method: "get",
    headers: {
      Authorization: apikey
    }
  };

  return fetch(fullUrl, request).then(res => res.json());
}

export function insert(identity: Identity): Promise<Identity> {
  checkInitialized();

  let request = {
    method: "post",
    body: JSON.stringify(identity),
    headers: {
      Authorization: apikey,
      "Content-Type": "application/json"
    }
  };

  return fetch(url, request).then(res => res.json());
}

export function update(id: string, identity: Identity): Promise<Identity> {
  checkInitialized();

  let request = {
    method: "put",
    body: JSON.stringify(identity),
    headers: {
      Authorization: apikey,
      "Content-Type": "application/json"
    }
  };
  return fetch(url + "/" + id, request).then(res => res.json());
}

export function remove(id: string): Promise<any> {
  checkInitialized();

  let request = {
    method: "delete",
    headers: {
      Authorization: apikey
    }
  };
  return fetch(url + "/" + id, request);
}
