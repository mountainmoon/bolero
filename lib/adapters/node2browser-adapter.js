var ChromeBrowser = require('../launcher/chrome-launcher')
var express = require('express')
var io = require('socket.io')
var http = require('http')
var path = require('path')
var emitter = new (require('events').EventEmitter)

var browser, app, socket

module.exports = Node2BrowserAdapter

function Node2BrowserAdapter(urls, oCrawler, callback, interval_, timeout_) {
  if (typeof urls.length != 'number' || !oCrawler
    || typeof callback != 'function') throw TypeError('arguments error')

  if (!app) init()

  var interval = interval_ >= 0 ? +interval_ : 1000
    , timeout = timeout_ >=0 ? +timeout_ : 20000
    , results = []
    , defaultCallback = callback
    , state = 'pause'
    , _uid = nextUid()
    , runTimer, fetchTimer

  oCrawler.on('run', function() {state != 'run' && run()})
  oCrawler.on('pause', function() {
    state = 'pause'
    if (runTimer) {
      clearTimeout(runTimer)
      runTimer = null
    }
  })

  function run() {
    if (!urls.length) {
      state = 'pause'
      return oCrawler.emitDrain(results)
    }

    var url = urls.shift(), fn, msg
    if (url && typeof url == 'object') {
      fn = url.callback
      url = url.url
    }
    msg = {url: url}
    fn = fn || defaultCallback

    if (typeof fn.domCallback == 'function')
      msg.domCallback = callback.domCallback.toString()

    fetch(msg, fn)
    state = 'run'
  }

  function fetch(msg, fn) {
    if (!socket)
      return emitter.once('connect', function() {fetch(msg, fn)})
    var cb = function(response) {
      clearTimeout(fetchTimer)

      var result = {
        url: response.url,
        data: fn(response.html, response),
        timestamp: Date.now()
      }
      results.push(result)
      oCrawler.emitProgress(result)

      if (state == 'run'){
        if (!urls.length) {
          state = 'pause'
          return oCrawler.emitDrain(results)
        }
        runTimer = setTimeout(run, interval)
      }
    }

    emitter.once('data:' + _uid, cb)  //TODO:waste
    socket.emit('fetch', _uid, msg)
    //console.log('debug:fetch', _uid, msg.url);

    fetchTimer = setTimeout(function() {
      //todo: error handle
      console.error('timeout:node2browser-adapter:' + msg.url)
    }, timeout)
  }
}

var uid = 0
function nextUid() {
  return ++uid
}

function getUid() {
  return uid
}

function init() {
  if (app) return

  app = express()
  app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/../static/client.html'))
  }).get('/client.js', function(req, res) {
    res.sendFile(path.join(__dirname + '/../static/client.js'))
  }).get('/bolero.js', function(req, res) {
    res.sendFile(path.join(__dirname + '/../../bolero.js'))
  })

  var server = http.Server(app)
  io = io(server)

  io.on('connection', function(socket_){
    socket = socket_
    // listen
    Object.keys(handler).forEach(function(name) {
      socket_.on(name, handler[name])
    })
    emitter.emit('connect')
  })

  browser = new ChromeBrowser()
  // TODO: port should be configurable
  server.listen(9998, function() {
    browser.start('http://localhost:9998')
    console.log('listen on *:9998')
  })
}

var handler = {
  disconnect: function() {
    console.log('disconnect') //todo: normal or error
  },
  data: function(uid, data) {
    emitter.emit('data:' + uid, data)
  }
}