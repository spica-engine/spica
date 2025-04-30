import {Controller, INestApplication, Post, Put, Req, UseInterceptors} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {STORAGE_OPTIONS} from "@spica-server/interface/storage";
import {MultipartFormDataParser, getMultipartFormDataMeta} from "@spica-server/storage";
import path from "path";
import fs from "fs";

@Controller("storage")
export class Storage {
  @UseInterceptors(MultipartFormDataParser({isArray: true}))
  @Post("succeeded")
  uploadManySucceeded() {
    return "OK";
  }

  @UseInterceptors(MultipartFormDataParser({isArray: false}))
  @Put("succeeded")
  uploadOneSucceeded() {
    return "OK";
  }

  @UseInterceptors(MultipartFormDataParser({isArray: true}))
  @Post("failed")
  uploadManyFailed(@Req() req) {
    fs.rmSync(req.body[0].path);
    return "OK";
  }

  @UseInterceptors(MultipartFormDataParser({isArray: false}))
  @Put("succeeded")
  uploadOneFailed() {
    return "OK";
  }
}

describe("Body Parsers", () => {
  let req: Request;
  let app: INestApplication;
  let tmpFileDest = path.join(process.env.TEST_TMPDIR, "tmp_files");

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [CoreTestingModule],
      controllers: [Storage],
      providers: [
        {
          provide: STORAGE_OPTIONS,
          useValue: {
            strategy: "default",
            objectSizeLimit: 10,
            defaultPath: tmpFileDest
          }
        }
      ]
    }).compile();

    req = module.get(Request);
    app = module.createNestApplication();

    await app.listen(req.socket);
  });

  describe("MultipartFormDataParser", () => {
    let body;
    let headers;

    describe("array", () => {
      beforeEach(() => {
        const meta = getMultipartFormDataMeta(
          [
            {
              name: "file.txt",
              data: "My File",
              type: "text/plain"
            },
            {
              name: "file2.txt",
              data: "My File 2",
              type: "text/plain"
            }
          ],
          "post"
        );
        body = meta.body;
        headers = meta.headers;
      });

      // it("should remove tmp files", async () => {
      //   await req.post("/storage/succeeded", body, headers);
      //   const tmpFile = fs.readdirSync(tmpFileDest);
      //   expect(tmpFile).toEqual([]);
      // });

      fit("should remove all files even if ", async () => {
        await req.post("/storage/failed", body, headers);
        const tmpFile = fs.readdirSync(tmpFileDest);
        expect(tmpFile).toEqual([]);
      });
    });

    // describe("single", () => {
    //   beforeEach(() => {
    //     const meta = getMultipartFormDataMeta(
    //       [
    //         {
    //           name: "file.txt",
    //           data: "My File",
    //           type: "text/plain"
    //         }
    //       ],
    //       "put"
    //     );
    //     body = meta.body;
    //     headers = meta.headers;
    //   });

    //   it("should remove tmp files", async () => {
    //     await req.put("/storage", body, headers);
    //     const tmpFile = fs.readdirSync(tmpFileDest);
    //     expect(tmpFile).toEqual([]);
    //   });
    // });
  });
});
