var chug = require('../chug');
var File = require('../lib/File');

describe('File', function () {
  var file = new File('test/FileTest.js');
  it('should have its path as its location', function () {
    is(file.location, 'test/FileTest.js');
  });
  it('should load content', function (done) {
    file.onceReady(function () {
      is(typeof file.content, 'string');
      is(file.content.length > 0, true);
      done();
    });
  });
  it('should load an icon without converting to string', function (done) {
    var icon = new File('test/icons/chug.ico');
    icon.onceReady(function () {
      chug.enableShrinking();
      is(typeof icon.content, 'object');

      // Shouldn't compile, shrink or minify.
      icon.compile().minify().onceReady(function () {
        is(icon.getMinifiedContent(), icon.content);
        chug._shrinker = null;
        done();
      });
    });
  });
});
