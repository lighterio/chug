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


## The `chug` function

The `chug` module exports a function which returns an object called a `Load`.
(Chug a load, eh?) A load contains an array of assets that can be compiled,
minified, concatenated, etc.  There are several types of arguments that can
be passed into chug.

### `chug(Array)`
When you chug an array, it recursively chugs each element of the array into
the load. This happens asynchronously, so module order is not guaranteed.

### `chug(string)`
When you chug a string, it resolves to the file system. If the string begins
with `node_modules/`, chug resolves the path as Node.js `require` would.
Otherwise, chug loads the path if it is a file or recursively chugs its
contents if it is a directory.

## `Load`

### `.each(function callback)` returns `Load`
`each` waits until all assets are loaded, then iterates over them
with a callback that takes an asset argument.

### `.then(function callback)` returns `Load`
`then` waits until all assets are loaded, then runs a callback.

### `.compile()` returns `Load`
`compile` runs `compile` an each asset, using `each`.

### `.minify()` returns `Load`
`minify` runs `minify` on each asset, using `each`.

### `.watch()` returns `Load`
`watch` puts a `fs.watch` on the files and directories that were
added to the `Load`. When changes occur, the affected assets are
reloaded, then the load re-runs its chain of actions.

### `.route()` returns `Load`
`route` adds a route to the app that was linked to `chug` with
the `setApp` method. It uses `app.get`, so Express-like apps are
supported.

## API

In addition to the function

### `setApp(App app)`

### `setCompiler(string fileExtension, string moduleName)`

### `setMinifier(string language, string moduleName)`