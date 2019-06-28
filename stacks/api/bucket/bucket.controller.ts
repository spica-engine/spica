import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards
} from "@nestjs/common";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard} from "@spica-server/passport";
import * as archiver from "archiver";
import * as fs from "fs";
import {Bucket, BucketEntry, ImportFile} from "./bucket";
import {BucketDataService} from "./bucket-data.service";
import {BucketService} from "./bucket.service";

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
    bucket._id = new ObjectId(bucket._id);
    return this.bs.replaceOne(bucket).then(() => bucket);
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
  import(@Param("id") bucketId: string, @Body() file: ImportFile) {
    try {
      // TODO(tolga): Validate each row before adding them.
      const dataArray = JSON.parse(file.content.data.toString()) as Array<BucketEntry>;
      dataArray.forEach(data => {
        this.bds.insertOne(bucketId, data as BucketEntry);
      });
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

    await Promise.all(
      bucketIds.map(async id => {
        await this.bds.find(id).then(data => {
          const stringifiedData = JSON.stringify(data);
          archive.append(stringifiedData, {name: `${id}.json`});
        });
      })
    );

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
}
