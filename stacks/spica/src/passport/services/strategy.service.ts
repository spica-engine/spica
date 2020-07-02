import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Strategy} from "../interfaces/strategy";

@Injectable({providedIn: "root"})
export class StrategyService {
  constructor(private http: HttpClient) {}

  getStrategies() {
    return this.http.get<Strategy[]>("api:/passport/strategy");
  }

  getStrategy(id: string) {
    return this.http.get<Strategy>(`api:/passport/strategy/${id}`);
  }

  updateStrategy(strategy: Strategy) {
    return this.http.post<Strategy>(`api:/passport/strategy`, strategy);
  }

  deleteStrategy(id: string) {
    return this.http.delete(`api:/passport/strategy/${id}`);
  }
}
