var load = require('../api');
var assert = require('assert-plus');
var fs = require('fs');

var app = require('express')();
app.listen(8999);
load.setApp(app);

var mockStat = function (path, callback) {
	callback(null, {
		dev: 16777219,
		mode: 33188,
		nlink: 1,
		uid: 501,
		gid: 20,
		rdev: 0,
		blksize: 4096,
		ino: 3063360,
		size: 50,
		blocks: 8,
		atime: 'Wed Mar 19 2014 00:50:13 GMT-0700 (PDT)',
		mtime: 'Mon Mar 17 2014 17:25:29 GMT-0700 (PDT)',
		ctime: 'Mon Mar 17 2014 17:25:29 GMT-0700 (PDT)',
		isDirectory: function () {
			return path.indexOf('.') < 0;
		}
	});
};

describe('Load', function () {
	it('should load nothing if no path is passed', function () {
		var empty = load();
		assert.equal(empty.assets.length, 0);
	});
	it('should load views', function (done) {
		var views = load('test/views');
		views.onReady(function () {
			assert.equal(views.assets.length, 2);
			var hasCachedItems;
			for (location in load.cache) {
				hasCachedItems = true;
			}
			assert.equal(hasCachedItems, true);
			done();
		});
	});
	it('should log an error for an invalid location', function () {
		var errors = 0;
		load.error = function () {
			errors++;
		}
		load({});
		assert.equal(errors, 1);
	});
	it('should load views as an array', function (done) {
		var views = load(['test/views/hello.ltl', 'test/views/base/page.ltl']);
		views.onReady(function () {
			assert.equal(views.assets.length, 2);
			done();
		});
	});
	it('should ignore a non-existent path', function () {
		load('./test/non-existent-path');
	});
	it('should resolve a node_modules path', function () {
		load('node_modules/mocha/mocha.css');
	});
	it('should load an absolute path', function () {
		var path = require.resolve('mocha');
		load(path);
	});
	it('should skip . and .. "files"', function() {
		var readdir = fs.readdir;
		fs.readdir = function (dir, callback) {
			callback(null, ['.', '..', 'mock.txt']);
		};
		var stat = fs.stat;
		fs.stat = mockStat;
		var temp = load('test/nonexistent');
		assert.equal(temp.assets.length, 1);
		fs.readdir = readdir;
		fs.stat = stat;
	});
	it('should log an error when a directory can\'t be read', function() {
		var readdir = fs.readdir;
		fs.readdir = function (dir, callback) {
			callback('ERROR');
		};
		var stat = fs.stat;
		fs.stat = mockStat;
		var errors = 0;
		load.error = function () {
			errors++;
		}
		load('test/nonexistent');
		assert.equal(errors, 1);
		fs.readdir = readdir;
		fs.stat = stat;
	});
	it('should iterate over views', function (done) {
		var count = 0;
		load('test/views')
			.each(function (view) {
				assert.equal(view.content.length > 0, true);
				if (++count == 2) {
					done();
				}
			});
	});
	it('should compile views', function (done) {
		load('test/views/hello.ltl')
			.compile()
			.each(function (view) {
				var startsWithTag = /</.test(view.compiledContent);
				assert.equal(startsWithTag, true);
			})
			.then(done);
	});
	it('should minify and shrink', function (done) {
		load('test/views/hello.ltl').compile().minify().shrink().then(done);
	});
	it('should concatenate scripts', function (done) {
		load('test/scripts')
			.concat()
			.then(function () {
				done();
			});
	});
	it('should concatenate scripts with a name', function (done) {
		var scripts = load('test/scripts')
			.concat('/core.js')
			.then(function () {
				var first = scripts.assets[0];
				var cached = load.cache['/core.js'];
				assert.equal(first.content, cached.content);
				assert.equal(first.content.split('=').length, 4);
				done();
			});
	});
	it('should serve compiled CoffeeScript with Express', function (done) {
		var http = require('http');
		load('test/scripts')
			.compile()
			.concat('/core.js')
			.route()
			.then(function () {
				http.get('http://127.0.0.1:8999/core.js', function (response) {
					response.on('data', function (chunk) {
						var data = '' + chunk;
						assert.equal(/var a;/.test(data), true);
						done();
					});
				});
			});
	});
	it('should route ltl', function (done) {
		load('test/views/hello.ltl')
			.compile()
			.route()
			.then(done);
	});
	it('should not route until an app is set', function (done) {
		load._app = null;
		var errors = 0;
		load.error = function () {
			errors++;
		}
		load('test/scripts/b.js')
			.route()
			.then(function () {
				assert.equal(errors, 1);
				done();
			});
	});
});