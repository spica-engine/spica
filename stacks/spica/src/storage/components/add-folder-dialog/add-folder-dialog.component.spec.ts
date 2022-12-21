import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddFolderDialogComponent } from './add-folder-dialog.component';

describe('AddFolderDialogComponent', () => {
  let component: AddFolderDialogComponent;
  let fixture: ComponentFixture<AddFolderDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddFolderDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddFolderDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
