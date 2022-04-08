import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Observable} from "rxjs";

@Injectable()
export class VersionControlService {
  constructor(private http: HttpClient) {}

  getLastSave() {
    return this.http.get("api:/versioncontrol/save", {});
  }

  save() {
    return this.http.post("api:/versioncontrol/save", {});
  }

  getCommands(): Observable<{
    [command: string]: {
      type: string;
      items?: {
        type: string;
      };
    };
  }> {
    return this.http.get<any>("api:/versioncontrol/commands");
  }

  exec(command: string, args: string[]) {
    return this.http.post<{cmdResult: any; syncResult: any}>(
      `api:/versioncontrol/commands/${command}`,
      {args}
    );
  }
}
