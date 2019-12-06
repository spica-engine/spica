import { Http } from "@spica-server/function/queue/proto";
import * as grpc from "grpc";

export class HttpQueue {
  private client: any;

  constructor() {
    this.client = new Http.QueueClient("0.0.0.0:5678", grpc.credentials.createInsecure());
  }

  end(e: Http.End): Promise<Http.End.Result> {
    return new Promise((resolve, reject) => {
      this.client.end(e, (error, event) => {
        if (error) {
          reject(error.details);
        } else {
          resolve(event);
        }
      });
    });
  }

  write(e: Http.Write): Promise<Http.Write.Result> {
    return new Promise((resolve, reject) => {
      this.client.write(e, (error, event) => {
        if (error) {
          reject(error);
        } else {
          resolve(event);
        }
      });
    });
  }

  writeHead(e: Http.WriteHead): Promise<Http.WriteHead.Result> {
    return new Promise((resolve, reject) => {
      this.client.writeHead(e, (error, event) => {
        if (error) {
          reject(error);
        } else {
          resolve(event);
        }
      });
    });
  }

  pop(e: Http.Request.Pop): Promise<Http.Request> {
    return new Promise((resolve, reject) => {
      this.client.pop(e, (error, event) => {
        if (error) {
          reject(new Error(error.details));
        } else {
          resolve(event);
        }
      });
    });
  }
}

export class Request {
  statusCode: number;
  statusMessage: string;
  method: string;
  url: string;
  path: string;
  headers = new Map<string, string | string[]>();
  query = new Map<string, string>();
  params = new Map<string, string>();
  cookies = new Map<string, string>();
  body: undefined | object;

  constructor(req: Http.Request) {
    this.statusCode = req.statusCode;
    this.statusMessage = req.statusMessage;
    this.method = req.method;
    this.url = req.url;
    this.path = req.path;

    if (req.headers) {
      this.headers = new Map(req.headers.map(h => [h.key, h.value]));
    }

    if (req.params) {
      this.params = new Map(req.params.map(h => [h.key, h.value]));
    }

    if (req.body) {
      // TODO: parse body
    }
  }
}

export class Response {
  statusCode: number;

  headersSent: boolean = false;

  constructor(
    private _writeHead: (e: Http.WriteHead) => void,
    private _write: (e: Http.Write) => void,
    private _end: (e: Http.End) => void
  ) {}

  send(body: Buffer | Array<any> | object | string) {
    console.log("CALLED");
    let type: string;
    let chunk: Buffer;
    if (Buffer.isBuffer(body)) {
      type = "application/octet-stream";
      chunk = body;
    } else if (Array.isArray(body) || typeof body == "object") {
      type = "application/json";
      chunk = Buffer.from(JSON.stringify(body));
    } else {
      type = "text/html";
      chunk = Buffer.from(body);
    }
    this.writeHead(200, "OK", {"Content-type": type});
    console.log("dwefwfwewfew");
    this.end(chunk, "utf-8");
    console.log("end");
  }

  write(chunk: string | Buffer, encoding?: BufferEncoding) {
    const write = new Http.Write();
    write.encoding = encoding;
    write.data = new Uint8Array(chunk instanceof Buffer ? chunk : Buffer.from(chunk, encoding));
    this._write(write);
  }

  writeHead(statusCode: number, statusMessage?: string, headers?: object) {
    if (this.headersSent) {
      throw new Error("Headers already sent");
    }
    const writeHead = new Http.WriteHead();
    writeHead.statusCode = statusCode;
    writeHead.statusMessage = statusMessage;
    if (headers) {
      writeHead.headers = Object.entries(headers).map(([k, v]) => {
        const header = new Http.Header();
        header.key = k;
        header.value = v;
        return header;
      });
    }
    this._writeHead(writeHead);
    this.headersSent = true;
  }

  end(data: string | Buffer, encoding?: BufferEncoding) {
    const end = new Http.End();
    end.encoding = encoding;
    end.data = new Uint8Array(data instanceof Buffer ? data : Buffer.from(data, encoding));
    this._end(end);
  }
}
