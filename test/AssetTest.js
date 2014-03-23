var api = require('../api');
var Asset = require('../lib/Asset');
var assert = require('assert-plus');

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
		asset.compile();
		output = asset.compiledContent();
		assert.equal(output, '');
		asset.setContent('. hi');
		output = asset.compiledContent();
		assert.equal(output, '<div>hi</div>');
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
	});
	it('should shrink and minify', function() {
		var asset = new Asset('hi.ltl');
		asset.shrink().minify().compile().setContent('. hi');
		asset = new Asset('hi.ltl');
		asset.minify();
	});
});