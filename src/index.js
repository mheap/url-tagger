const RegexRules = require("regex-rules");
let fetch = require("node-fetch");
const striptags = require("striptags");
const Cacheman = require("cacheman");
const crypto = require("crypto");
const debug = require("debug")("url-tagger");

const fetchLog = debug.extend("fetch");
const extractLog = debug.extend("extract");
const errorLog = debug.extend("error");

const maxContentSize = 1048576 * (process.env.URL_TAGGER_MAX_CONTENT_MB || 3);

let UrlTagger = function (regex, rules, cache) {
  let options = { case_insensitive: true, allow_direct_regex: true };
  this.urlRules = new RegexRules(regex, rules.url, options);
  this.contentRules = new RegexRules(regex, rules.content, options);
  this.htmlRules = new RegexRules(regex, rules.html, options);

  if (cache) {
    this.cache = new Cacheman("urltagger", cache);
  }
};

UrlTagger.prototype.runUrl = function (url) {
  let results = [];

  let urlTags = this.urlRules.run(url);
  for (let r in urlTags) {
    if (urlTags[r]) {
      results.push(r);
    }
  }

  return results;
};

UrlTagger.prototype.runContent = async function (url) {
  let results = [];

  // Match on the raw HTML
  let html = await this.fetchContent(url);
  let htmlTags = this.htmlRules.run(html);
  for (let r in htmlTags) {
    if (htmlTags[r]) {
      results.push(r);
    }
  }

  // And on the extracted content body
  let content = this.getContent(html, url);
  let contentTags = this.contentRules.run(content);
  for (let r in contentTags) {
    if (contentTags[r]) {
      results.push(r);
    }
  }
  return results;
};

UrlTagger.prototype.run = async function (url) {
  let arr = this.runUrl(url)
    .concat(await this.runContent(url))
    .sort();

  return arr.filter(function (e, i, arr) {
    return arr.lastIndexOf(e) === i;
  });
};

let i = 0;
UrlTagger.prototype.getContent = function (html, url) {
  if (html.length == 0) {
    return "";
  }

  // Skip anything > maxContentSize (3mb by default)
  if (html.length > maxContentSize) {
    return "";
  }
  extractLog("[" + i++ + "]: " + url + " :: " + html.length);
  return striptags(html);
};

UrlTagger.prototype.fetchContent = async function (url) {
  fetchLog("Fetch: " + url);
  if (this.cache) {
    let hash = this.hashString(url);
    try {
      let html = await this.cache.get(hash);

      // If we didn't find it in the cache, we need to
      // fetch the HTML from the site
      if (!html) {
        fetchLog("Cache Miss: " + url);
        const r = await fetch(url);
        html = await r.text();
        await this.cache.set(hash, html, 86400);
      }

      fetchLog("Cache Hit: " + url);
      return html;
    } catch (e) {
      errorLog("Cache Error: " + e);
      return "";
    }
  }

  fetchLog("No Cache: " + url);
  const r = await fetch(url, { timeout: 10000 });
  return await r.text();
};

UrlTagger.prototype.hashString = function (str) {
  return crypto.createHash("md5").update(str).digest("hex");
};

module.exports = UrlTagger;
