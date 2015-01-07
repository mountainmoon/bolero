// for browser test
if (typeof require == 'undefined')
  require = window.bolero.require

describe("extractor", function() {
  var extractorId = 'extractor'
    , prefix = '../lib/'

  if (!(typeof window != 'undefined' && window.window === window)) {
    extractorId = prefix + extractorId
  }

  var extractor = require(extractorId),
    aHtml = '<a href="whatever.html">'

  describe("attrExtractor", function() {
    var attrExt = extractor.attrExtractor

    it("should extract the value of the attribute from the html string as an Object", function() {
      attrExt('a', 'href')(aHtml).should.eql({href: ['whatever.html']})
    })

    it("should treat the 3rd argument as an alias in the extracted Object", function() {
      attrExt('a', 'href', 'link')(aHtml).should.eql({link: ['whatever.html']})
    })
  })
})