import {HttpClientTestingModule} from "@angular/common/http/testing";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {CanInteractDirectiveTest} from "../../../passport/directives/can-interact.directive";
import {PolicyResourceAddComponent} from "./policy-resource-add.component";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";

describe("Policy Resource Add Component", () => {
  let dialogRef = jasmine.createSpyObj<MatDialogRef<any, any>>("DialogRef", ["close"]);
  let fixture: ComponentFixture<PolicyResourceAddComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        MatIconModule,
        MatFormFieldModule,
        FormsModule,
        MatInputModule,
        NoopAnimationsModule,
        HttpClientTestingModule
      ],
      providers: [
        {provide: MatDialogRef, useValue: dialogRef},
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            services: {
              bucket: {
                "bucket:index": ["bucket_id"],
                "bucket:show": ["bucket_id"],
                "bucket:create": [],
                "bucket:update": ["bucket_id"],
                "bucket:delete": ["bucket_id"]
              }
            },
            statement: {action: "", resource: [], module: ""},
            action: ""
          }
        }
      ],
      declarations: [PolicyResourceAddComponent, CanInteractDirectiveTest]
    }).compileComponents();

    fixture = TestBed.createComponent(PolicyResourceAddComponent);

    fixture.detectChanges();
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

  it("should add resource to includes", () => {
    const statement = {action: "show", module: "bucket", resource: []};
    fixture.componentInstance.addInclude("bucket_id", statement);

    expect(statement).toEqual({action: "show", module: "bucket", resource: ["bucket_id"]});
  });

  it("should add resource to excludes", () => {
    const statement = {action: "show", module: "bucket", resource: {include: "*", exclude: []}};
    fixture.componentInstance.addExclude("bucket_id", statement);

    expect(statement).toEqual({
      action: "show",
      module: "bucket",
      resource: {include: "*", exclude: ["bucket_id"]}
    });
  });

  it("should remove resource from includes", () => {
    const statement = {action: "show", module: "bucket", resource: ["bucket1", "bucket2"]};
    fixture.componentInstance.removeIncluded(0, statement);

    expect(statement).toEqual({action: "show", module: "bucket", resource: ["bucket2"]});
  });

  it("should remove resource from excludeds", () => {
    const statement = {
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
});
