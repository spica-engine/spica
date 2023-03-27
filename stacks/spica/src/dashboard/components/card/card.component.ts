import {HttpClient} from "@angular/common/http";
import {Component, EventEmitter, Input, Output} from "@angular/core";
import {Form} from "@angular/forms";
import {PassportService} from "@spica-client/passport";
import {Observable} from "rxjs";

interface CardInput {
  key: string;
  type: string;
  value: any;
}

interface CardButton {
  target: string;
  method: string;
  enctype: string;
}

@Component({
  selector: "dashboard-card",
  templateUrl: "./card.component.html",
  styleUrls: ["./card.component.scss"]
})
export class CardComponent {
  @Input() componentData$: Observable<any>;

  @Output() onUpdate: EventEmitter<object> = new EventEmitter();

  @Input() isSmallComponent = false;

  @Input() ratio: string= '';


  token: string;

  constructor(private passport: PassportService, private http: HttpClient) {
    this.token = this.passport.token;
  }

  async submit(form: HTMLFormElement, inputs: CardInput[], button: CardButton) {
    if ((!button.enctype || button.enctype == "application/json") && button.method == "post") {
      const body: any = inputs.reduce((acc, {key, value}) => {
        acc[key] = value;
        return acc;
      }, {});

      const res = await this.http
        .request<any>(button.method, button.target, {body, headers: {authorization: this.token}})
        .toPromise()
        .catch(e => e);

      const tab = window.open("_blank");
      tab.document.write(JSON.stringify(res));
    } else {
      form.submit();
    }
  }
}
