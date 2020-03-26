import {Pipe, PipeTransform, Injectable} from "@angular/core";

@Injectable()
@Pipe({name: "toDate"})
export class ObjectIdToDatePipe implements PipeTransform {
  transform(value: string): Date {
    const timestamp = value.substring(0, 8);
    return new Date(parseInt(timestamp, 16) * 1000);
  }
}
