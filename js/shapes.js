/* shapes.js — the dot models this talk uses. Each returns n dots (Float32Array of x,y,z).
 * Units: a shape of radius 1 at scale 1 is about 247 px on the stage (see particles.js).
 */
(function () {
  'use strict';
  var Shapes = Cloud.Shapes, Sampler = Shapes.Sampler, rng = Cloud.rng;

  function ring(s, c, radius, thickness, weight) {
    var pts = [], i;
    for (i = 0; i <= 72; i++) { var a = i / 72 * Math.PI * 2; pts.push([c[0] + radius * Math.cos(a), c[1] + radius * Math.sin(a), c[2] || 0]); }
    s.curve(pts, thickness, weight);
  }
  function rect(x0, y0, x1, y1) { return [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0], [x0, y0, 0]]; }

  /* ------------------------------ the problem: loose sheets of paper, everywhere ------------------------------ */
  Shapes.papers = function (n) {
    var r = rng(11), s = new Sampler(12), i;
    for (i = 0; i < 26; i++) (function () {
      var c = [(r() * 2 - 1) * 2.2, (r() * 2 - 1) * 1.5, (r() * 2 - 1) * 1.2];
      var a = r() * 6.283, b = (r() - 0.5) * 1.6, g = (r() - 0.5) * 1.4, W = 0.52, H = 0.72, k;
      var ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
      // the "right" and "up" directions of this sheet: roll g, then pitch b, then yaw a
      var ux = [ca * cg + sa * sb * sg, cb * sg, -sa * cg + ca * sb * sg];
      var uy = [-ca * sg + sa * sb * cg, cb * cg, sa * sg + ca * sb * cg];
      function P(u, v) { return [c[0] + ux[0] * u * W + uy[0] * v * H, c[1] + ux[1] * u * W + uy[1] * v * H, c[2] + ux[2] * u * W + uy[2] * v * H]; }
      s.quad(P(-0.5, -0.5), [ux[0] * W, ux[1] * W, ux[2] * W], [uy[0] * H, uy[1] * H, uy[2] * H], 0.5);
      s.curve([P(-0.5, -0.5), P(0.5, -0.5), P(0.5, 0.5), P(-0.5, 0.5), P(-0.5, -0.5)], 0.012, 0.9);
      for (k = 0; k < 5; k++) { var v = 0.32 - k * 0.14, len = 0.35 + r() * 0.45; s.curve([P(0.4, v), P(0.4 - len, v)], 0.014, 1.2); }
    })();
    return s.build(n);
  };

  /* ------------------------------ the answer: one clean contract ------------------------------ */
  Shapes.contract = function (n) {
    var r = rng(21), s = new Sampler(22), W = 1.7, H = 2.3, k, i, pts = [];
    s.quad([-W / 2, -H / 2, 0], [W, 0, 0], [0, H, 0], 0.22);                     // the paper, faint
    s.curve(rect(-W / 2, -H / 2, W / 2, H / 2), 0.02, 2.2);                      // the edge of the paper
    s.curve([[0.38, 0.9, 0], [-0.38, 0.9, 0]], 0.05, 1.5);                       // the title
    for (k = 0; k < 11; k++) {                                                   // lines of text, starting on the right
      var y = 0.66 - k * 0.125, len = (k % 4 === 3) ? 0.7 : 1.32 + (r() - 0.5) * 0.1;
      s.curve([[0.68, y, 0], [0.68 - len, y, 0]], 0.018, 1.5);
    }
    for (i = 0; i <= 40; i++) { var t = i / 40; pts.push([-0.7 + 0.62 * t, -0.93 + 0.09 * Math.sin(t * 14) * (1 - t * 0.5) + 0.05 * t, 0]); }
    s.curve(pts, 0.016, 3);                                                      // a signature
    ring(s, [0.45, -0.9, 0], 0.17, 0.02, 2);                                     // a seal
    return s.build(n);
  };

  /* ------------------------------ the valley (wadi): flowing ribbons, like the company mark ------------------------------ */
  Shapes.wave = function (n) {
    var s = new Sampler(31);
    [[0.95, 2.1, 0.0, -0.5], [0.7, 2.9, 1.3, -0.17], [0.8, 2.5, 2.6, 0.17], [0.55, 3.4, 4.0, 0.5]].forEach(function (b) {   // height, frequency, phase, depth
      var prev = null, i;
      for (i = 0; i <= 80; i++) {
        var x = -2.7 + 5.4 * i / 80, env = Math.pow(Math.max(0, Math.cos(x / 2.7 * Math.PI / 2)), 1.4);
        var p = [x, b[0] * env * Math.sin(b[1] * x + b[2]), b[3] - 0.14];
        if (prev) s.quad(prev, [p[0] - prev[0], p[1] - prev[1], 0], [0, 0, 0.28]);
        prev = p;
      }
    });
    return s.build(n);
  };

  /* ------------------------------ the workflow: four steps on one line, read right to left ------------------------------ */
  Shapes.STEPS = 4;
  Shapes.stepPoint = function (k) { return [2.55 - 1.7 * k, 0, 0]; };            // k = 0 (first step, on the right) ... 3
  Shapes.pipeline = function (n) {
    var s = new Sampler(41), k;
    s.curve([[2.55, 0, 0], [-2.55, 0, 0]], 0.02, 1.4);
    for (k = 0; k < Shapes.STEPS; k++) {
      var p = Shapes.stepPoint(k);
      s.ellipsoid(p, 0.2, 0.2, 0.2, 1.2); ring(s, p, 0.3, 0.012, 1.5);
      if (k < Shapes.STEPS - 1) { var m = p[0] - 0.85; s.curve([[m + 0.1, 0.12, 0], [m - 0.06, 0, 0], [m + 0.1, -0.12, 0]], 0.02, 1.6); }   // arrow to the next step
    }
    return s.build(n);
  };

  /* ------------------------------ the architecture: three layers ------------------------------ */
  Shapes.LAYER_Y = [0.85, 0, -0.85];
  Shapes.layerPoint = function (k) { return [1.2, Shapes.LAYER_Y[k], 0.75]; };   // front right corner of layer k
  Shapes.layers = function (n) {
    var s = new Sampler(51);
    Shapes.LAYER_Y.forEach(function (y) { s.box([0, y, 0], 2.4, 0.1, 1.5); });
    [-0.7, 0.7].forEach(function (x) { s.curve([[x, 0.85, 0], [x, -0.85, 0]], 0.02, 1.2); });
    return s.build(n);
  };

  /* ------------------------------ the demonstration: a monitor whose screen holds the screenshots ------------------------------ */
  Shapes.SCREEN = { w: 2.5, h: 1.4 };                                            // half width, half height
  Shapes.monitor = function (n) {
    var s = new Sampler(61), w = Shapes.SCREEN.w, h = Shapes.SCREEN.h;
    s.curve(rect(-w, -h, w, h), 0.05, 1);
    s.curve([[0, -h, 0], [0, -h - 0.33, 0]], 0.08, 1);
    s.curve([[-0.75, -h - 0.33, 0], [0.75, -h - 0.33, 0]], 0.05, 1);
    s.dust([0, 0, -0.7], 3.6, 2.1, 0.5, 0.7);
    return s.build(n);
  };

  /* ------------------------------ the conclusion: an "approved" seal ------------------------------ */
  Shapes.seal = function (n) {
    var s = new Sampler(71);
    ring(s, [0, 0, 0], 1.25, 0.035, 2); ring(s, [0, 0, 0], 1.05, 0.015, 1.2);
    s.curve([[-0.55, 0.02, 0], [-0.15, -0.42, 0], [0.62, 0.5, 0]], 0.1, 1.3);
    return s.build(n);
  };
})();
