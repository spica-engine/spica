// import {TestBed, ComponentFixture, tick, fakeAsync} from "@angular/core/testing";
// import {PolicyAddComponent} from "./policy-add.component";
// import {PolicyService} from "../../services/policy.service";
// import {of} from "rxjs";
// import {ActivatedRoute, RouterModule} from "@angular/router";
// import {MatCardModule} from "@angular/material/card";
// import {MatExpansionModule} from "@angular/material/expansion";
// import {MatFormFieldModule} from "@angular/material/form-field";
// import {MatIconModule} from "@angular/material/icon";
// import {MatInputModule} from "@angular/material/input";
// import {MatSelectModule} from "@angular/material/select";
// import {MatToolbarModule} from "@angular/material/toolbar";
// import {FormsModule, NgModel} from "@angular/forms";
// import {NoopAnimationsModule} from "@angular/platform-browser/animations";
// import {By} from "@angular/platform-browser";
// import {Directive, HostBinding, Input} from "@angular/core";

// @Directive({selector: "[canInteract]"})
// export class CanInteractDirectiveTest {
//   @HostBinding("style.visibility") _visible = "visible";
//   @Input("canInteract") action: string;
//   @Input("resource") resource: string;
// }

// describe("Policy Add Component", () => {
//   let fixture: ComponentFixture<PolicyAddComponent>;

//   let policyService: jasmine.SpyObj<Partial<PolicyService>>;

//   let navigateSpy;

//   beforeEach(async () => {
//     policyService = {
//       findOne: jasmine.createSpy("findOne").and.returnValue(
//         of({
//           _id: "BucketFullAccess",
//           name: "Bucket Full Access",
//           description: "Full access to bucket service.",
//           statement: [
//             {
//               effect: "allow",
//               action: "bucket:*",
//               resource: "bucket/*",
//               service: "bucket"
//             },
//             {
//               effect: "allow",
//               action: "bucket:data:*",
//               resource: "bucket:data/*",
//               service: "bucket:data"
//             }
//           ]
//         })
//       ),
//       getServices: jasmine.createSpy("getServices").and.returnValue(
//         of([
//           {
//             $resource: "bucket:data",
//             $arguments: "/:id",
//             title: "Bucket Data Service",
//             actions: [
//               "bucket:data:index",
//               "bucket:data:show",
//               "bucket:data:delete",
//               "bucket:data:update"
//             ]
//           },
//           {
//             $resource: "bucket",
//             $arguments: "/:id",
//             title: "Bucket",
//             actions: ["bucket:index", "bucket:show", "bucket:delete", "bucket:update"]
//           },
//           {
//             $resource: "function",
//             $arguments: "/:id",
//             title: "Functions",
//             actions: [
//               "function:create",
//               "function:update",
//               "function:delete",
//               "function:index",
//               "function:run"
//             ]
//           }
//         ])
//       ),
//       createPolicy: null,
//       updatePolicy: null
//     };

//     TestBed.configureTestingModule({
//       imports: [
//         RouterModule.forRoot([]),
//         MatIconModule,
//         MatToolbarModule,
//         MatFormFieldModule,
//         MatCardModule,
//         MatExpansionModule,
//         FormsModule,
//         MatInputModule,
//         MatSelectModule,
//         NoopAnimationsModule
//       ],
//       providers: [
//         {
//           provide: ActivatedRoute,
//           useValue: {
//             queryParams: of({
//               id: "id1"
//             }),
//             params: of({
//               id: "id1"
//             })
//           }
//         }
//       ],
//       declarations: [PolicyAddComponent, CanInteractDirectiveTest]
//     });
//     TestBed.overrideProvider(PolicyService, {useValue: policyService});

//     fixture = TestBed.createComponent(PolicyAddComponent);

//     navigateSpy = spyOn(fixture.componentInstance["router"], "navigate");

//     fixture.detectChanges();
//     await fixture.whenStable();
//     fixture.detectChanges();
//   });

//   describe("basic behaviours", () => {
//     it("should show properties of first service", fakeAsync(() => {
//       tick();
//       fixture.detectChanges();

//       expect(
//         fixture.debugElement
//           .query(By.css("mat-card mat-card-content mat-form-field:first-of-type input"))
//           .injector.get(NgModel).value
//       ).toBe("Bucket Full Access", "should show policy name");

//       expect(
//         fixture.debugElement
//           .query(By.css("mat-card mat-card-content mat-form-field:last-of-type textarea"))
//           .injector.get(NgModel).value
//       ).toBe("Full access to bucket service.", "should show the description of policy");

//       expect(
//         fixture.debugElement
//           .query(
//             By.css(
//               "mat-card mat-card-content > div:first-of-type mat-accordion mat-expansion-panel mat-form-field:nth-child(1) mat-select"
//             )
//           )
//           .injector.get(NgModel).value
//       ).toBe("allow", "should show effect value of first stament");

//       expect(
//         fixture.debugElement
//           .query(
//             By.css(
//               "mat-card mat-card-content > div:first-of-type mat-accordion mat-expansion-panel mat-form-field:nth-child(2) mat-select"
//             )
//           )
//           .injector.get(NgModel).value
//       ).toBe("bucket", "should show service of first statement");

//       expect(
//         fixture.debugElement
//           .query(
//             By.css(
//               "mat-card mat-card-content > div:first-of-type mat-accordion mat-expansion-panel mat-form-field:nth-child(3) mat-select"
//             )
//           )
//           .injector.get(NgModel).value
//       ).toEqual(
//         ["bucket:index", "bucket:show", "bucket:delete", "bucket:update"],
//         "should show actions of first stament"
//       );

//       expect(
//         fixture.debugElement
//           .query(By.css("div.resource mat-form-field:first-of-type input"))
//           .injector.get(NgModel).value
//       ).toBe("*", "should resource value of first statement");
//     }));
//   });

//   describe("actions", () => {
//     it("should add statement", () => {
//       fixture.debugElement
//         .query(By.css("mat-card mat-card-content button:first-of-type"))
//         .nativeElement.click();

//       fixture.detectChanges();

//       expect(fixture.componentInstance.policy.statement).toEqual([
//         {
//           service: "bucket",
//           effect: "allow",
//           action: ["bucket:index", "bucket:show", "bucket:delete", "bucket:update"],
//           resource: ["*"]
//         },
//         {
//           service: "bucket:data",
//           effect: "allow",
//           action: [
//             "bucket:data:index",
//             "bucket:data:show",
//             "bucket:data:delete",
//             "bucket:data:update"
//           ],
//           resource: ["*"]
//         },
//         {
//           service: undefined,
//           effect: undefined,
//           action: undefined,
//           resource: []
//         }
//       ]);
//     });

//     it("should change effect value from allow to deny of first policy", () => {
//       const select = fixture.debugElement.query(
//         By.css(
//           "mat-card mat-card-content > div:first-of-type mat-accordion mat-expansion-panel mat-form-field:nth-child(1) mat-select"
//         )
//       );
//       select.nativeElement.click();

//       fixture.detectChanges();

//       (document.body.querySelector("mat-option:last-of-type") as HTMLElement).click();

//       fixture.detectChanges();

//       expect(select.injector.get(NgModel).value).toBe("deny");
//     });

//     it("should change bucket service to function service", () => {
//       fixture.debugElement
//         .query(
//           By.css(
//             "mat-card mat-card-content > div:first-of-type mat-accordion mat-expansion-panel mat-form-field:nth-child(2) mat-select"
//           )
//         )
//         .nativeElement.click();
//       fixture.detectChanges();

//       (document.body.querySelector("mat-option:last-of-type") as HTMLElement).click();
//       fixture.detectChanges();

//       expect(fixture.componentInstance.policy.statement[0]).toEqual({
//         service: "function",
//         effect: "allow",
//         action: [],
//         resource: []
//       });
//     });

//     it("should change actions of first statement", () => {
//       fixture.debugElement
//         .query(
//           By.css(
//             "mat-card mat-card-content > div:first-of-type mat-accordion mat-expansion-panel mat-form-field:nth-child(3) mat-select"
//           )
//         )
//         .nativeElement.click();
//       fixture.detectChanges();

//       (document.body.querySelector("mat-option:first-of-type") as HTMLElement).click();
//       (document.body.querySelector("mat-option:last-of-type") as HTMLElement).click();
//       fixture.detectChanges();

//       expect(fixture.componentInstance.policy.statement[0].action).toEqual([
//         "bucket:show",
//         "bucket:delete"
//       ]);
//     });

//     it("should delete resource of first statement", () => {
//       fixture.debugElement.query(By.css("div.resource button")).nativeElement.click();

//       fixture.detectChanges();

//       expect(fixture.componentInstance.policy.statement[0].resource).toEqual([]);
//     });

//     it("should add resource to first statement", () => {
//       fixture.debugElement.query(By.css("div.resource button:last-of-type")).nativeElement.click();
//       fixture.detectChanges();

//       expect(fixture.componentInstance.policy.statement[0].resource).toEqual(["*", undefined]);
//     });

//     it("should remove first statement", () => {
//       fixture.debugElement
//         .queryAll(
//           By.css(
//             "mat-card mat-card-content div:first-of-type mat-accordion mat-expansion-panel button"
//           )
//         )[2]
//         .nativeElement.click();
//       fixture.detectChanges();

//       expect(fixture.componentInstance.policy.statement).toEqual([
//         {
//           service: "bucket:data",
//           effect: "allow",
//           action: [
//             "bucket:data:index",
//             "bucket:data:show",
//             "bucket:data:delete",
//             "bucket:data:update"
//           ],
//           resource: ["*"]
//         }
//       ]);
//     });

//     it("should update policy which has id", fakeAsync(() => {
//       const updateSpy = spyOn(
//         fixture.componentInstance["policyService"],
//         "updatePolicy"
//       ).and.returnValue(of(null));

//       fixture.debugElement
//         .query(By.css("mat-card mat-card-content > button:last-of-type"))
//         .nativeElement.click();

//       tick();
//       fixture.detectChanges();

//       expect(updateSpy).toHaveBeenCalledTimes(1);
//       expect(updateSpy).toHaveBeenCalledWith({
//         _id: "BucketFullAccess",
//         name: "Bucket Full Access",
//         description: "Full access to bucket service.",
//         statement: [
//           {
//             effect: "allow",
//             action: "bucket:*",
//             resource: ["bucket/*"],
//             service: "bucket"
//           },
//           {
//             effect: "allow",
//             action: "bucket:data:*",
//             resource: ["bucket:data/*"],
//             service: "bucket:data"
//           }
//         ]
//       });

//       expect(navigateSpy).toHaveBeenCalledTimes(1);
//       expect(navigateSpy).toHaveBeenCalledWith(["passport/policy"]);
//     }));

//     it("should create policy which hasn't id", fakeAsync(() => {
//       const createSpy = spyOn(
//         fixture.componentInstance["policyService"],
//         "createPolicy"
//       ).and.returnValue(of(null));

//       delete fixture.componentInstance.policy._id;

//       fixture.detectChanges();

//       fixture.debugElement
//         .query(By.css("mat-card mat-card-content > button:last-of-type"))
//         .nativeElement.click();
//       tick();
//       fixture.detectChanges();

//       expect(createSpy).toHaveBeenCalledTimes(1);
//       expect(createSpy).toHaveBeenCalledWith({
//         name: "Bucket Full Access",
//         description: "Full access to bucket service.",
//         statement: [
//           {
//             effect: "allow",
//             action: "bucket:*",
//             resource: ["bucket/*"],
//             service: "bucket"
//           },
//           {
//             effect: "allow",
//             action: "bucket:data:*",
//             resource: ["bucket:data/*"],
//             service: "bucket:data"
//           }
//         ]
//       });

//       expect(navigateSpy).toHaveBeenCalledTimes(1);
//       expect(navigateSpy).toHaveBeenCalledWith(["passport/policy"]);
//     }));
//   });

//   describe("compare available and selected actions", () => {
//     let availableActions: string[];
//     beforeAll(() => {
//       availableActions = ["bucket:index", "bucket:delete", "bucket:update"];
//     });

//     it("should return true when all actions are selected", () => {
//       const selectedActions = ["bucket:index", "bucket:delete", "bucket:update"];
//       const isAllSelected = fixture.componentInstance.compareActions(
//         availableActions,
//         selectedActions
//       );
//       expect(isAllSelected).toBe(true);
//     });

//     it("should return false when all actions arent selected", () => {
//       const selectedActions = ["bucket:index", "bucket:delete"];
//       const isAllSelected = fixture.componentInstance.compareActions(
//         availableActions,
//         selectedActions
//       );
//       expect(isAllSelected).toBe(false);
//     });
//   });
// });

import {TestBed, ComponentFixture, fakeAsync, tick} from "@angular/core/testing";
import {PolicyAddComponent} from "./policy-add.component";
import {PolicyService} from "../../services/policy.service";
import {of} from "rxjs";
import {ActivatedRoute, RouterModule} from "@angular/router";
import {MatCardModule} from "@angular/material/card";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatSelectModule} from "@angular/material/select";
import {MatToolbarModule} from "@angular/material/toolbar";
import {FormsModule} from "@angular/forms";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {Directive, HostBinding, Input} from "@angular/core";
import {HttpClientTestingModule} from "@angular/common/http/testing";

@Directive({selector: "[canInteract]"})
export class CanInteractDirectiveTest {
  @HostBinding("style.visibility") _visible = "visible";
  @Input("canInteract") action: string;
  @Input("resource") resource: string;
}

fdescribe("Policy Add Component", () => {
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

    describe("onResourceSelection", () => {
      it("should set statement resource as empty array when selection is only_include", () => {
        let statement = {resource: undefined, action: "bucket:show", module: "bucket"};

        fixture.componentInstance.onResourceSelection(statement, "only_include");
        expect(statement).toEqual({resource: [], action: "bucket:show", module: "bucket"});
      });

      it("should set statement resource with include and exclude fields when selection is include_exclude", () => {
        fixture.componentInstance.services = {
          "bucket:data": {
            "bucket:data:create": ["bucket_id"],
            "bucket:data:show": ["bucket_id", "bucketdata_id"]
          }
        };

        let statement = {
          resource: undefined,
          action: "bucket:data:create",
          module: "bucket:data"
        };

        fixture.componentInstance.onResourceSelection(statement, "include_exclude");
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

        fixture.componentInstance.onResourceSelection(statement, "include_exclude");
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
      ).toEqual("only_include");

      expect(
        fixture.componentInstance.getResourceSelection({
          action: undefined,
          module: undefined,
          resource: {include: "", exclude: []}
        })
      ).toEqual("include_exclude");
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
        statement: [{action: undefined, resource: [], module: undefined}]
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

      xit("should set policy from policy services", () => {
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
