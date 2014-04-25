var chug = require('../chug');
var assert = require('assert-plus');
var fs = require('fs');
var http = require('http');
var Asset = require('../lib/Asset');

var app = require('express')();
app.listen(8999);
chug.setApp(app);

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
		var empty = chug();
		assert.equal(empty.assets.length, 0);
	});
	it('should load views', function (done) {
		var views = chug('test/views');
		views.onceReady(function () {
			assert.equal(views.assets.length, 2);
			var hasCachedItems;
			for (location in chug.cache._cache) {
				hasCachedItems = true;
			}
			assert.equal(hasCachedItems, true);
			done();
		});
	});
	it('should log an error for an invalid location', function () {
		var errors = 0;
		chug.error = function () {
			errors++;
		}
		chug({});
		assert.equal(errors, 1);
	});
	it('should load views as an array', function (done) {
		var views = chug(['test/views/hello.ltl', 'test/views/base/page.ltl']);
		views.onceReady(function () {
			assert.equal(views.assets.length, 2);
			done();
		});
	});
	it('should ignore a non-existent path', function () {
		chug('./test/non-existent-path');
	});
	it('should resolve a node_modules path', function () {
		chug('node_modules/mocha/mocha.css');
	});
	it('should load an absolute path', function () {
		var path = require.resolve('mocha');
		chug(path);
	});
	it('should skip . and .. "files"', function() {
		var readdir = fs.readdir;
		fs.readdir = function (dir, callback) {
			callback(null, ['.', '..', 'mock.txt']);
		};
		var stat = fs.stat;
		fs.stat = mockStat;
		var temp = chug('test/nonexistent');
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
		chug.error = function () {
			errors++;
		}
		chug('test/nonexistent');
		assert.equal(errors, 1);
		fs.readdir = readdir;
		fs.stat = stat;
	});
	it('should iterate over views', function (done) {
		var count = 0;
		chug('test/views')
			.each(function (view) {
				assert.equal(view.content.length > 0, true);
				++count;
			})
			.then(function () {
				assert.equal(count, 2);
				assert.equal(this.assets.length, 2);
				assert.equal(this.watchablePaths.length, 1);
				done();
			});
	});
	it('should compile views', function (done) {
		chug('test/views/hello.ltl')
			.compile()
			.each(function (view) {
				assert.func(view.compiledContent);
			})
			.then(done);
	});
	it('should minify and shrink', function (done) {
		chug('test/views/hello.ltl').compile().minify().shrink().then(done);
	});
	it('should concatenate scripts', function (done) {
		chug('test/scripts')
			.concat()
			.then(function () {
				done();
			});
	});
	it('should concatenate scripts with a name', function (done) {
		var scripts = chug('test/scripts')
			.concat('/core.js')
			.then(function () {
				var first = scripts.assets[0];
				var cached = chug.cache.get('/core.js');
				assert.equal(first.content, cached.content);
				assert.equal(first.content.split('=').length, 4);
				done();
			});
	});
	it('should serve compiled CoffeeScript with Express', function (done) {
		chug('test/scripts')
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
		chug('test/views')
			.compile()
			.route()
			.then(function () {
				http.get('http://127.0.0.1:8999/views/hello', function (response) {
					response.on('data', function (chunk) {
						var data = '' + chunk;
						assert.equal(/DOCTYPE/.test(data), true);
						done();
					});
				});
			});
	});
	it('should not route until an app is set', function (done) {
		chug._app = null;
		var errors = 0;
		chug.error = function () {
			errors++;
		}
		chug('test/scripts/b.js')
			.route()
			.then(function () {
				assert.equal(errors, 1);
				done();
			});
	});
	it('should watch a directory', function (done) {
		var expectCount = 0;
		fs.mkdir('test/watch', function () {
			var load = chug('test/watch')
				.watch(function () {
					assert.equal(load.assets.length, expectCount);
					if (expectCount) {
						expectCount = 0;
						fs.unlink('test/watch/a.txt');
					}
					else {
						fs.rmdir('test/watch', function () {
							done();
						});
					}
				})
				.then(function () {
					this.replayableActions = [];
					expectCount = 1;
					fs.writeFile('test/watch/a.txt', 'A');
				});
		});
	});
	it('should watch views', function (done) {
		var concatCalls = 0;
		var load = chug('test/views');
		var concat = load.concat().then(function () {
			concat.assets[0].setContent = function () {
				if (++concatCalls == 2) {
					load.replayableActions = [];
					concat.replayableActions = [];
					done();
				}
			}
		});
		load.watch(function () {
			fs.unlink('test/views/boom.ltl', function () {});
		});
		load.then(function () {
			fs.writeFile('test/views/boom.ltl', 'b boom', function () {});
		});
	});
	it('should watch scripts', function (done) {
		var isDone = false;
		chug('test/scripts')
			.watch()
			.watch(function () {
				assert.equal(this.assets.length, 3);
				if (!isDone) {
					isDone = true;
					done();
				}
			})
			.then(function () {
				this.replayableActions = [];
				var asset = this.assets[0];
				fs.writeFile(asset.location, asset.content);
			});
	});
	it('should ignore JetBrains backup files', function (done) {
		fs.mkdir('test/empty', function () {
			var called = false;
			chug('test/empty')
				.watch(function () {
					called = true;
				})
				.then(function () {
					fs.watch('test/empty', function () {
							fs.unlink('test/empty/___bak__', function () {
								assert.equal(called, false);
								fs.rmdir('test/empty', function () {
									done();
								});
							});
					})
					fs.writeFile('test/empty/___bak___', 'TEST');
				});
		})
	});
	it('should watch a single file', function (done) {
		var load = chug('test/scripts/b.js');
		load
			.minify()
			.watch()
			.onceReady(function () {
				fs.writeFile('test/scripts/b.js', 'var b = 2;', function () {
					done();
				});
			});
	});
	it('should wrap js but not css', function (done) {
		var load = chug();
		var js = load.addAsset(Asset, 'test.js');
		js.setContent('var a = 1;');
		var styl = load.addAsset(Asset, 'test.styl');
		styl.setContent('body\n color #fff');
		load
			.wait()
			.wrap()
			.compile()
			.wrap()
			.then(function () {
				done();
			})
			.unwait();
	});
});