import {Pipe, PipeTransform} from "@angular/core";

@Pipe({
  name: "map"
})
export class MapPipe implements PipeTransform {
  transform(value: object[] = [], field: string) {
    return value.map(v => v[field]);
  }
}
