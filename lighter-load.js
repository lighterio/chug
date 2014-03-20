// Require modules in order to prevent circular dependency problems.
var Class = require('./lib/Class');
var Waiter = require('./lib/Waiter');
var Asset = require('./lib/Asset');
var File = require('./lib/File');
var Load = require('./lib/Load');

/**
 * Expose a function that creates a new "Load" of files.
 * @param path
 * @returns {Load}
 */
var api = module.exports = function (location) {
	return new Load(location, api);
};

/**
 * Turn the API into a waiter so we can bind onReady tasks to it.
 */
var waiter = new Waiter();
for (var property in waiter) {
	api[property] = waiter[property];
}

/**
 * Expose the version to module users.
 * @type {string}
 */
api.version = require('./package.json').version;

/**
 * Allow module users to decide which paths don't get walked.
 */
api.ignorePattern = /^(\.+)$/;

/**
 * Allow module users to decide what happens with errors.
 */
api.error = console.error;

/**
 * Cache all assets so each one only needs to be loaded once.
 */
api.cache = {}