import {async, ComponentFixture, TestBed} from "@angular/core/testing";
import {ApiKeyAddComponent} from "./apikey-add.component";
import {
  MatIconModule,
  MatToolbarModule,
  MatCardModule,
  MatFormFieldModule,
  MatInputModule
} from "@angular/material";
import {FormsModule} from "@angular/forms";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {ActivatedRoute} from "@angular/router";
import {of} from "rxjs";
import {RouterTestingModule} from "@angular/router/testing";
import {IndexResult} from "@spica-server/core";
import {MockApiKeyService, apiKeyService} from "../../services/apikey.service";
import {ApiKey} from "../../interfaces/apikey";

describe("ApiKeyAddComponent", () => {
  let component: ApiKeyAddComponent;
  let fixture: ComponentFixture<ApiKeyAddComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        MatIconModule,
        MatToolbarModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        FormsModule,
        RouterTestingModule,
        NoopAnimationsModule
      ],
      providers: [
        {
          provide: apiKeyService,
          useClass: MockApiKeyService
        },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({})
          }
        },
        {
          provide: RouterTestingModule,
          useValue: {
            navigate: () => {}
          }
        }
      ],
      declarations: [ApiKeyAddComponent]
    }).compileComponents();
  }));

  beforeEach(async () => {
    fixture = TestBed.createComponent(ApiKeyAddComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it("should set apiKey as emptyApiKey when this page navigated from add button", () => {
    expect(component.apiKey).toEqual({
      name: undefined,
      active: true
    });
  });

  it("should set apiKey which return from service when this page navigated from edit button", async () => {
    const _id = await component["apiKeyService"]
      .insert({
        name: "test name",
        active: true,
        key: "test key",
        policies: [],
        description: "test description"
      } as ApiKey)
      .toPromise()
      .then(apiKey => apiKey._id);
    component["activatedRoute"].params = of({id: _id.toString()});

    component.ngOnDestroy();
    component.ngOnInit();

    expect(component.apiKey).toEqual({
      _id: _id,
      name: "test name",
      active: true,
      key: "test key",
      policies: [],
      description: "test description"
    } as ApiKey);
  });

  it("should update apikey and navite to index page", async () => {
    const insertedId = await component["apiKeyService"]
      .insert({
        key: "key",
        name: "name",
        description: "description",
        policies: [],
        active: true
      })
      .toPromise()
      .then(apiKey => apiKey._id);

    component.apiKey = {
      _id: insertedId.toString(),
      key: "updated key",
      name: "updated name",
      description: "updated description",
      policies: [],
      active: true
    };

    const routeSpy = spyOn(component["router"], "navigate");

    component.saveApiKey();

    const updatedApiKey = await component["apiKeyService"].get(insertedId).toPromise();

    expect(updatedApiKey).toEqual({
      _id: insertedId,
      key: "updated key",
      name: "updated name",
      description: "updated description",
      policies: [],
      active: true
    });
    expect(routeSpy).toHaveBeenCalledTimes(1);
    expect(routeSpy).toHaveBeenCalledWith(["passport/apikey"]);
  });

  it("should insert apikey and navigate to index page", async () => {
    component.apiKey = {
      key: "new key",
      name: "new name",
      description: "new description",
      policies: [],
      active: true
    };

    const routeSpy = spyOn(component["router"], "navigate");

    component.saveApiKey();

    const apiKeys = ((await component["apiKeyService"].getAll().toPromise()) as IndexResult<ApiKey>)
      .data;
    delete apiKeys[0]._id;
    expect(apiKeys).toEqual([
      {
        key: "new key",
        name: "new name",
        description: "new description",
        policies: [],
        active: true
      }
    ]);

    expect(routeSpy).toHaveBeenCalledTimes(1);
    expect(routeSpy).toHaveBeenCalledWith(["passport/apikey"]);
  });
});
