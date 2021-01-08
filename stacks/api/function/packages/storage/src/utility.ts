import {BufferWithMeta} from "./interface";
import * as BSON from "bson";

export function fileToBuffer(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

export async function preparePostBody(objects: FileList | (BufferWithMeta | File)[]) {
  let files: (File | BufferWithMeta)[];
  const contents = [];

  // FileList to File array
  if (!Array.isArray(objects)) {
    files = Array.from(objects);
  } else {
    files = objects;
  }

  for (const file of files) {
    const content = await getContent(file);
    contents.push(content);
  }

  const body = {
    content: contents
  };

  return jsonToArrayBuffer(body);
}

export async function preparePutBody(object: File | BufferWithMeta) {
  const body = await getContent(object);

  return jsonToArrayBuffer(body);
}

async function getContent(file: File | BufferWithMeta) {
  let data: string | Buffer | Uint8Array | number[];
  let name: string;
  let type: string;

  if (instanceOfBufferWithMeta(file)) {
    data = file.data;
    name = file.name;
    type = file.contentType;
  } else {
    data = await fileToBuffer(file);
    name = file.name;
    type = file.type;
  }

  return {
    name,
    content: {
      data: new BSON.Binary(data),
      type
    }
  };
}

export function jsonToArrayBuffer(body: object) {
  const size = BSON.calculateObjectSize(body);
  const buffer = BSON.serialize(body, {minInternalBufferSize: size} as any);
  return buffer.buffer;
}

function instanceOfBufferWithMeta(value: any): value is BufferWithMeta {
  return "data" in value && "name" in value && "contentType" in value;
}
