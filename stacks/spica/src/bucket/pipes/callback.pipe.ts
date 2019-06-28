import {Pipe, PipeTransform} from "@angular/core";

@Pipe({name: "callback"})
export class CallbackPipe implements PipeTransform {
  transform(value: any, method: string, callback: (value: any) => any): any {
    if (!value || !callback) {
      return value;
    }
    return value[method](item => callback(item));
  }
}
