var chug = require('../chug');
var Waiter = require('../lib/Waiter');

describe('Waiter', function () {
  before(function () {
    chug.waitCount = 0;
    chug.isReady = false;
    chug.onceReadyQueue = [];
    chug.onReadyQueue = [];
  });
  describe('wait/unwait', function() {
    it('should increment/decrement', function () {
      var w = new Waiter();
      w.wait();
      is(w.waitCount, 1);
      is(w.isReady, false);
      w.wait();
      is(w.waitCount, 2);
      w.unwait();
      is(w.waitCount, 1);
      is(w.isReady, false);
      w.unwait();
      is(w.waitCount, 0);
      is(w.isReady, true);
      w.isReady = false;
    });
  });
  describe('onceReady', function() {
    var w = new Waiter();
    it('should have a method', function () {
      is.function(w.onceReady);
    });
    it('should have a queue', function () {
      is.object(w.onceReadyQueue);
      w.onceReady(function() { });
      is(w.onceReadyQueue.length, 1);
    });
    it('should execute callbacks', function () {
      var calls = 0;
      var callback = function () {
        calls++;
      };
      // A call isn't made initially because isReady == false.
      w.onceReady(callback);
      is(calls, 0);

      // Starting an async call doesn't cause a call to execute.
      w.wait();
      is(calls, 0);

      // Async calls are in progress, so callbacks won't execute.
      w.onceReady(callback);
      is(calls, 0);

      // Once async calls finish, callbacks will execute.
      w.unwait();
      is(calls, 2);

      // Initial load is completed, so callbacks execute immediately.
      w.onceReady(callback);
      is(calls, 3);
    });
  });
  describe('onReady', function() {
    var w = new Waiter();
    it('should have a method', function () {
      is.function(w.onReady);
    });
    it('should have a queue', function () {
      is.object(w.onReadyQueue);
      w.onReady(function() { });
      is(w.onReadyQueue.length, 1);
    });
    it('should execute callbacks', function () {
      var calls = 0;
      var callback = function () {
        calls++;
      };
      // A call isn't made initially because isReady == false.
      w.onReady(callback);
      is(calls, 0);

      // Starting an async call doesn't cause a call to execute.
      w.wait();
      is(calls, 0);

      // Async calls are in progress, so callbacks won't execute.
      w.onReady(callback);
      is(calls, 0);

      // Once async calls finish, callbacks will execute.
      w.unwait();
      is(calls, 2);

      // Initial load is completed, so callbacks execute immediately.
      w.onReady(callback);
      is(calls, 3);

      // When the waiter becomes ready again, everything should re-execute.
      w.wait();
      w.unwait();
      is(calls, 6);
    });
  });
  describe('addParent', function() {
    it('should link wait counts', function (done) {
      var parent = new Waiter();
      var child = new Waiter();
      child.wait(2);
      child.addParent(parent);
      is(parent.waitCount, 2);
      parent.onceReady(done);
      child.unwait(2);
    });
  });
});
