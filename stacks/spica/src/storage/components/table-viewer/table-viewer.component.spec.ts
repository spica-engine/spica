import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TableViewerComponent } from './table-viewer.component';

describe('TableViewerComponent', () => {
  let component: TableViewerComponent;
  let fixture: ComponentFixture<TableViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TableViewerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TableViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
