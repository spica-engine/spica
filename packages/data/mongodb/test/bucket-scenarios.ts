import {ObjectId} from "mongodb";

// Bucket read scenarios shared by the parity test and the script that recorded the pipelines of
// the findDocuments implementation the bucket query facade replaced.

export const authorsId = new ObjectId("5f1e8b9c2a4d3e0000000001");
export const booksId = new ObjectId("5f1e8b9c2a4d3e0000000002");
export const userId = new ObjectId("5f1e8b9c2a4d3e0000000003");
export const documentId = new ObjectId("5f1e8b9c2a4d3e0000000004");

const authors: any = {
  _id: authorsId,
  title: "Authors",
  primary: "name",
  acl: {read: "true==true", write: "true==true"},
  properties: {
    name: {type: "string", options: {translate: true}},
    secret_code: {type: "hash"},
    owner: {type: "string"}
  }
};

const books: any = {
  _id: booksId,
  title: "Books",
  primary: "title",
  acl: {read: "document.owner == auth._id", write: "true==true"},
  properties: {
    title: {type: "string", options: {translate: true}},
    owner: {type: "string"},
    published_at: {type: "date"},
    isbn: {type: "hash"},
    price: {type: "number", acl: "auth.role == 'admin'"},
    author: {type: "relation", bucketId: authorsId.toHexString(), relationType: "onetoone"},
    co_authors: {type: "relation", bucketId: authorsId.toHexString(), relationType: "onetomany"}
  }
};

const plain: any = {
  _id: new ObjectId("5f1e8b9c2a4d3e0000000005"),
  title: "Plain",
  primary: "name",
  acl: {read: "true==true", write: "true==true"},
  properties: {name: {type: "string"}, created_at: {type: "date"}}
};

export const schemas = {authors, books, plain};

export const preferences: any = {
  _id: new ObjectId("5f1e8b9c2a4d3e0000000006"),
  scope: "bucket",
  language: {available: {en_US: "English", tr_TR: "Turkish"}, default: "en_US"}
};

export const resolveSchema = (id: string | {toString(): string}) =>
  Object.values(schemas).find(schema => schema._id.toString() == id.toString());

export const user = {_id: userId.toHexString(), role: "admin"};

export interface Scenario {
  name: string;
  bucket: keyof typeof schemas;
  paginate: boolean;
  hashSecret?: string;
  spec: {
    documentId?: ObjectId;
    resourceFilter?: object;
    filter?: object | string;
    language?: string;
    localize?: boolean;
    relationPaths?: string[][];
    projectMap?: string[][];
    sort?: object;
    skip?: number;
    limit?: number;
    applyAcl?: boolean;
  };
}

export const scenarios: Scenario[] = [
  {
    name: "plain list with seeking stages",
    bucket: "plain",
    paginate: false,
    spec: {localize: true, sort: {name: 1}, skip: 2, limit: 3, relationPaths: [], projectMap: []}
  },
  {
    name: "plain page without filter estimates the count",
    bucket: "plain",
    paginate: true,
    spec: {localize: true, relationPaths: [], projectMap: []}
  },
  {
    name: "plain page with a json filter counts exactly",
    bucket: "plain",
    paginate: true,
    spec: {
      filter: {name: "x", created_at: {$gt: "2020-01-01T00:00:00.000Z"}},
      relationPaths: [],
      projectMap: []
    }
  },
  {
    name: "localized books in turkish",
    bucket: "books",
    paginate: false,
    spec: {localize: true, language: "tr_TR", relationPaths: [], projectMap: []}
  },
  {
    name: "localized books without a language fall back",
    bucket: "books",
    paginate: false,
    spec: {localize: true, relationPaths: [], projectMap: []}
  },
  {
    name: "books with relations resolved",
    bucket: "books",
    paginate: false,
    spec: {
      localize: true,
      language: "en_US",
      relationPaths: [
        ["author", "name"],
        ["co_authors", "name"]
      ],
      projectMap: [],
      limit: 10
    }
  },
  {
    name: "books filtered through a relation with a json filter",
    bucket: "books",
    paginate: true,
    hashSecret: "hash-secret",
    spec: {
      filter: {
        "author.name": "spica",
        isbn: "123",
        published_at: "2021-02-03T00:00:00.000Z",
        _id: documentId.toHexString()
      },
      relationPaths: [["author"]],
      projectMap: []
    }
  },
  {
    name: "books filtered with an expression",
    bucket: "books",
    paginate: true,
    spec: {
      filter: "document.title == 'a' && document.author.name == 'b'",
      relationPaths: [],
      projectMap: []
    }
  },
  {
    name: "books read by a user under acl",
    bucket: "books",
    paginate: true,
    spec: {
      applyAcl: true,
      localize: true,
      language: "en_US",
      filter: {title: "x"},
      relationPaths: [["author", "name"]],
      projectMap: [],
      sort: {_id: -1},
      limit: 5
    }
  },
  {
    name: "books acl without filter still counts exactly",
    bucket: "books",
    paginate: true,
    spec: {applyAcl: true, relationPaths: [], projectMap: []}
  },
  {
    name: "single book with graphql projection",
    bucket: "books",
    paginate: false,
    spec: {
      documentId,
      localize: true,
      relationPaths: [["title"], ["author", "name"]],
      projectMap: [["title"], ["author", "name"]]
    }
  },
  {
    name: "single book by rest",
    bucket: "books",
    paginate: false,
    spec: {documentId, limit: 1, localize: false, relationPaths: [], projectMap: []}
  },
  {
    name: "resource filtered authors",
    bucket: "authors",
    paginate: false,
    spec: {
      resourceFilter: {$match: {_id: {$in: [authorsId]}}},
      relationPaths: [],
      projectMap: []
    }
  }
];
