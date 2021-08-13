const qs = require("qs");

export function parseBody(raw: Uint8Array, contentTypeHeader: string | string[] = "") {
  if (contentTypeHeader == "application/json") {
    return JSON.parse(Buffer.from(raw).toString());
  } else if (contentTypeHeader == "application/x-www-form-urlencoded") {
    return qs.parse(Buffer.from(raw).toString());
  } else if ((contentTypeHeader as string).startsWith("multipart/form-data")) {
    return parseMultipartFormdata(Buffer.from(raw), contentTypeHeader as string);
  }
  return raw;
}

/**
 * Multipart Parser (Finite State Machine)
 * usage:
 * const multipart = require('./multipart.js');
 * const body = multipart.DemoData(); 							   // raw body
 * const body = Buffer.from(event['body-json'].toString(),'base64'); // AWS case
 * const boundary = multipart.getBoundary(event.params.header['content-type']);
 * const parts = multipart.Parse(body,boundary);
 * each part is:
 * { filename: 'A.txt', type: 'text/plain', data: <Buffer 41 41 41 41 42 42 42 42> }
 *  or { name: 'key', data: <Buffer 41 41 41 41 42 42 42 42> }
 */

export function parseMultipartFormdata(multipartBodyBuffer: Buffer, contentTypeHeader: string) {
  //  read the boundary from the content-type header sent by the http client
  //  this value may be similar to:
  //  'multipart/form-data; boundary=----WebKitFormBoundaryvm5A9tzU1ONaGP5B',
  const getBoundary = header => {
    const items = header.split(";");
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = new String(items[i]).trim();
        if (item.indexOf("boundary") >= 0) {
          const k = item.split("=");
          return new String(k[1]).trim();
        }
      }
    }
    return "";
  };

  const process = part => {
    // will transform this object:
    // { header: 'Content-Disposition: form-data; name="uploads[]"; filename="A.txt"',
    // info: 'Content-Type: text/plain',
    // part: 'AAAABBBB' }
    // into this one:
    // { filename: 'A.txt', type: 'text/plain', data: <Buffer 41 41 41 41 42 42 42 42> }
    const obj = str => {
      const k = str.split("=");
      const a = k[0].trim();

      const b = JSON.parse(k[1].trim());
      const o = {};
      Object.defineProperty(o, a, {
        value: b,
        writable: true,
        enumerable: true,
        configurable: true
      });
      return o;
    };
    const header = part.header.split(";");

    const filenameData = header[2];
    let input = {};
    if (filenameData) {
      input = obj(filenameData);
      const contentType = part.info.split(":")[1].trim();
      Object.defineProperty(input, "type", {
        value: contentType,
        writable: true,
        enumerable: true,
        configurable: true
      });
    } else {
      Object.defineProperty(input, "name", {
        value: header[1].split("=")[1].replace(/"/g, ""),
        writable: true,
        enumerable: true,
        configurable: true
      });
    }

    Object.defineProperty(input, "data", {
      value: Buffer.from(part.part),
      writable: true,
      enumerable: true,
      configurable: true
    });
    return input;
  };

  const boundary = getBoundary(contentTypeHeader);

  let lastline = "";
  let header = "";
  let info = "";
  let state = 0;
  let buffer = [];
  const allParts = [];

  for (let i = 0; i < multipartBodyBuffer.length; i++) {
    const oneByte = multipartBodyBuffer[i];
    const prevByte = i > 0 ? multipartBodyBuffer[i - 1] : null;
    const newLineDetected = oneByte === 0x0a && prevByte === 0x0d ? true : false;
    const newLineChar = oneByte === 0x0a || oneByte === 0x0d ? true : false;

    if (!newLineChar) lastline += String.fromCharCode(oneByte);

    if (0 === state && newLineDetected) {
      if ("--" + boundary === lastline) {
        state = 1;
      }
      lastline = "";
    } else if (1 === state && newLineDetected) {
      header = lastline;
      state = 2;
      if (header.indexOf("filename") === -1) {
        state = 3;
      }
      lastline = "";
    } else if (2 === state && newLineDetected) {
      info = lastline;
      state = 3;
      lastline = "";
    } else if (3 === state && newLineDetected) {
      state = 4;
      buffer = [];
      lastline = "";
    } else if (4 === state) {
      if (lastline.length > boundary.length + 4) lastline = ""; // mem save
      if ("--" + boundary === lastline) {
        const j = buffer.length - lastline.length;
        const part = buffer.slice(0, j - 1);
        const p = {header: header, info: info, part: part};

        allParts.push(process(p));
        buffer = [];
        lastline = "";
        state = 5;
        header = "";
        info = "";
      } else {
        buffer.push(oneByte);
      }
      if (newLineDetected) lastline = "";
    } else if (5 === state) {
      if (newLineDetected) state = 1;
    }
  }
  return allParts;
}
