var Crawler = require("../../node_modules/crawler")

module.exports  = NodeAdapter

function NodeAdapter(urls, oCrawler, callback, interval_, timeout_) {
  if (typeof urls.length != 'number' || !oCrawler
    || typeof callback != 'function') throw TypeError('arguments error')

  var interval = interval_ >= 0 ? +interval_ : 1000
    , timeout = timeout_ >=0 ? +timeout_ : 20000
    , results = []
    , defaultCallback = callback
    , state = 'pause'
    , timer

  var crawler = new Crawler({
    callback: wrapCallback(callback),
    onDrain: function() {
      oCrawler.emitProgress(results[results.length - 1])
      if (state == 'run'){
        if (!urls.length) {
          state = 'pause'
          return oCrawler.emitDrain(results)
        }
        timer = setTimeout(run, interval)
      }
    },
    timeout: timeout
  })

  oCrawler.on('run', function() {state != 'run' && run()})
  oCrawler.on('pause', function() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    state = 'pause'
  })

  function wrapCallback(callback) {
    return function(err, result) {
      err && console.error(err) //TODO: handle error
      results.push({
        url: result.uri,
        data: callback(result.body, result, err),
        timestamp: Date.now()
      })
    }
  }

  function run() {
    if (!urls.length) {
      state = 'pause'
      return oCrawler.emitDrain(results)
    }

    var url = urls.shift(), fn
    if (url && typeof url == 'object') {
      fn = url.callback
      url = url.url
    }
    fn = fn || defaultCallback

    crawler.queue({
      url: url,
      callback: wrapCallback(fn)
    })
    state = 'run'
  }
}