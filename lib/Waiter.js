var Class = require('./Class');

/**
 * Waiter is a poor-man's async.
 * It provides great performance and has no dependencies.
 * @type {Waiter}
 */
var Waiter = module.exports = Class.extend({

	/**
	 * Constructor.
	 */
	init: function () {

		/**
		 * Count the number of waiting operations in progress.
		 * When this number reaches zero, we've gone from initial loading to watching.
		 * @type {number}
		 */
		this.waitCount = 0;

		/**
		 * Other waiters may depend on this one.
		 * @type {null}
		 */
		this.waiters = [];

		/**
		 * Indicate whether we have ready the initial load.
		 * @type {boolean}
		 */
		this.isReady = false;

		/**
		 * Keep a queue of callbacks to be run when the initial load is ready.
		 * @type {Array}
		 */
		this.onReadyQueue = [];
	},

	/**
	 * Increment the number of waiting operations in progress.
	 * @returns {Waiter}
	 */
	wait: function () {
		this.waiters.forEach(function (waiter) {
			waiter.wait();
		});
		this.waitCount++;
		return this;
	},

	/**
	 * Decrement the number of waiting operations in progress.
	 * If no operations are in progress, we're ready.
	 * @returns {Waiter}
	 */
	unwait: function () {
		this.waitCount--;
		if (!this.waitCount) {
			this.isReady = true;
			this.onReadyQueue.forEach(function (callback) {
				callback();
			});
			this.onReadyQueue = [];
		}
		this.waiters.forEach(function (waiter) {
			waiter.unwait();
		});
		return this;
	},

	/**
	 * Decrement the number of waiting operations in progress.
	 * @returns {Waiter}
	 */
	onReady: function (callback) {
		if (this.isReady) {
			callback();
		}
		else {
			this.onReadyQueue.push(callback);
		}
		return this;
	}
});