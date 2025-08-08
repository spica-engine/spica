import {ActionParameters, CreateCommandParameters, Command, Program} from "@caporal/core";
import {Function, Triggers, Trigger} from "../../../../../libs/interface/function";
import axios from "axios";
import path from "path";
import fs from "fs";
import {spin} from "../../console";
import {FunctionCompiler} from "../../compile";
import {availableHttpServices, separateToNewLines} from "../../validator";
import {green} from "colorette";
import {FunctionWithIndex} from "../../function/interface";
import {httpService} from "../../http";
import {context} from "../../context";

async function orm({options}: ActionParameters) {
  const PATH = (options.path as string) || path.join(process.cwd(), "functions");
  const TRIGGER_TYPES = options.triggerTypes as string[];
  const HTTP_SERVICE = options.httpService as string;

  const httpClient = await httpService.createFromCurrentCtx();

  const {url} = await context.getCurrent();

  await spin({
    text: "Fetching functions..",
    op: async spinner => {
      const functions = await httpClient.get<FunctionWithIndex[]>("/function").then(r => {
        const fns = r;
        const promises = fns.map(fn =>
          httpClient.get<any>(`/function/${fn._id}/index`).then(r => {
            fn.index = r.index;
          })
        );
        return Promise.all(promises).then(() => fns);
      });

      spinner.text = "Building interface and method definitions..";

      if (!fs.existsSync(PATH)) {
        fs.mkdirSync(PATH);
      }

      const writeFilePromises = [];
      for (const fn of functions) {
        const options = {
          http: {selectedService: HTTP_SERVICE}
        };
        const sources = new FunctionCompiler(fn, TRIGGER_TYPES, url, options).compile();

        const replacedName = fn.name.replace(/ /gm, "_").replace(/\//g, "__");
        const folderPath = path.join(PATH, replacedName);
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath);
        }

        for (const source of sources) {
          const _path = path.join(folderPath, `index.${source.extension}`);

          writeFilePromises.push(fs.promises.writeFile(_path, source.content, {}));
        }
      }

      spinner.text = "Writing to the destination..";
      await Promise.all(writeFilePromises);

      spinner.text = `Succesfully completed! Folder url is ${PATH}`;
    }
  });
}

export default function (program: Program): Command {
  return program
    .command(
      "function orm",
      "Create object relational mapping applied files to interact with Spica Cloud Functions"
    )
    .option(
      "--path <path>",
      "Full URL of the destination folder that the files will be created into. The current directory will be used as default"
    )
    .option(
      "--trigger-types <trigger-types>",
      "Trigger types that will be filtered. Default value is http.",
      {
        default: ["http"]
      }
    )
    .option(
      "--http-service <http-service>",
      `Third party library that is responsible for sending http requests. Available services are: ${separateToNewLines(
        availableHttpServices,
        green
      )}}.`,
      {
        default: "axios"
      }
    )
    .action(orm);
}
