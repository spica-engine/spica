import {DocCollection, Processor} from "dgeni";

export class FilterProcessor implements Processor {
  name = "filter-processor";
  $runBefore = ["docs-processed"];

  $process(docs: DocCollection) {
    return docs.filter(
      doc => ["class", "controller", "interface", "markdown", "doc-list"].indexOf(doc.docType) > -1
    );
  }
}
