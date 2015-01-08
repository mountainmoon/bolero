// refactored version of karma-chrome-launcher
var fs = require('fs');
var spawn = require('child_process').spawn;

var ChromeBrowser = function(flags) {

  flags = flags || [];
  var self = this;

  this._getOptions = function(url) {
    // Chrome CLI options
    // http://peter.sh/experiments/chromium-command-line-switches/
    return [
      // TODO: without user-data-dir, the tab opened by `.start` could
      // not be closed by '.kill' if a chrome process is already running.
      // '--user-data-dir=' + this._tempDir,
      '--no-default-browser-check',
      '--no-first-run',
      '--disable-default-apps',
      '--disable-popup-blocking',
      '--disable-translate'
    ].concat(flags, [url]);
  };

  this.start = function(url) {
      var self = this
      this._process = spawn(this._getCommand(), this._getOptions(url))
      this._process.on('error', function(err) {
          var msg = 'failed to open chrome';
          console.log(msg);
          self.onerror && self.onerror(msg) // todo:handle error
      })
  };

  this._getCommand = function() {
    return process.env[self.ENV_CMD] || self.DEFAULT_CMD[process.platform];
  };

  this.kill = function() {
    this._process.kill()
  };
};

// Return location of chrome.exe file for a given Chrome directory (available: "Chrome", "Chrome SxS").
function getChromeExe(chromeDirName) {
  if (process.platform !== 'win32') {
    return null;
  }
  var windowsChromeDirectory, i, prefix;
  var suffix = '\\Google\\'+ chromeDirName + '\\Application\\chrome.exe';
  var prefixes = [process.env.LOCALAPPDATA, process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)']];

  for (i = 0; i < prefixes.length; i++) {
    prefix = prefixes[i];
    if (fs.existsSync(prefix + suffix)) {
      windowsChromeDirectory = prefix + suffix;
      break;
    }
  }

  return windowsChromeDirectory;
}

ChromeBrowser.prototype = {
  name: 'Chrome',

  DEFAULT_CMD: {
    linux: 'google-chrome',
    darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    win32: getChromeExe('Chrome')
  },
  ENV_CMD: 'CHROME_BIN'
};


module.exports = ChromeBrowser