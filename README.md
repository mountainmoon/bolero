socketio-wildcard
=================

[![Build Status](https://travis-ci.org/mountainmoon/bolero.svg)](https://travis-ci.org/mountainmoon/bolero)

Web crawler for Node and browsers.
It can either be run standalone within a page, be remotely controlled by Node, or just be in Node.
Using DOM operation to scrap data is available when it is running within a page.

Installation
------------

    npm install --save bolero


Usage
-----

 - To run it in browser, add `bolero.js` to your code, and install tentacle.user.js(a user-script file) in your browser.
```js
var Crawler = bolero.Crawler
  , linkExt = bolero.extractor.linkExtractor
  , crawler

crawler = new Crawler({
  url: 'http://example.com', // or an object. see detail below

  // this is a default callback for all urls. optional
  callback: function(html, response) {
    // extract and return your data.
  },

  // called after callback to do some common operations. optional
  progress: function(result /*the result returned by callback*/){}

  // called if all urls are fetched. optional
  drain: function(results /*all the fetched results*/)
})

crawler.queue('another url')
crawler.queue({
  url: 'a url',
  callback: function callback(html, response){/*the specified callback for the url*/}
})
crawler.queue(url /*could be the type above, or an array containing such url*/)

// finally, call
crawler.run()
// call crawler.pause() if needed
```

 - To use a function to handle DOM in browser, just assign the function named `domCallback` to the callback function.
 The result will be attached to `response.domResult`
```js
callback.domCallback = function() {
  // This function would be transformed as a string which would be passed to
  // another window to be evaluated. So it is a SPECIAL function which scope
  // will be confirmed in future.
  return document.querySelector('selector').innerHTML
}
```

 - To run it in Node with no relationship to browsers, just use require to get the constructor. Use it like above except having no domCallback.
```js
var Crawler = require('bolero')
  , crawler = new Crawler(/**/)
```

- To run it in Node, and fetch data through browser(domCallback is available).
```js
var Crawler = require('bolero')
  , crawler = new Crawler({name: 'node2browser-adapter'})
```

Licence
-------
MIT