var Waiter = require('./Waiter');
var mime = require('./mime');
var fs = require('fs');
var zlib = require('zlib');

var fileRoot = process.cwd() + '/';

/**
 * An Asset is a cache of content.
 */
var Asset = module.exports = Waiter.extend({

  /**
   * An asset has a location which is used to cache it.
   */
  init: function init(location, load) {
    var self = this;
    self._super(load);
    self.location = location;
    if (location.indexOf(fileRoot) === 0) {
      self.path = location.substr(fileRoot.length);
    } else {
      self.path = location.replace(/^\//, '');
    }
    self.type = location.replace(/^.*\./, '').toLowerCase();
    self.sortIndex = 9e9;
    if (load) {
      load.paths.forEach(function (path, index) {
        if (self.path == path || self.path.indexOf(path + '/') === 0) {
          self.sortIndex = index;
        }
      });
    }
  },

  /**
   * Set this asset's textual content.
   */
  setContent: function setContent(content) {
    if (content !== this.content) {
      this.content = content;

      // Some content can be set for auto-routing.
      if (/^[^a-zA-Z]*AUTOROUTE/.test(content)) {
        var firstLine = content.replace(/\n[\s\S]*$/, '');
        var context = firstLine.replace(/^.*?AUTOROUTE/, '');
        if (/\S/.test(context)) {
          this.context = JSON.parse(context);
        }
        this.route();
      }
    }
    return this;
  },

  /**
   * Compile the asset if its type is compilable.
   */
  compile: function compile(options) {
    var chug = require('../chug');
    options = options || {};

    // Get the compiler for this asset's file type.
    var compiler = chug._compilers[this.type];

    // The value false indicates that this file type doesn't need to be compiled.
    if (compiler === false) {
      return this;
    }

    // A string means there's a known compiler, but it's not yet added (i.e. require()'d).
    if (typeof compiler == 'string') {
      compiler = chug.setCompiler(this.type, compiler);
    }
    // Undefined means we expect the compiler to have the same name as the file extension.
    else if (typeof compiler == 'undefined') {
      compiler = chug.setCompiler(this.type, this.type);
    }

    // If the compiler is now loaded, use it to compile.
    if (compiler) {
      var content = this.content || '';
      var compiled;
      if (isFunction(compiler.compile)) {

        // Ltl templates take a "name" compiler option that populates a cache.
        options.name = this.location.replace(/^.*\/(views)\/(.*)\.[a-z]+$/, '$2');

        // CoffeeScript's scope protection can be bypassed.
        if (/^[^A-Z]*(BARE|NOWRAP)/i.test(content)) {
          options.bare = true;
        }
        compiled = compiler.compile(content, options);

        // Ltl templates save to a cache that's a property of the compiler.
        var cache = compiler.cache;
        if (cache) {
          // Later we can apply the cache as "this" when calling the template.
          compiled.cache = cache;
          // We must use "key" because function "name" is immutable.
          compiled.key = options.name;
        }
      }
      else if (isFunction(compiler.renderSync)) {
        compiled = compiler.renderSync({ data: content, compressed: true });
      }
      else if (isFunction(compiler.render)) {
        if (this.type == 'less') {
          compiler.render(content, function compilerRender(err, code) {
            compiled = code;
          });
        }
        else {
          compiled = compiler.render(content);
        }
      }
      else if (compiler.markdown) {
        compiled = compiler.markdown.toHTML(content);
      }
      else if (isFunction(compiler)) {
        compiled = compiler(content);
      }
      else {
        chug._logger.error('Unrecognized compiler for type: ' + this.type);
      }

      // If the content has been compiled and is different from the original, set it.
      if (compiled != this.content) {
        this.compiledContent = compiled;
      }
    }
    return this;
  },

  /**
   * Cull the compiledContent by removing sections inside cull comments.
   */
  cull: function cull(key, value) {
    if (!this.cullTarget) {
      this.cullTarget = this.compiledContent ? 'compiledContent' : 'content';
    }
    var content = this[this.cullTarget];
    var valuePattern = new RegExp('\\b' + value + '\\b');
    if (typeof content == 'string') {
      var a = /\/\/([\+-])([a-z0-9-_]+):([a-z0-9-_,]+)([\s\S]*?)\/\/([\+-])\2:\3/gi;
      var b = /\/\*([\+-])([a-z0-9-_]+):([a-z0-9-_,]+)([\s\S]*?)([\+-])\2:\3\*\//gi;
      var replacer = function (match, symbol, mKey, mValue, inside) {
        if (mKey == key) {
          var shouldMatch = (symbol == '+');
          var doesMatch = valuePattern.test(mValue);
          return (shouldMatch == doesMatch) ? inside : '';
        }
        return match;
      };
      content = content.replace(a, replacer);
      content = content.replace(b, replacer);
      this[this.cullTarget] = content;
    }
    return this;
  },

  /**
   * Wrap the asset's content or compiledContent in a function closure if it's JavaScript.
   */
  wrap: function wrap(closureArgs) {
    var chug = require('../chug');
    var targetLanguage = chug._targetLanguages[this.type] || this.type;
    if (targetLanguage == 'js') {
      var content = this.getCompiledContent();
      this.compiledContent = '(function(' + closureArgs + '){' + content + '})(' + closureArgs + ')';
    }
    return this;
  },

  /**
   * Minify the asset if its type is minifiable.
   */
  minify: function minify() {
    var chug = require('../chug');

    // Get the correct minifier for this asset's file type.
    var targetLanguage = chug._targetLanguages[this.type] || this.type;
    var minifier = chug._minifiers[targetLanguage];

    // If there's a minifier specified as a string, add it.
    if (typeof minifier == 'string') {
      var minifierName = minifier;
      minifier = chug.setMinifier(this.type, minifierName);
    }

    var content = this.getCompiledContent();
    var minified = content;

    // If the minifier is now loaded, use it to compile.
    if (minifier) {

      // UglifyJs has a minify function.
      if (minifier.minify) {
        minified = minifier.minify(content, {fromString: true}).code;
      }
      // CSSO has the most ridiculous naming, but whatever.
      else if (minifier.justDoIt) {
        minified = minifier.justDoIt(content);
      }
      // CleanCss requires object instantiation.
      else {
        var m = new minifier();
        minified = m.minify(content);
      }
    }

    // Only shrink if there's a shrinker and minified code.
    if (chug._shrinker && minified) {

      // Only shrink text-based files.
      var mimeType = mime[this.type] || mime.html;
      if (/^text/.test(mimeType)) {
        minified = chug._shrinker.shrink(minified);
      }
    }

    // If the content has been compiled and is different from the original, post-process.
    if (minified != this.minifiedContent) {
      this.minifiedContent = minified;
    }

    return this;
  },

  /**
   * Return the asset's content.
   */
  getContent: function getContent() {
    return this.content;
  },

  /**
   * Return the asset's compiled content.
   */
  getCompiledContent: function getCompiledContent() {
    return this.compiledContent || this.content;
  },

  /**
   * Return the asset's minified content.
   */
  getMinifiedContent: function getMinifiedContent() {
    return this.minifiedContent || this.compiledContent || this.content;
  },

  /**
   * GZip the minified content and cache it for routing.
   */
  gzip: function gzip() {
    var self = this;
    var minified = self.getMinifiedContent();
    if (typeof minified == 'string') {
      self.wait();
      zlib.gzip(minified, function (err, zipped) {
        self.gzippedContent = zipped;
        self.unwait();
      });
    }
    return self;
  },

  /**
   * Add an asset to a server route.
   */
  route: function route(url) {
    var self = this;
    var chug = require('../chug');
    if (chug._server) {
      url = url || '/' + self.path.replace(/^(public|views)\//, '/');
      var mimeType = mime[self.type] || 'text/html';
      if (mimeType == 'text/html') {
        url = url.replace(/\.[^\.]+$/, '');
        url = url.replace(/\/index$/, '/');
      }
      chug._server.get(url, function handle(request, response) {
        response.setHeader('content-type', mimeType);
        response.statusCode = 200;
        if (request.query.v) {
          var future = new Date(Date.now() + 1e11);
          response.setHeader('expires', future.toUTCString());
        }
        var minified = self.getMinifiedContent();
        if (typeof minified == 'function') {
          var context = self.context || {};
          context.request = context.request || request;
          context.response = context.response || response;
          context.cacheBust = context.cacheBust || chug._server._cacheBust;
          var object = minified.cache;
          var content = minified.call(object, context);
          var end = response.zip || response.send;
          end.call(response, content);
        }
        else {
          if (response.zip) {
            response.zip(minified, self.gzippedContent);
          }
          else {
            response.end(minified);
          }
        }
      });
    }
    else {
      chug._logger.error('Cannot route until setServer has received an Express-style server.');
    }
    return self;
  },

  /**
   * Write the asset to a directory.
   */
  write: function (directory, filename, mode) {
    var self = this;

    var path = directory ? directory + '/' + filename : self.location;
    mode = mode ? mode[0].toUpperCase() + mode.substr(1) : '';
    var content = this['get' + mode + 'Content']();

    var parts = path.split('/');
    filename = parts.pop();
    directory = parts.shift();

    function writePart() {
      fs.mkdir(directory, function madeDirForAssetWrite() {
        if (parts.length) {
          directory += '/' + parts.shift();
          writePart();
        } else {
          var path = directory + '/' + filename;
          fs.writeFile(path, content, function () {
            self.unwait();
          });
        }
      });
    }
    self.wait();
    writePart();

    return self;
  },

  /**
   * Load the asset as a module.
   */
  require: function (callback) {
    delete require.cache[this.location];
    this.module = require(this.location);
    if (callback) {
      callback.call(this, this.module);
    }
    return this;
  }
});

function isFunction(value) {
  return typeof value == 'function';
}
