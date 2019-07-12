const remark = require("remark");
const remarkHtml = require("remark-html");
const remarkToc = require("remark-toc");
const remarkHighlight = require("remark-highlight.js");

function anchor(h: any, node: any) {
  if (!node.url.startsWith("#")) {
    return h(node, "a", { href: node.url, target: '_blank' }, node.children);
  }
  return h(node, "fragment-link", {url: node.url}, node.children);
}

export function renderMarkdown() {
  return function renderMarkdownImpl(content: any) {
    const renderer = remark()
      .use(remarkToc)
      .use(remarkHighlight)
      .use(remarkHtml, {handlers: {link: anchor}});
    return renderer.processSync(content).toString();
  };
}
