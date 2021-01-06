import {initialize as _initialize, http} from "../../internal_common/index";
import {StorageObject} from "./interface";
import {toBase64} from "./utility";

let authorization;

let url;

let defaultHeaders;

let writeHeaders;

export function initialize(options: any) {
  const {authorization: _authorization, publicUrl} = _initialize(options);

  authorization = _authorization;
  url = publicUrl + "/storage";

  defaultHeaders = {
    Authorization: authorization
  };
  writeHeaders = {...defaultHeaders, "Content-Type": "application/json"};
}

export async function insert(file: File | string, metaInfo?: {name: string; mimeType: string}) {
  let data;
  let name;
  let size;
  let type;

  if (typeof file == "string") {
    data = file;
    name = metaInfo.name;
    size = file.length;
    type = metaInfo.mimeType;
  } else {
    data = await toBase64(file);
    name = file.name;
    size = file.size;
    type = file.type;
  }

  const body: StorageObject[] = [
    {
      name: name,
      content: {
        type: type,
        data: data,
        size: size
      }
    }
  ];
  return http.post<StorageObject>(url, {body: JSON.stringify(body), headers: writeHeaders});
}

// /Users/tuna/Desktop/Teknodev/parvin
// /Users/tuna/Desktop/functions
