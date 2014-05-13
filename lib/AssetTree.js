/**
 * An asset tree is a tree of assets.
 * Nodes may or may not contain an asset.
 */
var AssetTree = module.exports = function(asset, depth) {
	this.data = asset || null;
	this.depth = depth || 0;
};

AssetTree.prototype.add = function (asset) {
	var node = new AssetTree(asset, this.depth + 1);
	if (!this.children) {
		this.children = [];
	}
	this.children.push(node);
	return node;
};