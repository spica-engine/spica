import {Injectable, Pipe, PipeTransform, Inject} from "@angular/core";
import {BuildLinkFactories} from "./interface";
import {BUILDLINK_FACTORY} from "@spica-client/core/factories/factory";

@Injectable()
@Pipe({
  name: "buildLink",
  pure: true
})
export class BuildLinkPipe implements PipeTransform {
  constructor(@Inject(BUILDLINK_FACTORY) private factories: BuildLinkFactories[]) {}
  transform(value: any, caller: string) {
    let url = this.factories
      .filter(f => f.caller == caller)
      .map(f => f.factory(value))
      .find(url => !!url);

    if (!url) {
      return;
    }

    return url;
  }
}
