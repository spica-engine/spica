import {Component, OnInit} from "@angular/core";
import {fly, flyOne} from "../animations";
import {countryList, partnerList} from "../../services/partners.service";

@Component({
  selector: "app-partners",
  templateUrl: "./partners.component.html",
  styleUrls: ["./partners.component.scss"],
  animations: [fly("fly"), flyOne("flyOne")]
})
export class PartnersComponent implements OnInit {
  countryList = countryList;
  partnerList = partnerList;
  partnerFilter = [];
  selectedCountry;
  constructor() {}

  ngOnInit() {}

  countrySelect() {
    this.partnerFilter = [];
    partnerList.find(partner => {
      if ((partner.country == this.selectedCountry) == true) {
        this.partnerFilter.push(partner);
      }
      return null;
    });
  }
}
