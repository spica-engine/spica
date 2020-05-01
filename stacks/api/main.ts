import {NestFactory} from "@nestjs/core";
import {Middlewares} from "@spica-server/core";
import * as fs from "fs";
import * as https from "https";
import {AppModule} from "./app.module";

async function bootstrap() {
  let httpsOptions: https.ServerOptions;

  if (process.env.TLS_KEY_PATH && process.env.TLS_CERT_PATH) {
    httpsOptions = {
      key: fs.readFileSync(process.env.TLS_KEY_PATH),
      cert: fs.readFileSync(process.env.TLS_CERT_PATH)
    };
  }

  const app = await NestFactory.create(AppModule, {
    httpsOptions
  });
  app.use(Middlewares.BsonBodyParser, Middlewares.MergePatchJsonParser, Middlewares.Preflight);
  await app.listen(process.env.PORT);
}
bootstrap();
