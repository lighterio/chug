var chug = require('../chug');
var File = require('../lib/File');
var assert = require('assert-plus');

describe('File', function () {
	it('should load a file', function () {
		var file = new File('test/FileTest.js');
		it('should have its path as its location', function () {
			assert.equal(file.location, 'test/FileTest.js');
		});
		it('should have an empty collection of dependents', function () {
			assert.equal(JSON.stringify(file.dependents), '[]');
		});
		it('should load content', function (done) {
			file.onReady(function () {
				assert.equal(typeof file.content, 'string');
				assert.equal(file.content.length > 0, true);
				done();
			});
		});
	});
});