var AssetTree = require('../lib/AssetTree');
var assert = require('assert-plus');

describe('AssetTree', function () {
  it('should create a tree', function () {
    var tree = new AssetTree(123);
    assert.equal(tree.data, 123);
    assert.equal(tree.depth, 0);
    assert.equal(!tree.children, true);
  });
  it('should add to a tree', function () {
    var tree = new AssetTree(123);
    tree.add(456);
    assert.equal(tree.children[0].data, 456);
    assert.equal(tree.children[0].depth, 1);
  });
});