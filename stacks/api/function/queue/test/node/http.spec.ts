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

    it("should writeHead", () => {
      response.writeHead(200, "OK");
      expect(writeHeadSpy).toHaveBeenCalledTimes(1);
      const [writeHead] = writeHeadSpy.calls.mostRecent().args as [Http.WriteHead];
      expect(writeHead.statusCode).toBe(200);
      expect(writeHead.statusMessage).toBe("OK");
    });
  });
});
