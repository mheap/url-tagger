const sinon = require("sinon");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const expect = chai.expect;

const fs = require("fs");
const request = require("request-promise");
const UrlTagger = require("../src/index");

describe("UrlTagger", function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe("#runUrl", function() {
    const tagger = new UrlTagger(
      {
        "contains-github": "//github.com/",
        "is-https": "^https://"
      },
      {
        url: {
          github: ["contains-github"],
          "not-https": ["!is-https"],
          "github-not-https": [["!is-https", "contains-github"]]
        },
        content: {}
      }
    );

    it("matches a single rule", function() {
      expect(tagger.runUrl("https://github.com/mheap")).to.eql(["github"]);
    });

    it("matches multiple rules", function() {
      expect(tagger.runUrl("http://github.com/mheap")).to.eql([
        "github",
        "not-https",
        "github-not-https"
      ]);
    });

    it("matches no rules", function() {
      expect(tagger.runUrl("https://google.com")).to.eql([]);
    });
  });

  describe("#runContent", function() {
    const tagger = new UrlTagger(
      {
        "is-michael": "I like to learn and I like to teach",
        "contains-sinon": "Sinon",
        "contains-testing": "Test"
      },
      {
        url: {},
        content: {
          michael: ["is-michael"],
          "is-sinon": ["contains-sinon"],
          "is-js-testing": [["contains-sinon", "contains-testing"]]
        }
      }
    );

    it("matches a single rule", function() {
      this.sandbox.stub(request, "get").resolves(mockUrl("michaelheap.com"));
      return expect(
        tagger.runContent("https://michaelheap.com")
      ).to.eventually.eql(["michael"]);
    });

    it("matches multiple rules", function() {
      this.sandbox.stub(request, "get").resolves(mockUrl("sinonjs.org"));
      return expect(
        tagger.runContent("https://sinonjs.org")
      ).to.eventually.eql(["is-sinon", "is-js-testing"]);
    });

    it("matches no rules", function() {
      this.sandbox.stub(request, "get").resolves("This is an example");
      return expect(tagger.runContent("https://example.com")).to.eventually.eql(
        []
      );
    });
  });

  describe("#run", function() {
    const tagger = new UrlTagger(
      {
        "is-michael-domain": "michaelheap.com",
        "is-michael-content": "I like to learn and I like to teach"
      },
      {
        url: {
          "michael-url": ["is-michael-domain"]
        },
        content: {
          "michael-content": ["is-michael-content"]
        }
      }
    );

    it("matches against both the URL and content", function() {
      this.sandbox.stub(request, "get").resolves(mockUrl("michaelheap.com"));
      return expect(tagger.run("https://michaelheap.com")).to.eventually.eql([
        "michael-content",
        "michael-url"
      ]);
    });

    it("matches the content only", function() {
      this.sandbox.stub(request, "get").resolves(mockUrl("michaelheap.com"));
      return expect(tagger.run("https://example.com")).to.eventually.eql([
        "michael-content"
      ]);
    });

    it("matches the url only", function() {
      this.sandbox.stub(request, "get").resolves("This is an example");
      return expect(tagger.run("https://michaelheap.com")).to.eventually.eql([
        "michael-url"
      ]);
    });

    it("matches no rules", function() {
      this.sandbox.stub(request, "get").resolves("This is an example");
      return expect(tagger.run("https://example.com")).to.eventually.eql([]);
    });
  });
});

function mockUrl(url) {
  return fs.readFileSync(__dirname + "/fixtures/" + url + ".html");
}
