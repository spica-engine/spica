import {TestBed, ComponentFixture} from "@angular/core/testing";
import {AddComponent} from "../../../function/pages/add/add.component";
import {MatIconModule} from "@angular/material/icon";
import {MatToolbarModule} from "@angular/material/toolbar";
import {FormsModule} from "@angular/forms";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatListModule} from "@angular/material/list";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {EditorComponent} from "../../components/editor/editor.component";
import {MatSelectModule} from "@angular/material/select";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatCardModule} from "@angular/material/card";
import {InputPlacerComponent} from "../../../../packages/common/input/input.placer";
import {FunctionService} from "../../function.service";
import {EnqueuerPipe} from "../../pipes/enqueuer";
import {of} from "rxjs";
import {ActivatedRoute} from "@angular/router";
import {RouterTestingModule} from "@angular/router/testing";
import {HttpClientTestingModule} from "@angular/common/http/testing";
import {FUNCTION_OPTIONS, emptyTrigger} from "../../interface";
import {SchemeObserver} from "../../../../packages/core/layout/scheme.observer";

describe("Functon Add", () => {
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
        HttpClientTestingModule
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
      declarations: [AddComponent, EditorComponent, InputPlacerComponent, EnqueuerPipe]
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
      {handler: "handler1", options: {}, type: undefined},
      {
        handler: "handler2",
        options: {},
        type: undefined
      }
    ]);

    expect(fixture.componentInstance.isHandlerDuplicated).toBe(false);
  });
});
