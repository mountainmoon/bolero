// ==UserScript==
// @name Bolero
// @namespace http://mountainmoon.gitbub.com/
// @version 0.1
// @description make the browser be a crawler
// @match http://*/*
// @match https://*/*
// @copyright 2014+, mountainmoon
// ==/UserScript==

(function() {

if (top === window && !~location.search.indexOf('tentacle=top'))
  return;

var FUNCTION_RE = /^function\s*?\([\s\S]*?\)\s*?\{[\s\S]*?}\s*$/,
    URL_ARGUMENT_RE = /=(https?%3A%2F%2F.+?)(&|$)/

window.parent !== window && window.parent.postMessage({
  type: 'create',
  href: location.href
}, '*')

window.addEventListener('message', function(event) {
  var data = event.data
    , msg = {bolero: true}
    , callback

  if (!data || !data.bolero) return

  callback = data.domCallback
  if (typeof callback == 'string' && FUNCTION_RE.test(callback)) {
    callback = eval('(' + callback + ')')
    msg.domResult = callback(data)
    msg.html = document.documentElement.outerHTML
    msg.url = data.url
    if (data.url != location.href)
      msg.redirectUrl = location.href
  } else {
    msg = getPage(data.url).then(function(html) {
      return {html: html, url: data.url, bolero: true}
    })
  }

  Promise.resolve(msg).then(function(m) {
    event.source.postMessage(m, event.origin === 'null' ? '*' : event.origin)
  })
})

function getPage(url) {
  return new Promise(function(res, rej) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        if (xhr.status) {
          res(xhr.response || '');
        } else {
          // suppose it's a different origin redirect response
          if (URL_ARGUMENT_RE.test(url)) {
            rej({redirect: decodeURIComponent(RegExp.$1)});
          } else {
            rej('what happened: ' + url);
          }
        }
      }
    };
    xhr.open('GET', url);
    xhr.send()
  })
}

})();