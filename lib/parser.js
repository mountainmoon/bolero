
/**
 *
 * @param tag
 * @param attr
 * @return {Array} - this array contains 2 element, the 1st is a regExp used to catch the open tag string,
 * the 2nd is an object, which the key is what?, the value is the position of the wanted sub str in the capture group
 */
var tagPropRE = (function() {
    //TODO:也许可以只用key作为属性名来捕捉字符串(但也只有属性名可以这么做)
    var answer = {};
    return function(tag, attr, name) {
        if (!tag) {
            return
        }
        var key = Array.prototype.join.call(arguments);
        if (answer[key]) {
            return answer[key]
        }
        var pair = {};
        pair[name || tag] = 2;
        return answer[key] = [
            //new RegExp('<' + tag + (!attr ? '' : '\\b[^>]*?\\s' + attr + '\\s*=\\s*(["\'])([\\S\\s]*?)\\1') + '[^>]*/?>', 'ig'),
            new RegExp('<' + tag + (!attr ? '' : '\\b[^>]*?\\s' + attr + '\\s*=\\s*("|\')([\\S\\s]*?)\\1') + '[^>]*\\/?>', 'ig'),
            pair
        ];
    }
})();

/**
 * 批量生成需要的pattern
 * @param {Array} tagProps - an array of such array: contain 2 element, the 1st is the tag argument of `tagPropRE`, 2nd is the 2nd
 * @returns {Array} - an array of tagPropRE's return value.
 */
var tagPropREs = function(tagProps) {
    if (!(tagProps instanceof Array))
        throw TypeError('tagProps should be an Array');
    return tagProps.reduce(function(ret, pair) {
        ret.push(tagPropRE.apply(null, pair));
        return ret;
    }, [])
};

exports.tagPropRE = tagPropRE;
exports.tagPropREs = tagPropREs;
