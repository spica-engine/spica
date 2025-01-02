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
import {RouterTestingModule} from "@angular/router/testing";

describe("Policy Add Component", () => {
  describe("Policy Add", () => {
    let fixture: ComponentFixture<PolicyAddComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [
          RouterTestingModule.withRoutes([
            {
              path: "passport/policy",
              component: PolicyAddComponent
            }
          ]),
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
                    title: "Bucket",
                    actions: {
                      "bucket:index": ["bucket_id"],
                      "bucket:show": ["bucket_id"],
                      "bucket:create": [],
                      "bucket:update": ["bucket_id"],
                      "bucket:delete": ["bucket_id"]
                    }
                  }
                };
              },
              createPolicy: jasmine.createSpy("createPolicy").and.returnValue(of())
            }
          }
        ],
        declarations: [PolicyAddComponent, CanInteractDirectiveTest]
      }).compileComponents();

      fixture = TestBed.createComponent(PolicyAddComponent);

      fixture.detectChanges();
    });

    it("should set policy as empty", () => {
      expect(fixture.componentInstance.originalPolicy).toEqual({
        name: undefined,
        description: undefined,
        statement: []
      });
    });

    it("should get resource", () => {
      const statement = {
        module: "bucket",
        actions: [
          {
            name: "bucket:show",
            resource: {
              include: ["*"],
              exclude: []
            }
          }
        ]
      };

      const resources = fixture.componentInstance.getResource(statement, "bucket:show");
      expect(resources).toEqual({
        include: ["*"],
        exclude: []
      });
    });

    it("should toggle action on", () => {
      const statement = {
        module: "bucket",
        actions: [
          {
            name: "bucket:delete",
            resource: {
              include: ["*"],
              exclude: []
            }
          }
        ]
      };

      fixture.componentInstance.toggleAction(statement, "bucket:update");

      expect(statement).toEqual({
        module: "bucket",
        actions: [
          {
            name: "bucket:delete",
            resource: {
              include: ["*"],
              exclude: []
            }
          },
          {
            name: "bucket:update",
            resource: {
              include: [],
              exclude: []
            }
          }
        ]
      });
    });

    it("should toggle action off", () => {
      const statement = {
        module: "bucket",
        actions: [
          {
            name: "bucket:delete",
            resource: {
              include: ["*"],
              exclude: []
            }
          }
        ]
      };

      fixture.componentInstance.toggleAction(statement, "bucket:delete");

      expect(statement).toEqual({
        module: "bucket",
        actions: []
      });
    });

    it("should return true if action is active", () => {
      const statement = {
        module: "bucket",
        actions: [
          {
            name: "bucket:delete",
            resource: {
              include: ["*"],
              exclude: []
            }
          }
        ]
      };

      expect(fixture.componentInstance.isActionActive(statement, "bucket:delete")).toEqual(true);
    });

    it("should return false if action is passive", () => {
      const statement = {
        module: "bucket",
        actions: [
          {
            name: "bucket:delete",
            resource: {
              include: ["*"],
              exclude: []
            }
          }
        ]
      };

      expect(fixture.componentInstance.isActionActive(statement, "bucket:create")).toEqual(false);
    });

    it("should open dialog", () => {
      const openSpy = spyOn(fixture.componentInstance["dialog"], "open").and.returnValue(undefined);

      const statement = {
        module: "bucket",
        actions: [
          {
            name: "bucket:delete",
            resource: {
              include: ["*"],
              exclude: []
            }
          }
        ]
      };

      fixture.componentInstance.editResources(statement, "bucket:delete");

      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(openSpy.calls.first().args[1].data).toEqual(
        {
          services: fixture.componentInstance.services,
          statement: statement,
          currentAction: {
            name: "bucket:delete",
            resource: {
              include: ["*"],
              exclude: []
            }
          }
        },
        "should run if dialog opened for correct action"
      );
    });

    it("should not open dialog, but toggle action on", () => {
      const openSpy = spyOn(fixture.componentInstance["dialog"], "open").and.returnValue(undefined);
      const toggleSpy = spyOn(fixture.componentInstance, "toggleAction").and.returnValue(undefined);

      const statement = {
        module: "bucket",
        actions: [
          {
            name: "bucket:delete",
            resource: {
              include: ["*"],
              exclude: []
            }
          }
        ]
      };

      fixture.componentInstance.editResources(statement, "bucket:show");

      expect(openSpy).toHaveBeenCalledTimes(0);

      expect(toggleSpy).toHaveBeenCalledTimes(1);
      expect(toggleSpy).toHaveBeenCalledWith(statement, "bucket:show");
    });

    it("should return true if action accepts resource", () => {
      const statement = {
        module: "bucket",
        actions: [
          {
            name: "bucket:delete",
            resource: {
              include: ["*"],
              exclude: []
            }
          }
        ]
      };

      expect(fixture.componentInstance.acceptsResource(statement, "bucket:index")).toEqual(true);
    });

    it("should return false if action does not accept resource", () => {
      const statement = {
        module: "bucket",
        actions: [
          {
            name: "bucket:delete",
            resource: {
              include: ["*"],
              exclude: []
            }
          }
        ]
      };

      expect(fixture.componentInstance.acceptsResource(statement, "bucket:create")).toEqual(false);
    });

    it("should return true if one of statements has missing resource", () => {
      fixture.componentInstance.displayedStatements = [
        {
          module: "bucket",
          actions: [
            {
              name: "bucket:delete",
              resource: {
                include: [],
                exclude: []
              }
            }
          ]
        }
      ];

      expect(fixture.componentInstance.noResourceInserted()).toEqual(true);
    });

    it("should return true if none of statements has missing resource", () => {
      fixture.componentInstance.displayedStatements = [
        {
          module: "bucket",
          actions: [
            {
              name: "bucket:delete",
              resource: {
                include: ["*"],
                exclude: []
              }
            }
          ]
        },
        {
          module: "bucket",
          actions: [
            {
              name: "bucket:create",
              resource: undefined
            }
          ]
        }
      ];

      expect(fixture.componentInstance.noResourceInserted()).toEqual(false);
    });

    it("should prepare policies for insert action", () => {
      fixture.componentInstance.displayedStatements = [
        {
          module: "bucket",
          actions: [
            {
              name: "bucket:create",
              resource: undefined
            },
            {
              name: "bucket:delete",
              resource: {
                include: ["*"],
                exclude: []
              }
            }
          ]
        },
        {
          module: "dashboard",
          actions: [
            {
              name: "dashboard:create",
              resource: undefined
            }
          ]
        }
      ];

      fixture.componentInstance.originalPolicy = {
        name: "test",
        description: "test",
        statement: [
          {
            action: "function:index",
            module: "function",
            resource: {
              include: ["*"],
              exclude: []
            }
          }
        ]
      };

      fixture.componentInstance.savePolicy();

      const createSpy = fixture.componentInstance["policyService"].createPolicy as jasmine.Spy;

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy.calls.first().args[0]).toEqual({
        name: "test",
        description: "test",
        statement: [
          {
            action: "bucket:create",
            module: "bucket",
            resource: undefined
          },
          {
            action: "bucket:delete",
            module: "bucket",
            resource: {
              include: ["*"],
              exclude: []
            }
          },
          {
            action: "dashboard:create",
            module: "dashboard",
            resource: undefined
          }
        ]
      });
    });

    it("should add new statement", () => {
      fixture.componentInstance.addStatement();
      expect(fixture.componentInstance.displayedStatements).toEqual([
        {
          actions: [],
          module: undefined
        }
      ]);
    });

    it("should remove statement", () => {
      fixture.componentInstance.displayedStatements = [
        {
          actions: [],
          module: undefined
        }
      ];

      fixture.componentInstance.removeStatement(0);
      expect(fixture.componentInstance.displayedStatements).toEqual([]);
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
                        resource: {include: ["*"], exclude: []},
                        module: "bucket"
                      },
                      {
                        action: "bucket:show",
                        resource: {include: ["*"], exclude: []},
                        module: "bucket"
                      },
                      {
                        action: "bucket:create",
                        module: "bucket"
                      },
                      {
                        action: "bucket:update",
                        resource: {include: ["*"], exclude: []},
                        module: "bucket"
                      },
                      {
                        action: "bucket:delete",
                        resource: {include: ["*"], exclude: []},
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
                      title: "Bucket",
                      actions: {
                        "bucket:index": ["bucket_id"],
                        "bucket:show": ["bucket_id"],
                        "bucket:create": [],
                        "bucket:update": ["bucket_id"],
                        "bucket:delete": ["bucket_id"]
                      }
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

      it("should create displayed statements from original policy", () => {
        expect(fixture.componentInstance.originalPolicy).toEqual(
          {
            name: "Bucket Full Access",
            description: "Bucket Full Access",
            statement: [
              {
                action: "bucket:index",
                resource: {include: ["*"], exclude: []},
                module: "bucket"
              },
              {
                action: "bucket:show",
                resource: {include: ["*"], exclude: []},
                module: "bucket"
              },
              {
                action: "bucket:create",
                module: "bucket"
              },
              {
                action: "bucket:update",
                resource: {include: ["*"], exclude: []},
                module: "bucket"
              },
              {
                action: "bucket:delete",
                resource: {include: ["*"], exclude: []},
                module: "bucket"
              }
            ]
          },
          "should work if original policy is still in original form"
        );

        expect(fixture.componentInstance.displayedStatements).toEqual([
          {
            module: "bucket",
            actions: [
              {
                name: "bucket:index",
                resource: {include: ["*"], exclude: []}
              },
              {
                name: "bucket:show",
                resource: {include: ["*"], exclude: []}
              },
              {
                name: "bucket:create",
                resource: undefined
              },
              {
                name: "bucket:update",
                resource: {include: ["*"], exclude: []}
              },
              {
                name: "bucket:delete",
                resource: {include: ["*"], exclude: []}
              }
            ]
          }
        ]);
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
        expect(fixture.componentInstance.originalPolicy).toEqual({
          name: "policy_name",
          description: "policy_description",
          statement: []
        });

        expect(fixture.componentInstance.displayedStatements).toEqual([]);
      });
    });
  });
});
