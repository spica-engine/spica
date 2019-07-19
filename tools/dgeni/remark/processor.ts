import {DocCollection, Processor} from "dgeni";
import {readFileSync} from "fs";
import {basename, join} from "path";
const YAML = require("yaml");

export function readMarkdownFiles(parseMarkdown: any, renderMarkdown: any, log: any) {
  return new ReadMarkdownFiles(parseMarkdown, renderMarkdown, log);
}

export class ReadMarkdownFiles implements Processor {
  public basePath: string;
  public files: string[] = [];

  $runBefore?: string[] | undefined = ["parsing-tags"];
  $runAfter?: string[] | undefined = ["files-read"];

  constructor(private parseMarkdown: any, private renderMarkdown: any, private log: any) {}

  $process(docs: DocCollection): void | any[] | PromiseLike<any[]> {
    this.files
      .filter(f => !!f)
      .forEach(f => {
        this.log.debug(`Reading file: ${f}`);
        const fpath = join(this.basePath, f);
        const content = readFileSync(fpath).toString();
        const rendered = this.renderMarkdown(content);

        const parsed = this.parseMarkdown(content);
        const frontMatter = parsed.children.find((n: any) => n.type == "yaml");

        if (frontMatter) {
          frontMatter.value = YAML.parse(frontMatter.value);
        }
        const doc = new MarkdownDoc(
          frontMatter && frontMatter.data && frontMatter.data.parsedValue,
          fpath,
          rendered,
          content
        );
        if (!doc.name) {
          this.log.warn(`Exported markdown doc ${f} has no heading.`);
        }
        docs.push(doc);
        this.log.debug(`Exported markdown doc: ${f}`);
      });
    return docs;
  }
}

export class MarkdownDoc {
  id: string;
  frontMatter: any;
  name: string;
  path: string;
  aliases: string[] = [];
  docType = "markdown";
  renderedContent: string;
  content: string;
  outputPath: string;
  originalModule: string;
  constructor(frontMatter: any, path: string, renderedContent: string, content: string) {
    this.frontMatter = frontMatter;
    this.path = this.id = this.originalModule = basename(path.replace(/(.*?)\.md$/, "$1"));
    this.aliases.push(this.originalModule);
    this.renderedContent = renderedContent;
    this.content = content;
    this.name =
      (frontMatter && frontMatter.title) ||
      (/^#[ \t]{0,}([^\r\n#]*)(?<=\S)\s*?$/m.exec(this.content) || [])[1];
  }
}
