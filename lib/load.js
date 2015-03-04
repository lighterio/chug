var fs = require('fs');
var chug = require('../chug');
var File = require(__dirname + '/file');
var Asset = require(__dirname + '/asset');
var Waiter = require(__dirname + '/waiter');
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
    self.concatWithLineBreaks = true;
    self.language = undefined;

    if (location) {
      self.add(location);
    }
    self.then(function () {
      self.sort();
    });
  },

  /**
   * Add an asset, array, file or directory of assets to the Load.
   */
  add: function (item) {
    var self = this;

    // An asset can be mapped if it hasn't been already.
    if (item.minify) {
      var asset = item;
      var location = asset.location;
      var mapped = self.assets[location];
      if (!mapped) {
        self.assets.push(asset);
        self.assets[location] = asset;
        asset.addParent(self);
        self.sort();
      }
    }

    // Arrays' items can be iteratively added.
    else if (item instanceof Array) {
      item.forEach(function (path) {
        self.add(path);
      });
    }

    // Strings can be added as file or filter locations.
    else if (typeof item == 'string') {

      // Extract a filter, such as "pack" for webpack.
      var filter;
      item = item.replace(/^([a-z]+):/, function (match, name) {
        filter = name;
        return '';
      });

      // Build an absolute path.
      var path = item;
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
      chug.log.error('[Chug] Unexpected location type: ' + JSON.stringify(item));
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
        chug.log.error('[Chug] Could not stat file: ' + path, err.stack);
      }
      else if (filter) {
        var AssetType = chug._filters[filter];
        self.addAsset(AssetType, path, stat);
      }
      else if (stat.isDirectory()) {
        self.addDir(path, dirDepth, stat);
      }
      else if (!self.pattern || self.pattern.test(path)) {
        self.addAsset(File, path, stat);
      }
      if (stat && !filter && (stat.isDirectory() || !dirDepth)) {
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
        chug.log.error('[Chug] Could not load directory: ' + dir, err);
        return;
      }
      files.forEach(function (name) {
        var shouldIgnore = chug._ignorePattern.test(name);
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
    var asset = chug.cache.get(location);
    if (asset) {
      asset.addParent(self);
    }
    else {
      asset = new assetType(location, stat, self);
      chug.cache.set(location, asset);
    }
    self.add(asset);
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
   * Run a function on each asset in the load once they're all loaded.
   */
  each: function (assetFn) {
    var self = this;

    // Make sure we can replay this action when assets are modified.
    self.addReplayableAction(self.each, arguments);

    self.onceReady(function () {

      // If we're replaying actions, only replay on assets that may have changed.
      if (self.isReplaying) {
        self.assets.forEach(function (asset) {
          if (asset.location.indexOf(self.changedLocation) === 0){
            assetFn(asset);
          }
        });
      }
      // Otherwise, perform the action on everything.
      else {
        self.assets.forEach(assetFn);
      }
    });
    return self;
  },

  /**
   * Return a list of asset locations, or pass the list to a function.
   */
  getLocations: function (fn) {
    var self = this;
    var locations = [];

    function pushLocation(asset) {
      locations.push(asset.location);
    }

    // If a function is passed in, pass the list after iterating asynchronously.
    if (fn) {
      return self
        .each(pushLocation)
        .then(function () {
          fn(locations);
        });
    }

    // If there was no fn, just return the list of assets that are already loaded.
    self.assets.forEach(pushLocation);
    return locations;
  },

  /**
   * Return a string of HTML tags to refer to the assets in this load.
   */
  getTags: function (path, fn) {
    var self = this;
    var tags = '';

    // Path is optional, so the first argument might actually be the function.
    if (typeof path == 'function') {
      fn = path;
      path = null;
    }

    // Path defaults to empty string.
    if (typeof path != 'string') {
      path = '';
    }

    function appendTag(asset) {
      asset.eachTarget('compiled', function (target, content, url) {
        if (target == 'js') {
          tags += '<script src="' + path + url + '"></script>';
        }
        else if (target == 'css') {
          tags += '<link rel="stylesheet" href="' + path + url + '">';
        }
      });
    }

    // If a function is passed in, pass the tags after iterating asynchronously.
    if (fn) {
      return self
        .each(appendTag)
        .then(function () {
          fn(tags);
        });
    }

    // If there was no fn, just return tags for assets that are already loaded.
    self.assets.forEach(appendTag);
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
    self.changedLocation = chug.changedLocation = location;
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
   * Execute a function once the load is ready.
   */
  then: function (fn) {
    var self = this;
    self.addReplayableAction(self.then, arguments);
    self.onceReady(function () {
      fn.apply(self);
    });
    return self;
  },

  /**
   * Concatenate assets into a new asset in a new or existing load.
   */
  concat: function (load) {
    var self = this;
    var isExistingLoad = load instanceof Load;

    // Get or create the load that will contain the concatenated content.
    load = isExistingLoad ? load : chug();

    // Create a reference to the load that was concatenated.
    load.sourceLoad = self;

    // Sort if we haven't already.
    if (!self.hasOwnProperty('customSort')) {
      self.sort();
    }

    self.addReplayableAction(self.concat, [load]);
    load.wait();
    self.then(function () {
      var content = '';
      self.assets.forEach(function (asset) {
        var compiled = asset.getCompiledContent(self.language);
        if (typeof compiled == 'string') {
          content += compiled.replace(/@use /g, '@uses ');
          if (self.concatWithLineBreaks && (content[content.length - 1] !== '\n')) {
            content += '\n';
          }
        }
      });
      if (load.assets.length < 1) {
        load.addAsset(Asset, '');
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
  watch: function (fn) {
    var self = this;
    if (fn) {
      self.watchQueue.push(fn);
    }
    if (!self.isWatching) {
      self.onceReady(function () {
        self.watchablePaths.forEach(function (path) {
          fs.watch(path, function (event, filename) {
            var server = chug.server;
            // Update the cache bust so that changes can actually be seen.
            if (server) {
              server._cacheBust = Math.round(Date.now() / 1e3);
            }

            // Ignore JetBrains backup files.
            if (/___$/.test(filename)) {
              return;
            }

            var file = path + (filename ? '/' + filename : '');
            self.handleChange(file);
            self.onceReady(function () {
              self.watchQueue.forEach(function (fn) {
                fn.call(self, file, event);
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
  handleChange: function (location) {
    var self = this;

    // The location may have been deleted or moved, so we need to check its existence.
    self.wait();
    fs.exists(location, function (exists) {

      // If the location exists, it may or may not be new.
      if (exists) {

        // The location exists, so re-read it or any sub-directory assets.
        var matchCount = 0;
        self.assets.forEach(function (asset) {
          if (asset.location.indexOf(location) === 0) {
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
            chug.cache.remove(asset.location);
          }
          // Assets that didn't match are unaffected, so reference them.
          else {
            self.add(asset);
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
  sort: function () {
    var self = this;

    // Use a custom sort function if one exists.
    var fn = self.customSort;
    if (!fn) {

      // If "@use" annotations are enabled, order by useIndex.
      if (self.uses) {
        var assets = self.assets;
        var change = 1;
        var passes = 0;
        while (change && (++passes < 1e3)) {
          change = 0;
          for (var i = 0, l = assets.length; i < l; i++) {
            var asset = assets[i];
            for (var location in asset.uses) {
              var dependency = chug.cache.map[location];
              if (dependency.useIndex >= asset.useIndex) {
                change = asset.useIndex = dependency.useIndex + 1;
              }
            }
          }
        }
        fn = function (a, b) {
          return a.useIndex - b.useIndex;
        };
      }

      // Otherwise, order by automatic sortIndex and location.
      else {
        fn = function (a, b) {
          var difference = a.sortIndex - b.sortIndex;
          if (difference) {
            return difference;
          }
          else {
            return a.location < b.location ? -1 : 1;
          }
        };
      }
    }
    self.assets.sort(fn);
    return self;
  },

  /**
   * Set use indexes for each asset based on dependencies.
   */
  use: function () {
    var self = this;
    self.uses = true;
    return self;
  }

});

['compile', 'cull', 'wrap', 'minify', 'gzip',
  'replace', 'route', 'write', 'require'].forEach(function (method) {
  Load.prototype[method] = function () {
    var self = this;
    var args = arguments;
    return self.each(function (asset) {
      if (global.wtf) {
        console.log(asset.path);
      }
      asset.load = self;
      asset[method].apply(asset, args);
    });
  };
});
