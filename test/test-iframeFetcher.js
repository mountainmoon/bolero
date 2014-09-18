describe("test iframeFetcher", function() {
    var iframeFetcher = require('iframeFetcher');
    var getPrivate = iframeFetcher.getPrivate;

    before(function() {
        iframeFetcher.reset();
    });

    after(function() {
        iframeFetcher.reset();
    })

    describe("[getOrigin]", function() {
        var getOrigin = getPrivate('getOrigin');
        
        it("should get the origin of the passed url", function() {
            var target = 'http://www.foo.com';
            getOrigin('http://www.foo.com').should.equal(target);
            getOrigin('https://foo.cn/').should.equal('https://foo.cn');
            getOrigin('http://www.foo.com:2100/noop').should.equal(target + ':2100')
        });

        it("should throw an error if the passed url can't be extracted an origin", function() {
            (function() {
                getOrigin('hehe.com')
            }).should.throw(/has no origin/);
        })
    });

    describe("[getWindow]", function() {
        var getWindow = getPrivate('getWindow');

        it("should return a promise which would be resolved with a window if arguments is valid", function() {
            return getWindow('http://127.0.0.1:63342', 'str').then(function(win) {
                //the other window's prototype didn't influenced by should.js, so can't use win.should
                Should(typeof win[0].postMessage == 'function').be.ok;
            })
        });

        after(function() {
            iframeFetcher.reset();
        })
    });

    describe("[cleanFrameQueue]", function() {
        var cleanFrameQueue = getPrivate('cleanFrameQueue'),
            getWindow = getPrivate('getWindow'),
            frames  = getPrivate('frames'),
            container = getPrivate('container'),
            origin = 'http://127.0.0.1:63342';

        this.timeout(1000);

        afterEach(function() {
            iframeFetcher.reset();
            container.childElementCount.should.equal(0);
        })

        it("should be ok if call this function in the initial state", function() {
            (function() {
                cleanFrameQueue();
                cleanFrameQueue('str');
                cleanFrameQueue('img', 'fakeOrigin');
            }).should.not.throw();
        });

        it("should clean the frame queue if call it with no argument after getWindow", function() {
            return getWindow(origin, 'str').then(function() {
                delete frames.str.work[origin].targetId2Res;
                cleanFrameQueue();
                // it would remove later, not at once
                (frames.str.work[origin] === undefined).should.not.be.ok;
                container.childElementCount.should.not.equal(0);
            })
        });

        it("should clean the frame queue if call it with 1 argument  after getWindow ", function(done) {
            getWindow(origin, 'str').then(function() {
                delete frames.str.work[origin].targetId2Res;
                cleanFrameQueue('str');
                setTimeout(function() {
                    (frames.str.work[origin] === undefined).should.be.ok;
                    container.childElementCount.should.equal(0);
                    done()
                },600)
            })
        })

        it("should clean the frame queue if call it with 2 argument  after getWindow ", function(done) {
            getWindow(origin, 'str').then(function() {
                delete frames.str.work[origin].targetId2Res;
                cleanFrameQueue('str', origin);
                setTimeout(function() {
                    (frames.str.work[origin] === undefined).should.be.ok;
                    container.childElementCount.should.equal(0);
                    done();
                },600)
            })
        })
    })

    describe("[tryCreateFrame]", function() {
        var tryCreateFrame = getPrivate('tryCreateFrame'),
            frames  = getPrivate('frames'),
            container = getPrivate('container'),
            origin1 = 'http://127.0.0.1:63342',
            origin2 = 'http://localhost:63342';
        before(function() {
            iframeFetcher.reset();
        })
        it("should create an ifame when the condition is ok", function() {
            var resolve1, resolve2;
            var p1 = (new Promise(function(res) {
                resolve1 = res;
            })).then(function(win) {
                    Should(typeof win[0].postMessage == 'function').be.ok;
                    container.childElementCount.should.be.ok;
                });
            var p2 = (new Promise(function(res) {
                resolve2 = res;
            })).then(function(win) {
                    Should(typeof win[0].postMessage == 'function').be.ok;
                    container.childElementCount.should.be.ok;
                });

            frames.str.pending.push({
                origin: origin1,
                res: resolve1
            }, {
                origin: origin2,
                res: resolve2
            })
            tryCreateFrame('str');
            return Promise.all([p1, p2]).then(function() {
                container.childElementCount.should.equal(2)
            });
        })
        after(function() {
            iframeFetcher.reset();
        })
    })

    describe("#fetch", function() {
        var url = 'http://localhost:63342/bolero/test/beFetchedPage.html',
            elapse;

        it("should take a target argument and return a promise which would be resolved with the fetched result", function() {
            var frames = getPrivate('frames'),
                busyOrigin = getPrivate('busyOrigin');
            return iframeFetcher.fetch({
                url: url,
                pattern: [
                    [
                        /<a\b[^>]*?\shref\s*=\s*("|')([\S\s]*?)\1[^>]*\/?>/gi,
                        {a: 2}
                    ],
                    [
                        /<img\b[^>]*?\ssrc\s*=\s*("|')([\S\s]*?)\1[^>]*\/?>/gi,
                        {img: 2}
                    ],
                    //match nothing
                    [
                        /fooooo/,
                        {result: 0}
                    ]
                ],
                setting: {type: 'str'}
            }).then(function(data) {
                data.should.eql({
                    url: url,
                    result: {a: ['hehe.html', 'invalid.html'], img: ['invalid.jpg']}
                });
                elapse = Date.now();
            })
        })

        it("should return the result like fetch a new resource if fetch the same resource again", function() {
            var frames = getPrivate('frames'),
                busyOrigin = getPrivate('busyOrigin'),
                MIN_INTERVAL_PER_ORIGIN = getPrivate('MIN_INTERVAL_PER_ORIGIN'),
                now = Date.now();
            // same origin requests would be constrained to ex. in 2.5s per request.
            this.timeout(3000);
            return iframeFetcher.fetch({
                url: url,
                pattern: [
                    [
                        /<a\b[^>]*?\shref\s*=\s*("|')([\S\s]*?)\1[^>]*\/?>/gi,
                        {a: 2}
                    ]
                ],
                setting: {type: 'str'}
            }).then(function(data) {
                data.should.eql({
                    url: url,
                    result: {a: ['hehe.html', 'invalid.html']}
                });
                (Date.now() - now).should.be.greaterThan(MIN_INTERVAL_PER_ORIGIN);
            })
        });

        it("should test max concurrence");
    })
});