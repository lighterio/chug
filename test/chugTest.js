var assert = require('assert-plus');
var chug = require('../chug');

describe('API', function () {
	before(function () {
		chug.waitCount = 0;
		chug.isReady = false;
		chug.onReadyQueue = [];
	});
	it('should be a function', function () {
		assert.func(chug);
	});
	describe('version', function () {
		var packageVersion = require('../package.json').version;
		it('should be ' + packageVersion, function () {
			var chugVersion = chug.version;
			assert.equal(chugVersion, packageVersion);
		});
	});
	describe('addCompiler', function () {
		it('should be a function', function () {
			assert.func(chug.addCompiler);
		});
		it('should add a compiler', function () {
			chug.addCompiler('coffee', 'coffee-script');
			assert.func(chug._compilers.coffee.compile);
		});
	});
	describe('addMinifier', function () {
		it('should be a function', function () {
			assert.func(chug.addMinifier);
		});
		it('should add a minifier', function () {
			chug.addMinifier('js', 'uglify-js');
			assert.func(chug._minifiers.js.minify);
		});
	});
	describe('setApp', function () {
		var app = require('express')();
		it('should be a function', function () {
			assert.func(chug.setApp);
		});
		it('should set the app', function () {
			chug.setApp(app);
			assert.func(chug._app.get);
		});
	});
});