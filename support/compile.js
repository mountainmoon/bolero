//copied from mocha with some modifying 
/**
 * Module dependencies.
 */

var fs = require('fs');

/**
 * Arguments.
 */

var isTest = process.argv[2] == '-t'
    , args = process.argv.slice(isTest ? 3 : 2)
    , pending = args.length
    , files = {};

// parse arguments

args.forEach(function(file){
    fs.readFile(file, 'utf8', function(err, js){
        if (err) throw err;
        files[file] = js;
        --pending || compile();
    });
});

/**
 * Compile the files.
 */

function compile() {
    var buf = ''
        , test = isTest ? '\nexports.getPrivate = function(name) {return eval(name)}\n' : ''
        , outFile = (isTest ? '_' : '') + 'bolero.js';

    buf += '\n// CommonJS require()\n\n';
    buf += browser.require + '\n\n';
    buf += 'require.modules = {};\n\n';
    buf += 'require.resolve = ' + browser.resolve + ';\n\n';
    buf += 'require.register = ' + browser.register + ';\n\n';
    buf += 'require.relative = ' + browser.relative + ';\n\n';
    args.forEach(function(file){
        var js = files[file];
        file = file.replace('lib/', '');
        buf += '\nrequire.register("' + file + '", function(exports, require, module){\n';
        buf += js;
        buf += test; 
        buf += '\n}); // module: ' + file + '\n';
    });
    fs.writeFile(outFile, buf, function(err){
        if (err) throw err;
    });
}

// refactored version of weepy's
// https://github.com/weepy/brequire/blob/master/browser/brequire.js

var browser = {

    /**
     * Require a module.
     */

    require: function require(p){
        var path = require.resolve(p)
            , mod = require.modules[path];
        if (!mod) throw new Error('failed to require "' + p + '"');
        if (!mod.exports) {
            mod.exports = {};
            mod.call(mod.exports, mod.exports, require.relative(path), mod);
        }
        return mod.exports;
    },

    /**
     * Resolve module path.
     */

    resolve: function(path){
        var orig = path
            , reg = path + '.js'
            , index = path + '/index.js';
        return require.modules[reg] && reg
            || require.modules[index] && index
            || orig;
    },

    /**
     * Return relative require().
     */

    relative: function(parent) {
        return function(p){
            if ('.' != p.charAt(0)) return require(p);

            var path = parent.split('/')
                , segs = p.split('/');
            path.pop();

            for (var i = 0; i < segs.length; i++) {
                var seg = segs[i];
                if ('..' == seg) path.pop();
                else if ('.' != seg) path.push(seg);
            }

            return require(path.join('/'));
        };
    },

    /**
     * Register a module.
     */

    register: function(path, fn){
        require.modules[path] = fn;
    }
};
