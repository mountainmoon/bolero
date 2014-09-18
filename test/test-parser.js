describe('test parser', function() {
    var parser = require('parser');
    describe("tagPropRE", function() {
        it("should receive a tag and an attribute, and return a correspond array.", function() {
            parser.tagPropRE('a', 'href').should.eql([
                /<a\b[^>]*?\shref\s*=\s*("|')([\S\s]*?)\1[^>]*\/?>/gi,
                {a: 2}
            ]);
            parser.tagPropRE('img', 'src', 'imgSrc').should.eql([
                /<img\b[^>]*?\ssrc\s*=\s*("|')([\S\s]*?)\1[^>]*\/?>/gi,
                {imgSrc: 2}
            ])
        });
    });

    describe("tagPropsRE", function() {
        it("should function closely to tagPropRE, and just take mutiple arguments and make mutiple results", function() {
            parser.tagPropREs([['a', 'href'], ['img', 'src']]).should.eql([
                [
                    /<a\b[^>]*?\shref\s*=\s*("|')([\S\s]*?)\1[^>]*\/?>/gi,
                    {a: 2}
                ],
                [
                    /<img\b[^>]*?\ssrc\s*=\s*("|')([\S\s]*?)\1[^>]*\/?>/gi,
                    {img: 2}
                ]
            ])
        });
    })
})