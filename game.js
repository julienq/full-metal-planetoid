/*jslint devel: true, browser: true, unparam: true, maxerr: 50, indent: 2 */

(function () {
  "use strict";

  var ON = false,
    SZ = 2000,
    SMOOTHING = 0.2,             // scale factor for Bézier smoothing
    SVG = document.querySelector("svg"),               // the SVG context
    SYSTEM = document.getElementById("system"),        // planetary system
    PLANET = document.getElementById("planet"),        // planet itself
    CORE = document.getElementById("core"),            // planet core
    PLAYER = document.getElementById("player"),        // player saucer
    CONE = document.getElementById("cone"),            // mining cone
    ORE = document.getElementById("ore"),              // ore group
    PARTICLES = document.getElementById("particles"),  // player saucer
    STARS = document.getElementById("stars"),
    CASH_TEXT = document.getElementById("cash"),
    CASH_OFFSET = 200,
    ORE_N = 100,
    ORE_R = 20,
    ORE_DISTRIBUTION = 0.3,  // smaller clusters around the center, must be < 1
    ORE_VALUE = 20,
    CONE_R = 10,
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
    N_STARS = 1000,                // number of stars
    STAR_R = 10,
    PLAYER_ALTITUDE = 1500,
    PLAYER_A = 0,               // angular position of the player (in degrees)
    PLAYER_DA = 360 / PLANET_SECTORS,  // angular increment
    MINING_COST = 50,
    DIFFICULTY = 1,
    PLANETS = 1,
    CASH = 0;

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
  function make_stars() {
    var i, vb;
    vb = SVG.viewBox.baseVal;
    while (STARS.firstChild) {
      STARS.removeChild(STARS.firstChild);
    }
    for (i = 0; i < N_STARS; i += 1) {
      make_star(vb, STARS);
    }
  }

  function magnitude(x, y) {
    return Math.sqrt(x * x + y * y);
  }

  // (Re)draw a spheroid (the planet or its core) smoothly
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
  function create_spheroid(path, radius, min_radius, amplitude, sectors) {
    var i;
    path.heights = [];
    path.min_heights = [];
    for (i = 0; i < sectors; i += 1) {
      path.heights.push(radius + amplitude * (Math.random() - 0.5));
      path.min_heights.push(min_radius + amplitude * (Math.random() - 0.5));
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
        p.setAttribute("x", p.h * Math.cos(p.t));
        p.setAttribute("y", p.h * Math.sin(p.t));
      }
    });
  }

  // Rotate the planet and move the player
  // TODO interpolate player position
  function tick(now) {
    var h = PLAYER_ALTITUDE;
    SYSTEM.setAttribute("transform", "rotate({0})"
      .fmt((now % PERIOD_MS) / PERIOD_MS * 360));
    PLAYER.setAttribute("transform", "rotate({0}) translate({1})"
      .fmt(PLAYER_A + PLAYER_DA / 2, PLAYER_ALTITUDE));
    CASH_TEXT.setAttribute("transform",
        "rotate({0}) translate({1}) rotate(90) translate({2})"
      .fmt(PLAYER_A + PLAYER_DA / 2, PLAYER_ALTITUDE, CASH_OFFSET));
    CONE.setAttribute("d", "M0,0 L{0},{1} A{2},{2} 1 0,1 {3},{4} Z".fmt(
      h * Math.cos(-PLAYER_DA * Math.PI / 360),
      h * Math.sin(-PLAYER_DA * Math.PI / 360),
      CONE_R,
      h * Math.cos(PLAYER_DA * Math.PI / 360),
      h * Math.sin(PLAYER_DA * Math.PI / 360)
    ));
    CONE.setAttribute("transform", "rotate({0})"
      .fmt(PLAYER_A + PLAYER_DA / 2));
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

  // Add a text particle for money
  function cost_particle(cost, sector) {
    var t = PARTICLES.appendChild(svg_elem("text",
      { fill: cost < 0 ? "red" : "white" }));
    t.textContent = cost.toString();
    t.t = (sector / PLANET_SECTORS + Math.random() * 0.04 - 0.02) *
      2 * Math.PI;
    t.h = PLANET.heights[sector] + Math.random() * PLANET_AMPLITUDE;
    t.dh = PARTICLE_DH * (1 + (Math.random() * 0.2 - 0.1));
    t.ttl = Date.now() + PARTICLE_TTL_MS * (1 + Math.random() * 0.2);
  }

  function game_over() {
    ON = false;
    if (CASH < 0) {
      document.getElementById("game-over").style.display = "block";
      document.getElementById("game-over").querySelector("span").textContent =
        "{0} planet{1}.".fmt(PLANETS, PLANETS > 1 ? "s" : "");
    } else {
      document.getElementById("continue").style.display = "block";
      DIFFICULTY *= 1.25;
      PLANETS += 1;
    }
  }

  // Mine one sector, return the amount of mining done
  function mine_sector(sector, amplitude, get_ore) {
    var h = Math.max(PLANET.heights[sector] - amplitude,
        PLANET.min_heights[sector]),
      dh = PLANET.heights[sector] - h,
      cost = Math.ceil(MINING_COST * dh / PLANET_AMPLITUDE * DIFFICULTY),
      c;
    PLANET.heights[sector] = h;
    add_particles(sector, Math.floor(dh / 4));
    [].forEach.call(ORE.childNodes, function (chunk) {
      if (chunk.sector === sector && chunk.h >= PLANET.heights[sector]) {
        ORE.removeChild(chunk);
        chunk.dh = PARTICLE_DH * (1 + (Math.random() * 0.2 - 0.1));
        chunk.ttl = Date.now() + PARTICLE_TTL_MS * (1 + Math.random() * 0.2);
        chunk.setAttribute("fill", ORE.getAttribute("fill"));
        if (get_ore) {
          c = Math.round(chunk.getAttribute("r") * ORE_VALUE);
          CASH += c;
          cost_particle(c, sector);
        }
        PARTICLES.appendChild(chunk);
        if (ORE.childNodes.length === 0) game_over();
      }
    });
    if (cost && get_ore) {
      cost_particle(-cost, sector);
    }
    return cost;
  }

  // Actually the collapsing is more violent than I expected but I guess it
  // works that way so I will count that as a feature and not a bug.
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
      chunk = ORE.appendChild(svg_elem("circle", { r: ORE_R / 2 +
        Math.random() * ORE_R / 2 }));
      chunk.t = Math.random() * 2 * Math.PI;
      chunk.sector = Math.floor(chunk.t *  PLANET_SECTORS / (2 * Math.PI));
      chunk.h = CORE_R + (1 - Math.pow(Math.random(), ORE_DISTRIBUTION)) *
        (PLANET.heights[chunk.sector] - CORE_R);
      chunk.setAttribute("cx", chunk.h * Math.cos(chunk.t));
      chunk.setAttribute("cy", chunk.h * Math.sin(chunk.t));
    }
  }

  function update_cash() {
    CASH_TEXT.textContent = CASH;
    CASH_TEXT.setAttribute("fill", CASH < 0 ? "red" : "white");
  }

  // Mine for ore
  function mine() {
    var cost, sector = Math.floor(PLAYER_A * PLANET_SECTORS / 360);
    cost = mine_sector(sector, Math.random() * PLANET_AMPLITUDE, true);
    if (cost > 0) {
      CASH -= cost;
      check_collapse(sector, -1);
      check_collapse(sector, 1);
      update_spheroid(PLANET);
      update_cash();
    }
  }

  function resize() {
    var ratio, w, h;
    SVG.style.width = "{0}px".fmt(window.innerWidth);
    SVG.style.height = "{0}px".fmt(window.innerHeight);
    ratio = Math.min(window.innerWidth, window.innerHeight) / 4000;
    w = window.innerWidth / ratio;
    h = window.innerHeight / ratio;
    SVG.setAttribute("viewBox", "{0} {1} {2} {3}".fmt(-w / 2, -h / 2, w, h));
    make_stars();
  }

  window.addEventListener("resize", resize, false);
  resize();

  function reset_game() {
    create_spheroid(CORE, CORE_R, 0, CORE_AMPLITUDE, CORE_SECTORS);
    create_spheroid(PLANET, PLANET_R, PLANET_MIN_HEIGHT, PLANET_AMPLITUDE,
        PLANET_SECTORS);
    add_ore();
    update_cash();
  }

  reset_game();

  [].forEach.call(document.querySelectorAll("a"), function (a) {
    a.addEventListener("click", function (e) {
      e.stopPropagation();
    }, false);
  });

  document.addEventListener("click", function (e) {
    if (!ON) {
      SVG.setAttribute("opacity", 1);
      ON = true;
      [].forEach.call(document.querySelectorAll("p"), function (p) {
        p.style.display = "none";
      });
      if (CASH >= 0) {
        reset_game();
      }
    }
  }, false);

  document.addEventListener("keydown", function (e) {
    if (e.keyCode === 37) {
      e.preventDefault();
      PLAYER_A = (PLAYER_A - PLAYER_DA + 360) % 360;
    } else if (e.keyCode === 39) {
      e.preventDefault();
      PLAYER_A = (PLAYER_A + PLAYER_DA) % 360;
    } else if (e.keyCode === 40 && ON) {
      e.preventDefault();
      mine();
    }
  });

  tick();

}());
