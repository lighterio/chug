var fs = require('fs');
var File = require(__dirname + '/file');
var Asset = require(__dirname + '/asset');
var Waiter = require(__dirname + '/waiter');
var filters = {
  pack: require(__dirname + '/pack')
};

// Mitigate circular dependency.
function getChug() {
  return require('../chug');
}

var fileRoot = process.cwd() + '/';

/**
 * A load is a set of assets on which chaining operations can be performed.
 */
var Load = module.exports = Waiter.extend({

  init: function (location, parent) {
    var self = this;
    Waiter.call(self, parent);
    self.locations = [];
    self.assets = [];
    self.watchablePaths = [];
    self.watchQueue = [];
    self.isWatching = false;
    self.isReplaying = false;
    self.replayableActions = [];
    self.changedLocation = '';
    self.ignoreList = [];
    if (location) {
      self.add(location);
    }
    self.then(function () {
      self.assets.sort(self.customSort || function (a, b) {
        var difference = a.sortIndex - b.sortIndex;
        if (difference) {
          return difference;
        }
        else {
          return a.location < b.location ? -1 : 1;
        }
      });
    });
  },

  /**
   * Add an array, file or directory of assets to the Load.
   */
  add: function (location) {
    var self = this;
    if (location instanceof Array) {
      location.forEach(function (location) {
        self.add(location);
      });
    }
    else if (typeof location == 'string') {

      // Extract a filter, such as "pack" for webpack.
      var filter;
      location = location.replace(/^(pack):/, function (match, name) {
        filter = name;
        return '';
      });

      // Build an absolute path.
      var path = location;
      if (path[0] != '/') {
        path = fileRoot + path;
      }
      var star = path.indexOf('*');
      if (star >= 0) {
        var pattern = path;
        pattern = pattern.replace(/\*/g, '~');
        pattern = pattern.replace(/([^\d\w_-])/gi, '\\$1');
        pattern = pattern.replace(/\\~/g, '.*');
        self.pattern = new RegExp('^' + pattern + '$');
        path = path.replace(/\/?\*.*$/, '');
      }

      if (!self.isReady) {
        self.locations.push(path);
      }
      self.addPath(path, filter, 0);
    }
    else {
      getChug()._logger.error("Unexpected location type: " + JSON.stringify(location));
    }
  },

  /**
   * Add a file or directory to a potential fs.watch list.
   */
  addWatchable: function (path) {
    var self = this;
    self.watchablePaths.push(path);
  },

  /**
   * Load a file with a given path, populating this Load with File assets.
   */
  addPath: function (path, filter, dirDepth) {
    var self = this;
    self.wait();
    fs.stat(path, function (err, stat) {
      if (err) {
        getChug()._logger.error('Could not stat file: ' + path, err.stack);
      }
      else if (filter) {
        var AssetType = filters[filter];
        self.addAsset(AssetType, path, stat);
      }
      else if (stat.isDirectory()) {
        self.addDir(path, dirDepth, stat);
      }
      else if (!self.pattern || self.pattern.test(path)) {
        self.addAsset(File, path, stat);
      }

      if (stat && (stat.isDirectory() || !dirDepth)) {
        if (filter) {
          path = filter + ':' + path;
        }
        self.addWatchable(path);
      }
      self.unwait();
    });

  },

  /**
   * Read a directory, adding its files and subdirectories to the Load.
   */
  addDir: function (dir, dirDepth, stat) {
    var self = this;
    self.wait();
    fs.readdir(dir, function (err, files) {
      if (err) {
        self.unwait();
        getChug()._logger.error('Could not load directory: ' + dir, err);
        return;
      }
      files.forEach(function (name) {
        var shouldIgnore = getChug()._ignorePattern.test(name);
        self.ignoreList.forEach(function (filenameOrPattern) {
          if (typeof filenameOrPattern == 'string') {
            shouldIgnore = shouldIgnore || (name == filenameOrPattern);
          } else {
            shouldIgnore = shouldIgnore || filenameOrPattern.test(name);
          }
        });
        if (!shouldIgnore) {
          var path = dir + '/' + name;
          self.addPath(path, null, dirDepth + 1);
        }
      });
      self.unwait();
    });
  },

  /**
   * Get an asset from cache if possible, otherwise create it.
   */
  addAsset: function (assetType, location, stat) {
    var self = this;
    var chug = getChug();
    var asset = chug.cache.get(location);
    var modified = (stat || 0).mtime || 0;
    if (asset && (modified == asset.modified)) {
      asset.addParent(self);
    }
    else {
      asset = new assetType(location, stat, self);
      chug.cache.set(location, asset);
    }
    self.assets.push(asset);
    return asset;
  },

  /**
   * Ignore files with a given name or matching a pattern.
   */
  ignore: function (filenameOrPattern) {
    var self = this;
    self.ignoreList.push(filenameOrPattern);
    return self;
  },

  /**
   * Run a callback on each asset in the load once they're all loaded.
   */
  each: function (assetCallback) {
    var self = this;

    // Make sure we can replay this action when assets are modified.
    self.addReplayableAction(self.each, arguments);

    self.onceReady(function () {

      // If we're replaying actions, only replay on assets that may have changed.
      if (self.isReplaying) {
        self.assets.forEach(function (asset) {
          if (asset.location.indexOf(self.changedLocation) === 0){
            assetCallback(asset);
          }
        });
      }
      // Otherwise, perform the action on everything.
      else {
        self.assets.forEach(assetCallback);
      }
    });
    return self;
  },

  /**
   * Return a list of asset locations, or pass the list to a callback.
   */
  getLocations: function (callback) {
    var self = this;
    var locations = [];

    function pushLocation(asset) {
      locations.push(asset.location);
    }

    // If a callback is passed in, pass the list after iterating asynchronously.
    if (callback) {
      return self
        .each(pushLocation)
        .then(function () {
          callback(locations);
        });
    }

    // If there was no callback, just return the list of assets that are already loaded.
    self.assets.forEach(pushLocation);
    return locations;
  },

  /**
   * Return a HTML tags to refer to these assets.
   */
  getTags: function (path, callback) {
    var self = this;
    var tags = '';

    // Path is optional, so the first argument might actually be the callback.
    if (typeof path == 'function') {
      callback = path;
      path = null;
    }

    // Path defaults to empty string.
    if (typeof path != 'string') {
      path = '';
    }

    function pushTag(asset) {
      var language = '';
      var location = asset.location.replace(/\.([a-z]+)$/, function (match, extension) {
        language = getChug()._targetLanguages[extension] || extension;
        return '.' + language;
      });
      if (location.indexOf(fileRoot) === 0) {
        location = location.substr(fileRoot.length - 1);
      }
      if (language == 'js') {
        tags += '<script src="' + path + location + '"></script>';
      }
      else if (language == 'css') {
        tags += '<link rel="stylesheet" href="' + path + location + '">';
      }
    }

    // If a callback is passed in, pass the tags after iterating asynchronously.
    if (callback) {
      return self
        .each(pushTag)
        .then(function () {
          callback(tags);
        });
    }

    // If there was no callback, just return tags for assets that are already loaded.
    self.assets.forEach(pushTag);
    return tags;
  },

  /**
   * Add an action that can be replayed after fs.watch sees changes.
   */
  addReplayableAction: function () {
    if (!this.isReplaying) {
      this.replayableActions.push(arguments);
    }
  },

  /**
   * Replay actions after fs.watch sees changes.
   */
  replayActions: function (location) {
    var self = this;
    self.changedLocation = getChug().changedLocation = location;
    self.isReplaying = true;
    self.replayableActions.forEach(function (action) {
      var method = action[0];
      var args = action[1];
      method.apply(self, args);
    });
    self.onceReady(function () {
      self.isReplaying = false;
    });
  },

  /**
   * Execute a callback once the load is ready.
   */
  then: function (callback) {
    var self = this;
    self.addReplayableAction(self.then, arguments);
    self.onceReady(function () {
      callback.apply(self);
    });
    return self;
  },

  /**
   * Concatenate assets into a new asset in a new or existing load.
   */
  concat: function (location, load) {
    var self = this;
    var isExistingLoad = !!load;

    // Get or create the load that will contain the concatenated content.
    load = isExistingLoad ? load : getChug()();

    // Create a reference to the load that was concatenated.
    load.sourceLoad = self;

    // Sort if we haven't already.
    if (!self.hasOwnProperty('customSort')) {
      self.sort();
    }

    self.addReplayableAction(self.concat, [location, load]);
    load.wait();
    if (!location) {
      location = self.locations[0].replace(/\*/, 'all');
    }
    self.then(function () {
      var content = '';
      self.assets.forEach(function (asset) {
        // TODO: Perform concat either before or after compile.
        content += asset.getCompiledContent();
        if (asset.type == 'js') {
          content += ';';
        }
      });
      if (load.assets.length < 1) {
        load.addAsset(Asset, location);
      }
      var asset = load.assets[0];
      asset.setContent(content);
      if (isExistingLoad) {
        load.replayActions(asset.location);
      }
      load.unwait();
    });
    return load;
  },

  /**
   * Watch the watchable paths for changes.
   */
  watch: function (callback) {
    var self = this;
    if (callback) {
      self.watchQueue.push(callback);
    }
    if (!self.isWatching) {
      self.onceReady(function () {
        self.watchablePaths.forEach(function (path) {
          // Extract a filter, such as "pack" for webpack.
          var filter;
          path = path.replace(/^(pack):/, function (match, name) {
            filter = name;
            return '';
          });

          fs.watch(path, function (event, filename) {
            var server = getChug()._server;
            // Update the cache bust so that changes can actually be seen.
            if (server) {
              server._cacheBust = Math.round(Date.now() / 1e3);
            }

            // Ignore JetBrains backup files.
            if (/___$/.test(filename)) {
              return;
            }

            var file = path + (filename ? '/' + filename : '');
            self.handleChange(file, filter, path);
            self.onceReady(function () {
              self.watchQueue.forEach(function (callback) {
                callback.call(self, file, event);
              });
            });
          });
        });
      });
      self.isWatching = true;
    }
    return self;
  },

  /**
   * Handle a change to a location after an fs.watch event.
   */
  handleChange: function (location, filter, path) {
    var self = this;

    // The location may have been deleted or moved, so we need to check its existence.
    self.wait();
    log('handleChange', location);
    fs.exists(location, function (exists) {

      // If the location exists, it may or may not be new.
      if (exists) {

        // The location exists, so re-read it or any sub-directory assets.
        var matchCount = 0;
        self.assets.forEach(function (asset) {
          // Special asset handling with pack filter
          if (filter) {
            matchCount = asset.location.indexOf(path) === 0 ? matchCount + 1 : matchCount;
          } else if (asset.location.indexOf(location) === 0) {
            asset.readFile();
            matchCount++;
          }
        });

        // If there were no matches, this thing is new, so add it.
        if (!matchCount) {
          self.add(location);
        }
      }

      // The location no longer exists, so we need to get rid of its assets.
      else {

        // Get rid of it by rebuilding the asset array.
        var assets = [];
        self.assets.forEach(function (asset) {

          // Assets that are under (or are) the deleted location must be
          // removed from cache and not added to the assets array.
          if (asset.location.indexOf(location) === 0) {
            getChug().cache.remove(asset.location);
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

    // Once changes have been applied, we can replay previously-run actions.
    self.onceReady(function () {
      self.replayActions(location);
    });

    return self;
  },

  /**
   * Apply a custom sorting function.
   */
  sort: function (customSort) {
    var self = this;
    if (customSort) {
      self.customSort = customSort;
      self.assets.sort(customSort);
    }
    return self;
  }

});

['compile', 'cull', 'wrap', 'minify', 'gzip',
  'replace', 'route', 'write', 'require'].forEach(function (method) {
  Load.prototype[method] = function () {
    var args = arguments;
    return this.each(function (asset) {
      asset[method].apply(asset, args);
    });
  };
});
