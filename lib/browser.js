// This is a dirty hack to ignore the require of connect.mime,
// which is included by Express as of Express 3.0.0
require.modules.connect = function() {
  return {mime: null}
}

var Route = require('express/lib/router/route')
var History = require('./History')
var router = module.exports = require('./router')
var compose = require('./compose')

router.setup = setup

function setup(app, createPage, onRoute) {
  var routes = {
    queue: {}
  , transitional: {}
  , onRoute: onRoute
  }
  app.history = new History(createPage, routes)

  ;['get', 'post', 'put', 'del', 'enter', 'exit'].forEach(function(method) {
    var queue = routes.queue[method] = []
    var transitional = routes.transitional[method] = []
    var transitionalCalls = []

    app[method] = function(pattern, callback) {
      if (Array.isArray(pattern)) {
        pattern.forEach(function(item) {
          app[method](item, callback)
        })
        return app
      }

      if (router.isTransitional(pattern)) {
        var from = pattern.from
        var to = pattern.to
        var forward = pattern.forward || (callback && callback.forward) || callback
        var back = pattern.back || (callback && callback.back)
        transitionalCalls.push({
          from: from
        , to: to
        , forward: forward
        , back: back
        })

        var fromRoute = new Route(method, from, back)
        var toRoute = new Route(method, to, forward)
        fromRoute.isTransitional = true
        toRoute.isTransitional = true
        transitional.push({
          from: fromRoute
        , to: toRoute
        })
        if (back) transitional.push({
          from: toRoute
        , to: fromRoute
        })

        compose.transition(app[method], transitionalCalls, from, to, forward, back)
        return app
      }

      /*
       * Mounting Derby app to an Express app using route other then '/'
       * requires specification of an `app.mountPoint` so Derby application
       * routes can be matched correctly on the client side.
       *
       * expressApp.use(derbyApp.mountPoint = '/derby-app', derbyApp.router())
       */
      pattern = (app.mountPoint || '') + pattern

      queue.push(new Route(method, pattern, callback))
      return app
    }
  })
}
