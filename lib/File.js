var fs = require('fs');
var Asset = require('./Asset');
var mime = require('./mime');

var chug;
setImmediate(function immediatelySetChug() {
	chug = require('../chug');
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
		setImmediate(function immediatelyReadFile() {
			self.readFile();
			self.unwait();
		});
	},

	/**
	 * Read from the file system and set content on this asset.
	 */
	readFile: function readFile() {
		var self = this;
		var path = self.location;
		self.wait();
		fs.readFile(path, function processFile(err, content) {
			if (err) {
				self.unwait();
				chug._logger.error('Failed to load file: ' + path);
				return self;
			}
			var mimeType = mime[self.type] || 'text';
			if (/text/.test(mimeType)) {
				content = '' + content;
			}
			self.setContent(content);
			self.unwait();
		});
	}

});