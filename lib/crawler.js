var EventEmitter = require('events').EventEmitter
var adapterFactory = require('./adapter-factory')
var util = require('./util')

module.exports = Crawler

var slice = Array.prototype.slice
var push = Array.prototype.push

var defaultCallback = function() {}
var interval
var adapterName

function Crawler(option) {
  var type = typeof option
    , _interval = option && option.interval || interval
    , name = option && option.name || adapterName
    , url

  this.results = []
  this.length = 0
  this.status = 'pending'

  if (option && type == 'object') {
    url = option.url || []
    url = util.isArrayLike(url) ? url : [url]

    if (option.progress) this.on('progress', option.progress)
    if (option.drain) this.on('drain', option.drain)
  } else if (type != 'undefined') {
    throw TypeError('argument option should either be an Object or undefined')
  }

  option = option || {}
  // create an adapter to do specific crawling work
  // the 2nd argument `this` should be deemed as an array
  adapterFactory.getAdapter(name, this, wrapper(this),
    option.callback || defaultCallback, _interval, option.timeout)

  // so the `length` will be changed
  url && push.apply(this, url)

  // todo: report inside error in this way, For Now
  this.on('progress', function(err) {
    if (err instanceof Error) console.error(err.stack);
  })
}

function wrapper(self) {
  return {
    emitDrain: function() {
      var args = slice.call(arguments)
      args.unshift('drain')
      self.status = 'drain'
      self.emit.apply(self, args)
    },
    emitProgress: function(result) {
      var args = slice.call(arguments)
      args.unshift('progress')
      self.results.push(result)
      self.emit.apply(self, args)
    },
    // listen events: `run` and `pause`
    on: self.on.bind(self)
  }
}

Crawler.mode = adapterFactory.mode

Crawler.prototype = Object.create(EventEmitter.prototype, {
  constructor: {
    value: Crawler,
    enumerable: false,
    writable: true
  }
})

Crawler.prototype.run = function() {
  this.status = 'running'
  this.emit('run')
  return this
}

Crawler.prototype.queue = function(url) {
  if (url) {
    url = util.isArrayLike(url) ? url : [url]
    push.apply(this, url)
  }
  return this
}

Crawler.prototype.pause = function() {
  this.status = 'pausing'
  this.emit('pause')
  return this
}

Crawler.prototype.splice = Array.prototype.splice
Crawler.prototype.shift = Array.prototype.shift

Crawler.default = function(obj) {
  defaultCallback = obj.callback || defaultCallback
  interval = obj.interval || interval
  adapterName = obj.adapterName
}

// todo:
Crawler.destroy = function() {
  if (!Crawler.mode == 'browser')
    throw Error("destroy can't be invoked except in browsers ")
}