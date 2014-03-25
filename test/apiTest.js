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
	describe('addCompiler', function () {
		it('should be a function', function () {
			assert.func(api.addCompiler);
		});
		it('should add a compiler', function () {
			api.addCompiler('coffee', 'coffee-script');
			assert.func(api._compilers.coffee.compile);
		});
	});
	describe('addMinifier', function () {
		it('should be a function', function () {
			assert.func(api.addMinifier);
		});
		it('should add a minifier', function () {
			api.addMinifier('js', 'uglify-js');
			assert.func(api._minifiers.js.minify);
		});
	});
	describe('setApp', function () {
		var app = require('express')();
		it('should be a function', function () {
			assert.func(api.setApp);
		});
		it('should set the app', function () {
			api.setApp(app);
			assert.func(api._app.get);
		});
	});
});