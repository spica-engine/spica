import {NestFactory} from "@nestjs/core";
import {ExpressAdapter} from "@nestjs/platform-express";
import {Middlewares} from "@spica-server/core";
import * as express from "express";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import {AppModule} from "./app.module";

async function bootstrap() {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  app.use(Middlewares.BsonBodyParser, Middlewares.MergePatchJsonParser, Middlewares.Preflight);
  await app.init();
  http.createServer(server).listen(process.env.PORT);

  if (process.env.HTTPS_PORT) {
    const httpsOptions: https.ServerOptions = {
      key: fs.readFileSync(process.env.TLS_KEY_PATH),
      cert: fs.readFileSync(process.env.TLS_CERT_PATH)
    };

    https.createServer(httpsOptions, server).listen(process.env.HTTPS_PORT);
  }
}
bootstrap();
