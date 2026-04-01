import {Module} from "@nestjs/common";
import {PipelineBuilder} from "./builder.js";

@Module({providers: [PipelineBuilder], exports: [PipelineBuilder]})
export class PipelineModule {}
