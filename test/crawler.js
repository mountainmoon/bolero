var isBrowser = typeof window != 'undefined' && window.window === window
if (!isBrowser) {
  // serve test html files
  require('../support/static-server').run()
}

['node-adapter', 'browser-adapter', 'node2browser-adapter'].forEach(
  function(name) {
    if (isBrowser && name == 'browser-adapter')
      test(name)
    else if (!isBrowser)
      test(name)
  })

function test(name){
  describe('crawler with ' + name, function(){
    var crawlerId = 'crawler'
      , extractorId = 'extractor'
      , prefix = '../lib/'

    if (!isBrowser) {
      crawlerId = prefix + crawlerId
      extractorId = prefix + extractorId
    }

    // for browser test
    if (typeof require == 'undefined')
      require = window.bolero.require

    var Crawler = require(crawlerId)
      , linkExt = require(extractorId).linkExtractor
      , testUrl = 'http://localhost:9999/fetch-test.html'

    before(function() {
      Crawler.default({
        interval: 10,
        callback: linkExt,
        adapterName: name
      })
    })

    if (name == 'node2browser-adapter') this.timeout(3000)

    describe(".run()", function(){
      it("should start crawling and return the crawler it-self", function(done) {
        new Crawler({url: testUrl}).run().on('drain', function(results) {
          results[0].should.match({
            url: testUrl,
            timestamp: function(n) {return n.should.be.a.Number},
            data: function(it) {return it.should.have.property('href')}
          })
          done()
        })
      })
    })

    describe(".queue()", function() {
      it("should add a url which would be fetched later to the crawler", function(done) {
        var urls = [
          testUrl + '?foo=1',
          testUrl + '?foo=2',
          {
            url: testUrl + '?foo=3',
            callback: function(res) {return res}
          }
        ]
        new Crawler().queue(testUrl).queue(urls).run().on('drain', function(results) {
          results.length.should.equal(4)
          done()
        })
      })
    })

    describe(".pause()", function() {
      it("should stop the crawler, and resume it when .run is called", function(done) {
        this.timeout(2500);
        var crawler = new Crawler({
          url: testUrl + '?delay=1000'
        })
        setTimeout(function() {
          crawler.pause()
          setTimeout(function() {
            crawler.queue(testUrl + '?foo=5').run()
          }, 1000)
        }, 500)
        crawler.run().on('drain', function(r) {
          r.should.be.ok
          done()
        })
      })

      it("should stop the crawler at once if it is called after a just finished task", function(done) {
        var now, span = 1000
        var crawler = new Crawler({
          url: [testUrl + '?foo=4', testUrl + '?foo=5']
        })
        crawler.on('progress', function(result) {
          if (result.url == testUrl + '?foo=4') {
            setTimeout(function() {
              crawler.pause()
              now = Date.now()
              setTimeout(function() {
                crawler.run()
              }, span)
            }) // ex next tick
          }
          if (result.url == testUrl + '?foo=5') {
            (Date.now() - now > (span - 10)).should.be.true
            done()
          }
        }).run()
      })
    })

    describe(".length & .status", function() {
      it(".status should be 'pending' before run, be 'running' while running, be 'pausing' while pause, and be 'drain' after drain", function(done) {
        var crawler = new Crawler({url: testUrl + '?foo=6'})
        crawler.status.should.be.equal('pending')
        crawler.run().on('drain', function() {
          crawler.status.should.be.equal('drain')
          done()
        }).status.should.be.equal('running')
      })

      it(".length should reflect the size of the queue", function(done) {
        var crawler = new Crawler()
        crawler.length.should.be.equal(0)
        crawler.queue(testUrl + '?foo=7').length.should.be.equal(1)
        crawler.run().on('drain', function() {
          crawler.length.should.be.equal(0)
          done()
        })
      });
    })

    if (name == 'node-adapter') return
    describe("callback.domCallback", function() {
      it("should be passed to the fetching window, and handle the DOM to get a result which will be passed back", function(done) {
        var callback = function(html, response) {
          return response.domResult
        }
        callback.domCallback = function() {
          return {text: document.querySelector('#catch-me-if-you-can').innerHTML}
        }
        var crawler = new Crawler({url: {
          url: testUrl,
          callback: callback
        }}).run().on('drain', function(results) {
            results[0].data.text.should.eql("now you see me, now you don't")
            done()
          })
      })
    })
  })
}