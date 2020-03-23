import {Resource, Action} from "@spica-server/activity";

export function createBucketResource(action: Action, req: any, res: any): Resource {
  let name = "BUCKET";

  let documentId: string[] = [];
  switch (action) {
    case Action.POST:
      documentId.push(res._id.toString());
      break;
    case Action.PUT:
      documentId.push(req.params.id);
      break;
    case Action.DELETE:
      documentId.push(req.params.id);
      break;
  }

  return {name, documentId};
}

export function createBucketDataResource(action: Action, req: any, res: any): Resource {
  let name = "BUCKET";
  let documentId = req.params.bucketId;

  let subDocumentId: string[] = [];
  switch (action) {
    case Action.POST:
      subDocumentId.push(res._id.toString());
      break;
    case Action.PUT:
      subDocumentId.push(req.params.documentId);
      break;
    case Action.DELETE:
      if (req.params.documentId) {
        subDocumentId.push(req.params.documentId);
      } else {
        subDocumentId = req.body;
      }
      break;
  }

  let subResource: Resource = {
    name: "BUCKET-DATA",
    documentId: subDocumentId
  };

  return {name, documentId, subResource};
}

export function createFunctionResource(action: Action, req: any, res: any): Resource {
  let name = "FUNCTION";

  let documentId: string[] = [];
  switch (action) {
    case Action.POST:
      documentId.push(res._id.toString());
      break;
    case Action.PUT:
      documentId.push(req.params.id);
      break;
    case Action.DELETE:
      documentId.push(req.params.id);
      break;
  }

  return {name, documentId};
}

export function createApikeyResource(action: Action, req: any, res: any): Resource {
  let name = "APIKEY";

  let documentId: string[] = [];
  switch (action) {
    case Action.POST:
      documentId.push(res._id.toString());
      break;
    case Action.PUT:
      documentId.push(req.params.id);
      break;
    case Action.DELETE:
      documentId.push(req.params.id);
      break;
  }

  return {name, documentId};
}

export function createApikeyPolicyResource(action: Action, req: any, res: any): Resource {
  let name = "APIKEY";
  let documentId = req.params.id;

  let subResource: Resource = {
    name: "POLICY",
    documentId: req.body
  };

  return {name, documentId, subResource};
}

export function createIdentityResource(action: Action, req: any, res: any): Resource {
  let name = "IDENTITY";

  let documentId: string[] = [];
  switch (action) {
    case Action.POST:
      documentId.push(res._id.toString());
      break;
    case Action.PUT:
      documentId.push(req.params.id);
      break;
    case Action.DELETE:
      documentId.push(req.params.id);
      break;
  }

  return {name, documentId};
}

export function createIdentityPolicyResource(action: Action, req: any, res: any): Resource {
  let name = "IDENTITY";
  let documentId = req.params.id;

  let subResource: Resource = {
    name: "POLICY",
    documentId: req.body
  };

  return {name, documentId, subResource};
}

export function createPolicyResource(action: Action, req: any, res: any): Resource {
  let name = "POLICY";

  let documentId: string[] = [];
  switch (action) {
    case Action.POST:
      documentId.push(res._id.toString());
      break;
    case Action.PUT:
      documentId.push(req.params.id);
      break;
    case Action.DELETE:
      documentId.push(req.params.id);
      break;
  }

  return {name, documentId};
}

export function createStorageResource(action: Action, req: any, res: any): Resource {
  let name = "STORAGE";

  let documentId: string[] = [];
  switch (action) {
    case Action.POST:
      documentId = res.map(item => item._id.toString());
      break;
    case Action.PUT:
      documentId.push(req.params.id);
      break;
    case Action.DELETE:
      documentId.push(req.params.id);
      break;
  }

  return {name, documentId};
}

export function createPreferenceResource(action: Action, req: any, res: any): Resource {
  let name = "PREFERENCE";

  let documentId: string[] = req.params.scope;

  return {name, documentId};
}
