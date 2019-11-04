import {ComponentFixture, TestBed} from "@angular/core/testing";
import {IdentifyComponent} from "./identify.component";
import {MatFormFieldModule} from "@angular/material/form-field";
import {FormsModule} from "@angular/forms";
import {MatIconModule} from "@angular/material/icon";
import {MatCardModule} from "@angular/material/card";
import {MatTooltipModule} from "@angular/material/tooltip";
import {PassportService} from "../../services/passport.service";
import {RouterModule} from "@angular/router";

xdescribe("identify", () => {
  let fixture: ComponentFixture<IdentifyComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterModule.forRoot([]),
        FormsModule,
        MatFormFieldModule,
        MatIconModule,
        MatCardModule,
        MatTooltipModule
      ],
      providers: [
        {
          provide: PassportService,
          useValue: {
            //create this service and start to define it blocks
          }
        }
      ],
      declarations: [IdentifyComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(IdentifyComponent);
    fixture.detectChanges();
  });

  it("should work", () => {
    expect(fixture).toBeDefined();
  });
});
