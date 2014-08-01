var chug = require('../chug');
var Class = require('../lib/Class');

describe('Class', function () {
  it('should be extendable', function () {
    var Dog = Class.extend({
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
