import {Module} from "@nestjs/common";
import {Request} from "./request";
import {Websocket} from "./websocket";
import fs from "fs";
import path from "path";

@Module({
  providers: [
    Request,
    Websocket,
    {
      provide: "SOCKET",
      useFactory: () => fs.mkdtempSync(path.join(process.env.TEST_TMPDIR, "test-")) + ".sock"
    }
  ],
  exports: [Request, Websocket]
})
export class CoreTestingModule {}
