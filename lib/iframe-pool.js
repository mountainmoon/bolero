var createLRUList = require('./lruList').createLRUList
var util = require('./util')

var getOrigin = util.getOrigin
var urlEqual = util.urlEqual
var saveResRej = util.saveResRej

var win,
    // iframe container in the dom tree
    container,
    // hash map of the work(includes creating) frame. url is the key,
    // {URL:{remains:number, win:win, origin:origin},..}
    workList,
    // a LRU list holding the idle frames.
    idleList,
    // an array holds object like {url:url, win: promise, },
    // representing the obj waiting for an available iframe
    waitingQueue,
    // using the url as the key, the index in waitingQueue as the value
    waitingHash,
    // max quantity of the iframes
    capacity,
    // timeout for window creating
    timeout

var some = Array.prototype.some

/**
 * iframe pool
 * @param url
 * @param {Boolean} strict - match exactly if true. match origin if false
 */
exports.getWindow = function(url, strict) {
  try {
    if (!idleList) exports.init(5, 10000)
    return getWindow(url, strict)
  } catch (e) {
    return Promise.reject(e)
  }
}

// after finish using window, free it.
exports.free = function(win) {
  if (!idleList || !util.isWindow(win)) return false

  for (var url in workList) {
    if (workList[url].win == win && !--workList[url].remains) {
      delete workList[url]

      if (waitingQueue.length) {
        var wait = waitingQueue.unshift()
        delete waitingHash[wait.url]
        workList[wait.url] = wait
        wait.win.resRej.resolve(createIframe(wait.url))
      } else {
        idleList.put(url, win)
      }
      return true
    }
  }
}

exports.init = function(size, timeout_) {
  if (!idleList) {
    idleList = createLRUList(capacity = size)
  } else {
    throw Error('iframe pool already init')
  }
  win = window
  container = document.createElement('div')
  container.style.display = 'none'
  document.body.appendChild(container)
  workList = {}
  waitingQueue = []
  waitingHash = {}
  timeout = timeout_ > 0 ? timeout_ : 7000

  win.addEventListener('message', function(event) {
    var data = event.data,
        iframe, promise, src
    // TODO: use a property to do a simple auth.
    if (!data || data.type != 'create') return

    // find out message is send from which iframe, & detect redirect
    !some.call(container.children, function(frm) {
      iframe = frm
      return frm.contentWindow == event.source
    }) && (iframe = null)
    if (!iframe) throw Error('message from a window which not in frame pool')

    clearTimeout(iframe.timer)

    src = iframe.src
    if (!urlEqual(src, data.href)) { //redirect detect
      console.warn('redirect happened! frame src: %s, msg url:', src, data.href)
      if (getOrigin(src) != event.origin)
        throw Error('cross-origin redirecting, from "'
          + src + '" to "' + data.url + '"')
      // same origin redirect, handle it like no redirect FOR NOW, todo
    }

    promise = workList[src].win
    workList[src].win = iframe.contentWindow
    promise.resRej.resolve({win: iframe.contentWindow})
  })
}

exports.clear = function() {
  idleList.removeAll()
  workList = {}
  waitingQueue.length = 0
  waitingHash = {}
  container.innerHTML = ''
}

function getWindow(url, strict) {
  var realUrl, _win, wait, obj

  // find window in workList and idleList
  for (var key in workList) {
    if (compareUrl(strict, url, key)) {
      realUrl = key
      break
    }
  }
  if (realUrl) {
    workList[realUrl].remains++
    _win = workList[realUrl].win

    // if find & it's a promise
    if (util.isPromise(_win)) return _win

  } else if (realUrl = idleList.has(compareUrl.bind(null, strict, url))) {
    _win = idleList.remove(realUrl)
    workList[realUrl] = {
      remains: 1,
      win: _win
    }
  }
  // if find, resolve it. can't resolve a cross-origin window directly
  if (_win) return Promise.resolve({win: _win})

  // if don't find, create a new one
  // not full, create directly
  if (container.childElementCount < capacity) {
    return createIframe(url)

    // full, but having idles
  } else if (idleList.size() > 0) {
    obj = idleList.pop()
    some.call(container.children, function(iframe) {
      if (iframe.src == obj.key) {
        container.removeChild(iframe)
        return true
      }
    })
    return createIframe(url)

    // full, no idles, but already wait
  } else if (url in waitingHash) {
    wait = waitingQueue[waitingHash[url]]
    wait.remains++
    return wait.win

    // full, no idle, no wait, so wait
  } else { 
    wait = {remains: 1, url: url}
    obj = {}
    wait.win = new Promise(saveResRej(obj))
    wait.win.resRej = obj.resRej
    waitingHash[url] = waitingQueue.length
    waitingQueue.push(wait)
    return wait.win
  }
}

function createIframe(url) {
  var iframe, work, resRej

  iframe = document.createElement('iframe')
  iframe.sandbox = 'allow-same-origin allow-scripts'
  iframe.src = url
  container.appendChild(iframe)

  if (!workList[url]) {
    workList[url] = {remains: 1}
  } else {
    workList[url].remains++
  }
  work = workList[url]

  work.win = new Promise(function(res, rej) {
    iframe.timer = setTimeout(function() {
      rej(Error('timeout:iframe-pool: ' + url))
    }, timeout)
    resRej = {
      resolve: res,
      reject: rej
    }
  })
  work.win.resRej = resRej
  return work.win
}

function compareUrl(strict, url, key) {
  return strict ? urlEqual(url, key) : getOrigin(url) == getOrigin(key)
}
