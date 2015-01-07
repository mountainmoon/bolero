//UPPERCASE strings will be replaced if compiled for browser
exports.mode = 'BOLERO_MODE' == 'browser' ? 'browser' : 'node'

var constructors = {}
  , files

if (exports.mode == 'node') {
  var fs = require('fs')
    , path = require('path')

  files = fs.readdirSync(path.join(__dirname, 'adapters'))
} else {
  files = ['BOLERO_CRAWLERS']
}

files.forEach(function(file) {
  var name = file.replace('.js', '')
  constructors[name] = name
})

exports.getAdapter = function(name) {
  var type = typeof constructors[name], ctor

  if (type == 'string') {
    ctor = constructors[name] = require('./adapters/' + name)
  } else if (type == 'function') {
    ctor = constructors[name]
  } else if (type == 'undefined') {
    ctor = defaultAdapter
  } else {
    throw Error('No such adapter:' + name)
  }
  // arg `name` takes no effect. Use Function.prototype.bind ？
  return new (ctor.bind.apply(ctor, arguments))
}
// pre-call  TODO: conflicts browser and node
var defaultAdapter = require('./adapters/' + (exports.mode == 'node' ?
  'node-adapter' : 'browser-adapter'))
