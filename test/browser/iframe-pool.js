describe("iframePool", function() {
  var pool = require('iframe-pool')
  var util = require('util')

  var testUrl = 'http://localhost:9999/fetch-test.html'

  describe(".init", function() {
    it("should throw error if init more than once", function() {
      pool.init(5, 2000);
      (function() {
        pool.init(5, 2000)
      }).should.throw('iframe pool already init')
    })
  })

  describe(".getWindow", function() {
    it("should return a window", function() {
      return pool.getWindow(testUrl).then(function(win) {
        util.isWindow(win.win).should.be.true
        pool.free(win.win)
      })
    })
  })
})