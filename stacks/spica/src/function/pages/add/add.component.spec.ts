import {HttpClientTestingModule} from "@angular/common/http/testing";
import {Directive, Input, HostBinding} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatCardModule} from "@angular/material/card";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatListModule} from "@angular/material/list";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatSelectModule} from "@angular/material/select";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatToolbarModule} from "@angular/material/toolbar";
import {ActivatedRoute} from "@angular/router";
import {RouterTestingModule} from "@angular/router/testing";
import {MatSaveModule} from "@spica/client/packages/material";
import {of} from "rxjs";
import {InputPlacerComponent} from "../../../../packages/common/input/input.placer";
import {SchemeObserver} from "../../../../packages/core/layout/scheme.observer";
import {AddComponent} from "../../../function/pages/add/add.component";
import {EditorComponent} from "../../components/editor/editor.component";
import {FunctionService} from "../../function.service";
import {emptyTrigger, FUNCTION_OPTIONS} from "../../interface";
import {EnqueuerPipe} from "../../pipes/enqueuer";

@Directive({selector: "[canInteract]"})
export class CanInteractDirectiveTest {
  @HostBinding("style.visibility") _visible = "visible";
  @Input("canInteract") action: string;
}

@Directive({selector: "function-editor[language]"})
class MockLanguageDirective {
  @Input() marker: any;
}

describe("Function Add", () => {
  let fixture: ComponentFixture<AddComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        MatIconModule,
        MatToolbarModule,
        FormsModule,
        MatFormFieldModule,
        MatListModule,
        MatExpansionModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatCardModule,
        RouterTestingModule,
        HttpClientTestingModule,
        MatSaveModule
      ],
      providers: [
        {
          provide: FunctionService,
          useValue: {
            information: () => {
              return of();
            }
          }
        },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of()
          }
        },
        {
          provide: FUNCTION_OPTIONS,
          useValue: {
            url: ""
          }
        },
        {
          provide: SchemeObserver,
          useValue: {
            observe: () => {
              return of();
            }
          }
        }
      ],
      declarations: [
        AddComponent,
        EditorComponent,
        InputPlacerComponent,
        EnqueuerPipe,
        MockLanguageDirective,
        CanInteractDirectiveTest
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(AddComponent);
  });
  it("should set isHandlerDuplicated true", () => {
    fixture.componentInstance.function = {
      name: "test function",
      description: "test description",
      triggers: [emptyTrigger("handler1"), emptyTrigger("handler1")],
      env: []
    };

    fixture.componentInstance.checkHandlers();
    expect(fixture.componentInstance.isHandlerDuplicated).toBe(true);
  });
  it("should set isHandlerDuplicated false", () => {
    fixture.componentInstance.function = {
      name: "test function",
      description: "test description",
      triggers: [emptyTrigger("handler1"), emptyTrigger("handler2")],
      env: []
    };

    fixture.componentInstance.checkHandlers();
    expect(fixture.componentInstance.isHandlerDuplicated).toBe(false);
  });

  it("should delete trigger on the given index, then set isHandlerDuplicated false", () => {
    const func = (fixture.componentInstance.function = {
      name: "test function",
      description: "test description",
      triggers: [emptyTrigger("handler1"), emptyTrigger("handler2"), emptyTrigger("handler1")],
      env: []
    });

    fixture.componentInstance.deleteTrigger(2);

    expect(func.triggers).toEqual([
      {handler: "handler1", options: {}, type: undefined, active: true},
      {
        handler: "handler2",
        options: {},
        type: undefined,
        active: true
      }
    ]);

    expect(fixture.componentInstance.isHandlerDuplicated).toBe(false);
  });

  //  it("enter should not add trigger", () => {
  //    console.log(fixture.debugElement);
  //    const form = fixture.debugElement.query(By.directive(NgForm)).nativeElement;
  //    console.log(form);
  //    const kEventDown = new KeyboardEvent("keydown", {key: "enter"});
  //    form.dispatchEvent(kEventDown);
  //
  //    fixture.detectChanges();
  //
  //    expect(fixture.componentInstance.function.triggers.length).toEqual(0);
  //  });
});
