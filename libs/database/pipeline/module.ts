import {Module} from "@nestjs/common";
import {PipelineBuilder} from "./builder";

@Module({providers: [PipelineBuilder], exports: [PipelineBuilder]})
export class PipelineModule {}
