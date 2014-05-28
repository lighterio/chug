var Class = require('./lib/Class');
var Waiter = require('./lib/Waiter');
var Asset = require('./lib/Asset');
var File = require('./lib/File');
var Load = require('./lib/Load');
var Cache = require('./lib/Cache');

/**
 * Expose a function that creates a new "Load" of files.
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
 */
api.version = require('./package.json').version;

/**
 * Don't walk upward, and ignore DS_Store.
 */
api._ignorePattern = /^(\.+)(|DS_Store|gitignore)$/;

/**
 * Cache all assets so each one only needs to be loaded once.
 */
api.cache = new Cache();
api.onReady(function () {
  api.cache.write();
});

/**
 * Express or similar server with server.get(path, callback) routing.
 */
api._server = null;

/**
 * Set the Express-like server that will be used for routing.
 */
api.setServer = function setServer(server) {
  api._server = server;
  server._cacheBust = Math.round((new Date()).getTime() / 1000);
};

/**
 * When there's an error, we need a logger.
 */
api._logger = console;

/**
 * Set a logger that exposes `logger.error(message)`.
 */
api.setLogger = function setLogger(logger) {
  api._logger = logger;
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
  ico: false,
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
 */
api.setCompiler = function setCompiler(fileExtension, moduleName) {
  var compiler = false;
  try {
    compiler = require(moduleName);
  }
  catch (e) {
    api._logger.error('Could not load compiler: ' + moduleName);
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
