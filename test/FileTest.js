var chug = require('../chug');
var File = require('../lib/File');
var assert = require('assert-plus');

describe('File', function () {
  var file = new File('test/FileTest.js');
  it('should have its path as its location', function () {
    assert.equal(file.location, 'test/FileTest.js');
  });
  it('should have an empty collection of dependents', function () {
    assert.equal(JSON.stringify(file.dependents), '[]');
  });
  it('should load content', function (done) {
    file.onceReady(function () {
      assert.equal(typeof file.content, 'string');
      assert.equal(file.content.length > 0, true);
      done();
    });
  });
  it('should load an icon without converting to string', function (done) {
    var icon = new File('test/icons/chug.ico');
    icon.onceReady(function () {
      chug.enableShrinking();
      assert.equal(typeof icon.content, 'object');

      // Shouldn't compile, shrink or minify.
      icon.compile().minify().onceReady(function () {
        assert.equal(icon.getMinifiedContent(), icon.content);
        chug._shrinker = null;
        done();
      });
    });
  });
});