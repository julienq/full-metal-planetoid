/*jslint devel: true, browser: true, maxerr: 50, indent: 2 */

(function () {
  "use strict";

  var R = 1000,                // planet radius
    SEGMENTS = 24,             // planet segments (coarseness)
    PLANET_COLOR = "#f08",  // color of the planet

    PLAYER,
    PLAYER_HEIGHT = 50,        // player height
    PLAYER_WIDTH = 20,
    PLAYER_COLOR = "#08f",
    PLAYER_T = Math.PI / 4,

    SVG,
    STARS = 1000,
    STAR_R = 10,
    PLANET,                    // the planet we're playing on
    PERIOD_MS = 180000;        // rotation period (in milliseconds)

  // Simple format function for messages and templates. Use {0}, {1}...
  // as slots for parameters. Missing parameters are replaced with the empty
  // string.
  String.prototype.fmt = function () {
    var args = [].slice.call(arguments);
    return this.replace(/\{(\d+)\}/g, function (_, p) { return args[p]; });
  };

  // Find out which requestAnimationFrame to use
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame =
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.oRequestAnimationFrame ||
      function (f) {
        return setTimeout(function () { f(Date.now()); }, 1000 / 60);
      };
  }

  // Shortcut to create SVG elements
  function svg_elem(name) {
    return document.createElementNS("http://www.w3.org/2000/svg", name);
  }

  // Create a roughly round planet of the given radius and number of segments
  function create_planet(radius, amplitude, segments) {
    var i, incr, t, r, x, y, d, g, path;
    incr = 2 * Math.PI / segments;
    r = radius + amplitude * (Math.random() - 0.5);
    g = svg_elem("g");
    path = g.appendChild(svg_elem("path"));
    for (i = 0, t = 0, x = r, y = 0, d = ""; i < segments; ++i) {

      d += "L{0},{1}".fmt(x, y);
      r = radius + amplitude * (Math.random() - 0.5);
      t += incr;
      x = r * Math.cos(t);
      y = r * Math.sin(t);
    }
    path.setAttribute("d", d.replace(/^L/, "M"));
    return g;
  }

  function tick(now) {
    var t = (now % PERIOD_MS) / PERIOD_MS * 360;
    PLANET.setAttribute("transform", "rotate({0})".fmt(t));
    requestAnimationFrame(tick);
  }

  function stars() {
    var i, star, w, h, vb;
    vb = SVG.viewBox.baseVal;
    for (i = 0; i < STARS; ++i) {
      star = SVG.appendChild(svg_elem("circle"));
      star.setAttribute("r", Math.random() * STAR_R);
      star.setAttribute("cx", Math.random() * vb.width + vb.x);
      star.setAttribute("cy", Math.random() * vb.height + vb.y);
      star.setAttribute("fill", "white");
      star.setAttribute("fill-opacity", Math.random());
    }
  }

  // Initialize the game
  SVG = document.querySelector("svg");
  stars();
  PLANET = SVG.appendChild(create_planet(R, 2 * PLAYER_HEIGHT, SEGMENTS));
  PLANET.setAttribute("fill", PLANET_COLOR);
  PLAYER = PLANET.appendChild(svg_elem("rect"));
  PLAYER.setAttribute("width", PLAYER_WIDTH);
  PLAYER.setAttribute("height", PLAYER_HEIGHT);
  PLAYER.setAttribute("x", -PLAYER_WIDTH / 2);
  PLAYER.setAttribute("y", -R - PLAYER_HEIGHT);
  PLAYER.setAttribute("fill", PLAYER_COLOR);

  tick();

}());
