# url-tagger

Provide a list of URLs, regexes and tags and have the URL returned with associated tags

[![Build Status](https://api.travis-ci.org/mheap/url-tagger.svg?branch=master)](https://travis-ci.org/mheap/url-tagger)

### Usage

```javascript
const tagger = new UrlTagger(
  {
    "is-https": "^https://",
    "is-michael-domain": "michaelheap.com",
    "is-michael-content": "I like to learn and I like to teach"
  },
  {
    url: {
      "michael-url": ["is-michael-domain"],
      "michael-secure-url": [["is-michael-domain", "is-https"]]
    },
    content: {
      "michael-content": ["is-michael-content"]
    }
  }
);

await tagger.run("http://michaelheap.com");
# ["michael-content", "michael-url"];

await tagger.run("https://michaelheap.com");
# ["michael-content", "michael-url", "michael-secure-url"];
```
