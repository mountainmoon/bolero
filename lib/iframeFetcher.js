//test在某种程度上，可以阻止clawer脚本正常工作的方法是，让页面工作在top中，如不是top就用top.location.href="location.href"来改变，并且套上try catch，如有异常则不初始化页面，

var frames = {},
    win = window,
    eventEmitter = new (require('event').EventEmitter),
    uid = 1,
    container = document.createElement('div'),
    fetchTypes = ['img', 'dom', 'str'],
    MSG_TYPES = fetchTypes.concat('frame'),
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
        if (!~MSG_TYPES.indexOf(eventName))
            throw Error('no such msg type: ' + eventName);
        args = eventName == 'frame' ?
            [eventName, data.fetchType, data.url, event.source] :
            [eventName, data.targetId, data.url, data.result];
        eventEmitter.emit.apply(eventEmitter, args)
    })
}());

/**
 * reset the iframe Fetcher
 */
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
        if (!msg[key] && msg[key] !== 0)
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
