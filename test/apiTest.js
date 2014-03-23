var assert = require('assert-plus');
var api = require('../api');

describe('API', function () {
	before(function () {
		api.waitCount = 0;
		api.isReady = false;
		api.onReadyQueue = [];
	});
	it('should be a function', function () {
		assert.func(api);
	});
	describe('version', function () {
		var packageVersion = require('../package.json').version;
		it('should be ' + packageVersion, function () {
			var apiVersion = api.version;
			assert.equal(apiVersion, packageVersion);
		});
	});
	describe('compilers', function () {
		it('should be an object', function () {
			assert.object(api.compilers);
		});
	});
	describe('addCompiler', function () {
		it('should be a function', function () {
			assert.func(api.addCompiler);
		});
	});
	describe('minifiers', function () {
		it('should be an object', function () {
			assert.object(api.minifiers);
		});
	});
});