import {HttpClientModule} from "@angular/common/http";
import {inject, TestBed} from "@angular/core/testing";

import {TextEditorService} from "./text-editor.service";

describe("TextEditorService", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({imports: [HttpClientModule], providers: [TextEditorService]});
  });

  it("should be created", inject([TextEditorService], (service: TextEditorService) => {
    expect(service).toBeTruthy();
  }));
});
