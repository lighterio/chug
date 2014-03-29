var Waiter = require('./Waiter');
var mime = require('./mime');

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

			// If this asset has been compiled before, we should recompile it.
			if (typeof this.compiledContent != 'undefined') {
				this.compile();
			}

			// Some content can be set for auto-routing.
			if (/^[^a-zA-Z]*AUTOROUTE/.test(content)) {
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
			compiler = chug.addCompiler(this.type, compiler);
		}
		// Undefined means we expect the compiler to have the same name as the file extension.
		else if (typeof compiler == 'undefined') {
			compiler = chug.addCompiler(this.type, this.type);
		}


		// If the compiler is now loaded, use it to compile.
		if (compiler) {

			var content = this.content || '';
			var compiled;
			if (isFunction(compiler.compile)) {
				var name = this.location.replace(/^.*\/(views)\/(.*)\.[a-z]+$/, '$2');
				compiled = compiler.compile(content, {name: name});
				var cache = compiler.cache;
				if (cache) {
					compiled.cache = cache;
				}
			}
			else if (compiler.markdown) {
				compiled = compiler.markdown.toHTML(content);
			}
			else if (isFunction(compiler)) {
				compiled = compiler(content);
			}
			else {
				chug.error('Unrecognized compiler for type: ' + this.type);
			}

			// If the content has been compiled and is different from the original, post-process.
			if (compiled != this.content) {
				this.compiledContent = compiled;

				// If minified content exists, we should replace it with newly minified content.
				if (typeof this.minifiedContent != 'undefined') {
					this.minify();
				}
			}
		}
		return this;
	},

	/**
	 * Minify the asset if its type is minifiable.
	 * @returns {Asset}
	 */
	minify: function minify() {

		// Get the compiler for this asset's file type.
		var minifier = chug._minifiers[this.type];

		// If there's a minifier specified as a string, add it.
		if (typeof minifier == 'string') {
			var minifierName = minifier;
			minifier = chug.addMinifier(this.type, minifierName);
		}

		// If the minifier is now loaded, use it to compile.
		if (minifier) {

			var minified;
			var content = this.compiledContent || this.content;

			// UglifyJs has a minify function.
			if (minifier.minify) {
				minified = minifier.minify(content, {fromString: true}).code;
			}
			// CleanCss requires object instantiation.
			else {
				var m = new minifier();
				minified = m.minify(content);
			}

			// If the content has been compiled and is different from the original, post-process.
			if (minified != this.minifiedContent) {
				this.minifiedContent = minified;

				// If this content has been shrunken before, re-shrink it.
				if (typeof this.shrunkenContent != 'undefined') {
					this.shrink();
				}
			}
		}
		return this;
	},

	/**
	 * Shrink the asset's minified content.
	 * @returns {Asset}
	 */
	shrink: function shrink() {
		// TODO: Perform shrinkage.
		this.shrunkenContent = this.minifiedContent || this.compiledContent || this.content;
		return this;
	},

	/**
	 * Return the asset's shrunken content.
	 * @returns {string}
	 */
	getShrunkenContent: function shrink() {
		return this.shrunkenContent || this.minifiedContent || this.compiledContent || this.content;
	},

	/**
	 * Add an asset to an app route.
	 * @returns {Asset}
	 */
	route: function route(path) {
		var self = this;
		if (chug._app) {
			path = path || self.location;
			var cwd = process.cwd();
			if (path.substr(0, cwd.length) == cwd) {
				path = path.substr(cwd.length);
				path = path.replace(/^\/[^\/]+/, '');
			}
			var mimeType = mime[self.type] || 'text/html';
			if (mimeType == 'text/html') {
				path = path.replace(/\.[^\.]+$/, '');
				path = path.replace(/\/index$/, '/');
			}
			chug._app.get(path, function (request, response) {
				response.setHeader('Content-Type', mimeType);
				response.statusCode = 200;
				var content = self.getShrunkenContent();
				if (typeof content == 'function') {
					content = content.apply(content.cache, {});
				}
				response.end(content);
			});
		}
		else {
			chug.error('Cannot route until setApp has received an Express-style app.');
		}
		return self;
	}

});

function isFunction(value) {
	return typeof value == 'function';
}