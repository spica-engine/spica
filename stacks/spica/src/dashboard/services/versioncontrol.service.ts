import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";

@Injectable()
export class VersionControlService {
  constructor(private http: HttpClient) {}

  getLastSave() {
    return this.http.get("api:/versioncontrol/save", {});
  }

  save() {
    return this.http.post("api:/versioncontrol/save", {});
  }

  getCommands() {
    return this.http.get("api:/versioncontrol/commands");
  }

  run(command: string, options: any) {
    return this.http.post(`api:/versioncontrol/commands/${command}`, options);
  }
}
