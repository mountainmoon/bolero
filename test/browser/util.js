// for browser test
if (typeof require == 'undefined')
  require = window.bolero.require

describe("util", function() {
  var util = require('util')
  describe(".getOrigin", function() {
    it("should return the origin of an given url", function() {
      util.getOrigin('http://foo.com').should.eql('http://foo.com')
      util.getOrigin('https://foo.com:1234/foo').should.eql('https://foo.com:1234')
    })  
  })

  if (typeof window != 'undefined' && window.window == window) { // maybe need not
    describe(".saveResRej", function() {
      it("should return an function which could be passed to the Promise constructor to retrieve resolve and reject", function() {
        var obj = {}
        var pr =new Promise(util.saveResRej(obj)).then(function(r) {
          r.should.eql(1)
        })
        obj.resRej.resolve(1)
        return pr
      })
    })

    describe(".isPromise", function() {
      it("should return true if arugment is a promise", function() {
        util.isPromise(new Promise(function() {})).should.be.true
        util.isPromise({then: function(){}}).should.be.true
        util.isPromise(1).should.be.false
      })
    })


    describe(".isWindow", function() {
      it("should return true if argument is window", function() {
        util.isWindow(window).should.be.true
        util.isWindow(1).should.be.false
      })
    })
  }

  describe(".urlEqual", function() {
    it("should be equal if two urls are different with trailing slashes", function() {
      util.urlEqual('http://a.b//', 'http://a.b').should.be.true
      util.urlEqual('http://a.b/c/', 'http://a.b/c').should.be.true
      util.urlEqual('http://a.b/c', 'http://a.b').should.be.false
    })
  })
})