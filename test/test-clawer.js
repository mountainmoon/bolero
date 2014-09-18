describe("test clawer", function() {
    var clawer = require('clawer'),
        parser = require('parser'),
        getPrivate = clawer.getPrivate,
        linkRE = [parser.tagPropRE('a', 'href')];

    describe("#getResource", function(){
        it("should throw an error if hasn't run crawler before", function(){
            (function() {
                clawer.getResource('a');
            }).should.throw();
        });
    });
    describe("#config", function(){
        it("should take a string url and other arguments, and return a promise with a combined target", function(){
            var url = 'http://examp.le';
            return clawer.config(url, [/aa/], {type: 'str'}).
                then(function(target) {
                    target.should.eql([url, [/aa/], {type: 'str'}])
                })
        });
        
        it("should using the last pattern and setting if call it without these", function() {
            var url = "http://examp.le";
            return clawer.config(url).then(function(target) {
                target.should.eql([url, [/aa/], {type: 'str'}])
            })
        });
    });

    describe("#run", function() {
        beforeEach(function() {
            clawer.reset();
            console.log('hehe')
        });
        this.timeout(12000);
        it("should fetch resources according to configs and return a promise with the result", function() {
            var url1 = 'http://127.0.0.1:63342/bolero/test/beFetchedPage.html';
            return clawer.config(url1, linkRE, {type: 'str', fixKeys: ['a', 'img']}).then(function() {
                return clawer.run()
            }).then(function(results) {
                var eqlObj = {};
                eqlObj[url1] = {a: [
                    'http://127.0.0.1:63342/bolero/test/hehe.html',
                    'http://127.0.0.1:63342/bolero/test/invalid.html'
                ]};
                results.should.eql(eqlObj);
                console.log('end')
            })
        });

        it("should fetch multiple urls if it take url arrays", function(){
            var url1 = 'http://127.0.0.1:63342/bolero/test/beFetchedPage.html',
                url2 = 'http://localhost:63342/bolero/test/beFetchedPage.html';
            return clawer.config([url1, url2], linkRE, {type: 'str', fixKeys: ['a', 'img']}).then(function() {
                return clawer.run()
            }).then(function(results) {
                var eqlObj = {};
                eqlObj[url1] = {a: [
                    'http://127.0.0.1:63342/bolero/test/hehe.html',
                    'http://127.0.0.1:63342/bolero/test/invalid.html'
                ]};
                eqlObj[url2] = {a: [
                    'http://localhost:63342/bolero/test/hehe.html',
                    'http://localhost:63342/bolero/test/invalid.html'
                ]};
                results.should.eql(eqlObj);
            })
        });
        
        it("should fetch the depth specified by run's argument", function() {
            var url = 'http://localhost:63342/bolero/test/outer.html';
            return clawer.config(url, linkRE, {type: 'str'}).then(function() {
                return clawer.run(2)
            }).then(function(results) {
                results.should.be.ok;
                console.log(results)
            })
        });

        it("should not loop fetching if there are url circles in fetching pages", function() {
            var url = 'http://localhost:63342/bolero/test/outer.html';
            return clawer.config(url, linkRE, {type: 'str'}).then(function() {
                return clawer.run(10)
            }).then(function(results) {
                results.should.be.ok;
                console.log(results)
            })
        });

        it("could filter the fetching urls, if provide filter function", function() {
            var url = 'http://localhost:63342/bolero/test/outer.html';
            return clawer.config(url, linkRE, {type: 'str'}, function(urls) {
                return urls.filter(function(url) {
                    return !~url.indexOf('inner')
                })
            }).then(function() {
                return clawer.run(2);
            }).then(function(results) {
                results.should.eql({
                    'http://localhost:63342/bolero/test/outer.html': {
                        a :[
                        'http://localhost:63342/bolero/test/inner.html',
                        'http://localhost:63342/bolero/test/tentacleHost.html'
                    ]},
                    'http://localhost:63342/bolero/test/tentacleHost.html': {}
                })
            })
        });

        it("could filter the fetching urls, if take filter argument in run function", function() {
            var url = 'http://localhost:63342/bolero/test/outer.html';
            return clawer.config(url, linkRE, {type: 'str'}).then(function() {
                return clawer.run(2, function(urls) {
                    return urls.filter(function(url) {
                        return !~url.indexOf('inner')
                    })
                });
            }).then(function(results) {
                results.should.eql({
                    'http://localhost:63342/bolero/test/outer.html': {
                        a :[
                            'http://localhost:63342/bolero/test/inner.html',
                            'http://localhost:63342/bolero/test/tentacleHost.html'
                        ]},
                    'http://localhost:63342/bolero/test/tentacleHost.html': {}
                })
            })
        });
        
        it("should trigger the turn event after a turn is finished", function() {
            var url = 'http://localhost:63342/bolero/test/outer.html';
            clawer.on('turn', function(results) {
                console.log('turn');
                console.log(results);
                results.should.be.ok;
                clawer.pause();
                setTimeout(function() {
                    clawer.moveon();
                },2000)
            });
            return clawer.config(url, linkRE, {type: 'str'}).then(function() {
                return clawer.run(2);
            });
        });

        it("should affected by the config, if it is paused after the turn and config is used", function() {
            var url = 'http://localhost:63342/bolero/test/outer.html';
            clawer.on('turn', function(results) {
                console.log('turn');
                console.log(results);
                results.should.be.ok;
                clawer.pause();
                setTimeout(function() {
                    clawer.config('http://127.0.0.1:63342/bolero/test/beFetchedPage.html').then(function() {
                        clawer.moveon();
                    })
                },1000)
            });
            return clawer.config(url, linkRE, {type: 'str'}).then(function() {
                return clawer.run(2);
            }).then(function(results) {
                console.log(results)
            });
        });
    });
});
