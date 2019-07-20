import {toc} from "./toc";

const remark = require("remark");
const remarkSlug = require("remark-slug");
const remarkHtml = require("remark-html");
const remarkFrontMatter = require("remark-frontmatter");
const remarkHighlight = require("remark-highlight.js");

function link(h: any, node: any) {
  if (!node.url.startsWith("#")) {
    return h(node, "a", {href: node.url, target: "_blank", class: 'external-link'}, node.children);
  }
  return h(node, "fragment-link", {url: node.url}, node.children);
}

export function renderMarkdown() {
  return function renderMarkdownImpl(content: any) {
    const renderer = remark()
      .use(remarkFrontMatter)
      .use(remarkHighlight)
      .use(remarkSlug)
      .use(toc, {maxDepth: 2, tight: true})
      .use(remarkHtml, {handlers: {link}});
    return renderer.processSync(content).toString();
  };
}

export function parseMarkdown() {
  return function parseMarkdownImpl(content: any) {
    const renderer = remark().use(remarkFrontMatter);
    return renderer.parse(content);
  };
}
