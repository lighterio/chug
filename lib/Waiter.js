var Class = require('./Class');

/**
 * Waiter is a poor-man's async with good performance and no external dependencies.
 * It counts async operations in progress and runs queued callbacks once the count is zero.
 * @type {Waiter}
 */
var Waiter = module.exports = Class.extend({

	/**
	 * Constructor.
	 */
	init: function init(parent) {

		/**
		 * Count the number of waiting operations in progress.
		 * When this number reaches zero, we've gone from initial loading to watching.
		 * @type {number}
		 */
		this.waitCount = 0;

		/**
		 * Other waiters may depend on this one.
		 * @type {Array}
		 */
		this.parents = [];

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

		// If this waiter has a parent, it's waiting should make the parent wait.
		if (parent) {
			this.addParent(parent);
		}
	},

	/**
	 * Parents of this waiter must wait for this one's operations.
	 * @param {Waiter}
	 */
	addParent: function addParent(parent) {
		this.parents.push(parent);
		if (this.waitCount) {
			parent.wait(this.waitCount);
		}
	},

	/**
	 * Increment the number of waiting operations in progress.
	 * @returns {Waiter}
	 */
	wait: function wait(count) {
		this.parents.forEach(function waitParents(waiter) {
			waiter.wait(count);
		});
		this.waitCount += count || 1;
		return this;
	},

	/**
	 * Decrement the number of waiting operations in progress.
	 * If no operations are in progress, we're ready.
	 * @returns {Waiter}
	 */
	unwait: function unwait(count) {
		this.waitCount -= count || 1;
		if (!this.waitCount) {
			this.isReady = true;
			this.onReady();
		}
		this.parents.forEach(function unwaitParents(waiter) {
			waiter.unwait(count);
		});
		return this;
	},

	/**
	 * Decrement the number of waiting operations in progress.
	 * @returns {Waiter}
	 */
	onReady: function onReady(callback) {
		if (this.isReady && !this.waitCount) {
			if (callback) {
				callback();
			} else {
				callback = this.onReadyQueue.shift();
				if (callback) {
					callback();
					if (this.onReadyQueue.length) {
						this.onReady();
					}
				}
			}
		}
		else {
			this.onReadyQueue.push(callback);
		}
		return this;
	}
});