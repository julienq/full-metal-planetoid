/*jslint browser: true, maxerr: 50, indent: 2 */

(function () {
  "use strict";

  var
    CORE_AMPLITUDE = 20,
    CORE_R = 300,
    CORE_SECTORS = 16,
    // GALAXIES = [],
    PERIOD_MS = 360000,
    PLANET_AMPLITUDE = 50,
    PLANET_MIN_HEIGHT = CORE_R / 2,
    PLANET_R = 1200,
    PLANET_SECTORS = 48,
    SMOOTHING = 0.2,
    STAR_DENSITY = 0.0000625,
    STAR_R = 10,
    SVG = document.querySelector("svg"),
    SYSTEM = document.getElementById("system"),
    SZ = 4000;

  // Create a star
  // TODO keep track of galaxies
  // TODO always find the nearest point
  // TODO k-d tree to replace the targets (always a point)
  function make_star(vb, g) {
    var c,
      x = Math.random() * vb.width + vb.x,
      y = Math.random() * vb.height + vb.y;
    g.appendChild(zap.svg("circle", { r: Math.random() * STAR_R,
      cx: x, cy: y, fill: "white", "fill-opacity": Math.random() }));
    /*
    c = g.appendChild(zap.svg("circle", { r: 2 * STAR_R, cx: x, cy: y,
      "fill-opacity": 0 }));
    c.addEventListener("mousedown", function (e) {
      e.preventDefault();
      var move, up, line = g.appendChild(zap.svg("line", { x1: x, y1: y,
        x2: x, y2: y, stroke: "white", "stroke-width": 4,
        "stroke-opacity": Math.random() / 2 + 0.5 }));
      move = function (e) {
        var p = zap.svg_point(e);
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
    */
  }

  // Add stars to the background
  function make_stars() {
    var stars = document.getElementById("stars"),
      vb = SVG.viewBox.baseVal, i, n;
    while (stars.firstChild) {
      stars.removeChild(stars.firstChild);
    }
    for (i = 0, n = vb.width * vb.height * STAR_DENSITY; i < n; i += 1) {
      make_star(vb, stars);
    }
  }

  // Resize the game when the window size changes
  function resize() {
    SVG.style.width = "{0}px".fmt(window.innerWidth);
    SVG.style.height = "{0}px".fmt(window.innerHeight);
    var ratio = Math.min(window.innerWidth, window.innerHeight) / SZ,
      w = window.innerWidth / ratio,
      h = window.innerHeight / ratio;
    SVG.setAttribute("viewBox", "{0} {1} {2} {3}".fmt(-w / 2, -h / 2, w, h));
    make_stars();
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
      d += "".fmt.apply("C{0},{1} {2},{3} {4},{5}",
          [xa, ya, x1, y1, xb, yb].map(function (x) { return Math.round(x); }));
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

  // Rotate the planet
  function tick(now) {
    SYSTEM.setAttribute("transform", "rotate({0})"
      .fmt((now % PERIOD_MS) / PERIOD_MS * 360));
    window.requestAnimationFrame(tick);
  }

  window.addEventListener("resize", resize, false);
  resize();

  create_spheroid(document.getElementById("core"), CORE_R, 0, CORE_AMPLITUDE,
      CORE_SECTORS);
  create_spheroid(document.getElementById("planet"), PLANET_R,
      PLANET_MIN_HEIGHT, PLANET_AMPLITUDE, PLANET_SECTORS);
  tick(Date.now());

}());
