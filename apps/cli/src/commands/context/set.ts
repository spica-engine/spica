import {ActionParameters, Command, CreateCommandParameters, Program} from "@caporal/core";
import axios from "axios";
import {context} from "../../context";

async function addContext({options}: ActionParameters) {
  const name = options.name as string;
  const apikey = options.apikey as string;
  const url = options.url as string;

  const rest = axios.create({
    baseURL: url,
    headers: {
      Authorization: `APIKEY ${apikey}`
    }
  });

  try {
    await rest.get("/passport/identity/statements");
    const exists = context.has(name);

    context.set(name, {url, authorization: `APIKEY ${apikey}`});
    console.info(`Context "${name}" is successfully ${exists ? "set" : "added"}.`);
  } catch (error) {
    if (error.response) {
      console.error(
        `Error from server (${error.response.statusText}): ${error.response.data.message}`
      );
    } else if (error.request) {
      console.error(
        `Error (${error.code}): Something has happened while connecting, ${error.message}`
      );
    } else {
      console.error(`Error: ${error.message}`);
    }
  }
}

export default function(program: Program): Command {
  return program
    .command("context set", "Set context")
    .option("--name <name>", "Name of the context.")
    .option("--url <url>", "Url of the API.", {required: true})
    .option("-a <apikey>, --apikey <apikey>", "Authorize via an API Key.", {required: true})
    .action(addContext);
}
