import {async, ComponentFixture, TestBed, tick, fakeAsync} from "@angular/core/testing";
import {ApiKeyAddComponent} from "./api-key-add.component";
import {
  MatIconModule,
  MatToolbarModule,
  MatCardModule,
  MatFormFieldModule,
  MatInputModule
} from "@angular/material";
import {FormsModule} from "@angular/forms";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {ActivatedRoute, Router} from "@angular/router";
import {of} from "rxjs";

import {MockService} from "../../services/api-key.service";
import {ApiKey} from "../../interfaces/api-key";

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
        NoopAnimationsModule
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({})
          }
        },
        {
          provide: Router,
          useValue: {
            navigate: () => {}
          }
        },
        {
          provide: MockService,
          useValue: {
            get: () => of(null),
            update: () => {},
            insert: () => {}
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

  it("should show emptyApiKey if this page navigated from add button", () => {
    expect(component.apiKey).toEqual({
      name: undefined,
      active: true
    });
  });

  it("should show api key which return from service if this page navigated from edit button", async () => {
    component["activatedRoute"].params = of({id: "1"});
    component["apiKeyService"].get = () =>
      of({
        name: "test name",
        active: true,
        _id: "1",
        key: "test key",
        policies: [],
        description: "test description"
      } as ApiKey);
    component.getApiKeyFromId();

    fixture.detectChanges();

    expect(component.apiKey).toEqual({
      name: "test name",
      active: true,
      _id: "1",
      key: "test key",
      policies: [],
      description: "test description"
    } as ApiKey);
  });

  it("should update apikey and navite to index page", async () => {
    component.apiKey = {
      _id: "123",
      name: "updated name",
      description: "updated description",
      policies: [],
      active: true
    };

    const routeSpy = spyOn(component["router"], "navigate");
    const updateSpy = spyOn(component["apiKeyService"], "update").and.returnValue(of(null));

    component.saveApiKey();
    await fixture.whenStable();

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith({
      _id: "123",
      name: "updated name",
      description: "updated description",
      policies: [],
      active: true
    });

    expect(routeSpy).toHaveBeenCalledTimes(1);
    expect(routeSpy).toHaveBeenCalledWith(["passport/api-key"]);
  });

  it("should insert apikey and navigate to index page", async () => {
    component.apiKey = {
      name: "new name",
      description: "new description",
      policies: [],
      active: true
    };

    const routeSpy = spyOn(component["router"], "navigate");
    const insertSpy = spyOn(component["apiKeyService"], "insert").and.returnValue(of(null));

    component.saveApiKey();
    await fixture.whenStable();

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith({
      name: "new name",
      description: "new description",
      policies: [],
      active: true
    });

    expect(routeSpy).toHaveBeenCalledTimes(1);
    expect(routeSpy).toHaveBeenCalledWith(["passport/api-key"]);
  });
});
