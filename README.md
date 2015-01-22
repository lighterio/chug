# <a href="http://lighter.io/chug" style="font-size:40px;text-decoration:none;color:#000"><img src="https://cdn.rawgit.com/lighterio/lighter.io/master/public/chug.svg" style="width:90px;height:90px"> Chug</a>
[![NPM Version](https://img.shields.io/npm/v/chug.svg)](https://npmjs.org/package/chug)
[![Downloads](https://img.shields.io/npm/dm/chug.svg)](https://npmjs.org/package/chug)
[![Build Status](https://img.shields.io/travis/lighterio/chug.svg)](https://travis-ci.org/lighterio/chug)
[![Code Coverage](https://img.shields.io/coveralls/lighterio/chug/master.svg)](https://coveralls.io/r/lighterio/chug)
[![Dependencies](https://img.shields.io/david/lighterio/chug.svg)](https://david-dm.org/lighterio/chug)
[![Support](https://img.shields.io/gratipay/Lighter.io.svg)](https://gratipay.com/Lighter.io/)


Chug is a caching build system. It compiles, minifies, and caches your
project's assets so they can be served directly from cache, eliminating
the unnecessary step of saving your files to a build directory.

### Quick Start

Install `chug` in your project:
```bash
npm install --save chug
```

Chug is a function with chaining methods, and you can use it inside your Node
server. Calls to `chug` return a `Load`, which is a list of assets, very
similar to the way jQuery returns an object containing a list of DOM elements.
Operations on a `Load` are chained asynchronously.

If your `scripts` directory contains some CoffeeScript that you're using
along with jQuery, and you want to compile your CS, concatenate it with JS,
and serve it from Express as a single file which gets reloaded when you make
changes, you can use the following:
```javascript
var server = require('express')();
var chug = require('chug');

chug.setServer(server);

chug(['node_modules/jquery/dist/jquery.js', 'scripts'])
  .compile()
  .watch()
  .concat('/all.js')
  .route();
```


## The chug function

The `chug` module exports a function which returns an object called a `Load`.
(Chug a load, eh?) A load contains an array of assets that can be compiled,
minified, concatenated, etc.  There are several types of arguments that can
be passed into chug.

### chug(Array)
When you chug an array, it recursively chugs each element of the array into
the load. This happens asynchronously, so module order is not guaranteed.

### chug(string)
When you chug a string, it resolves to the file system. If the string does
not begin with a slash, chug prepends the current working directory. Chug
loads the path if it is a file or recursively chugs its contents if it is a
directory.

## Load

### .ignore(string|RegExp filenameOrPattern)
Adds a filename or pattern to be ignored while chugging directories.

### .each(function callback)
Waits until all assets are loaded, then iterates over them
with a callback that takes an asset argument.

### .then(function callback)
Waits until all assets are loaded, then runs a callback.

### .compile([Object options])
Runs `compile` on each asset, using `each`, with optional compilation options.

### .minify()
Runs `minify` on each asset, using `each`.

### .gzip()
Runs `gzip` on each asset, using `each`.

### .replace((string|RegExp) pattern, (string|function) replacement)
Replaces the contents of each asset using
`string.replace(pattern, replacement)`. This includes base, compiled,
minified, shrunken and gzipped contents.

### .watch()
Puts a `fs.watch` on the files and directories that were added to the `Load`.
When changes occur, the affected assets are reloaded, then the load re-runs its
chain of actions. Additionally, the location of the most recently modified
asset is stored in `chug.changedLocation`.

### .require()
Loads each asset as a Node.js module.

### .route([string path])
Adds routes to the server that was linked to `chug`
with the `setServer` method. It uses `server.get`, so Express-ish
servers are supported. If a path is specified, it is used. If
not, chug will use the asset location as the URL. The asset location
is either the filePath or a location specified in a `concat` call.

### .concat([string location][, Load load])
Creates a concatenation of all assets from the load on
which `concat` was called.  The optional `location` argument
specifies the asset cache key for the newly concatenated asset.
The optional `load` argument, if specified, will cause the new
asset to be added to an existing load rather than the default
behavior of returning a new load with a single asset.

### .sort(customSortFunction)
Apply a custom sorting function for ordering the assets in a load.

### .shrink()
Builds a dictionary of terms that match `/_[A-Z][_A-Z0-9]+/`,
then replaces occurrences of the terms with short names containing
one or more lowercase letters. This can be used to replace classes
and IDs in your minified JS and CSS since they wouldn't be replaced
by Uglify or CSSO.

### .cull(string key, string value)
If you would like to designate certain sections of code as applying
only to certain environments or certain browsers, you can put "cull"
comments around your code.

```javascript
var env = 'prod';

//+env:dev
env = 'dev';
//-env:dev

//+browser:ie6
window.console = {
  log: function () {
    // Srsly?
  }
};
//-browser:ie6
```

Calling `load.cull('env', 'dev').cull('browser', 'chrome')` on the
code above would result in `env` being set to dev and the native
console remaining intact.  You can also use a comma-delimited value
in your comment, so that multiple cull keys will leave the code intact.

```javascript
//+env:dev,debug
verbose = true;
//-env:dev,debug
```

### .write([directory, filename][, mode])
Writes one or more assets to files. If the directory
and filename are provided they will determine the write location,
otherwise the asset location is used. The mode argument can be null
or "compiled" or "minified", and it specifies which version of the
content should be written to file.

### .getLocations()
Returns an array of the locations of the assets in the load.

### .getTags([string path])
Returns a string of HTML, containing script tags and
link tags for any JS and CSS assets in the load. The optional
path argument prepends a path to the location of those assets.

## API

The chug function is also an object with several methods.

### setServer(Object server)

When you pass an Express-like server to `setServer`, you can then call
`route` on any assets that you'd like to route via `server.get`.

### setLogger(Object logger)

Set a logger that exposes `logger.error(message)` to override the
default console logger.

### setCompiler(string fileExtension, string moduleName)

If you are using a file extension whose compiler has the same
name, then chug will require it automagically.
```javascript
// This will call require('jade')
chug('page.jade').compile();
```

However, if you want to use a compiler with a different file
extension, you can call `setCompiler` first.

```javascript
// This will use require('marked') to compile .md
chug.setCompiler('md', 'marked');
chug('README.md').compile();
```

### setMinifier(string language, string moduleName)

The default minifiers for JS and CSS in Chug are
`uglify-js` and `csso`. If you would like, for example, to
minify your CSS using `clean-css` instead, you could set
`clean-css` as your CSS minifier.

```javascript
chug.setMinifier('css', 'clean-css');
chug('test.css').minify();
```

Note: The language value for JavaScript is "js" rather
than "javascript".

### enableShrinking()

Shrinking is unique-ish feature for minifying class names
and IDs in your assets.  Just name your classes and IDs
with names like `_HIDDEN` or `_BORDER_BOX` or `_PANEL2`
or basically anything that starts with an underscore
followed by a capital letter, followed by at least one
more capital letter, underscore or number.  When you have
shrinking enabled, it will happen as a post-minification
step, so be sure to minify all of your assets so their
IDs and classes will match.



## Acknowledgements

We would like to thank all of the amazing people who use, support,
promote, enhance, document, patch, and submit comments & issues.
Chug couldn't exist without you.

Additionally, huge thanks go to [TUNE](http://www.tune.com) for employing
and supporting [Chug](http://lighter.io/chug) project maintainers,
and for being an epically awesome place to work (and play).


## MIT License

Copyright (c) 2014 Sam Eubank

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## How to Contribute

We welcome contributions from the community and are happy to have them.
Please follow this guide when logging issues or making code changes.

### Logging Issues

All issues should be created using the
[new issue form](https://github.com/lighterio/chug/issues/new).
Please describe the issue including steps to reproduce. Also, make sure
to indicate the version that has the issue.

### Changing Code

Code changes are welcome and encouraged! Please follow our process:

1. Fork the repository on GitHub.
2. Fix the issue ensuring that your code follows the
   [style guide](http://lighter.io/style-guide).
3. Add tests for your new code, ensuring that you have 100% code coverage.
   (If necessary, we can help you reach 100% prior to merging.)
   * Run `npm test` to run tests quickly, without testing coverage.
   * Run `npm run cover` to test coverage and generate a report.
   * Run `npm run report` to open the coverage report you generated.
4. [Pull requests](http://help.github.com/send-pull-requests/) should be made
   to the [master branch](https://github.com/lighterio/chug/tree/master).

### Contributor Code of Conduct

As contributors and maintainers of Chug, we pledge to respect all
people who contribute through reporting issues, posting feature requests,
updating documentation, submitting pull requests or patches, and other
activities.

If any participant in this project has issues or takes exception with a
contribution, they are obligated to provide constructive feedback and never
resort to personal attacks, trolling, public or private harassment, insults, or
other unprofessional conduct.

Project maintainers have the right and responsibility to remove, edit, or
reject comments, commits, code, edits, issues, and other contributions
that are not aligned with this Code of Conduct. Project maintainers who do
not follow the Code of Conduct may be removed from the project team.

Instances of abusive, harassing, or otherwise unacceptable behavior may be
reported by opening an issue or contacting one or more of the project
maintainers.

We promise to extend courtesy and respect to everyone involved in this project
regardless of gender, gender identity, sexual orientation, ability or
disability, ethnicity, religion, age, location, native language, or level of
experience.
