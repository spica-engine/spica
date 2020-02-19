import {Request, Response} from "@spica-server/function/queue/node";
import {Http} from "@spica-server/function/queue/proto";

describe("Http", () => {
  describe("Request", () => {
    it("should map headers", () => {
      const req = new Http.Request();
      const header = new Http.Header();
      header.key = "test";
      header.value = "test";
      req.headers = [header];
      // We test integrity of the data here. leave it as is.
      const r = Http.Request.deserialize(req.serialize());
      const request = new Request(r);
      expect(request.headers.get("test")).toBe("test");
    });

    it("should map params", () => {
      const req = new Http.Request();
      const param = new Http.Param();
      param.key = "test";
      param.value = "test";
      req.params = [param];
      const request = new Request(req);
      expect(request.params.get("test")).toBe("test");
    });

    it("should set body as UInt8Array", () => {
      const req = new Http.Request();
      req.body = new Uint8Array([0x2, 0x3]);
      const param = new Http.Param();
      param.key = "test";
      param.value = "test";
      req.params = [param];
      const request = new Request(req);
      expect(Array.from(request.body)).toEqual([0x2, 0x3]);
      expect(request.params.get("test")).toBe("test");
    });

    it("should set statusCode, statusMessage, url, method and path", () => {
      const req = new Http.Request();
      req.statusCode = 101;
      req.statusMessage = "test";
      req.path = "/test";
      req.url = "/test?query=1";
      req.method = "POST";
      const request = new Request(req);
      expect(request.statusMessage).toBe(req.statusMessage);
      expect(request.statusCode).toBe(req.statusCode);
      expect(request.method).toBe(req.method);
      expect(request.path).toBe(req.path);
      expect(request.url).toBe(req.url);
    });
  });

  describe("Response", () => {
    let writeHeadSpy: jasmine.Spy;
    let writeSpy: jasmine.Spy;
    let endSpy: jasmine.Spy;
    let response: Response;

    beforeEach(() => {
      writeHeadSpy = jasmine.createSpy("writeHeadSpy");
      writeSpy = jasmine.createSpy("writeHeadSpy");
      endSpy = jasmine.createSpy("end");
      response = new Response(writeHeadSpy, writeSpy, endSpy);
    });

    it("should write", () => {
      response.write("test");
      expect(writeSpy).toHaveBeenCalledTimes(1);
      const [write] = writeSpy.calls.mostRecent().args as [Http.Write];
      expect(write.data instanceof Uint8Array).toBe(true);
      expect(write.encoding).toBe(undefined);
    });

    describe("writeHead", () => {
      it("should call the callback", () => {
        response.writeHead(200, "OK");
        expect(writeHeadSpy).toHaveBeenCalledTimes(1);
        const [writeHead] = writeHeadSpy.calls.mostRecent().args as [Http.WriteHead];
        expect(writeHead.statusCode).toBe(200);
        expect(writeHead.statusMessage).toBe("OK");
      });

      it("should throw an error if it was called already", () => {
        response.writeHead(200, "OK", {"Content-type": "application/bson"});
        expect(writeHeadSpy).toHaveBeenCalledTimes(1);
        expect(() => response.writeHead(200, "OK")).toThrowError("Headers already sent");
      });
    });

    describe("send", () => {
      it("should send boolean as string", () => {
        const writeHeadSpy = spyOn(response, "writeHead").and.callThrough();
        const endSpy = spyOn(response, "end").and.callThrough();
        response.send(true);

        expect(writeHeadSpy).toHaveBeenCalledTimes(1);
        expect(writeHeadSpy).toHaveBeenCalledWith(200, "OK", {
          "Content-type": "text/html",
          "Content-length": "4"
        });
        expect(endSpy).toHaveBeenCalledTimes(1);
        const [bodyBuffer, encoding] = endSpy.calls.argsFor(0);
        expect(bodyBuffer.toString()).toBe("true");
        expect(encoding).toBe("utf-8");
      });

      it("should send number as string", () => {
        const writeHeadSpy = spyOn(response, "writeHead").and.callThrough();
        const endSpy = spyOn(response, "end").and.callThrough();
        response.send(12345);

        expect(writeHeadSpy).toHaveBeenCalledTimes(1);
        expect(writeHeadSpy).toHaveBeenCalledWith(200, "OK", {
          "Content-type": "text/html",
          "Content-length": "5"
        });
        expect(endSpy).toHaveBeenCalledTimes(1);
        const [bodyBuffer, encoding] = endSpy.calls.argsFor(0);
        expect(bodyBuffer.toString()).toBe("12345");
        expect(encoding).toBe("utf-8");
      });

      it("should send object as json", () => {
        const writeHeadSpy = spyOn(response, "writeHead").and.callThrough();
        const endSpy = spyOn(response, "end").and.callThrough();
        response.send({
          "some.key": 1,
          subobject: {}
        });

        expect(writeHeadSpy).toHaveBeenCalledTimes(1);
        expect(writeHeadSpy).toHaveBeenCalledWith(200, "OK", {
          "Content-type": "application/json",
          "Content-length": "29"
        });
        expect(endSpy).toHaveBeenCalledTimes(1);
        const [bodyBuffer, encoding] = endSpy.calls.argsFor(0);
        expect(bodyBuffer.toString()).toBe(`{"some.key":1,"subobject":{}}`);
        expect(encoding).toBe("utf-8");
      });

      it("should send array as json", () => {
        const writeHeadSpy = spyOn(response, "writeHead").and.callThrough();
        const endSpy = spyOn(response, "end").and.callThrough();
        response.send([
          {
            test: 1
          },
          true,
          "test"
        ]);

        expect(writeHeadSpy).toHaveBeenCalledTimes(1);
        expect(writeHeadSpy).toHaveBeenCalledWith(200, "OK", {
          "Content-type": "application/json",
          "Content-length": "24"
        });
        expect(endSpy).toHaveBeenCalledTimes(1);
        const [bodyBuffer, encoding] = endSpy.calls.argsFor(0);
        expect(bodyBuffer.toString()).toBe(`[{"test":1},true,"test"]`);
        expect(encoding).toBe("utf-8");
      });

      it("should send buffer as octet-stream", () => {
        const writeHeadSpy = spyOn(response, "writeHead").and.callThrough();
        const endSpy = spyOn(response, "end").and.callThrough();
        response.send(Buffer.from("test"));

        expect(writeHeadSpy).toHaveBeenCalledTimes(1);
        expect(writeHeadSpy).toHaveBeenCalledWith(200, "OK", {
          "Content-type": "application/octet-stream",
          "Content-length": "4"
        });
        expect(endSpy).toHaveBeenCalledTimes(1);
        const [bodyBuffer, encoding] = endSpy.calls.argsFor(0);
        expect(bodyBuffer.toString()).toBe(`test`);
        expect(encoding).toBe("utf-8");
      });
    });
  });
});
