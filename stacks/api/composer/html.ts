import {promises} from "fs";
import * as parse5 from "parse5";
import * as path from "path";

export function traverse(root: parse5.Document, visitor: (node, parent) => boolean | void) {
  const visit = (node, parent) => {
    if (!node) {
      return;
    }
    root.childNodes;
    const res = visitor(node, parent);

    let {childNodes} = node;

    if (res !== false && (Array.isArray(childNodes) && childNodes.length >= 0)) {
      childNodes.forEach(child => {
        visit(child, node);
      });
    }
  };

  visit(root, null);
}

function getCustomCodeRange(node: any): {start: number; end: number} | null {
  const start = node.childNodes.findIndex(
    node => node.nodeName == "#comment" && node.data == "Custom code"
  );
  const end = node.childNodes.findIndex(
    (node, index) => node.nodeName == "#comment" && node.data == "Custom code" && index != start
  );
  if (start == -1 || end == -1) {
    return null;
  }
  return {start, end};
}

export function getCustomCodeInHead(root: string) {
  return promises.readFile(path.join(root, "src", "index.html")).then(buffer => {
    const ast = parse5.parse(buffer.toString());
    let code;
    traverse(ast, node => {
      if (node.tagName == "head") {
        const range = getCustomCodeRange(node);
        if (!range) {
          return false;
        }

        const docFragment = {
          nodeName: "#document-fragment",
          childNodes: []
        };

        node.childNodes
          .slice(range.start + 1, range.end)
          .forEach(node => docFragment.childNodes.push(docFragment, node));
        code = parse5.serialize(docFragment).replace(/(^[ \t]*\n)/gm, "");
        return false;
      }
    });
    return code;
  });
}

export function updateCustomCodeInHead(root: string, code: string) {
  const indexHtmlPath = path.join(root, "src", "index.html");
  return promises
    .readFile(indexHtmlPath)
    .then(buffer => {
      const ast = parse5.parse(buffer.toString());
      traverse(ast, node => {
        if (node.tagName == "head") {
          const range = getCustomCodeRange(node);
          if (range) {
            node.childNodes.splice(range.start, range.end - range.start + 1);
          }

          node.childNodes.push({
            nodeName: "#comment",
            data: "Custom code",
            parentNode: node
          });

          node.childNodes.push(...parse5.parseFragment(node, code).childNodes);
          node.childNodes.push({
            nodeName: "#comment",
            data: "Custom code",
            parentNode: node
          });
          return false;
        }
      });
      return parse5.serialize(ast);
    })
    .then(html => promises.writeFile(indexHtmlPath, html));
}
