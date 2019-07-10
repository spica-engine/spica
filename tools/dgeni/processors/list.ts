import {DocCollection, Processor} from "dgeni";

export class ListProcessor implements Processor {
  name = "list-processor";
  $runBefore = ["rendering-docs"];
  outputFolder = null;
  $process(docs: DocCollection) {
    return docs.concat([
      {
        docType: "doc-list",
        path: "doc-list.json",
        outputPath: "doc-list.json",
        docs: docs
          .filter(doc => !!doc.name)
          .map(doc => ({
            name: doc.name,
            path: doc.path,
            docType: doc.docType
          }))
      }
    ]);
  }
}
