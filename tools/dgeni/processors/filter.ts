import {DocCollection, Processor} from "dgeni";

export class FilterProcessor implements Processor {
  name = "module-processor";
  $runBefore = ["docs-processed"];

  $process(docs: DocCollection) {
    return docs.filter(doc => ["module", "class", "controller", "route"].indexOf(doc.docType) > -1);
  }
}