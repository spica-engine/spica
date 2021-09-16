import {ActionParameters, Command, CreateCommandParameters} from "@caporal/core";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import {spin} from "../../console";
import {BucketSchema} from "./interface";
import {buildInterface, buildMethod, prepareInterfaceTitle} from "./schema";

async function orm({options}: ActionParameters) {
  const APIKEY = options.apikey as string;
  const APIURL = options.url as string;
  const PATH = (options.path as string) || "";
  const DESTINATION = path.join(PATH, "bucket.ts");

  await spin({
    text: "Fetching buckets..",
    op: async spinner => {
      const buckets = await axios
        .get<BucketSchema[]>(APIURL + "/bucket", {
          headers: {
            Authorization: `APIKEY ${APIKEY}`
          }
        })
        .then(r => r.data);

      spinner.text = "Building interface and method definitions..";
      let lines: string[] = [];
      // DEVKIT INIT
      lines.push("import * as Bucket from '@spica-devkit/bucket';");
      lines.push(`\nBucket.initialize({apikey:'${APIKEY}',publicUrl:'${APIURL}'});`);

      // HELPER TYPE DEFINITIONS
      lines.push(
        "\n\ntype Rest<T extends any[]> = ((...p: T) => void) extends ((p1: infer P1, ...rest: infer R) => void) ? R : never;"
      );
      lines.push("\ntype getArgs = Rest<Parameters<typeof Bucket.data.get>>;");
      lines.push("\ntype getAllArgs = Rest<Parameters<typeof Bucket.data.getAll>>;");
      lines.push("\ntype realtimeGetArgs = Rest<Parameters<typeof Bucket.data.realtime.get>>;");
      lines.push(
        "\ntype realtimeGetAllArgs = Rest<Parameters<typeof Bucket.data.realtime.getAll>>;"
      );

      // interface and methods definitions
      for (const bucket of buckets) {
        buildInterface(bucket, lines);
        buildMethod(bucket, lines);
      }

      // relation replacement
      buckets.forEach(bucket => {
        const target = `<${bucket._id}>`;
        lines = lines.map(line => {
          if (line.includes(target)) {
            return line.replace(target, prepareInterfaceTitle(bucket.title));
          }
          return line;
        });
      });

      spinner.text = "Writing to the destination..";
      fs.writeFileSync(DESTINATION, lines.join(""));

      spinner.text = `Succesfully completed! File extracted to the ${
        PATH ? DESTINATION : path.join(process.cwd(), "bucket.ts")
      }`;
    }
  });
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Create object relational mapping applied version of @spica-devkit/bucket")
    .option("--url <url>", "Url of the API.", {required: true})
    .option("-a <apikey>, --apikey <apikey>", "Authorize via an API Key.", {required: true})
    .option(
      "--path <path>",
      "Full URL of the destination folder that the file will be created into. The current directory will be used as default"
    )
    .action(orm);
}
