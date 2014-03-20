var fs = require('fs');
var Asset = require('./Asset');

var api;
setImmediate(function () {
	api = require('../lighter-load');
});

/**
 * An Asset is an in-memory representation of a file.
 * @param path
 * @constructor
 */
var File = module.exports = Asset.extend({

	init: function (path) {
		var self = this;
		self._super(path);
		self.wait();
		fs.readFile(path, function (err, content) {
			if (err) {
				self.unwait();
				api.error('Failed to load file: ' + path);
				return self;
			}
			self.setContent('' + content);
			self.unwait();
		});
	}

});
