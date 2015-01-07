function attrExtractor(tag, attr, alias) {
  if (typeof tag != 'string' && typeof attr != 'string')
    throw TypeError('tag and attr should be string')
  var attrRE = new RegExp('<' + tag + ('\\b[^>]*?\\s'+ attr
                              + '\\s*=\\s*("|\')([\\S\\s]*?)\\1')
                              + '[^>]*\\/?>', 'ig')
  return function(response) {
    if (!response) return
    var ret, array
    attr = alias || attr
    response.replace(attrRE, function(m, _, val) {
      if (!ret) {
        ret = {}
        array = ret[attr] = []
      }
      array.push(val)
    })
    return ret
  }
}

var linkExtractor = attrExtractor('a', 'href')

exports.attrExtractor = attrExtractor
exports.linkExtractor = linkExtractor