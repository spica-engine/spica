import {TestBed, ComponentFixture, tick, fakeAsync, flushMicrotasks} from "@angular/core/testing";
import {PolicyAddComponent} from "./policy-add.component";
import {PolicyService} from "../../services/policy.service";
import {of} from "rxjs";
import {ActivatedRoute, RouterModule} from "@angular/router";
import {
  MatIconModule,
  MatToolbarModule,
  MatFormFieldModule,
  MatCardModule,
  MatExpansionModule,
  MatInputModule,
  MatSelectModule
} from "@angular/material";
import {FormsModule, NgModel} from "@angular/forms";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {By} from "@angular/platform-browser";

describe("Policy Add Component", () => {
  let fixture: ComponentFixture<PolicyAddComponent>;

  let policyService: jasmine.SpyObj<Partial<PolicyService>>;

  let navigateSpy;

  beforeEach(async () => {
    policyService = {
      findOne: jasmine.createSpy("findOne").and.returnValue(
        of({
          _id: "BucketFullAccess",
          name: "Bucket Full Access",
          description: "Full access to bucket service.",
          statement: [
            {
              effect: "allow",
              action: "bucket:*",
              resource: "bucket/*",
              service: "bucket"
            },
            {
              effect: "allow",
              action: "bucket:data:*",
              resource: "bucket:data/*",
              service: "bucket:data"
            }
          ]
        })
      ),
      getServices: jasmine.createSpy("getServices").and.returnValue(
        of([
          {
            $resource: "bucket:data",
            $arguments: "/:id",
            title: "Bucket Data Service",
            actions: [
              "bucket:data:index",
              "bucket:data:show",
              "bucket:data:delete",
              "bucket:data:update"
            ]
          },
          {
            $resource: "bucket",
            $arguments: "/:id",
            title: "Bucket",
            actions: ["bucket:index", "bucket:show", "bucket:delete", "bucket:update"]
          },
          {
            $resource: "function",
            $arguments: "/:id",
            title: "Functions",
            actions: [
              "function:create",
              "function:update",
              "function:delete",
              "function:index",
              "function:run"
            ]
          }
        ])
      ),
      createPolicy: null,
      updatePolicy: null
    };

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
        NoopAnimationsModule
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({
              id: "id1"
            }),
            params: of({
              id: "id1"
            })
          }
        }
      ],
      declarations: [PolicyAddComponent]
    });
    TestBed.overrideProvider(PolicyService, {useValue: policyService});

    fixture = TestBed.createComponent(PolicyAddComponent);

    navigateSpy = spyOn(fixture.componentInstance["router"], "navigate");

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  describe("basic behaviours", () => {
    it("should show properties of first service", fakeAsync(() => {
      tick();
      fixture.detectChanges();

      expect(
        fixture.debugElement
          .query(By.css("mat-card mat-card-content mat-form-field:first-of-type input"))
          .injector.get(NgModel).value
      ).toBe("Bucket Full Access", "should show policy name");

      expect(
        fixture.debugElement
          .query(By.css("mat-card mat-card-content mat-form-field:last-of-type textarea"))
          .injector.get(NgModel).value
      ).toBe("Full access to bucket service.", "should show the description of policy");

      expect(
        fixture.debugElement
          .query(
            By.css(
              "mat-card-content div:nth-child(1) div.resource-input mat-form-field:nth-child(1) mat-select"
            )
          )
          .injector.get(NgModel).value
      ).toBe("allow", "should show effect value of first stament");

      expect(
        fixture.debugElement
          .query(
            By.css(
              "mat-card-content div:nth-child(1) div.resource-input mat-form-field:nth-child(2) mat-select"
            )
          )
          .injector.get(NgModel).value
      ).toBe("bucket", "should show service of first statement");

      expect(
        fixture.debugElement
          .query(
            By.css(
              "mat-card-content div:nth-child(1) div.resource-input mat-form-field:nth-child(3) mat-select"
            )
          )
          .injector.get(NgModel).value
      ).toEqual(
        ["bucket:index", "bucket:show", "bucket:delete", "bucket:update"],
        "should show actions of first stament"
      );

      expect(
        fixture.debugElement
          .query(By.css("div.resource mat-form-field:first-of-type input"))
          .injector.get(NgModel).value
      ).toBe("*", "should resource value of first statement");
    }));
  });

  describe("actions", () => {
    it("should add statement", () => {
      fixture.debugElement
        .query(By.css("mat-card mat-card-content button:first-of-type"))
        .nativeElement.click();

      fixture.detectChanges();

      expect(fixture.componentInstance.policy.statement).toEqual([
        {
          service: "bucket",
          effect: "allow",
          action: ["bucket:index", "bucket:show", "bucket:delete", "bucket:update"],
          resource: ["*"]
        },
        {
          service: "bucket:data",
          effect: "allow",
          action: [
            "bucket:data:index",
            "bucket:data:show",
            "bucket:data:delete",
            "bucket:data:update"
          ],
          resource: ["*"]
        },
        {
          service: undefined,
          effect: undefined,
          action: undefined,
          resource: []
        }
      ]);
    });

    it("should change effect value from allow to deny of first policy", () => {
      const select = fixture.debugElement.query(
        By.css(
          "mat-card-content div:nth-child(1) div.resource-input mat-form-field:nth-child(1) mat-select"
        )
      );
      select.nativeElement.click();

      fixture.detectChanges();

      (document.body.querySelector("mat-option:last-of-type") as HTMLElement).click();

      fixture.detectChanges();

      expect(select.injector.get(NgModel).value).toBe("deny");
    });

    it("should change bucket service to function service", () => {
      fixture.debugElement
        .query(
          By.css(
            "mat-card-content div:nth-child(1) div.resource-input mat-form-field:nth-child(2) mat-select"
          )
        )
        .nativeElement.click();
      fixture.detectChanges();

      (document.body.querySelector("mat-option:last-of-type") as HTMLElement).click();
      fixture.detectChanges();

      expect(fixture.componentInstance.policy.statement[0]).toEqual({
        service: "function",
        effect: "allow",
        action: [],
        resource: []
      });
    });

    it("should change actions of first statement", () => {
      fixture.debugElement
        .query(
          By.css(
            "mat-card-content div:nth-child(1) div.resource-input mat-form-field:nth-child(3) mat-select"
          )
        )
        .nativeElement.click();
      fixture.detectChanges();

      (document.body.querySelector("mat-option:first-of-type") as HTMLElement).click();
      (document.body.querySelector("mat-option:last-of-type") as HTMLElement).click();
      fixture.detectChanges();

      expect(fixture.componentInstance.policy.statement[0].action).toEqual([
        "bucket:show",
        "bucket:delete"
      ]);
    });

    it("should delete resource of first statement", () => {
      fixture.debugElement.query(By.css("div.resource button")).nativeElement.click();

      fixture.detectChanges();

      expect(fixture.componentInstance.policy.statement[0].resource).toEqual([]);
    });

    it("should add resource to first statement", () => {
      fixture.debugElement.query(By.css("div.resource:last-of-type button")).nativeElement.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.policy.statement[0].resource).toEqual(["*", undefined]);
    });

    it("should remove first statement", () => {
      fixture.debugElement
        .queryAll(
          By.css(
            "mat-card mat-card-content div:first-of-type mat-accordion mat-expansion-panel button"
          )
        )[2]
        .nativeElement.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.policy.statement).toEqual([
        {
          service: "bucket:data",
          effect: "allow",
          action: [
            "bucket:data:index",
            "bucket:data:show",
            "bucket:data:delete",
            "bucket:data:update"
          ],
          resource: ["*"]
        }
      ]);
    });

    it("should update policy which has id", fakeAsync(() => {
      const updateSpy = spyOn(
        fixture.componentInstance["policyService"],
        "updatePolicy"
      ).and.returnValue(of(null));

      fixture.debugElement
        .query(By.css("mat-card mat-card-content > button:last-of-type"))
        .nativeElement.click();

      tick();
      fixture.detectChanges();

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith({
        _id: "BucketFullAccess",
        name: "Bucket Full Access",
        description: "Full access to bucket service.",
        statement: [
          {
            effect: "allow",
            action: "bucket:*",
            resource: ["bucket/*"],
            service: "bucket"
          },
          {
            effect: "allow",
            action: "bucket:data:*",
            resource: ["bucket:data/*"],
            service: "bucket:data"
          }
        ]
      });

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith(["passport/policy"]);
    }));

    it("should create policy which hasn't id", fakeAsync(() => {
      const createSpy = spyOn(
        fixture.componentInstance["policyService"],
        "createPolicy"
      ).and.returnValue(of(null));

      delete fixture.componentInstance.policy._id;

      fixture.detectChanges();

      fixture.debugElement
        .query(By.css("mat-card mat-card-content > button:last-of-type"))
        .nativeElement.click();
      tick();
      fixture.detectChanges();

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith({
        name: "Bucket Full Access",
        description: "Full access to bucket service.",
        statement: [
          {
            effect: "allow",
            action: "bucket:*",
            resource: ["bucket/*"],
            service: "bucket"
          },
          {
            effect: "allow",
            action: "bucket:data:*",
            resource: ["bucket:data/*"],
            service: "bucket:data"
          }
        ]
      });

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith(["passport/policy"]);
    }));
  });
});
