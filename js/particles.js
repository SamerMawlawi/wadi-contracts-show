/* particles.js — the living background: one WebGL point cloud, no libraries.
 *
 * HOW IT WORKS
 *   Every dot has a "from" and a "to" position. The cloud keeps a list of shapes in the
 *   order the show uses them (the sequence). One number, state.shape, says where we are:
 *   2.35 means "35% of the way from shape 2 to shape 3". The timeline only ever tweens
 *   that number, so Back and jumping are always correct.
 *
 * CAMERA MATHS (use Cloud.project() to pin labels to dots)
 *   The stage is 1920x1080. A model point p (unit-ish coordinates, y up) is:
 *     1. rotated:  p' = Rz(roll) * Rx(tilt) * Ry(yaw) * p
 *     2. scaled:   p' = p' * state.scale
 *     3. projected with a camera on the +z axis at CAM_Z looking at the origin:
 *          zv = CAM_Z - p'.z
 *          X  = 960 + state.x + p'.x * F * 540 / zv
 *          Y  = 540 + state.y - p'.y * F * 540 / zv        (stage pixels, y down)
 *   F = 1 / tan(fov/2) with fov = 40 degrees  ->  F ~ 2.747, CAM_Z = 6.
 *   So a shape of radius 1 at scale 1 is about 247 px in radius on the stage.
 *   state.x / state.y slide the whole picture in stage pixels (no perspective change).
 *   Cloud.project() assumes lock = 1 and sway = 0 (yaw is then exactly state.yaw), so only
 *   show pinned labels while the cloud is locked and still, with noise, wave and burst near 0.
 */
(function () {
  'use strict';

  var CAM_Z = 6, FOV = 40 * Math.PI / 180, F = 1 / Math.tan(FOV / 2);

  /* ---------- seeded random, so every copy of the show draws the same dots ---------- */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Sampler: scatter dots over surfaces in proportion to their area ---------- */
  function Sampler(seed) { this.parts = []; this.r = rng(seed || 1); }
  Sampler.prototype.add = function (area, fn) { this.parts.push({ area: area, fn: fn }); return this; };

  // flat parallelogram: origin o, edges a and b
  Sampler.prototype.quad = function (o, a, b, weight) {
    var cx = a[1] * b[2] - a[2] * b[1], cy = a[2] * b[0] - a[0] * b[2], cz = a[0] * b[1] - a[1] * b[0];
    var area = Math.sqrt(cx * cx + cy * cy + cz * cz) * (weight || 1);
    return this.add(area, function (r) {
      var u = r(), v = r();
      return [o[0] + a[0] * u + b[0] * v, o[1] + a[1] * u + b[1] * v, o[2] + a[2] * u + b[2] * v];
    });
  };
  // box centred on c with size w,h,d
  Sampler.prototype.box = function (c, w, h, d, weight) {
    var x = c[0] - w / 2, y = c[1] - h / 2, z = c[2] - d / 2;
    this.quad([x, y, z], [w, 0, 0], [0, h, 0], weight); this.quad([x, y, z + d], [w, 0, 0], [0, h, 0], weight);
    this.quad([x, y, z], [0, 0, d], [0, h, 0], weight); this.quad([x + w, y, z], [0, 0, d], [0, h, 0], weight);
    this.quad([x, y, z], [w, 0, 0], [0, 0, d], weight); this.quad([x, y + h, z], [w, 0, 0], [0, 0, d], weight);
    return this;
  };
  // ellipsoid surface
  Sampler.prototype.ellipsoid = function (c, rx, ry, rz, weight) {
    var p = 1.6075;
    var area = 4 * Math.PI * Math.pow((Math.pow(rx * ry, p) + Math.pow(rx * rz, p) + Math.pow(ry * rz, p)) / 3, 1 / p);
    return this.add(area * (weight || 1), function (r) {
      var u = r() * 2 - 1, t = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      return [c[0] + rx * s * Math.cos(t), c[1] + ry * u, c[2] + rz * s * Math.sin(t)];
    });
  };
  // flat disc in the plane whose normal is the given axis ('x' | 'y' | 'z')
  Sampler.prototype.disc = function (c, radius, axis, weight) {
    return this.add(Math.PI * radius * radius * (weight || 1), function (r) {
      var q = Math.sqrt(r()) * radius, t = r() * Math.PI * 2, a = q * Math.cos(t), b = q * Math.sin(t);
      if (axis === 'x') return [c[0], c[1] + a, c[2] + b];
      if (axis === 'z') return [c[0] + a, c[1] + b, c[2]];
      return [c[0] + a, c[1], c[2] + b];
    });
  };
  // surface of revolution around the y axis; profile = [[radius, y], ...]
  Sampler.prototype.revolve = function (c, profile, weight) {
    var self = this;
    for (var i = 0; i < profile.length - 1; i++) (function (p0, p1) {
      var slant = Math.sqrt((p1[0] - p0[0]) * (p1[0] - p0[0]) + (p1[1] - p0[1]) * (p1[1] - p0[1]));
      var area = Math.PI * (p0[0] + p1[0]) * slant * (weight || 1);
      if (area <= 0) return;
      self.add(area, function (r) {
        // pick along the slant weighted by radius so dots stay even
        var k, tries = 0, rmax = Math.max(p0[0], p1[0]) || 1;
        do { k = r(); tries++; } while (tries < 8 && r() * rmax > p0[0] + (p1[0] - p0[0]) * k);
        var rad = p0[0] + (p1[0] - p0[0]) * k, y = p0[1] + (p1[1] - p0[1]) * k, t = r() * Math.PI * 2;
        return [c[0] + rad * Math.cos(t), c[1] + y, c[2] + rad * Math.sin(t)];
      });
    })(profile[i], profile[i + 1]);
    return this;
  };
  // cone or cylinder along y: bottom radius r0 at y0, top radius r1 at y1
  Sampler.prototype.cone = function (c, r0, y0, r1, y1, weight) { return this.revolve(c, [[r0, y0], [r1, y1]], weight); };
  // a line through points, drawn as a thin tube of dots
  Sampler.prototype.curve = function (pts, thickness, weight) {
    var self = this, th = thickness || 0.01;
    for (var i = 0; i < pts.length - 1; i++) (function (a, b) {
      var len = Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2) + Math.pow(b[2] - a[2], 2));
      self.add(len * Math.max(th, 0.02) * 6 * (weight || 1), function (r) {
        var k = r();
        return [a[0] + (b[0] - a[0]) * k + (r() - 0.5) * th, a[1] + (b[1] - a[1]) * k + (r() - 0.5) * th, a[2] + (b[2] - a[2]) * k + (r() - 0.5) * th];
      });
    })(pts[i], pts[i + 1]);
    return this;
  };
  // loose volume of dust inside an ellipsoid
  Sampler.prototype.dust = function (c, rx, ry, rz, weight) {
    return this.add((weight || 1), function (r) {
      var u = r() * 2 - 1, t = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), q = Math.cbrt(r());
      return [c[0] + rx * q * s * Math.cos(t), c[1] + ry * q * u, c[2] + rz * q * s * Math.sin(t)];
    });
  };
  // make n dots (returns Float32Array of x,y,z)
  Sampler.prototype.build = function (n) {
    var out = new Float32Array(n * 3), parts = this.parts, total = 0, i, j, r = this.r;
    for (i = 0; i < parts.length; i++) total += parts[i].area;
    for (i = 0; i < n; i++) {
      var pick = r() * total, acc = 0;
      for (j = 0; j < parts.length - 1; j++) { acc += parts[j].area; if (pick < acc) break; }
      var p = parts[j].fn(r);
      out[i * 3] = p[0]; out[i * 3 + 1] = p[1]; out[i * 3 + 2] = p[2];
    }
    return out;
  };

  /* ---------- Shapes: each returns the dots for one meaningful object ---------- */
  var Shapes = {
    Sampler: Sampler,
    // the quiet start: wide drifting dust
    drift: function (n) {
      return new Sampler(11).dust([0, 0, 0], 4.3, 2.6, 4.3).build(n);
    },
    // a presentation clicker throwing a beam of light (used by the Test page)
    clicker: function (n) {
      var s = new Sampler(23);
      s.box([0, -0.25, 0], 0.5, 1.5, 0.22, 1.2);                 // body
      s.ellipsoid([0, 0.5, 0], 0.25, 0.1, 0.11, 1.2);            // rounded nose
      s.disc([0, 0.1, 0.115], 0.14, 'z', 4);                     // big button
      s.disc([0, -0.3, 0.115], 0.08, 'z', 4);                    // small button
      s.disc([0, -0.55, 0.115], 0.08, 'z', 4);                   // small button
      s.cone([0, 0, 0], 0.02, 0.6, 0.75, 1.9, 0.35);             // the beam, opening upward
      s.disc([0, 1.9, 0], 0.75, 'y', 0.25);                      // where the beam lands
      var pts = s.build(n);
      for (var i = 0; i < n; i++) pts[i * 3 + 1] -= 0.55;        // centre it
      return pts;
    }
  };

  /* ---------- WebGL ---------- */
  var VERT = [
    'attribute vec3 aFrom; attribute vec3 aTo; attribute vec4 aSeed;',
    'uniform float uMorph, uSwirl, uTime, uScale, uNoise, uWave, uBurst, uSize, uOpacity, uPx, uAspect, uF, uCamZ;',
    'uniform vec2 uOffset; uniform mat3 uRot; uniform vec3 uColA, uColB;',
    'varying vec4 vCol;',
    'void main(){',
    '  float spread = 0.65;',
    '  float t = clamp(uMorph*(1.0+spread) - aSeed.x*spread, 0.0, 1.0);',   // each dot leaves at its own moment
    '  float e = t*t*(3.0-2.0*t);',
    '  vec3 p = mix(aFrom, aTo, e);',
    '  float d = sin(3.14159265*t);',                                        // 0 at rest, 1 mid-flight
    '  float ang = d*uSwirl*(0.5+aSeed.y)*1.5;',
    '  float c = cos(ang), s = sin(ang);',
    '  p = vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z);',                       // swirl in flight
    '  p += (aSeed.yzw - 0.5)*d*uSwirl*0.9;',
    '  p += uNoise*0.07*vec3(sin(uTime*0.7+aSeed.x*40.0), cos(uTime*0.6+aSeed.y*40.0), sin(uTime*0.5+aSeed.z*40.0));',
    '  p.y += uWave*0.12*sin(p.x*3.0 + uTime*1.3);',
    '  p += normalize(p + vec3(0.0001))*uBurst*(0.5+aSeed.w*1.5);',
    '  p = uRot*p*uScale;',
    '  float zv = uCamZ - p.z;',
    '  if (zv < 0.3) { gl_Position = vec4(3.0,3.0,0.0,1.0); gl_PointSize = 0.0; vCol = vec4(0.0); return; }',
    '  vec2 ndc = vec2(p.x*uF/uAspect, p.y*uF)/zv + uOffset;',
    '  gl_Position = vec4(ndc, 0.0, 1.0);',
    '  float ps = uSize*uPx*(0.55+aSeed.z*0.9)*(uCamZ/zv);',
    '  gl_PointSize = min(ps, 26.0*uPx);',
    '  float fade = clamp(1.1 - (zv-uCamZ)/max(uScale,0.01)*0.75, 0.2, 1.0) * clamp(8.0*uPx/max(ps,1.0), 0.15, 1.0);',
    '  vCol = vec4(mix(uColA, uColB, aSeed.w), uOpacity*fade);',
    '}'].join('\n');
  var FRAG = [
    'precision mediump float; varying vec4 vCol;',
    'void main(){',
    '  float d = length(gl_PointCoord - 0.5);',
    '  float a = smoothstep(0.5, 0.0, d); a *= a;',
    '  gl_FragColor = vec4(vCol.rgb*a*vCol.a, a*vCol.a);',
    '}'].join('\n');

  function hex(h) {
    h = h.replace('#', '');
    return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
  }

  function create(canvas, count) {
    var N = count;
    var state = {
      shape: 0,            // position in the shape sequence (see top of file)
      x: 0, y: 0,          // slide the cloud, in stage pixels
      scale: 1,
      tilt: 0, roll: 0,    // radians
      spin: 0.05,          // turns slowly by itself (radians per second)
      lock: 0, yaw: 0,     // lock = 1 stops the spin and holds the cloud at angle "yaw"
      sway: 0,             // gentle rocking
      opacity: 1, size: 3.2,
      noise: 1,            // breathing
      wave: 0, burst: 0,
      swirl: 1,            // how much dots swirl while morphing
      aR: 0.55, aG: 0.7, aB: 1.0, bR: 1.0, bG: 0.72, bB: 0.45   // two colours
    };
    var seq = [Shapes.drift(N)];
    var api = { state: state, count: N, Shapes: Shapes, ok: false, CAM_Z: CAM_Z, F: F };

    // add a shape to the end of the sequence; returns its number
    api.add = function (points) { seq.push(points); return seq.length - 1; };
    api.length = function () { return seq.length; };
    // colours for a tween:  tl.to(cloud.state, cloud.colors('#88aaff', '#ffb070'))
    api.colors = function (a, b) {
      var A = hex(a), Bc = hex(b || a);
      return { aR: A[0], aG: A[1], aB: A[2], bR: Bc[0], bG: Bc[1], bB: Bc[2] };
    };

    var spinAngle = 0, lastT = 0, yawNow = 0, tiltNow = 0, rot = new Float32Array(9);
    function updateRot(time, pure) {
      var two = Math.PI * 2;
      // when locked, glide to the nearest equivalent of state.yaw
      var target = state.yaw + Math.round((spinAngle - state.yaw) / two) * two;
      yawNow = spinAngle + (target - spinAngle) * state.lock + state.sway * 0.22 * Math.sin(time * 0.5);
      tiltNow = state.tilt + state.sway * 0.07 * Math.sin(time * 0.37);
      if (pure) { yawNow = state.yaw; tiltNow = state.tilt; }   // as if locked and still: depends on the dials only
      var cy = Math.cos(yawNow), sy = Math.sin(yawNow), cx = Math.cos(tiltNow), sx = Math.sin(tiltNow),
        cz = Math.cos(state.roll), sz = Math.sin(state.roll);
      // R = Rz * Rx * Ry, written column by column for WebGL
      var m00 = cy, m01 = 0, m02 = sy;
      var m10 = sx * sy, m11 = cx, m12 = -sx * cy;
      var m20 = -cx * sy, m21 = sx, m22 = cx * cy;
      rot[0] = cz * m00 - sz * m10; rot[3] = cz * m01 - sz * m11; rot[6] = cz * m02 - sz * m12;
      rot[1] = sz * m00 + cz * m10; rot[4] = sz * m01 + cz * m11; rot[7] = sz * m02 + cz * m12;
      rot[2] = m20; rot[5] = m21; rot[8] = m22;
    }
    // stage-pixel position of a model point, for pinning labels (see CAMERA MATHS)
    api.project = function (p) {
      updateRot(lastT, true);                            // from the dials only, so labels never depend on history
      var x =rot[0] * p[0] + rot[3] * p[1] + rot[6] * p[2];
      var y = rot[1] * p[0] + rot[4] * p[1] + rot[7] * p[2];
      var z = rot[2] * p[0] + rot[5] * p[1] + rot[8] * p[2];
      x *= state.scale; y *= state.scale; z *= state.scale;
      var zv = CAM_Z - z;
      updateRot(lastT);
      return { x: 960 + state.x + x * F * 540 / zv, y: 540 + state.y - y * F * 540 / zv, depth: zv };
    };

    var gl = null;
    try { gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' }); } catch (e) { }
    if (!gl) { api.render = function () { }; api.resize = function () { }; return api; }

    function shader(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    var U = {};
    ['uMorph', 'uSwirl', 'uTime', 'uScale', 'uNoise', 'uWave', 'uBurst', 'uSize', 'uOpacity', 'uPx', 'uAspect', 'uF', 'uCamZ', 'uOffset', 'uRot', 'uColA', 'uColB']
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    var r = rng(7), seeds = new Float32Array(N * 4);
    for (var i = 0; i < N * 4; i++) seeds[i] = r();
    function attrib(name, size, data, usage) {
      var buf = gl.createBuffer(), loc = gl.getAttribLocation(prog, name);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, usage);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      return buf;
    }
    attrib('aSeed', 4, seeds, gl.STATIC_DRAW);
    var bufFrom = attrib('aFrom', 3, seq[0], gl.DYNAMIC_DRAW);
    var bufTo = attrib('aTo', 3, seq[0], gl.DYNAMIC_DRAW);
    var loaded = -1;
    function loadPair(i) {
      if (i === loaded) return;
      loaded = i;
      gl.bindBuffer(gl.ARRAY_BUFFER, bufFrom); gl.bufferData(gl.ARRAY_BUFFER, seq[i], gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufTo); gl.bufferData(gl.ARRAY_BUFFER, seq[Math.min(i + 1, seq.length - 1)], gl.DYNAMIC_DRAW);
    }

    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.clearColor(0, 0, 0, 0);
    var pxScale = 1;
    api.resize = function (w, h) {
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h); pxScale = h / 1080;
    };
    api.render = function (time) {
      var dt = Math.min(0.1, Math.max(0, time - lastT)); lastT = time;
      spinAngle += state.spin * dt * (1 - state.lock);
      updateRot(time);
      var sh = Math.max(0, Math.min(seq.length - 1, state.shape));
      var i = Math.min(Math.floor(sh), seq.length - 1);
      loadPair(i);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (state.opacity <= 0.001) return;
      gl.uniform1f(U.uMorph, sh - i); gl.uniform1f(U.uSwirl, state.swirl); gl.uniform1f(U.uTime, time);
      gl.uniform1f(U.uScale, state.scale); gl.uniform1f(U.uNoise, state.noise); gl.uniform1f(U.uWave, state.wave);
      gl.uniform1f(U.uBurst, state.burst); gl.uniform1f(U.uSize, state.size); gl.uniform1f(U.uOpacity, state.opacity);
      gl.uniform1f(U.uPx, pxScale); gl.uniform1f(U.uAspect, 16 / 9); gl.uniform1f(U.uF, F); gl.uniform1f(U.uCamZ, CAM_Z);
      gl.uniform2f(U.uOffset, state.x / 960, -state.y / 540);
      gl.uniformMatrix3fv(U.uRot, false, rot);
      gl.uniform3f(U.uColA, state.aR, state.aG, state.aB); gl.uniform3f(U.uColB, state.bR, state.bG, state.bB);
      gl.drawArrays(gl.POINTS, 0, N);
    };
    api.ok = true;
    return api;
  }

  window.Cloud = { create: create, Shapes: Shapes, rng: rng };
})();
