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
		self.content = '';
	},

	/**
	 * Set this asset's textual content.
	 * @param content
	 * @returns {Asset}
	 */
	setContent: function setContent(content) {
		this.content = content;

		// If this asset has been compiled before, we should recompile it.
		if (this.compiledContent) {
			this.compile();
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
		var compilerName = (typeof compiler == 'string' ? compiler : this.type);

		compiler = api.addCompiler(this.type, compilerName);

		// If the compiler is now loaded, use it to compile.
		if (compiler) {

			var compiled;
			if (isFunction(compiler.compile)) {
				compiled = compiler.compile(this.content);
			}
			else if (compiler.markdown) {
				compiled = compiler.markdown.toHTML(this.content);
			}
			else if (isFunction(compiler)) {
				compiled = compiler();
			}
			else {
				api.error('Unrecognized compiler type: ' + compilerName);
			}

			// If the content has been compiled and is different from the original, post-process.
			if (compiled != this.content) {
				this.compiledContent = compiled;

				// If minified content exists, we should replace it with newly minified content.
				if (this.minifiedContent) {
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
		// TODO: Perform minification.
		this.minifiedContent = this.content;

		// If this content has been shrunken before, re-shrink it.
		if (this.shrunkenContent) {
			this.shrink();
		}
		return this;
	},

	/**
	 * Shrink the asset's minified content.
	 * @returns {Asset}
	 */
	shrink: function shrink() {
		// TODO: Perform shrinkage.
		this.shrunkenContent = this.minifiedContent;
		return this;
	}

});

function isFunction(value) {
	return typeof value == 'function';
}