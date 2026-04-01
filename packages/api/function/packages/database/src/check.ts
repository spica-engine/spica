import {mongodb} from "./mongo";

function emitWarning(path: string) {
  process.emitWarning(
    `Property in the document path '${path}' contains an ObjectId value.\n` +
      `This may lead to some inconsistencies within the system.\n` +
      `You may want to cast it to string before using it.`
  );
}

export function checkDocument(document: object, path: string = undefined): void {
  if (document instanceof mongodb.ObjectId) {
    // Check if the path is alike 0._id or _id or $set._id
    if (/^(\d\._id|_id|\$.*?\._id)$/.test(path)) {
      return;
    }
    emitWarning(path);
  } else if (Array.isArray(document)) {
    for (const [index, subDocument] of document.entries()) {
      const subPath = [path, index].filter(r => r != undefined).join(".");
      checkDocument(subDocument, subPath);
    }
  } else if (typeof document == "object") {
    for (const key in document) {
      const subDocument = document[key];
      const subPath = [path, key].filter(r => r != undefined).join(".");
      checkDocument(subDocument, subPath);
    }
  }
}

export function checkDocuments(documents: object[]): void {
  for (const [index, document] of documents.entries()) {
    checkDocument(document, String(index));
  }
}
