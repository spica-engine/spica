import { ValidationError as _ValidationError, Validator, ErrorObject } from "@spica-server/core/schema";
import { Resource } from "./definition";
import { getVersionFromScheme, Scheme } from "./scheme";
import { badRequest } from "./status";

export interface ValidationOptions {scheme: Scheme, versionName: string, object: Resource<object, unknown>}

export interface DataError {
    path: string;
    message: string;
}

export async function validate({object, scheme, versionName}: ValidationOptions): Promise<void> {
    const version = getVersionFromScheme(scheme, versionName);
    const validator = new Validator({schemas: version.additionalSchemas});
    try {
        await validator.validate(version.schema, object.spec);
    } catch (e) {
        if ( e instanceof _ValidationError ) {
        
            throw badRequest({
                message: e.message,
                reason: 'Invalid',
                details: {
                    errors: e.errors.map(mapErrorObjectToDataError)
                }
            })
        }

        throw badRequest({
            message: e.message,
            reason: 'Invalid',
            details: {
                error: e,
                params: e.constructor.name
            }
        })
    }
}

function mapErrorObjectToDataError(error: ErrorObject): DataError {
    const path = `.spec${error.dataPath.replace(/\//g, ".")}`;
    let message: string = error.message;

    switch (error.keyword) {
        case "enum":
            message = `${message} (${error.params.allowedValues.join(", ")})`; 
            break;
        default:
            break;
    }

    return {
        path,
        message
    }
}