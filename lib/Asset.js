var Waiter = require('./Waiter');
var mime = require('./mime');
var fs = require('fs');

var chug;
setImmediate(function immediatelySetChug() {
	chug = require('../chug');
});

/**
 * An Asset is a cache of content.
 * @param path
 * @constructor
 */
var Asset = module.exports = Waiter.extend({

	/**
	 * An asset has a location which is used to cache it.
	 * @param name
	 */
	init: function init(location, load) {
		var self = this;
		self._super(load);
		self.location = location;
		self.type = location.replace(/^.*\./, '').toLowerCase();
		self.dependents = [];
	},

	/**
	 * Set this asset's textual content.
	 * @param content
	 * @returns {Asset}
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
	 * @returns {Asset}
	 */
	compile: function compile() {

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
				var name = this.location.replace(/^.*\/(views)\/(.*)\.[a-z]+$/, '$2');
				var nowrap = /^[^A-Z]*NOWRAP/.test(content);
				compiled = compiler.compile(content, {name: name});
				if (nowrap) {
					compiled = compiled.replace(/(^\(function\(\) \{\s*|\s*\}\)\.call\(this\);\s*$)/g, '');
				}
				var cache = compiler.cache;
				if (cache) {
					compiled.cache = cache;
					compiled.key = name;
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
	 * Wrap the asset's content or compiledContent in a function closure if it's JavaScript.
	 * @returns {Asset}
	 */
	wrap: function wrap(closureArgs) {
		var targetLanguage = chug._targetLanguages[this.type] || this.type;
		if (targetLanguage == 'js') {
			var content = this.compiledContent || this.content;
			this.compiledContent = '(function(' + closureArgs + '){' + content + '})(' + closureArgs + ')';
		}
		return this;
	},

	/**
	 * Minify the asset if its type is minifiable.
	 * @returns {Asset}
	 */
	minify: function minify() {

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
			var mimeType = mime[this.type] || mime['html'];
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
	 * @returns {string}
	 */
	getContent: function getContent() {
		return this.content;
	},

	/**
	 * Return the asset's compiled content.
	 * @returns {Object}
	 */
	getCompiledContent: function getCompiledContent() {
		return this.compiledContent || this.content;
	},

	/**
	 * Return the asset's minified content.
	 * @returns {Object}
	 */
	getMinifiedContent: function getMinifiedContent() {
		return this.minifiedContent || this.compiledContent || this.content;
	},

	/**
	 * Add an asset to an app route.
	 * @param url - The HTTP URL that this should route to.
	 * @returns {Asset}
	 */
	route: function route(url) {
		var self = this;
		if (chug._app) {
			url = url || self.location;
			var cwd = process.cwd();
			if (url.substr(0, cwd.length) == cwd) {
				url = url.substr(cwd.length);
				url = url.replace(/^\/[^\/]+/, '');
			}
			var mimeType = mime[self.type] || 'text/html';
			if (mimeType == 'text/html') {
				url = url.replace(/\.[^\.]+$/, '');
				url = url.replace(/\/index$/, '/');
			}

			chug._app.get(url, function handle(request, response) {
				response.setHeader('Content-Type', mimeType);
				response.statusCode = 200;
				if (request.url.indexOf('?') > -1) {
					var future = new Date(Date.now() + 1e11);
					response.setHeader('expires', future.toUTCString());
				}
				var content = self.getMinifiedContent();
				if (typeof content == 'function') {
					var context = self.context || {};
					context.cacheBust = chug._app._cacheBust;
					var object = content.cache;
					content = content.apply(object, [context]);
				}
				response.end(content);
			});
		}
		else {
			chug._logger.error('Cannot route until setApp has received an Express-style app.');
		}
		return self;
	},

	/**
	 * Write the asset to a directory.
	 * @param directory
	 * @param filename
	 * @param mode
	 */
	write: function (directory, filename, mode) {
		var self = this;

		var path = (directory || process.cwd()) + '/' + (filename || self.location);
		var parts = path.split('/');
		filename = parts.pop();
		directory = parts.shift();
		mode = mode ? mode[0].toUpperCase() + mode.substr(1) : '';
		var content = this['get' + mode + 'Content']();

		self.wait();

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
		writePart();

		return self;
	},

	/**
	 * Load the asset as a module.
	 */
	require: function (callback) {
		delete require.cache[this.location];
		var module = require(this.location);
		if (callback) {
			callback.call(this, module);
		}
		return this;
	}
});

function isFunction(value) {
	return typeof value == 'function';
}
