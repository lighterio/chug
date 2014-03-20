var api = require('../lighter-load');
var Asset = require('../lib/Asset');
var assert = require('assert-plus');

describe('Asset', function () {
	var asset = new Asset('hello');
	it('should should have a location', function () {
		assert.equal(asset.location, 'hello');
	});
	it('should have an empty collection of dependents', function () {
		assert.equal(JSON.stringify(asset.dependents), '[]');
	});
});