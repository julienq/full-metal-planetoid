/*jslint devel: true, browser: true, unparam: true, maxerr: 50, indent: 2 */

(function () {
  "use strict";

  var SMOOTHING = 0.2,             // scale factor for Bézier smoothing
    SVG = document.querySelector("svg"),               // the SVG context
    SYSTEM = document.getElementById("system"),        // planetary system
    PLANET = document.getElementById("planet"),        // planet itself
    CORE = document.getElementById("core"),            // planet core
    PLAYER = document.getElementById("player"),        // player saucer
    ORE = document.getElementById("ore"),              // ore group
    PARTICLES = document.getElementById("particles"),  // player saucer
    CASH_SPAN = document.getElementById("cash").querySelector("span"),
    ORE_N = 100,
    ORE_R = 20,
    ORE_DR = 1,
    ORE_VALUE = 20,
    PARTICLE_R = 20,
    PARTICLE_TTL_MS = 2000,
    PARTICLE_DH = 10,
    PERIOD_MS = 360000,        // rotation period (in milliseconds)
    PLANET_R = 1200,                             // planet radius
    PLANET_SECTORS = 48,
    PLANET_AMPLITUDE = 50,                       // bump/mining amplitude
    MAX_DIFF = 3,                                // max diff between two sectors
    CORE_R = 300,                                // core radius
    PLANET_MIN_HEIGHT = CORE_R / 2,
    CORE_AMPLITUDE = 20,                         // core amplitude
    CORE_SECTORS = 16,
    STARS = 1000,                // number of stars
    STAR_R = 10,
    PLAYER_ALTITUDE = 1500,
    PLAYER_A = 0,               // angular position of the player (in degrees)
    PLAYER_DA = 360 / PLANET_SECTORS,  // angular increment
    MINING_COST = 50,
    CASH = 1000;

  // Simple format function for messages and templates. Use {0}, {1}...
  // as slots for parameters.
  String.prototype.fmt = function () {
    var args = [].slice.call(arguments);
    return this.replace(/\{(\d+)\}/g, function (s, p) { return args[p]; });
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

  // Get a point in SVG coordinates from an event
  function svg_point(e) {
    var p = SVG.createSVGPoint();
    p.x = e.targetTouches ? e.targetTouches[0].clientX : e.clientX;
    p.y = e.targetTouches ? e.targetTouches[0].clientY : e.clientY;
    try {
      p = p.matrixTransform(SVG.getScreenCTM().inverse());
    } catch (x) {
    }
    return p;
  }

  function make_star(vb, g) {
    var c,
      x = Math.random() * vb.width + vb.x,
      y = Math.random() * vb.height + vb.y;
    g.appendChild(svg_elem("circle", { r: Math.random() * STAR_R,
      cx: x, cy: y, fill: "white", "fill-opacity": Math.random() }));
    c = g.appendChild(svg_elem("circle", { r: 2 * STAR_R, cx: x, cy: y,
      "fill-opacity": 0 }));
    c.addEventListener("mousedown", function (e) {
      e.preventDefault();
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
  }

  // Add stars to the background
  function stars() {
    var i, vb, g;
    vb = SVG.viewBox.baseVal;
    g = svg_elem("g");
    for (i = 0; i < STARS; i += 1) {
      make_star(vb, g);
    }
    return g;
  }

  function magnitude(x, y) {
    return Math.sqrt(x * x + y * y);
  }

  function update_spheroid(path) {
    var i, n, d, dt, x0, y0, x1, y1, tx, ty, l, x2, y2, xa, ya, xb, yb;
    d = "M{0},0".fmt(path.heights[0]);
    for (i = 0, n = path.heights.length, dt = 2 * Math.PI / n; i < n; i += 1) {
      x0 = path.heights[(i + n - 1) % n] * Math.cos((i - 1) * dt);
      y0 = path.heights[(i + n - 1) % n] * Math.sin((i - 1) * dt);
      x1 = path.heights[i] * Math.cos(i * dt);
      y1 = path.heights[i] * Math.sin(i * dt);
      x2 = path.heights[(i + 1) % n] * Math.cos((i + 1) * dt);
      y2 = path.heights[(i + 1) % n] * Math.sin((i + 1) * dt);
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
    path.setAttribute("d", d);
  }

  // Create a roughly round planet of the given radius and number of sectors
  function create_spheroid(path, radius, amplitude, sectors) {
    var i;
    path.heights = [];
    for (i = 0; i < sectors; i += 1) {
      path.heights.push(radius + amplitude * (Math.random() - 0.5));
    }
    update_spheroid(path);
  }

  // Update the particles movement
  function update_particles(now) {
    [].forEach.call(PARTICLES.childNodes, function (p) {
      if (now > p.ttl) {
        PARTICLES.removeChild(p);
      } else {
        p.h += p.dh;
        p.setAttribute("cx", p.h * Math.cos(p.t));
        p.setAttribute("cy", p.h * Math.sin(p.t));
        if (p.dr) {
          p.setAttribute("r", parseFloat(p.getAttribute("r")) + p.dr);
        }
      }
    });
  }

  // Rotate the planet and move the player
  // TODO interpolate player position
  function tick(now) {
    SYSTEM.setAttribute("transform", "rotate({0})"
      .fmt((now % PERIOD_MS) / PERIOD_MS * 360));
    PLAYER.setAttribute("transform", "rotate({0}) translate({1})"
      .fmt(PLAYER_A + PLAYER_DA / 2, PLAYER_ALTITUDE));
    update_particles(now);
    window.requestAnimationFrame(tick);
  }

  // Add particles after mining
  function add_particles(sector, n) {
    var i, particle;
    for (i = 0; i < n; i += 1) {
      particle = PARTICLES.appendChild(svg_elem("circle",
        { fill: PLANET.getAttribute("fill"),
          r: Math.random() * PARTICLE_R }));
      particle.t = (sector / PLANET_SECTORS + Math.random() * 0.04 - 0.02) *
        2 * Math.PI;
      particle.h = PLANET.heights[sector] + Math.random() * PLANET_AMPLITUDE;
      particle.dh = PARTICLE_DH * (1 + (Math.random() * 0.2 - 0.1));
      particle.ttl = Date.now() + PARTICLE_TTL_MS * (1 + Math.random() * 0.2);
    }
  }

  // Mine one sector, return the amount of mining done
  function mine_sector(sector, amplitude, get_ore) {
    var h = Math.max(PLANET.heights[sector] - amplitude, PLANET_MIN_HEIGHT),
      dh = PLANET.heights[sector] - h;
    PLANET.heights[sector] = h;
    add_particles(sector, Math.floor(dh / 4));
    [].forEach.call(ORE.childNodes, function (chunk) {
      if (chunk.sector === sector && chunk.h >= PLANET.heights[sector]) {
        ORE.removeChild(chunk);
        chunk.dh = PARTICLE_DH * (1 + (Math.random() * 0.2 - 0.1));
        chunk.ttl = Date.now() + PARTICLE_TTL_MS * (1 + Math.random() * 0.2);
        chunk.setAttribute("fill", ORE.getAttribute("fill"));
        if (get_ore) {
          chunk.dr = ORE_DR;
          CASH += Math.round(chunk.getAttribute("r") * ORE_VALUE);
        }
        PARTICLES.appendChild(chunk);
      }
    });
    return dh;
  }

  function check_collapse(sector, incr) {
    var sectors = PLANET.heights.length,
      s = (sector + sectors + incr) % sectors,
      dh = PLANET.heights[s] - PLANET.heights[sector];
    if (dh > PLANET_AMPLITUDE * MAX_DIFF) {
      if (mine_sector(s, Math.random() * 2 * dh)) {
        check_collapse(s, incr);
      }
    }
  }

  // Add chunks of ore
  function add_ore() {
    var i, chunk;
    for (i = 0; i < ORE_N; i += 1) {
      chunk = ORE.appendChild(svg_elem("circle", { r: Math.random() * ORE_R }));
      chunk.t = Math.random() * 2 * Math.PI;
      chunk.sector = Math.floor(chunk.t *  PLANET_SECTORS / (2 * Math.PI));
      chunk.h = PLANET_MIN_HEIGHT +
        Math.random() * (PLANET.heights[chunk.sector] - PLANET_MIN_HEIGHT);
      chunk.setAttribute("cx", chunk.h * Math.cos(chunk.t));
      chunk.setAttribute("cy", chunk.h * Math.sin(chunk.t));
    }
  }

  function update_cash() {
    CASH_SPAN.textContent = CASH;
  }

  // Mine for ore
  function mine() {
    var dh, sector = Math.floor(PLAYER_A * PLANET_SECTORS / 360);
    if (CASH > 0) {
      dh = mine_sector(sector, Math.random() * PLANET_AMPLITUDE, true);
      if (dh > 0) {
        CASH -= Math.ceil(MINING_COST * dh / PLANET_AMPLITUDE);
        check_collapse(sector, -1);
        check_collapse(sector, 1);
        update_spheroid(PLANET);
      }
      update_cash();
    }
  }

  // Initialize the game
  SVG.insertBefore(stars(), SYSTEM);
  create_spheroid(PLANET, PLANET_R, PLANET_AMPLITUDE, PLANET_SECTORS);
  create_spheroid(CORE, CORE_R, CORE_AMPLITUDE, CORE_SECTORS);
  add_ore();
  update_cash();

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
