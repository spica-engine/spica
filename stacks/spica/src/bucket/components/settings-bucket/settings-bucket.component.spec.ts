import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsBucketComponent } from './settings-bucket.component';

describe('SettingsBucketComponent', () => {
  let component: SettingsBucketComponent;
  let fixture: ComponentFixture<SettingsBucketComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SettingsBucketComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsBucketComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
