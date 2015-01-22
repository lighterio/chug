var fs = require('fs');
var Asset = require(__dirname + '/asset');
var mime = require(__dirname + '/mime');

var chug;
setImmediate(function immediatelySetChug() {
  chug = require('../chug');
});

/**
 * An Asset is an in-memory representation of a file.
 */
var File = module.exports = Asset.extend({

  init: function (path, stat, load) {
    var self = this;
    Asset.prototype.init.apply(self, arguments);
    self.wait();
    setImmediate(function () {
      self.readFile();
      self.unwait();
    });
  },

  /**
   * Read from the file system and set content on this asset.
   */
  readFile: function () {
    var self = this;
    var path = self.location;
    self.wait();
    fs.readFile(path, function (err, content) {
      if (err) {
        chug._logger.error('Failed to load file: ' + path);
      }
      else {
        self.handleContent(content);
      }
      self.unwait();
    });
  },

  /**
   * Handle a content buffer.
   */
  handleContent: function (content) {
    var self = this;
    var type = mime[self.type] || 'text';
    if (/text/.test(type)) {
      content = '' + content;
    }
    self.setContent(content);
  }

});