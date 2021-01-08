import {Base64WithMeta} from "./interface";

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const data = reader.result.toString().split(",")[1];
      if (!isValidBase64(data)) {
        return reject(INVALIDBASE64);
      }
      return resolve(data);
    };
    reader.onerror = error => reject(error);
  });
}

export async function prepareBody(object: File | Base64WithMeta) {
  let data: string;
  let name: string;
  let size: number;
  let type: string;

  if (instanceOfBase64WithMeta(object)) {
    if (!isValidBase64(object.data)) {
      throw new Error(INVALIDBASE64);
    }

    data = object.data;
    name = object.name;
    size = object.data.length;
    type = object.contentType;
  } else {
    data = await fileToBase64(object);
    name = object.name;
    size = object.size;
    type = object.type;
  }

  const body = {
    name,
    content: {
      type,
      data,
      size
    }
  };

  return body;
}

export function instanceOfBase64WithMeta(value: any): value is Base64WithMeta {
  return "data" in value && "name" in value && "contentType" in value;
}

export function isValidBase64(value: string) {
  return /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/.test(value);
}

export const INVALIDBASE64 =
  "Invalid encoded content. Please ensure that content encoded with base64";
