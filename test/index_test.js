const sinon = require("sinon");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const sinonChai = require("sinon-chai");
chai.use(chaiAsPromised);
chai.use(sinonChai);
const expect = chai.expect;

const fs = require("fs");
const fetch = require("node-fetch");
const UrlTagger = require("../src/index");

const nock = require("nock");
nock.disableNetConnect();

describe("UrlTagger", function () {
  beforeEach(function () {
    this.sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    this.sandbox.restore();
    if (!nock.isDone()) {
      throw new Error(
        `Not all nock interceptors were used: ${JSON.stringify(
          nock.pendingMocks()
        )}`
      );
    }
    nock.cleanAll();
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

    it("matches both html and content rules", function () {
      mockUrl("https://michaelheap.com");
      return expect(
        tagger.runContent("https://michaelheap.com")
      ).to.eventually.eql(["michael-html", "michael"]);
    });

    it("matches multiple rules", function () {
      mockUrl("https://sinonjs.org");
      return expect(tagger.runContent("https://sinonjs.org")).to.eventually.eql(
        ["is-sinon", "is-js-testing"]
      );
    });

    it("matches no rules", function () {
      mockUrl("https://example.com");
      return expect(tagger.runContent("https://example.com")).to.eventually.eql(
        []
      );
    });
  });

  describe("#run", function () {
    const tagger = new UrlTagger(
      {
        "is-michael-domain": "michaelheap.com",
        "is-sinon-domain": "sinonjs.org",
        "is-michael-content": "I like to learn and I like to teach",
        "is-example-content":
          "This domain is for use in illustrative examples in documents",
      },
      {
        url: {
          "michael-url": ["is-michael-domain"],
          "sinon-url": ["is-sinon-domain"],
        },
        content: {
          "michael-content": ["is-michael-content"],
          "example-content": ["is-example-content"],
        },
      }
    );

    it("matches against both the URL and content", function () {
      mockUrl("https://michaelheap.com");
      return expect(tagger.run("https://michaelheap.com")).to.eventually.eql([
        "michael-content",
        "michael-url",
      ]);
    });

    it("matches the content only", function () {
      mockUrl("https://example.com");
      return expect(tagger.run("https://example.com")).to.eventually.eql([
        "example-content",
      ]);
    });

    it("matches the url only", function () {
      mockUrl("https://sinonjs.org");
      return expect(tagger.run("https://sinonjs.org")).to.eventually.eql([
        "sinon-url",
      ]);
    });

    it("matches no rules", function () {
      mockUrl("https://empty.example.com");
      return expect(tagger.run("https://empty.example.com")).to.eventually.eql(
        []
      );
    });
  });

  describe("#fetchContent", function () {
    it("runs successfully without a cache", function () {
      const tagger = new UrlTagger(
        { "is-michael-content": "I like to learn and I like to teach" },
        { content: { "michael-content": ["is-michael-content"] } }
      );
      mockUrl("https://michaelheap.com");
      return expect(tagger.run("https://michaelheap.com")).to.eventually.eql([
        "michael-content",
      ]);
    });

    it("stores the result in the cache if not found", async function () {
      const tagger = new UrlTagger(
        { "is-michael-content": "I like to learn and I like to teach" },
        { content: { "michael-content": ["is-michael-content"] } },
        { engine: "file" }
      );

      let content = mockUrl("https://michaelheap.com");
      let cacheGetMock = this.sandbox.stub(tagger.cache, "get").resolves(null);
      let cacheSetMock = this.sandbox.stub(tagger.cache, "set");

      let res = await expect(
        tagger.run("https://michaelheap.com")
      ).to.eventually.eql(["michael-content"]);

      // We should have tried to get it from the cache
      expect(cacheGetMock).to.be.calledOnce;
      expect(cacheGetMock).to.be.calledWith("7c24fd57625ed5526c59b7f317578a6c");

      // Then the result was stored in the cache
      expect(cacheSetMock).to.be.calledOnce;
      expect(cacheSetMock).to.be.calledWith(
        "7c24fd57625ed5526c59b7f317578a6c",
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

      let content = mockUrl("https://michaelheap.com", true);
      let cacheGetMock = this.sandbox
        .stub(tagger.cache, "get")
        .resolves(content);
      let cacheSetMock = this.sandbox.stub(tagger.cache, "set");

      let res = await expect(
        tagger.run("https://michaelheap.com")
      ).to.eventually.eql(["michael-content"]);

      // We should have tried to get it from the cache, and found it!
      expect(cacheGetMock).to.be.calledOnce;
      expect(cacheGetMock).to.be.calledWith("7c24fd57625ed5526c59b7f317578a6c");

      // And nothing to store in the cache
      expect(cacheSetMock).to.not.be.called;
    });
  });
});

function mockUrl(url, skipCreateMock) {
  const fixture = url.replace("https://", "");
  const content = fs
    .readFileSync(__dirname + "/fixtures/" + fixture + ".html")
    .toString();
  if (!skipCreateMock) {
    nock(url).get("/").reply(200, content);
  }
  return content;
}
