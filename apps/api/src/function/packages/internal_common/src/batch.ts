import {BatchRequest, BatchResponse, ManyResponse, RequestMethods} from "./interface";

export namespace Batch {
  export function prepareInsertRequest<T>(
    payloads: T[],
    url: string,
    auth: string,
    headers?: object
  ): BatchRequest<T> {
    return {
      requests: payloads.map((payload, i) => {
        headers = addAuthHeader(headers, auth);
        return {
          id: i.toString(),
          body: payload,
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

  export function handleBatchResponse<P, R>(
    {requests}: BatchRequest<P>,
    {responses}: BatchResponse<P>
  ): ManyResponse<P, R> {
    const successResponses = responses.filter(r => r.status >= 200 && r.status < 300);
    const failureResponses = responses.filter(r => r.status >= 400 && r.status <= 500);

    const successes = successResponses.map(sr => {
      const payload = requests.find(br => br.id == sr.id).body;
      return {
        payload,
        response: sr.body
      };
    });

    const failures = failureResponses.map(fr => {
      const payload = requests.find(br => br.id == fr.id).body;

      return {
        payload,
        response: {
          error: fr.body["error"],
          message: fr.body["message"]
        }
      };
    });

    return {
      // @ts-ignore, return back here!
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
