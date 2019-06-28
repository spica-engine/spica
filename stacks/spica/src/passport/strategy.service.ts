import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Strategy} from "./interfaces/strategy";

@Injectable({providedIn: "root"})
export class StrategyService {
  constructor(private http: HttpClient) {}

  getStrategies() {
    return this.http.get<Strategy[]>("api:/strategies");
  }

  getStrategy(id: string) {
    return this.http.get<Strategy>(`api:/strategies/${id}`).toPromise();
  }

  updateStrategy(strategy: Strategy) {
    return this.http.post<Strategy>(`api:/strategies`, strategy).toPromise();
  }

  deleteStrategy(id: string): Promise<void> {
    return this.http.delete<void>(`api:/strategies/${id}`).toPromise();
  }
}
