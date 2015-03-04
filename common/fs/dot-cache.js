/**
 * Dive asynchronously into a path, and call back with an array of files
 * that exist under it. Do not follow symbolic links.
 *
 * @origin https://github.com/lighterio/lighter-common/common/fs/dot-cache.js
 * @version 0.0.1
 * @import fs/mkdirp
 * @import object/type
 */

var fs = require('fs');
var mkdirp = require('../../common/fs/mkdirp');
var Type = require('../../common/object/type');
var dirname = require('path').dirname;

/**
 * A DotCache object allows cache directories and files to be written.
 * @type {DotCache}
 */
var DotCache = module.exports = Type.extend({

  // When an error happens, log to the console.
  log: console,

  // Build a cache under the current working directory.
  cwd: process.cwd(),

  // Use ".cache" as the caching directory.
  dir: process.cwd() + '/.cache/',

  /**
   * Construct a new cacher, overriding properties with any provided options.
   *
   * @param  {Object} options  Overrides for properties like "log" and "dir".
   */
  init: function (options) {
    var self = this;
    Type.decorate(self, options);
    self.dir = self.dir.replace(/[\/\\]?$/, '/');
  },

  /**
   * Asynchronously write content to a path under the .cache directory.
   *
   * @param  {String}        namespace  An optional cache subdirectory.
   * @param  {String}        path       A path under the namespace.
   * @param  {String|Buffer} content    Content to write.
   * @param  {Function}      fn         A function to call on error or success.
   */
  write: function (name, path, content, fn) {
    var self = this;
    path = self.dir + name + path.replace(/^[\.\/\\]*/, '/');
    if (typeof content != 'string' && !(content instanceof Buffer)) {
      content = content.toString();
    }

    var dir = dirname(path);
    mkdirp(dir, function (error) {
      if (error) {
        if (fn) {
          fn(error);
        }
        else {
          self.log.error(error);
        }
      }
      else {
        fs.writeFile(path, content, function (error) {
          if (fn) {
            fn(error, path);
          }
          else if (error) {
            self.log.error(error);
          }
        });
      }
    });

  }

});

// Make a base cacher with default options.
DotCache.default = new DotCache();

/**
 * Export a factory function for creating new cachers.
 * @param  {Object}   options  An optional options object.
 * @return {DotCache}          The new (or existing) cacher.
 */
DotCache.create = function (options) {
  return options ? new DotCache(options) : DotCache.default;
};
