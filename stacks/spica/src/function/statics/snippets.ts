const suggestions = [
  {
    label: "HTTP Function with Database",
    description: "An example http function that fetchs and returns data from database.",
    text: `import {database} from "@spica-devkit/database"

export default async function() {
\tconst db = await database();
\tconst collection = db.collection("bucket_$0");
\treturn collection.find().toArray();
}
`
  },
  {
    label: "HTTP Function",
    description: "An example http function that returns an empty Promise.",
    text: `export default function() {
\treturn Promise.resolve(\${0:"Promise works!"});
}
`
  }
];

export {suggestions};
