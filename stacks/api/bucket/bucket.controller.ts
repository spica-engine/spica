import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Res,
  UseGuards
} from "@nestjs/common";
import {Bucket, BucketDocument, BucketService, ImportFile} from "@spica-server/bucket/services";
import {Schema} from "@spica-server/core/schema";
import {MongoError, ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard} from "@spica-server/passport";
import * as archiver from "archiver";
import * as fs from "fs";
import * as mime from "mime-types";
import * as request from "request";
import {BucketDataService} from "./bucket-data.service";

@Controller("bucket")
export class BucketController {
  constructor(private bs: BucketService, private bds: BucketDataService) {}

  @Get("templates")
  getTemplates() {
    return this.bs.findTemplates();
  }

  // TODO(thesayyn): Uncomment this method after service implementation
  // @Post("templates")
  // @UseGuards(AuthGuard(), ActionGuard("bucket:update"))
  // createFromTemplate(@Body() template) {
  //   this.bs.createFromTemplate(template).then(res => {
  //     console.log(res);
  //   });
  // }

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("bucket:index"))
  index() {
    return this.bs.find();
  }

  @Get("predefs")
  @UseGuards(AuthGuard(), ActionGuard("bucket:index"))
  getPredefinedDefaults() {
    return this.bs.getPredefinedDefaults();
  }

  @Post()
  @UseGuards(AuthGuard(), ActionGuard("bucket:update"))
  add(@Body(Schema.validate("http://spica.internal/bucket/schema")) bucket: Bucket) {
    return this.bs.insertOne(bucket).then(result => result.ops[0]);
  }

  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("bucket:update"))
  replaceOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/bucket/schema")) bucket: Bucket
  ) {
    if (bucket._id) delete bucket._id;
    return this.bs.replaceOne({_id: id}, bucket).then(result => result.value);
  }

  @Patch(":id")
  @UseGuards(AuthGuard(), ActionGuard("bucket:update"))
  updateOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Headers("content-type") contentType: string,
    @Body() changes: object
  ) {
    if (contentType != "application/merge-patch+json") {
      throw new BadRequestException(`Content type '${contentType}' is not supported.`);
    }
    return this.bs.updateOne({_id: id}, changes).then(result => result.value);
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("bucket:show"))
  async show(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.bs.findOne({_id: id});
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("bucket:delete"))
  deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.bs.findOne({_id: id}).then(bucket => this.bs.deleteOne(bucket));
  }

  @Post("import/:id")
  @UseGuards(AuthGuard(), ActionGuard("bucket:add"))
  async import(@Param("id") bucketId: string, @Body() file: ImportFile) {
    try {
      const result = {skippedDueToDuplication: 0, insertedToBucketCollection: 0};
      // TODO(tolga): Validate each row before adding them.
      const dataArray = JSON.parse(file.content.data.toString()) as Array<BucketDocument>;
      for (let data of dataArray) {
        data._id = new ObjectId(data._id);
        await this.bds.insertOne(bucketId, data).then(
          () => {
            result.insertedToBucketCollection = result.insertedToBucketCollection + 1;
          },
          (err: MongoError) => {
            if (err.code == 11000) {
              result.skippedDueToDuplication = result.skippedDueToDuplication + 1;
            }
          }
        );
      }

      return result;
    } catch (error) {
      throw new HttpException("Invalid JSON", HttpStatus.BAD_REQUEST);
    }
  }

  @Post("import-schema")
  @UseGuards(AuthGuard(), ActionGuard("bucket:add"))
  async importSchema(@Body() file: ImportFile) {
    try {
      const result = {skippedDueToDuplication: 0, insertedToBucket: 0};
      const data = JSON.parse(file.content.data.toString());

      data._id = new ObjectId(data._id);
      await this.bs.insertOne(data).then(
        () => {
          result.insertedToBucket = result.insertedToBucket + 1;
        },
        (err: MongoError) => {
          if (err.code == 11000) {
            result.skippedDueToDuplication = result.skippedDueToDuplication + 1;
          }
        }
      );

      return result;
    } catch (error) {
      throw new HttpException("Invalid JSON", HttpStatus.BAD_REQUEST);
    }
  }

  @Post("export")
  @UseGuards(AuthGuard(), ActionGuard("bucket:show"))
  async export(@Body() bucketIds: Array<string>, @Res() res) {
    const path = "./temp";
    const archiveName = Math.random()
      .toString(36)
      .substr(2, 9);

    if (!fs.existsSync(path)) {
      fs.mkdirSync(path);
    }

    const archive = archiver("zip", {
      zlib: {level: -1}
    });
    const outputArch = fs.createWriteStream(`${path}/${archiveName}.zip`);

    archive.pipe(outputArch);

    for (let id of bucketIds) {
      let storageFields = [];
      const bucket = await this.bs.findOne({_id: new ObjectId(id)});
      for (let propertyName in bucket.properties) {
        if (bucket.properties[propertyName].type === "storage") {
          storageFields.push(propertyName);
        }
      }

      const data = await this.bds.find(id);
      for (let row of data) {
        for (let storageFieldName of storageFields) {
          const response = await this.asyncFileRequest(row[storageFieldName]);
          if (response) {
            archive.append(response.body, {
              name: `assets/${row[storageFieldName].split("/").slice(-1)[0]}.${response.extension}`
            });
          }
        }

        const stringifiedData = JSON.stringify(data);
        archive.append(stringifiedData, {name: `${id}.json`});
      }
    }

    await archive.finalize();

    res.writeHead(200, {
      "Content-Type": "application/json"
    });

    fs.createReadStream(`${path}/${archiveName}.zip`)
      .pipe(res)
      .on("finish", function() {
        fs.unlinkSync(`${path}/${archiveName}.zip`);
      });
  }

  @Post("export-schema")
  @UseGuards(AuthGuard(), ActionGuard("bucket:show"))
  async exportSchema(@Body() bucketIds: Array<string>, @Res() res) {
    const path = "./temp";
    const archiveName = Math.random()
      .toString(36)
      .substr(2, 9);

    if (!fs.existsSync(path)) {
      fs.mkdirSync(path);
    }

    const archive = archiver("zip", {
      zlib: {level: -1}
    });
    const outputArch = fs.createWriteStream(`${path}/${archiveName}.zip`);

    archive.pipe(outputArch);

    for (let id of bucketIds) {
      const bucket = await this.bs.findOne({_id: new ObjectId(id)});

      const stringifiedData = JSON.stringify(bucket);
      archive.append(stringifiedData, {name: `${id}.json`});
    }

    await archive.finalize();

    res.writeHead(200, {
      "Content-Type": "application/json"
    });

    fs.createReadStream(`${path}/${archiveName}.zip`)
      .pipe(res)
      .on("finish", function() {
        fs.unlinkSync(`${path}/${archiveName}.zip`);
      });
  }

  private asyncFileRequest(url): any {
    return new Promise(function(resolve, reject) {
      request.defaults({encoding: null}).get(url, (err, res, body) => {
        if (res) {
          const extension = mime.extension(res.headers["content-type"]);
          resolve({extension: extension, body: body});
        } else {
          resolve(undefined);
        }
      });
    });
  }
}
