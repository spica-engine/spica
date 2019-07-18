const tocAst = require("mdast-util-toc");
export function toc(options: any) {
  const defaultHeading = "toc|table[ -]of[ -]contents?";
  const heading = options.heading || defaultHeading;
  const depth = options.maxDepth || 6;
  const tight = options.tight;
  const skip = options.skip;
  return (node: any) => {
    var result = tocAst(node, {
      heading: heading,
      maxDepth: depth,
      tight: tight,
      skip: skip
    });

    if (result.index === null || result.index === -1 || !result.map) {
      return;
    }

    const toc: any = {
      type: "tocList",
      data: {
        hName: "doc-toc"
      },
      children: [result.map]
    };

    node.children = [].concat(
      node.children.slice(0, result.index - 1),
      toc,
      node.children.slice(result.endIndex)
    );
  };
}
