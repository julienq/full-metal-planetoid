/*jslint browser: true, maxerr: 50, indent: 2 */

(function (zap) {
  "use strict";

  // Simple format function for messages and templates. Use {0}, {1}...
  // as slots for parameters.
  String.prototype.fmt = function () {
    var args = [].slice.call(arguments);
    return this.replace(/\{(\d+)\}/g, function (s, p) {
      return args[p] === undefined ? s: args[p];
    });
  };

  // Find out which requestAnimationFrame to use
  window.requestAnimationFrame =
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    function (f) {
      return setTimeout(function () { f(Date.now()); }, 1000 / 60);
    };

  // Shortcut to create SVG elements
  zap.svg = function (name, attrs) {
    var attr,
      elem = document.createElementNS("http://www.w3.org/2000/svg", name);
    if (typeof attrs === "object") {
      for (attr in attrs) {
        if (attrs.hasOwnProperty(attr)) {
          elem.setAttribute(attr, attrs[attr]);
        }
      }
    }
    return elem;
  };

  // Get a point in SVG coordinates from an event
  zap.svg_point = function (e, svg) {
    var p;
    if (!svg) {
      svg = document.querySelector("svg");
    }
    p = svg.createSVGPoint();
    p.x = e.targetTouches ? e.targetTouches[0].clientX : e.clientX;
    p.y = e.targetTouches ? e.targetTouches[0].clientY : e.clientY;
    try {
      p = p.matrixTransform(svg.getScreenCTM().inverse());
    } catch (x) {
    }
    return p;
  };

}(window.zap = {}));
