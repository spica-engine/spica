import { Action, CaporalValidator, Command, CreateCommandParameters } from "@caporal/core";
import { ActionParameters } from "../interface";
import * as YAML from "yaml";
import * as fs from "fs";
import * as path from "path";
import { request } from "../request";
import { Resource, ResourceDefinition } from "./api-resources";
import { formatFailureStatus, isFailureStatus, isStatusKind } from "../status";

async function apply({args, logger, options}: ActionParameters) {
    const filename = path.normalize(options.filename as string);
    const documents = YAML.parseAllDocuments(fs.readFileSync(filename).toString());

    for (const document of documents) {
        const {apiVersion, kind, metadata, spec} = document.toJSON();

        const resourceList = await request.get<any>(`http://localhost:4300/apis/${apiVersion}`);

        let resource;

        for (const _resource of resourceList.resources) {
          if ( _resource.kind == kind) {
            resource = _resource;
          }
        }
        
        if ( !resource ) {
          return logger.error(`the server doesn't have a resource type "${kind}"`);
        } 
    

        if ( apiVersion == "function/v1" ) {
          const basePath = path.dirname(filename);
          spec.code = fs.readFileSync(path.resolve(basePath, spec.code)).toString();
        } 
        
        let result = await request.post(`http://localhost:4300/apis/${apiVersion}/${resource.plural}`, {metadata, spec}); 

        let type: string = "created";

        if ( isFailureStatus(result) && result.reason == "AlreadyExists" ) {

          const upstream  = await request.get<Resource>(`http://localhost:4300/apis/${apiVersion}/${resource.plural}/${metadata.name}`); 

          if ( JSON.stringify(upstream.spec) == JSON.stringify(spec) ) {
            type = "up-to date"
            result = {};
          } else {
            result = await request.put(`http://localhost:4300/apis/${apiVersion}/${resource.plural}/${metadata.name}`, {metadata, spec}); 
            type = "replaced";
          }
        }

        if ( isFailureStatus(result) ) {
          return logger.error(formatFailureStatus(result));
        }

        logger.info(`${apiVersion} "${metadata.name}" ${type}.`);
    }
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Get an object from the API.")
    .option("-f, --filename", "that contains the configuration to apply", {
        required: true,
        validator: CaporalValidator.STRING
    })
    .action((apply as unknown) as Action);
}
