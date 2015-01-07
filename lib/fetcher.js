/**
 * Created by lilith on 2014/8/6.
 */

//TODO: 1.cookie. 如何对cookie进行控制，使得关闭和开启cookie可控
//TODO: 2.valueLink. 用渲染后的dom结构来计算连接到关键词的距离可以有效衡量连接的权重
//TODO: 3.controller. 对于fetch网页应当有一个外部控制，1.可一次运行多少轮；2.可一直运行，直到暂停命令，或外部条件使其暂停（也许总有一个使其暂停的条件比较好，1e9轮或url死循环？）
//TODO: 4.weightPage. 对一张网页权重的衡量如果在fetcher中进行，可以借助DOM来进行，但从全体网页的角度来把握单张网页的权重似乎更合理
//TODO: 5.target related with res. 让找出的资源不仅和url相关，还应该和目标相关（但并不总是需要这样，默认关闭吧）
//TODO: 6.fetch pages continuously not turn after turn.
//TODO: 7.iframe quantity constrain --30%
//TODO: 8.fetch speed control for global and individual origin --30%
//TODO: 9.filter the url having #~ suffix, may be place it to top context is better.
//TODO: 10.robot.txt
//TODO: 11.Node crawler
//TODO: 12.distributed crawler
//TODO: 13.remote decision of fetching URL --20%

/**
 * hold window for postMessage
 */
var eventEmitter, results,
    class2type = {},
    toString = class2type.toString,
    REGEXP_RE = /^\/.+\/(?!.*([img]).*\1.*$)[img]{0,3}$/,
    // TODO:using a factory to create a fetcher may be better.  support for node & browser
    iframeFetcher = require('iframeFetcher'),
    utils = require('utils'),
    unique = utils.unique,
    fixUrl = utils.fixUrl,
    type = utils.type;

eventEmitter = new (require('event').EventEmitter);

/**
 * 当每个url请求的资源返回时，触发progress事件，可将不同的handler多次添加到此
 * @param {Function} callback - function(result, results), result: {url:., result:.}
 * @returns {object}
 */
function onProgress(callback) {
    eventEmitter.on('progress', callback);
    return this;
}

function removeProgress(callback) {
    eventEmitter.removeListener('progress', callback);
    return this;
}
function removeAllProgresses() {
    eventEmitter.removeAllListeners('progress');
    return this;
}

/**
 * 根据url以及pattern来获取目标，当然是异步的,fetch回来url，应当继承其父url的pattern和setting
 * TODO: let the pattern argument append to the url.pattern, not mutex with it, or let be optional by some other arguments.
 * @param {string | [string, Object,..]} url - 目标url
 * @param {[regexp | Function | [] ]} pattern - the pattern for the wanted targets
 *  regexp: either directive-like string OR a RegExp literal string.
 *  []: [[RE, {key:key,index:index},{key:key, index:index}] | [RE, key] ..]: index表示要捕获组的id，key表示该组所匹配的字符在作为返回结果的一部分是所对应带名字
 *  function: function(doc,[]){exports = module.exports = {links:[], imgs:[], object:{..}}}；doc即可能是文档字符串，也可能是docDOM。视config而定
 * @param {Object} setting - {type:false,allow-scripts:false,page:false, repeat}
 *  type: 'str', 'img', 'dom' 表示使用dom来渲染,一般当第2个参数为函数，并且其doc需要是DOM时使用；若pattern为css选择器，则DOM自动true
 *  repeat: true,允许返回的资源可以重复，默认为false(undefined)
 *  fixKeys: [key1, key2,..] key is the resource name in the result
 *  allow-scripts:允许页面可执行脚本；页面执行的脚本大多包含界面初始化脚本，能更好的还原实际页面
 *  page:表示是否获取页面本身，页面本身较大，是否有必要获取呢？默认不获取
 */
function fetch(url, pattern, setting) {
    results = {};
    return new Promise(function(res) {
        var urls, targets, length;
        urls = type(url) == 'array' ? url : [url];
        if (!pattern)
            pattern = [];
        handlePattern(pattern);
        targets = makeTarget(urls, pattern, setting);
        length = targets.length;
        targets.forEach(function(target) {
            iframeFetcher.fetch(target).then(function(data) {
                var result = data.result,
                    fixKeys = target.setting.fixKeys;

                if (!target.setting.repeat && target.setting.type != 'img')
                    for (var key in result)
                        unique(result[key])

                if (type(fixKeys) == 'array')
                    fixKeys.forEach(function(key) {
                        if (result[key])
                            result[key] = fixUrl(data.url, result[key])
                    });

                results[data.url] = result;
                eventEmitter.emit('progress', data.url, result, results);
                if (!--length) {
                    res(results)
                }
            })
        })
    })
}

/**
 * 获取图片的data url
 * @param src
 * @returns {*}
 */
function getDataUrl(src) {
    return fetch(src, null, {type: 'img'})
}

/**
 * 将url，pattern，setting规范化为一个完备的target
 * @private
 * @param urls
 * @param patterns
 * @param setting
 * @returns {Array}
 */
function makeTarget(urls, patterns, setting) {
    //当存在两个url相同时要做什么容错吗？两个相同url会带来不必要的麻烦(若有两个setting，选哪个？)
    var targets = [],
        defaultArgs = {
            pattern: patterns,
            setting: setting || {type: 'str'}
        },
        target;
    urls = type(urls) == 'array' ? urls : [urls];
    urls.forEach(function(url) {
        if (type(url) == 'string')
            target = extend({url: regularizeUrl(url)}, defaultArgs)
        else if (type(url) == 'object') {
            if (!url.pattern && !patterns)
                throw TypeError('url.pattern or patterns, at least exist one of them')
            url.pattern = !url.pattern ? patterns : handlePattern(url.pattern)
            url.setting = url.setting || {};
            extend(url.setting, setting)
            url.url = regularizeUrl(url.url)
            target = url
        } else throw TypeError('url must either be a string or a object')
        targets.push(target)
    })
    return targets
}

/**
 * add 'http' prefix for those has no http prefix urls
 * @param url
 * @returns {*}
 */
function regularizeUrl(url) {
    if (url) {
        if (!~url.indexOf('http://') && !~url.indexOf('https://')) {
            url = 'http://' + url;
        }
        return url
    }
    throw TypeError('url must be not empty')
}

/**
 * extend the properties of src to dst
 * @private
 * @param {Object} dst
 * @param {Object} src
 * @param [overwrite] - if it is true, overwrite the property of dst with the same name property of src
 * @returns {*} dst self
 */
function extend(dst, src, overwrite) {
    if (type(dst) == 'object' && type(src) == 'object')
        for (var k in src)
            if (src.hasOwnProperty(k) && type(src[k]) != 'undefined' && (!(k in dst) || overwrite))
                dst[k] = src[k];
    return dst
}

/**
 * 处理pattern，封装成一个数组
 * @private
 * @param pattern - see fetch
 * @returns {Array} - [regexp | [regexp, {key1: index1, key2: index2}] | function-style-string,..]
 */
function handlePattern(pattern) {
    if (type(pattern) != 'array')
        throw TypeError('pattern should be an array');
    pattern.forEach(function(p, i) {
        var key, pair;
        switch (type(p)) {
            case 'regexp':
                key = '_result' + i;
                pair = {};
                pair[key] = 0;
                p = [p, pair];
                break;
            case 'function':
                p = p.toString();
                break;
            case 'array':
                if (type(p[0]) != 'regexp')
                    throw TypeError(p[0] + ' should be a RegExp')
                if (type(p[1]) == 'string') {//if just a string, let it match the whole(0).
                    key = p[1];
                    p[1] = {};
                    p[1][key] = 0;
                }
                break;
            default :
                throw TypeError('pattern type is wrong, see fetch.fetch:pattern')
        }
        pattern[i] = p;
    })
    return pattern;
}

exports = module.exports = {
    fetch: fetch,
    getDataUrl: getDataUrl,
    onProgress: onProgress,
    removeProgress: removeProgress,
    removeAllProgresses: removeAllProgresses
}