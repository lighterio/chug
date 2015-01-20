var mime = require(__dirname + '/mime');
var chug;
setImmediate(function immediatelySetChug() {
  chug = require('../chug');
});

// TODO: Keep a token manifest with counts under ".cache".
var shrinker = module.exports = {

  patterns: [
    /(^|[^A-Z0-9])(_[A-Z][_A-Z0-9]+)/gi
  ],

  tokenCount: 0,

  tokens: {},

  replacementCharacters: 'abcdefghijklmnopqrstuvwxyz',

  reset: function reset() {
    shrinker.tokenCount = 0;
    shrinker.tokens = {};
  },

  createToken: function createToken(text) {
    shrinker.tokens[text] = {
      text: text,
      replacement: shrinker.getNextReplacement(),
      count: 0
    };
    return shrinker.tokens[text];
  },

  skipPattern: /^(|do|id|in|if|for|new|try|var|case|else|this|void|with)$/,

  getNextReplacement: function getNextReplacement() {
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

  shrink: function shrink(minified) {
    var isFunction = (typeof minified == 'function');
    var code = minified.toString();
    shrinker.patterns.forEach(function (pattern) {
      code = code.replace(pattern, function (match, first, text) {
        var token = shrinker.tokens[text] || shrinker.createToken(text);
        token.count++;
        return first + token.replacement;
      });
    });
    if (isFunction) {
      eval('eval.f=' + code); // jshint ignore: line
      code = eval.f;
      var cache = minified.cache;
      if (cache) {
        cache.min = cache.min || {};
        // We must use "key" because function "name" is immutable.
        cache.min[minified.key] = code;
        code.cache = cache.min;
      }
    }
    return code;
  }
};
