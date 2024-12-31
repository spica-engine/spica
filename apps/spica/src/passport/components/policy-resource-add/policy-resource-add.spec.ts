import {HttpClientTestingModule} from "@angular/common/http/testing";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatLegacyFormFieldModule as MatFormFieldModule} from "@angular/material/legacy-form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatLegacyInputModule as MatInputModule} from "@angular/material/legacy-input";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {CanInteractDirectiveTest} from "@spica-client/passport/directives/can-interact.directive";
import {PolicyResourceAddComponent} from "./policy-resource-add.component";
import {MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef} from "@angular/material/legacy-dialog";
import {MatDividerModule} from "@angular/material/divider";

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
        HttpClientTestingModule,
        MatDividerModule
      ],
      providers: [
        {provide: MatDialogRef, useValue: dialogRef},
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            services: {
              "bucket:data": {
                title: "Bucket Data",
                actions: {
                  "bucket:data:index": ["bucket_id", "document_id"],
                  "bucket:data:show": ["bucket_id", "document_id"],
                  "bucket:data:create": ["bucket_id"],
                  "bucket:data:update": ["bucket_id", "document_id"],
                  "bucket:data:delete": ["bucket_id", "document_id"],
                  "bucket:data:stream": ["bucket_id", "document_id"]
                }
              }
            },
            statement: {
              actions: [
                {
                  name: "bucket:data:show",
                  resource: {
                    include: ["*/*"],
                    exclude: []
                  }
                },
                {
                  name: "bucket:data:update",
                  resource: {
                    include: ["*/*"],
                    exclude: []
                  }
                },
                {
                  name: "bucket:data:create",
                  resource: {
                    include: ["*"],
                    exclude: []
                  }
                }
              ],
              module: "bucket:data"
            },
            currentAction: {
              name: "bucket:data:update",
              resource: {
                include: ["*/*"],
                exclude: []
              }
            }
          }
        }
      ],
      declarations: [PolicyResourceAddComponent, CanInteractDirectiveTest]
    }).compileComponents();

    fixture = TestBed.createComponent(PolicyResourceAddComponent);

    fixture.detectChanges();
  });

  it("should switch to the include resorce definition", () => {
    fixture.componentInstance.data.currentAction.resource = {
      include: ["bucket1/*"],
      exclude: ["bucket/doc1", "bucket1/doc2"]
    };
    fixture.componentInstance.addInclude();

    expect(fixture.componentInstance.data.currentAction.resource).toEqual({
      include: ["bucket1/*", ""],
      exclude: []
    });
  });

  it("should switch to the exclude resource definition", () => {
    fixture.componentInstance.data.currentAction.resource = {
      include: ["bucket1/doc1", "bucket1/doc2"],
      exclude: []
    };
    fixture.componentInstance.addExclude();

    expect(fixture.componentInstance.data.currentAction.resource).toEqual({
      include: ["*/*"],
      exclude: [""]
    });
  });

  it("should remove from includeds", () => {
    fixture.componentInstance.data.currentAction.resource = {
      include: ["bucket1/doc1", "bucket1/doc2"],
      exclude: []
    };
    fixture.componentInstance.removeIncluded(1);

    expect(fixture.componentInstance.data.currentAction.resource).toEqual({
      include: ["bucket1/doc1"],
      exclude: []
    });
  });

  it("should remove from excludeds", () => {
    fixture.componentInstance.data.currentAction.resource = {
      include: ["*/*"],
      exclude: ["bucket1/doc1", "bucket1/doc2"]
    };
    fixture.componentInstance.removeExcluded(1);

    expect(fixture.componentInstance.data.currentAction.resource).toEqual({
      include: ["*/*"],
      exclude: ["bucket1/doc1"]
    });
  });

  it("should copy resources to the other actions which accepts same resource format", () => {
    fixture.componentInstance.data.currentAction.resource = {
      include: ["*/*"],
      exclude: ["bucket1/doc1", "bucket1/doc2"]
    };

    fixture.componentInstance.copyResources();

    expect(fixture.componentInstance.data.statement.actions).toEqual([
      {
        name: "bucket:data:show",
        resource: {
          include: ["*/*"],
          exclude: ["bucket1/doc1", "bucket1/doc2"]
        }
      },
      {
        name: "bucket:data:update",
        resource: {
          include: ["*/*"],
          exclude: ["bucket1/doc1", "bucket1/doc2"]
        }
      },
      // do not change this
      {
        name: "bucket:data:create",
        resource: {
          include: ["*"],
          exclude: []
        }
      }
    ]);
  });
});
