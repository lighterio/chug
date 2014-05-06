# chug

 [![NPM Version](https://badge.fury.io/js/chug.png)](http://badge.fury.io/js/chug)
 [![Build Status](https://travis-ci.org/zerious/chug.png?branch=master)](https://travis-ci.org/zerious/chug)
 [![Code Coverage](https://coveralls.io/repos/zerious/chug/badge.png?branch=master)](https://coveralls.io/r/zerious/chug)
 [![Dependencies](https://david-dm.org/zerious/chug.png?theme=shields.io)](https://david-dm.org/zerious/chug)
 [![Support](http://img.shields.io/gittip/zerious.png)](https://www.gittip.com/zerious/)

Chug is a caching build system. It compiles, minifies, and caches your
project's assets so they can be served directly from cache, eliminating
the unnecessary step of saving your files to a build directory.

## Getting Started

Chug is a function with chaining methods, and you can use it inside your Node
app. Calls to ```chug``` return a ```Load```, which is a list of assets, very
similar to the way jQuery returns an object containing a list of DOM elements.
Operations on a ```Load``` are chained asynchronously.

If your ```scripts``` directory contains some CoffeeScript that you're using
along with jQuery, and you want to compile your CS, concatenate it with JS,
and serve it from Express as a single file which gets reloaded when you make
changes, you can use the following:
```javascript
var app = require('express')();
var chug = require('chug');

chug.setApp(app);

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
When you chug a string, it resolves to the file system. If the string begins
with `node_modules/`, chug resolves the path as Node.js `require` would.
Otherwise, chug loads the path if it is a file or recursively chugs its
contents if it is a directory.

## Load

### .each(function callback)
`each` waits until all assets are loaded, then iterates over them
with a callback that takes an asset argument.

### .then(function callback)
`then` waits until all assets are loaded, then runs a callback.

### .compile()
`compile` runs `compile` an each asset, using `each`.

### .minify()
`minify` runs `minify` on each asset, using `each`.

### .watch()
`watch` puts a `fs.watch` on the files and directories that were
added to the `Load`. When changes occur, the affected assets are
reloaded, then the load re-runs its chain of actions.

### .route([string path])
`route` adds a route to the app that was linked to `chug` with
the `setApp` method. It uses `app.get`, so Express-like apps are
supported.  If a path is specified, it is used.  If not, chug
will use a modified file path as the URL path.

### .concat([string location][, Load load])
`concat` creates a concatenation of all assets from the load on
which `concat` was called.  The optional `location` argument
specifies the asset cache key for the newly concatenated asset.
The optional `load` argument, if specified, will cause the new
asset to be added to an existing load rather than the default
behavior of returning a new load with a single asset.

### .write([directory][, filename][, mode])
`write` writes one or more assets to files. If the directory
argument is omitted, the current working directory is used.
The filename argument (if provided) gets appended to the
directory, otherwise the asset location is used.  The mode
argument can be null or "compiled" or "minified", and it
specifies which version of the content should be written
to file.

## API

The chug function is also an object with several methods.

### setApp(App app)

When you pass an Express-like app to `setApp`, you can then call
`route` on any assets that you'd like to route via `app.get`.

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