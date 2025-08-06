import {isPlatformBrowser} from "@spica-devkit/internal_common";
import {BufferWithMeta, ResumableUploadOptions} from "./interface";
import form from "form-data";
import tus from "tus-js-client";

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

export function startResumableUpload(options: ResumableUploadOptions) {
  const {publicUrl, authorization, object, headers, onError, onProgress, onSuccess} = options;

  const isInstanceOfBufferWithMeta = instanceOfBufferWithMeta(object);

  const filename = object.name;
  const filetype = isInstanceOfBufferWithMeta ? object.contentType : object.type;
  const fileSize = isInstanceOfBufferWithMeta ? object.data.length : object.size;
  const fileData = isInstanceOfBufferWithMeta ? object.data : object;

  const upload = new tus.Upload(fileData, {
    endpoint: `${publicUrl}/storage/resumable`,
    headers: {authorization: authorization, ...headers},
    metadata: {filename, filetype},
    uploadSize: isPlatformBrowser() ? undefined : fileSize,
    urlStorage: isPlatformBrowser() ? undefined : new tus["FileUrlStorage"]("./tus-urls.json"),
    onError: onError || (() => {}),
    onProgress: onProgress || (() => {}),
    onSuccess: onSuccess || (() => {})
  });

  upload.findPreviousUploads().then(previousUploads => {
    if (previousUploads.length) {
      upload.resumeFromPreviousUpload(previousUploads[0]);
    }
    upload.start();
  });
}
