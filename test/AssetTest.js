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
		asset.setContent('hi');
		asset.compile();
		assert.equal(typeof asset.compiledContent, 'undefined');
	});
});