import {Bucket} from "./interface";
import fetch from "node-fetch";

let _apikey = "";
let url = "";

export function initialize(apikey: string) {
  _apikey = `APIKEY ${apikey}`;

  let publicUrl = process.env.__INTERNAL__SPICA__PUBLIC_URL__;
  if (!publicUrl) {
    throw new Error("The <__INTERNAL__SPICA__PUBLIC_URL__> variable was not given. ");
  }

  url = `${publicUrl}/bucket`;
}

function checkInitialized() {
  if (!_apikey) {
    throw new Error("You should call initialize method with apikey before this action.");
  }
}

export namespace bucket {
  export function insert(bucket: Bucket) {
    checkInitialized();

    let request = {
      method: "post",
      body: JSON.stringify(bucket),
      headers: {
        Authorization: _apikey,
        "Content-Type": "application/json"
      }
    };
    return fetch(url, request).then(res => res.json());
  }
}
