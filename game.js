/*jslint devel: true, browser: true, maxerr: 50, indent: 2 */

(function () {
  "use strict";

  // Find out which requestAnimationFrame to use
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame =
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.oRequestAnimationFrame ||
      function(f) {
        return setTimeout(function() { f(Date.now()); }, 1000 / 60);
      };
  }

  var SVG = document.querySelector("svg");

  // Create a roughly round planet of the given radius and number of segments
  function create_planet(radius, segments)
  {
    var i, d = "", path = document.createElement("path");
    for (i = 0; i < segments; ++i) {

    }
    return path;
  }

}());
