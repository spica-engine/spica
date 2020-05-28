import {Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Partner, Country} from "../interface/partner";
import {Observable} from "rxjs";

@Injectable({
  providedIn: "root"
})
export class PartnerService {
  constructor(private http: HttpClient) {}

  getCountries(): Observable<Country[]> {
    return this.http.get<Country[]>("/assets/countries.json");
  }

  getPartners(): Observable<Partner[]> {
    return this.http.get<Partner[]>("/assets/partners.json");
  }
}
