var fs = require('fs');
var zlib = require('zlib');
var chug = require('../chug');
var mime = require(__dirname + '/mime');
var Waiter = require(__dirname + '/waiter');
var fileRoot = process.cwd().replace(/\\/g, '/') + '/';
var Type = require('../common/object/type');
var run = require('../common/vm/run');
var dotCache = require('../common/fs/dot-cache').default;

/**
 * An Asset is a cache of content.
 */
module.exports = Waiter.extend({

  /**
   * An asset has a location which is used to cache it.
   */
  init: function (location, stat, load) {
    var self = this;
    Waiter.call(self, load);
    self.location = location = location.replace(/\\/g, '/');
    if (location.indexOf(fileRoot) === 0) {
      self.path = location.substr(fileRoot.length);
    }
    else {
      self.path = location;
    }
    self.type = location.replace(/^.*\./, '').toLowerCase();
    var sortIndex = load ? load.locations.indexOf(self.location) : -1;
    self.sortIndex = sortIndex > -1 ? sortIndex : 9e9;
    self.modified = (stat || 0).mtime || 0;

    self.uses = {};
    self.useIndex = 0;
    self.use();
  },

  /**
   * Set this asset's textual content.
   */
  setContent: function (content) {
    var self = this;
    if (content !== self.content) {
      self.content = content;

      // Some content can be set for auto-routing.
      if (/^[^a-zA-Z]*AUTOROUTE/.test(content)) {
        self.autoRoute = true;
        var firstLine = content.replace(/\n[\s\S]*$/, '');
        var context = firstLine.replace(/^.*?AUTOROUTE/, '');
        if (/\S/.test(context)) {
          self.context = JSON.parse(context);
        }
        self.route();
      }

      if (self.uses) {
        self.use();
      }
    }
    return self;
  },

  /**
   * Compile the asset if its type is compilable.
   */
  compile: function (options) {
    options = Type.decorate({}, options);

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
      }
      else if (isFunction(compiler.renderSync)) {
        compiled = compiler.renderSync({ data: content, compressed: true });
      }
      else if (isFunction(compiler.render)) {
        if (this.type == 'less') {
          compiler.render(content, function (err, result) {
            compiled = result.css;
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
        chug.log.error('[Chug] Unrecognized compiler for type: ' + this.type);
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
  cull: function (key, value) {
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
  wrap: function (closureArgs) {
    var targetLanguage = chug._targetLanguages[this.type] || this.type;
    if (targetLanguage == 'js') {
      var content = this.getCompiledContent();
      if (!closureArgs) {
        var counts = {};
        content.replace(/\b(window|document|location|Math|Date|Error)\b/g, function (match) {
          counts[match] = (counts[match] || 0) + 1;
        });
        var args = [];
        for (var name in counts) {
          if (counts[name] > 2) {
            args.push(name);
          }
        }
        closureArgs = args.join(',');
      }
      this.compiledContent = '(function(' + closureArgs + '){' + content + '})(' + closureArgs + ')';
    }
    return this;
  },

  /**
   * Minify the asset if its type is minifiable.
   */
  minify: function () {
    var self = this;

    // Get the correct minifier for this asset's file type.
    var targetLanguage = chug._targetLanguages[self.type] || self.type;
    var minifier = chug._minifiers[targetLanguage];

    // If there's a minifier specified as a string, add it.
    if (typeof minifier == 'string') {
      var minifierName = minifier;
      minifier = chug.setMinifier(self.type, minifierName);
    }

    var content = self.getCompiledContent();
    var minified = content;

    // If the minifier is now loaded, use it to compile.
    if (minifier && content) {

      try {
        // UglifyJs has a Compressor.
        if (minifier.Compressor) {
          var ast = minifier.parse(content);
          ast.figure_out_scope(); // jshint ignore:line
          var compressor = minifier.Compressor({warnings: false});
          ast = ast.transform(compressor);
          ast.figure_out_scope(); // jshint ignore:line
          ast.compute_char_frequency(); // jshint ignore:line
          ast.mangle_names({eval: true}); // jshint ignore:line
          minified = ast.print_to_string(); // jshint ignore:line
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
      catch (e) {
        e.message = '[Chug] Failed to minify "' + self.location + '".';
        e.stack = e.stack.replace(/^[^\n]*/, e.message);
        dotCache.write('chug', self.path, content, function (error, path) {
          if (error) {
            error.message = '[Chug] ' + error.message;
            chug.log.error(error);
          }
          else {
            chug.log.warn('[Chug] Non-minifiable code cached at "' + path + '".');
          }
        });
      }
    }

    // If the content has been compiled and is different from the original, post-process.
    if (minified != self.minifiedContent) {
      self.minifiedContent = minified;
      if (content.cache) {
        minified.key = content.key;
        minified.cache = content.cache;
        content.cache[content.key] = minified;
      }
    }

    // Mangle RegExp-replaceable CSS/JS classes/ids/properties.
    if (chug.shrinker) {
      self.minifiedContent = minified;
      chug.shrinker.shrink(self);
    }

    return self;
  },

  /**
   * Perform a string replace inside an asset's contents.
   *
   * @param  {String|RegExp}   pattern      A pattern to replace.
   * @param  {String|function} replacement  A regular expression replacement string or function.
   * @param  {String}          scope        An optional scope, such as "content", "compiled", or "minified".
   * @return {Asset}                        The chainable asset.
   */
  replace: function (pattern, replacement, scope) {
    var self = this;

    // If a single scope is passed in, use it.
    // TODO: Validate scopes, and allow an array.
    if (scope) {
      scope = [scope.replace(/^(compiled|minified)$/, '$1Content')];
    }
    // Otherwise, use the default set of 3 scopes.
    else {
      scope = ['content', 'compiledContent', 'minifiedContent'];
    }

    // Iterate over scopes, replacing content if it exists on that scope.
    scope.forEach(function (key) {
      var content = self[key];
      if (content) {

        // String content be replaced with String.prototype.replace().
        if (typeof content == 'string') {
          self[key] = content.replace(pattern, replacement);
        }
        // Functions must be converted to string.
        else if (typeof content == 'function') {
          var js = content.toString().replace(pattern, replacement);
          var fn = run(js);
          for (var property in content) {
            var value = content[property];
            if (typeof value == 'string') {
              value = value.replace(pattern, replacement);
            }
            fn[property] = value;
          }
          if (content.cache) {
            content.cache[fn.key] = fn;
          }
          self[key] = fn;
        }
      }
    });

    // GZipped content needs to be re-zipped.
    if (self.gzippedContent) {
      self.gzip();
    }
    return self;
  },

  /**
   * Return the asset's content.
   */
  getContent: function () {
    return this.content || '';
  },

  /**
   * Return the asset's compiled content.
   */
  getCompiledContent: function () {
    return this.compiledContent || this.content || '';
  },

  /**
   * Return the asset's minified content.
   */
  getMinifiedContent: function () {
    return this.minifiedContent || this.compiledContent || this.content || '';
  },

  /**
   * Iterate over target languages, calling a function for each.
   */
  eachTarget: function (contentKey, fn) {
    var self = this;
    if (!fn) {
      fn = contentKey;
    }
    var content = self.content || '';
    if (contentKey == 'compiled' || contentKey == 'minified') {
      content = self.compiledContent || content;
      if (contentKey == 'minified') {
        content = self.minifiedContent || content;
      }
    }
    var target = chug._targetLanguages[self.type] || self.type;
    var url = self.path.replace(/^(public|views)\//, '');
    if (url[0] != '/') {
      url = '/' + url;
    }
    fn(target, content, url + (target == self.type ? '' : '.' + target));
    ['js', 'css'].forEach(function (property) {
      var value = content[property];
      if (value) {
        fn(property, value, url + '.' + property);
      }
    });
    return self;
  },

  /**
   * GZip the minified content and cache it for routing.
   */
  gzip: function () {
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
  route: function (url) {
    var self = this;
    if (chug.server) {
      self.eachTarget('minified', function (target, content, targetUrl) {
        var routeUrl = url || targetUrl;
        var mimeType = mime[target] || 'text/html';
        chug.server.get(routeUrl, function (request, response) {
          response.setHeader('content-type', mimeType);
          response.statusCode = 200;
          if (request.query.v) {
            var future = new Date(Date.now() + 1e11);
            response.setHeader('expires', future.toUTCString());
          }
          if (typeof content == 'function') {
            var context = self.context || {};
            context.request = context.request || request;
            context.response = context.response || response;
            context.cacheBust = context.cacheBust || chug.server.cacheBust;
            var cache = content.cache;
            content = content.call(cache, context);
            var end = response.zip || response.end;
            end.call(response, content);
          }
          else {
            if (response.zip) {
              response.zip(content, self.gzippedContent);
            }
            else {
              response.end(content);
            }
          }
        });
      });
    }
    else {
      chug.log.error('[Chug] Cannot route until setServer has received an Express-style server.');
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
      fs.mkdir(directory, function () {
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
  },

  /**
   * Resolve @use statements inside assets for dependency ordering.
   */
  use: function () {
    var self = this;
    var path = require('path');
    var file = self.location;
    var dir = path.dirname(file);
    var content = self.content;
    if (typeof content == 'string') {
      content.replace(/@use\s+(\S+)/g, function (match, spec) {
        if (spec[0] == '.') {
          spec = path.join(dir, spec);
        }
        else if (spec[0] != '/') {
          spec = spec.replace(/^([^\\\/]+)/, function (name) {
            var pkg;
            try {
              pkg = require.resolve(name + '/package');
            }
            catch (e) {
              var modulesDir = process.cwd() + '/node_modules/';
              pkg = require.resolve(modulesDir + name + '/package');
            }
            return path.dirname(pkg);
          });
        }
        if (!self.uses[spec]) {
          self.parents.forEach(function (load) {
            load.add(spec);
          });
          self.uses[spec] = true;
        }
      });
    }
    return self;
  }

});

function isFunction(value) {
  return typeof value == 'function';
}
