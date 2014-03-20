var api = require('../lighter-load');
var Waiter = require('./Waiter');

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
	init: function (location) {
		var self = this;
		self._super();
		self.location = location;
		self.dependents = [];
		self.content = '';
		self.compiled = '';
		self.minified = '';
	},

	/**
	 * Set this asset's textual content.
	 * @param content
	 */
	setContent: function (content) {
		var self = this;
		self.content = content;
	}

});