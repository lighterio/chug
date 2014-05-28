var assert = require('assert-plus');
var chug = require('../chug');

require('zeriousify').test();

describe('API', function () {
  before(function () {
    chug.waitCount = 0;
    chug.isReady = false;
    chug.onceReadyQueue = [];
  });
  it('should be a function', function () {
    assert.func(chug);
  });
  describe('version', function () {
    var packageVersion = require('../package.json').version;
    it('should be ' + packageVersion, function () {
      var chugVersion = chug.version;
      assert.equal(chugVersion, packageVersion);
    });
  });
  describe('setCompiler', function () {
    it('should be a function', function () {
      assert.func(chug.setCompiler);
    });
    it('should set a compiler', function () {
      chug.setCompiler('coffee', 'coffee-script');
      assert.func(chug._compilers.coffee.compile);
    });
  });
  describe('setMinifier', function () {
    it('should be a function', function () {
      assert.func(chug.setMinifier);
    });
    it('should set a minifier', function () {
      chug.setMinifier('js', 'uglify-js');
      assert.func(chug._minifiers.js.minify);
    });
  });
  describe('setServer', function () {
    var server = require('express')();
    it('should be a function', function () {
      assert.func(chug.setServer);
    });
    it('should set the server', function () {
      chug.setServer(server);
      assert.func(chug._server.get);
    });
  });
});