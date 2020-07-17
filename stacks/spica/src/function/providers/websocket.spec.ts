import {provideWsInterceptor} from "./websocket";

describe("provideWsInterceptor", () => {
  it("should convert http to ws from given options", () => {
    let wsUrl = provideWsInterceptor({url: "https://test.com/api"});
    expect(wsUrl).toEqual("wss://test.com/api");
  });
  it("should convert http to ws from location.origin", () => {
    let wsUrl = provideWsInterceptor({url: "/api"});
    let expectedBaseUrl = window.location.origin.replace("http", "ws");
    expect(wsUrl).toEqual(expectedBaseUrl + "/api");
  });
});
