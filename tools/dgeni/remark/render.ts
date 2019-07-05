const remark = require("remark");
const remarkHtml = require("remark-html");

function code(h: any, node: any) {
  var value = node.value ? "\n" + node.value + "\n" : "";
  var lang = node.lang && node.lang.match(/^[^ \t]+(?=[ \t]|$)/);
  var props: any = {};

  if (lang) {
    props.language = lang;
  }

  return h(node, "code-example", props, [{type: "text", value}]);
}

export function renderMarkdown() {
  return function renderMarkdownImpl(content: any) {
    const renderer = remark().use(remarkHtml, {handlers: {code}});
    return renderer.processSync(content).toString();
  };
}
