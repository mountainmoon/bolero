
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


require.register("crawler.js", function(exports, require, module){

var fetcher = require('fetcher'),
    merge = require('utils').merge,
    paused = false,
    stopped = false,
    eventEmitter = new (require('event').EventEmitter),
    allResults = {},
    results, target, turn;

function reset() {
    paused = stopped = false;
    eventEmitter.removeAllListeners();
    allResults = {};
    results = undefined;
}

/**
 * 启动爬虫, 根据config设定的参数来运行爬虫， 若没有设定参数，则根据前一次搜索的链接结果来继续爬行
 * @param _turn - 表示根据返回的link来进行广度查询的层数; 指定为-1效果似乎会很不错
 * @param filter - 见`config`
 * @returns {Promise}
 */
function run(_turn, filter) {
    turn = typeof _turn === 'undefined' ? 1 : _turn;
    _filter = filter || _filter;
    //results = [];
    return new Promise(function(res, rej) {
        if (!target) {
            target = [getUrl().url];
            if (!target.length) {
                rej(Error('no target url'));
                return;
            }
        }
        (function fetch() {
            if (!turn--) {
                res(allResults);
                return;
            }
            fetcher.fetch.apply(null, target).then(function(_results) {
                // TODO: 存储获取的结果, 设置url以及可能的其他操作
                merge(allResults, results = _results);
                if (turn) {
                    var url = getUrl().a;
                    // prevent from looping
                    for (var i = 0; i < url.length; i++)
                        if (allResults[url[i]])
                            url.splice(i--, 1);
                    _filter && (url = _filter(url));
                    if (!url || !url.length)
                        turn = 0;
                    _config(url, _pattern, _setting);
                }

                /**
                 * triggered after each turn but not including last turn.
                 * If pause in the turn listener, and use config promise,
                 * may be could do sth awesome.
                 * @event turn
                 * @data results
                 */
                turn && eventEmitter.emit('turn', results);
                if (paused) {
                    paused = false;
                    eventEmitter.emit('paused');
                    eventEmitter.once('moveon', function() {
                        fetch();
                    })
                } else if (stopped) {
                    stopped = false;
                    turn = 0;
                    eventEmitter.emit('stopped');
                    res(allResults);
                } else {
                    fetch();
                }
            });
            // empty target, for fetching again based on the fetched results, if turn is not 1.
        })()
    })
}

function moveon() {
    if (!turn) return;
    //如果movieon需要调整target，就使用config，config可能是异步的
    eventEmitter.emit('moveon')
}

function pause() {
    paused = true;
    stopped = false;
    return new Promise(function(res) {
        eventEmitter.once('paused', function() {
            res(results);
        })
    })
}

function stop() {
    paused = false;
    stopped = true;
    return new Promise(function(res) {
        eventEmitter.once('stopped', function() {
            res(results);
        })
    })
}

var _pattern, _setting, _filter;

/**
 * run之前调用，用以设置要访问的页面，从该页面上要获取的资源模式，以及用何种方式获取页面的设置
 * @param {string | [string, Object] | Function} url
 *  [Object]: {url: url, pattern: pattern, setting: setting} 单独为某个url设置参数，若pattern等为空则按照其余参数的设置
 *  Function: 见`可能的参数组合`4,5
 *
 * @param {string | RegExp | Function=} pattern - the pattern for the wanted targets
 *  string: either a target contained string OR a RegExp literal string.
 *  RegExp: Need Not explain
 *  function: function(doc,[]){exports = module.exports = {links:[], imgs:[], object:{..}}}；doc即可能是文档字符串，也可能是docDOM。视config而定
 *
 * @param {Object=} setting - {type:'str'|'img'|'dom',allow-scripts:true}
 *  type:默认为str，表示是否要使用dom来渲染,一般当第2个参数为函数，并且其doc需要是DOM时使用；若pattern为css选择器，则DOM自动true
 *  allow-scripts:允许页面可执行脚本；页面执行的脚本大多包含界面初始化脚本，能更好的还原实际页面
 *
 * @param {Function=} filter - filter the fetched url, only worked while run function specified turns
 *  also could specified by run. If both set, specified by config take precedence over run.
 *  (like this function(getUrl()) {return [] })
 *
 * @returns {Promise}
 */
function config(url, pattern, setting, filter) {
    /**
     * 可能的参数组合：
     * 第一种：string, ..  (..表示pattern和setting，它们可以作为默认的参数)
     * 第二种：[string, string], ..
     * 第三种: [string, Object], ..
     * 第四种: function(url){return {1,2,3种结果，不包含..}}, ..
     * 第五种: function(url){return new Promise()} ,其resolve时，会传入{1,2,3种结果}, ..
     */

    /**
     * 利用 Promise.resolve(data or thenable)可以合并以上参数产生的不同结果
     */
    if (typeof url === 'function')
        url = url(getUrl());
    _filter = filter || _filter;
    _pattern = pattern || _pattern;
    _setting = setting || _setting || {type: 'str', fixKeys: ['a', 'img']};
    return Promise.resolve(url).then(function(url) {
        return target = [url, _pattern, _setting]
    })
}

/**
 * for internal use
 * @private
 */
function _config(url, pattern, setting) {
    target = [url, pattern, setting];
}

/**
 * 根据指定资源类型type来取回已经从url页面上获取的资源
 * @param type - 指定的资源类型
 * @param [url] - 某个解析过的页面的url
 * @param [fromDB] - 是从db中取回资源，还是直接从上一次的结果中取回
 * @returns {*} - 取回的资源，根据不同的参数返回的数据结构不同
 */
function getResource(type, url, fromDB) {
    var ret;
    if (type && url) {
        if (results[url]) {
            ret = results[url][type];
        }
    } else if (url) {
        ret = results[url];
    } else if (type) {
        ret = {};
        ret[type] = [];
        for (url in results) {
            var result = results[url];
            if (result[type]) {
                merge(ret[type], result[type])
            }
        }
    }
    return ret;
}

var on = eventEmitter.on.bind(eventEmitter),
    addListener = eventEmitter.addListener.bind(eventEmitter),
    removeListener = eventEmitter.removeListener.bind(eventEmitter),
    removeAllListeners = eventEmitter.removeAllListeners.bind(eventEmitter);

fetcher.onProgress(function() {
    var args = Array.prototype.slice.call(arguments, 0);
    args.unshift('progress');
    eventEmitter.emit.apply(eventEmitter, args);
});

/**
 * 返回的url应该是{url:url},这样可以使得传入外部函数中的url对象拥有扩展的能力，产生像node中间件那样的回调链
 * @returns {{url:url}}
 */
function getUrl() {
    return getResource('a')
}

exports = module.exports = {
    reset: reset,
    run: run,
    moveon: moveon,
    pause: pause,
    stop: stop,
    config: config,
    getRes: getResource,
    on: on,
    addListener: addListener,
    removeListener: removeListener,
    removeAllListener: removeAllListeners
}

exports.getPrivate = function(name) {return eval(name)}

}); // module: crawler.js

require.register("dataStorage.js", function(exports, require, module){


/**
 * 保存对应url的数据
 * @param url 要存储什么网页的资源，就用什么网页的url，此举会覆盖所有内容
 * @param {object} data
 * @param {string=} flag - w,a,a+
 *  w，默认值，表示覆盖原内容，
 *  a，表示将键值添加上去，若已存在相同键值的数据，则覆盖
 *  a+, 表示若已存在相同键值的数据则将新数据添加到后面
 */
function save(url, data, flag) {

}

/**
 * 将数据添加到对应url的库里边（也许在save上加个w+就可以取消这个接口了）
 * @param url 同save
 * @param {object} data
 * @param {boolean=} flag - 指示若已存在相同键值的数据，是增添还是覆盖，默认为false,表示增添
 */
function add(url, data, flag) {

}

/**
 * 加载数据
 * @param url
 * @param {string | [string] | {} | Function =} keys - 要读取的资源类型作为键值
 *  string:单个资源类型
 *  [string]:资源类型数组
 *  {key1:size1,key2:size2} or {key1:{size1:size,start1:index},key2:{}}
 *  function(data){exports = module.exports = {}}
 * @param {number=} size - 限制取出的数据条数，默认为0，即不限制；keys中的limit的优先级更高
 * @param {number=} start - 从第几条数据开始读，默认为0，keys中的优先级更高,可为负数
 * @returns {object}
 */
function load(url, keys, size, start) {
    return {}
}

/**
 * 移除数据
 * @param url - 若只有url参数则移除当前url对应的所有数据
 * @param {string | [string] | {} | Function =} keys - 要移除的资源类型作为键值
 *  string:单个资源类型
 *  [string]:资源类型数组
 *  {key1:limit1,key2:limit2} or {key1:{limit1:length,start1:index},key2:{}}
 *  function(data){return {}}
 * @param {number=} size - 限制移除的数据条数，默认为0，即不限制；keys中的limit的优先级更高
 * @param {number=} start - 从第几条数据开始移除，默认为0，keys中的优先级更高,可为负数
 */
function remove(url, keys, size, start) {

}

/**
 * 随意增删改数据
 * @param url
 * @param {Function} action - function(data) {}
 */
function manipulate(url, action) {

}

exports = module.exports = {
    add: add,
    save: save,
    load: load,
    remove: remove,
    manipulate: manipulate
}

exports.getPrivate = function(name) {return eval(name)}

}); // module: dataStorage.js

require.register("event.js", function(exports, require, module){


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

exports.getPrivate = function(name) {return eval(name)}

}); // module: event.js

require.register("fetcher.js", function(exports, require, module){
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
 *  fixKeys: [key1, key2,..]
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
                eventEmitter.emit('progress', result, results);
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
    return fetch(src, {type: 'img'})
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
exports.getPrivate = function(name) {return eval(name)}

}); // module: fetcher.js

require.register("iframeFetcher.js", function(exports, require, module){
//test在某种程度上，可以阻止clawer脚本正常工作的方法是，让页面工作在top中，如不是top就用top.location.href="location.href"来改变，并且套上try catch，如有异常则不初始化页面，

var frames = {},
    win = window,
    eventEmitter = new (require('event').EventEmitter),
    uid = 1,
    container = document.createElement('div'),
    fetchTypes = ['img', 'dom', 'str'],
    // holds the fetching task
    fetchPending = [],
    busyOrigin = {},
    // for easy test, holds the setTimeout's timer
    timer = [],
    concurrence = 0,
    MAX_CONCURRENCE = 5,
    MIN_INTERVAL_PER_ORIGIN = 2500,
    ORIGIN_RE = /^https?:\/\/.+?(?:(?=\/)|$)/;

container.style.display = 'none';
container.id = 'frameContainer';
document.body.appendChild(container);

fetchTypes.forEach(function(key) {
    frames[key] = {
        // hold the frames ready to fetch. {iframe:., targetId2Res:., loading:.}
        // It's need to check the work frames' idle state and MAYBE delete the frame at 2 moments:
        //   1. when there has a request for an idle frame;
        //   2. when fetching a resource finished.
        // The state(empty or not) of the related item in the frameResQueue
        // indicates a work frame is whether idle or not.
        work: {},
        pending: [],    // hold the resolves pair{origin:., res:.} waiting for the frame to create(not begin).
        creating: {},   // hold the resolves waiting for the frame to create(in creating) using the origin as the key
        maxLength: 3    // work queue's max length
    }
});

/**
 * str方式获取资源侦听
 */
eventEmitter.on('str', function(targetId, url, result) {
    fetchCallback(targetId, url, getOrigin(url), result, 'str')
}).
/**
 * dom方式获取资源侦听
 */
    on('dom', function(targetId, url, result) {
        fetchCallback(targetId, url, url, result, 'dom')
    }).
/**
 * frame创建完毕侦听
 */
    on('frame', function(type, url, win) {
        var queue = frames[type].creating[url];
        if (queue) {
            queue.forEach(function(resolve) {
                //see wrapping's reason in `getWindow`
                resolve([win])
            })
            delete frames[type].creating[url];
            frames[type].work[url].loading = false;
        }
    }).
/**
 * dataUrl获取侦听
 */
    on('img', function(targetId, url, result) {
        fetchCallback(targetId, url, url, result, 'img')
    }).
/**
 * DIFFERENT ORIGIN redirect. url is the old url, result is the redirecting url
 * fetch a different origin resource through xhr, would throw an error.
 * (it's transparent to js while redirect happened)
 * TODO:For now, just consider str fetch.
 */
    on('redirect', function(targetId, url, result) {
        // try free the old frame.
        // copy the targetId2Res
        // eliminate the concurrence
        // setTimeout let the origin be idle, and call dofetch
        // getWindow of the new origin
        // mark the res as redirect
        // fetch again
        fetchCallback(targetId, url, getOrigin(url), result, 'redirect');
    });

function reset() {
    container.innerHTML = '';
    fetchPending.length = 0;
    busyOrigin = {};
    uid = 1;
    concurrence = 0;
    timer.forEach(function(t) {
        clearTimeout(t);
    });
    timer.length = 0;
    fetchTypes.forEach(function(key) {
        frames[key] = {
            work: {},
            pending: [],
            creating: {},
            maxLength: 3
        }
    });
}

function fetchCallback(targetId, targetUrl, frameUrl, result, type) {
    var frameType = type == 'redirect' ? 'str' : type,
        frame = frames[frameType].work[frameUrl],
        res = frame.targetId2Res[targetId],
        target = res._target;
    if (res) {
        delete frame.targetId2Res[targetId];
        if (!Object.keys(frame.targetId2Res).length)
            delete frame.targetId2Res;

        // maybe after this fetch, the frame is idle and idle frames are needed.
        cleanFrameQueue(frameType, frameUrl);
        tryCreateFrame(frameType);
        if (type == 'redirect') {
            target.targetId = targetId;
            redirectFetch(res, targetUrl, result);
        } else {
            var data = {url: targetUrl, result: result};
            if (target.oldUrl) {
                // if it's a redirect fetching result, set url as the old Url
                result.$rediectUrl = targetUrl;
                data.url = target.oldUrl;
            }
            res(data);
        }

        // maybe after this fetch, a new fetch with different origin is exist;
        if (type != 'img') {
            concurrence--;
            doFetch();
            timer.push(setTimeout(function() {
                // After the time of MIN_INTERVAL_PER_ORIGIN has elapsed, the origin is idle
                delete busyOrigin[getOrigin(frameUrl)];
                doFetch()
            }, MIN_INTERVAL_PER_ORIGIN))
        }
    }
}

/**
 * handle the redirect fetching
 * @param res
 * @param oldUrl
 * @param newUrl
 */
function redirectFetch(res, oldUrl, newUrl) {
    var target = res._target,
        origin;

    if (target.oldUrl) {
        // do not redirect more than once
        res(target.oldUrl, {
            $error: 'redirect more than once',
            $redirects: [
                target.oldUrl,
                oldUrl,
                newUrl
            ]
        });
        return;
    }

    target.url = newUrl;
    target.oldUrl = oldUrl;
    origin = getOrigin(newUrl);

    getWindow(origin, 'str').then(function(win) {
        var _work = frames['str'].work[origin];
        if (!_work.targetId2Res)
            _work.targetId2Res = {};
        _work.targetId2Res[target.targetId] = res;
        tryFetch(win[0], 'str', target.url, target.pattern, target.targetId)
    })
}

(function listenPostMessage() {
    win.addEventListener('message', function(event) {
        /**
         * event has data property, it's structure like this:
         *   {
         *     type: "dataUrl" | "result" | "ready",
         *     result: string if type is dataUrl, undefined if ready, {img:img,link:link,page:page,..} if result,
         *     eventId: the eventId of target send to the iframe,
         *     url: the url of the target,
         *     [auth: some token for authentication.(Do Not receive any data)]
         *     TODO: should encode the data send to the iframe? js of origin page in iframe can receive the data
         *   }
         */
        var eventName = event.data.type,
            data = event.data,
            args;
        if (!eventName || !checkAuth(data.auth)) {return}
        switch (eventName) {
            case 'frame':
                args = [data.fetchType, data.url, event.source]; break;
            case 'str':
            case 'dom':
            case 'redirect':
                args = [data.targetId, data.url, data.result]; break;
            case 'img':
                args = [data.url, data.result]; break;
            default :
                throw Error('throw me one day')
        }
        args.unshift(eventName);
        eventEmitter.emit.apply(eventEmitter, args)
    })
}())

function checkAuth(auth) {
    //TODO: let it be true for now
    return true;
}

function getUid() {
    return uid++;
}

/**
 * get the url‘s origin
 * @param url
 * @returns {*}
 */
function getOrigin(url) {
    if (ORIGIN_RE.test(String(url))) {
        return RegExp['$&']
    }
    throw Error('url: "' + url + '" has no origin')
}

/**
 * 清除已经没有获取目标的frame，之所以要频繁调用这个的原因是因为不想让闲置的frame占用资源（也许不靠谱）
 * @param [type] - 'dom', 'str', 'img'
 * @param [origin] - 若指定了一个origin，对指定origin尝试清除，否则对type所指定类型的所有frame进行清除
 */
function cleanFrameQueue(type, origin) {
    var checkTypes = type ? [type] : fetchTypes;
    checkTypes.forEach(function(type) {
        var work = frames[type].work;
        if (origin) {
            if (work[origin])
                tryRemoveFrame(origin);
        } else
            for (origin in work)
                tryRemoveFrame(origin);
        function tryRemoveFrame(origin) {
            // when the targetId2Res is empty object {}, it might not be right to
            // consider the frame is idle. Because the promise is async, a just created
            // frame with an empty targetId2Res would be used by the resolve callback
            // after the running code is over.
            if (!work[origin].targetId2Res) {
                // if there is no request waiting, remove later(the iframe may be reused)
                if (frames[type].maxLength - Object.keys(work).length) {
                    timer.push(setTimeout(function() {
                        try {
                            // may be remove by others, it's not something big, so try catch silently
                            if (!work[origin].targetId2Res) {
                                container.removeChild(work[origin].iframe);
                                delete  work[origin];
                            }
                        } catch (e) {
                            console.log(e)
                        }
                    }, 3000));
                } else { // if there is a request waiting for a new iframe, remove now
                    container.removeChild(work[origin].iframe);
                    delete  work[origin];
                }
            }
        }
    })
}

/**
 * Try to create iframes according to the _type. If no _type specified, try to create iframes all types.
 * Whether an iframe could be create or not depend on the idle status of the the wanted type's queue of
 * iframes and the pending queue's length. getWindow always return a window if the wanted iframe is working,
 * so if put an new iframe request into queue, there must be no wanted iframe in work.
 * @param _type - 'dom', 'str', 'img'
 */
function tryCreateFrame(_type) {
    // TODO: should add the action into some global setTimeout for preventing ex frequently.(MAYBE NOT, the below FOR prevent it)
    var types = _type ? [_type] : fetchTypes;
    types.forEach(function(type) {
        var _frames = frames[type],
            pending = _frames.pending,
            remain = _frames.maxLength - Object.keys(_frames.work).length,
            iframe, request;
        while (remain-- && pending.length) {
            iframe = document.createElement('iframe');
            iframe.sandbox = 'allow-same-origin allow-scripts';
            request = pending.shift();
            // src may be auto added a '/' after origin by browsers
            iframe.src = request.origin;
            /**
             * TODO: using name is not best choice, for name can be changed by the fetched page's js.
             * Using name is to distinguish the origin-like url from the real origin url of a str frame
             * Delay to create a str frame having the same src as the creating frame with the origin-like url
             * may resolve it in some degree. But URL redirect may be the really big problem. But even if redirect
             * happened, name would not be changed almost(except js), and it can be used to detect redirect,
             * and URL redirect is more frequently happened than changing name.
             */
            iframe.name = type;
            _frames.work[request.origin] = {
                iframe: iframe,
                loading: true,
                targetId2Res: {}
            };
            container.appendChild(iframe);
            _frames.creating[request.origin] = [request.res];
        }
    })
}

/**
 * 根据标准化的target目标，基于iframe来获取资源
 * @param {object} target - the target to be fetched. It's structure:
 *  {
 *    pattern: [[regexp, {key1: index1, key2: index2}] | function-style-string,..],
 *    url: url,
 *    setting: {
 *      type: 'str' | 'dom' | 'img'
 *    }
 *  }
 */
function fetch(target) {
    return new Promise(function(res) {
        var type = target.setting.type || 'str',
            url, targetId;
        if (!fetchTypes.some(function(_type) {return _type == type}))
            throw Error('no such type:' + type);
        targetId = getUid();
        url = type != 'str' ? target.url : getOrigin(target.url);
        getWindow(url, type).then(function(win) {
            var _work = frames[type].work[url];
            if (!_work.targetId2Res)
                _work.targetId2Res = {};
            _work.targetId2Res[targetId] = res;
            //if redirect happens, target is needed
            res._target = target;
            tryFetch(win[0], type, target.url, target.pattern, targetId)
        })
    })
}

/**
 * get window through an iframe
 * @param origin - origin if setting.type is 'str', otherwise a normal url
 * @param type - 'dom', 'img', or 'str'
 * @returns {Promise} - would be resolved with a [window]; The reason for wrapping window into array is that,
 * resolving a window with different origin would come to an error
 */
function getWindow(origin, type) {
    return new Promise(function(res) {
        var _frames = frames[type],
            frame = _frames.work[origin];

        if (!frame) {
            _frames.pending.push({
                origin: origin,
                res: res
            });
            cleanFrameQueue(type, origin);
            tryCreateFrame(type);
        } else if (frame.loading) {
            // frame is already exist, but is loading.
            _frames.creating[origin].push(res);
        } else {
            // frame is ready, just resolve
            res([frame.iframe.contentWindow])
        }
    })
}

/**
 *
 * @param win
 * @param type - "img" | "str" | "dom"
 * @param url
 * @param pattern
 * @param targetId
 */
function tryFetch(win, type, url, pattern, targetId) {
    //TODO: message may be need to encode before send
    var msg = {
            type: type,
            pattern: pattern,
            targetId: targetId
        };
    if (type == 'str')
        msg.url = url;
    for (var key in msg) {
        if (!key)
            delete msg[key];
    }
    // skip control if type is img. If there is a window, just fetch the image
    if (type == 'img') {
        win.postMessage(msg, '*');
        return;
    }
    fetchPending.push({win: win, msg: msg, origin: getOrigin(url)});
    doFetch();
}

/**
 * Do fetch resources in the conditions of max concurrence and origin's busy status
 * The closer the task in fetchPending near to 0, the higher precedence it gets.
 * Those tasks getting windows earlier, are closer to 0. But even if a task get the
 * chance to run, it still may be blocked when it's origin is busy(a task with this origin
 * is running), and then the one after it get the chance to run. If all is not satisfied
 * to run, do nothing, waiting for next time which may be occurred when a task is finished
 * or a new task get a window.
 */
function doFetch() {
    var item, origin;
    for (var i = 0; i < fetchPending.length && MAX_CONCURRENCE - concurrence; i++) {
        item = fetchPending[i];
        origin = item.origin;
        if (!busyOrigin[origin]) {
            busyOrigin[origin] = true;
            item.win.postMessage(item.msg, '*');
            concurrence++;
            fetchPending.splice(i, 1);
            i--
        }
    }
}

exports = module.exports = {
    fetch: fetch,
    reset: reset
}

exports.getPrivate = function(name) {return eval(name)}

}); // module: iframeFetcher.js

require.register("parser.js", function(exports, require, module){

/**
 *
 * @param tag
 * @param attr
 */
var tagPropRE = (function() {
    //TODO:也许可以只用key作为属性名来捕捉字符串(但也只有属性名可以这么做)
    var answer = {};
    return function(tag, attr, name) {
        if (!tag) {
            return
        }
        var key = Array.prototype.join.call(arguments);
        if (answer[key]) {
            return answer[key]
        }
        var pair = {};
        pair[name || tag] = 2;
        return answer[key] = [
            //new RegExp('<' + tag + (!attr ? '' : '\\b[^>]*?\\s' + attr + '\\s*=\\s*(["\'])([\\S\\s]*?)\\1') + '[^>]*/?>', 'ig'),
            new RegExp('<' + tag + (!attr ? '' : '\\b[^>]*?\\s' + attr + '\\s*=\\s*("|\')([\\S\\s]*?)\\1') + '[^>]*\\/?>', 'ig'),
            pair
        ];
    }
})();

/**
 * 批量生成需要的pattern
 * @param tagProps
 * @returns {Object|*}
 */
var tagPropREs = function(tagProps) {
    if (!(tagProps instanceof Array))
        throw TypeError('tagProps should be an Array');
    return tagProps.reduce(function(ret, pair) {
        ret.push(tagPropRE.apply(null, pair));
        return ret;
    }, [])
};

exports.tagPropRE = tagPropRE;
exports.tagPropREs = tagPropREs;

exports.getPrivate = function(name) {return eval(name)}

}); // module: parser.js

require.register("utils.js", function(exports, require, module){

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
exports.getPrivate = function(name) {return eval(name)}

}); // module: utils.js
