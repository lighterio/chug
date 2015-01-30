var fs = require('fs');
var Asset = require(__dirname + '/asset');
var File = require(__dirname + '/file');
var dive = require('../common/fs/dive-file-paths');
var Type = require('../common/object/type');
var path = require('path');

/**
 * A Pack runs webpack and outputs the resulting file content.
 */
var Pack = module.exports = File.extend({

  init: function (path, stat, load) {
    var self = this;
    var webpack = require('webpack');
    Asset.prototype.init.apply(self, arguments);
    self.wait();
    dive(path, function (paths) {

      var fs = new BypassFs();

      var fn = function (err, stats) {
        var name = stats.toJson().assets[0].name;
        var type = name.replace(/^.*\./, '');
        if (self.type != type) {
          self.type = type;
          self.path += '.' + type;
          self.location += '.' + type;
        }
        self.handleContent(fs.content);
        self.unwait();
      };

      var compiler = webpack({entry: paths}, fn);
      compiler.outputFileSystem = fs;

      // Check for changes once every 200ms.
      // TODO: Handle entry point changes in packed directories.
      compiler.watch(200, function (err, stats) {

        // Wait for compilation to return assets, and call the handler.
        self.wait();
        fn(err, stats);

        // Replay anything that depends on changes in this asset's load.
        load.onceReady(function () {
          load.replayActions(self.location);
        });
      });

    });
  }

});


/**
 * Bypass the file system with a fake one of our own.
 */
var BypassFs = Type.extend({

  // Remember the content, and call back without an error.
  writeFile: function (path, content, fn) {
    this.content = content;
    fn();
  },

  // Call back without an error.
  mkdirp: function (path, fn) {
    fn();
  },

  // Join a directory and filename, and return a path.
  join: function (dir, file) {
    return path.join(dir, file);
  }

});