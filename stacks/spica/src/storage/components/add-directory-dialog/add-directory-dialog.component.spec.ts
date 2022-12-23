import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddDirectoryDialog } from './add-directory-dialog.component';

describe('AddDirectoryDialogComponent', () => {
  let component: AddDirectoryDialog;
  let fixture: ComponentFixture<AddDirectoryDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddDirectoryDialog ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddDirectoryDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
