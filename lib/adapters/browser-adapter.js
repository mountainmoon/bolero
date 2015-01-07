var pool = require('../iframe-pool')
var util = require('../util')

var urls, oCrawler, defaultCallback, results, state
var timeout, fetchTimer, runTimer, interval, fetchPromise
var win = window

module.exports = BrowserAdapter

/**
 * Browser crawler constructor. Use Singleton Pattern to keep it simple
 * @param {Array} urls_ - array-like object with a `length` property and a `splice` method
 * @param {Object} oCrawler_ - using this to communicate with the outer crawler. The structure is like this:
 *    {
 *      emitDrain: function(){},
 *      emitProgress: function(result){}, // the result argument is the result of `callback`
 *      on: function(eventName){}, // eventName: 'run' | 'pause'
 *    }
 * @param {Function} callback - the default callback function to handle the fetched result.
 * @param {number} [timeout_] - timeout for requests
 * @param {number} [interval_] - the interval between tasks. Maybe changed in future.
 * @constructor
 */
function BrowserAdapter(urls_, oCrawler_, callback, interval_, timeout_) {
  if (typeof urls_.length != 'number' || !oCrawler_
    || typeof callback != 'function') throw TypeError('arguments error')

  if (BrowserAdapter.instance) {
    reset.apply(BrowserAdapter.instance, arguments)
    return BrowserAdapter.instance
  }
  BrowserAdapter.instance = this

  this.reset = reset
  reset.apply(this, arguments)

  win.addEventListener('message', function(event) {
    var data = event.data
    if (!data ||  !data.bolero) return
    data.win = event.source
    fetchPromise.resRej.resolve(data)
  })
}

// reset variables. If param is not designed, use the old value passed by Ctor
function reset(urls_, oCrawler_, callback, interval_, timeout_) {
  urls = urls_ || urls
  oCrawler = oCrawler_ || oCrawler
  defaultCallback = callback || defaultCallback
  timeout = timeout_ || timeout || 20000
  interval = interval_ || interval ||  1000

  results = []
  state = 'pause'

  oCrawler.on('run', function() {
    state != 'run' && run()
  })
  oCrawler.on('pause', function() {
    state = 'pause'
    if (runTimer) {
      clearTimeout(runTimer)
      runTimer = null
    }
  })
}

function run() {
  if (!urls.length) {
    state = 'pause'
    return oCrawler.emitDrain(results)
  }

  var url = urls.shift(), callback
  if (url && typeof url == 'object') {
    callback = url.callback
    url = url.url
  }
  callback = callback || defaultCallback
  if (typeof url != 'string' || typeof callback != 'function')
    throw TypeError('url format is wrong, url' + url)

  fetch(url, callback)

  state = 'run'
}

function fetch(url, callback) {
  var message = {
    bolero: true,
    url: url
  }
  if (typeof callback.domCallback == 'function')
    message.domCallback = callback.domCallback.toString()

  pool.getWindow(url, !!message.domCallback).then(function(win) {
    win = win.win // can't resolve a cross-origin window directly
    win.postMessage(message, '*')

    var resRej
    fetchPromise = new Promise(function(res, rej) {
      fetchTimer = setTimeout(function() {
        pool.free(win)
        rej(Error('timeout:browser-adapter: ' + url))
      }, timeout)
      resRej = {
        resolve: res,
        reject: rej
      }
    })
    fetchPromise.resRej = resRej
    return fetchPromise

  }).then(function(response) {
    clearTimeout(fetchTimer)

    pool.free(response.win)
    response.win = null

    // TODO: allow callback return a Promise?
    var result = {
      url: response.url,
      data: callback(response.html, response),
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
  }).catch(function(err) {
    console.error(err.stack)
    // TODO:emit error
    oCrawler.emitProgress(err)
  })
}