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
    // will trigger ENOENT error on file removals
    fs.rmSync(req.body[0].path);
    return "OK";
  }
}

describe("Body Parsers", () => {
  let req: Request;
  let app: INestApplication;
  let tmpFolder = path.join(process.env.TEST_TMPDIR, "tmp_files");

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
            defaultPath: tmpFolder
          }
        }
      ]
    }).compile();

    req = module.get(Request);
    app = module.createNestApplication();

    await app.listen(req.socket);
  });

  describe("MultipartFormDataParser", () => {
    let files = Array(100).fill({
      name: "file.txt",
      data: "My File",
      type: "text/plain"
    });

    describe("cleanup", () => {
      it("should remove tmp files for arrays", async () => {
        const {body, headers} = getMultipartFormDataMeta(files, "post");

        const response = await req.post("/storage/succeeded", body, headers);
        expect(response.statusCode).toEqual(201);

        const tmpFiles = fs.readdirSync(tmpFolder);
        expect(tmpFiles).toEqual([]);
      });

      it("should remove tmp files for single file", async () => {
        const {body, headers} = getMultipartFormDataMeta([files[0]], "put");

        const response = await req.put("/storage/succeeded", body, headers);
        expect(response.statusCode).toEqual(200);

        const tmpFiles = fs.readdirSync(tmpFolder);
        expect(tmpFiles).toEqual([]);
      });

      it("should remove all files even if error occurred", async () => {
        const {body, headers} = getMultipartFormDataMeta(files, "post");

        const response = await req.post("/storage/failed", body, headers);
        expect(response.statusCode).toEqual(201);
        const tmpFiles = fs.readdirSync(tmpFolder);
        expect(tmpFiles).toEqual([]);
      });
    });
  });
});
