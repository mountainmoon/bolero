var Crawler = bolero.Crawler
  , socket = io()
  , FUNCTION_RE = /^function\s*?\([\s\S]*?\)\s*?\{[\s\S]*?}\s*$/
  , uidQueue = [] // TODO: it maybe not work in future
  , crawler

crawler = new Crawler({
  progress: function(result) {
    var uid = uidQueue.shift()
    socket.emit('data', uid, result.data)
    //console.log('debug:progress', uid, result.url);
  }
})

socket.on('fetch', function(uid, msg) {
  crawler.queue({
    url: msg.url,
    callback: wrapCallback(msg.domCallback)
  }).run()
  uidQueue.push(uid)
  //console.log('debug:fetch', uid, msg.url);
})

function wrapCallback(cb) {
  var fn = function(html, response) {
    delete response.bolero
    return response
  }

  if (FUNCTION_RE.test(cb)) fn.domCallback = cb

  return fn
}