describe("utils", function() {
    var utils = require('utils');

    describe("#type", function() {
        it("should return lowercase name of the target type", function() {
            var type = utils.type;
            [
                [1, 'number'],
                ['hehe', 'string'],
                [new Date, 'date'],
                [true, 'boolean'],
                [/hehe/, 'regexp'],
                [[], 'array'],
                [{}, 'object'],
                [undefined, 'undefined'],
                [null, 'null'],
                [function(){}, 'function'],
                [Error('hehe'), 'error']
            ].forEach(function(e) {
                    type(e[0]).should.equal(e[1]);
                })
        })
    });

    describe("#merge", function() {
        it("should merge src object into dst object", function() {
            utils.merge({hehe: [1]}, {hehe: [2, 3], hoho: "hoho"}).
                should.be.eql({
                    hehe: [1, 2, 3],
                    hoho: "hoho"
                })
        });

        it("should merge src array into dst array", function() {
            utils.merge([1, 2], [3, 4]).should.be.eql([1, 2, 3, 4]);
        });

        it("should unique the dst array if specified unique", function(){
            utils.merge([1, 2], [2, 3], true).should.be.eql([1, 2, 3]);
        });
    });

    describe("#unique", function(){
        it("should make the array containing the repeat element array unique", function(){
            utils.unique([1, 2, 2, 3]).should.be.eql([1, 2, 3]);
        });
    });
    
    describe("#fixUrl", function() {
        it("should complete whatever urls according to the passed url", function() {
            utils.fixUrl('http://examp.le:5222', 'hehe').should.eql(['http://examp.le:5222/hehe']);
            utils.fixUrl('http://examp.le:5222/', 'hehe').should.eql(['http://examp.le:5222/hehe']);

            utils.fixUrl('http://examp.le', [
                'http://foo.com',
                'hehe',
                './hehe',
                './hehe/hoho',
                '/hehe'
            ]).should.eql([
                    'http://foo.com',
                    'http://examp.le/hehe',
                    'http://examp.le/hehe',
                    'http://examp.le/hehe/hoho',
                    'http://examp.le/hehe'
                ]);

            utils.fixUrl('http://foo.com/hehe/hoho', [
                'haha',
                './haha',
                '../haha/hihi',
                '/'
            ]).should.eql([
                    'http://foo.com/hehe/haha',
                    'http://foo.com/hehe/haha',
                    'http://foo.com/haha/hihi',
                    'http://foo.com/'
                ])
        });
    });
});