var ORIGIN_RE = /^https?:\/\/.+?(?:(?=\/)|$)/
  , FUNCTION_RE = /^function\s*?\([\s\S]*?\)\s*?\{[\s\S]*?}\s*$/

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

exports.isFunctionString = function(fn) {
  return typeof fn == 'string' && FUNCTION_RE.test(fn)
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
 * resolve urls to absolute url based on the given url
 * @param {string} regUrl - the based absolute url
 * @param {string | [string]} urls to resolve
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