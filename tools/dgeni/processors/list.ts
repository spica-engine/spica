import {DocCollection, Processor} from "dgeni";
import * as path from "path";

export class ListProcessor implements Processor {
  name = "list-processor";
  $runBefore = ["rendering-docs"];

  constructor(private docName: string, private basePath: string, private data: any[]) {}

  $process(docs: DocCollection) {
    return docs.concat([
      {
        docType: "doc-list",
        path: "doc-list.json",
        outputPath: "doc-list.json",
        list: {
          name: this.docName,
          docs: docs
            .filter(doc => !!doc.name && doc.originalModule != "index")
            .map(doc => ({
              name: doc.name,
              path: doc.path,
              docType: doc.docType
            })),
          children: this.data.map(data => require(path.join(this.basePath, data.list)))
        }
      }
    ]);
  }
}
