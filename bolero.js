;(function(){

// CommonJS require()

function require(p){
        var path = require.resolve(p)
            , mod = require.modules[path];
        if (!mod) throw new Error('failed to require "' + p + '"');
        if (!mod.exports) {
            mod.exports = {};
            mod.call(mod.exports, mod.exports, require.relative(path), mod);
        }
        return mod.exports;
    }

require.modules = {};

require.resolve = function (path){
        var orig = path
            , reg = path + '.js'
            , index = path + '/index.js';
        return require.modules[reg] && reg
            || require.modules[index] && index
            || orig;
    };

require.register = function (path, fn){
        require.modules[path] = fn;
    };

require.relative = function (parent) {
        return function(p){
            if ('.' != p.charAt(0)) return require(p);

            var path = parent.split('/')
                , segs = p.split('/');
            path.pop();

            for (var i = 0; i < segs.length; i++) {
                var seg = segs[i];
                if ('..' == seg) path.pop();
                else if ('.' != seg) path.push(seg);
            }

            return require(path.join('/'));
        };
    };



require.register("adapter-factory.js", function(exports, require, module){
//UPPERCASE strings will be replaced if compiled for browser
exports.mode = 'browser' == 'browser' ? 'browser' : 'node'

var constructors = {}
  , files

if (exports.mode == 'node') {
  var fs = require('fs')
    , path = require('path')

  files = fs.readdirSync(path.join(__dirname, 'adapters'))
} else {
  files = ['adapters/browser-adapter.js']
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

}); // module: adapter-factory.js


require.register("crawler.js", function(exports, require, module){
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
}); // module: crawler.js


require.register("events.js", function(exports, require, module){


function EventEmitter() {
    this._events = this._events || {};
}
exports.EventEmitter = EventEmitter;

EventEmitter.prototype.emit = function emit(type) {
    var handler, len, args, i, listeners;

    if (!this._events)
        this._events = {};

    handler = this._events[type];

    if (typeof handler === 'undefined')
        return false;

    if (typeof handler === 'function') {
        switch (arguments.length) {
            // fast cases
            case 1:
                handler.call(this);
                break;
            case 2:
                handler.call(this, arguments[1]);
                break;
            case 3:
                handler.call(this, arguments[1], arguments[2]);
                break;
            // slower
            default:
                len = arguments.length;
                args = new Array(len - 1);
                for (i = 1; i < len; i++)
                    args[i - 1] = arguments[i];
                handler.apply(this, args);
        }
    } else if (typeof handler === 'object') {
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
            args[i - 1] = arguments[i];

        listeners = handler.slice();
        len = listeners.length;
        for (i = 0; i < len; i++)
            listeners[i].apply(this, args);
    }

    return true;
};

EventEmitter.prototype.addListener = function addListener(type, listener) {
    if (typeof listener !== 'function')
        throw TypeError('listener must be a function');

    if (!this._events)
        this._events = {};

    if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
        this._events[type] = listener;
    else if (typeof this._events[type] === 'object')
    // If we've already got an array, just append.
        this._events[type].push(listener);
    else
    // Adding the second element, need to change to array.
        this._events[type] = [this._events[type], listener];

    return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function once(type, listener) {
    if (typeof listener !== 'function')
        throw TypeError('listener must be a function');

    var fired = false;

    function g() {
        this.removeListener(type, g);

        if (!fired) {
            fired = true;
            listener.apply(this, arguments);
        }
    }
    //why?? 见removeListener,这使得这个函数既可在触发后通过g自动remove掉，也可以通过listener本身来remove掉
    g.listener = listener;
    this.on(type, g);

    return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
        var list, position, length, i;

        if (typeof listener !== 'function')
            throw TypeError('listener must be a function');

        if (!this._events || !this._events[type])
            return this;

        list = this._events[type];
        length = list.length;
        position = -1;

        if (list === listener ||
            (typeof list.listener === 'function' && list.listener === listener)) {
            delete this._events[type];
            if (this._events.removeListener)
                this.emit('removeListener', type, listener);

        } else if (typeof list === 'object') {
            for (i = length; i-- > 0;) {
                if (list[i] === listener ||
                    (list[i].listener && list[i].listener === listener)) {
                    position = i;
                    break;
                }
            }

            if (position < 0)
                return this;

            if (list.length === 1) {
                list.length = 0;
                delete this._events[type];
            } else {
                list.splice(position, 1);
            }

            if (this._events.removeListener)
                this.emit('removeListener', type, listener);
        }

        return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
        var key, listeners;

        if (!this._events)
            return this;

        // not listening for removeListener, no need to emit
        if (!this._events.removeListener) {
            if (arguments.length === 0)
                this._events = {};
            else if (this._events[type])
                delete this._events[type];
            return this;
        }

        // emit removeListener for all listeners on all events
        if (arguments.length === 0) {
            for (key in this._events) {
                if (key === 'removeListener') continue;
                this.removeAllListeners(key);
            }
            this.removeAllListeners('removeListener');
            this._events = {};
            return this;
        }

        listeners = this._events[type];

        if (typeof listeners === 'function') {
            this.removeListener(type, listeners);
        } else if (Array.isArray(listeners)) {
            // LIFO order
            while (listeners.length)
                this.removeListener(type, listeners[listeners.length - 1]);
        }
        delete this._events[type];

        return this;
    };

}); // module: events.js


require.register("extractor.js", function(exports, require, module){
function attrExtractor(tag, attr, alias) {
  if (typeof tag != 'string' && typeof attr != 'string')
    throw TypeError('tag and attr should be string')
  var attrRE = new RegExp('<' + tag + ('\\b[^>]*?\\s'+ attr
                              + '\\s*=\\s*("|\')([\\S\\s]*?)\\1')
                              + '[^>]*\\/?>', 'ig')
  return function(response) {
    if (!response) return
    var ret, array
    attr = alias || attr
    response.replace(attrRE, function(m, _, val) {
      if (!ret) {
        ret = {}
        array = ret[attr] = []
      }
      array.push(val)
    })
    return ret
  }
}

var linkExtractor = attrExtractor('a', 'href')

exports.attrExtractor = attrExtractor
exports.linkExtractor = linkExtractor
}); // module: extractor.js


require.register("iframe-pool.js", function(exports, require, module){
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

}); // module: iframe-pool.js


require.register("lruList.js", function(exports, require, module){
/**
 * create a lru Cache
 * @param length
 * @returns {{put: Function, get: Function, remove: Function}}
 */
exports.createLRUList = function (length) {
  var size = 0,
    data = {},
    capacity = length,
    lruHash = {},
    freshEnd = null,
    staleEnd = null;

  return {
    put: function(key, value) {
      var lruEntry = lruHash[key] || (lruHash[key] = {key: key});

      refresh(lruEntry);

      if (!(key in data)) size++;
      data[key] = value;

      if (size > capacity) {
        this.remove(staleEnd.key);
      }
      return value;
    },

    get: function(key) {
      var lruEntry = lruHash[key];
      if (!lruEntry) return;
      refresh(lruEntry);
      return data[key];
    },

    /**
     * @param {Function | String} key - function(realKey){return boolean}
     * @returns {*} return the real key if argument 'key' is function, otherwise return boolean
     */
    has: function(key) {
      var keys = Object.keys(lruHash), realKey;
      if (typeof key == 'function') {
        !keys.some(function(_key) {
          realKey = _key;
          return key(_key);
        }) && (realKey = void 0);
        return realKey
      }
      return keys.indexOf(key) != -1
    },

    pop: function() {
      if (staleEnd) return {
        key: staleEnd.key,
        data: this.remove(staleEnd.key)
      }
    },

    remove: function(key) {
      var lruEntry = lruHash[key], ret;

      if (!lruEntry) return;

      if (lruEntry == freshEnd) freshEnd = lruEntry.p;
      if (lruEntry == staleEnd) staleEnd = lruEntry.n;
      link(lruEntry.p, lruEntry.n);

      ret = data[key];
      delete lruHash[key];
      delete data[key];
      size--;
      return ret;
    },

    removeAll: function() {
      data = {};
      size = 0;
      lruHash = {};
      freshEnd = staleEnd = null;
    },

    size: function() {
      return size;
    }
  };

  /**
   * makes the `entry` the freshEnd of the LRU linked list
   */
  function refresh(entry) {
    if (entry != freshEnd) {
      if (!staleEnd) {
        staleEnd = entry;
      } else if (staleEnd == entry) {
        staleEnd = entry.n;
      }

      link(entry.p, entry.n);
      link(freshEnd, entry);
      freshEnd = entry;
      freshEnd.n = null;
    }
  }

  /**
   *  p         n
   * <-- entry -->
   *
   *     staleEnd           ....           freshEnd
   *  .., entryX,  entry.p,  entry,  entry.n,  entryY ..
   */

  function link(prevEntry, nextEntry) {
    if (nextEntry != prevEntry) {
      if (nextEntry) nextEntry.p = prevEntry;
      if (prevEntry) prevEntry.n = nextEntry;
    }
  }
}
}); // module: lruList.js


require.register("util.js", function(exports, require, module){
var ORIGIN_RE = /^https?:\/\/.+?(?:(?=\/)|$)/

exports.getOrigin = function(url) {
  if (ORIGIN_RE.test(String(url))) return RegExp['$&']
}

exports.saveResRej = function(obj) {
  return function(res, rej) {
    obj.resRej = {
      resolve: res,
      reject: rej
    }
  }
}

exports.isPromise = function(p) {
  return p && !exports.isWindow(p) && typeof p.then == 'function'
}

exports.isWindow = function(win) {
  return win && win.window === win
}

exports.isArrayLike = function(obj) {
  if (!obj || exports.isWindow(obj)) return false
  return !(typeof obj == 'string' || typeof obj.length != 'number')
}

// compare 2 absolute urls, regarding string `s` as
// equal with the `s` version trailing with any number '/'
exports.urlEqual = function(url1, url2) {
  if (url1 == url2) return true
  url1 = String(url1)
  url2 = String(url2)
  return url2.indexOf(url1.replace(/\/+$/, '')) != -1
}

/**
 * 补全相对地址url
 * @param {string} regUrl - 协议名，端口都完整的url
 * @param {string | [string]} urls 待补全的url
 * @returns {Array}
 */
exports.absUrl = function(regUrl, urls) {
  var origin, path, ret;

  regUrl = regUrl.replace(ORIGIN_RE, '')
  origin = RegExp['$&']
  if (!origin)
    return null

  ret = [];
  if (regUrl === '')
    regUrl = '/';
  path = regUrl.split('/')
  path.pop();
  urls = Array.isArray(urls) ? urls : [urls]
  urls.forEach(function(url) {
    if (url[0] == '/')
      url = origin + url
    else if(url.indexOf('http:') && url.indexOf('https:')) {
      if (url[0] != '.') url = './' + url
      url = origin + fix(path.slice(), url.split('/'))
    }
    ret.push(url.replace(/&amp;/g, '&'))
  })

  return ret
}

function fix(path, segs) {
  for (var i = 0; i < segs.length; i++) {
    var seg = segs[i]
    if ('..' == seg) path.pop()
    else if ('.' != seg) path.push(seg)
  }
  return path.join('/')
}
}); // module: util.js


require.register("adapters/browser-adapter.js", function(exports, require, module){
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
}); // module: adapters/browser-adapter.js

window.bolero = { Crawler: require("crawler"), extractor: require("extractor"), util: require("util"), require: require}
})(window);