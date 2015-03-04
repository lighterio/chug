var chug = require('../chug');
var Asset = require('../lib/asset');
var is = global.is || require('exam/lib/is');
var mock = global.mock || require('exam/lib/mock');

chug.setServer(require('express')());

describe('Asset', function () {

  it('should should have a location', function () {
    var asset = new Asset('hi.ltl');
    is(asset.location, 'hi.ltl');
  });

  it('should compile and recompile ltl', function () {
    var asset = new Asset('hi.ltl');
    var output;
    asset.setContent('').compile();
    output = asset.compiledContent();
    is(output, '');
    asset.setContent('. hi').compile();
    output = asset.compiledContent();
    is(output, '<div>hi</div>');
    delete chug._compilers.ltl;
  });

  it('should not compile JavaScript', function () {
    var asset = new Asset('hi.js');
    asset.setContent('var msg = "hi";');
    asset.compile();
    is(typeof asset.compiledContent, 'undefined');
  });

  it('should compile markdown', function () {
    var asset = new Asset('hi.md');
    asset.setContent('# hi');
    asset.compile();
    is(asset.compiledContent, '<h1>hi</h1>');
  });

  it('should not compile stuff that doesn\'t have a module', function () {
    var asset = new Asset('hi.doesnotexist');
    var errors = 0;
    chug.setLog({
      error: function error() {
        errors++;
      }
    });
    asset.setContent('hi');
    asset.compile();
    is(typeof asset.compiledContent, 'undefined');
  });

  it('should compile if the module exports as a function', function () {
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
    is(typeof asset.compiledContent, 'undefined');

    // If it's different, it should save the compiled content.
    asset.setContent('hi');
    asset.compile();
    is(asset.compiledContent, 'COMPILED');
    require.cache[path].exports = ltl;
    delete chug._compilers.ltl;
  });

  it('should throw if the module exports an unrecognized API', function () {
    var asset = new Asset('hi.ltl');
    var ltl = require('ltl');
    var path = require.resolve('ltl');
    require.cache[path].exports = {};
    var errors = 0;
    chug.setLog({
      error: function error() {
        errors++;
      }
    });
    asset.compile();
    is(errors, 1);
    require.cache[path].exports = ltl;
    delete chug._compilers.ltl;
  });

  it('should minify', function () {
    var asset = new Asset('hi.ltl');

    // Shouldn't throw an error when we try to minify/compile before there's content.
    asset.minify().compile().setContent('. hi');

    // Shouldn't recompile if the content hasn't changed.
    var calls = 0;
    asset.compile = function () {
      calls++;
    }
    asset.setContent('. hi');
    is(calls, 0);

    delete chug._compilers.ltl;
  });

  it('should compile and minify CoffeeScript', function () {
    var asset = new Asset('hi.coffee');
    asset.setContent('className = "_HIDDEN"').compile().minify();
    asset.setContent('className = "_VISIBLE"');
  });

  it('should compile and minify less', function () {
    var asset = new Asset('hi.less');
    asset.setContent('.a { width: (1 + 1) }').compile().minify();
    is(asset.minifiedContent, '.a{width:2}');
  });

  it('should compile and minify scss', function () {
    var asset = new Asset('hi.scss');
    asset.setContent('$white: #fff;\n.a{color: $white}').compile().minify();
    is(asset.minifiedContent, '.a{color:#fff}');
  });

  it('should compile and minify stylus', function () {
    var asset = new Asset('hi.styl');
    asset.setContent('$white = #fff\n.a\n color $white').compile().minify();
    is(asset.minifiedContent, '.a{color:#fff}');
  });

  it('should minify CSS', function () {
    var asset = new Asset('hi.css');
    asset.setContent('.hidden{display:none;}').minify();
    is(/:/.test(asset.minifiedContent), true);
    is(/;/.test(asset.minifiedContent), false);
    asset.setContent('.hidden{display:none}').minify();
    is(/:/.test(asset.minifiedContent), true);
    is(/;/.test(asset.minifiedContent), false);
    chug.setMinifier('css', 'clean-css');
    asset.setContent('.hidden{display:none;}').minify();
    is(/;/.test(asset.minifiedContent), false);
    chug.setMinifier('css', 'csso');
  });

  it('should auto route', function () {
    var asset = new Asset('/views/auto.ltl');
    asset.setContent('// AUTOROUTE\nhtml\n head>title Tick\n body Boom');
    asset.compile();
  });

  it('should auto route with a context', function () {
    var asset = new Asset('/auto.ltl');
    asset.setContent('// AUTOROUTE {"boom": "BOOM!"}\nhtml\n head>title Tick\n body ${boom}');
    asset.compile();
    is(asset.context.boom, 'BOOM!');
  });

  it('should get content', function(done) {
    function verifyContents(asset, expected) {
      var concat = asset.getContent()
        + asset.getCompiledContent()
        + asset.getMinifiedContent();
      concat = concat.replace(/# NOWRAP\n/g, '');
      is(concat, expected);
    }
    chug.enableShrinking();
    chug.shrinker.reset();
    chug('test/scripts/c.coffee')
      .each(function (asset) {
        verifyContents(asset, "c = '_CC'\nc = '_CC'\nc = '_CC'\n");
      })
      .compile()
      .each(function (asset) {
        verifyContents(asset, "c = '_CC'\nvar c;\n\nc = '_CC';\nvar c;\n\nc = '_CC';\n");
      })
      .minify()
      .each(function (asset) {
        verifyContents(asset, "c = '_CC'\nvar c;\n\nc = '_CC';\nvar c;c=\"a\";");
      })
      .then(done);
  });

  it('should generate tokens longer than one character', function () {
    chug.enableShrinking();
    chug.shrinker.reset();
    chug.shrinker.replacementCharacters = 'ab';
    var asset = new Asset('ab.js');
    asset.setContent('var o = "_AA _BB _CC _DD _EE _FF _GG _AA";');
    asset.minify();
    var minified = asset.getMinifiedContent();
    is(minified, 'var o="a b aa ab ba bb aaa a";');
    chug.shrinker = null;
  });

  it('should shrink an anonymous function', function () {
    chug.enableShrinking();
    chug.shrinker.reset();
    chug._compilers.temp = function (c) {
      return function () {
        return '_TEMP';
      };
    };
    var anon = new Asset('test.temp');
    anon.setContent('_TEMP').compile().minify();
    is(/'a'/.test(anon.getMinifiedContent().toString()), true);
    chug.shrinker = null;
    delete chug._compilers.temp;
  });

  it('should cull based on comments', function () {
    var asset = new Asset('cull.js');
    asset.setContent(
      'var env = prod;\n' +
      '//+env:dev\n' +
      '  env = "dev";\n' +
      '//-env:dev\n' +
      '//+env:stage\n' +
      '  env = "stage";\n' +
      '//-env:stage\n' +
      '//+target:ie6\n' +
      '  window.console={log:function (){/*no log for you*/}};\n' +
      '//-target:ie6\n' +
      '//+env:debug,dev\n' +
      '  console.log("dev mode");\n' +
      '//-env:debug,dev\n');
    asset
      .cull('env', 'dev')
      .cull('target', 'chrome');
    is(asset.getCompiledContent(),
      'var env = prod;\n\n' +
      '  env = "dev";\n\n\n\n\n' +
      '  console.log("dev mode");\n\n');
  });

  describe('.replace', function () {

    it('replaces content', function () {
      var asset = new Asset('test.js');
      var content = 'alert("This is a test");';
      asset.setContent(content);
      asset.replace(/test/, 'success!');
      content = asset.getContent();
      is(content, 'alert("This is a success!");');
    });

    it('replaces minified content', function () {
      var asset = new Asset('test.js');
      var content = 'alert( "This is a test" );';
      asset.setContent(content).minify();
      asset.replace(/test/, 'success!');
      content = asset.getMinifiedContent();
      is.in(content, 'success');
    });

    it('calls .gzip if it has been called before', function (done) {
      var asset = new Asset('test.js');
      var content = 'alert( "This is a test" );';
      asset.setContent(content);
      asset.gzippedContent = 'ZIPPED!';
      mock(asset, {gzip: done});
      asset.replace(/test/, 'gzip');
    });
  });

});
