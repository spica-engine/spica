import {initialize, create, update, get, getAll, remove} from "@spica-devkit/dashboard";
import * as Fetch from "node-fetch";

describe("Dashboard", () => {
  let fetchSpy: jasmine.SpyObj<any>;
  let customDashboard = {
    key: "first_dashboard",
    name: "First Dashboard",
    icon: "none",
    components: [
      {
        key: "bar_component",
        type: "bar",
        url: "some_url"
      }
    ]
  };
  beforeAll(() => {
    process.env.__INTERNAL__SPICA__PUBLIC_URL__ = "TEST_URL";
    fetchSpy = spyOn(Fetch, "default").and.returnValue(
      new Promise(resolve =>
        resolve({
          json: () => {}
        } as any)
      )
    );
    initialize({apikey: "TEST_APIKEY"});
  });

  afterEach(() => {
    fetchSpy.calls.reset();
  });

  it("should create dashboard", () => {
    create(customDashboard);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith("TEST_URL/dashboard", {
      method: "put",
      body: JSON.stringify(customDashboard),
      headers: {
        Authorization: "APIKEY TEST_APIKEY",
        "Content-Type": "application/json"
      }
    });
  });

  it("should update dashboard", () => {
    create(customDashboard);

    update({...customDashboard, icon: "test_icon"});

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledWith("TEST_URL/dashboard", {
      method: "put",
      body: JSON.stringify({...customDashboard, icon: "test_icon"}),
      headers: {
        Authorization: "APIKEY TEST_APIKEY",
        "Content-Type": "application/json"
      }
    });
  });

  it("should get all dashboards", () => {
    create(customDashboard);

    getAll();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledWith("TEST_URL/dashboard", {
      method: "get",
      headers: {
        Authorization: "APIKEY TEST_APIKEY"
      }
    });
  });

  it("should get specific dashboard", () => {
    create(customDashboard);

    get(customDashboard.key);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledWith(`TEST_URL/dashboard/${customDashboard.key}`, {
      method: "get",
      headers: {
        Authorization: "APIKEY TEST_APIKEY"
      }
    });
  });

  it("should remove dashboard", () => {
    create(customDashboard);

    remove(customDashboard.key);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledWith(`TEST_URL/dashboard/${customDashboard.key}`, {
      method: "delete",
      headers: {
        Authorization: "APIKEY TEST_APIKEY"
      }
    });
  });
});
