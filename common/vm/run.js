/**
 * VM Run is a utility for storing source code, running it, and returning a
 * result. If the result is a function to be executed later, it can be
 * executed knowing that recent source is retrievable when exceptions occur.
 *
 * @origin https://github.com/lighterio/lighter-common/common/vm/run.js
 * @version 0.0.1
 * @import process/cache
 */

var vm = require('vm');
var cache = require('../process/cache');

/**
 * Run a piece of code with an optional path for exception handling.
 *
 * @param  {String} code  A piece of JavaScript code to run.
 * @param  {String} path  An optional path for the file, used for debugging, etc.
 * @return {Any}          The value extracted from the scripts context.
 */
var run = module.exports = function (code, path) {
  path = (path || 'run' + (++run._id)) + '.vm.js';
  var key = (path[0] == '/') ? path : '/tmp/' + path;
  var src = 'var o=' + code;
  var context = {};
  cache.set(key, src);
  try {
    vm.runInNewContext(src, context, key);
  }
  catch (e) {
    e.message += '\n' + src + '\n' + (e instanceof SyntaxError);
    throw e;
  }
  return context.o;
};

run._id = 0;
