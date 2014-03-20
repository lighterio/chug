var assert = require('assert-plus');
var api = require('../lighter-load');

describe('API', function () {
	before(function () {
		api.waitCount = 0;
		api.isReady = false;
		api.onReadyQueue = [];
	});
	describe('load', function () {
		it('should be an object', function () {
			assert.func(api);
		});
	});
	describe('version', function () {
		var packageVersion = require('../package.json').version;
		it('should be ' + packageVersion, function () {
			var apiVersion = api.version;
			assert.equal(apiVersion, packageVersion);
		});
	});
	describe('wait/unwait', function() {
		it('should increment/decrement', function () {
			api.wait();
			assert.equal(api.waitCount, 1);
			assert.equal(api.isReady, false);
			api.wait();
			assert.equal(api.waitCount, 2);
			api.unwait();
			assert.equal(api.waitCount, 1);
			assert.equal(api.isReady, false);
			api.unwait();
			assert.equal(api.waitCount, 0);
			assert.equal(api.isReady, true);
			api.isReady = false;
		});
	});
	describe('onReady', function() {
		it('should have a queue', function () {
			assert.func(api.onReady);
			assert.object(api.onReadyQueue);
			api.onReady(function() { });
			assert.equal(api.onReadyQueue.length, 1);
		});
		it('should execute callbacks', function () {
			var calls = 0;
			var callback = function () {
				calls++;
			};
			// A call isn't made initially because isReady == false.
			api.onReady(callback);
			assert.equal(calls, 0);

			// Starting an async call doesn't cause a call to execute.
			api.wait();
			assert.equal(calls, 0);

			// Async calls are in progress, so callbacks won't execute.
			api.onReady(callback);
			assert.equal(calls, 0);

			// Once async calls finish, callbacks will execute.
			api.unwait();
			assert.equal(calls, 2);

			// Initial load is completed, so callbacks execute immediately.
			api.onReady(callback);
			assert.equal(calls, 3);
		});
	});
});