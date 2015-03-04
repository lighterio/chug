var File = require(__dirname + '/file');
var Asset = require(__dirname + '/asset');

/**
 * A filter creates an asset by passing a load through another library.
 */
module.exports = File.extend({

  init: function (path, stat, load) {
    var self = this;
    Asset.prototype.init.apply(self, arguments);
    self.wait();
    log(path);
    self.unwait();
  }

});
