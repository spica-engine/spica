import * as fs from "fs";
import * as path from "path";

if (require.main === module) {
  const [binDir, outputDir, docListPath, docsJson] = fs
    .readFileSync(process.argv.slice(2)[0], {encoding: "utf-8"})
    .split("\n");

  const docs = JSON.parse(docsJson).docs;

  const docList = [];

  for (const doc of docs) {
    const oldDocListFilePath = path.join(process.cwd(), binDir, doc.list);
    const newDocListFilePath = path.join(
      outputDir,
      doc.name,
      doc.list.replace(doc.path, "").replace(/^\/?(.*?)/, "$1")
    );
    fs.copyFileSync(oldDocListFilePath, newDocListFilePath);
    const _doc = {
      title: doc.title,
      name: doc.name,
      path: doc.name,
      docs: require(oldDocListFilePath)
    };
    docList.push(_doc);
    for (const docfile of doc.docs) {
      const oldDocfilePath = path.join(process.cwd(), binDir, docfile);
      const newDocFilePath = path.join(
        outputDir,
        doc.name,
        docfile.replace(doc.path, "").replace(/^\/?(.*?)/, "$1")
      );
      fs.copyFileSync(oldDocfilePath, newDocFilePath);
    }
  }

  fs.writeFileSync(docListPath, JSON.stringify(docList, undefined, 2));
}
