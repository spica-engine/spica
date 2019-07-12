import {DocCollection, Processor} from "dgeni";
import {basename, join} from "path";
import {readFileSync} from "fs";

export function readMarkdownFiles(renderMarkdown: any, log: any) {
  return new ReadMarkdownFiles(renderMarkdown, log);
}

export class ReadMarkdownFiles implements Processor {
  public basePath: string;
  public files: string[] = [];

  $runBefore?: string[] | undefined = ["parsing-tags"];
  $runAfter?: string[] | undefined = ["files-read"];

  constructor(private renderMarkdown: any, private log: any) {}

  $process(docs: DocCollection): void | any[] | PromiseLike<any[]> {
    this.files.forEach(f => {
      this.log.debug(`Reading file: ${f}`);
      const fpath = join(this.basePath, f);
      const content = readFileSync(fpath).toString();
      const rendered = this.renderMarkdown(content);
      const doc = new MarkdownDoc(fpath, rendered, content);
      if ( !doc.name ) {
        this.log.warn(`Exported markdown doc ${f} has no heading`);
      }
      docs.push(doc);
      this.log.debug(`Exported markdown doc: ${f}`);
    });
    return docs;
  }
}

export class MarkdownDoc {
  id: string;
  name: string;
  path: string;
  aliases: string[] = [];
  docType = "markdown";
  renderedContent: string;
  content: string;
  outputPath: string;
  originalModule: string;
  constructor(path: string, renderedContent: string, content: string) {
    this.path = this.id = this.originalModule = basename(path.replace(/(.*?)\.md$/, "$1"));
    this.aliases.push(this.originalModule);
    this.renderedContent = renderedContent;
    this.content = content;
    this.name = (/^#[ \t]{0,}([^\r\n#]*)(?<=\S)\s*?$/m.exec(this.content) || [])[1];
  }
}
