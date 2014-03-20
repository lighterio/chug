var fs = require('fs');
var File = require('./File');
var Waiter = require('./Waiter');

var api;
setImmediate(function () {
	api = require('../lighter-load');
});

var fileRoot = process.cwd() + '/';

/**
 * A load is a set of assets on which chaining operations can be performed.
 * @param path
 * @constructor
 */
var Load = module.exports = Waiter.extend({

	init: function (location, parent) {
		var self = this;
		self._super();
		self.waiters.push(parent);
		self.assets = [];
		if (location) {
			self.add(location);
		}
		return self;
	},

	/**
	 * Add an array, file or directory of assets to the Load.
	 * @param location
	 * @returns {Load}
	 */
	add: function (location) {
		var self = this;
		if (location instanceof Array) {
			location.forEach(function (path) {
				self.add(path);
			});
		}
		else if (typeof location == 'string') {
			var path = location;
			if (path.substr(0, 13) == 'node_modules/') {
				path = path.substr(13);
				path = require.resolve(path);
			} else if (path[0] != '/') {
				path = fileRoot + path;
			}
			self.file(path);
		}
		else {
			api.error("Unexpected location type: " + JSON.stringify(location));
		}
		return self;
	},

	/**
	 * Load a file with a given path, populating this Load with File assets.
	 * @param path
	 * @returns {Load}
	 */
	file: function (path) {
		var self = this;
		self.wait();
		fs.stat(path, function (err, stat) {
			if (err) {
				self.unwait();
				return self;
			}
			if (stat.isDirectory()) {
				self.dir(path);
			} else {
				var asset = self.asset(File, path);
				self.assets.push(asset);
			}
			self.unwait();
		});
		return self;
	},

	/**
	 * Read a directory, adding its files and subdirectories to the Load.
	 * @param dir
	 * @returns {Load}
	 */
	dir: function (dir) {
		var self = this;
		self.wait();
		fs.readdir(dir, function (err, files) {
			if (err) {
				self.unwait();
				api.error('Could not load directory: ' + dir, err);
				return self;
			}
			files.forEach(function (name) {
				if (!api.ignorePattern.test(name)) {
					var path = dir + '/' + name;
					self.file(path);
				}
			});
			self.unwait();
		});
		return self;
	},

	/**
	 * Get an asset from cache if possible, otherwise create it.
	 * @param assetType
	 * @param location
	 * @returns {Load}
	 */
	asset: function (assetType, location) {
		var asset = api.cache[location];
		if (!asset) {
			asset = new assetType(location);
			api.cache[location] = asset;
		}
		return asset;
	}

});