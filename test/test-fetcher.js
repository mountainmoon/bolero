describe("test fetcher", function() {
    var fetcher = require('fetcher'),
        getPrivate = fetcher.getPrivate,
        iframeFetcher = require('iframeFetcher');

    before(function() {
        iframeFetcher.reset();
    });

    after(function() {
        iframeFetcher.reset();
    })

    describe("[handlePattern]", function() {
        var handlePattern = getPrivate('handlePattern'),
            parser = require('parser');
        it("should receive an array argument containing regexp, [], or function, and " +
            "return a regularized array", function() {
            var patterns = parser.tagPropREs([
                ['a', 'href'],
                ['img', 'src', 'imgSrc']
            ]);
            patterns.push(/hehe/, function(){});

            handlePattern(patterns).should.eql([
                [
                    /<a\b[^>]*?\shref\s*=\s*("|')([\S\s]*?)\1[^>]*\/?>/gi,
                    {a: 2}
                ],
                [
                    /<img\b[^>]*?\ssrc\s*=\s*("|')([\S\s]*?)\1[^>]*\/?>/gi,
                    {imgSrc: 2}
                ],
                [
                    /hehe/,
                    {_result2: 0}
                ],
                "function (){}"
            ])
        })
    });

    describe("[extend]", function() {
        var extend = getPrivate('extend');
        it("should extend the target object with the source object", function() {
            extend({}, {a:1, b:2}).should.eql({a:1, b:2})
        });

        it("should not overwrite the target's property with the same name property in the source in default mode", function() {
            extend({a:'hehe', c:3}, {a:1, b:2}).should.eql({a:'hehe', b:2, c:3})
        });

        it("should overwrite the target's property with the same name property in the source when 3rd arg is set true", function() {
            extend({a:'hehe', c:3}, {a:1, b:2}, true).should.eql({a:1, b:2, c:3})
        });

        it("should return the dst whatever happend", function() {
            var dst = {};
            extend(dst, {a:1}).should.equal(dst);
        });
    });

    describe("[regularizeUrl]", function() {
        var regularizeUrl = getPrivate('regularizeUrl');
        it("should add http prefix to those has not started with 'http' urls", function() {
            regularizeUrl('goo.gl').should.equal('http://goo.gl')
        });

        it("should do nothing when a url is started with http or https", function() {
            regularizeUrl('http://goo.gl').should.equal('http://goo.gl')
        })
    });

    describe("[makeTarget]", function() {
        var makeTarget = getPrivate('makeTarget');
        it("should merge the common pattern and setting to an object which containing a url", function() {
            makeTarget('goo.gl', [
                [/hehe/, {key: 0}]
            ], {type: 'str'}).should.eql([
                {
                    url: 'http://goo.gl',
                    pattern: [[/hehe/, {key: 0}]],
                    setting: {type: 'str'}
                }
            ])
        });

        it("should be ok with a 'Object' url containing pattern and setting", function() {
            makeTarget({
                url: 'goo.gl',
                pattern: [[/hehe/, {key: 0}]]
            }, null, {type: 'str'}).should.eql([
                    {
                        url: 'http://goo.gl',
                        pattern: [
                            [/hehe/, {key: 0}]
                        ],
                        setting: {type: 'str'}
                    }
                ])
        });

        it("should conform that properties in url argument take precedence over other arguments", function() {
            makeTarget({
                url: 'goo.gl',
                pattern: [[/hehe/, {key: 0}]],
                setting: {type: 'img'}
            }, null, {type: 'str'}).should.eql([
                    {
                        url: 'http://goo.gl',
                        pattern: [
                            [/hehe/, {key: 0}]
                        ],
                        setting: {type: 'img'}
                    }
                ])
        });

        it("should be ok with an array of url which either be a 'string' or an 'Object'", function() {
            makeTarget([
                'goo.gl',
                {
                    url: 't.cn',
                    setting: {type: 'dom'}
                }
            ], [[/hehe/, {key: 0}]]).should.eql(
                [
                    {
                        url: 'http://goo.gl',
                        pattern: [
                            [/hehe/, {key: 0}]
                        ],
                        setting: {type: 'str'}
                    },
                    {
                        url: 'http://t.cn',
                        setting: {type: 'dom'},
                        pattern: [
                            [/hehe/, {key: 0}]
                        ]
                    }
                ]
            )
        })

    });

    describe("#fetch", function() {
        var url1 = 'http://127.0.0.1:63342/bolero/test/beFetchedPage.html',
            url2 = 'http://localhost:63342/bolero/test/beFetchedPage.html';
        this.timeout(4000);
        it("should take the arguments and return a promise with the results", function() {
            return fetcher.fetch([url1, url2],
                [
                    [
                        /<img\b[^>]*?\ssrc\s*=\s*("|')([\S\s]*?)\1[^>]*\/?>/gi,
                        {img: 2}
                    ],
                    [
                        /<a\b[^>]*?\shref\s*=\s*("|')([\S\s]*?)\1[^>]*\/?>/gi,
                        {a: 2}
                    ]
                ],
                {type: 'str' , fixKeys: ['a', 'img']}
            ).then(function(results) {
                    var eqlObj = {};
                    eqlObj[url1] = {a: [
                        'http://127.0.0.1:63342/bolero/test/hehe.html',
                        'http://127.0.0.1:63342/bolero/test/invalid.html'
                    ], img: ['http://127.0.0.1:63342/bolero/test/invalid.jpg']};
                    eqlObj[url2] = {a: [
                        'http://localhost:63342/bolero/test/hehe.html',
                        'http://localhost:63342/bolero/test/invalid.html'
                    ], img: ['http://localhost:63342/bolero/test/invalid.jpg']};
                    results.should.eql(eqlObj);
                })
        })
    });
    
    describe("#onProgress", function() {
        var url1 = 'http://127.0.0.1:63342/bolero/test/beFetchedPage.html',
            url2 = 'http://localhost:63342/bolero/test/beFetchedPage.html';

        it("should receive results progressively if fetch multiple resources", function(done) {
            var results = {};
            fetcher.onProgress(function(result, _results) {
                results[result.url] = result.result;
                if (Object.keys(results).length == 2) {
                    results.should.eql(_results);
                    done();
                }
            });

            //MIN_INTERVAL_PER_ORIGIN = 2500 : iframeFetcher.js
            //it is abnormal if finishes in less than 2500ms,
            this.timeout(3000);
            return fetcher.fetch([url1, url2],
                [
                    [
                        /<a\b[^>]*?\shref\s*=\s*("|')([\S\s]*?)\1[^>]*\/?>/gi,
                        {a: 2}
                    ]
                ],
                {type: 'str'}
            )
        });
    });
})