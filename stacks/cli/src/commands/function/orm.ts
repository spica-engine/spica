// async function orm({options}: ActionParameters) {
//     const APIKEY = options.apikey as string;
//     const APIURL = options.url as string;
//     const PATH = (options.path as string) || "";
//     const DESTINATION = path.join(PATH, "bucket.ts");
  
//     await spin({
//       text: "Fetching functions..",
//       op: async spinner => {
//         const buckets = await axios
//           .get<BucketSchema[]>(APIURL + "/bucket", {
//             headers: {
//               Authorization: `APIKEY ${APIKEY}`
//             }
//           })
//           .then(r => r.data);
  
//         spinner.text = "Building interface and method definitions..";
  
//         const warnings: string[] = [];
//         const content = Schema.createFileContent(buckets, APIKEY, APIURL, warnings);
  
//         spinner.text = "Writing to the destination..";
//         fs.writeFileSync(DESTINATION, content);
  
//         spinner.text = `Succesfully completed! File url is ${
//           PATH ? DESTINATION : path.join(process.cwd(), "bucket.ts")
//         }`;
  
//         if (warnings.length) {
//           spinner.warn(warnings.join());
//         }
//       }
//     });
//   }
  
//   export default function({createCommand}: CreateCommandParameters): Command {
//     return createCommand("Create object relational mapping applied version of @spica-devkit/bucket")
//       .option("--url <url>", "Url of the API.", {required: true})
//       .option("-a <apikey>, --apikey <apikey>", "Authorize via an API Key.", {required: true})
//       .option(
//         "--path <path>",
//         "Full URL of the destination folder that the file will be created into. The current directory will be used as default"
//       )
//       .action(orm);
//   }

//   export interface FunctionSchema