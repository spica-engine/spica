import {DocCollection, Processor} from "dgeni";

export class FilterProcessor implements Processor {
  name = "module-processor";
  $runBefore = ["docs-processed"];

  $process(docs: DocCollection) {
    return docs.filter(doc => ["class", "controller", "interface"].indexOf(doc.docType) > -1);
  }
}