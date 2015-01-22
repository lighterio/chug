var chug = require('../chug');
var Type = require('../common/object/type');
var is = global.is || require('exam/lib/is');

describe('Type', function () {
  it('should be extendable', function () {
    var Dog = Type.extend({
      init: function (name) {
        this.name = name;
      },
      bark: function (callback) {
        callback(this.name + ' says "woof!"');
      }
    });
    var fido = new Dog('Fido');
    fido.bark(function (message) {
      is(message, 'Fido says "woof!"');
    });
  });
});
