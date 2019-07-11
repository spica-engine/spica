import {DocCollection, Processor} from "dgeni";

export class SymbolFilterProcessor implements Processor {
  name = "symbol-filter";
  $runAfter = ["filter-processor"];
  $runBefore = ["list-processor"];
  constructor(private expectedSymbols: string[]) {}

  $process(docs: DocCollection) {
    return docs.filter(doc => this.expectedSymbols.indexOf(doc.path) > -1);
  }
}
