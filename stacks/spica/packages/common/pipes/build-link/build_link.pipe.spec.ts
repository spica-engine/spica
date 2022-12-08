import {Component} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {By} from "@angular/platform-browser";
import {BuildLinkPipe} from "./build_link.pipe";
import {ACTIVITY_FACTORY} from "@spica-client/core/factories/factory";

@Component({
  template: `
    <a>{{ activity | buildLink: "activity" }}</a>
  `
})
class BuildLinkTestComponent {
  activity = {
    resource: {
      name: "function",
      documentId: "test_doc_id"
    },
    action: 1
  };
}

function functionProvider(activity: any) {
  let module = activity.resource.name;
  let documentId = activity.resource.documentId;
  let url;
  if (module == "function") {
    url = `function/${documentId}`;
  }
  return url;
}

function bucketProvider(activity: any) {
  let module = activity.resource.name;
  let documentId = activity.resource.documentId;
  let url;
  if (module == "bucket") {
    url = `bucket/${documentId}`;
  }
  return url;
}

describe("BuildLinkPipe", () => {
  let fixture: ComponentFixture<BuildLinkTestComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [BuildLinkPipe, BuildLinkTestComponent],
      providers: [
        {
          provide: ACTIVITY_FACTORY,
          useValue: functionProvider,
          multi: true
        },
        {
          provide: ACTIVITY_FACTORY,
          useValue: bucketProvider,
          multi: true
        }
      ]
    });
    fixture = TestBed.createComponent(BuildLinkTestComponent);
  });

  it("should return url from function factory", () => {
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css("a")).nativeElement.textContent).toEqual(
      "function/test_doc_id"
    );
  });

  it("should return url from bucket factory", () => {
    fixture.componentInstance.activity.resource.name = "bucket";
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css("a")).nativeElement.textContent).toEqual(
      "bucket/test_doc_id"
    );
  });
  it("shouldn't return url if there is no provider for module", () => {
    fixture.componentInstance.activity.resource.name = "unknown_module";
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css("a")).nativeElement.textContent).toEqual("");
  });
  it("shouldn't return url if action type is Delete", () => {
    fixture.componentInstance.activity.action = 3;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css("a")).nativeElement.textContent).toEqual("");
  });
});
