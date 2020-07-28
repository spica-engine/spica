import {Dashboard} from "./interface";
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

  url = `${_publicUrl}/dashboard`;
}

function checkInitialized() {
  if (!apikey) {
    throw new Error("You should call initialize method with apikey before this action.");
  }
}

export function create(dashboard: Dashboard): Promise<any> {
  checkInitialized();

  let request = {
    method: "put",
    body: JSON.stringify(dashboard),
    headers: {
      Authorization: apikey,
      "Content-Type": "application/json"
    }
  };

  return fetch(url, request).then(res => res.json());
}

export function update(dashboard: Dashboard): Promise<any> {
  checkInitialized();

  let request = {
    method: "put",
    body: JSON.stringify(dashboard),
    headers: {
      Authorization: apikey,
      "Content-Type": "application/json"
    }
  };

  return fetch(url, request).then(res => res.json());
}

export function get(key: string): Promise<any> {
  checkInitialized();

  let request = {
    method: "get",
    headers: {
      Authorization: apikey
    }
  };

  return fetch(`${url}/${key}`, request).then(res => res.json());
}

export function getAll(): Promise<any> {
  checkInitialized();

  let request = {
    method: "get",
    headers: {
      Authorization: apikey
    }
  };

  return fetch(url, request).then(res => res.json());
}

export function remove(key: string): Promise<any> {
  checkInitialized();

  let request = {
    method: "delete",
    headers: {
      Authorization: apikey
    }
  };

  return fetch(`${url}/${key}`, request);
}
