import {CommonModule} from "@angular/common";
import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatCardModule} from "@angular/material/card";
import {MatDividerModule} from "@angular/material/divider";
import {MatLegacyFormFieldModule as MatFormFieldModule} from "@angular/material/legacy-form-field";
import {MatLegacyInputModule as MatInputModule} from "@angular/material/legacy-input";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTreeModule} from "@angular/material/tree";
import {BrowserModule} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {ActivatedRoute} from "@angular/router";
import {RouterTestingModule} from "@angular/router/testing";
import {of} from "rxjs";
import {Asset} from "../../interfaces";
import {AssetService} from "../../services/asset.service";
import {EditComponent} from "./edit.component";
import {MatLegacyListModule as MatListModule} from "@angular/material/legacy-list";

describe("EditComponent", () => {
  let component: EditComponent;
  let fixture: ComponentFixture<EditComponent>;

  let assetService: jasmine.SpyObj<Pick<AssetService, "findById" | "install">>;

  let asset: Asset;

  let activatedRoute: jasmine.SpyObj<Pick<ActivatedRoute, "params">>;

  beforeEach(async () => {
    asset = {
      _id: "1",
      url: "asset1.com",
      status: "downloaded",
      resources: [],
      configs: [],
      description: "Description of asset1",
      icon: "local_taxi",
      name: "Asset 1"
    };

    assetService = {
      findById: jasmine.createSpy("findById").and.returnValue(of(asset)),
      install: jasmine.createSpy("install").and.callFake((id, configs, preview) => {
        if (preview) {
          return of({
            insertions: [
              {
                _id: "1",
                module: "bucket",
                contents: {
                  schema: {
                    id: "bucket1",
                    name: "bucket1"
                  }
                }
              }
            ],
            updations: [
              {
                _id: "2",
                module: "function",
                contents: {
                  schema: {
                    id: "fn1",
                    name: "fn1"
                  }
                }
              }
            ],
            deletions: [
              {
                _id: "3",
                module: "bucket",
                contents: {
                  schema: {
                    id: "bucket3",
                    name: "bucket3"
                  }
                }
              }
            ]
          });
        }
      })
    };

    activatedRoute = {
      params: jasmine.createSpy("params").and.returnValue(of({id: "1"})) as any
    };

    await TestBed.configureTestingModule({
      declarations: [EditComponent],
      imports: [
        RouterTestingModule,
        MatToolbarModule,
        MatCardModule,
        NoopAnimationsModule,
        CommonModule,
        BrowserModule,
        FormsModule,
        MatFormFieldModule,
        MatTreeModule,
        MatInputModule,
        MatListModule
      ],
      providers: [
        {
          provide: AssetService,
          useValue: assetService
        }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should set preview", fakeAsync(() => {
    component.setInstallationPreview();

    tick();
    expect(component.preview).toEqual({
      bucket: {
        insertions: [
          {
            _id: "1",
            module: "bucket",
            contents: {
              schema: {
                id: "bucket1",
                name: "bucket1"
              }
            }
          }
        ],
        updations: [],
        deletions: [
          {
            _id: "3",
            module: "bucket",
            contents: {
              schema: {
                id: "bucket3",
                name: "bucket3"
              }
            }
          }
        ]
      },
      function: {
        insertions: [],
        updations: [
          {
            _id: "2",
            module: "function",
            contents: {
              schema: {
                id: "fn1",
                name: "fn1"
              }
            }
          }
        ],
        deletions: []
      }
    });
  }));

  it("should categorize resources by module", () => {
    const resources: any = [
      {
        _id: "1",
        module: "bucket",
        contents: {
          schema: {
            _id: "bucket1",
            title: "bucket1"
          }
        }
      },
      {
        _id: "2",
        module: "bucket",
        contents: {
          schema: {
            _id: "bucket2",
            title: "bucket2"
          }
        }
      },
      {
        _id: "3",
        module: "function",
        contents: {
          schema: {
            _id: "function1",
            title: "function1"
          },
          env: {
            test: 1
          }
        }
      }
    ];
    const categorizedResourceNodes = component.categorizeResourcesByModule(resources);
    expect(categorizedResourceNodes).toEqual([
      {
        name: "bucket",
        children: [
          {
            name: "bucket1",
            resource: {
              _id: "1",
              module: "bucket",
              contents: {
                schema: {
                  _id: "bucket1",
                  title: "bucket1"
                }
              }
            },
            children: []
          },
          {
            name: "bucket2",
            resource: {
              _id: "2",
              module: "bucket",
              contents: {
                schema: {
                  _id: "bucket2",
                  title: "bucket2"
                }
              }
            },
            children: []
          }
        ]
      },
      {
        name: "function",
        children: [
          {
            name: "function1",
            resource: {
              _id: "3",
              module: "function",
              contents: {
                schema: {
                  _id: "function1",
                  title: "function1"
                },
                env: {
                  test: 1
                }
              }
            },
            children: []
          }
        ]
      }
    ]);
  });

  it("should get resource name", () => {
    const resourceWithTitle: any = {
      contents: {
        schema: {
          title: "title1"
        }
      }
    };
    expect(component.getResourceName(resourceWithTitle)).toEqual("title1");

    const resourceWithName: any = {
      contents: {
        schema: {
          name: "name1"
        }
      }
    };
    expect(component.getResourceName(resourceWithName)).toEqual("name1");
  });
});
