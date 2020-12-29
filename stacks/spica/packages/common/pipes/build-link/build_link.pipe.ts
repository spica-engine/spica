import {Injectable, Pipe, PipeTransform, Inject} from "@angular/core";
import {ACTIVITY_FACTORY} from "@spica-client/core/factories/factory";
@Injectable()
@Pipe({
  name: "buildLink",
  pure: true
})
export class BuildLinkPipe implements PipeTransform {
  constructor(@Inject(ACTIVITY_FACTORY) private factories: Function[]) {}
  transform(value: any) {
    if (value.action == 3) return;

    let url = this.factories.map(fn => fn(value)).find(url => !!url);
    if (!url) return;

    return `../${url}`;
  }
}
