var api = require('../api');
var Asset = require('../lib/Asset');
var assert = require('assert-plus');
api.setApp(require('express')());

describe('Asset', function () {
	it('should should have a location', function () {
		var asset = new Asset('hi.ltl');
		assert.equal(asset.location, 'hi.ltl');
	});
	it('should have an empty collection of dependents', function () {
		var asset = new Asset('hi.ltl');
		assert.equal(JSON.stringify(asset.dependents), '[]');
	});
	it('should compile and recompile ltl', function() {
		var asset = new Asset('hi.ltl');
		var output;
		asset.setContent('').compile();
		output = asset.compiledContent();
		assert.equal(output, '');
		asset.setContent('. hi');
		output = asset.compiledContent();
		assert.equal(output, '<div>hi</div>');
		delete api._compilers.ltl;
	});
	it('should not compile JavaScript', function() {
		var asset = new Asset('hi.js');
		asset.setContent('var msg = "hi";');
		asset.compile();
		assert.equal(typeof asset.compiledContent, 'undefined');
	});
	it('should compile markdown', function() {
		var asset = new Asset('hi.md');
		asset.setContent('# hi');
		asset.compile();
		assert.equal(asset.compiledContent, '<h1>hi</h1>');
	});
	it('should not compile stuff that doesn\'t have a module', function() {
		var asset = new Asset('hi.doesnotexist');
		var errors = 0;
		api.error = function error() {
			errors++;
		}
		asset.setContent('hi');
		asset.compile();
		assert.equal(typeof asset.compiledContent, 'undefined');
		assert.equal(errors, 1);
	});
	it('should compile if the module exports as a function', function() {
		var asset = new Asset('hi.ltl');

		// Change the ltl module.
		var ltl = require('ltl');
		var path = require.resolve('ltl');
		require.cache[path].exports = function () {
			return 'COMPILED';
		};

		// The compiled content shouldn't be saved if it isn't different.
		asset.setContent('COMPILED');
		asset.compile();
		assert.equal(typeof asset.compiledContent, 'undefined');

		// If it's different, it should save the compiled content.
		asset.setContent('hi');
		asset.compile();
		assert.equal(asset.compiledContent, 'COMPILED');
		require.cache[path].exports = ltl;
		delete api._compilers.ltl;
	});
	it('should throw if the module exports an unrecognized API', function() {
		var asset = new Asset('hi.ltl');
		var ltl = require('ltl');
		var path = require.resolve('ltl');
		require.cache[path].exports = {};
		var errors = 0;
		api.error = function error() {
			errors++;
		}
		asset.compile();
		assert.equal(errors, 1);
		require.cache[path].exports = ltl;
		delete api._compilers.ltl;
	});
	it('should run shrink and minify', function() {
		var asset = new Asset('hi.ltl');

		// Shouldn't throw an error when we try to shrink/minify/compile before there's content.
		asset.shrink().minify().compile().setContent('. hi');

		// Shouldn't recompile if the content hasn't changed.
		var calls = 0;
		asset.compile = function () {
			calls++;
		}
		asset.setContent('. hi');
		assert.equal(calls, 0);

		delete api._compilers.ltl;
	});
	it('should compile, minify and shrink CoffeeScript', function() {
		var asset = new Asset('hi.coffee');
		asset.setContent('className = "_HIDDEN"').compile().minify().shrink();
		asset.setContent('className = "_VISIBLE"');
	});
	it('should minify CSS', function() {
		var asset = new Asset('hi.css');
		asset.setContent('.hidden{display:none;}').minify();
		assert.equal(/:/.test(asset.minifiedContent), true);
		assert.equal(/;/.test(asset.minifiedContent), false);
		asset.setContent('.hidden{display:none}').minify();
		assert.equal(/:/.test(asset.minifiedContent), true);
		assert.equal(/;/.test(asset.minifiedContent), false);
	});
	it('should auto route', function () {
		var asset = new Asset('/auto.ltl');
		asset.setContent('// AUTOROUTE\nhtml\n head>title Tick\n body Boom');
		asset.compile();
	});
});