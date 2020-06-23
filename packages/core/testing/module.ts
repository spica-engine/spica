import {Module} from "@nestjs/common";
import {Request} from "./request";
import {Websocket} from "./websocket";
import * as fs from "fs";
import * as path from "path";

@Module({
  providers: [
    Request,
    Websocket,
    {
      provide: "SOCKET",
      useFactory: () =>
        path.join(
          path.relative(process.cwd(), process.env.TEST_TMPDIR),
          fs.mkdtempSync("test-") + ".sock"
        )
    }
  ],
  exports: [Request, Websocket]
})
export class CoreTestingModule {}
