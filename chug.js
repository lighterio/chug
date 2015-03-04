var Waiter = require(__dirname + '/lib/waiter');
var Cache = require(__dirname + '/lib/cache');

/**
 * Expose a function that creates a new "Load" of files.
 */
var chug = module.exports = function (location) {
  return new Load(location, chug);
};

/**
 * Turn the API into a waiter so we can bind onReady tasks to it.
 */
var waiter = new Waiter();
for (var property in waiter) {
  Object.defineProperty(chug, property, {
    enumerable: false,
    writable: true
  });
  chug[property] = waiter[property];
}

/**
 * Expose the Chug version via package.json lazy loading.
 */
Object.defineProperty(chug, 'version', {
  get: function () {
    return require(__dirname + '/package.json').version;
  }
});

/**
 * Don't walk upward, and ignore DS_Store, etc.
 */
chug._ignorePattern = /^(\.+)(|DS_Store|gitignore)$/;

/**
 * Cache all assets so each one only needs to be loaded once.
 */
chug.cache = new Cache();
chug.onReady(function () {
  chug.cache.write();
});

/**
 * Express or similar server with server.get(path, callback) routing.
 */
chug.server = null;

/**
 * Set the Express-like server that will be used for routing.
 */
chug.setServer = function (server) {
  chug.server = server;
  server.cacheBust = Math.round((new Date()).getTime() / 1000);
};

/**
 * When there's an error, we need a log.
 */
chug.log = console;

/**
 * Set a log that exposes `log.error(message)`.
 */
chug.setLog = function (log) {
  chug.log = log;
};

/**
 * By default, we'll look up compilers at compile time.
 * For example, a .jade file will trigger us to require('jade') and use that.
 * There are two ways to override:
 *  - When chug.compiler[fileType] === false, the content will not be compiled.
 *  - When typeof chug.compiler[fileType] == 'string', we will require(chug.compiler[fileType]).
 */
chug._compilers = {
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
chug.setCompiler = function (fileExtension, moduleName) {
  var compiler = false;
  try {
    compiler = require(moduleName);
  }
  catch (e) {
    chug.log.error('[Chug] Could not load compiler: ' + moduleName);
  }
  chug._compilers[fileExtension] = compiler;
  return compiler;
};

/**
 * JavaScript and CSS can be minified.
 */
chug._minifiers = {
  js: 'uglify-js',
  css: 'csso'
};

/**
 * Several languages compile to HTML, JavaScript or CSS.
 */
chug._targetLanguages = {
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
 * Filters are used for passing loads through other modules.
 */
chug._filters = {
  pack: require(__dirname + '/lib/pack')
};

/**
 * Add a filter to the map that a Load uses for custom Asset types.
 *
 * @param {String}   name    A filter name.
 * @param {Function} filter  An object that extends Asset.
 */
chug._addFilter = function (name, filter) {
  chug._filters[name] = filter;
};

/**
 * Set the minifier for a type of file, specifying the module name.
 */
chug.setMinifier = function (language, moduleName) {
  var minifier = require(moduleName);
  chug._minifiers[language] = minifier;
  return minifier;
};

/**
 * Enable the shrinker.
 */
chug.enableShrinking = function() {
  chug.shrinker = require(__dirname + '/lib/shrinker');
  chug.cache.each(function (asset) {
    asset.minify();
  });
};

// Load dependencies later because many of them depend on chug.
chug.Asset = require(__dirname + '/lib/asset');
chug.File = require(__dirname + '/lib/file');
var Load = chug.Load = require(__dirname + '/lib/load');
