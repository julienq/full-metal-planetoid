// Saucer instead of guy
// max height/current height for each sector

(function () {
  "use strict";

  var R = 1000,                  // planet radius
    SECTORS = 36,                // the planet is divided in sectors
    AMPLITUDE = 50,              // bump/mining amplitude
    DT = 2 * Math.PI / SECTORS,  // angle of a single sector
    PLANET_COLOR = "#ff4040",    // TODO change to show the status of the planet

    SVG,
    STARS = 1000,
    STAR_R = 10,
    PLANET,                    // the planet we're playing on
    PERIOD_MS = 360000,        // rotation period (in milliseconds)

    PLAYER,
    PLAYER_HEIGHT = 50,
    PLAYER_WIDTH = 20,
    PLAYER_COLOR = "#08f",
    PLAYER_ALTITUDE = 1200,
    PLAYER_A = 0,              // angular position of the player (in degrees)
    PLAYER_DA = 5;             // angular increment

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
  function svg_elem(name, attrs) {
    var attr,
        elem = document.createElementNS("http://www.w3.org/2000/svg", name);
    if (typeof attrs === "object") {
      for (attr in attrs) {
        elem.setAttribute(attr, attrs[attr]);
      }
    }
    return elem;
  }

  // Add stars to the background
  function stars() {
    var i, vb, g;
    vb = SVG.viewBox.baseVal;
    g = svg_elem("g");
    for (i = 0; i < STARS; ++i) {
      g.appendChild(svg_elem("circle", { r: Math.random() * STAR_R,
        cx: Math.random() * vb.width + vb.x,
        cy: Math.random() * vb.height + vb.y,
        fill: "white", "fill-opacity": Math.random() }));
    }
    return g;
  }

  function update_planet(planet) {
    var i, t, d, x, y;
    for (i = 0, t = 0, d = ""; i < SECTORS; ++i) {
      x = planet.heights[i] * Math.cos(t);
      y = planet.heights[i] * Math.sin(t);
      d += "L{0}, {1}".fmt(x, y);
      t += DT;
      x = planet.heights[i] * Math.cos(t);
      y = planet.heights[i] * Math.sin(t);
      d += "L{0}, {1}".fmt(x, y);
    }
    planet.path.setAttribute("d", d.replace(/^L/, "M"));
  }

  // Create a roughly round planet of the given radius and number of sectors
  function create_planet(radius, amplitude, sectors) {
    var i, t, dt, x, y, d, g, r, path;
    g = svg_elem("g");
    g.heights = [];
    g.path = g.appendChild(svg_elem("path", { fill: PLANET_COLOR }));
    for (i = 0; i < sectors; ++i) {
      g.heights.push(radius + amplitude * (Math.random() - 0.5));
    }
    update_planet(g);
    return g;
  }

  function update_player() {
    PLAYER.setAttribute("transform", "rotate({0}) translate({1})"
      .fmt(PLAYER_A, PLAYER_ALTITUDE));
  }

  function tick(now) {
    var t = (now % PERIOD_MS) / PERIOD_MS * 360;
    PLANET.setAttribute("transform", "rotate({0})".fmt(t));
    update_player();
    window.requestAnimationFrame(tick);
  }

  function mine() {
    var sector = Math.floor(PLAYER_A * SECTORS / 360);
    var amp = Math.random() * AMPLITUDE;
    PLANET.heights[sector] -= amp;
    update_planet(PLANET);
  }

  // Initialize the game
  SVG = document.querySelector("svg");
  SVG.appendChild(stars());
  PLANET = SVG.appendChild(create_planet(R, AMPLITUDE, SECTORS));
  PLAYER = PLANET.appendChild(svg_elem("rect", { width: PLAYER_HEIGHT,
    height: PLAYER_WIDTH, fill: PLAYER_COLOR }));

  document.addEventListener("keydown", function (e) {
    if (e.keyCode === 37) {
      e.preventDefault();
      PLAYER_A = (PLAYER_A - PLAYER_DA + 360) % 360;
    } else if (e.keyCode === 39) {
      e.preventDefault();
      PLAYER_A = (PLAYER_A + PLAYER_DA) % 360;
    } else if (e.keyCode === 40) {
      e.preventDefault();
      mine();
    }
  });

  tick();

}());
