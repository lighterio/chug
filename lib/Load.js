var fs = require('fs');
var File = require('./File');
var Asset = require('./Asset');
var Waiter = require('./Waiter');

var chug;
setImmediate(function immediatelySetChug() {
	chug = require('../chug');
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
		self.watchablePaths = [];
		self.watchQueue = [];
		self.isWatching = false;
		self.concatAssets = [];
		self.isReplaying = false;
		self.replayableActions = [];
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
			self.addFile(path, 0);
		}
		else {
			chug.error("Unexpected location type: " + JSON.stringify(location));
		}
		return self;
	},

	/**
	 * Add a file or directory to a potential fs.watch list.
	 * @param path
	 * @returns {Load}
	 */
	addWatchable: function addWatchable(path) {
		var self = this;
		self.watchablePaths.push(path);
		return self;
	},

	/**
	 * Load a file with a given path, populating this Load with File assets.
	 * @param path
	 * @param depth
	 * @returns {Load}
	 */
	addFile: function addFile(path, depth) {
		var self = this;
		self.wait();
		fs.stat(path, function statFile(err, stat) {
			if (err) {
				self.unwait();
				return self;
			}
			if (stat.isDirectory()) {
				self.addDir(path, depth);
			} else {
				self.addAsset(File, path);
			}
			self.unwait();
		});
		if (depth == 0) {
			self.addWatchable(path);
		}
		return self;
	},

	/**
	 * Read a directory, adding its files and subdirectories to the Load.
	 * @param dir
	 * @returns {Load}
	 */
	addDir: function addDir(dir, depth) {
		var self = this;
		self.wait();
		fs.readdir(dir, function processDir(err, files) {
			chug = require('../chug');
			if (err) {
				self.unwait();
				chug.error('Could not load directory: ' + dir, err);
				return self;
			}
			files.forEach(function processFile(name) {
				if (!chug.ignorePattern.test(name)) {
					var path = dir + '/' + name;
					self.addFile(path, depth + 1);
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
		chug = require('../chug');
		var asset = chug.cache[location];
		if (asset) {
			asset.addParent(self);
		}
		else {
			asset = new assetType(location, self);
			chug.cache[location] = asset;
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
		self.addReplayableAction(self.each, arguments);
		self.onReady(function onReadyEach() {
			self.assets.forEach(assetCallback);
			if (finishedCallback) {
				finishedCallback();
			}
		});
		return self;
	},

	/**
	 * Add an action that can be replayed after fs.watch sees changes.
	 * @param callback
	 * @returns {Load}
	 */
	addReplayableAction: function addReplayableAction() {
		if (!this.isReplaying) {
			this.replayableActions.push(arguments);
		}
	},

	/**
	 * Replay actions after fs.watch sees changes.
	 * @param callback
	 * @returns {Load}
	 */
	replayActions: function replayActions() {
		var self = this;
		self.isReplaying = true;
		self.replayableActions.forEach(function (action) {
			var method = action[0];
			var args = action[1];
			method.apply(self, args);
		});
		self.then(function () {
			self.isReplaying = false;
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
		self.addReplayableAction(self.then, arguments);
		self.onReady(function onReadyThen() {
			callback.apply(self);
		});
		return self;
	},

	/**
	 * Concatenate assets into a new asset in a new load.
	 * @param location
	 */
	concat: function(location) {
		var self = this;
		chug = require('../chug');
		var load = chug();
		load.wait();
		var content = '';
		if (!location) {
			location = self.location.replace(/\*/, 'all');
		}
		self.each(function concatOne(asset) {
			content += (asset.compiledContent || asset.content);
		}, function concatDone() {
			load.addAsset(Asset, location);
			var asset = load.assets[0];
			asset.setContent(content);
			load.unwait();
			self.concatAssets.push(asset);
		});
		return load;
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
	},

	/**
	 * Add each asset as an app route.
	 * @returns {Load}
	 */
	route: function route() {
		var args = arguments;
		return this.each(function routeOne(asset) {
			asset.route.apply(asset, args);
		});
	},

	/**
	 * Watch the watchable paths for changes.
	 * @returns {Load}
	 */
	watch: function watch(callback) {
		var self = this;
		if (callback) {
			self.watchQueue.push(callback);
		}
		if (!self.isWatching) {
			self.watchablePaths.forEach(function eachWatchablePath(path) {
				fs.watch(path, function (event, filename) {

					// Ignore JetBrains backup files.
					if (/___$/.test(filename)) {
						return;
					}

					self.handleChange(path + '/' + filename);
					self.onReady(function watchReady() {
						self.watchQueue.forEach(function (callback) {
							callback.apply(self, [event, filename, path]);
						});
					});
				});
			});
		}
		self.isWatching = true;
		return self;
	},

	/**
	 * Handle a change to a path after an fs.watch event.
	 */
	handleChange: function handleChange(path) {
		var self = this;

		self.onReady(function onReadyReplay() {
			self.replayActions();
		});

		// The path may have been deleted or moved, so we need to check its existence.
		self.wait();
		fs.exists(path, function handleChangeExists(exists) {

			// If the path exists, it may or may not be new.
			if (exists) {

				// The path exists, so re-read it or any sub-directory assets.
				var matchCount = 0;
				self.assets.forEach(function updateEach(asset) {
					if (asset.location.indexOf(path) === 0) {
						asset.readFile();
						matchCount++;
					}
				});

				// If there were no matches, this thing is new, so add it.
				if (!matchCount) {
					self.add(path);
				}
			}

			// The path no longer exists, so we need to get rid of assets on that path.
			else {

				// Get rid of it by rebuilding the asset array.
				var assets = [];
				self.assets.forEach(function updateEach(asset) {

					// Assets that are under the deleted path (or are the deleted path)
					// must be deleted from cache and not added to the assets array.
					if (asset.location.indexOf(path) === 0) {
						chug = require('../chug');
						delete chug.cache[asset.location];
					}
					// Assets that didn't match are unaffected, so reference them.
					else {
						assets.push(asset);
					}
				});
				self.assets = assets;
			}
			self.unwait();
		});

		// If this load has been concatenated to form assets for other loads, update them.
		var content = '';
		self.each(function concatOne(asset) {
			content += (asset.compiledContent || asset.content);
		}, function concatDone() {
			self.concatAssets.forEach(function concatAssetSetContent(asset) {
				asset.setContent(content);
			});
		});

		return self;
	}
});