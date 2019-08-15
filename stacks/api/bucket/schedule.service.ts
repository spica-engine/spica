import { Injectable } from "@nestjs/common";
import { MongoClient } from "@spica-server/database";

@Injectable()
export class DocumentSheduler {

  constructor(database: MongoClient)   {
    database.watch([])
  }
}