import {Dashboard} from "./interface";
import fetch from "node-fetch";

let _apikey = "";
let url = "";

export function initialize(apikey: string) {
  _apikey = `APIKEY ${apikey}`;

  let publicUrl = process.env.__INTERNAL__SPICA__PUBLIC_URL__;
  if (!publicUrl) {
    throw new Error("The <__INTERNAL__SPICA__PUBLIC_URL__> variable was not given. ");
  }

  url = `${publicUrl}/dashboard`;
}

function isInitialized() {
  if (!_apikey) {
    throw new Error("You should call initialize method with apikey before this action.");
  }
}

export function create(dashboard: Dashboard): Promise<any> {
  isInitialized();

  let request = {
    method: "put",
    body: JSON.stringify(dashboard),
    headers: {
      Authorization: _apikey
    }
  };

  return fetch(url, request);
}

export function update(dashboard: Dashboard): Promise<any> {
  isInitialized();

  let request = {
    method: "put",
    body: JSON.stringify(dashboard),
    headers: {
      Authorization: _apikey
    }
  };

  return fetch(url, request);
}

export function get(key: string): Promise<any> {
  isInitialized();

  let request = {
    method: "get",
    headers: {
      Authorization: _apikey
    }
  };

  return fetch(`${url}/${key}`, request);
}

export function getAll(): Promise<any> {
  isInitialized();

  let request = {
    method: "get",
    headers: {
      Authorization: _apikey
    }
  };

  return fetch(url, request);
}

export function remove(key: string): Promise<any> {
  isInitialized();

  let request = {
    method: "delete",
    headers: {
      Authorization: _apikey
    }
  };

  return fetch(`${url}/${key}`, request);
}
