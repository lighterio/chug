var fs = require('fs');
var Asset = require('./Asset');

var api;
setImmediate(function immediatelySetApi() {
	api = require('../api');
});

/**
 * An Asset is an in-memory representation of a file.
 * @param path
 * @constructor
 */
var File = module.exports = Asset.extend({

	init: function init(path, load) {
		var self = this;
		self._super(path, load);
		self.wait();
		setImmediate(function immediatelyLoadContent() {
			self.loadContent();
			self.unwait();
		});
	},

	loadContent: function loadContent() {
		var self = this;
		var path = self.location;
		self.wait();
		fs.readFile(path, function processFile(err, content) {
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