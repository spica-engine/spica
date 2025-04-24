import {BatchRequest, BatchResponse, ManyResponse} from "./interface";

export namespace Batch {
  export function prepareInsertRequest<T>(
    resources: T[],
    url: string,
    auth: string,
    headers?: object
  ): BatchRequest<T> {
    return {
      requests: resources.map((resource, i) => {
        headers = addAuthHeader(headers, auth);
        return {
          id: i.toString(),
          body: resource,
          method: "POST",
          url: url,
          headers: headers
        };
      })
    };
  }

  export function prepareRemoveRequest<T extends undefined>(
    ids: string[],
    url: string,
    auth: string,
    headers?: object
  ): BatchRequest<T> {
    return {
      requests: ids.map((id, i) => {
        headers = addAuthHeader(headers, auth);
        return {
          id: i.toString(),
          body: undefined,
          method: "DELETE",
          url: `${url}/${id}`,
          headers: headers
        };
      })
    };
  }

  export function handleBatchResponse<P, R = P>(
    {requests}: BatchRequest<P>,
    {responses}: BatchResponse<P>
  ): ManyResponse<P, R> {
    const sortById = (a, b) => Number(a.id) - Number(b.id);

    const successResponses = responses
      .sort(sortById)
      .filter(r => r.status >= 200 && r.status < 300);
    const failureResponses = responses
      .sort(sortById)
      .filter(r => r.status >= 400 && r.status <= 500);

    const successes = successResponses.map(sr => {
      const req = requests.find(r => r.id == sr.id);
      return {
        request: (req.body || req.url) as P,
        response: sr.body as unknown as R
      };
    });

    const failures = failureResponses.map(fr => {
      const req = requests.find(r => r.id == fr.id);

      return {
        request: (req.body || req.url) as P,
        response: {
          error: fr.body["error"],
          message: fr.body["message"]
        }
      };
    });

    return {
      successes,
      failures
    };
  }
}

function addAuthHeader(headers: object, auth: string) {
  headers = headers || {};
  headers["Authorization"] = auth;
  return headers;
}
