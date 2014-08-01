var chug = require('../chug');

require('zeriousify').test();

describe('API', function () {
  before(function () {
    chug.waitCount = 0;
    chug.isReady = false;
    chug.onceReadyQueue = [];
  });
  it('should be a function', function () {
    is.function(chug);
  });
  describe('version', function () {
    var packageVersion = require('../package.json').version;
    it('should be ' + packageVersion, function () {
      var chugVersion = chug.version;
      is(chugVersion, packageVersion);
    });
  });
  describe('setCompiler', function () {
    it('should be a function', function () {
      is.function(chug.setCompiler);
    });
    it('should set a compiler', function () {
      chug.setCompiler('coffee', 'coffee-script');
      is.function(chug._compilers.coffee.compile);
    });
  });
  describe('setMinifier', function () {
    it('should be a function', function () {
      is.function(chug.setMinifier);
    });
    it('should set a minifier', function () {
      chug.setMinifier('js', 'uglify-js');
      is.function(chug._minifiers.js.minify);
    });
  });
  describe('setServer', function () {
    var server = require('express')();
    it('should be a function', function () {
      is.function(chug.setServer);
    });
    it('should set the server', function () {
      chug.setServer(server);
      is.function(chug._server.get);
    });
  });
});
