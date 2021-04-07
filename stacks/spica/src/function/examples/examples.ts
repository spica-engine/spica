const examples = {
  http: `export default function(request, response) {
\treturn response.status(201).send("Message from example http function.");
}`,
  database: {
    INSERT: `export default function(change) {
\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of collection " + change.collection);
\tconsole.log("Document: ",change.document);
}`,
    REPLACE: `export default function(change) {
\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of collection " + change.collection);
\tconsole.log("Document: ", change.document);
}`,
    UPDATE: `export default function(change) {
\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of collection " + change.collection);
\tconsole.log("Document: ",change.document);
}`,
    DELETE: `export default function(change) {
\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of collection " + change.collection);
}`
  },
  firehose: `export default function({ socket, pool }, message) {
\tconsole.log(message.name); // name is the event name that has been triggered
\tconsole.log(message.data); // use this field to pass data from client to server
\tconst isAuthorized = false;
\tif (isAuthorized) {
\t\tsocket.send("authorization", { state: true });
\t\tpool.send("connection", { id: socket.id, ip_address: socket.remoteAddress });
\t} else {
\t\tsocket.send("authorization", { state: false, error: "Authorization has failed." });
\t\tsocket.close();
\t}
}`,
  schedule: `export default function(unregister) {
\tconsole.log("Message from example schedule function.");
\tconst unregister_date = new Date("2050-01-01");
\tconst now = new Date();
\tif (now > unregister_date) {
\t\tunregister();
\t}
}`,
  system: `export default function() {
\tconst now = new Date();
\tconsole.log("System has became ready at " , now);
}`,
  bucket: {
    ALL: `export default function(change) {
\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of bucket with id " + change.bucket);
\tconsole.log("Previous document: ",change.previous);
\tif (change.current) {
\t\tconsole.log("Current document: ",change.current)
\t}
}`,
    INSERT: `export default function(change) {
\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of bucket with id " + change.bucket);
\tconsole.log("Previous document: ",change.previous);
\tconsole.log("Current document: ",change.current)
}`,
    UPDATE: `export default function(change) {
\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of bucket with id " + change.bucket);
\tconsole.log("Previous document: ",change.previous);
\tconsole.log("Current document: ",change.current)
}`,
    DELETE: `export default function(change) {
\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of bucket with id " + change.bucket);
\tconsole.log("Previous document: ",change.previous)
}`
  }
};

export {examples};
