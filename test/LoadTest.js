var chug = require('../chug');
var assert = require('assert-plus');
var fs = require('fs');
var http = require('http');
var zlib = require('zlib');
var Asset = require('../lib/Asset');
var exec = require('child_process').exec;
var cwd = process.cwd();

var express = require('express')();
express.listen(8999);
chug.setServer(express);
chug.enableShrinking();

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
      var hasCachedItems = false;

      // Pollute Object so we'll touch hasOwnProperty code paths.
      Object.prototype.polluted = true;
      chug.cache.each(function () {
        hasCachedItems = true;
      });
      delete Object.prototype.polluted;

      assert.equal(hasCachedItems, true);
      done();
    });
  });
  it('should log an error for an invalid location', function () {
    var errors = 0;
    chug.setLogger({error: function () {
      errors++;
    }});
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
    chug.setLogger({
      error: function error() {
        errors++;
      }
    });
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
        assert.equal(this.watchablePaths.length, 2);
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
  it('should compile and minify', function (done) {
    chug('test/views/hello.ltl').compile().minify().then(done);
  });
  it('should cull content', function (done) {
    chug.cache.clear();
    chug('test/views/hello.ltl').cull().compile().each(function (h) {
      assert.equal(h.cullTarget, 'content');
      done();
    });
  });
  it('should cull compiled content', function (done) {
    chug.cache.clear();
    chug('test/scripts/a.coffee').compile().cull().each(function (a) {
      assert.equal(a.cullTarget, 'compiledContent');
      done();
    });
  });
  it('should not cull binary content', function (done) {
    chug('test/icons/chug.ico').cull().each(function (i) {
      assert.equal(typeof i[i.cullTarget], 'object');
      done();
    });
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
            http.get('http://127.0.0.1:8999/core.js?v=1234', function (response) {
              response.on('data', function (chunk) {
                var data = '' + chunk;
                assert.equal(/var a;/.test(data), true);
                assert.equal(!!response.headers.expires, true);
                done();
              });
            });
          });
        });
      });
  });
  it('should route ltl', function (done) {
    chug.setServer(express);
    chug.enableShrinking();
    chug('test/views')
      .compile()
      .minify()
      .route()
      .then(function () {
        chug._shrinker = null;
        http.get('http://127.0.0.1:8999/test/views/hello', function (response) {
          response.on('data', function (chunk) {
            var data = '' + chunk;
            assert.equal(/DOCTYPE/.test(data), true);
            done();
          });
        });
      });
  });
  it('should not route until a server is set', function (done) {
    chug._server = null;
    var errors = 0;
    chug.setLogger({
      error: function error() {
        errors++;
      }
    });
    chug('test/scripts/b.js')
      .route()
      .then(function () {
        assert.equal(errors, 1);
        done();
      });
  });
  it('should compress when routing with Za', function (done) {
    var za = require('za')();
    var decorations = require.resolve('za/lib/http');
    delete require.cache[decorations];
    require(decorations);
    za.listen(8998);

    chug.setServer(za);
    chug('test/scripts/b.js')
      .minify()
      .route()
      .then(function () {
        http.get({
          hostname: '127.0.0.1',
          port: 8998,
          path: '/test/scripts/b.js',
          method: 'GET',
          headers: {'accept-encoding': 'gzip'}
        }, function (response) {
          response.on('data', function (chunk) {
            zlib.gunzip(chunk, function (err, data) {
              assert.equal('' + data, 'var b=2;');
              za.close();
              delete http.ServerResponse.prototype.zip;
              done();
            });
          });
        });
      });
  });
  it('should watch a directory', function (done) {
    var hasWritten = false;
    var hasUnlinked = false;
    var isDone = false;
    chug.setServer(express);
    var cacheBust = chug._server._cacheBust;
    fs.mkdir('test/watch', function (err) {
      var load = chug('test/watch')
        .watch(function () {
          chug._server = null;

          if (!hasWritten && (load.assets.length > 0)) {
            hasWritten = true;
            fs.unlink('test/watch/a.txt');
          }
          else if (!hasUnlinked && (load.assets.length == 0)) {
            hasUnlinked = true;
            fs.rmdir('test/watch', function () {
              if (!isDone) {
                isDone = true;
                done();
              }
            });
          }
        })
        .then(function () {
          this.replayableActions = [];
          fs.writeFile('test/watch/a.txt', 'A');
        });
    });
  });
  it('should watch views', function (done) {
    fs.unlink('test/views/DELETE_ME.ltl', function () {
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
        fs.unlink('test/views/DELETE_ME.ltl', function () {});
      });
      load.then(function () {
        fs.writeFile('test/views/DELETE_ME.ltl', 'b boom', function () {});
      });
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
    var isDone = false;
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
                  if (!isDone) {
                    isDone = true;
                    done();
                  }
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
  it('should write', function (done) {
    chug('test/scripts/b.js')
      .minify()
      .write()
      .write('build', 'b.js')
      .write('build', 'b.min.js', 'minified')
      .then(function () {
        done();
      });
  });
  it('should return locations', function (done) {
    var scripts = chug('test/scripts')
      .getLocations(function (locations) {
        assert.equal(locations.length, 3);
      })
      .then(function () {
        assert.equal(scripts.getLocations().length, 3);
        done();
      });
    assert.equal(scripts.getLocations().length, 0);
  });
  it('should return tags', function (done) {
    var load = chug([
      'test/scripts/a.coffee',
      'test/scripts/b.js',
      'test/styles/a.css',
      'test/styles/b.styl',
      'test/views/hello.ltl'])
      .getTags(function (tags) {
        verify(tags, '');
      })
      .then(function () {
        verify(load.getTags(), '');
        verify(load.getTags('blah'), 'blah');
        load.assets.forEach(function (asset) {
          asset.location = asset.location.replace(/.*\//, '');
        })
        var html = load.getTags();
        assert.equal(html.indexOf('src="a.js"') > -1, true);
        done();
      });
    function verify(html, path) {
      assert.equal(html.indexOf('<script src="' + path + '/test/scripts/a.js"></script>') > -1, true);
      assert.equal(html.indexOf('<script src="' + path + '/test/scripts/b.js"></script>') > -1, true);
      assert.equal(html.indexOf('<link rel="stylesheet" href="' + path + '/test/styles/a.css">') > -1, true);
      assert.equal(html.indexOf('<link rel="stylesheet" href="' + path + '/test/styles/b.css">') > -1, true);
      assert.equal(html.length, 182 + path.length * 4);
    }
    assert.equal(load.getTags(), '');
  });
  it('should require modules', function (done) {
    chug('test/modules')
      .require()
      .then(function () {
        assert.equal(marco, 'polo');
      })
      .require(function (module) {
        assert.equal(module.name, 'marco');
        done();
      });
  });
  it('should sort files', function (done) {
    var readdir = fs.readdir;
    var stat = fs.stat;
    var readFile = fs.readFile;
    fs.readdir = function (path, callback) {
      callback(null, ['a.js', 'b.js', 'c.js']);
    };
    fs.stat = function (path, callback) {
      var stat = {
        isDirectory: function () {
          return !/\.js$/.test(path);
        }
      };
      if (/a\.js$/.test(path)) {
        setTimeout(function () {
          callback(null, stat);
        }, 20);
      } else {
        callback(null, stat);
      }
    };
    fs.readFile = function (path, callback) {
      if (/b\.js$/.test(path)) {
        setTimeout(function () {
          callback(null, 'var b = 2;');
        }, 40);
      } else {
        callback(null, /a\.js/.test(path) ? 'var a = 1;' : 'var c = 3;');
      }
    };
    chug('mock')
      .then(function () {
        var joined = this.getLocations().join(',');
        assert.equal(joined, cwd + '/mock/a.js,' + cwd + '/mock/b.js,' + cwd + '/mock/c.js');
        chug.cache.clear();
        chug('test/mock').concat('c').each(function (asset) {
          assert.equal(asset.content, 'var a = 1;var b = 2;var c = 3;');
          fs.readdir = readdir;
          fs.stat = stat;
          fs.readFile = readFile;
          done();
        });
      });
  });
  it('should ignore filenames and patterns', function (done) {
    var readdir = fs.readdir;
    var stat = fs.stat;
    var readFile = fs.readFile;
    var firstReaddir = true;
    fs.readdir = function (path, callback) {
      setImmediate(function () {
        callback(null, [
          '.DS_Store',
          '.gitignore',
          'a.js',
          'node_modules',
          'ignoreMe'
        ]);
      });
    };
    fs.stat = function (path, callback) {
      callback(null, {
        isDirectory: function () {
          return path.indexOf('.') < 0;
        }
      });
    };
    fs.readFile = function (path, callback) {
      callback(null, 'CONTENT');
    };
    chug('mock').ignore('node_modules').ignore(/ignore/)
      .then(function (load) {
        assert.equal(this.assets.length, 1);
        fs.readdir = readdir;
        fs.stat = stat;
        fs.readFile = readFile;
        done();
      });
  });
});
