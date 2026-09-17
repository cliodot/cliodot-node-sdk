import { isLoopbackHostname, localhostAwareLookup } from "../http/localhost-lookup";

describe("localhostAwareLookup", () => {
  it("treats localhost and *.localhost as loopback", () => {
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("flash.localhost")).toBe(true);
    expect(isLoopbackHostname("FLASH.LOCALHOST")).toBe(true);
    expect(isLoopbackHostname("api.example.com")).toBe(false);
  });

  it("resolves *.localhost to 127.0.0.1 without DNS", (done) => {
    localhostAwareLookup("flash.localhost", {}, (err, address, family) => {
      expect(err).toBeNull();
      expect(address).toBe("127.0.0.1");
      expect(family).toBe(4);
      done();
    });
  });

  it("supports all:true lookups", (done) => {
    localhostAwareLookup("flash.localhost", { all: true }, (err, address) => {
      expect(err).toBeNull();
      expect(address).toEqual([{ address: "127.0.0.1", family: 4 }]);
      done();
    });
  });
});
