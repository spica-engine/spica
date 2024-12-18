import {TestBed, ComponentFixture} from "@angular/core/testing";
import {RichTextEditorComponent} from "./richtext";
import {MatOptionModule} from "@angular/material/core";
import {MatDialog} from "@angular/material/dialog";
import {MatIconModule} from "@angular/material/icon";
import {MatSelectModule} from "@angular/material/select";
import {MatTooltipModule, MatTooltip} from "@angular/material/tooltip";
import {FormsModule, NgModel} from "@angular/forms";
import {PickerDirective} from "src/storage/components/picker/picker.directive";
import {INPUT_SCHEMA} from "@spica-client/common";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {By} from "@angular/platform-browser";
import {MatDividerModule} from "@angular/material/divider";

describe("RichTextEditorComponent", () => {
  let fixture: ComponentFixture<RichTextEditorComponent>;
  let executeSpy: jest.Mock<any>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        MatTooltipModule,
        MatIconModule,
        FormsModule,
        MatOptionModule,
        MatSelectModule,
        NoopAnimationsModule,
        MatDividerModule
      ],
      providers: [
        {
          provide: INPUT_SCHEMA,
          useValue: {
            title: "title",
            description: "description"
          }
        },
        {
          provide: MatDialog,
          useValue: {
            open: jest.fn()
          }
        }
      ],
      declarations: [RichTextEditorComponent, PickerDirective]
    }).compileComponents();
    fixture = TestBed.createComponent(RichTextEditorComponent);

    fixture.detectChanges();

    executeSpy = jest.spyOn(fixture.componentInstance, "execute");
  });

  it("should select text color ", () => {
    const colorInput = fixture.debugElement.query(
      By.css(".actions span:nth-of-type(2) button input")
    ).nativeElement;
    colorInput.value = "#111111";
    colorInput.dispatchEvent(new Event("change"));
    fixture.detectChanges();

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledWith("foreColor", "#111111");
  });

  it("should select background color ", () => {
    const colorInput = fixture.debugElement.query(
      By.css(".actions span:nth-of-type(2) button:last-of-type input")
    ).nativeElement;
    colorInput.value = "#ffffff";
    colorInput.dispatchEvent(new Event("change"));
    fixture.detectChanges();

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledWith("hiliteColor", "#ffffff");
  });
});
