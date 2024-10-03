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

  updateStrategy(id: string, strategy: Strategy) {
    delete strategy._id;
    return this.http.put<Strategy>(`api:/passport/strategy/${id}`, strategy);
  }

  addStrategy(strategy: Strategy) {
    return this.http.post<Strategy>(`api:/passport/strategy`, strategy);
  }

  deleteStrategy(id: string) {
    return this.http.delete(`api:/passport/strategy/${id}`);
  }
}
