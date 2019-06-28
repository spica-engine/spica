import {Pipe, PipeTransform} from "@angular/core";

@Pipe({name: "concat"})
export class ConcatPipe implements PipeTransform {
  transform(value: any, ...arr: any[]): any {
    if (!value) {
      return value;
    }
    return value.concat(...arr);
  }
}
