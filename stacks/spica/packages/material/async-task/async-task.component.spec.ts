import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AsyncTaskComponent } from './async-task.component';

describe('AsyncTaskComponent', () => {
  let component: AsyncTaskComponent;
  let fixture: ComponentFixture<AsyncTaskComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AsyncTaskComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AsyncTaskComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
