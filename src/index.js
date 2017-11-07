const RegexRules = require("regex-rules");
const request = require("request-promise");
const extractor = require("unfluff");

let UrlTagger = function(regex, rules) {
  this.urlRules = new RegexRules(regex, rules.url);
  this.contentRules = new RegexRules(regex, rules.content);
  this.htmlRules = new RegexRules(regex, rules.html);
};

UrlTagger.prototype.runUrl = function(url) {
  let results = [];

  let urlTags = this.urlRules.run(url);
  for (let r in urlTags) {
    if (urlTags[r]) {
      results.push(r);
    }
  }

  return results;
};

UrlTagger.prototype.runContent = async function(url) {
  let results = [];

  // Match on the raw HTML
  let html = await request.get(url);
  let htmlTags = this.htmlRules.run(html);
  for (let r in htmlTags) {
    if (htmlTags[r]) {
      results.push(r);
    }
  }

  // And on the extracted content body
  let content = await this.getContent(html);
  let contentTags = this.contentRules.run(content);
  for (let r in contentTags) {
    if (contentTags[r]) {
      results.push(r);
    }
  }
  return results;
};

UrlTagger.prototype.run = async function(url) {
  let arr = this.runUrl(url)
    .concat(await this.runContent(url))
    .sort();

  return arr.filter(function(e, i, arr) {
    return arr.lastIndexOf(e) === i;
  });
};

UrlTagger.prototype.getContent = async function(html) {
  return extractor(html).text;
};

module.exports = UrlTagger;
