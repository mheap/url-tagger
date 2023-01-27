const RegexRules = require("regex-rules");
const request = require("request-promise");
const extractor = require("unfluff");
const Cacheman = require("cacheman");
const crypto = require("crypto");

let UrlTagger = function (regex, rules, cache) {
  let options = { case_insensitive: true };
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
  let content = this.getContent(html);
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

UrlTagger.prototype.getContent = function (html) {
  return extractor(html).text;
};

UrlTagger.prototype.fetchContent = async function (url) {
  if (this.cache) {
    let hash = this.hashString(url);
    try {
      let html = await this.cache.get(hash);

      // If we didn't find it in the cache, we need to
      // fetch the HTML from the site
      if (!html) {
        html = await request.get(url);
        await this.cache.set(hash, html, 86400);
      }

      return html;
    } catch (e) {}
  }
  return await request.get(url);
};

UrlTagger.prototype.hashString = function (str) {
  return crypto.createHash("md5").update(str).digest("hex");
};

module.exports = UrlTagger;
