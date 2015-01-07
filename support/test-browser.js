var staticServer = require('./static-server')
  , ChromeBrowser = require('../lib/launcher/chrome-launcher')
  , karmaServer = require('karma').server
  , path = require('path')

staticServer.run()
karmaServer.start({
  cmd: 'start',
  configFile: path.join(__dirname, '../karma.conf.js')
}, function(exitCode) {
  // console.log('Karma has exited with ' + exitCode)
  process.exit(exitCode)
});

try {
  (new ChromeBrowser).start('http://localhost:9876')
} catch (e) {
  console.log("chrome couldn't be open. " +
  "Open http://localhost:9876 in a browser installed tentacle.user.js");
}

caution('Open another terminal to run: "npm run test-browser-run"\n')

function caution(str) {
  console.log('\u001b[33m' + str + '\u001b[39m')
}
