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
  firehose: `export default function(message, { socket, pool }) {
\tconsole.log(message.name);
\tconsole.log(message.data.url);
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
    BEFORE: {
      INSERT: `export default function(request) { 
\tconsole.log("User with " + request.headers.authorization + " will insert a new entry to bucket that has id " + request.bucket );
\tconst can_insert = true;
\treturn can_insert;
}`,
      UPDATE: `export default function(request) {
\tconsole.log("User with " + request.headers.authorization + " will update the document that has id " + request.document + " of bucket that has id " + request.bucket );
\tconst can_update = true;
\treturn can_update;
}`,
      DELETE: `export default function(request) {
\tconsole.log("User with " + request.headers.authorization + " will delete the document that has id " + request.document + " of bucket that has id " + request.bucket );
\tconst can_delete = true;
\treturn can_delete;
}`,
      GET: `export default function(request) {
\tconsole.log("User with " + request.headers.authorization + " will display the document that has id " + request.document + " of bucket that has id " + request.bucket );
\tconst hidden_field = "password";
\treturn [{ $unset: hidden_field }];
}`,
      INDEX: `export default function(request) {
\tconsole.log("User with " + request.headers.authorization + " will display all documents of bucket that has id " + request.bucket );
\tconst criteria = { age: 20 };
\treturn [{ $match: criteria }];
}`,
      STREAM: `export default function(request) {
\tconsole.log("User with " + request.headers.authorization + " will display all documents of bucket that has id " + request.bucket + " via websocket" );
\tconst filter = { status: "active" };
\treturn filter;
}`
    },
    AFTER: {
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
  }
};

export {examples};
