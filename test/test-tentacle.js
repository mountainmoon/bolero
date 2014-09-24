describe("test tentacle", function() {
    var doc, frame;
    var testUrl = 'beFetchedPage.html';
    var pattern = [
        [/<a\b[^>]*?\shref\s*=\s*("|')([\S\s]*?)\1[^>]*\/?>/gi, {a: 2}],
        [/<img\b[^>]*?\ssrc\s*=\s*("|')([\S\s]*?)\1[^>]*\/?>/gi, {img: 2}]
    ];

    describe("privateTest", function() {
        describe("merge", function() {
            it("should merge results in array into a single object", function() {
                console.info('the first test')
                var results = [
                    {
                        img: ['img1', 'img3']
                    },
                    {
                        img: ['img2', 'img1'],
                        link: ['link1', 'link2']
                    },
                    {
                        text: 'hehe',
                        link: 'link3'
                    }
                ];
                merge(results).should.eql({
                    img: ['img1', 'img2', 'img3'],
                    link: ['link1', 'link2', 'link3'],
                    text: ['hehe']
                })
            })

            it("should merge nothing to an empty Object", function() {
                merge().should.be.empty;
            })
        });

        describe("getPage", function() {
            it("should get a page returned as a promise resolved with string", function() {
                var url = testUrl;
                return getPage(url).then(function(doc) {
                    doc.should.be.String;
                })
            })
        });

        before(function() {
            return getPage(testUrl).then(function(_doc) {
                doc = _doc;
            })
        })

        describe("parseDoc", function() {
            it("should take arguments like this: ([[regexp,{key:index}],..], docString), and return an Array", function() {
                return parseDoc(pattern, doc).then(function(results) {
                    log(results);
                    results.should.be.Array.and.matchEach(function(it) {
                        return it.img && it.img.should.be.String
                            || it.a && it.a.should.be.String;
                    })
                })
            });

            it("should return empty Object when pattern matches nothing", function() {
                return parseDoc([[/fuckhehe/]], doc).then(function(results) {
                    results.should.be.Object.and.be.empty;
                })
            })
        })

        describe("handlePage", function() {
            it("should take the url and pattern arguments, and return an object containing the results ", function() {
                var url = 'beFetchedPage.html';
                return handlePage(url, pattern).then(function(results) {
                    results.should.be.Object.and.ownProperty('a').
                        which.be.an.Array.matchEach(function(it) {return it.should.be.String});
                    results.should.hasOwnProperty('img').which.be.an.Array;
                })
            });
        })
    });

    describe("listenTest", function() {
        //listen test
        describe("listen tentacle's first message", function() {
            before(function() {
                // should enable tentacle's userscript
                frame = document.createElement('iframe');
                frame.src = 'tentacleHost.html?foo=foo';
                frame.name = 'pi';
                document.body.appendChild(frame);
            });
            it("should receive a message from the created frame", function() {
                return new Promise(function(res) {
                    window.addEventListener('message', function(event) {
                        var data = event.data;
                        if (data.type == 'frame') {
                            data.fetchType.should.equal('pi');
                            data.url.should.containEql('tentacleHost.html?foo=foo');
                            res('ok');
                        }
                    })
                })
            });
        });

        describe("send a frame with a link fetched message and verify the feedback", function() {
            it("should receive the message contained the fetched result corresponding to the postMessage above", function() {
                frame.contentWindow.postMessage({
                    url: testUrl,
                    type: 'str',
                    targetId: 1,
                    pattern: [[
                        /<a\b[^>]*?\shref\s*=\s*("|')([\S\s]*?)\1[^>]*\/?>/gi,
                        {a: 2}
                    ]]
                }, '*');
                return new Promise(function(res) {
                    window.addEventListener('message', function(event) {
                        var data = event.data;
                        if (data.targetId) {
                            data.should.eql({
                                url: testUrl,
                                result: {a: ['invalid.html']},
                                type: 'str',
                                targetId: 1
                            });
                            res();
                        }
                    })
                })
            });
        });

        describe("TODO: test dom-fetched style iframe in future", function() {
            it("should to be completed");
        });
    });
})