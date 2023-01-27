const sinon = require("sinon");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const sinonChai = require("sinon-chai");
chai.use(chaiAsPromised);
chai.use(sinonChai);
const expect = chai.expect;

const fs = require("fs");
const request = require("request-promise");
const Cacheman = require("cacheman");
const UrlTagger = require("../src/index");

describe("UrlTagger", function () {
  beforeEach(function () {
    this.sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    this.sandbox.restore();
  });

  describe("#runUrl", function () {
    const tagger = new UrlTagger(
      {
        "contains-github": "//github.com/",
        "is-https": "^https://",
      },
      {
        url: {
          github: ["contains-github"],
          "not-https": ["!is-https"],
          "github-not-https": [["!is-https", "contains-github"]],
        },
        content: {},
      }
    );

    it("matches a single rule", function () {
      expect(tagger.runUrl("https://github.com/mheap")).to.eql(["github"]);
    });

    it("matches multiple rules", function () {
      expect(tagger.runUrl("http://github.com/mheap")).to.eql([
        "github",
        "not-https",
        "github-not-https",
      ]);
    });

    it("matches no rules", function () {
      expect(tagger.runUrl("https://google.com")).to.eql([]);
    });
  });

  describe("#runContent", function () {
    const tagger = new UrlTagger(
      {
        "michael-html": 'id="post-1688"',
        "is-michael": "I like to learn and I like to teach",
        "contains-sinon": "Sinon",
        "contains-testing": "Test",
      },
      {
        url: {},
        content: {
          michael: ["is-michael"],
          "is-sinon": ["contains-sinon"],
          "is-js-testing": [["contains-sinon", "contains-testing"]],
        },
        html: {
          "michael-html": ["michael-html"],
        },
      }
    );

    it("matches a both html and content rules", function () {
      this.sandbox.stub(request, "get").resolves(mockUrl("michaelheap.com"));
      return expect(
        tagger.runContent("https://michaelheap.com")
      ).to.eventually.eql(["michael-html", "michael"]);
    });

    it("matches multiple rules", function () {
      this.sandbox.stub(request, "get").resolves(mockUrl("sinonjs.org"));
      return expect(tagger.runContent("https://sinonjs.org")).to.eventually.eql(
        ["is-sinon", "is-js-testing"]
      );
    });

    it("matches no rules", function () {
      this.sandbox.stub(request, "get").resolves("This is an example");
      return expect(tagger.runContent("https://example.com")).to.eventually.eql(
        []
      );
    });
  });

  describe("#run", function () {
    const tagger = new UrlTagger(
      {
        "is-michael-domain": "michaelheap.com",
        "is-michael-content": "I like to learn and I like to teach",
      },
      {
        url: {
          "michael-url": ["is-michael-domain"],
        },
        content: {
          "michael-content": ["is-michael-content"],
        },
      }
    );

    it("matches against both the URL and content", function () {
      this.sandbox.stub(request, "get").resolves(mockUrl("michaelheap.com"));
      return expect(tagger.run("https://michaelheap.com")).to.eventually.eql([
        "michael-content",
        "michael-url",
      ]);
    });

    it("matches the content only", function () {
      this.sandbox.stub(request, "get").resolves(mockUrl("michaelheap.com"));
      return expect(tagger.run("https://example.com")).to.eventually.eql([
        "michael-content",
      ]);
    });

    it("matches the url only", function () {
      this.sandbox.stub(request, "get").resolves("This is an example");
      return expect(tagger.run("https://michaelheap.com")).to.eventually.eql([
        "michael-url",
      ]);
    });

    it("matches no rules", function () {
      this.sandbox.stub(request, "get").resolves("This is an example");
      return expect(tagger.run("https://example.com")).to.eventually.eql([]);
    });
  });

  describe("#fetchContent", function () {
    it("runs successfully without a cache", function () {
      const tagger = new UrlTagger(
        { "is-michael-content": "I like to learn and I like to teach" },
        { content: { "michael-content": ["is-michael-content"] } }
      );
      this.sandbox.stub(request, "get").resolves(mockUrl("michaelheap.com"));
      return expect(tagger.run("https://example.com")).to.eventually.eql([
        "michael-content",
      ]);
    });

    it("stores the result in the cache if not found", async function () {
      const tagger = new UrlTagger(
        { "is-michael-content": "I like to learn and I like to teach" },
        { content: { "michael-content": ["is-michael-content"] } },
        { engine: "file" }
      );

      let content = mockUrl("michaelheap.com");
      let httpMock = this.sandbox.stub(request, "get").resolves(content);
      let cacheGetMock = this.sandbox.stub(tagger.cache, "get").resolves(null);
      let cacheSetMock = this.sandbox.stub(tagger.cache, "set");

      let res = await expect(
        tagger.run("https://example.com")
      ).to.eventually.eql(["michael-content"]);

      // We should have tried to get it from the cache
      expect(cacheGetMock).to.be.calledOnce;
      expect(cacheGetMock).to.be.calledWith("c984d06aafbecf6bc55569f964148ea3");

      // When we didn't find it, we made a HTTP request
      expect(httpMock).to.be.calledOnce;
      expect(httpMock).to.be.calledWith("https://example.com");

      // Then the result was stored in the cache
      expect(cacheSetMock).to.be.calledOnce;
      expect(cacheSetMock).to.be.calledWith(
        "c984d06aafbecf6bc55569f964148ea3",
        content,
        86400
      );
    });

    it("returns direct from the cache if found", async function () {
      const tagger = new UrlTagger(
        { "is-michael-content": "I like to learn and I like to teach" },
        { content: { "michael-content": ["is-michael-content"] } },
        { engine: "file" }
      );

      let content = mockUrl("michaelheap.com");
      let httpMock = this.sandbox.stub(request, "get");
      let cacheGetMock = this.sandbox
        .stub(tagger.cache, "get")
        .resolves(content);
      let cacheSetMock = this.sandbox.stub(tagger.cache, "set");

      let res = await expect(
        tagger.run("https://example.com")
      ).to.eventually.eql(["michael-content"]);

      // We should have tried to get it from the cache, and found it!
      expect(cacheGetMock).to.be.calledOnce;
      expect(cacheGetMock).to.be.calledWith("c984d06aafbecf6bc55569f964148ea3");

      // Which means no HTTP call
      expect(httpMock).to.not.be.called;

      // And nothing to store in the cache
      expect(cacheSetMock).to.not.be.called;
    });
  });
});

function mockUrl(url) {
  return fs.readFileSync(__dirname + "/fixtures/" + url + ".html");
}
