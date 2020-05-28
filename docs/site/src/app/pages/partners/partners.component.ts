import {Component, OnInit} from "@angular/core";
import {fly, flyOne} from "../../pages/animations";
import {Observable, BehaviorSubject} from "rxjs";
import {Country, Partner} from "../../interface/partner";
import {map, switchMap} from "rxjs/operators";
import {PartnerService} from "src/app/services/partners.service";

@Component({
  selector: "app-partners",
  templateUrl: "./partners.component.html",
  styleUrls: ["./partners.component.scss"],
  animations: [fly("fly"), flyOne("flyOne")]
})
export class PartnersComponent implements OnInit {
  countries: Observable<Country[]>;
  partners: Observable<Partner[]>;
  filter = new BehaviorSubject(undefined);

  constructor(private partnerService: PartnerService) {}

  ngOnInit() {
    this.countries = this.partnerService.getCountries();
    this.partners = this.filter.pipe(
      switchMap(country =>
        this.partnerService
          .getPartners()
          .pipe(map(partners => partners.filter(partner => partner.country == country)))
      )
    );
  }

  applyFilter(country: string) {
    this.filter.next(country);
  }
}
