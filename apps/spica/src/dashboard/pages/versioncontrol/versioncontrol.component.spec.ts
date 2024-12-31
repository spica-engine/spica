import {ComponentFixture, TestBed} from "@angular/core/testing";

import {VersionControlComponent} from "./versioncontrol.component";
import {VersionControlService} from "../../services/versioncontrol.service";
import {HttpClientTestingModule} from "@angular/common/http/testing";
import {MatLegacyMenuModule as MatMenuModule} from "@angular/material/legacy-menu";

describe("VersionControlComponent", () => {
  let component: VersionControlComponent;
  let fixture: ComponentFixture<VersionControlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, MatMenuModule],
      declarations: [VersionControlComponent],
      providers: [VersionControlService]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VersionControlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
