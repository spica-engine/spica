import {BatchOptions, HTTPResponse, Request, Response} from "../../../../../libs/interface/batch";

export function handleResponse(request: Request, response: HTTPResponse): Response {
  return {
    id: request.id,
    status: response.status,
    headers: response.headers,
    body: response.body
  };
}

export function splitIntoChunks<T>(items: T[], limit: number) {
  let chunks: T[][] = [];
  if (limit > 0) {
    while (items.length) {
      chunks.push(items.splice(0, limit));
    }
  } else {
    chunks = [items];
  }

  return chunks;
}

export function getBaseUrl(req, options: BatchOptions) {
  return `${req.protocol}://localhost:${options.port}`;
}
