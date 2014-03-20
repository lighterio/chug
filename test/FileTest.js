var api = require('../lighter-load');
var File = require('../lib/File');
var assert = require('assert-plus');

describe('File', function () {
	var file = new File('test/File.js');
	it('should should have its path as its location', function () {
		assert.equal(file.location, 'test/File.js');
	});
	it('should have an empty collection of dependents', function () {
		assert.equal(JSON.stringify(file.dependents), '[]');
	});
});