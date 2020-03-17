import {NestFactory} from "@nestjs/core";
import {Middlewares} from "@spica-server/core";
import {AppModule} from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(Middlewares.BsonBodyParser, Middlewares.MergePatchJsonParser, Middlewares.Preflight);
  await app.listen(process.env.PORT);
}
bootstrap();
