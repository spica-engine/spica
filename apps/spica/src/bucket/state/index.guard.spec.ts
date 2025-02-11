import {TestBed} from "@angular/core/testing";
import {RouterStateSnapshot, UrlTree} from "@angular/router";
import {RouterTestingModule} from "@angular/router/testing";
import {Store, StoreModule} from "@ngrx/store";
import {of} from "rxjs";
import {BucketService} from "../services/bucket.service";
import {reducer, Retrieve, State} from "./bucket.reducer";
import {BucketIndexGuard} from "./index.guard";

describe("BucketIndexGuard", () => {
  let guard: BucketIndexGuard;
  let store: Store<State>;
  let bucketService: jasmine.SpyObj<{retrieve: Function}>;

  beforeEach(() => {
    bucketService = {
      retrieve: jasmine.createSpy("retrieve").and.returnValue(of(null))
    };

    TestBed.configureTestingModule({
      imports: [StoreModule.forRoot({bucket: reducer}), RouterTestingModule],
      providers: [
        BucketIndexGuard,
        {
          provide: BucketService,
          useValue: bucketService
        }
      ]
    });
    TestBed.get(Store);
    store = TestBed.get(Store);
    guard = TestBed.get(BucketIndexGuard);
  });

  it("should retrieve if not loaded", async () => {
    await guard.canActivate(null, {url: "bucket"} as RouterStateSnapshot).toPromise();
    expect(bucketService.retrieve).toHaveBeenCalledTimes(1);
  });

  it("should not redirect if not loaded", async () => {
    expect(await guard.canActivate(null, {url: "bucket"} as RouterStateSnapshot).toPromise()).toBe(
      true
    );
    expect(bucketService.retrieve).toHaveBeenCalledTimes(1);
  });

  it("should redirect if empty", async () => {
    store.dispatch(new Retrieve([]));
    expect(
      (await guard.canActivate(null, {url: "bucket"} as RouterStateSnapshot).toPromise()) instanceof
        UrlTree
    ).toBe(true);
    expect(bucketService.retrieve).not.toHaveBeenCalled();
  });
});
