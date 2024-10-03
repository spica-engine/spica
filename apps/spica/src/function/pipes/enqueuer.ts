import {Pipe, PipeTransform} from "@angular/core";
import {Enqueuer} from "../interface";

@Pipe({
  name: "enqueuer"
})
export class EnqueuerPipe implements PipeTransform {
  transform(enqueuers: Enqueuer[], name: string) {
    if (Array.isArray(enqueuers)) {
      return enqueuers.find(e => e.description.name == name);
    }
    return null;
  }
}
