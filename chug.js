// Require modules in order to prevent circular dependency problems.
var Class = require('./lib/Class');
var Waiter = require('./lib/Waiter');
var Asset = require('./lib/Asset');
var File = require('./lib/File');
var Load = require('./lib/Load');
var Cache = require('./lib/Cache');

/**
 * Expose a function that creates a new "Load" of files.
 * @param path
 * @returns {Load}
 */
var api = module.exports = function load(location) {
	return new Load(location, api);
};

/**
 * Turn the API into a waiter so we can bind onReady tasks to it.
 */
var waiter = new Waiter();
for (var property in waiter) {
	Object.defineProperty(api, property, {
		enumerable: false,
		writable: true
	});
	api[property] = waiter[property];
}

/**
 * Expose the version to module users.
 * @type {string}
 */
api.version = require('./package.json').version;

/**
 * Don't walk upward, and ignore DS_Store.
 */
api._ignorePattern = /^(\.+)(|DS_Store|gitignore)$/;

/**
 * When there's an error, just log it.
 */
api._error = console.error;

/**
 * Cache all assets so each one only needs to be loaded once.
 */
api.cache = new Cache();
api.onReady(function () {
	api.cache.write();
});

/**
 * Express or similar app with app.get(path, callback) routing.
 * @type {App}
 */
api._app = null;

/**
 * Set the Express-like app that will be used for routing.
 * @param app
 */
api.setApp = function setApp(app) {
	api._app = app;
	app._revisionTag = Math.round((new Date()).getTime() / 1000);
};

/**
 * By default, we'll look up compilers at compile time.
 * For example, a .jade file will trigger us to require('jade') and use that.
 * There are two ways to override:
 *  - When api.compiler[fileType] === false, the content will not be compiled.
 *  - When typeof api.compiler[fileType] == 'string', we will require(api.compiler[fileType]).
 */
api._compilers = {
	txt: false,
	html: false,
	htm: false,
	js: false,
	css: false,
	gif: false,
	jpg: false,
	jpeg: false,
	png: false,
	svg: false,
	md: 'markdown',
	ts: 'typescript.api',
	coffee: 'coffee-script',
	scss: 'node-sass',
	styl: 'stylus'
};

/**
 * Set the compiler for a type of file, specifying the module name.
 * @param fileExtension
 * @param moduleName
 */
api.setCompiler = function setCompiler(fileExtension, moduleName) {
	var compiler = false;
	try {
		compiler = require(moduleName);
	}
	catch (e) {
		api._error('Could not load compiler: ' + moduleName);
	}
	api._compilers[fileExtension] = compiler;
	return compiler;
};

/**
 * JavaScript and CSS can be minified.
 */
api._minifiers = {
	js: 'uglify-js',
	css: 'csso'
};

/**
 * Several languages compile to HTML, JavaScript or CSS.
 */
api._targetLanguages = {
	ltl: 'html',
	jade: 'html',
	haml: 'html',
	md: 'html',
	markdown: 'html',
	ts: 'js',
	coffee: 'js',
	iced: 'js',
	litcoffee: 'js',
	less: 'css',
	scss: 'css',
	styl: 'css'
};

/**
 * Set the minifier for a type of file, specifying the module name.
 * @param language
 * @param moduleName
 */
api.setMinifier = function setMinifier(language, moduleName) {
	var minifier = require(moduleName);
	api._minifiers[language] = minifier;
	return minifier;
};

/**
 * The shrinker replaces names like _NAME with shorter names.
 */
api._shrinker;

/**
 * Enable the shrinker.
 */
api.enableShrinking = function() {
	api._shrinker = require('./lib/shrinker');
	api.cache.each(function (asset) {
		asset.minify();
	});
};