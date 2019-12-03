import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardTableComponent } from './dashboard-table.component';

describe('DashboardTableComponent', () => {
  let component: DashboardTableComponent;
  let fixture: ComponentFixture<DashboardTableComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DashboardTableComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DashboardTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
