export function marked(renderMarkdown: any) {
  return {
    name: "marked",
    process: function(str: any, headingMappings: any) {
      return str && renderMarkdown(str, headingMappings);
    }
  };
}
