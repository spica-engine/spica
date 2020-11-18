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
import {CanInteractDirectiveTest} from "../../../passport/directives/can-interact.directive";
import {PolicyService} from "../../services/policy.service";
import {PolicyAddComponent} from "./policy-add.component";
import {Statement} from "../../interfaces/statement";

describe("Policy Add Component", () => {
  describe("Policy Add", () => {
    let fixture: ComponentFixture<PolicyAddComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [
          RouterModule.forRoot([]),
          MatIconModule,
          MatToolbarModule,
          MatFormFieldModule,
          MatCardModule,
          MatExpansionModule,
          FormsModule,
          MatInputModule,
          MatSelectModule,
          NoopAnimationsModule,
          HttpClientTestingModule
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
        statement: []
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

    it("should set resource as empty array on action changes if statement accepts resource", () => {
      let statement: Statement = {action: "bucket:show", module: "bucket"};

      fixture.componentInstance.onActionChange(statement);
      expect(statement).toEqual({
        action: "bucket:show",
        module: "bucket",
        resource: []
      });
    });

    it("should delete resource array on action changes if statement accepts resource", () => {
      // this case is possible when you switch from a "resource-needed" statement to "no-resource-needed" statement
      let statement: Statement = {
        resource: ["bucket_id"],
        action: "bucket:create",
        module: "bucket"
      };

      fixture.componentInstance.onActionChange(statement);
      expect(statement).toEqual({
        action: "bucket:create",
        module: "bucket"
      });
    });

    describe("onResourceSelection", () => {
      it("should set statement resource as empty array when selection is include", () => {
        let statement: Statement = {action: "bucket:show", module: "bucket"};

        fixture.componentInstance.onResourceSelection(statement, "include");
        expect(statement).toEqual({resource: [], action: "bucket:show", module: "bucket"});
      });

      it("should set statement resource with include and exclude fields when selection is exclude", () => {
        fixture.componentInstance.services = {
          "bucket:data": {
            "bucket:data:create": ["bucket_id"],
            "bucket:data:show": ["bucket_id", "bucketdata_id"]
          }
        };

        let statement: Statement = {
          resource: [],
          action: "bucket:data:create",
          module: "bucket:data"
        };

        fixture.componentInstance.onResourceSelection(statement, "exclude");
        expect(statement).toEqual(
          {
            resource: {include: "*", exclude: []},
            action: "bucket:data:create",
            module: "bucket:data"
          },
          "should work when action has one parameter"
        );

        statement = {
          resource: undefined,
          action: "bucket:data:show",
          module: "bucket:data"
        };

        fixture.componentInstance.onResourceSelection(statement, "exclude");
        expect(statement).toEqual(
          {
            resource: {include: "*/*", exclude: []},
            action: "bucket:data:show",
            module: "bucket:data"
          },
          "should work when action has two parameter"
        );
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

    it("should add resource to includes", () => {
      let statement = {action: "show", module: "bucket", resource: []};
      fixture.componentInstance.addInclude("bucket_id", statement);

      expect(statement).toEqual({action: "show", module: "bucket", resource: ["bucket_id"]});
    });

    it("should add resource to excludes", () => {
      let statement = {action: "show", module: "bucket", resource: {include: "*", exclude: []}};
      fixture.componentInstance.addExclude("bucket_id", statement);

      expect(statement).toEqual({
        action: "show",
        module: "bucket",
        resource: {include: "*", exclude: ["bucket_id"]}
      });
    });

    it("should remove resource from includes", () => {
      let statement = {action: "show", module: "bucket", resource: ["bucket1", "bucket2"]};
      fixture.componentInstance.removeIncluded(0, statement);

      expect(statement).toEqual({action: "show", module: "bucket", resource: ["bucket2"]});
    });

    it("should remove resource from excludeds", () => {
      let statement = {
        action: "show",
        module: "bucket",
        resource: {include: "*", exclude: ["bucket1", "bucket2"]}
      };
      fixture.componentInstance.removeExcluded(0, statement);

      expect(statement).toEqual({
        action: "show",
        module: "bucket",
        resource: {include: "*", exclude: ["bucket2"]}
      });
    });

    it("should add new statement", () => {
      fixture.componentInstance.addStatement();
      expect(fixture.componentInstance.policy).toEqual({
        name: undefined,
        description: undefined,
        statement: [{action: undefined, module: undefined}]
      });
    });

    it("should remove statement", () => {
      fixture.componentInstance.policy.statement = [
        {action: undefined, resource: [], module: undefined}
      ];
      fixture.componentInstance.removeStatement(0);
      expect(fixture.componentInstance.policy).toEqual({
        name: undefined,
        description: undefined,
        statement: []
      });
    });
  });

  describe("Policy Edit", () => {
    describe("from template", () => {
      let fixture: ComponentFixture<PolicyAddComponent>;

      beforeEach(() => {
        TestBed.configureTestingModule({
          imports: [
            RouterModule.forRoot([]),
            MatIconModule,
            MatToolbarModule,
            MatFormFieldModule,
            MatCardModule,
            MatExpansionModule,
            FormsModule,
            MatInputModule,
            MatSelectModule,
            NoopAnimationsModule,
            HttpClientTestingModule
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
        expect(fixture.componentInstance.policy).toEqual({
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
            RouterModule.forRoot([]),
            MatIconModule,
            MatToolbarModule,
            MatFormFieldModule,
            MatCardModule,
            MatExpansionModule,
            FormsModule,
            MatInputModule,
            MatSelectModule,
            NoopAnimationsModule,
            HttpClientTestingModule
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
                    _id: "policy_id",
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
          _id: "policy_id",
          name: "policy_name",
          description: "policy_description",
          statement: []
        });
      });
    });
  });
});
