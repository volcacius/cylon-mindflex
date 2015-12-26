"use strict";

var mindflex = lib("../");

var Adaptor = lib("adaptor"),
    Driver = lib("driver");

describe("cylon-neurosky", function() {
  describe("#adaptors", function() {
    it("is an array of supplied adaptors", function() {
      expect(mindflex.adaptors).to.be.eql(["mindflex"]);
    });
  });

  describe("#drivers", function() {
    it("is an array of supplied drivers", function() {
      expect(mindflex.drivers).to.be.eql(["mindflex"]);
    });
  });

  describe("#adaptor", function() {
    it("returns an instance of the Neurosky adaptor", function() {
      var args = { port: "/dev/null" };
      expect(mindflex.adaptor(args)).to.be.an.instanceOf(Adaptor);
    });
  });

  describe("#driver", function() {
    it("returns an instance of the Neurosky driver", function() {
      var driver = mindflex.driver({ device: { connection: {} } });
      expect(driver).to.be.an.instanceOf(Driver);
    });
  });
});
