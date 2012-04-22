(function () {
  "use strict";

  var R = 1000,                  // planet radius
    SECTORS = 36,                // the planet is divided in sectors
    AMPLITUDE = 50,              // bump/mining amplitude
    DT = 2 * Math.PI / SECTORS,  // angle of a single sector
    SMOOTHING = 0.2,             // scale factor for Bézier smoothing
    PLANET_COLOR = "#ff4040",    // TODO change to show the status of the planet

    SVG = document.querySelector("svg"),
    STARS = 1000,
    STAR_R = 10,
    PLANET = document.getElementById("planet"),
    PERIOD_MS = 360000,        // rotation period (in milliseconds)

    PLAYER = document.getElementById("player"),
    PLAYER_HEIGHT = 50,
    PLAYER_WIDTH = 20,
    PLAYER_COLOR = "#08f",
    PLAYER_ALTITUDE = 1200,
    PLAYER_A = 0,               // angular position of the player (in degrees)
    PLAYER_DA = 360 / SECTORS;  // angular increment

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
        if (attrs.hasOwnProperty(attr)) {
          elem.setAttribute(attr, attrs[attr]);
        }
      }
    }
    return elem;
  }

  function svg_point(e) {
    var p = SVG.createSVGPoint();
    p.x = e.targetTouches ? e.targetTouches[0].clientX : e.clientX;
    p.y = e.targetTouches ? e.targetTouches[0].clientY : e.clientY;
    try {
      p = p.matrixTransform(SVG.getScreenCTM().inverse());
    } catch (e) {
    }
    return p;
  };

  // Add stars to the background
  function stars() {
    var i, vb, g;
    vb = SVG.viewBox.baseVal;
    g = svg_elem("g");
    for (i = 0; i < STARS; ++i) {
      (function () {
        var c,
          x = Math.random() * vb.width + vb.x,
          y = Math.random() * vb.height + vb.y;
        g.appendChild(svg_elem("circle", { r: Math.random() * STAR_R,
          cx: x, cy: y, fill: "white", "fill-opacity": Math.random() }));
        c = g.appendChild(svg_elem("circle", { r: 2 * STAR_R, cx: x, cy: y,
          "fill-opacity": 0 }));
        c.addEventListener("mousedown", function (e) {
          var move, up, line = g.appendChild(svg_elem("line", { x1: x, y1: y,
            x2: x, y2: y, stroke: "white", "stroke-width": 4,
            "stroke-opacity": Math.random() / 2 + 0.5 }));
          move = function (e) {
            var p = svg_point(e);
            line.setAttribute("x2", p.x);
            line.setAttribute("y2", p.y);
          };
          up = function (e) {
            g.removeChild(line);
            var elem = document.elementFromPoint(e.clientX, e.clientY);
            if (elem && elem.parentNode === g && elem.hasAttribute("cx")) {
              line.setAttribute("x2", elem.getAttribute("cx"));
              line.setAttribute("y2", elem.getAttribute("cy"));
              g.insertBefore(line, g.firstChild);
            }
            document.removeEventListener("mousemove", move, false);
            document.removeEventListener("mouseup", up, false);
          };
          document.addEventListener("mousemove", move, false);
          document.addEventListener("mouseup", up, false);
        }, false);
      }());
    }
    return g;
  }

  function magnitude(x, y) {
    return Math.sqrt(x * x + y * y);
  }

  function update_planet(planet) {
    var i, d, x0, y0, x1, y1, tx, ty, l, x2, y2, xa, ya, xb, yb;
    d = "M{0},0".fmt(planet.heights[0]);
    for (i = 0; i < SECTORS; i += 1) {
      x0 = planet.heights[(i + SECTORS - 1) % SECTORS] * Math.cos((i - 1) * DT);
      y0 = planet.heights[(i + SECTORS - 1) % SECTORS] * Math.sin((i - 1) * DT);
      x1 = planet.heights[i] * Math.cos(i * DT);
      y1 = planet.heights[i] * Math.sin(i * DT);
      x2 = planet.heights[(i + 1) % SECTORS] * Math.cos((i + 1) * DT);
      y2 = planet.heights[(i + 1) % SECTORS] * Math.sin((i + 1) * DT);
      tx = x2 - x0;
      ty = y2 - y0;
      l = Math.sqrt(tx * tx + ty * ty);
      tx = tx / l;
      ty = ty / l;
      xa = x1 - SMOOTHING * tx * magnitude(x1 - x0, y1 - y0);
      ya = y1 - SMOOTHING * ty * magnitude(x1 - x0, y1 - y0);
      xb = x1 + SMOOTHING * tx * magnitude(x1 - x2, y1 - y2);
      yb = y1 + SMOOTHING * ty * magnitude(x1 - x2, y1 - y2);
      d += "C{0},{1} {2},{3} {4},{5}".fmt(xa, ya, x1, y1, xb, yb);
    }
    planet.path.setAttribute("d", d);
  }

  // Create a roughly round planet of the given radius and number of sectors
  function create_planet(g, radius, amplitude, sectors) {
    var i;
    g.heights = [];
    g.path = g.appendChild(svg_elem("path", { fill: PLANET_COLOR }));
    for (i = 0; i < sectors; ++i) {
      g.heights.push(radius + amplitude * (Math.random() - 0.5));
    }
    update_planet(g);
  }

  function update_player() {
    PLAYER.setAttribute("transform", "rotate({0}) translate({1})"
      .fmt(PLAYER_A + PLAYER_DA / 2, PLAYER_ALTITUDE));
  }

  function tick(now) {
    var t = (now % PERIOD_MS) / PERIOD_MS * 360;
    PLANET.setAttribute("transform", "rotate({0})".fmt(t));
    update_player();
    window.requestAnimationFrame(tick);
  }

  function mine() {
    var sector = Math.floor(PLAYER_A * SECTORS / 360),
      amp = Math.random() * AMPLITUDE;
    PLANET.heights[sector] -= amp;
    update_planet(PLANET);
  }

  // Initialize the game
  SVG.insertBefore(stars(), PLANET);
  create_planet(PLANET, R, AMPLITUDE, SECTORS);

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
