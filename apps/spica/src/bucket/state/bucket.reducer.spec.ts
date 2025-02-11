import {TestBed} from "@angular/core/testing";
import {Store, StoreModule} from "@ngrx/store";
import {
  Add,
  reducer,
  Remove,
  Retrieve,
  selectAll,
  selectEmpty,
  selectIds,
  selectLoaded,
  State,
  Upsert
} from "./bucket.reducer";

describe("BucketReducer", () => {
  let store: Store<State>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [StoreModule.forRoot({bucket: reducer})]
    });
    store = TestBed.get(Store);
  });

  it("should set loaded false in inital state", () => {
    expectAsync(store.select(selectLoaded).toPromise()).toBeResolvedTo(false);
  });

  it("should select empty as false if it wasn't loaded", () => {
    expectAsync(store.select(selectEmpty).toPromise()).toBeResolvedTo(false);
  });

  it("should select empty as true if it is loaded", () => {
    store.dispatch(new Retrieve([]));
    expectAsync(store.select(selectEmpty).toPromise()).toBeResolvedTo(false);
  });

  describe("Retrieve", () => {
    it("should set loaded to true", () => {
      store.dispatch(new Retrieve([]));
      expectAsync(store.select(selectLoaded).toPromise()).toBeResolvedTo(true);
    });

    it("should add entities to state", async () => {
      store.dispatch(new Retrieve([{primary: "", _id: "test"}]));
      expectAsync(store.select(selectAll).toPromise()).toBeResolvedTo([{primary: "", _id: "test"}]);
      expectAsync(store.select(selectIds).toPromise()).toBeResolvedTo(["test"]);
    });
  });

  it("should add entity to state", () => {
    store.dispatch(new Add({primary: "", _id: "test"}));
    expectAsync(store.select(selectAll).toPromise()).toBeResolvedTo([{primary: "", _id: "test"}]);
  });

  it("should remove entity from state", () => {
    store.dispatch(
      new Retrieve([
        {primary: "", _id: "test"},
        {primary: "", _id: "test1"}
      ])
    );
    store.dispatch(new Remove("test1"));
    expectAsync(store.select(selectAll).toPromise()).toBeResolvedTo([{primary: "", _id: "test"}]);
  });

  it("should upsert entity from state", () => {
    store.dispatch(new Retrieve([{primary: "", _id: "test"}]));
    store.dispatch(new Upsert({primary: "test", _id: "test"}));
    store.dispatch(new Upsert({primary: "test1", _id: "test1"}));
    expectAsync(store.select(selectAll).toPromise()).toBeResolvedTo([
      {primary: "test", _id: "test"},
      {primary: "test1", _id: "test1"}
    ]);
  });

  it("should update entity from state", () => {
    store.dispatch(
      new Retrieve([
        {primary: "", _id: "test"},
        {primary: "", _id: "test1"}
      ])
    );
    store.dispatch(new Upsert({primary: "test", _id: "test"}));
    store.dispatch(new Upsert({primary: "test1", _id: "test1"}));
    expectAsync(store.select(selectAll).toPromise()).toBeResolvedTo([
      {primary: "test", _id: "test"},
      {primary: "test1", _id: "test1"}
    ]);
  });
});
