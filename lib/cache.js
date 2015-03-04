var Waiter = require(__dirname + '/waiter');

/**
 * The Cache stores assets for fast reloading.
 */
module.exports = Waiter.extend({

  map: {},
  list: [],

  /**
   * Get a key from the cache
   */
  get: function (key) {
    return this.map[key];
  },

  /**
   * Set a key in the cache.
   */
  set: function (key, value) {
    if (!this.map[key]) {
      this.map[key] = value;
      this.list.push(value);
    }
    return value;
  },

  /**
   * Remove a key from the cache.
   */
  remove: function (key) {
    // TODO: Implement a linked list instead, so we can easily remove items?
    delete this.map[key];
  },

  /**
   * Write the cache to a file.
   */
  write: function () {
    // TODO: Actually write it.
  },

  /**
   * Clear the cache.
   */
  clear: function () {
    this.map = {};
  },

  /**
   * Iterate over the elements in the cache.
   */
  each: function (callback) {
    var store = this.map;
    for (var property in store) {
      if (store.hasOwnProperty(property)) {
        callback(store[property], property);
      }
    }
  }

});
