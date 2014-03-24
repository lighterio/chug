var Waiter = require('./Waiter');

var api;
setImmediate(function immediatelySetApi() {
	api = require('../api');
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
		}
		return this;
	},

	/**
	 * Compile the asset if its type is compilable.
	 * @returns {Asset}
	 */
	compile: function compile() {

		// Get the compiler for this asset's file type.
		var compiler = api.compilers[this.type];

		// The value false indicates that this file type doesn't need to be compiled.
		if (compiler === false) {
			return this;
		}

		// A string means there's a known compiler, but it's not yet added (i.e. require()'d).
		if (typeof compiler == 'string') {
			compiler = api.addCompiler(this.type, compiler);
		}
		// Undefined means we expect the compiler to have the same name as the file extension.
		else if (typeof compiler == 'undefined') {
			compiler = api.addCompiler(this.type, this.type);
		}


		// If the compiler is now loaded, use it to compile.
		if (compiler) {

			var content = this.content || '';
			var compiled;
			if (isFunction(compiler.compile)) {
				compiled = compiler.compile(content);
			}
			else if (compiler.markdown) {
				compiled = compiler.markdown.toHTML(content);
			}
			else if (isFunction(compiler)) {
				compiled = compiler(content);
			}
			else {
				api.error('Unrecognized compiler for type: ' + this.type);
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
		var minifier = api.minifiers[this.type];

		// If there's a minifier specified as a string, add it.
		if (typeof minifier == 'string') {
			var minifierName = minifier;
			minifier = api.addMinifier(this.type, minifierName);
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
	}

});

function isFunction(value) {
	return typeof value == 'function';
}