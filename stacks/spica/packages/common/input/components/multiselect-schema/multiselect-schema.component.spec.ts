import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MultiselectSchemaComponent } from './multiselect-schema.component';

describe('MultiselectSchemaComponent', () => {
  let component: MultiselectSchemaComponent;
  let fixture: ComponentFixture<MultiselectSchemaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MultiselectSchemaComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MultiselectSchemaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
