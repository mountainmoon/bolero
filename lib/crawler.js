
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
