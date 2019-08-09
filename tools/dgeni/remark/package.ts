import {Package} from "dgeni";
import {marked} from "./filter";
import {readMarkdownFiles} from "./processor";
import {parseMarkdown, renderMarkdown} from "./render";

export const remarkPackage = new Package("remark", ["nunjucks"])
  .factory(marked)
  .factory(renderMarkdown)
  .factory(parseMarkdown)
  .processor(readMarkdownFiles);
