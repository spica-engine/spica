import {ActionParameters, CreateCommandParameters, Command} from "@caporal/core";
import {Function, Triggers, Trigger} from "@spica-server/interface/function";
import axios from "axios";
import * as path from "path";
import * as fs from "fs";
import * as ts from "typescript";
import {spin} from "../../console";
import {FunctionWithIndex} from "../../compile";

async function orm({options}: ActionParameters) {
  const APIKEY = options.apikey as string;
  const APIURL = options.url as string;
  const PATH = (options.path as string) || "";
  const TRIGGER_TYPES = options.triggerTypes as string[];

  await spin({
    text: "Fetching functions..",
    op: async spinner => {
      const config = {
        headers: {
          Authorization: `APIKEY ${APIKEY}`
        }
      };

      const functions = await axios
        .get<FunctionWithIndex[]>(APIURL + "/function", config)
        .then(r => {
          const fns = r.data;
          const promises = fns.map(fn =>
            axios.get(`${APIURL}/function/${fn._id}/index`, config).then(r => {
              fn.index = r.data.index;
            })
          );
          return Promise.all(promises).then(() => fns);
        });

      spinner.text = "Building interface and method definitions..";

      const warnings: string[] = [];
      const content = Schema.createFileContent(functions, APIURL, TRIGGER_TYPES);

      //   spinner.text = "Writing to the destination..";
      //   fs.writeFileSync(DESTINATION, content);

      //   spinner.text = `Succesfully completed! File url is ${
      //     PATH ? DESTINATION : path.join(process.cwd(), "bucket.ts")
      //   }`;

      //   if (warnings.length) {
      //     spinner.warn(warnings.join());
      //   }
    }
  });
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand(
    "Create object relational mapping applied file to interact with spica API functions"
  )
    .option("--url <url>", "Url of the API.", {required: true})
    .option("-a <apikey>, --apikey <apikey>", "Authorize via an API Key.", {required: true})
    .option(
      "--path <path>",
      "Full URL of the destination folder that the file will be created into. The current directory will be used as default"
    )
    .option(
      "--trigger-types <trigger-types>",
      "Trigger types that will be filtered. Default value is http.",
      {
        default: ["http"]
      }
    )
    .action(orm);
}

export namespace Schema {
  export function createFileContent(
    functions: FunctionWithIndex[],
    apiUrl: string,
    triggerTypes: string[]
  ) {
    for (const fn of functions) {
      // const ast = ts.createSourceFile("source.ts", fn.index, ts.ScriptTarget.Latest);
      // fn.triggers = filterTriggerTypes(fn.triggers, triggerTypes);
      // //@ts-ignore
      // ast.statements = filterAstStatements(ast.statements, fn.triggers);
      // for (const [handler, trigger] of Object.entries(fn.triggers)) {
      //   const builder = builders.find(b => b.name == trigger.type);
      //   if (!builder) {
      //     throw Error(`There is no code builder for trigger type ${trigger.type}`);
      //   }
      //   const topStatements = builder.getImportStatements();
      //   //@ts-ignore
      //   ast.statements = ast.statements.concat(topStatements, ast.statements);
      //   const handlerStatemet = findHandlerStatement(handler, ast.statements);
      //   builder.build(handlerStatemet, trigger, apiUrl);
      // }
    }
  }

  export function getTriggerHandlers(triggers: Triggers) {
    return Object.keys(triggers);
  }

  export function filterTriggerTypes(triggers: Triggers, types: string[]) {
    return Object.entries(triggers)
      .filter(([_, value]) => types.includes(value.type))
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});
  }

  export function filterAstStatements(
    statements: ts.NodeArray<ts.Statement>,
    triggers: Triggers
  ): ts.FunctionDeclaration[] {
    const triggerHandlers = getTriggerHandlers(triggers);
    return statements.filter(
      node =>
        ts.isFunctionDeclaration(node) && triggerHandlers.includes(node.name.escapedText as string)
    ) as ts.FunctionDeclaration[];
  }

  export function findHandlerStatement(
    handler: string,
    statements: ts.NodeArray<ts.Statement>
  ): ts.FunctionDeclaration {
    return statements.find(
      node => ts.isFunctionDeclaration(node) && (node.name.escapedText as string) == handler
    ) as ts.FunctionDeclaration;
  }

  export const Http: CodeBuilder = {
    name: "http",
    getImportStatements: () =>
      [
        ts.factory.createImportDeclaration(
          undefined,
          undefined,
          ts.factory.createImportClause(undefined, ts.factory.createIdentifier("axios"), undefined),
          ts.factory.createStringLiteral("axios")
        )
      ] as ts.Statement[],
    build: (node, trigger, baseUrl) => {
      // empty body and parameters
      return node;
    }
  };

  export function createParameterDeclaration(name: string, type: ts.KeywordTypeSyntaxKind) {
    return ts.factory.createParameterDeclaration(
      undefined,
      undefined,
      undefined,
      ts.factory.createIdentifier(name),
      undefined,
      ts.factory.createKeywordTypeNode(type),
      undefined
    );
  }

  const builders: CodeBuilder[] = [Http];
}

export interface CodeBuilder {
  name: string;
  getImportStatements: () => ts.Statement[];
  build: (node: ts.FunctionDeclaration, trigger: Trigger, baseUrl?: string) => ts.Statement;
}
