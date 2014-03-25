var fs = require('fs');
var File = require('./File');
var Asset = require('./Asset');
var Waiter = require('./Waiter');

var api;
setImmediate(function immediatelySetApi() {
	api = require('../api');
});

var fileRoot = process.cwd() + '/';

/**
 * A load is a set of assets on which chaining operations can be performed.
 * @param path
 * @constructor
 */
var Load = module.exports = Waiter.extend({

	init: function init(location, parent) {
		var self = this;
		self.location = location;
		self._super(parent);
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
	add: function add(location) {
		var self = this;
		if (location instanceof Array) {
			location.forEach(function addLocation(location) {
				self.add(location);
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
			self.addFile(path);
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
	addFile: function addFile(path) {
		var self = this;
		self.wait();
		fs.stat(path, function statFile(err, stat) {
			if (err) {
				self.unwait();
				return self;
			}
			if (stat.isDirectory()) {
				self.addDir(path);
			} else {
				self.addAsset(File, path);
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
	addDir: function addDir(dir) {
		var self = this;
		self.wait();
		fs.readdir(dir, function processDir(err, files) {
			if (err) {
				self.unwait();
				api.error('Could not load directory: ' + dir, err);
				return self;
			}
			files.forEach(function processFile(name) {
				if (!api.ignorePattern.test(name)) {
					var path = dir + '/' + name;
					self.addFile(path);
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
	addAsset: function addAsset(assetType, location) {
		var self = this;
		var asset = api.cache[location];
		if (asset) {
			asset.addParent(self);
		}
		else {
			asset = new assetType(location, self);
			api.cache[location] = asset;
		}
		self.assets.push(asset);
		return self;
	},

	/**
	 * Run a callback on each asset in the load once they're all loaded.
	 * @param callback
	 * @returns {Load}
	 */
	each: function each(assetCallback, finishedCallback) {
		var self = this;
		self.onReady(function onReadyEach() {
			self.assets.forEach(assetCallback);
			if (finishedCallback) {
				finishedCallback();
			}
		});
		return self;
	},

	/**
	 * Execute a callback once the load is ready.
	 * @param callback
	 * @returns {Load}
	 */
	then: function then(callback) {
		var self = this;
		self.onReady(function onReadyThen() {
			callback.apply(self);
		});
		return self;
	},

	/**
	 * Concatenate assets and cache them as a new location.
	 * @param location
	 */
	concat: function(location) {
		var self = this;
		var content = '';
		self.each(function concatOne(asset) {
			content += (asset.compiledContent || asset.content);
		}, function finishConcat() {
			self.assets = [];
			if (!location) {
				location = self.location.replace(/\*/, 'all');
			}
			self.addAsset(Asset, location);
			var asset = self.assets[0];
			asset.setContent(content);
		});
		return self;
	},

	/**
	 * Compile each asset.
	 * @returns {Load}
	 */
	compile: function compile() {
		var args = arguments;
		return this.each(function compileOne(asset) {
			asset.compile.apply(asset, args);
		});
	},

	/**
	 * Minify each asset's contents.
	 * @returns {Load}
	 */
	minify: function minify() {
		var args = arguments;
		return this.each(function minifyOne(asset) {
			asset.minify.apply(asset, args);
		});
	},

	/**
	 * Shrink each asset's contents.
	 * @returns {Load}
	 */
	shrink: function shrink() {
		var args = arguments;
		return this.each(function shrinkOne(asset) {
			asset.shrink.apply(asset, args);
		});
	}
});
