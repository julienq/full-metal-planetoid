(function () {
  "use strict";

  var SMOOTHING = 0.2,             // scale factor for Bézier smoothing
    SVG = document.querySelector("svg"),               // the SVG context
    SYSTEM = document.getElementById("system"),        // planetary system
    PLANET = document.getElementById("planet"),        // planet itself
    CORE = document.getElementById("core"),            // planet core
    PLAYER = document.getElementById("player"),        // player saucer
    PARTICLES = document.getElementById("particles"),  // player saucer
    PARTICLES_N = 10,
    PARTICLE_R = 20,
    PARTICLE_TTL_MS = 3000,
    PARTICLE_DH = 10,
    PERIOD_MS = 360000,        // rotation period (in milliseconds)
    PLANET_R = 1200,                             // planet radius
    PLANET_SECTORS = 48,
    PLANET_AMPLITUDE = 50,                       // bump/mining amplitude
    CORE_R = 300,                                // core radius
    CORE_AMPLITUDE = 20,                         // core amplitude
    CORE_SECTORS = 16,
    STARS = 1000,                // number of stars
    STAR_R = 10,
    PLAYER_ALTITUDE = 1500,
    PLAYER_A = 0,               // angular position of the player (in degrees)
    PLAYER_DA = 360 / PLANET_SECTORS;  // angular increment

  // Simple format function for messages and templates. Use {0}, {1}...
  // as slots for parameters. Missing parameters are replaced with the empty
  // string.
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
    c.addEventListener("mousedown", function () {
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

  function update_particles(now) {
    [].forEach.call(PARTICLES.childNodes, function (p) {
      if (now > p.ttl) {
        PARTICLES.removeChild(p);
      } else {
        p.h += PARTICLE_DH;
        p.setAttribute("cx", p.h * Math.cos(p.t));
        p.setAttribute("cy", p.h * Math.sin(p.t));
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
  function add_particles(sector) {
    var i, particle;
    for (i = 0; i < PARTICLES_N; i += 1) {
      particle = PARTICLES.appendChild(svg_elem("circle", {
        fill: PLANET.getAttribute("fill"), r: Math.random() * PARTICLE_R }));
      particle.t = (sector / PLANET_SECTORS + Math.random() * 0.04 - 0.02) *
        2 * Math.PI;
      particle.h = PLANET.heights[sector] + Math.random() * PLANET_AMPLITUDE;
      particle.ttl = Date.now() + PARTICLE_TTL_MS * (1 + Math.random() * 0.2);
    }
  }

  // Mine for ore
  // TODO ore :)
  // TODO nearby sectors crumble
  function mine() {
    var i, sector = Math.floor(PLAYER_A * PLANET_SECTORS / 360),
      amp = Math.random() * PLANET_AMPLITUDE;
    PLANET.heights[sector] = Math.max(PLANET.heights[sector] - amp, 0);
    add_particles(sector);
    update_spheroid(PLANET);
  }

  // Initialize the game
  SVG.insertBefore(stars(), SYSTEM);
  create_spheroid(PLANET, PLANET_R, PLANET_AMPLITUDE, PLANET_SECTORS);
  create_spheroid(CORE, CORE_R, CORE_AMPLITUDE, CORE_SECTORS);

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
