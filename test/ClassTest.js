var api = require('../api');
var Class = require('../lib/Class');
var assert = require('assert-plus');

describe('Class', function () {
	it('should be extendable', function () {
		var Dog = Class.extend({
			init: function (name) {
				this.name = name;
			},
			bark: function (callback) {
				callback(this.name + ' says "woof!"');
			}
		});
		var fido = new Dog('Fido');
		fido.bark(function (message) {
			assert.equal(message, 'Fido says "woof!"');
		});
	});
});