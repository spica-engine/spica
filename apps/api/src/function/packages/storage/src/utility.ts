import {isPlatformBrowser} from "@spica-devkit/internal_common";
import {BufferWithMeta} from "./interface";
import form from "form-data";

export function fileToBuffer(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

export async function preparePostBody(objects: FileList | (BufferWithMeta | File)[]) {
  let files: (File | BufferWithMeta)[] = [];

  if (!Array.isArray(objects)) {
    files = Array.from(objects);
  } else {
    files = objects;
  }

  const form = createForm();

  for (const file of files) {
    appendToForm(form, "files", file);
  }

  return {body: form, headers: getHeaders(form)};
}

export async function preparePutBody(object: File | BufferWithMeta) {
  const form = createForm();

  appendToForm(form, "file", object);

  return {body: form, headers: getHeaders(form)};
}

function instanceOfBufferWithMeta(value: any): value is BufferWithMeta {
  return "data" in value && "name" in value && "contentType" in value;
}

function createForm() {
  return isPlatformBrowser() ? new FormData() : new form();
}

async function appendToForm(form, key: string, file: BufferWithMeta | File) {
  if (isPlatformBrowser()) {
    if (instanceOfBufferWithMeta(file)) {
      (form as FormData).append(key, new Blob([file.data], {type: file.contentType}), file.name);
    } else {
      (form as FormData).append(key, file);
    }
  } else {
    form.append(key, (file as BufferWithMeta).data, {
      contentType: (file as BufferWithMeta).contentType,
      filename: (file as BufferWithMeta).name
    });
  }

  return form;
}

function getHeaders(form) {
  if (!isPlatformBrowser()) {
    return form.getHeaders();
  }
  return {};
}
