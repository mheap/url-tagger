# url-tagger

Provide a list of URLs, regexes and tags and have the URL returned with associated tags

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

### HTML Caching

To save you hitting the URLs you're testing too hard, URL Tagger allows you to
cache the returned HTML using [cacheman](https://github.com/cayasso/cacheman).

To use a cache, provide a third parameter when creating a `URLTagger` instance.
The options provided are passed directly through to cacheman.

Here is how to use a file based cache:

```javascript
const tagger = new UrlTagger(
  regexes,
  rules,
  {
    engine: 'file',
    tmpDir: '/tmp/url-tagger'
  }
);
```
