import {Pipe, PipeTransform} from "@angular/core";

@Pipe({name: "plaintext"})
export class PlaintextPipe implements PipeTransform {
  transform(value: string): any {
    if (value === null || value === "") {
      return false;
    } else {
      value = value.toString();
    }
    return value.replace(/<[^>]*>/g, " ");
  }
}
