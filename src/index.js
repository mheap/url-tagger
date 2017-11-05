const RegexRules = require("regex-rules");
const request = require("request-promise");
const extractor = require("unfluff");

let UrlTagger = function(regex, rules) {
  this.urlRules = new RegexRules(regex, rules.url);
  this.contentRules = new RegexRules(regex, rules.content);
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
  let content = await this.getContent(url);
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

UrlTagger.prototype.getContent = async function(url) {
  return extractor(await request.get(url)).text;
};

module.exports = UrlTagger;
