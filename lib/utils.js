
var class2type = {},
    toString = class2type.toString,
    push = [].push;

"Boolean Number String Function Array Date RegExp Object Error".split(" ").forEach(function(name) {
    class2type[ "[object " + name + "]" ] = name.toLowerCase()
})

var type = exports.type = function(obj) {
    return obj == null ? String(obj) :
        class2type[toString.call(obj)] || "object"
};

/**
 * merge src into dst. src and dst should have the same type either be Object or Array,
 * otherwise return dst without modifying.
 * @param {Array | Object} dst
 * @param {Array | Object} src
 * @param {boolean=} _unique
 * @returns {*} dst
 */
exports.merge = function merge(dst, src, _unique) {
    var dstType = type(dst),
        srcType = type(src),
        iDstType, iSrcType, item;

    if (dstType == 'array' && srcType == 'array') {
        push.apply(dst, src);
        _unique && unique(dst);
    }
    if (srcType == 'object' && dstType == 'object') {
        for (var key in src) {
            item = src[key];
            iDstType = type(dst[key]);
            iSrcType = type(item);
            if (iDstType == 'array' && iSrcType == 'array'){
                push.apply(dst[key], item);
                _unique && unique(dst[key])
            }
            else if (iDstType == 'object' && iSrcType == 'object')
                merge(dst[key], item);
            else
                dst[key] = item;
        }
    }
    return dst;
};

/**
 * make string array unique.(or, other type could use it's toString() as the key)
 * @param {string[]} array
 * @returns {Array}
 */
var unique = exports.unique = function(array) {
    if (type(array) == 'array' && array.length) {
        var hash = {};
        for (var i = 0; i < array.length; i++) {
            var item = array[i];
            if (!hash[item]) {
                hash[item] = 1;
            } else {
                array.splice(i--, 1);
            }
        }
    }
    return array;
};

var ORIGIN_RE = /^https?:\/\/.+?(?:(?=\/)|$)/;
var httpPrefix = 'http:';
var httpsPrefix = 'https:';

/**
 * 根据宿主页url，补全此页面的相对地址url
 * @param {string} regular - 协议名，端口都完整的宿主url
 * @param {string | [string]} urls 待补全的url
 * @returns {Array}
 */
exports.fixUrl = function(regular, urls) {
    var origin, path, ret;

    regular = regular.replace(ORIGIN_RE, '');
    origin = RegExp['$&'];
    if (!origin)
        return null;

    ret = [];
    if (regular === '')
        regular = '/';
    path = regular.split('/');
    path.pop();
    urls = urls instanceof Array ? urls : [urls];
    urls.forEach(function(url) {
        if (url[0] == '/')
            url = origin + url;
        else if(url.indexOf(httpPrefix) && url.indexOf(httpsPrefix)) {
            if (url[0] != '.')
                url = './' + url;
            url = origin + fix(path.slice(), url.split('/'));
        }
        ret.push(ampDecode(url));
    });

    return ret
};

function fix(path, segs) {
    for (var i = 0; i < segs.length; i++) {
        var seg = segs[i];
        if ('..' == seg) path.pop();
        else if ('.' != seg) path.push(seg);
    }
    return path.join('/')
}

/**
 * translate &amp; to &
 */
function ampDecode(text) {
    return text.replace(/&amp;/g, '&');
}

exports.proxy = function(target, name) {
    return target
}