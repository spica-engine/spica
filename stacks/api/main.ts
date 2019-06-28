import {NestFactory} from "@nestjs/core";
import {AppModule} from "./app.module";
import {Middlewares} from "@spica-server/core";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(Middlewares.BsonBodyParser, Middlewares.Preflight);
  await app.listen(process.env.PORT);
}
bootstrap();
