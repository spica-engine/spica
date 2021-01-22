import {HttpClientTestingModule} from "@angular/common/http/testing";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatCardModule} from "@angular/material/card";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatSelectModule} from "@angular/material/select";
import {MatToolbarModule} from "@angular/material/toolbar";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {ActivatedRoute, RouterModule} from "@angular/router";
import {of} from "rxjs";
import {CanInteractDirectiveTest} from "@spica-client/passport/directives/can-interact.directive";
import {PolicyService} from "../../services/policy.service";
import {PolicyAddComponent} from "./policy-add.component";
import {MatDialogModule} from "@angular/material/dialog";

describe("Policy Add Component", () => {
  describe("Policy Add", () => {
    let fixture: ComponentFixture<PolicyAddComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [
          RouterModule.forRoot([], {relativeLinkResolution: "legacy"}),
          MatIconModule,
          MatToolbarModule,
          MatFormFieldModule,
          MatCardModule,
          MatExpansionModule,
          FormsModule,
          MatInputModule,
          MatSelectModule,
          NoopAnimationsModule,
          HttpClientTestingModule,
          MatDialogModule
        ],
        providers: [
          {
            provide: ActivatedRoute,
            useValue: {
              queryParams: of({}),
              params: of({})
            }
          },
          {
            provide: PolicyService,
            useValue: {
              getServices: () => {
                return {
                  bucket: {
                    "bucket:index": ["bucket_id"],
                    "bucket:show": ["bucket_id"],
                    "bucket:create": [],
                    "bucket:update": ["bucket_id"],
                    "bucket:delete": ["bucket_id"]
                  }
                };
              }
            }
          }
        ],
        declarations: [PolicyAddComponent, CanInteractDirectiveTest]
      }).compileComponents();

      fixture = TestBed.createComponent(PolicyAddComponent);

      fixture.detectChanges();
    });

    it("should set policy as empty", () => {
      expect(fixture.componentInstance.policy).toEqual({
        name: undefined,
        description: undefined,
        statements: []
      });
    });

    it("should set services", () => {
      expect(fixture.componentInstance.services).toEqual({
        bucket: {
          "bucket:index": ["bucket_id"],
          "bucket:show": ["bucket_id"],
          "bucket:create": [],
          "bucket:update": ["bucket_id"],
          "bucket:delete": ["bucket_id"]
        }
      });
    });

    it("should get resource selection", () => {
      expect(
        fixture.componentInstance.getResourceSelection({
          action: undefined,
          module: undefined,
          resource: []
        })
      ).toEqual("include");

      expect(
        fixture.componentInstance.getResourceSelection({
          action: undefined,
          module: undefined,
          resource: {include: "", exclude: []}
        })
      ).toEqual("exclude");
    });

    it("should add new statement", () => {
      fixture.componentInstance.addStatement();
      expect(fixture.componentInstance.policy).toEqual({
        name: undefined,
        description: undefined,
        statements: [{actions: [], module: undefined}]
      });
    });

    it("should remove statement", () => {
      fixture.componentInstance.policy.statements = [{actions: [], module: undefined}];
      fixture.componentInstance.removeStatement(0);
      expect(fixture.componentInstance.policy).toEqual({
        name: undefined,
        description: undefined,
        statements: []
      });
    });
  });

  describe("Policy Edit", () => {
    describe("from template", () => {
      let fixture: ComponentFixture<PolicyAddComponent>;

      beforeEach(() => {
        TestBed.configureTestingModule({
          imports: [
            RouterModule.forRoot([], {relativeLinkResolution: "legacy"}),
            MatIconModule,
            MatToolbarModule,
            MatFormFieldModule,
            MatCardModule,
            MatExpansionModule,
            FormsModule,
            MatInputModule,
            MatSelectModule,
            NoopAnimationsModule,
            HttpClientTestingModule,
            MatDialogModule
          ],
          providers: [
            {
              provide: ActivatedRoute,
              useValue: {
                queryParams: of({
                  template: JSON.stringify({
                    name: "Bucket Full Access",
                    description: "Bucket Full Access",
                    statement: [
                      {
                        action: "bucket:index",
                        resource: {include: "*", exclude: []},
                        module: "bucket"
                      },
                      {
                        action: "bucket:show",
                        resource: {include: "*", exclude: []},
                        module: "bucket"
                      },
                      {
                        action: "bucket:create",
                        resource: [],
                        module: "bucket"
                      },
                      {
                        action: "bucket:update",
                        resource: {include: "*", exclude: []},
                        module: "bucket"
                      },
                      {
                        action: "bucket:delete",
                        resource: {include: "*", exclude: []},
                        module: "bucket"
                      }
                    ]
                  })
                }),
                params: of({})
              }
            },
            {
              provide: PolicyService,
              useValue: {
                getServices: () => {
                  return {
                    bucket: {
                      "bucket:index": ["bucket_id"],
                      "bucket:show": ["bucket_id"],
                      "bucket:create": [],
                      "bucket:update": ["bucket_id"],
                      "bucket:delete": ["bucket_id"]
                    }
                  };
                }
              }
            }
          ],
          declarations: [PolicyAddComponent, CanInteractDirectiveTest]
        }).compileComponents();

        fixture = TestBed.createComponent(PolicyAddComponent);

        fixture.detectChanges();
      });

      it("should set policy as bucket full access", () => {
        expect(fixture.componentInstance.originalPolicy).toEqual({
          name: "Bucket Full Access",
          description: "Bucket Full Access",
          statement: [
            {
              action: "bucket:index",
              resource: {include: "*", exclude: []},
              module: "bucket"
            },
            {
              action: "bucket:show",
              resource: {include: "*", exclude: []},
              module: "bucket"
            },
            {
              action: "bucket:create",
              resource: [],
              module: "bucket"
            },
            {
              action: "bucket:update",
              resource: {include: "*", exclude: []},
              module: "bucket"
            },
            {
              action: "bucket:delete",
              resource: {include: "*", exclude: []},
              module: "bucket"
            }
          ]
        });
      });
    });

    describe("from policy id", () => {
      let fixture: ComponentFixture<PolicyAddComponent>;

      beforeEach(async () => {
        TestBed.configureTestingModule({
          imports: [
            RouterModule.forRoot([], {relativeLinkResolution: "legacy"}),
            MatIconModule,
            MatToolbarModule,
            MatFormFieldModule,
            MatCardModule,
            MatExpansionModule,
            FormsModule,
            MatInputModule,
            MatSelectModule,
            NoopAnimationsModule,
            HttpClientTestingModule,
            MatDialogModule
          ],
          providers: [
            {
              provide: ActivatedRoute,
              useValue: {
                queryParams: of({}),
                params: of({id: "policy_id"})
              }
            },
            {
              provide: PolicyService,
              useValue: {
                getServices: () => {
                  return {
                    bucket: {
                      "bucket:index": ["bucket_id"],
                      "bucket:show": ["bucket_id"],
                      "bucket:create": [],
                      "bucket:update": ["bucket_id"],
                      "bucket:delete": ["bucket_id"]
                    }
                  };
                },
                findOne: (id: string) => {
                  return of({
                    name: "policy_name",
                    description: "policy_description",
                    statement: []
                  });
                }
              }
            }
          ],
          declarations: [PolicyAddComponent, CanInteractDirectiveTest]
        }).compileComponents();

        fixture = TestBed.createComponent(PolicyAddComponent);

        fixture.detectChanges();
      });

      it("should set policy from policy services", () => {
        expect(fixture.componentInstance.policy).toEqual({
          name: "policy_name",
          description: "policy_description",
          statements: []
        });
      });
    });
  });
});
