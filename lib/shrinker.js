var chug = require('chug');
var cache = require('../common/fs/dot-cache').create();

var shrinker = module.exports = {

  patterns: [
    /(^|[^A-Z0-9])(_[A-Z][_A-Z0-9]+)/gi
  ],

  tokenCount: 0,

  tokens: {},

  replacementCharacters: 'abcdefghijklmnopqrstuvwxyz',

  reset: function () {
    shrinker.tokenCount = 0;
    shrinker.tokens = {};
  },

  createToken: function (text) {
    shrinker.tokens[text] = {
      replacement: shrinker.getNextReplacement(),
      count: 0
    };
    return shrinker.tokens[text];
  },

  skipPattern: /^(|do|id|in|if|for|new|try|var|case|else|this|void|with)$/,

  getNextReplacement: function () {
    var radix = shrinker.replacementCharacters.length;
    var replacement = '';
    while (shrinker.skipPattern.test(replacement)) {
      var number = shrinker.tokenCount++;
      replacement = shrinker.replacementCharacters[number % radix];
      while (number >= radix) {
        number = Math.floor(number / radix - 0.999);
        replacement = shrinker.replacementCharacters[number % radix] + replacement;
      }
    }
    return replacement;
  },

  shrink: function (asset) {
    shrinker.patterns.forEach(function (pattern) {
      asset.replace(pattern, function (match, first, text) {
        var token = shrinker.tokens[text] || shrinker.createToken(text);
        token.count++;
        return first + token.replacement;
      }, 'minified');
    });
  }
};

/**
 * When everything is finished loading, save tokens sorted by counts.
 */
chug.onReady(function () {
  var counts = [];
  var tokens = shrinker.tokens;
  for (var token in tokens) {
    var data = tokens[token];
    counts.push([token, data.count]);
  }
  counts.sort(function (a, b) {
    return b[1] - a[1];
  });
  var json = JSON.stringify(counts);
  cache.write('chug', 'shrinker.json', json);
});
