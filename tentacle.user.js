// ==UserScript==
// @name BlueCrawler
// @namespace http://use.i.E.your.homepage/
// @version 0.1
// @description enter something useful
// @match http://*/*
// @match https://*/*
// @copyright 2014+, God-like
// ==/UserScript==

(function() {

if (top === window && !~location.search.indexOf('tentacle=top'))
    return;

var REGEXP_RE = /^\/.+\/(?!.*([img]).*\1.*$)[img]{0,3}$/,
    FUNCTION_RE = /^function\s*?\([\s\S]*?\)\s*?\{[\s\S]*?}\s*$/,
    URL_ARGUMENT_RE = /=(https?%3A%2F%2F.+?)(&|$)/,
    IMAGE_TYPE_RE = /^.+\.(\w+)$/,
    IMAGE_TYPES = ['jpg', 'jpeg', 'png'],

    slice = Array.prototype.slice,
    fetchTypes = ['img', 'str', 'dom'];

var _log = console.log, log;
console.log = function() {
    var args;
    if (arguments[0] != 'tentacle') {
        return
    }
    args = slice.call(arguments, 1);
    args.unshift('##LOG##: frame, ' + location.origin + ': ');
    _log.apply(console, args)
}
log = console.log.bind(null, 'tentacle');

window.parent !== window && window.parent.postMessage({
    type: 'frame',
    fetchType: window.name,
    url: location[window.name == 'str' ? 'origin' : 'href']
}, '*');

window.addEventListener('message', function(event) {
    /**
     * event.data :
     * {
     *   type: imageLoad,fetch
     *   pattern: [string | RegExp-like string | Function | [] ] see detail in fetcher
     *   eventId: see iframeFetcher,
     *   url: the target page url , type must be fetch if it's valid
     *   auth: the page in iframe may have some sub-iframe, so prevent it. (and also window can postmessage to itself)
     * }
     */
    var data = event.data,
        url = data.url || location.href,
        type = data.type,
        promise;

    if (!fetchTypes.some(function(_type) {
        return _type == type
    }) || !checkAuth(data.auth))
        return;
    switch (type) {
        case 'img':
            promise = handleImage();
            break;
        case 'str':
            promise = handlePage(url, data.pattern);
            break;
        case 'dom':
            promise = handleDOM(data.pattern);
            break;
    }
    promise.then(function(result) {
        event.source.postMessage({
            url: url,
            result: result,
            type: typeof result == 'string' && type != 'img' ? 'redirect' : type,
            targetId: data.targetId
        }, event.origin === 'null' ? '*' : event.origin)
    })
})

/**
 * 请求资源类型为“str”，以xhr形式请求网页，并pattern以string形式解析网页并返回资源
 * @param url
 * @param pattern - see fetcher#handlePattern
 * @returns {Promise} - resolve with fetched result or
 * a redirect url if different origin redirect happened
 */
function handlePage(url, pattern) {
    var isRedirect;
    return getPage(url).then(function(html) {
        isRedirect = typeof html == 'object';
        return isRedirect ? html : parseDoc(pattern, html);
        //parseDoc returns a promise, so the merge callback would be fired till the promise resolved
    }).then(function(results) {
        return isRedirect ? results.redirect : merge(results);
    })
}

function handleDOM(pattern) {

}

function handleImage() {
    var canvas = document.createElement('canvas'),
        ctx = canvas.getContext('2d'),
        img = new Image(),
        type;

    if (IMAGE_TYPE_RE.test(location.href)) {
        type = RegExp.$1;
        if (~IMAGE_TYPES.indexOf(type)) {
            if (type == 'jpg')
                type = 'jpeg';
            type = 'image/' + type;
        } else {
            type = 'image/jpeg';
        }
    }

    return new Promise(function(res, rej) {
        img.onload = function() {
            res(getDataUrl())
        };
        img.onerror = function() {
            rej(Error(img.src + ' load failed'));
        };
        img.src = location.href;
    });

    function getDataUrl() {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        return {dataUrl: canvas.toDataURL(type)}
    }
}

/**
 * 本来是作为缓存从字符串构造出的正则用的，但既然正则能通过postMessage来传，那似乎没必要再用这个了
 * 其实这个构造正则的方式有误(通过字符串构造正则不能包含作为字面正则标识的`/`,并且igm也不能包含。)
 */
var getRE = (function() {
    var cache = [];
    return function(reStr) {
        if (typeof reStr != 'string' || !REGEXP_RE.test(reStr))
            throw TypeError('reStr must be a RegExp-like string');
        return cache[reStr] = cache[reStr] || new RegExp(reStr);
    }
}());

/**
 *
 * @param pattern - [[regexp, {key1: index1, key2: index2}] | function-style-string,..]
 * @param doc
 * @returns {*|Promise}
 */
function parseDoc(pattern, doc) {
    var docString = typeof doc == 'string' ? doc : doc.outerHTML,
        results = [];
    pattern.forEach(function(p) {
        if (typeof p == 'string') {
            if (FUNCTION_RE.test(p))
                results.push(eval('(' + p + ')')(doc));
        } else if (p instanceof Array) {
            if (!(p[0] instanceof RegExp))
                throw TypeError(p[0] + ' should be a RegExp')
            docString.replace(p[0], function() {
                var result = {};
                for (var key in p[1]) {
                    result[key] = arguments[p[1][key]];
                    results.push(result)
                }
            });
        } else throw Error('what happened')
    });
    //TODO: if every result corresponds to it's pattern, analyse would be more easy.
    //the promise returned by all(func) would be resolved till all promises in results are resolved
    return Promise.all(results)
}

/**
 * 合并个pattern产生的结果到一个总结果
 * @param results - [{img:['1', '2'], link: ['1', '2']}, {img: '1'}, {link: '1'}]
 * @returns {Object}
 */
function merge(results) {
    var ret = {};
    results && results.forEach(function(cur) {
        var key, type;
        if (cur) {
            for (key in cur) {
                if (!ret[key])
                    ret[key] = [];
                //if use push.apply, the actual length may exceed the limit of arguments' length
                type = typeof cur[key];
                if (type == 'string')
                    ret[key].push(cur[key]);
                else
                    ret[key] = ret[key].concat(cur[key]);
            }
        }
    });

    for (var key in ret) {
        var values = ret[key].sort(), prev;
        for (var i = 0; i < values.length; i++) {
            var cur = values[i];
            if (!cur || prev == cur) values.splice(i--, 1);
            else prev = cur;
        }
    }
    return ret;
}

function checkAuth(auth) {
    //TODO: to be completed
    return true
}

/**
 * 利用xhr请求url指定的网页，返回一个Promise (resolve with xhr.response)
 * @param url
 * @returns {Promise}
 */
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
                        res({redirect: decodeURIComponent(RegExp.$1)});
                    } else {
                        log('fetch failed', url);
                        res('');
                    }
                }
                /*if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304) {
                 res(xhr.response)
                 } else {
                 log('fetch failed', url);
                 log(xhr);
                 rej(xhr);
                 }*/
            }
        };
        xhr.open('GET', url);
        xhr.send()
    })
}

})();