import { PipeTransform } from '@nestjs/common';

/**
 * An pipe converts string to number
 * If the value is falsy 0 will be returned as default.
 */
export const NUMBER: PipeTransform<string, number> = {
    transform: (value) => {
        return Number(value || 0);
    }
}


export const JSONP: PipeTransform<string, object> = {
    transform: (value) => {
        if (value) {
            return global.JSON.parse(value)
        }
    }
}

export function JSONPV(reviver?: (this: any, key: string, value: any) => any): PipeTransform<string, object> {
    return {
        transform: (value) => {
            if (value) {
                return global.JSON.parse(value, reviver)
            }
        }
    }
}


export const BOOLEAN: PipeTransform<string, boolean> = {
    transform: (value) => {
        return Boolean(value);
    }
}