import React, { useState, useEffect, useRef } from "react";
import { Icon, SUIT_ICON, TYPE_ICON } from "./src/icons.js";

/* ═══════════════════════════════════════════════════════════════
   GRADIENT DESCENT — a card game about how neural networks work
   Built for high-school / intro-undergrad level. Every score comes
   from a real, simple formula you can check with a calculator.
   ═══════════════════════════════════════════════════════════════ */

/* ---------- seeded RNG (same seed = same game) ---------- */
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lg2 = x => Math.log2(x);
const r2 = x => Math.round(x * 100) / 100;
const fmt = n => n >= 100000 ? (n / 1000).toFixed(0) + "k" : n.toLocaleString("en-US");

/* ---------- the four topics (card colors) ---------- */
const SUITS = {
  V: { id: "V", name: "Vision", plain: "images", sym: "◆", color: "#0f766e", bg: "#e0f0ee" },
  L: { id: "L", name: "Language", plain: "text", sym: "▲", color: "#b45309", bg: "#f7ead9" },
  S: { id: "S", name: "Sequence", plain: "things in order", sym: "●", color: "#6d28d9", bg: "#ece4f8" },
  T: { id: "T", name: "Tabular", plain: "tables of numbers", sym: "■", color: "#475569", bg: "#e6eaef" },
};
const SUIT_IDS = ["V", "L", "S", "T"];

/* ---------- card widths (how many neurons a layer has) ---------- */
const WIDTHS = [2, 4, 8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 512];
const wSig = w => Math.round(8 * lg2(w));  /* Signal = 8 × log₂(width) */

/* ---------- layer types ---------- */
const TYPES = {
  dense: { name: "Dense", glyph: "▦", cat: "layer", tip: "The basic layer: every input connects to every neuron. Output = W·x." },
  conv: { name: "Conv", glyph: "⊞", cat: "layer", tip: "Slides a small filter across an image to find edges and shapes." },
  pool: { name: "Pool", glyph: "▽", cat: "layer", tip: "Shrinks the picture by keeping only the strongest values." },
  relu: { name: "ReLU", glyph: "⌐", cat: "act", tip: "Activation: negatives become 0. Lets the network learn curves, not just lines." },
  sigmoid: { name: "Sigmoid", glyph: "∿", cat: "act", tip: "Activation: squashes any number into 0–1." },
  tanh: { name: "Tanh", glyph: "≈", cat: "act", tip: "Activation: squashes any number into −1 to 1." },
  gelu: { name: "GELU", glyph: "⌒", cat: "act", tip: "A smooth modern activation, used in transformers like GPT." },
  norm: { name: "Norm", glyph: "μσ", cat: "util", tip: "Re-centers the numbers (mean 0, spread 1). Keeps deep networks stable." },
  skip: { name: "Skip", glyph: "↷", cat: "util", tip: "A shortcut wire that adds the input back in. Lets networks go DEEP safely." },
  embed: { name: "Embed", glyph: "⇢", cat: "layer", tip: "Turns a word into a list of numbers (a vector)." },
  recur: { name: "Recurrent", glyph: "↺", cat: "layer", tip: "A layer with a loop: it remembers what it just saw." },
  gatef: { name: "Forget Gate", glyph: "⊗f", cat: "gate", tip: "LSTM part: decides what old memory to erase." },
  gatei: { name: "Input Gate", glyph: "⊕i", cat: "gate", tip: "LSTM part: decides what new info to store." },
  gateo: { name: "Output Gate", glyph: "⊙o", cat: "gate", tip: "LSTM part: decides what memory to reveal." },
  gatec: { name: "Cell Gate", glyph: "◍c", cat: "gate", tip: "LSTM part: proposes the new memory content." },
  q: { name: "Query", glyph: "Q", cat: "attn", tip: "Attention part: 'what am I looking for?'" },
  k: { name: "Key", glyph: "K", cat: "attn", tip: "Attention part: 'what do I contain?' Compared against Queries." },
  v: { name: "Value", glyph: "V", cat: "attn", tip: "Attention part: the actual info that gets mixed together." },
  softmax: { name: "Softmax", glyph: "Σ%", cat: "attn", tip: "Turns scores into percentages that add to 100%." },
  concat: { name: "Concat", glyph: "⧉", cat: "util", tip: "Glues several outputs side-by-side into one." },
};
const isAct = t => TYPES[t].cat === "act";

/* ---------- SVG-icon-or-glyph helpers (real sprites where we have one, unicode glyph otherwise) ---------- */
function LayerGlyph({ type, size = 20 }) {
  const iconId = TYPE_ICON[type];
  return iconId ? <Icon id={iconId} size={size} title={TYPES[type].name} /> : <>{TYPES[type].glyph}</>;
}
function SuitIcon({ suit, size = 16 }) {
  const iconId = SUIT_ICON[suit];
  return iconId ? <Icon id={iconId} size={size} title={SUITS[suit].name} /> : <>{SUITS[suit].sym}</>;
}

/* ---------- 8 eras of AI history ---------- */
const ERAS = [
  { theme: "1958 · Perceptron Days", suits: ["T"], blurb: "One layer. Straight lines only." },
  { theme: "1986 · Backprop Era", suits: ["T", "V"], blurb: "Multi-layer nets learn to learn." },
  { theme: "1998 · ConvNet Era", suits: ["V"], blurb: "Filters that see. Digits get read." },
  { theme: "1997 · Memory Era", suits: ["S"], blurb: "LSTMs remember the past." },
  { theme: "2012 · Deep Learning Boom", suits: ["V", "S"], blurb: "GPUs make depth possible." },
  { theme: "2014 · Embedding Era", suits: ["L", "S"], blurb: "Words become vectors." },
  { theme: "2017 · Attention Era", suits: ["L"], blurb: "Attention is all you need." },
  { theme: "2020 · Scaling Era", suits: ["L", "V", "S", "T"], blurb: "Bigger models, bigger data." },
];
const eraInfo = e => ERAS[Math.min(e - 1, 7)];
const eraBase = e => Math.round(150 * Math.pow(2, e - 1));
const eraData = e => Math.round(6000 * Math.pow(1.7, e - 1));
const ROUNDS = ["Training Round", "Validation Round", "Boss Benchmark"];

/* ---------- combos (architectures you can build) ---------- */
const PATTERNS = [
  { id: "transformer", name: "Transformer Block", sig: 200, gain: 14, need: 7, recipe: "Query → Key → Softmax → Value → Norm → Dense → Activation", why: "The architecture behind GPT and friends." },
  { id: "mha", name: "Multi-Head Attention", sig: 140, gain: 10, need: 6, recipe: "Two or more attention sets, ending in Concat", why: "Several attentions looking at different things at once." },
  { id: "attn", name: "Attention", sig: 100, gain: 8, need: 5, recipe: "Query → Key → Softmax → Value", why: "Every word looks at every other word and mixes what matters." },
  { id: "lstm", name: "LSTM Cell", sig: 100, gain: 8, need: 5, recipe: "Forget → Input → Output → Cell gates → Recurrent", why: "Four gates managing a memory." },
  { id: "recloop", name: "Recurrent Loop", sig: 60, gain: 5, need: 5, recipe: "Embed → Recurrent → Dense", why: "Read a sequence one step at a time." },
  { id: "bottleneck", name: "Bottleneck", sig: 50, gain: 4, need: 5, recipe: "Wide → Narrow → Wide (any 3 layers)", why: "Squeezing forces the network to keep only what matters." },
  { id: "residual", name: "Residual Block", sig: 40, gain: 4, need: 5, recipe: "Layer → Layer → Skip", why: "The shortcut trick that made 100-layer networks work." },
  { id: "normblock", name: "Norm Block", sig: 35, gain: 3, need: 5, recipe: "Layer → Norm → Activation", why: "Stabilized layers train much faster." },
  { id: "featext", name: "Feature Extractor", sig: 30, gain: 3, need: 5, recipe: "Conv → Activation → Pool", why: "The classic vision combo: see, decide, shrink." },
  { id: "mlp", name: "MLP", sig: 20, gain: 2, need: 5, recipe: "Dense → Activation", why: "The 'hello world' of neural networks." },
  { id: "linear", name: "Linear Stack", sig: 10, gain: 1, need: 5, recipe: "Only Dense layers", why: "No activation = it all collapses into ONE straight line. Weak on purpose." },
  { id: "single", name: "Single Layer", sig: 5, gain: 1, need: 5, recipe: "Anything else", why: "A lone layer. A start." },
];
const PAT = Object.fromEntries(PATTERNS.map(p => [p.id, p]));
const lvlSig = (p, lvl) => p.sig + (lvl - 1) * Math.ceil(p.sig * 0.5);
const lvlGain = (p, lvl) => p.gain + (lvl - 1) * Math.max(1, Math.ceil(p.gain * 0.35));

function matchPattern(stack) {
  const n = stack.length; if (!n) return null;
  const t = stack.map(c => c.type), w = stack.map(c => c.width);
  const seq = t.map(x => isAct(x) ? "act" : x);
  const eq = a => a.length === n && a.every((x, i) => x === seq[i]);
  if (eq(["q", "k", "softmax", "v", "norm", "dense", "act"])) return PAT.transformer;
  const attnCats = seq.filter(x => ["q", "k", "v", "softmax"].includes(x)).length;
  if (n >= 6 && seq[n - 1] === "concat" && attnCats >= 4) {
    const idx = ["q", "k", "softmax", "v"].map(x => seq.indexOf(x));
    if (idx.every(i => i >= 0) && idx[0] < idx[1] && idx[1] < idx[2] && idx[2] < idx[3]) return PAT.mha;
  }
  if (eq(["q", "k", "softmax", "v"])) return PAT.attn;
  if (n === 5 && ["gatef", "gatei", "gateo", "gatec"].every(x => seq.slice(0, 4).includes(x)) && seq[4] === "recur") return PAT.lstm;
  if (eq(["embed", "recur", "dense"])) return PAT.recloop;
  if (n === 3 && seq[2] === "skip" && seq[0] !== "skip" && seq[1] !== "skip") return PAT.residual;
  if (n === 3 && seq[1] === "norm" && seq[0] !== "norm" && seq[2] === "act") return PAT.normblock;
  if (eq(["conv", "act", "pool"])) return PAT.featext;
  if (n === 3 && w[0] > w[1] && w[2] > w[1]) return PAT.bottleneck;
  if (n === 2 && seq[0] === "dense" && seq[1] === "act") return PAT.mlp;
  if (n >= 2 && seq.every(x => x === "dense")) return PAT.linear;
  return PAT.single;
}

/* ---------- papers (permanent upgrades, all real) ---------- */
const PAPERS = [
  { id: "relu2011", name: "ReLU", yr: 2011, rar: 0, cost: 4, fx: "Every Activation card gives +6 extra Signal.", real: "Simple max(0,x) beat fancy functions and kicked off deep learning." },
  { id: "batchnorm2015", name: "Batch Norm", yr: 2015, rar: 0, cost: 4, fx: "If your network has a Norm card: +2 Gain.", real: "Normalizing between layers made training dramatically faster." },
  { id: "xavier2010", name: "Smart Init", yr: 2010, rar: 0, cost: 3, fx: "Your FIRST layer gives 1.5× Signal.", real: "Starting weights at the right size keeps signals from dying or blowing up." },
  { id: "adam2015", name: "Adam Optimizer", yr: 2015, rar: 0, cost: 5, fx: "Unused Training Runs carry over as +1 Gain each next round.", real: "The go-to training algorithm: it adapts its own step size." },
  { id: "momentum1986", name: "Momentum", yr: 1986, rar: 0, cost: 3, fx: "Play the SAME combo again: +3 Gain per repeat in a row.", real: "Keep rolling in the same direction and you speed up." },
  { id: "earlystop", name: "Early Stopping", yr: 1990, rar: 0, cost: 3, fx: "Clear a round with runs to spare: +4⚡ each.", real: "Stop training before the model starts memorizing." },
  { id: "weightdecay", name: "Weight Decay", yr: 1992, rar: 0, cost: 3, fx: "+0.1 Generalization on Validation & Boss rounds.", real: "Gently shrinking weights keeps models simple, and simple generalizes." },
  { id: "dataaug", name: "Data Augmentation", yr: 1998, rar: 0, cost: 3, fx: "−20% Signal, but +0.2 Generalization.", real: "Flip and crop your images = free extra data." },
  { id: "dropout2014", name: "Dropout", yr: 2014, rar: 0, cost: 4, fx: "One random layer is IGNORED each run, but +6 Gain and +0.15 Generalization.", real: "Randomly silencing neurons forces the rest to not over-rely on each other." },
  { id: "resnet2015", name: "ResNet", yr: 2015, rar: 1, cost: 6, fx: "Skip cards give 1.5× Gain, and depth never hurts you.", real: "Skip connections let 152-layer networks finally train." },
  { id: "attention2017", name: "Attention Is All You Need", yr: 2017, rar: 1, cost: 7, fx: "Query/Key/Value/Softmax cards give DOUBLE Signal.", real: "The transformer paper. You are using its descendants right now." },
  { id: "word2vec2013", name: "Word2Vec", yr: 2013, rar: 1, cost: 5, fx: "Embed cards give 3× Signal.", real: "king − man + woman ≈ queen. Words as arithmetic." },
  { id: "layernorm2016", name: "Layer Norm", yr: 2016, rar: 1, cost: 5, fx: "Norm cards give +8 Signal (on top of everything).", real: "The normalization flavor transformers actually use." },
  { id: "unet2015", name: "U-Net", yr: 2015, rar: 1, cost: 6, fx: "If your widths read the same forwards & backwards: 2× Signal.", real: "A symmetric hourglass network that revolutionized medical imaging." },
  { id: "gan2014", name: "GANs", yr: 2014, rar: 1, cost: 6, fx: "+40% Signal, but −0.15 Generalization on Validation & Boss.", real: "Two networks compete: one forges, one detects. High risk, high reward." },
  { id: "scalinglaws2020", name: "Scaling Laws", yr: 2020, rar: 2, cost: 9, fx: "Over 2,000 parameters? Multiply score by log₂(params ÷ 1000).", real: "Model skill grows predictably with size — the discovery behind GPT-scale bets." },
  { id: "chinchilla2022", name: "Chinchilla", yr: 2022, rar: 2, cost: 9, fx: "Your Data Budget counts as 3× bigger.", real: "Most giant models were undertrained: data matters as much as size." },
  { id: "moe", name: "Mixture of Experts", yr: 2017, rar: 2, cost: 8, fx: "Only your 2 strongest cards fire — at 4× Signal.", real: "Route each input to a few specialists instead of using the whole network." },
  { id: "backprop1986", name: "Backpropagation", yr: 1986, rar: 3, cost: 0, fx: "All your combos instantly level up, and again after every Boss.", real: "The algorithm that assigns blame backwards through the network. It all runs on this." },
  { id: "alexnet2012", name: "AlexNet", yr: 2012, rar: 3, cost: 0, fx: "Your widest card gives 3× Signal.", real: "The 2012 ImageNet win that started the deep-learning gold rush." },
  { id: "scalinghyp", name: "The Bitter Lesson", yr: 2019, rar: 3, cost: 0, fx: "+1 network slot and +1 paper slot.", real: "Rich Sutton's essay: general methods + more compute beat clever tricks." },
];
const PAPER = Object.fromEntries(PAPERS.map(p => [p.id, p]));
const RARITY = ["Common", "Uncommon", "Rare", "Legendary"];

/* ---------- bosses (each teaches a real failure mode) ---------- */
const BOSSES = [
  { id: "shift", name: "Distribution Shift", desc: s => `The test data changed! ${SUITS[s].name} ${SUITS[s].sym} cards score 0 this round.`, real: "Models trained on one kind of data often fail on another." },
  { id: "overfit", name: "Overfitting Audit", desc: () => "Generalization is SQUARED. 0.5 becomes 0.25 — keep your model small!", real: "A model that memorizes its training data falls apart on new data." },
  { id: "computecap", name: "Compute Cap", desc: (s, cap) => `Networks over ${fmt(cap)} parameters score HALF.`, real: "Real labs have budgets. Efficiency is a skill." },
  { id: "vanish", name: "Vanishing Gradient", desc: () => "4+ layer networks score 0 — unless they include a Norm card.", real: "In deep nets the learning signal shrinks to nothing... unless you stabilize it." },
  { id: "explode", name: "Exploding Gradient", desc: () => "Any single card worth over 100 Signal blows up: the whole run scores 0.", real: "Signals can also grow out of control. Big ≠ always better." },
  { id: "coldstart", name: "Cold Start", desc: () => "Your FIRST run this round scores 0. Warm-up lap!", real: "Early training steps are often wasted while the model finds its footing." },
];

/* ---------- notebook (unlocked by playing) ---------- */
const NOTEBOOK = [
  { id: "activations", title: "Why activations matter", body: "Stack 100 Dense layers with no activation and the math collapses into ONE straight line — that's why the Linear Stack combo is weak. One little ReLU between layers breaks the collapse and lets the network learn curves, corners, anything. This is the single most important idea in deep learning." },
  { id: "overfitting", title: "Overfitting", body: "A model with way more parameters than data is like a student who memorizes the answer key: perfect on the practice test (Training Rounds), lost on the real one (Validation). That's why Generalization = Data ÷ Parameters here. Big isn't better — RIGHT-SIZED is better." },
  { id: "parameters", title: "Counting parameters", body: "A Dense layer from 64 inputs to 32 neurons has 64 × 32 = 2,048 weights. That's the game's params math too: multiply neighboring widths and add it all up. Try it on your own network — the number in the score bar is exactly that." },
  { id: "depth", title: "Why depth is hard", body: "Each extra layer multiplies the learning signal by something — and multiplying many smallish numbers gives you almost zero (0.8 × 0.8 × 0.8...). That's the ×0.8 depth penalty, and the real 'vanishing gradient' problem that stalled AI for years." },
  { id: "normalization", title: "Normalization", body: "Norm re-centers the numbers between layers: average 0, spread 1. Nobody's values explode or vanish, so deep stacks stay trainable — which is why a Norm card cancels the depth penalty and beats the Vanishing Gradient boss." },
  { id: "skips", title: "Skip connections", body: "A Skip is a wire around a layer: output = layer(x) + x. Worst case the layer learns to add nothing and you've lost nothing — so going deeper can't hurt. This one trick (ResNet, 2015) took networks from ~20 layers to 1000+." },
  { id: "attention", title: "Attention, in one breath", body: "Every word makes a Query ('what am I looking for?') and a Key ('what am I?'). Match Queries to Keys, Softmax turns matches into percentages, and each word takes a weighted mix of everyone's Values. That's it — that's the T in GPT." },
  { id: "lstm", title: "LSTMs: memory with gates", body: "An LSTM keeps a memory cell and guards it with gates: Forget (what to erase), Input (what to store), Output (what to reveal). Before transformers took over, this is how machines read sentences and predicted stock ticks." },
  { id: "embeddings", title: "Words as numbers", body: "Computers can't eat words, so Embed turns each word into a list of numbers — its coordinates in 'meaning space'. Similar words land near each other, and directions mean things: king − man + woman lands near queen." },
  { id: "dropout", title: "Dropout: learning by forgetting", body: "During training, randomly mute some neurons. Sounds destructive — but it stops neurons from leaning on each other, like a team practicing with random players benched. Everyone gets stronger. That's why the Dropout paper skips a layer but boosts your Gain and Generalization." },
];

/* ---------- tune-up cards (level up a combo) ---------- */
const TUNEUP = {
  transformer: ["Temperature", "sharper attention focus"], mha: ["More Heads", "look at more things at once"],
  attn: ["Head Size", "bigger attention vectors"], lstm: ["Gate Bias", "remember longer by default"],
  recloop: ["Sequence Length", "read more steps"], bottleneck: ["Compression Ratio", "squeeze smarter"],
  residual: ["Block Count", "stack more shortcuts"], normblock: ["Epsilon", "extra numerical stability"],
  featext: ["Filter Size", "bigger visual receptive field"], mlp: ["Learning Rate", "the classic dial"],
  linear: ["L2 Penalty", "tidier straight lines"], single: ["Batch Size", "steadier updates"],
};

/* ---------- tutorial ---------- */
const TUTORIAL = [
  { t: "Welcome to Gradient Descent!", b: "You run a tiny AI lab across the history of neural networks. Each round: build a network from layer cards and score enough points to beat the Target before your 4 Training Runs are gone." },
  { t: "Cards are layers", b: "Click a card (or drag it up into the build area) to add it to your network. Order matters — data flows left to right, just like a real forward pass. Click a placed layer to remove it." },
  { t: "Build known combos", b: "Certain orders form famous architectures worth big points. Easiest one: Dense → any Activation = an MLP. The Combos button lists every recipe. The preview above your network tells you what you've built." },
  { t: "The score formula", b: "SCORE = Signal × Gain × Generalization. Signal: each layer gives 8×log₂(width) — wider is stronger, and cards matching the era's topic color give full value (half otherwise). Gain: the combo's multiplier, plus small bonuses for special cards (+2 per Activation, +1 for Norm, Skip, gates and attention parts)." },
  { t: "Don't overfit!", b: "On Validation and Boss rounds, Generalization = your Data Budget ÷ your network's parameters (neighboring widths multiplied). Too many parameters for your data and your score gets crushed — a huge network is NOT automatically better. This is the game's big lesson." },
  { t: "Papers & the Expo", b: "Between rounds, spend ⚡ compute at the Expo on real research papers (permanent upgrades), new layer cards, and Tune-Ups. Also: too many layers costs ×0.8 each past the 3rd — unless you use Skip or Norm. There's a reason those got invented. Good luck!" },
];

/* ═══════════════ SCORING (the actual math) ═══════════════ */
function scoreHand(stack, ctx) {
  const { kind, papers, levels, suits, data, boss, bossSuit, capVal, streak, handIndex, adamBonus } = ctx;
  const P = id => papers.has(id);
  const notes = [];
  const pat = matchPattern(stack);
  const lvl = levels[pat.id] || 1;
  const patSig = lvlSig(pat, lvl);
  const patGain = lvlGain(pat, lvl);

  /* --- per-card signal --- */
  const maxW = Math.max(...stack.map(c => c.width));
  let cardSigs = stack.map((c, i) => {
    let sig = wSig(c.width);
    let note = "";
    if (!suits.includes(c.suit)) { sig = Math.round(sig * 0.5); note = "off-topic ×0.5"; }
    if (P("relu2011") && isAct(c.type)) { sig += 6; note = "ReLU +6"; }
    if (P("layernorm2016") && c.type === "norm") { sig += 8; note = "LayerNorm +8"; }
    if (P("word2vec2013") && c.type === "embed") { sig *= 3; note = "Word2Vec ×3"; }
    if (P("attention2017") && ["q", "k", "v", "softmax"].includes(c.type)) { sig *= 2; note = "Attention ×2"; }
    if (P("xavier2010") && i === 0) { sig = Math.round(sig * 1.5); note = "Smart Init ×1.5"; }
    if (P("alexnet2012") && c.width === maxW) { sig *= 3; note = "AlexNet ×3"; }
    if (c.pGain) sig += 0;
    return { sig: Math.round(sig), note, card: c };
  });

  /* dropout paper: one random layer ignored */
  let dropIdx = null;
  if (P("dropout2014") && stack.length > 1) {
    const r = mulberry32(hashStr(ctx.seed + "-drop-" + handIndex));
    dropIdx = Math.floor(r() * stack.length);
    cardSigs[dropIdx] = { ...cardSigs[dropIdx], sig: 0, note: "dropped out!" };
    notes.push(`Dropout ignored layer ${dropIdx + 1} (but gives +6 Gain).`);
  }

  /* mixture of experts: only top 2 fire, at 4x */
  if (P("moe") && stack.length > 2) {
    const idx = cardSigs.map((c, i) => i).sort((a, b) => cardSigs[b].sig - cardSigs[a].sig).slice(0, 2);
    cardSigs = cardSigs.map((c, i) => idx.includes(i) ? { ...c, sig: c.sig * 4, note: "expert ×4" } : { ...c, sig: 0, note: "not routed" });
    notes.push("Mixture of Experts: top 2 layers fire at 4×.");
  }

  /* boss card-level effects */
  if (boss) {
    if (boss.id === "shift") cardSigs = cardSigs.map(c => c.card.suit === bossSuit ? { ...c, sig: 0, note: "shifted away!" } : c);
    if (boss.id === "explode" && cardSigs.some(c => c.sig > 100)) { cardSigs = cardSigs.map(c => ({ ...c, sig: 0, note: "💥" })); notes.push("EXPLODED: a card was over 100 Signal — everything scores 0."); }
    if (boss.id === "coldstart" && handIndex === 0) { cardSigs = cardSigs.map(c => ({ ...c, sig: 0, note: "cold" })); notes.push("Cold Start: this first run scores 0."); }
  }

  let totalSig = patSig + cardSigs.reduce((a, c) => a + c.sig, 0);
  if (P("gan2014")) { totalSig = Math.round(totalSig * 1.4); notes.push("GANs: +40% Signal."); }
  if (P("dataaug")) { totalSig = Math.round(totalSig * 0.8); }
  if (P("unet2015") && stack.length >= 3) {
    const w = stack.map(c => c.width);
    if (w.every((x, i) => x === w[w.length - 1 - i])) { totalSig *= 2; notes.push("U-Net: symmetric widths — Signal ×2!"); }
  }

  /* --- depth penalty --- */
  const hasProtect = stack.some(c => c.type === "skip" || c.type === "norm") || P("resnet2015");
  let depthApplied = false;
  if (stack.length > 3 && !hasProtect) {
    const extra = stack.length - 3;
    totalSig = Math.round(totalSig * Math.pow(0.8, extra));
    depthApplied = true;
    notes.push(`Depth penalty ×0.8 per layer past 3 (no Skip/Norm) → ×${r2(Math.pow(0.8, extra))}.`);
  }
  if (boss && boss.id === "vanish" && stack.length >= 4 && !stack.some(c => c.type === "norm")) {
    totalSig = 0; notes.push("Vanishing Gradient: 4+ layers with no Norm — Signal is 0.");
  }

  /* --- gain --- */
  let gain = patGain;
  for (const c of stack) {
    const tc = TYPES[c.type].cat;
    if (tc === "act") gain += 2;               /* nonlinearity = real modeling power */
    else if (c.type === "norm" || c.type === "skip") gain += 1;
    else if (tc === "gate" || tc === "attn" || c.type === "concat") gain += 1;
  }
  if (P("batchnorm2015") && stack.some(c => c.type === "norm")) gain += 2;
  if (P("dropout2014")) gain += 6;
  if (P("resnet2015")) { const s = stack.filter(c => c.type === "skip").length; if (s) { gain = Math.round(gain * (1 + 0.5 * s)); notes.push("ResNet: Skip cards boost Gain ×1.5."); } }
  if (P("momentum1986") && streak.pat === pat.id && streak.count > 0) { gain += 3 * streak.count; notes.push(`Momentum: ${streak.count} repeat(s) → +${3 * streak.count} Gain.`); }
  if (adamBonus) { gain += adamBonus; notes.push(`Adam: +${adamBonus} Gain from spare runs.`); }
  gain += stack.reduce((a, c) => a + (c.pGain || 0), 0);

  /* --- parameters & generalization --- */
  let params = 0;
  for (let i = 0; i < stack.length - 1; i++) params += stack[i].width * stack[i + 1].width;
  if (stack.length === 1) params = stack[0].width * stack[0].width;

  let gen = 1.0, genExpr = "training round: ×1.0";
  if (kind !== "train") {
    let effData = P("chinchilla2022") ? data * 3 : data;
    let reg = 0;
    if (P("weightdecay")) reg += 0.1;
    if (P("dataaug")) reg += 0.2;
    if (P("dropout2014")) reg += 0.15;
    if (P("gan2014")) reg -= 0.15;
    const base = clamp(effData / params, 0.25, 1.0);
    gen = r2(clamp(base + reg, 0.1, 1.5));
    genExpr = `${fmt(effData)} data ÷ ${fmt(params)} params = ${r2(effData / params)} → ${gen}`;
    if (boss && boss.id === "overfit") { gen = r2(gen * gen); notes.push(`Overfitting Audit: Generalization squared → ${gen}.`); genExpr += ` → squared: ${gen}`; }
  }

  let score = Math.round(totalSig * gain * gen);
  if (P("scalinglaws2020") && params > 2000) { const m = r2(lg2(params / 1000)); score = Math.round(score * m); notes.push(`Scaling Laws: ×${m} (log₂ of ${fmt(params)}÷1000).`); }
  if (boss && boss.id === "computecap" && params > capVal) { score = Math.round(score / 2); notes.push(`Compute Cap: over ${fmt(capVal)} params — score halved.`); }

  return { pat, lvl, patSig, patGain, cardSigs, totalSig, gain, gen, genExpr, params, score, notes, depthApplied, dropIdx };
}

/* ---------- pop quiz (small real matrix math, pays compute) ---------- */
function makeDerive(g) {
  const r = mulberry32(hashStr(g.seedStr + "-quiz-" + g.era + "-" + g.blindIdx));
  const W = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ri(r, -2, 2)));
  const x = Array.from({ length: 3 }, () => ri(r, 0, 3));
  const y = W.map(row => row.reduce((a, w, j) => a + w * x[j], 0));
  return { W, x, y, blank: ri(r, 0, 2) };
}

/* ═══════════════ GAME SETUP ═══════════════ */
function rndSeed() { const w = ["ADA", "TURING", "PIXEL", "NEURON", "TENSOR", "EPOCH", "RELU", "GRAD"]; return w[Math.floor(Math.random() * w.length)] + "-" + Math.floor(Math.random() * 1000); }

function makeDeck(r) {
  const deck = []; let n = 0;
  for (const s of SUIT_IDS) {
    const ws = shuffle(r, WIDTHS);
    for (let i = 0; i < 13; i++) {
      let type = "dense";
      if (i === 11) type = pick(r, ["relu", "sigmoid", "tanh", "gelu"]);
      if (i === 12) type = pick(r, ["relu", "gelu"]);
      if (i === 10) type = "norm";
      deck.push({ id: "c" + n++, type, suit: s, width: ws[i], pGain: 0 });
    }
  }
  return deck;
}

const targetFor = (era, blindIdx) => Math.round(eraBase(era) * [1, 1.5, 2.2][Math.min(blindIdx, 2)]);

function startBlind(g) {
  const r = mulberry32(hashStr(g.seedStr + "-r-" + g.era + "-" + g.blindIdx));
  g.drawPile = shuffle(r, g.deck.map(c => c.id));
  g.hand = g.drawPile.splice(0, 8);
  g.discard = []; g.stack = [];
  g.epochs = 4; g.ablations = 3;
  g.progress = 0; g.handIndex = 0;
  g.target = targetFor(g.era, g.blindIdx);
  g.data = eraData(g.era);
  g.cleared = false; g.failed = false;
  g.lastResult = null;
  g.boss = null; g.bossSuit = null; g.capVal = 0;
  if (g.blindIdx === 2) {
    const unused = BOSSES.filter(b => !g.bossesSeen.includes(b.id));
    g.boss = pick(r, unused.length ? unused : BOSSES);
    g.bossesSeen = [...g.bossesSeen, g.boss.id];
    g.bossSuit = pick(r, eraInfo(g.era).suits);
    g.capVal = Math.round(eraData(g.era) * 1.5);
  }
  return g;
}

function clearBlindState(g) {
  const P = new Set(g.papers);
  let reward = [4, 5, 8][Math.min(g.blindIdx, 2)];
  const interest = Math.min(5, Math.floor(g.compute / 5));
  reward += interest;
  let bonus = 0;
  if (P.has("earlystop")) bonus = g.epochs * 4;
  g.reward = reward + bonus;
  g.rewardNote = interest ? `includes +${interest} interest` : "";
  g.compute += g.reward;
  g.adamBonus = P.has("adam2015") ? g.epochs : 0;
  g.cleared = true;
  return g;
}

const SHOP_CARD_POOL = e => {
  let pool = ["conv", "pool", "norm", "skip", "relu", "gelu"];
  if (e >= 3) pool = pool.concat(["embed", "recur", "gatef", "gatei", "gateo", "gatec"]);
  if (e >= 4) pool = pool.concat(["q", "k", "v", "softmax", "concat"]);
  return pool;
};

function makeShop(g, n) {
  const r = mulberry32(hashStr(g.seedStr + "-shop-" + g.era + "-" + g.blindIdx + "-" + n));
  const owned = new Set(g.papers);
  const pool = PAPERS.filter(p => p.rar < 3 && !owned.has(p.id));
  const papers = [];
  for (let i = 0; i < 2 && pool.length; i++) {
    const roll = r();
    const rar = roll < 0.55 ? 0 : roll < 0.85 ? 1 : 2;
    const opts = pool.filter(p => p.rar === rar && !papers.includes(p));
    const cand = opts.length ? pick(r, opts) : pick(r, pool.filter(p => !papers.includes(p)));
    if (cand) papers.push(cand);
  }
  const cpool = SHOP_CARD_POOL(g.era);
  const cards = Array.from({ length: 2 }, () => ({ type: pick(r, cpool), suit: pick(r, eraInfo(Math.min(g.era + 1, 8)).suits), width: pick(r, WIDTHS.slice(2, 10)), cost: 4 }));
  const tuneups = Array.from({ length: 2 }, () => ({ pat: pick(r, PATTERNS.map(p => p.id)), cost: 3 }));
  return { papers, cards, tuneups, n };
}

/* ═══════════════ COMPONENT ═══════════════ */
export default function GradientDescent() {
  const [screen, setScreen] = useState("menu");
  const [g, setG] = useState(null);
  const [seedInput, setSeedInput] = useState("");
  const [anim, setAnim] = useState(null);
  const [fast, setFast] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [shop, setShop] = useState(null);
  const [tut, setTut] = useState(null);
  const [seenTut, setSeenTut] = useState(false);
  const [dragOver, setDragOver] = useState(null);

  const gRef = useRef(null); gRef.current = g;
  const fastRef = useRef(false); fastRef.current = fast;
  const animRef = useRef(null);
  const busyRef = useRef(false);
  const screenRef = useRef("menu"); screenRef.current = screen;
  const toastTm = useRef(null);

  const say = msg => { setToast(msg); clearTimeout(toastTm.current); toastTm.current = setTimeout(() => setToast(null), 3400); };
  const cardById = (gg, id) => gg.deck.find(c => c.id === id);

  /* ---------- new run ---------- */
  function newRun() {
    const seedStr = (seedInput.trim() || rndSeed()).toUpperCase();
    const r = mulberry32(hashStr(seedStr));
    let gg = {
      seedStr, era: 1, blindIdx: 0, compute: 6,
      deck: makeDeck(r), papers: [], paperSlots: 5, consumables: [],
      levels: {}, stackLimit: 5, notebookUnlocked: [], bossesSeen: [],
      streak: { pat: null, count: 0 }, adamBonus: 0, legendGiven: false,
      bestHand: null, endless: false, deriveEra: 0, reward: 0, rewardNote: "",
    };
    gg = startBlind(gg);
    setG(gg); setShop(null); setAnim(null); setModal(null);
    setScreen("blind");
    if (!seenTut) { setTut(0); setSeenTut(true); }
  }

  /* ---------- building the network ---------- */
  function addCard(id, at = null) {
    setG(gg => {
      if (!gg || busyRef.current || gg.cleared) return gg;
      if (gg.stack.includes(id)) return gg;
      if (gg.stack.length >= gg.stackLimit) { say(`Your network is full (${gg.stackLimit} slots for now).`); return gg; }
      const stack = [...gg.stack];
      if (at === null || at >= stack.length) stack.push(id); else stack.splice(at, 0, id);
      return { ...gg, stack };
    });
  }
  function removeCard(id) {
    setG(gg => (!gg || busyRef.current || gg.cleared) ? gg : { ...gg, stack: gg.stack.filter(x => x !== id) });
  }
  function moveCard(fromIdx, toIdx) {
    setG(gg => {
      if (!gg || busyRef.current) return gg;
      const stack = [...gg.stack];
      if (fromIdx < 0 || fromIdx >= stack.length) return gg;
      const [it] = stack.splice(fromIdx, 1);
      stack.splice(clamp(toIdx, 0, stack.length), 0, it);
      return { ...gg, stack };
    });
  }
  function toggleCard(id) {
    const gg = gRef.current; if (!gg) return;
    gg.stack.includes(id) ? removeCard(id) : addCard(id);
  }

  /* ---------- drag & drop ---------- */
  function onDragStartHand(e, id) { e.dataTransfer.setData("text/plain", "h:" + id); e.dataTransfer.effectAllowed = "move"; }
  function onDragStartStack(e, idx) { e.dataTransfer.setData("text/plain", "s:" + idx); e.dataTransfer.effectAllowed = "move"; }
  function handleDrop(e, at) {
    e.preventDefault(); e.stopPropagation(); setDragOver(null);
    const d = e.dataTransfer.getData("text/plain"); if (!d) return;
    if (d.startsWith("h:")) addCard(d.slice(2), at);
    else if (d.startsWith("s:")) {
      const from = parseInt(d.slice(2), 10);
      moveCard(from, at === null ? 999 : (at > from ? at - 1 : at));
    }
  }
  function handleDropToHand(e) {
    e.preventDefault(); setDragOver(null);
    const d = e.dataTransfer.getData("text/plain");
    if (d && d.startsWith("s:")) {
      const idx = parseInt(d.slice(2), 10);
      const gg = gRef.current;
      if (gg && gg.stack[idx]) removeCard(gg.stack[idx]);
    }
  }

  /* ---------- run the network (forward pass) ---------- */
  function playHand() {
    const gg = gRef.current;
    if (!gg || busyRef.current || gg.cleared || gg.epochs <= 0 || gg.stack.length === 0) return;
    busyRef.current = true;
    const stackCards = gg.stack.map(id => cardById(gg, id));
    const kind = gg.blindIdx === 0 ? "train" : gg.blindIdx === 1 ? "val" : "boss";
    const ctx = {
      kind, papers: new Set(gg.papers), levels: gg.levels, suits: eraInfo(gg.era).suits,
      data: gg.data, boss: gg.boss, bossSuit: gg.bossSuit, capVal: gg.capVal,
      streak: gg.streak, handIndex: gg.handIndex, adamBonus: gg.adamBonus, seed: gg.seedStr + gg.era + gg.blindIdx,
    };
    const res = scoreHand(stackCards, ctx);
    const total = stackCards.length + 3;
    setAnim({ step: 0, total, res, stack: stackCards, done: false });
    const iv = setInterval(() => {
      setAnim(a => {
        if (!a) return a;
        const step = a.step + 1;
        if (step >= a.total) {
          clearInterval(iv);
          setTimeout(() => commitScore(res, stackCards), fastRef.current ? 250 : 900);
          return { ...a, step: a.total, done: true };
        }
        return { ...a, step };
      });
    }, fastRef.current ? 160 : 620);
    animRef.current = iv;
  }

  function commitScore(res, stackCards) {
    busyRef.current = false;
    setAnim(null);
    setG(gg => {
      if (!gg) return gg;
      let g2 = { ...gg };
      g2.progress += res.score;
      g2.epochs -= 1;
      g2.handIndex += 1;
      g2.streak = res.pat.id === gg.streak.pat ? { pat: res.pat.id, count: gg.streak.count + 1 } : { pat: res.pat.id, count: 0 };
      g2.lastResult = res;
      if (!g2.bestHand || res.score > g2.bestHand.score) g2.bestHand = { pat: res.pat.name, score: res.score, params: res.params, arch: stackCards.map(c => TYPES[c.type].name + "×" + c.width).join(" → ") };
      /* discard played cards, draw back to 8 */
      const played = new Set(g2.stack);
      g2.discard = [...g2.discard, ...g2.stack];
      g2.hand = g2.hand.filter(id => !played.has(id));
      g2.stack = [];
      let drawPile = [...g2.drawPile];
      while (g2.hand.length < 8) {
        if (!drawPile.length) {
          if (!g2.discard.length) break;
          const r = mulberry32(hashStr(g2.seedStr + "-resh-" + g2.era + "-" + g2.blindIdx + "-" + g2.handIndex));
          drawPile = shuffle(r, g2.discard); g2.discard = [];
        }
        g2.hand = [...g2.hand, drawPile.shift()];
      }
      g2.drawPile = drawPile;
      /* notebook unlocks */
      const unlock = (id, msg) => { if (!g2.notebookUnlocked.includes(id)) { g2.notebookUnlocked = [...g2.notebookUnlocked, id]; say("📓 Notebook unlocked: " + msg); } };
      if (res.pat.id === "mlp") unlock("activations", "Why activations matter");
      if (res.pat.id === "linear") unlock("activations", "Why activations matter");
      if (stackCards.some(c => c.type === "norm")) unlock("normalization", "Normalization");
      if (stackCards.some(c => c.type === "skip")) unlock("skips", "Skip connections");
      if (["attn", "mha", "transformer"].includes(res.pat.id)) unlock("attention", "Attention, in one breath");
      if (res.pat.id === "lstm") unlock("lstm", "LSTMs: memory with gates");
      if (stackCards.some(c => c.type === "embed")) unlock("embeddings", "Words as numbers");
      if (res.depthApplied) unlock("depth", "Why depth is hard");
      if (res.gen <= 0.3 && g2.blindIdx > 0) unlock("overfitting", "Overfitting");
      if (res.gen > 0.3 && res.gen < 1 && g2.blindIdx > 0) unlock("parameters", "Counting parameters");
      if (res.dropIdx !== null && res.dropIdx !== undefined) unlock("dropout", "Dropout");
      /* clear / fail */
      if (g2.progress >= g2.target) {
        g2 = clearBlindState(g2);
        if (new Set(g2.papers).has("backprop1986") && g2.blindIdx === 2) {
          const lv = { ...g2.levels }; PATTERNS.forEach(p => lv[p.id] = (lv[p.id] || 1) + 1); g2.levels = lv;
          say("Backprop: all combos leveled up!");
        }
      } else if (g2.epochs <= 0) g2.failed = true;
      return g2;
    });
  }

  /* ---------- redraw (swap cards) ---------- */
  function redraw() {
    setG(gg => {
      if (!gg || busyRef.current || gg.ablations <= 0 || gg.stack.length === 0 || gg.cleared) return gg;
      let g2 = { ...gg };
      const away = new Set(g2.stack);
      g2.discard = [...g2.discard, ...g2.stack];
      g2.hand = g2.hand.filter(id => !away.has(id));
      g2.stack = [];
      g2.ablations -= 1;
      let drawPile = [...g2.drawPile];
      while (g2.hand.length < 8) {
        if (!drawPile.length) {
          if (!g2.discard.length) break;
          const r = mulberry32(hashStr(g2.seedStr + "-resh2-" + g2.ablations));
          drawPile = shuffle(r, g2.discard); g2.discard = [];
        }
        g2.hand = [...g2.hand, drawPile.shift()];
      }
      g2.drawPile = drawPile;
      return g2;
    });
  }

  /* ---------- flow: shop, next round, quiz, legendary ---------- */
  function proceedToShop() {
    const gg = gRef.current; if (!gg) return;
    setShop(makeShop(gg, 0));
    setScreen("shop");
    if (gg.blindIdx === 2 && !gg.legendGiven) {
      const r = mulberry32(hashStr(gg.seedStr + "-leg-" + gg.era));
      const legends = shuffle(r, PAPERS.filter(p => p.rar === 3)).slice(0, 2);
      setModal({ type: "legend", legends });
    }
  }
  function pickLegend(p) {
    setG(gg => {
      let g2 = { ...gg, papers: [...gg.papers, p.id], legendGiven: true };
      if (p.id === "scalinghyp") { g2.stackLimit += 1; g2.paperSlots += 1; }
      if (p.id === "backprop1986") { const lv = { ...g2.levels }; PATTERNS.forEach(x => lv[x.id] = (lv[x.id] || 1) + 1); g2.levels = lv; }
      return g2;
    });
    setModal(null); say("Legendary result: " + p.name + "!");
  }
  function nextFromShop() {
    setModal(null);
    setG(gg => {
      let g2 = { ...gg };
      let era = g2.era, blindIdx = g2.blindIdx + 1;
      if (blindIdx > 2) { era += 1; blindIdx = 0; }
      if (era > 8 && !g2.endless) { g2.era = era; return g2; } /* win handled below */
      g2.era = era; g2.blindIdx = blindIdx;
      if (era === 3 && blindIdx === 0 && g2.stackLimit < 6) { g2.stackLimit = 6; setTimeout(() => say("🔧 Lab upgrade: 6 network slots — Multi-Head Attention is now buildable."), 400); }
      if (era === 5 && blindIdx === 0 && g2.stackLimit < 7) { g2.stackLimit = 7; setTimeout(() => say("🔧 Lab upgrade: 7 network slots — full Transformer Blocks unlocked."), 400); }
      g2 = startBlind(g2);
      return g2;
    });
    setTimeout(() => {
      const gg = gRef.current; if (!gg) return;
      if (gg.era > 8 && !gg.endless) { setScreen("win"); return; }
      setScreen("blind");
      setTimeout(() => {
        const g3 = gRef.current;
        if (g3 && g3.blindIdx === 2 && g3.deriveEra !== g3.era && screenRef.current === "blind") {
          setG(x => ({ ...x, deriveEra: x.era }));
          setModal({ type: "quiz", ch: makeDerive(g3), guess: "", done: false });
        }
      }, 80);
    }, 30);
  }
  function submitQuiz() {
    setModal(m => {
      if (!m || m.type !== "quiz" || m.done) return m;
      const ok = parseInt(m.guess, 10) === m.ch.y[m.ch.blank];
      if (ok) { setG(gg => ({ ...gg, compute: gg.compute + 4 })); say("✓ Correct! +4⚡ compute."); }
      return { ...m, done: true, correct: ok };
    });
  }
  function startEndless() {
    setG(gg => startBlind({ ...gg, endless: true, era: 9, blindIdx: 0 }));
    setScreen("blind");
  }

  /* ---------- shop actions ---------- */
  function buyPaper(p) {
    setG(gg => {
      if (gg.compute < p.cost || gg.papers.length >= gg.paperSlots || gg.papers.includes(p.id)) return gg;
      return { ...gg, compute: gg.compute - p.cost, papers: [...gg.papers, p.id] };
    });
    setShop(s => ({ ...s, papers: s.papers.filter(x => x.id !== p.id) }));
  }
  function buyCard(it, idx) {
    setG(gg => {
      if (gg.compute < it.cost) return gg;
      const card = { id: "s" + gg.era + "_" + gg.blindIdx + "_" + idx + "_" + gg.deck.length, type: it.type, suit: it.suit, width: it.width, pGain: 0 };
      return { ...gg, compute: gg.compute - it.cost, deck: [...gg.deck, card] };
    });
    setShop(s => ({ ...s, cards: s.cards.filter((_, i) => i !== idx) }));
    say("Added to your deck — it'll show up when you draw it.");
  }
  function buyTune(it, idx) {
    setG(gg => {
      if (gg.compute < it.cost) return gg;
      const lv = { ...gg.levels }; lv[it.pat] = (lv[it.pat] || 1) + 1;
      return { ...gg, compute: gg.compute - it.cost, levels: lv };
    });
    setShop(s => ({ ...s, tuneups: s.tuneups.filter((_, i) => i !== idx) }));
    say(PAT[it.pat].name + " leveled up!");
  }
  function reroll() {
    setG(gg => gg.compute < 2 ? gg : { ...gg, compute: gg.compute - 2 });
    const gg = gRef.current;
    if (gg && gg.compute >= 2) setShop(s => makeShop(gg, s.n + 1));
  }

  /* ---------- effects ---------- */
  useEffect(() => {
    if (g && g.failed && screen === "blind") {
      const t = setTimeout(() => setScreen("gameover"), 1100);
      return () => clearTimeout(t);
    }
  }, [g && g.failed, screen]);
  useEffect(() => () => { clearInterval(animRef.current); clearTimeout(toastTm.current); }, []);

  /* keyboard */
  useEffect(() => {
    const h = e => {
      if (screenRef.current !== "blind" || modal || tut !== null) return;
      const gg = gRef.current; if (!gg) return;
      if (e.key >= "1" && e.key <= "9") { const id = gg.hand[+e.key - 1]; if (id) toggleCard(id); }
      if (e.key === "Enter") playHand();
      if (e.key === "Backspace") { e.preventDefault(); redraw(); }
      if (e.key.toLowerCase() === "f") setFast(f => !f);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [modal, tut]);

  /* ---------- derived ---------- */
  const stackCards = g ? g.stack.map(id => cardById(g, id)).filter(Boolean) : [];
  const previewPat = stackCards.length ? matchPattern(stackCards) : null;
  const info = g ? eraInfo(g.era) : null;
  const live = (() => {
    if (anim) {
      const { res, step, stack } = anim; const n = stack.length;
      let sig = res.patSig; const upto = Math.min(step, n);
      for (let i = 0; i < upto; i++) sig += res.cardSigs[i].sig;
      if (step > n) sig = res.totalSig;
      return { sig, gain: step > n ? res.gain : "…", gen: step > n + 1 ? res.gen : "…", score: anim.done ? res.score : "…", res };
    }
    if (g && g.lastResult) { const r = g.lastResult; return { sig: r.totalSig, gain: r.gain, gen: r.gen, score: r.score, res: r }; }
    return null;
  })();

  /* ═══════════════ SCREENS ═══════════════ */
  if (screen === "menu") return (
    <div className="gd-root gd-center"><style>{css()}</style>
      <div className="gd-menu">
        <div className="gd-eyebrow">a card game about how neural networks actually work</div>
        <h1 className="gd-title">GRADIENT<br />DESCENT</h1>
        <p className="gd-sub">Build networks out of layer cards. Beat the target score. Learn — for real — why activations, normalization, skip connections and attention exist, and why bigger isn't always better.</p>
        <div className="gd-menurow">
          <label className="gd-lab">Seed (optional)
            <input className="gd-input" value={seedInput} onChange={e => setSeedInput(e.target.value)} placeholder="e.g. TURING-42" />
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="gd-play" onClick={newRun}>Start →</button>
          <button className="gd-play alt" onClick={() => { setTut(0); }}>How to play</button>
        </div>
        <div className="gd-howto">8 eras of AI history · 3 rounds each · same seed = same game</div>
      </div>
      {tut !== null && <Tutorial step={tut} setStep={setTut} />}
    </div>
  );

  if (screen === "gameover" || screen === "win") {
    const won = screen === "win";
    return (
      <div className="gd-root gd-center"><style>{css()}</style>
        <div className="gd-menu">
          <div className="gd-eyebrow">{won ? "benchmark saturated" : "training diverged"}</div>
          <h1 className="gd-title" style={{ fontSize: 44 }}>{won ? "STATE OF THE ART" : "OUT OF RUNS"}</h1>
          <p className="gd-sub">{won ? "All 8 eras cleared — your little lab made history." : `Era ${g.era}, ${ROUNDS[Math.min(g.blindIdx, 2)]}: needed ${fmt(g.target)}, reached ${fmt(g.progress)}.`}</p>
          {g.bestHand && <div className="gd-abstract">
            <div className="gd-absHead">YOUR BEST NETWORK</div>
            <p><b>{g.bestHand.pat}</b> — {g.bestHand.arch}<br />{fmt(g.bestHand.params)} parameters · scored <b>{fmt(g.bestHand.score)}</b></p>
          </div>}
          <p className="gd-tiny" style={{ margin: "6px 0 14px" }}>Notebook entries discovered: {g.notebookUnlocked.length}/{NOTEBOOK.length} · seed {g.seedStr}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {won && <button className="gd-play" onClick={startEndless}>Endless mode →</button>}
            <button className="gd-play alt" onClick={() => { setSeedInput(g.seedStr); setScreen("menu"); }}>Retry same seed</button>
            <button className="gd-play alt" onClick={() => { setSeedInput(""); setScreen("menu"); }}>New game</button>
          </div>
        </div>
      </div>
    );
  }

  if (!g) return null;

  const header = (
    <div className="gd-top">
      <div className="gd-brand">GRADIENT DESCENT</div>
      <div className="gd-topmid"><b>Era {g.era}{g.era > 8 ? "+" : ""}</b> · {info.theme} <span className="gd-tiny">— {info.blurb}</span></div>
      <div className="gd-topbtns">
        <span className="gd-chip">⚡ {g.compute}</span>
        <button className="gd-tbtn" onClick={() => setModal({ type: "combos" })}>Combos</button>
        <button className="gd-tbtn" onClick={() => setModal({ type: "notebook", sel: null })}>📓 {g.notebookUnlocked.length}/{NOTEBOOK.length}</button>
        <button className="gd-tbtn" onClick={() => setTut(0)}>?</button>
        <button className={"gd-tbtn" + (fast ? " on" : "")} onClick={() => setFast(f => !f)}>Fast{fast ? " ✓" : ""}</button>
      </div>
    </div>
  );

  const scoreStrip = (
    <div className="gd-eq">
      <div className="gd-eqRow">
        <span className="gd-eqLabel">SCORE =</span>
        <span className="gd-eqTerm">Signal <b className="gd-num">{live ? fmt(Math.round(live.sig)) : "—"}</b></span>
        <span className="gd-eqOp">×</span>
        <span className="gd-eqTerm">Gain <b className="gd-num">{live ? live.gain : "—"}</b></span>
        <span className="gd-eqOp">×</span>
        <span className="gd-eqTerm" title={live && live.res ? live.res.genExpr : "On Validation & Boss rounds: Data ÷ Parameters"}>Generalization <b className="gd-num">{live ? live.gen : g.blindIdx === 0 ? "1.0" : "?"}</b></span>
        <span className="gd-eqOp">=</span>
        <b className="gd-eqScore">{live && live.score !== "…" ? fmt(live.score) : "…"}</b>
      </div>
      <div className="gd-progressWrap">
        <div className="gd-progressLabel"><b>{ROUNDS[Math.min(g.blindIdx, 2)]}</b> · {fmt(g.progress)} / {fmt(g.target)} target</div>
        <div className="gd-bar"><div className="gd-barFill" style={{ width: Math.min(100, 100 * g.progress / g.target) + "%" }} /></div>
      </div>
      <div className="gd-meta">
        <span title="How many times you can run your network this round">Runs: <b>{"▶".repeat(g.epochs)}{"▷".repeat(Math.max(0, 4 - g.epochs))}</b></span>
        <span title="Send the built network back and draw new cards">Redraws: <b>{g.ablations}</b></span>
        <span title="Your data budget — divides your parameter count on Validation & Boss rounds">Data: <b>{fmt(new Set(g.papers).has("chinchilla2022") ? g.data * 3 : g.data)}</b></span>
        <span>Topic: {info.suits.map(s => <i key={s} className="gd-suitI" title={SUITS[s].name + " (" + SUITS[s].plain + ") — full Signal"}><SuitIcon suit={s} size={16} /></i>)} <em className="gd-tiny">= full signal, others ×½</em></span>
        {g.blindIdx === 1 && !g.boss && <span className="gd-valTag">⚠ Validation: Generalization = Data ÷ Params</span>}
      </div>
      {g.boss && <div className="gd-boss"><b>BOSS — {g.boss.name}:</b> {g.boss.desc(g.bossSuit, g.capVal)} <em className="gd-tiny">({g.boss.real})</em></div>}
    </div>
  );

  /* ---------- the network diagram (build area + forward-pass animation) ---------- */
  const n = stackCards.length;
  const network = (
    <div className="gd-netWrap">
      <div className="gd-netHead">
        <span>YOUR NETWORK <em className="gd-tiny">drag cards here · data flows left → right</em></span>
        <span className="gd-patPrev">{previewPat ? `${previewPat.name} · ${lvlSig(previewPat, g.levels[previewPat.id] || 1)} base Signal × ${lvlGain(previewPat, g.levels[previewPat.id] || 1)} Gain${(g.levels[previewPat.id] || 1) > 1 ? ` (Lv${g.levels[previewPat.id]})` : ""}` : "— empty —"}</span>
      </div>
      <div className="gd-net" onDragOver={e => { e.preventDefault(); }} onDrop={e => handleDrop(e, null)}>
        <div className={"gd-io" + (anim && anim.step === 0 ? " firing" : "")}>
          <div className="gd-ioLbl">DATA</div>
          <div className="gd-dots">{[0, 1, 2, 3].map(i => <span key={i} className="gd-dot in" />)}</div>
          <div className="gd-tiny">input</div>
        </div>
        {Array.from({ length: g.stackLimit }).map((_, i) => {
          const c = stackCards[i];
          const fired = anim && anim.step > i && i < n;
          const firing = anim && !anim.done && anim.step === i + 1 && i < n;
          const sigInfo = anim && anim.res.cardSigs[i];
          return (
            <React.Fragment key={i}>
              <div className={"gd-arrow" + ((fired || firing) ? " lit" : "")}>→</div>
              {c ? (
                <div
                  className={"gd-layer" + (firing ? " firing" : "") + (fired ? " fired" : "") + (dragOver === i ? " dragover" : "")}
                  style={{ borderColor: SUITS[c.suit].color, background: SUITS[c.suit].bg }}
                  draggable={!busyRef.current}
                  onDragStart={e => onDragStartStack(e, i)}
                  onDragOver={e => { e.preventDefault(); setDragOver(i); }}
                  onDragLeave={() => setDragOver(o => o === i ? null : o)}
                  onDrop={e => handleDrop(e, i)}
                  title={TYPES[c.type].tip}
                >
                  <div className="gd-layerGlyph" style={{ color: SUITS[c.suit].color }}><LayerGlyph type={c.type} size={30} /></div>
                  <div className="gd-layerName">{TYPES[c.type].name}</div>
                  <div className="gd-dots">{Array.from({ length: Math.min(6, Math.max(2, Math.round(lg2(c.width)))) }).map((_, j) => <span key={j} className="gd-dot" style={{ background: SUITS[c.suit].color }} />)}</div>
                  <div className="gd-layerW">×{c.width}</div>
                  {fired && sigInfo && <div className={"gd-sigPop" + (sigInfo.sig === 0 ? " zero" : "")}>{sigInfo.sig === 0 ? (sigInfo.note || "0") : "+" + sigInfo.sig}</div>}
                  {!anim && !g.cleared && <button className="gd-x" onClick={() => removeCard(c.id)} title="remove">✕</button>}
                </div>
              ) : (
                <div
                  className={"gd-slotGhost" + (dragOver === i ? " dragover" : "")}
                  onDragOver={e => { e.preventDefault(); setDragOver(i); }}
                  onDragLeave={() => setDragOver(o => o === i ? null : o)}
                  onDrop={e => handleDrop(e, i)}
                >{i + 1}</div>
              )}
            </React.Fragment>
          );
        })}
        <div className={"gd-arrow" + (anim && anim.step > n ? " lit" : "")}>→</div>
        <div className={"gd-io out" + (anim && anim.done ? " firing" : "")}>
          <div className="gd-ioLbl">GUESS</div>
          <div className="gd-outBig">{anim ? (anim.done ? "✓" : anim.step > n ? "…" : "ŷ") : "ŷ"}</div>
          <div className="gd-tiny">output</div>
        </div>
      </div>
      {anim && (
        <div className="gd-animBar">
          {anim.step <= n && <span>Forward pass: layer {Math.min(anim.step, n)} of {n} firing…</span>}
          {anim.step === n + 1 && <span>Combo multiplier: <b>{anim.res.pat.name}</b> ×{anim.res.gain} Gain</span>}
          {anim.step >= n + 2 && <span>Generalization check: <b>{anim.res.genExpr}</b></span>}
          {anim.done && <span className="gd-final"> → Score {fmt(anim.res.score)}!</span>}
        </div>
      )}
      {!anim && live && live.res && live.res.notes.length > 0 && (
        <div className="gd-notes">{live.res.notes.map((x, i) => <div key={i}>· {x}</div>)}</div>
      )}
      <div className="gd-actions">
        <button className="gd-play" disabled={!n || g.epochs <= 0 || !!anim || g.cleared} onClick={playHand}>▶ Run the network <span className="gd-tiny2">({g.epochs} left)</span></button>
        <button className="gd-play alt" disabled={!n || g.ablations <= 0 || !!anim || g.cleared} onClick={redraw}>Return &amp; redraw <span className="gd-tiny2">({g.ablations} left)</span></button>
      </div>
    </div>
  );

  const handArea = (
    <div className="gd-handWrap" onDragOver={e => e.preventDefault()} onDrop={handleDropToHand}>
      <div className="gd-netHead"><span>YOUR CARDS</span><span className="gd-tiny">click or drag to build · {g.drawPile.length} left in deck</span></div>
      <div className="gd-hand">
        {g.hand.map((id, i) => {
          const c = cardById(g, id); if (!c) return null;
          const inStack = g.stack.includes(id);
          return (
            <div key={id}
              className={"gd-card" + (inStack ? " sel" : "")}
              style={inStack ? { borderColor: SUITS[c.suit].color } : undefined}
              draggable={!inStack && !busyRef.current}
              onDragStart={e => onDragStartHand(e, id)}
              onClick={() => toggleCard(id)}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === "Enter" && toggleCard(id)}
              title={TYPES[c.type].tip}
            >
              <div className="gd-cardKey">{i + 1}</div>
              {inStack && <div className="gd-ordBadge" style={{ background: SUITS[c.suit].color }}>{g.stack.indexOf(id) + 1}</div>}
              <div className="gd-cbTop" style={{ background: SUITS[c.suit].bg, color: SUITS[c.suit].color }}><span className="gd-suitI"><SuitIcon suit={c.suit} size={13} /></span><span className="gd-cbW">×{c.width}</span></div>
              <div className="gd-cbGlyph"><LayerGlyph type={c.type} size={24} /></div>
              <div className="gd-cbName">{TYPES[c.type].name}</div>
              <div className="gd-cbSig">{wSig(c.width)} signal</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const papersRow = (
    <div className="gd-papersRow">
      <span className="gd-tiny" style={{ marginRight: 4 }}>PAPERS {g.papers.length}/{g.paperSlots}:</span>
      {g.papers.length === 0 && <span className="gd-dim">none yet — buy some at the Expo between rounds</span>}
      {g.papers.map(pid => <span key={pid} className="gd-paperChip" title={PAPER[pid].fx + " — " + PAPER[pid].real}><b>{PAPER[pid].name}</b> <em>{PAPER[pid].yr}</em></span>)}
    </div>
  );

  const clearedOverlay = g.cleared && (
    <div className="gd-overlay"><div className="gd-modal" style={{ textAlign: "center" }}>
      <div className="gd-eyebrow">round cleared</div>
      <h2 className="gd-h2">{ROUNDS[Math.min(g.blindIdx, 2)]} ✓</h2>
      <p>Scored {fmt(g.progress)} / {fmt(g.target)}.<br />Payout: <b>+{g.reward}⚡ compute</b> {g.rewardNote && <em className="gd-tiny">({g.rewardNote})</em>}</p>
      <button className="gd-play" onClick={proceedToShop}>Go to the Expo →</button>
    </div></div>
  );

  if (screen === "shop" && shop) return (
    <div className="gd-root"><style>{css()}</style>
      {header}
      <div className="gd-shop">
        <div className="gd-shopHead">
          <div><h2 className="gd-h2" style={{ margin: 0 }}>THE EXPO</h2><span className="gd-tiny">spend ⚡ compute on upgrades · saved compute earns interest</span></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="gd-chip">⚡ {g.compute}</span>
            <button className="gd-tbtn" onClick={reroll} disabled={g.compute < 2}>Reroll (2⚡)</button>
            <button className="gd-play" onClick={nextFromShop}>Next round →</button>
          </div>
        </div>
        <div className="gd-shopGrid">
          <div className="gd-shopSec">
            <div className="gd-pHead">Research Papers <em className="gd-tiny">permanent upgrades</em></div>
            {shop.papers.length === 0 && <div className="gd-dim">Sold out — reroll?</div>}
            {shop.papers.map(p => (
              <div key={p.id} className="gd-arxiv">
                <div className="gd-arxTag">{p.yr} · {RARITY[p.rar]}</div>
                <div className="gd-arxTitle">{p.name}</div>
                <div className="gd-arxFx">{p.fx}</div>
                <div className="gd-arxReal">Real story: {p.real}</div>
                <button className="gd-mini buy" disabled={g.compute < p.cost || g.papers.length >= g.paperSlots} onClick={() => buyPaper(p)}>Buy {p.cost}⚡</button>
              </div>
            ))}
          </div>
          <div className="gd-shopSec">
            <div className="gd-pHead">Layer Cards <em className="gd-tiny">added to your deck</em></div>
            {shop.cards.length === 0 && <div className="gd-dim">Sold out.</div>}
            {shop.cards.map((it, i) => (
              <div key={i} className="gd-shopCardRow">
                <div className="gd-card static" style={{ borderColor: SUITS[it.suit].color }}>
                  <div className="gd-cbTop" style={{ background: SUITS[it.suit].bg, color: SUITS[it.suit].color }}><span className="gd-suitI"><SuitIcon suit={it.suit} size={13} /></span><span className="gd-cbW">×{it.width}</span></div>
                  <div className="gd-cbGlyph"><LayerGlyph type={it.type} size={24} /></div>
                  <div className="gd-cbName">{TYPES[it.type].name}</div>
                  <div className="gd-cbSig">{wSig(it.width)} signal</div>
                </div>
                <div style={{ flex: 1 }}><div className="gd-tiny" style={{ lineHeight: 1.5 }}>{TYPES[it.type].tip}</div>
                  <button className="gd-mini buy" disabled={g.compute < it.cost} onClick={() => buyCard(it, i)}>Add to deck {it.cost}⚡</button></div>
              </div>
            ))}
          </div>
          <div className="gd-shopSec">
            <div className="gd-pHead">Tune-Ups <em className="gd-tiny">level up a combo forever</em></div>
            {shop.tuneups.length === 0 && <div className="gd-dim">Sold out.</div>}
            {shop.tuneups.map((it, i) => (
              <div key={i} className="gd-arxiv">
                <div className="gd-arxTag">hyperparameter</div>
                <div className="gd-arxTitle">{TUNEUP[it.pat][0]}</div>
                <div className="gd-arxFx"><b>{PAT[it.pat].name}</b> → level {(g.levels[it.pat] || 1) + 1}: {lvlSig(PAT[it.pat], (g.levels[it.pat] || 1) + 1)} base Signal × {lvlGain(PAT[it.pat], (g.levels[it.pat] || 1) + 1)} Gain</div>
                <div className="gd-arxReal">Tuning the {TUNEUP[it.pat][1]}.</div>
                <button className="gd-mini buy" disabled={g.compute < it.cost} onClick={() => buyTune(it, i)}>Buy {it.cost}⚡</button>
              </div>
            ))}
          </div>
        </div>
      </div>
      {modal && modal.type === "legend" && (
        <div className="gd-overlay"><div className="gd-modal">
          <div className="gd-eyebrow">boss beaten · pick one legendary paper</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            {modal.legends.map(p => (
              <div key={p.id} className="gd-arxiv legend" onClick={() => pickLegend(p)} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && pickLegend(p)}>
                <div className="gd-arxTag">{p.yr} · Legendary</div>
                <div className="gd-arxTitle">{p.name}</div>
                <div className="gd-arxFx">{p.fx}</div>
                <div className="gd-arxReal">{p.real}</div>
              </div>
            ))}
          </div>
        </div></div>
      )}
      {toast && <div className="gd-toast">{toast}</div>}
    </div>
  );

  /* round screen */
  return (
    <div className="gd-root"><style>{css()}</style>
      {header}
      <div className="gd-col">
        {scoreStrip}
        {network}
        {handArea}
        {papersRow}
      </div>
      {clearedOverlay}
      {g.failed && <div className="gd-overlay"><div className="gd-modal"><h2 className="gd-h2">Out of Training Runs</h2><p>The target slipped away…</p></div></div>}
      {modal && modal.type === "combos" && (
        <div className="gd-overlay" onClick={() => setModal(null)}><div className="gd-modal wide" onClick={e => e.stopPropagation()}>
          <h2 className="gd-h2">Combo recipes <span className="gd-tiny">order matters — build these exactly, left to right</span></h2>
          <div className="gd-comboList">
            {PATTERNS.map(p => {
              const lv = g.levels[p.id] || 1;
              const locked = p.need > g.stackLimit;
              return (
                <div key={p.id} className={"gd-combo" + (locked ? " locked" : "")}>
                  <div className="gd-comboTop"><b>{p.name}</b><span className="gd-num2">{lvlSig(p, lv)} sig × {lvlGain(p, lv)} gain{lv > 1 ? ` · Lv${lv}` : ""}</span></div>
                  <div className="gd-comboRecipe">{p.recipe}</div>
                  <div className="gd-tiny">{p.why}{locked ? ` — needs ${p.need} slots (you have ${g.stackLimit}; your lab upgrades as eras pass)` : ""}</div>
                </div>
              );
            })}
          </div>
          <button className="gd-play alt" onClick={() => setModal(null)}>Close</button>
        </div></div>
      )}
      {modal && modal.type === "notebook" && (
        <div className="gd-overlay" onClick={() => setModal(null)}><div className="gd-modal wide" onClick={e => e.stopPropagation()}>
          <h2 className="gd-h2">📓 Lab Notebook <span className="gd-tiny">{g.notebookUnlocked.length}/{NOTEBOOK.length} — new ideas unlock as you meet them in play</span></h2>
          <div className="gd-nbGrid">
            <div className="gd-nbList">
              {NOTEBOOK.map(x => {
                const open = g.notebookUnlocked.includes(x.id);
                return <button key={x.id} disabled={!open} className={"gd-nbItem" + (modal.sel === x.id ? " on" : "")} onClick={() => setModal({ ...modal, sel: x.id })}>{open ? x.title : "· · ·"}</button>;
              })}
            </div>
            <div className="gd-nbBody">
              {modal.sel ? (() => { const x = NOTEBOOK.find(q => q.id === modal.sel); return (<><h3>{x.title}</h3><p>{x.body}</p></>); })() : <div className="gd-dim">Pick an unlocked entry.</div>}
            </div>
          </div>
          <button className="gd-play alt" onClick={() => setModal(null)}>Close</button>
        </div></div>
      )}
      {modal && modal.type === "quiz" && (
        <div className="gd-overlay"><div className="gd-modal">
          <div className="gd-eyebrow">pop quiz · before the boss · worth 4⚡</div>
          <h2 className="gd-h2">One missing number</h2>
          <p className="gd-tiny">A layer really is just this: output = W·x. Row {modal.ch.blank + 1} of W, times x, added up. You can do it in your head.</p>
          <div className="gd-deriveRow">
            <MatrixV m={modal.ch.W} name="W (weights)" />
            <span className="gd-eqOp">·</span>
            <MatrixV m={modal.ch.x.map(v => [v])} name="x (input)" />
            <span className="gd-eqOp">=</span>
            <MatrixV m={modal.ch.y.map((v, i) => [i === modal.ch.blank && !modal.done ? "?" : v])} name="output" hot={modal.done} />
          </div>
          {!modal.done ? (
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <input className="gd-input" style={{ width: 110 }} value={modal.guess} onChange={e => setModal({ ...modal, guess: e.target.value })} placeholder="your answer" />
              <button className="gd-play" onClick={submitQuiz}>Check</button>
              <button className="gd-play alt" onClick={() => setModal(null)}>Skip</button>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <p>{modal.correct ? "✓ Nailed it — that's a real neural-network computation you just did." : `Row ${modal.ch.blank + 1}: ${modal.ch.W[modal.ch.blank].map((w, j) => `(${w}×${modal.ch.x[j]})`).join(" + ")} = ${modal.ch.y[modal.ch.blank]}.`}</p>
              <button className="gd-play" onClick={() => setModal(null)}>On to the boss →</button>
            </div>
          )}
        </div></div>
      )}
      {tut !== null && <Tutorial step={tut} setStep={setTut} />}
      {toast && <div className="gd-toast">{toast}</div>}
    </div>
  );
}

/* ---------- tutorial ---------- */
function Tutorial({ step, setStep }) {
  const s = TUTORIAL[step];
  if (!s) return null;
  return (
    <div className="gd-overlay">
      <div className="gd-modal" style={{ maxWidth: 480 }}>
        <div className="gd-eyebrow">how to play · {step + 1} / {TUTORIAL.length}</div>
        <h2 className="gd-h2">{s.t}</h2>
        <p style={{ lineHeight: 1.65 }}>{s.b}</p>
        {step === 3 && <div className="gd-tutEq">SCORE = Signal × Gain × Generalization</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 14 }}>
          <button className="gd-play alt" onClick={() => setStep(null)}>Skip</button>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && <button className="gd-play alt" onClick={() => setStep(step - 1)}>← Back</button>}
            {step < TUTORIAL.length - 1
              ? <button className="gd-play" onClick={() => setStep(step + 1)}>Next →</button>
              : <button className="gd-play" onClick={() => setStep(null)}>Let's build! →</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function MatrixV({ m, name, hot }) {
  return (
    <div className="gd-matWrap">
      {name && <div className="gd-matName">{name}</div>}
      <div className="gd-mat" style={{ gridTemplateColumns: `repeat(${m[0].length}, auto)` }}>
        {m.map((row, i) => row.map((v, j) => <div key={i + "-" + j} className={"gd-cell" + (hot ? " hot" : "")}>{v}</div>))}
      </div>
    </div>
  );
}

/* ---------- styles ---------- */
function css() {
  return `
  .gd-root{min-height:100vh;background:#f6f2e7;color:#2b2a25;font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:13px;
    background-image:linear-gradient(rgba(60,55,40,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(60,55,40,.05) 1px,transparent 1px);background-size:22px 22px;}
  .gd-root *{box-sizing:border-box}
  .gd-root button{font-family:inherit;cursor:pointer}
  .gd-root button:disabled{cursor:default}
  .gd-root button:focus-visible,.gd-root input:focus-visible{outline:2px solid #2b2a25;outline-offset:2px}
  .gd-center{display:flex;align-items:center;justify-content:center;padding:24px}
  .gd-col{max-width:1040px;margin:0 auto;padding:12px 14px 40px}
  .gd-menu{max-width:640px;text-align:center;background:#fffdf6;border:1.5px solid #2b2a25;border-radius:12px;box-shadow:4px 4px 0 rgba(43,42,37,.15);padding:34px 30px}
  .gd-eyebrow{letter-spacing:.14em;text-transform:uppercase;font-size:10px;color:#8a8271}
  .gd-title{font-family:Georgia,serif;font-size:54px;line-height:.95;margin:10px 0 12px}
  .gd-sub{color:#57534a;max-width:520px;margin:0 auto 18px;line-height:1.6}
  .gd-menurow{margin:12px 0}
  .gd-lab{display:inline-flex;gap:8px;align-items:center;font-size:12px}
  .gd-input{border:1.5px solid #2b2a25;border-radius:6px;background:#fff;padding:7px 10px;font-family:inherit;font-size:13px}
  .gd-play{border:1.5px solid #2b2a25;background:#2b2a25;color:#f6f2e7;border-radius:8px;padding:10px 18px;font-size:13px;box-shadow:3px 3px 0 rgba(43,42,37,.2)}
  .gd-play:disabled{opacity:.4;box-shadow:none}
  .gd-play.alt{background:#fffdf6;color:#2b2a25}
  .gd-howto{margin-top:14px;font-size:11px;color:#8a8271}
  .gd-tiny{font-size:10px;color:#8a8271;font-style:normal;font-weight:400}
  .gd-tiny2{font-size:10px;opacity:.75}
  .gd-dim{color:#8a8271;font-size:11px}
  .gd-top{display:flex;align-items:center;gap:14px;padding:9px 16px;border-bottom:1.5px solid #2b2a25;background:#fbf7ea;flex-wrap:wrap}
  .gd-brand{font-family:Georgia,serif;font-weight:700}
  .gd-topmid{flex:1;color:#57534a;font-size:12px;min-width:200px}
  .gd-topbtns{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  .gd-chip{border:1.5px solid #2b2a25;border-radius:20px;background:#fff;padding:3px 10px;font-weight:700}
  .gd-tbtn{border:1.5px solid #2b2a25;border-radius:6px;background:#fffdf6;padding:5px 10px;font-size:11px}
  .gd-tbtn.on{background:#2b2a25;color:#f6f2e7}
  .gd-eq{background:#fffdf6;border:1.5px solid #2b2a25;border-radius:10px;box-shadow:3px 3px 0 rgba(43,42,37,.12);padding:10px 14px;margin:12px 0}
  .gd-eqRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .gd-eqLabel{font-family:Georgia,serif;font-weight:700}
  .gd-eqTerm{font-size:12px;color:#57534a}
  .gd-eqOp{color:#8a8271}
  .gd-num{font-size:17px;color:#2b2a25;margin-left:4px}
  .gd-num2{font-size:12px;color:#0f766e;font-weight:700}
  .gd-eqScore{font-size:24px;color:#0f766e}
  .gd-progressWrap{margin-top:8px}
  .gd-progressLabel{font-size:11px;color:#57534a;margin-bottom:3px}
  .gd-bar{height:12px;border:1.5px solid #2b2a25;border-radius:7px;background:#fff;overflow:hidden}
  .gd-barFill{height:100%;background:repeating-linear-gradient(45deg,#0f766e,#0f766e 6px,#15857c 6px,#15857c 12px);transition:width .5s}
  .gd-meta{display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;font-size:11px;color:#57534a;align-items:center}
  .gd-suitI{font-style:normal;margin-right:2px;display:inline-flex;align-items:center;vertical-align:middle}
  .gd-suitI svg{display:block}
  .gd-valTag{color:#b45309;font-weight:700}
  .gd-boss{margin-top:8px;border:1.5px solid #b3261e;background:#fbeeed;color:#7f1d17;border-radius:7px;padding:7px 10px;font-size:12px;line-height:1.5}
  .gd-netWrap,.gd-handWrap{background:#fffdf6;border:1.5px solid #2b2a25;border-radius:10px;box-shadow:3px 3px 0 rgba(43,42,37,.12);padding:12px;margin-bottom:12px}
  .gd-netHead{display:flex;justify-content:space-between;gap:10px;font-size:11px;letter-spacing:.08em;color:#57534a;margin-bottom:10px;flex-wrap:wrap}
  .gd-patPrev{color:#0f766e;font-weight:700;letter-spacing:0}
  .gd-net{display:flex;align-items:center;gap:4px;flex-wrap:wrap;min-height:120px;padding:6px;border-radius:8px}
  .gd-io{width:74px;border:1.5px dashed #8a8271;border-radius:8px;padding:8px 4px;text-align:center;background:#fff}
  .gd-io.firing{border-style:solid;border-color:#0f766e;box-shadow:0 0 0 3px rgba(15,118,110,.2)}
  .gd-ioLbl{font-size:9px;letter-spacing:.12em;color:#57534a}
  .gd-outBig{font-size:22px;font-family:Georgia,serif;padding:2px 0}
  .gd-dots{display:flex;gap:3px;justify-content:center;padding:5px 0;flex-wrap:wrap}
  .gd-dot{width:8px;height:8px;border-radius:50%;background:#8a8271;display:inline-block}
  .gd-dot.in{background:#2b2a25}
  .gd-arrow{color:#c7c0af;font-size:18px;transition:color .2s}
  .gd-arrow.lit{color:#0f766e;text-shadow:0 0 6px rgba(15,118,110,.5)}
  .gd-layer{position:relative;width:96px;border:2.5px solid;border-radius:10px;padding:7px 5px;text-align:center;cursor:grab;transition:transform .18s,box-shadow .18s;box-shadow:2px 2px 0 rgba(43,42,37,.15)}
  .gd-layer:active{cursor:grabbing}
  .gd-layer.firing{transform:translateY(-8px) scale(1.1);box-shadow:0 8px 16px rgba(15,118,110,.35),0 0 0 3px rgba(15,118,110,.25)}
  .gd-layer.fired{box-shadow:2px 2px 0 rgba(15,118,110,.3)}
  .gd-layer.dragover{outline:2.5px dashed #2b2a25;outline-offset:3px}
  @media(prefers-reduced-motion:reduce){.gd-layer.firing{transform:none}}
  .gd-layerGlyph{font-size:20px;line-height:1;display:flex;justify-content:center}
  .gd-layerName{font-size:11px;font-weight:700;margin-top:2px}
  .gd-layerW{font-size:10px;color:#57534a}
  .gd-sigPop{position:absolute;top:-13px;right:-6px;background:#0f766e;color:#fff;font-size:11px;border-radius:9px;padding:1px 7px;animation:gdrise .4s ease-out}
  .gd-sigPop.zero{background:#b3261e;font-size:9px;max-width:90px}
  @keyframes gdrise{from{transform:translateY(8px);opacity:0}to{transform:none;opacity:1}}
  .gd-x{position:absolute;top:-8px;left:-8px;width:18px;height:18px;border-radius:50%;border:1.5px solid #2b2a25;background:#fff;font-size:9px;line-height:1;display:none;align-items:center;justify-content:center}
  .gd-layer:hover .gd-x{display:flex}
  .gd-slotGhost{width:96px;height:96px;border:1.5px dashed #c7c0af;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#c7c0af;font-size:18px}
  .gd-slotGhost.dragover{border-color:#2b2a25;color:#2b2a25;background:#fbf7ea}
  .gd-animBar{margin-top:10px;font-size:12px;color:#57534a;border-top:1px dashed #cfc8b6;padding-top:8px}
  .gd-final{color:#0f766e;font-weight:700;font-size:14px}
  .gd-notes{margin-top:10px;border-top:1px dashed #cfc8b6;padding-top:7px;font-size:11px;color:#57534a;line-height:1.55}
  .gd-actions{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}
  .gd-hand{display:flex;gap:8px;flex-wrap:wrap}
  .gd-card{position:relative;width:92px;border:2px solid #57534a;border-radius:9px;background:#fff;box-shadow:2px 2px 0 rgba(43,42,37,.16);padding:4px;transition:transform .12s;cursor:grab;user-select:none}
  .gd-card:hover{transform:translateY(-3px)}
  .gd-card.sel{transform:translateY(-8px);background:#fbf7ea;opacity:.55}
  .gd-card.static{cursor:default}
  .gd-card.static:hover{transform:none}
  .gd-cardKey{position:absolute;bottom:2px;right:5px;font-size:9px;color:#b7b0a0}
  .gd-ordBadge{position:absolute;top:-8px;right:-6px;color:#fff;width:19px;height:19px;border-radius:50%;font-size:10px;display:flex;align-items:center;justify-content:center;font-weight:700}
  .gd-cbTop{display:flex;justify-content:space-between;align-items:center;border-radius:5px;padding:2px 6px;font-weight:700}
  .gd-cbW{font-size:12px}
  .gd-cbGlyph{font-size:19px;padding:4px 0 0;display:flex;justify-content:center}
  .gd-cbName{font-size:10.5px;text-align:center}
  .gd-cbSig{font-size:9px;text-align:center;color:#8a8271;padding-bottom:2px}
  .gd-papersRow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:4px 2px}
  .gd-paperChip{border:1px solid #8a8271;border-left:4px solid #2b2a25;background:#fff;border-radius:4px;padding:3px 8px;font-size:10.5px;cursor:help}
  .gd-paperChip em{color:#8a8271;font-style:normal;font-size:9px}
  .gd-shop{max-width:1080px;margin:0 auto;padding:14px}
  .gd-shopHead{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
  .gd-h2{font-family:Georgia,serif;margin:6px 0}
  .gd-shopGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
  .gd-shopSec{background:#fffdf6;border:1.5px solid #2b2a25;border-radius:10px;padding:12px;box-shadow:3px 3px 0 rgba(43,42,37,.12)}
  .gd-pHead{font-family:Georgia,serif;font-weight:700;font-size:14px;border-bottom:1px dashed #b7b0a0;padding-bottom:5px;margin-bottom:8px}
  .gd-arxiv{border:1px solid #8a8271;background:#fff;border-radius:5px;padding:9px 11px;margin-bottom:9px;box-shadow:2px 2px 0 rgba(43,42,37,.08)}
  .gd-arxiv.legend{cursor:pointer;border:2px solid #b45309;max-width:270px}
  .gd-arxiv.legend:hover{background:#fbf3e4}
  .gd-arxTag{font-size:9px;letter-spacing:.1em;color:#8a8271;text-transform:uppercase}
  .gd-arxTitle{font-family:Georgia,serif;font-weight:700;font-size:14px;margin:2px 0}
  .gd-arxFx{font-size:11.5px;line-height:1.5}
  .gd-arxReal{font-size:10px;color:#57534a;font-style:italic;margin-top:3px;line-height:1.45}
  .gd-mini{border:1.5px solid #2b2a25;background:#fffdf6;border-radius:5px;font-size:10px;padding:3px 8px}
  .gd-mini.buy{background:#2b2a25;color:#f6f2e7;margin-top:6px}
  .gd-mini:disabled{opacity:.4}
  .gd-shopCardRow{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px}
  .gd-overlay{position:fixed;inset:0;background:rgba(43,42,37,.45);display:flex;align-items:center;justify-content:center;padding:16px;z-index:40}
  .gd-modal{background:#fffdf6;border:2px solid #2b2a25;border-radius:12px;box-shadow:6px 6px 0 rgba(43,42,37,.3);padding:20px 24px;max-width:620px;width:100%;max-height:88vh;overflow:auto}
  .gd-modal.wide{max-width:860px}
  .gd-comboList{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;margin:10px 0 14px}
  .gd-combo{border:1px solid #b7b0a0;border-radius:7px;background:#fff;padding:8px 10px}
  .gd-combo.locked{opacity:.55}
  .gd-comboTop{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
  .gd-comboRecipe{font-size:11px;color:#0f766e;margin:3px 0;font-weight:700}
  .gd-nbGrid{display:grid;grid-template-columns:190px 1fr;gap:14px;margin:12px 0}
  @media(max-width:640px){.gd-nbGrid{grid-template-columns:1fr}}
  .gd-nbList{display:flex;flex-direction:column;gap:4px}
  .gd-nbItem{text-align:left;border:1px solid #b7b0a0;border-radius:5px;background:#fff;padding:6px 9px;font-size:11px}
  .gd-nbItem.on{border-color:#2b2a25;background:#fbf7ea;font-weight:700}
  .gd-nbItem:disabled{color:#c7c0af}
  .gd-nbBody h3{font-family:Georgia,serif;margin:0 0 8px}
  .gd-nbBody p{line-height:1.7;font-size:12.5px}
  .gd-deriveRow{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:10px}
  .gd-matWrap{display:flex;flex-direction:column;align-items:center;gap:3px}
  .gd-matName{font-size:9px;color:#6d675a}
  .gd-mat{display:grid;border:1px solid #8a8271;background:#8a8271;gap:1px}
  .gd-cell{background:#fff;min-width:34px;padding:5px 7px;text-align:center;font-size:13px}
  .gd-cell.hot{background:#e2f2df}
  .gd-tutEq{font-family:Georgia,serif;font-size:17px;text-align:center;border:1.5px dashed #2b2a25;border-radius:8px;padding:10px;margin-top:10px;background:#fff}
  .gd-abstract{border:1px solid #8a8271;background:#fff;text-align:left;border-radius:5px;padding:12px 14px;margin:14px auto;max-width:480px}
  .gd-absHead{font-size:9px;letter-spacing:.14em;color:#8a8271}
  .gd-abstract p{font-size:12px;line-height:1.7}
  .gd-toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#2b2a25;color:#f6f2e7;border-radius:8px;padding:10px 18px;font-size:12px;z-index:60;box-shadow:0 4px 14px rgba(0,0,0,.3);max-width:90vw}
  `;
}
