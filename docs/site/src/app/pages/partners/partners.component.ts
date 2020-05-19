import {Component, OnInit} from "@angular/core";
import {fly, flyOne} from "../../pages/animations";
import {Observable} from "rxjs";
import {HttpClient} from "@angular/common/http";
import countries from "../../../assets/countries.json";
import partners from "../../../assets/partners.json";

@Component({
  selector: "app-partners",
  templateUrl: "./partners.component.html",
  styleUrls: ["./partners.component.scss"],
  animations: [fly("fly"), flyOne("flyOne")]
})
export class PartnersComponent implements OnInit {
  countryList: object;
  partnerList: object;
  partnerFilter: any = [];
  selectedCountry: string;
  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.getCountries().subscribe(r => {
      this.countryList = r;
    });

    this.getPartners().subscribe(r => {
      this.partnerList = r;
    });
  }

  getCountries(): Observable<any> {
    return this.http.get("../../../assets/countries.json");
  }
  getPartners(): Observable<any> {
    return this.http.get("../../../assets/partners.json");
  }

  countrySelect() {
    this.partnerFilter = [];
    Object(this.partnerList).find(partner => {
      if ((partner.country == this.selectedCountry) == true) {
        this.partnerFilter.push(partner);
      }
      return null;
    });
  }
}
