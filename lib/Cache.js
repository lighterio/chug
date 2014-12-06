var fs = require('fs');
var Waiter = require(__dirname + '/waiter');
var fileRoot = process.cwd() + '/';
var chug;
setImmediate(function () {
  chug = require('../chug');
});


/**
 * The Cache stores assets in a single file for fast reloading.
 */
var Cache = module.exports = Waiter.extend({

  _store: {},

  /**
   * Get a key from the cache
   */
  get: function (key) {
    return this._store[key];
  },

  /**
   * Set a key in the cache.
   */
  set: function (key, value) {
    return this._store[key] = value;
  },

  /**
   * Remove a key from the cache.
   */
  remove: function (key) {
    delete this._store[key];
  },

  /**
   * Write the cache to a file.
   */
  write: function () {
  },

  /**
   * Write the cache to a file.
   */
  clear: function () {
    this._store = {};
  },

  /**
   * Iterate over the elements in the cache.
   */
  each: function (callback) {
    var store = this._store;
    for (var property in store) {
      if (store.hasOwnProperty(property)) {
        callback(store[property], property);
      }
    }
  }

});