import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ApiKeyIndexComponent } from './api-key-index.component';

describe('ApiKeyIndexComponent', () => {
  let component: ApiKeyIndexComponent;
  let fixture: ComponentFixture<ApiKeyIndexComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ApiKeyIndexComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ApiKeyIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
