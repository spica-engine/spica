import * as tss from "typescript/lib/tsserverlibrary";
import * as ts from "typescript";

const notAllowedModules = ["v8", "vm", "cluster", "worker_threads"];

function init(modules: {typescript: typeof tss}) {
  function create(info: tss.server.PluginCreateInfo): tss.LanguageService {
    const oldLS: ts.LanguageService = info.languageService;
    const proxy: ts.LanguageService = Object.assign({}, oldLS);
    proxy.getCompletionsAtPosition = (fileName, position, options) => {
      const info = oldLS.getCompletionsAtPosition(fileName, position, options);
      info.entries = info.entries.filter(entry =>
        entry.kind == ts.ScriptElementKind.externalModuleName
          ? notAllowedModules.indexOf(entry.name) == -1
          : true
      );
      return info;
    };

    return proxy;
  }

  return {create};
}

export = init;
