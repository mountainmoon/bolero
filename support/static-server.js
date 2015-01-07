var express = require('express')
  , http = require('http')
  , path = require('path')

exports.run = function() {
  var app = express()

  app.use(function(req, res, next) {
    var t = +req.query.delay
    if ('shutdown' in req.query) return process.exit()
    if (typeof t == 'number' && t > 0) setTimeout(function() {next()}, t)
    else next()
  })
  app.use(express.static(path.join(__dirname, '../test/static')))
  app.listen(9999)
  console.log('Static test file server running at http://127.0.0.1:9999/\n');
}
/*
exports.shutdown = function() {
  http.get("http://127.0.0.1:9999/?shutdown", function(res) {})
}

var argv = process.argv.splice(2)
  , shutdown = argv.indexOf('-s') != -1
  , run = argv.indexOf('-r') != -1

if (shutdown && run) {
  console.log('-r, -s should not appear together')
  return process.exit()
} else if (shutdown) {
  exports.shutdown()
} else if (run) {
  exports.run()
}*/
