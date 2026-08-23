/* ═══════════════════════════════════════════════════════════════
   Two-tone geometric icon set — extracted from
   baltaro-app/icons2/Icon Set.dc.html so the same glyphs can render
   in plain React outside the Design Canvas runtime. Every glyph is
   tinted via the CSS custom properties --icon-primary / --icon-accent,
   which this module sets inline per-icon — so an icon dropped into a
   themed flavour just inherits that flavour's colors automatically.
   ═══════════════════════════════════════════════════════════════ */
import React from "react";

/* ---------- 1 · Model / Architecture ---------- */
const mlp = `<g stroke="var(--icon-primary)" stroke-width="2" fill="none"><line x1="14" y1="14" x2="32" y2="14"/><line x1="14" y1="14" x2="32" y2="32"/><line x1="14" y1="14" x2="32" y2="50"/><line x1="14" y1="32" x2="32" y2="14"/><line x1="14" y1="32" x2="32" y2="32"/><line x1="14" y1="32" x2="32" y2="50"/><line x1="14" y1="50" x2="32" y2="14"/><line x1="14" y1="50" x2="32" y2="32"/><line x1="14" y1="50" x2="32" y2="50"/><line x1="32" y1="14" x2="50" y2="32"/><line x1="32" y1="32" x2="50" y2="32"/><line x1="32" y1="50" x2="50" y2="32"/></g><g fill="var(--icon-primary)"><circle cx="14" cy="14" r="4"/><circle cx="14" cy="32" r="4"/><circle cx="14" cy="50" r="4"/><circle cx="32" cy="14" r="4"/><circle cx="32" cy="32" r="4"/><circle cx="32" cy="50" r="4"/><circle cx="50" cy="32" r="5" fill="var(--icon-accent)"/></g>`;
const cnn = `<g fill="none" stroke="var(--icon-primary)" stroke-width="2"><rect x="10" y="24" width="34" height="24"/><rect x="16" y="18" width="34" height="24"/><rect x="22" y="12" width="34" height="24"/></g><rect x="26" y="18" width="8" height="8" fill="var(--icon-accent)"/>`;
const cnn1d = `<polyline points="8,32 16,32 20,16 26,48 32,20 38,44 44,28 50,32 56,32" fill="none" stroke="var(--icon-primary)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><rect x="22" y="10" width="14" height="44" fill="var(--icon-accent)" opacity=".35"/>`;
const rnn = `<rect x="16" y="24" width="28" height="20" rx="6" fill="none" stroke="var(--icon-primary)" stroke-width="2.5"/><path d="M44 30 C58 30 58 46 44 46" fill="none" stroke="var(--icon-accent)" stroke-width="2.5"/><polygon points="44,46 40,42 40,48" fill="var(--icon-accent)"/>`;
const transformer = `<g fill="var(--icon-primary)"><rect x="8" y="28" width="10" height="10"/><rect x="27" y="28" width="10" height="10"/><rect x="46" y="28" width="10" height="10"/><rect x="27" y="10" width="10" height="10"/><rect x="27" y="46" width="10" height="10"/></g><g stroke="var(--icon-accent)" stroke-width="1.5"><line x1="13" y1="33" x2="46" y2="33"/><line x1="13" y1="33" x2="32" y2="15"/><line x1="13" y1="33" x2="32" y2="51"/><line x1="51" y1="33" x2="32" y2="15"/><line x1="51" y1="33" x2="32" y2="51"/></g>`;
const gnn = `<g stroke="var(--icon-accent)" stroke-width="1.5"><line x1="18" y1="16" x2="12" y2="36"/><line x1="18" y1="16" x2="40" y2="12"/><line x1="40" y1="12" x2="52" y2="30"/><line x1="12" y1="36" x2="30" y2="50"/><line x1="30" y1="50" x2="52" y2="30"/><line x1="12" y1="36" x2="52" y2="30"/></g><g fill="var(--icon-primary)"><circle cx="18" cy="16" r="5"/><circle cx="40" cy="12" r="5"/><circle cx="52" cy="30" r="5"/><circle cx="12" cy="36" r="5"/><circle cx="30" cy="50" r="5"/></g>`;
const unet = `<g fill="none" stroke="var(--icon-primary)" stroke-width="2.5"><path d="M12 10 L12 32 L32 46 L52 32 L52 10"/></g><g fill="var(--icon-accent)"><rect x="8" y="6" width="8" height="8"/><rect x="48" y="6" width="8" height="8"/><rect x="28" y="42" width="8" height="8"/></g><line x1="14" y1="14" x2="50" y2="14" stroke="var(--icon-accent)" stroke-width="2"/>`;
const cnn3d = `<g fill="none" stroke="var(--icon-primary)" stroke-width="2"><polygon points="14,20 34,12 50,20 30,28"/><polygon points="14,20 14,42 30,50 30,28"/><polygon points="30,28 30,50 50,42 50,20"/></g><polygon points="34,24 42,20 46,22 38,26" fill="var(--icon-accent)"/>`;

/* ---------- 2 · Compute / GPU ---------- */
const cpu = `<rect x="14" y="16" width="36" height="24" rx="2" fill="none" stroke="var(--icon-primary)" stroke-width="2"/><rect x="8" y="42" width="48" height="6" rx="2" fill="var(--icon-primary)"/><rect x="26" y="22" width="12" height="12" fill="var(--icon-accent)"/>`;
const gpu1 = `<rect x="8" y="22" width="48" height="20" rx="3" fill="none" stroke="var(--icon-primary)" stroke-width="2"/><circle cx="22" cy="32" r="6" fill="none" stroke="var(--icon-accent)" stroke-width="2"/><circle cx="42" cy="32" r="6" fill="none" stroke="var(--icon-accent)" stroke-width="2"/>`;
const gpu_multi = `<g fill="none" stroke="var(--icon-primary)" stroke-width="2"><rect x="6" y="14" width="52" height="11" rx="2"/><rect x="6" y="27" width="52" height="11" rx="2"/><rect x="6" y="40" width="52" height="11" rx="2"/></g><g fill="var(--icon-accent)"><circle cx="16" cy="19.5" r="3"/><circle cx="16" cy="32.5" r="3"/><circle cx="16" cy="45.5" r="3"/></g>`;
const datacenter = `<rect x="18" y="6" width="28" height="52" rx="2" fill="none" stroke="var(--icon-primary)" stroke-width="2.5"/><g stroke="var(--icon-primary)" stroke-width="1.5"><line x1="18" y1="18" x2="46" y2="18"/><line x1="18" y1="28" x2="46" y2="28"/><line x1="18" y1="38" x2="46" y2="38"/><line x1="18" y1="48" x2="46" y2="48"/></g><g fill="var(--icon-accent)"><circle cx="24" cy="13" r="1.8"/><circle cx="24" cy="23" r="1.8"/><circle cx="24" cy="33" r="1.8"/><circle cx="24" cy="43" r="1.8"/><circle cx="24" cy="53" r="1.8"/></g><g stroke="var(--icon-accent)" stroke-width="2"><line x1="50" y1="10" x2="56" y2="4"/><line x1="50" y1="20" x2="56" y2="14"/></g>`;

/* ---------- 3 · Activation ---------- */
const relu = `<path d="M10 10 L10 54 L54 54" fill="none" stroke="var(--icon-accent)" stroke-width="1.5"/><path d="M10 44 L32 44 L50 14" fill="none" stroke="var(--icon-primary)" stroke-width="2.5" stroke-linecap="round"/>`;
const gelu = `<path d="M10 10 L10 54 L54 54" fill="none" stroke="var(--icon-accent)" stroke-width="1.5"/><path d="M10 40 C22 48 26 46 32 40 C40 30 44 14 52 12" fill="none" stroke="var(--icon-primary)" stroke-width="2.5" stroke-linecap="round"/>`;
const sigmoid = `<path d="M10 10 L10 54 L54 54" fill="none" stroke="var(--icon-accent)" stroke-width="1.5"/><path d="M12 46 C22 46 24 32 32 32 C40 32 42 18 52 18" fill="none" stroke="var(--icon-primary)" stroke-width="2.5" stroke-linecap="round"/>`;
const tanh = `<path d="M10 10 L10 54 L54 54" fill="none" stroke="var(--icon-accent)" stroke-width="1.5"/><line x1="32" y1="14" x2="32" y2="50" stroke="var(--icon-accent)" stroke-width="1"/><path d="M14 44 C22 44 26 32 32 32 C38 32 42 20 50 20" fill="none" stroke="var(--icon-primary)" stroke-width="2.5" stroke-linecap="round"/>`;

/* ---------- 4 · Loss functions ---------- */
const xent = `<g fill="none" stroke="var(--icon-primary)" stroke-width="2"><circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="13"/><circle cx="32" cy="32" r="5"/></g><line x1="52" y1="12" x2="34" y2="30" stroke="var(--icon-accent)" stroke-width="2.5"/><polygon points="34,30 38,24 42,28" fill="var(--icon-accent)"/>`;
const mse = `<path d="M10 14 C10 44 54 44 54 14" fill="none" stroke="var(--icon-primary)" stroke-width="2.5"/><g stroke="var(--icon-accent)" stroke-width="1.5"><line x1="20" y1="32" x2="20" y2="21"/><line x1="44" y1="32" x2="44" y2="21"/></g><circle cx="20" cy="32" r="3" fill="var(--icon-accent)"/><circle cx="44" cy="32" r="3" fill="var(--icon-accent)"/>`;
const contrastive = `<circle cx="16" cy="24" r="4" fill="var(--icon-primary)"/><circle cx="24" cy="24" r="4" fill="var(--icon-primary)"/><path d="M12 32 L28 32" stroke="var(--icon-accent)" stroke-width="1.5"/><circle cx="14" cy="46" r="4" fill="var(--icon-primary)"/><circle cx="50" cy="46" r="4" fill="var(--icon-primary)"/><line x1="22" y1="46" x2="42" y2="46" stroke="var(--icon-accent)" stroke-width="2"/><polygon points="42,46 37,42 37,50" fill="var(--icon-accent)"/><polygon points="22,46 27,42 27,50" fill="var(--icon-accent)"/>`;
const focal = `<g fill="none" stroke="var(--icon-primary)" stroke-width="2"><circle cx="26" cy="26" r="12"/><circle cx="26" cy="26" r="6"/></g><line x1="35" y1="35" x2="50" y2="50" stroke="var(--icon-accent)" stroke-width="3" stroke-linecap="round"/>`;

/* ---------- 5 · Helper / Bonus ---------- */
const aiscientist = `<rect x="18" y="22" width="28" height="24" rx="4" fill="none" stroke="var(--icon-primary)" stroke-width="2.5"/><line x1="32" y1="22" x2="32" y2="12" stroke="var(--icon-primary)" stroke-width="2"/><circle cx="32" cy="8" r="4" fill="var(--icon-accent)"/><circle cx="26" cy="34" r="3" fill="var(--icon-primary)"/><circle cx="38" cy="34" r="3" fill="var(--icon-primary)"/>`;
const gradstudent = `<rect x="18" y="30" width="20" height="16" fill="none" stroke="var(--icon-primary)" stroke-width="2"/><circle cx="28" cy="18" r="7" fill="none" stroke="var(--icon-primary)" stroke-width="2"/><polygon points="20,12 36,12 28,6" fill="var(--icon-accent)"/><rect x="42" y="34" width="9" height="10" rx="2" fill="var(--icon-accent)"/>`;
const dataaug = `<rect x="8" y="20" width="16" height="16" fill="none" stroke="var(--icon-primary)" stroke-width="2"/><rect x="30" y="14" width="16" height="16" fill="none" stroke="var(--icon-accent)" stroke-width="2"/><rect x="30" y="34" width="16" height="16" fill="none" stroke="var(--icon-accent)" stroke-width="2" transform="rotate(180 38 42)"/>`;
const dropout = `<g fill="var(--icon-primary)"><circle cx="16" cy="16" r="4"/><circle cx="32" cy="16" r="4"/><circle cx="48" cy="16" r="4"/><circle cx="16" cy="32" r="4"/><circle cx="16" cy="48" r="4"/><circle cx="48" cy="48" r="4"/></g><g fill="none" stroke="var(--icon-accent)" stroke-width="2"><circle cx="32" cy="32" r="4"/><line x1="29" y1="29" x2="35" y2="35"/><line x1="29" y1="35" x2="35" y2="29"/><circle cx="48" cy="32" r="4"/><line x1="45" y1="29" x2="51" y2="35"/><line x1="45" y1="35" x2="51" y2="29"/><circle cx="32" cy="48" r="4"/><line x1="29" y1="45" x2="35" y2="51"/><line x1="29" y1="51" x2="35" y2="45"/></g>`;
const earlystop = `<path d="M8 16 C20 18 26 30 32 40 C36 46 44 48 52 44" fill="none" stroke="var(--icon-primary)" stroke-width="2.5" stroke-linecap="round"/><line x1="32" y1="30" x2="32" y2="50" stroke="var(--icon-accent)" stroke-width="3" stroke-linecap="round"/>`;
const norm = `<path d="M10 44 C18 44 22 16 32 16 C42 16 46 44 54 44" fill="none" stroke="var(--icon-primary)" stroke-width="2.5"/><line x1="8" y1="48" x2="56" y2="48" stroke="var(--icon-accent)" stroke-width="1.5"/><g stroke="var(--icon-accent)" stroke-width="2"><line x1="20" y1="54" x2="44" y2="54"/><line x1="26" y1="58" x2="20" y2="54"/><line x1="38" y1="58" x2="44" y2="54"/></g>`;
const ensemble = `<g fill="none" stroke="var(--icon-primary)" stroke-width="2"><rect x="6" y="10" width="14" height="10"/><rect x="25" y="10" width="14" height="10"/><rect x="44" y="10" width="14" height="10"/></g><rect x="22" y="40" width="20" height="14" fill="none" stroke="var(--icon-accent)" stroke-width="2.5"/><g stroke="var(--icon-accent)" stroke-width="1.5"><line x1="13" y1="20" x2="28" y2="40"/><line x1="32" y1="20" x2="32" y2="40"/><line x1="51" y1="20" x2="36" y2="40"/></g>`;

/* ---------- 6 · Problem / level icons ---------- */
const higgs = `<circle cx="32" cy="32" r="3" fill="var(--icon-primary)"/><g stroke="var(--icon-accent)" stroke-width="2" fill="none" stroke-linecap="round"><path d="M32 32 Q44 20 52 14"/><path d="M32 32 Q44 44 50 52"/><path d="M32 32 Q20 20 12 12"/><path d="M32 32 Q20 44 14 52"/><path d="M32 32 Q10 32 4 32"/><path d="M32 32 Q54 32 60 32"/></g>`;
const molecular = `<polygon points="32,10 46,18 46,34 32,42 18,34 18,18" fill="none" stroke="var(--icon-primary)" stroke-width="2.5"/><circle cx="12" cy="46" r="5" fill="var(--icon-accent)"/><line x1="18" y1="34" x2="14" y2="43" stroke="var(--icon-accent)" stroke-width="2"/><circle cx="50" cy="46" r="5" fill="var(--icon-accent)"/><line x1="46" y1="34" x2="48" y2="43" stroke="var(--icon-accent)" stroke-width="2"/>`;
const exoplanet = `<circle cx="26" cy="26" r="14" fill="var(--icon-primary)"/><circle cx="46" cy="34" r="5" fill="var(--icon-accent)"/><path d="M10 50 L20 48 L30 50 L40 46 L54 50" fill="none" stroke="var(--icon-accent)" stroke-width="1.5"/>`;
const climate = `<path d="M10 40 A22 22 0 0 1 54 40" fill="none" stroke="var(--icon-primary)" stroke-width="2.5"/><path d="M24 26 A8 8 0 1 1 20 40" fill="none" stroke="var(--icon-accent)" stroke-width="2.5" stroke-linecap="round"/><line x1="10" y1="48" x2="54" y2="48" stroke="var(--icon-primary)" stroke-width="1.2"/>`;
const genomics = `<path d="M16 10 Q32 22 16 34 Q32 46 16 58" fill="none" stroke="var(--icon-primary)" stroke-width="2"/><path d="M34 10 Q18 22 34 34 Q18 46 34 58" fill="none" stroke="var(--icon-primary)" stroke-width="2"/><g stroke="var(--icon-accent)" stroke-width="1.5"><line x1="17" y1="14" x2="33" y2="14"/><line x1="17" y1="34" x2="33" y2="34"/><line x1="17" y1="54" x2="33" y2="54"/></g><g fill="none" stroke="var(--icon-accent)" stroke-width="1.5"><rect x="44" y="14" width="4" height="4"/><rect x="50" y="14" width="4" height="4"/><rect x="44" y="20" width="4" height="4"/><rect x="50" y="20" width="4" height="4"/></g>`;
const gravwave = `<g fill="none" stroke="var(--icon-accent)" stroke-width="1.5"><circle cx="32" cy="32" r="10"/><circle cx="32" cy="32" r="18"/><circle cx="32" cy="32" r="26"/></g><circle cx="24" cy="24" r="6" fill="var(--icon-primary)"/><circle cx="40" cy="40" r="6" fill="var(--icon-primary)"/>`;
const jet = `<polygon points="14,32 54,18 54,46" fill="none" stroke="var(--icon-primary)" stroke-width="2.5"/><g stroke="var(--icon-accent)" stroke-width="1.5"><line x1="18" y1="30" x2="48" y2="22"/><line x1="18" y1="32" x2="50" y2="32"/><line x1="18" y1="34" x2="48" y2="42"/></g>`;
const neutrino = `<circle cx="32" cy="32" r="22" fill="none" stroke="var(--icon-primary)" stroke-width="2" stroke-dasharray="3 4"/><line x1="12" y1="16" x2="48" y2="48" stroke="var(--icon-accent)" stroke-width="3" stroke-linecap="round"/>`;
const cosmology = `<g fill="var(--icon-primary)"><circle cx="14" cy="16" r="3"/><circle cx="34" cy="10" r="3"/><circle cx="52" cy="20" r="3"/><circle cx="20" cy="38" r="3"/><circle cx="42" cy="34" r="3"/><circle cx="12" cy="52" r="3"/><circle cx="48" cy="50" r="3"/></g><g stroke="var(--icon-accent)" stroke-width="1.2"><line x1="14" y1="16" x2="34" y2="10"/><line x1="34" y1="10" x2="52" y2="20"/><line x1="14" y1="16" x2="20" y2="38"/><line x1="20" y1="38" x2="42" y2="34"/><line x1="42" y1="34" x2="52" y2="20"/><line x1="20" y1="38" x2="12" y2="52"/><line x1="42" y1="34" x2="48" y2="50"/></g>`;
const protein = `<path d="M10 14 Q24 24 14 32 Q4 40 18 48 Q30 54 40 46 Q52 38 44 28 Q36 18 48 12" fill="none" stroke="var(--icon-primary)" stroke-width="2.5" stroke-linecap="round"/><g fill="var(--icon-accent)"><circle cx="10" cy="14" r="3.5"/><circle cx="14" cy="32" r="3.5"/><circle cx="18" cy="48" r="3.5"/><circle cx="40" cy="46" r="3.5"/><circle cx="44" cy="28" r="3.5"/><circle cx="48" cy="12" r="3.5"/></g>`;

/* ---------- 7 · UI extras ---------- */
const deckback = `<rect x="10" y="6" width="44" height="52" rx="4" fill="none" stroke="var(--icon-primary)" stroke-width="2"/><path d="M32 18 L22 34 L30 34 L26 46 L44 28 L34 28 Z" fill="var(--icon-accent)"/>`;
const frame_common = `<rect x="14" y="14" width="36" height="36" fill="none" stroke="var(--icon-primary)" stroke-width="1.5" opacity=".4"/><path d="M14 22 L14 14 L22 14" fill="none" stroke="var(--icon-accent)" stroke-width="3" stroke-linecap="round"/><path d="M50 42 L50 50 L42 50" fill="none" stroke="var(--icon-accent)" stroke-width="3" stroke-linecap="round"/>`;
const frame_legendary = `<rect x="14" y="14" width="36" height="36" fill="none" stroke="var(--icon-primary)" stroke-width="1.5" opacity=".4"/><g stroke="var(--icon-accent)" stroke-width="3" fill="none" stroke-linecap="round"><path d="M14 24 L14 14 L24 14"/><path d="M50 40 L50 50 L40 50"/><path d="M50 24 L50 14 L40 14"/><path d="M14 40 L14 50 L24 50"/></g>`;
const losscurve = `<line x1="10" y1="50" x2="54" y2="50" stroke="var(--icon-accent)" stroke-width="1" opacity=".5"/><path d="M10 16 C20 30 28 44 40 46 C48 47.5 52 46 54 45" fill="none" stroke="var(--icon-primary)" stroke-width="2.5" stroke-linecap="round"/>`;

export const ICON2_DEFS = {
  mlp, cnn, cnn1d, rnn, transformer, gnn, unet, cnn3d,
  cpu, gpu1, gpu_multi, datacenter,
  relu, gelu, sigmoid, tanh,
  xent, mse, contrastive, focal,
  aiscientist, gradstudent, dataaug, dropout, earlystop, norm, ensemble,
  higgs, molecular, exoplanet, climate, genomics, gravwave, jet, neutrino, cosmology, protein,
  deckback, frame_common, frame_legendary, losscurve,
};

/* ---------- React component ----------
   primary/accent default to currentColor so an icon dropped in without
   explicit colors still reads fine; pass a flavour's colors to tint it. */
export function Icon2({ id, size = 28, primary, accent, className, style, title }) {
  const inner = ICON2_DEFS[id];
  if (!inner) return null;
  return React.createElement("svg", {
    viewBox: "0 0 64 64", width: size, height: size, className,
    role: title ? "img" : undefined,
    "aria-label": title,
    style: {
      display: "block",
      "--icon-primary": primary || "currentColor",
      "--icon-accent": accent || primary || "currentColor",
      ...style,
    },
    dangerouslySetInnerHTML: { __html: inner },
  });
}
