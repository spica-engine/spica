import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Observable} from "rxjs";

@Injectable()
export class VersionControlService {
  constructor(private http: HttpClient) {}

  getCommands(): Observable<string[]> {
    return this.http.get<any>("api:/versioncontrol/commands");
  }

  exec(command: string, args: string[]) {
    return this.http.post<{cmdResult: any; syncResult: any}>(
      `api:/versioncontrol/commands/${command}`,
      {args}
    );
  }
}
