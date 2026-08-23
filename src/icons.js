/* ═══════════════════════════════════════════════════════════════
   Low-poly SVG icon generator — extracted from
   baltaro-app/icons/Low-Poly Card Icons.dc.html so the same faceted
   sprites (one shading model, flat per-facet fill, no outlines) can
   be rendered as plain React components outside the design canvas.
   ═══════════════════════════════════════════════════════════════ */
import React from "react";

/* ---------- vector helpers ---------- */
const LN = (() => { const v = [-0.48, -0.55, 0.68], l = Math.hypot(...v); return v.map(x => x / l); })();
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function rng(s) { let a = (s * 2654435761) >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const cen = p => { let x = 0, y = 0; p.forEach(q => { x += q[0]; y += q[1]; }); return [x / p.length, y / p.length]; };

function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function shade(hex, br) {
  const c = hex2rgb(hex);
  const out = c.map(v => br <= 1 ? v * (0.3 + 0.7 * br) : v + (255 - v) * Math.min(1, (br - 1) * 0.85));
  return "#" + out.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

/* ---------- mesh builders : arrays of {t:[p,q,r]} with p=[x,y,z] ---------- */
function plate(poly, o = {}) {
  const rings = Math.max(1, o.rings ?? 2), depth = o.depth ?? 8, jit = o.jit ?? 1, r = rng(o.seed ?? 7), c = cen(poly);
  const rails = [];
  for (let i = 0; i < rings; i++) {
    const t = i / rings, s = 1 - t, z = depth * Math.sin(t * Math.PI / 2), k = (i === 0 ? 0.4 : 1) * jit;
    rails.push(poly.map(p => [c[0] + (p[0] - c[0]) * s + (r() * 2 - 1) * k, c[1] + (p[1] - c[1]) * s + (r() * 2 - 1) * k, z]));
  }
  const apex = [c[0] + (r() * 2 - 1) * jit * 0.6, c[1] + (r() * 2 - 1) * jit * 0.6, depth];
  const tris = [], n = poly.length;
  for (let i = 0; i < rails.length - 1; i++) {
    const a = rails[i], b = rails[i + 1];
    for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; tris.push([a[k], a[k2], b[k2]], [a[k], b[k2], b[k]]); }
  }
  const last = rails[rails.length - 1];
  for (let k = 0; k < n; k++) tris.push([last[k], last[(k + 1) % n], apex]);
  return tris.map(t => ({ t }));
}

function torus(o) {
  const { cx, cy, R, r, a0 = 0, a1 = Math.PI * 2, segs = 18, xs = 1, ys = 1 } = o;
  const depth = o.depth ?? r * 0.95, jit = o.jit ?? 0.7, rd = rng(o.seed ?? 3);
  const A = [], B = [], C = [];
  for (let i = 0; i <= segs; i++) {
    const a = a0 + (a1 - a0) * i / segs, ca = Math.cos(a), sa = Math.sin(a), j = () => (rd() * 2 - 1) * jit;
    A.push([cx + (R + r) * ca * xs + j(), cy + (R + r) * sa * ys + j(), 0]);
    B.push([cx + R * ca * xs + j() * 0.4, cy + R * sa * ys + j() * 0.4, depth]);
    C.push([cx + (R - r) * ca * xs + j(), cy + (R - r) * sa * ys + j(), 0]);
  }
  const tris = [];
  for (let i = 0; i < segs; i++) {
    tris.push([A[i], A[i + 1], B[i + 1]], [A[i], B[i + 1], B[i]]);
    tris.push([B[i], B[i + 1], C[i + 1]], [B[i], C[i + 1], C[i]]);
  }
  if (a1 - a0 < Math.PI * 1.99) { tris.push([A[0], B[0], C[0]], [A[segs], B[segs], C[segs]]); }
  return tris.map(t => ({ t }));
}

/* ---------- polygon primitives ---------- */
const circleP = (cx, cy, r, n = 10) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2 - Math.PI / 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
const rectP = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const rhombP = (cx, cy, w, h) => [[cx, cy - h], [cx + w, cy], [cx, cy + h], [cx - w, cy]];
const starP = (cx, cy, R, r, pts, rot = 0) => Array.from({ length: pts * 2 }, (_, i) => { const a = rot + i * Math.PI / pts - Math.PI / 2, rad = i % 2 ? r : R; return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; });
function roundRectP(x, y, w, h, r, s = 3) {
  const p = [], cs = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
  cs.forEach(([cx, cy, a0]) => { for (let i = 0; i <= s; i++) { const a = a0 + i / s * Math.PI / 2; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } });
  return p;
}
function lensP(cx, cy, w, h, n = 9) {
  const p = [], f = t => Math.pow(Math.sin(Math.PI * t), 0.8);
  for (let i = 0; i <= n; i++) { const t = i / n; p.push([cx - w + 2 * w * t, cy - h * f(t)]); }
  for (let i = n - 1; i > 0; i--) { const t = i / n; p.push([cx - w + 2 * w * t, cy + h * f(t)]); }
  return p;
}
function bellP(cx, cy, w, h, n = 14) {
  const p = [];
  for (let i = 0; i <= n; i++) { const t = -1 + 2 * i / n; p.push([cx + w * t, cy - h * Math.exp(-3.1 * t * t)]); }
  p.push([cx + w, cy + 5], [cx - w, cy + 5]);
  return p;
}

/* ---------- palette ---------- */
const G = { base: "#d5dfea", hi: "#f6f9fc", mid: "#8fa0b3", low: "#54626f", dark: "#3b4653" };

/* ---------- icon definitions ----------
   ids: vision, language, sequence, tabular (topic themes)
        dense, conv, pool, act, norm, skip, embed, recur, attn (layer types) */
function iconParts(id, D) {
  const d2 = D, d3 = D + 1;
  switch (id) {
    case "vision": return [
      { p: lensP(50, 50, 27, 17), c: "#0f766e", rings: d3, depth: 12, seed: 11 },
      { p: circleP(50, 50, 11.5, 10), c: "#14b8a6", rings: d2, depth: 13, seed: 12 },
      { p: circleP(50, 50, 4.6, 7), c: "#04302c", rings: 1, depth: 6, seed: 13 },
      { p: [[62, 34], [72, 28], [68, 39]], c: "#2dd4bf", rings: 1, depth: 4, seed: 14 }
    ];
    case "language": return [
      { p: roundRectP(23, 25, 54, 35, 9), c: "#b45309", rings: d3, depth: 11, seed: 21 },
      { p: [[39, 57], [55, 57], [41, 76]], c: "#8a3d07", rings: 1, depth: 7, seed: 22 },
      { p: circleP(37, 43, 4, 8), c: "#f59e0b", rings: 1, depth: 5, seed: 23 },
      { p: circleP(50, 43, 4, 8), c: "#f59e0b", rings: 1, depth: 5, seed: 24 },
      { p: circleP(63, 43, 4, 8), c: "#f59e0b", rings: 1, depth: 5, seed: 25 }
    ];
    case "sequence": return [
      { torus: { cx: 27, cy: 50, R: 11, r: 3.8, segs: 16, seed: 31 }, c: "#5b21b6" },
      { torus: { cx: 73, cy: 50, R: 11, r: 3.8, segs: 16, seed: 32 }, c: "#5b21b6" },
      { torus: { cx: 50, cy: 50, R: 12.5, r: 4, segs: 16, xs: 0.52, seed: 33 }, c: "#8b5cf6" }
    ];
    case "tabular": return [
      { p: rhombP(50, 68, 31, 13), c: "#334155", rings: d2, depth: 7, seed: 41 },
      { p: rhombP(50, 55, 31, 13), c: "#475569", rings: d2, depth: 7, seed: 42 },
      { p: rhombP(50, 42, 31, 13), c: "#64748b", rings: d2, depth: 7, seed: 43 },
      { line: [50, 29, 50, 55], w: 1.2, o: 0.35 },
      { line: [19, 42, 81, 42], w: 1.2, o: 0.35 }
    ];
    case "dense": {
      const ys = [28, 50, 72], parts = [];
      ys.forEach(y1 => ys.forEach(y2 => parts.push({ line: [26, y1, 74, y2], w: 1.1, o: 0.3 })));
      ys.forEach((y, i) => parts.push({ p: circleP(26, y, 7, 9), c: G.mid, rings: d2, depth: 8, seed: 51 + i }));
      ys.forEach((y, i) => parts.push({ p: circleP(74, y, 7, 9), c: G.base, rings: d2, depth: 8, seed: 55 + i }));
      return parts;
    }
    case "conv": {
      const parts = [], s = 13, g = 2, o = 19;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const hot = r < 3 && c < 3;
        parts.push({ p: rectP(o + c * (s + g), o + r * (s + g), s, s), c: hot ? G.hi : G.low, rings: 1, depth: hot ? 5 : 3.2, seed: 61 + r * 4 + c, jit: 0.5 });
      }
      parts.push({ frame: [17.5, 17.5, 46, 46], w: 1.7, o: 0.85 });
      return parts;
    }
    case "pool": {
      const parts = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) parts.push({ p: rectP(11 + c * 8, 34 + r * 8, 6.6, 6.6), c: G.mid, rings: 1, depth: 3, seed: 81 + r * 4 + c, jit: 0.4 });
      parts.push({ p: [[47, 42], [60, 50], [47, 58]], c: G.low, rings: 1, depth: 5, seed: 99 });
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) parts.push({ p: rectP(64 + c * 16, 35 + r * 16, 14, 14), c: G.base, rings: d2, depth: 6, seed: 101 + r * 2 + c, jit: 0.6 });
      return parts;
    }
    case "act": return [
      { p: starP(50, 50, 35, 8.5, 4, 0.38), c: G.hi, rings: 1, depth: 15, seed: 111 },
      { p: [[20, 74], [30, 70], [25, 80]], c: G.mid, rings: 1, depth: 4, seed: 112 },
      { p: [[72, 22], [82, 26], [78, 15]], c: G.mid, rings: 1, depth: 4, seed: 113 }
    ];
    case "norm": return [
      { p: bellP(50, 64, 29, 37), c: G.base, rings: d2, depth: 10, seed: 121 },
      { p: rectP(15, 63, 70, 8), c: G.low, rings: 1, depth: 4, seed: 122, jit: 0.5 }
    ];
    case "skip": return [
      { p: rectP(17, 60, 11, 22), c: G.low, rings: 1, depth: 5, seed: 131, jit: 0.5 },
      { p: rectP(72, 60, 11, 22), c: G.low, rings: 1, depth: 5, seed: 132, jit: 0.5 },
      { torus: { cx: 50, cy: 62, R: 28, r: 5.5, a0: Math.PI, a1: Math.PI * 2, segs: 14, seed: 133 }, c: G.base }
    ];
    case "embed": {
      const s = 17, cx = 30, cy = 44, parts = [
        { p: [[cx, cy - s * 0.92], [cx + s, cy - s * 0.36], [cx, cy + s * 0.2], [cx - s, cy - s * 0.36]], c: G.base, rings: 2, depth: 2, seed: 141, jit: 0.5, sh: 1.2 },
        { p: [[cx - s, cy - s * 0.36], [cx, cy + s * 0.2], [cx, cy + s * 1.02], [cx - s, cy + s * 0.46]], c: G.base, rings: 2, depth: 2, seed: 142, jit: 0.5, sh: 0.6 },
        { p: [[cx + s, cy - s * 0.36], [cx, cy + s * 0.2], [cx, cy + s * 1.02], [cx + s, cy + s * 0.46]], c: G.base, rings: 2, depth: 2, seed: 143, jit: 0.5, sh: 0.88 }
      ];
      [[54, 40, 6], [63, 48, 5], [71, 42, 4], [77, 52, 3.2]].forEach((v, i) => parts.push({ p: circleP(v[0], v[1], v[2], 5), c: G.mid, rings: 1, depth: 4, seed: 150 + i }));
      parts.push({ p: [[79, 60], [94, 68], [80, 74]], c: G.hi, rings: 1, depth: 6, seed: 160 });
      return parts;
    }
    case "recur": return [
      { torus: { cx: 50, cy: 53, R: 25, r: 6, a0: -Math.PI / 3, a1: Math.PI * 1.42, segs: 16, seed: 171 }, c: G.base },
      { p: [[57, 18], [78, 28], [56, 34]], c: G.hi, rings: 1, depth: 7, seed: 172 }
    ];
    case "attn": return [
      { p: starP(50, 50, 39, 11, 10, 0), c: G.mid, rings: 1, depth: 14, seed: 181 },
      { p: circleP(50, 50, 13, 10), c: G.hi, rings: d2, depth: 13, seed: 182 }
    ];
    default: return [];
  }
}

function partsToSvg(parts, D, J) {
  let out = "";
  parts.forEach(part => {
    if (part.line) {
      const [x1, y1, x2, y2] = part.line;
      out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7d8b9c" stroke-opacity="${part.o ?? 0.4}" stroke-width="${part.w ?? 1}"/>`;
      return;
    }
    if (part.frame) {
      const [x, y, w, h] = part.frame;
      out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#f6f9fc" stroke-opacity="${part.o ?? 0.8}" stroke-width="${part.w ?? 1.5}"/>`;
      return;
    }
    const tris = part.torus
      ? torus(Object.assign({}, part.torus, { jit: 0.55 * J }))
      : plate(part.p, { rings: part.rings ?? D, depth: part.depth ?? 8, jit: (part.jit ?? 1) * J, seed: part.seed });
    const r = rng((part.seed ?? 5) + 977);
    const shaded = tris.map(o => {
      const [p, q, s] = o.t;
      let br;
      if (part.sh != null) br = part.sh * (0.93 + 0.14 * r());
      else {
        let n = nrm(cross(sub(q, p), sub(s, p)));
        if (n[2] < 0) n = n.map(v => -v);
        br = 0.4 + 0.86 * Math.max(0, dot(n, LN));
      }
      const z = (p[2] + q[2] + s[2]) / 3, dep = part.depth ?? 8;
      br *= 0.9 + 0.1 * (dep ? Math.min(1, z / dep) : 1);
      return { z, br, pts: [p, q, s].map(v => `${v[0].toFixed(2)},${v[1].toFixed(2)}`).join(" ") };
    }).sort((a, b) => a.z - b.z);
    shaded.forEach(f => { out += `<polygon points="${f.pts}" fill="${shade(part.c, f.br)}"/>`; });
  });
  return out;
}

/* cache: same id+detail+jitter always makes the same sprite, no need to recompute per render */
const cache = new Map();
export function iconSvgInner(id, detail = 2, jitter = 1) {
  const key = id + "|" + detail + "|" + jitter;
  if (!cache.has(key)) cache.set(key, partsToSvg(iconParts(id, detail), detail, jitter));
  return cache.get(key);
}

/* map from the game's suit/type ids to the sprite ids available above */
export const SUIT_ICON = { V: "vision", L: "language", S: "sequence", T: "tabular" };
export const TYPE_ICON = {
  dense: "dense", conv: "conv", pool: "pool",
  relu: "act", sigmoid: "act", tanh: "act", gelu: "act",
  norm: "norm", skip: "skip", embed: "embed", recur: "recur",
  q: "attn", k: "attn", v: "attn", softmax: "attn",
};

/* ---------- React component ---------- */
export function Icon({ id, size = 28, className, title }) {
  const inner = iconSvgInner(id);
  return React.createElement("svg", {
    viewBox: "0 0 100 100", width: size, height: size, className,
    role: title ? "img" : undefined,
    "aria-label": title,
    dangerouslySetInnerHTML: { __html: inner },
  });
}
