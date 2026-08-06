import React, { useState, useEffect, useRef, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════════
   GRADIENT DESCENT
   A Balatro-like roguelike deck-builder where hands are neural
   architectures, jokers are landmark papers, and every score traces
   to real, hand-checkable matrix math shown on the Whiteboard.
   ═══════════════════════════════════════════════════════════════════ */

/* ---------- seeded RNG ---------- */
function hashStr(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ri = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const lg2 = x => Math.log(x) / Math.LN2;
const r1 = x => Math.round(x * 10) / 10;
const r2 = x => Math.round(x * 100) / 100;
const fmt = n => n >= 100000 ? (n / 1000).toFixed(0) + "k" : n.toLocaleString();

/* ---------- suits & layer types ---------- */
const SUITS = {
  V: { name: "Vision", sym: "▦", color: "#0f766e", bg: "#e4efed" },
  L: { name: "Language", sym: "¶", color: "#b45309", bg: "#f5ead8" },
  S: { name: "Sequence", sym: "∿", color: "#6d28d9", bg: "#ebe4f6" },
  T: { name: "Tabular", sym: "▤", color: "#475569", bg: "#e7eaee" },
};
const SUIT_IDS = ["V", "L", "S", "T"];
const WIDTHS = [2, 4, 8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 512];
const wSig = w => Math.round(8 * lg2(w));

const TYPES = {
  dense:   { name: "Dense",       glyph: "W·x",  cat: "dense",   era: 1, tip: "Linear map h = W·x" },
  conv:    { name: "Conv2D",      glyph: "⊛3×3", cat: "conv",    era: 2, tip: "+6 Signal · local features" },
  pool:    { name: "MaxPool",     glyph: "max↓", cat: "pool",    era: 2, tip: "+4 Signal · downsample" },
  relu:    { name: "ReLU",        glyph: "⌐",    cat: "act",     era: 1, tip: "+2 Gain · max(0,x)" },
  sigmoid: { name: "Sigmoid",     glyph: "σ",    cat: "act",     era: 1, tip: "+2 Gain · squash to (0,1)" },
  tanh:    { name: "Tanh",        glyph: "th",   cat: "act",     era: 1, tip: "+2 Gain · squash to (−1,1)" },
  gelu:    { name: "GELU",        glyph: "⌐̃",    cat: "act",     era: 3, tip: "+2 Gain · smooth ReLU" },
  norm:    { name: "LayerNorm",   glyph: "μ,σ",  cat: "norm",    era: 2, tip: "+1 Gain · removes depth penalty" },
  dropout: { name: "Dropout",     glyph: "⁙",    cat: "dropout", era: 2, tip: "+0.10 Generalization" },
  skip:    { name: "Skip",        glyph: "⤴+x",  cat: "skip",    era: 3, tip: "+1 Gain · removes depth penalty" },
  embed:   { name: "Embedding",   glyph: "id→ℝ", cat: "embed",   era: 4, tip: "+6 Signal · tokens to vectors" },
  recur:   { name: "RNN Cell",    glyph: "h←h",  cat: "recur",   era: 5, tip: "+4 Signal · carries state" },
  gatef:   { name: "Forget Gate", glyph: "f⊗",   cat: "gate",    era: 5, tip: "+1 Gain · LSTM component" },
  gatei:   { name: "Input Gate",  glyph: "i⊗",   cat: "gate",    era: 5, tip: "+1 Gain · LSTM component" },
  gateo:   { name: "Output Gate", glyph: "o⊗",   cat: "gate",    era: 5, tip: "+1 Gain · LSTM component" },
  gatec:   { name: "Candidate",   glyph: "c̃",    cat: "gate",    era: 5, tip: "+1 Gain · LSTM component" },
  q:       { name: "Q proj",      glyph: "Q",    cat: "q",       era: 6, tip: "+1 Gain · queries" },
  k:       { name: "K proj",      glyph: "K",    cat: "k",       era: 6, tip: "+1 Gain · keys" },
  v:       { name: "V proj",      glyph: "V",    cat: "v",       era: 6, tip: "+1 Gain · values" },
  softmax: { name: "Softmax",     glyph: "eˣ/Σ", cat: "softmax", era: 5, tip: "+1 Gain · scores → weights" },
  concat:  { name: "Concat",      glyph: "[a;b]",cat: "concat",  era: 6, tip: "+1 Gain · joins branches" },
};
const cat = c => TYPES[c.type].cat;

/* ---------- eras ---------- */
const ERAS = [
  { theme: "Toy tabular — XOR & Iris", suits: ["T"] },
  { theme: "Digit recognition (MNIST-like)", suits: ["V"] },
  { theme: "Natural images (CIFAR-like)", suits: ["V"] },
  { theme: "Sentiment / short text", suits: ["L"] },
  { theme: "Sequence-to-sequence", suits: ["S"] },
  { theme: "Long-context language", suits: ["L", "S"] },
  { theme: "Multimodal", suits: ["V", "L"] },
  { theme: "Frontier benchmark", suits: ["V", "L", "S", "T"] },
];
const eraInfo = e => e <= 8 ? ERAS[e - 1] : { theme: "Endless frontier " + (e - 8), suits: ["V", "L", "S", "T"] };
const eraBase = e => Math.round(150 * Math.pow(2, e - 1));
const eraData = e => Math.round(6000 * Math.pow(1.7, e - 1));
const BLINDS = ["Train Split", "Validation Split", "Benchmark Boss"];

/* ---------- architecture patterns (the "poker hands") ---------- */
const PATTERNS = [
  { id: "transformer", name: "Transformer Block", sig: 200, gain: 14, hint: "Q→K→Softmax→V→Norm→Dense→Act (7 cards)" },
  { id: "mha", name: "Multi-Head Attention", sig: 140, gain: 10, hint: "Q→K→Softmax→V + extra head card, end in Concat (6 cards)" },
  { id: "attn", name: "Attention Head", sig: 100, gain: 8, hint: "Q → K → Softmax → V" },
  { id: "lstm", name: "LSTM Cell", sig: 100, gain: 8, hint: "all four Gates + RNN Cell" },
  { id: "recloop", name: "Recurrent Loop", sig: 60, gain: 5, hint: "Embedding → RNN Cell → Dense" },
  { id: "bottleneck", name: "Bottleneck", sig: 50, gain: 4, hint: "wide → narrow → wide (by width)" },
  { id: "residual", name: "Residual Block", sig: 40, gain: 4, hint: "layer → layer → Skip" },
  { id: "normblock", name: "Normalized Block", sig: 35, gain: 3, hint: "layer → Norm → Activation" },
  { id: "featext", name: "Feature Extractor", sig: 30, gain: 3, hint: "Conv → Activation → Pool" },
  { id: "mlp", name: "MLP Block", sig: 20, gain: 2, hint: "Dense → Activation" },
  { id: "linear", name: "Linear Stack", sig: 10, gain: 1, hint: "2+ Dense" },
  { id: "single", name: "Single Layer", sig: 5, gain: 1, hint: "any 1 card" },
];
const PAT = Object.fromEntries(PATTERNS.map(p => [p.id, p]));
const lvlSig = (p, l) => Math.round(p.sig * (1 + 0.5 * (l - 1)));
const lvlGain = (p, l) => p.gain + (l - 1) * Math.max(1, Math.round(p.gain * 0.5));

function matchPattern(stack) {
  const seq = stack.map(cat), n = seq.length;
  if (n === 0) return null;
  const eq = need => n === need.length && need.every((t, i) => seq[i] === t);
  const isSub = need => { let i = 0; for (const s of seq) if (s === need[i]) i++; return i >= need.length; };
  const count = t => seq.filter(x => x === t).length;
  const w = stack.map(c => c.width);
  if (eq(["q", "k", "softmax", "v", "norm", "dense", "act"])) return PAT.transformer;
  if (n >= 6 && seq[n - 1] === "concat" && isSub(["q", "k", "softmax", "v"]) && count("q") + count("k") + count("v") >= 4) return PAT.mha;
  if (eq(["q", "k", "softmax", "v"])) return PAT.attn;
  if (n === 5 && count("gate") === 4 && count("recur") === 1 &&
    ["gatef", "gatei", "gateo", "gatec"].every(t => stack.some(c => c.type === t))) return PAT.lstm;
  if (eq(["embed", "recur", "dense"])) return PAT.recloop;
  if (n === 3 && seq[2] === "skip" && seq[0] !== "skip" && seq[1] !== "skip") return PAT.residual;
  if (n === 3 && seq[1] === "norm" && seq[0] !== "norm" && seq[2] === "act") return PAT.normblock;
  if (eq(["conv", "act", "pool"])) return PAT.featext;
  if (n === 3 && w[0] > w[1] && w[2] > w[1]) return PAT.bottleneck;
  if (eq(["dense", "act"])) return PAT.mlp;
  if (n >= 2 && seq.every(t => t === "dense")) return PAT.linear;
  return PAT.single;
}

/* ---------- papers (the "jokers") ---------- */
const PAPERS = [
  { id: "relu2011", name: "Rectifier Nonlinearities", yr: 2011, rar: 0, cost: 4, fx: "Activation cards give +4 Gain instead of +2.", real: "Showed ReLU trains deep nets faster and better than sigmoid/tanh." },
  { id: "dropout2014", name: "Dropout", yr: 2014, rar: 0, cost: 4, fx: "Randomly disables one played card; +6 Gain and +0.15 Generalization.", real: "Randomly zeroing units during training prevents co-adaptation and overfitting." },
  { id: "batchnorm2015", name: "Batch Normalization", yr: 2015, rar: 0, cost: 4, fx: "Norm cards give +2 Gain each and protect from depth penalty even under Vanishing Gradient bosses.", real: "Normalizing layer inputs stabilizes and accelerates deep training." },
  { id: "adam2015", name: "Adam", yr: 2015, rar: 0, cost: 4, fx: "Clear a blind with epochs remaining: +1 Gain per spare epoch for the whole next blind.", real: "Adaptive per-parameter learning rates made convergence fast and robust." },
  { id: "momentum1986", name: "SGD with Momentum", yr: 1986, rar: 0, cost: 4, fx: "Each consecutive hand playing the same pattern: +3 Gain per repeat (resets on change).", real: "Accumulating a velocity term smooths and speeds gradient descent." },
  { id: "xavier2010", name: "Xavier Init", yr: 2010, rar: 0, cost: 4, fx: "The first card each hand contributes double width Signal.", real: "Scaling initial weights by fan-in/fan-out keeps activations from exploding or dying." },
  { id: "earlystop", name: "Early Stopping", yr: 1990, rar: 0, cost: 4, fx: "Clearing a blind grants +4⚡ per epoch to spare.", real: "Halting when validation loss stops improving is regularization for free." },
  { id: "dataaug", name: "Data Augmentation", yr: 1998, rar: 0, cost: 4, fx: "+0.20 Generalization; −20% Signal.", real: "Transforming training examples multiplies effective data at no labeling cost." },
  { id: "weightdecay", name: "Weight Decay", yr: 1991, rar: 0, cost: 4, fx: "+0.10 Generalization per Dense card played.", real: "Penalizing large weights biases models toward simpler functions." },
  { id: "resnet2015", name: "Deep Residual Learning", yr: 2015, rar: 1, cost: 6, fx: "Depth penalty starts at card 6 instead of card 4; Skip cards give ×1.5 Gain.", real: "Identity shortcuts let gradients flow, making 100+ layer networks trainable." },
  { id: "attention2017", name: "Attention Is All You Need", yr: 2017, rar: 1, cost: 6, fx: "Attention patterns ×2 Gain; Recurrent patterns lose 50% Signal.", real: "Replaced recurrence entirely with self-attention — the transformer." },
  { id: "word2vec2013", name: "Word2Vec", yr: 2013, rar: 1, cost: 6, fx: "Embedding cards gain +4 Signal per distinct suit in your stack.", real: "Word meaning emerges as geometry in a learned vector space." },
  { id: "gan2014", name: "Generative Adversarial Nets", yr: 2014, rar: 1, cost: 6, fx: "After scoring, the hand re-runs at 40% value — the discriminator's turn.", real: "Two networks trained as adversaries; the generator learns to fool the critic." },
  { id: "unet2015", name: "U-Net", yr: 2015, rar: 1, cost: 6, fx: "If your stack's widths are symmetric (palindrome), Signal is doubled.", real: "A symmetric encoder–decoder with skip links; still the segmentation workhorse." },
  { id: "curriculum", name: "Curriculum Learning", yr: 2009, rar: 1, cost: 6, fx: "The first blind of every Era has its target reduced 25%.", real: "Training on easy examples first improves final performance." },
  { id: "layernorm2016", name: "Layer Normalization", yr: 2016, rar: 1, cost: 6, fx: "Norm cards give +5 Gain if any Sequence-suit card is in the stack.", real: "Per-example normalization that works for RNNs and transformers." },
  { id: "scalinglaws2020", name: "Scaling Laws", yr: 2020, rar: 2, cost: 8, fx: "Gain ×log₂(Parameters ÷ 1000) when Parameters > 2000 — the exact strategy overfitting punishes.", real: "Loss falls as a smooth power law in parameters, data, and compute." },
  { id: "moe", name: "Mixture of Experts", yr: 2017, rar: 2, cost: 8, fx: "Only your 2 highest-Signal cards trigger — at ×4 Signal each.", real: "Route each input to a few expert subnetworks; huge capacity, sparse compute." },
  { id: "chinchilla2022", name: "Chinchilla", yr: 2022, rar: 2, cost: 8, fx: "Generalization loses its floor and cap, but Data Budget is tripled.", real: "Most large models were undertrained: scale data with parameters." },
  { id: "grokpaper", name: "Grokking", yr: 2022, rar: 2, cost: 8, fx: "+0.25 Generalization on Validation and Boss blinds.", real: "Long after memorizing, networks can suddenly snap into generalizing." },
  { id: "backprop1986", name: "Backpropagation", yr: 1986, rar: 3, cost: 0, fx: "After each blind, every pattern you played during it gains a level.", real: "The chain rule, applied recursively, trains every network in this game." },
  { id: "alexnet2012", name: "AlexNet", yr: 2012, rar: 3, cost: 0, fx: "Vision suit penalties never apply; Conv cards contribute double Signal.", real: "GPU-trained convnet that halved ImageNet error and started the deep learning era." },
  { id: "diffusion2020", name: "Denoising Diffusion", yr: 2020, rar: 3, cost: 0, fx: "Every hand scores at a hidden ×0.5–×3.0 multiplier, revealed on scoring.", real: "Generate by learning to reverse gradual noising — sampling from noise." },
  { id: "scalinghyp", name: "The Scaling Hypothesis", yr: 2021, rar: 3, cost: 0, fx: "+1 stack size and +1 Paper slot, but all blind targets +40%.", real: "The bet that scale itself, not new mechanisms, buys general capability." },
];
const PAPER = Object.fromEntries(PAPERS.map(p => [p.id, p]));
const RARITY = ["Common", "Uncommon", "Rare", "Legendary"];

/* ---------- boss constraints ---------- */
const BOSSES = [
  { id: "shift", name: "Distribution Shift", desc: s => `${SUITS[s].name} ${SUITS[s].sym} cards contribute zero Signal this blind.` },
  { id: "imbalance", name: "Class Imbalance", desc: () => "Cards with width below 16 score no Signal." },
  { id: "overfit", name: "Overfitting", desc: () => "Generalization is squared this blind." },
  { id: "computecap", name: "Compute Cap", desc: (s, cap) => `Stacks over ${fmt(cap)} Parameters score half.` },
  { id: "vanish", name: "Vanishing Gradient", desc: () => "Depth penalty applies from card 2; Norm cards don't protect (Skip still does)." },
  { id: "explode", name: "Exploding Gradient", desc: () => "Any single card contributing over 100 Signal zeroes the hand." },
  { id: "adversarial", name: "Adversarial Examples", desc: () => "Your highest-Signal card is discarded before scoring each hand." },
  { id: "coldstart", name: "Cold Start", desc: () => "Your first hand this blind scores nothing." },
  { id: "forgetting", name: "Catastrophic Forgetting", desc: () => "Patterns lose one level each time you play them this blind." },
];

/* ---------- consumables ---------- */
const DATA_CARDS = [
  { id: "normalize", name: "Normalize", need: "2–3 stacked cards", fx: "Set the stacked cards to the widest of their widths." },
  { id: "tokenize", name: "Tokenize", need: "1+ stacked cards", fx: "Convert stacked cards to Language ¶ suit." },
  { id: "onehot", name: "One-Hot", need: "1+ stacked cards", fx: "Convert stacked cards to Tabular ▤ suit." },
  { id: "augmentc", name: "Augment", need: "1 stacked card", fx: "Add a permanent copy of the stacked card to your deck." },
  { id: "quantize", name: "Quantize", need: "1 stacked card", fx: "Halve the card's width; it permanently gives +3 Gain when played." },
  { id: "pca", name: "PCA", need: "2 stacked cards", fx: "Destroy both; add one Dense card of their combined width (capped at 512)." },
  { id: "labelnoise", name: "Label Noise", need: "1 stacked card", fx: "Destroy the card; gain 4⚡ compute." },
];
const RESEARCH_CARDS = [
  { id: "pretrain", name: "Pretraining", fx: "A random pattern gains +2 levels; 2 random cards leave your deck." },
  { id: "distill", name: "Distillation", fx: "Halve every card width in your deck; every pattern gains +1 level." },
  { id: "grokking", name: "Grokking Run", fx: "This blind: Generalization is fixed at 2.0, but you drop to 1 epoch remaining." },
  { id: "nas", name: "Architecture Search", fx: "Reroll the layer type of 6 random deck cards among your unlocked types." },
];
const HYPER_MAP = {
  mlp: ["Learning Rate", "the step size that trains a plain MLP well"],
  linear: ["Batch Size", "how many rows you average before one gradient step"],
  single: ["Warmup Schedule", "easing the learning rate in from zero"],
  featext: ["Momentum", "velocity that carries conv features through plateaus"],
  normblock: ["Weight Decay", "the L2 penalty that keeps normalized blocks tame"],
  residual: ["Stochastic Depth", "randomly dropping residual blocks while training"],
  bottleneck: ["Cosine Decay", "annealing the rate as the code compresses"],
  recloop: ["Epochs", "more passes over the sequence corpus"],
  lstm: ["Gradient Clipping", "capping gradients so gates don't explode"],
  attn: ["Temperature", "the divisor inside softmax(QKᵀ/√d)"],
  mha: ["Head Dropout", "regularizing across parallel attention heads"],
  transformer: ["LR Schedule", "warmup-then-decay, as in the original paper"],
};

/* ---------- lab notebook ---------- */
const NOTEBOOK = [
  { id: "overfitting", title: "Overfitting", ex: "Dropout_Tom.Yeh.xlsx", body: "A model with more parameters than its data can justify will memorize the training set instead of learning the rule. That is why your Generalization term is Data ÷ Parameters: a 2-layer stack of 64-wide Dense cards costs 64×64 + 64×64 = 8,192 parameters, so with a 6,000-row Data Budget it scores ×0.73 on validation. The same stack at width 512 costs 524,288 parameters and slams into the ×0.25 floor. Training score keeps rising with width; validation score does not. Every regularizer in this game — Dropout, Weight Decay, Augmentation — exists to buy that ratio back, usually by paying Signal for it." },
  { id: "vanishing", title: "Vanishing Gradients", ex: "Backpropagation_Tom.Yeh.xlsx", body: "Backprop multiplies derivatives layer by layer. If each layer's contribution is a bit less than one, the product shrinks geometrically: your ×0.8-per-extra-layer penalty is exactly this, and 0.8⁴ ≈ 0.41 — a 7-deep stack keeps less than half its Signal. Two fixes changed the field. Skip connections (ResNet, 2015) add the input straight to the output, giving gradients an identity path. Normalization (BatchNorm 2015, LayerNorm 2016) keeps activations in a healthy range so derivatives don't shrink. That is why either card in your stack removes the penalty entirely." },
  { id: "dropout", title: "Dropout", ex: "Dropout_Tom.Yeh.xlsx", body: "During training, zero each unit with probability p — the Whiteboard shows one element of your activation vector struck to 0. No unit can rely on a specific partner, so the network learns redundant, robust features; at test time all units fire, scaled by 1−p. It is a pure trade: you lose raw capacity (Signal) and gain generalization, which is precisely how the card and the paper are priced. Try the spreadsheet exercise: zero one hidden cell by hand and watch how the output redistributes." },
  { id: "batchnorm", title: "Normalization", ex: "Batch.normalization_Tom.Yeh.xlsx", body: "Take the activation vector, subtract its mean, divide by its standard deviation: x̂ = (x−μ)/σ. For x = [4, 0, 2, 2], μ = 2, σ = √2, so x̂ ≈ [1.4, −1.4, 0, 0]. Each layer now receives inputs in a predictable range regardless of what the layer below did, so learning rates can be higher and depth stops hurting — which is why Norm cards cancel the depth penalty. BatchNorm normalizes across a batch; LayerNorm across the feature vector itself, which is what transformers use and what your Whiteboard computes." },
  { id: "resnet", title: "Residual Connections", ex: "Backpropagation_Tom.Yeh.-.2.xlsx", body: "A residual block computes h = f(x) + x. If the block learns nothing useful, f(x) → 0 and the block is a free identity — depth can no longer make things worse, only better. In the backward pass, the +x term contributes derivative 1, an unshrinkable gradient highway. Before ResNet (2015), 20 layers was deep; after, 152 was routine. In-game: a Skip card removes the depth penalty and the ResNet paper lets stacks run two cards deeper — the same purchase the field made." },
  { id: "attention", title: "Self-Attention", ex: "Self-attention_Tom.Yeh.xlsx", body: "Each token makes three vectors: a Query (what am I looking for?), a Key (what do I contain?), and a Value (what do I pass along?). Scores S = QKᵀ compare every query to every key; softmax turns each row into weights summing to 1; the output is the weight-averaged Values. Your Whiteboard runs this on 3 tokens exactly as the spreadsheet exercise does — follow one row: a dot product, an exponentiation, a division, a weighted sum. Cost grows with context length squared, but any token can see any other in one step, which recurrence can't do." },
  { id: "mha", title: "Multi-Head Attention", ex: "Multihead_Attention.xlsx", body: "One attention head averages Values under one notion of relevance. Multiple heads run the same Q/K/V machinery in parallel with different learned projections — one head might track syntax, another coreference — and their outputs are concatenated and mixed by a final linear map. That is why the pattern in this game ends in a Concat card. Heads are cheap: split the model width across them and total compute stays the same as one big head." },
  { id: "lstm", title: "LSTM Gates", ex: "LSTM_Tom.Yeh.xlsx", body: "A plain RNN overwrites its state every step, so old information decays. The LSTM keeps a cell state c and edits it with four learned gates: forget f = σ(W_f x) scales down old memory, input i = σ(W_i x) admits a candidate c̃ = tanh(W_c x), and the update is c ← f⊙c + i⊙c̃; the output gate o decides what to reveal: h = o⊙tanh(c). All four gate cards plus the cell are needed because each is a separate weight matrix. The Whiteboard computes one full update — the same arithmetic as the spreadsheet, one timestep by hand." },
  { id: "backprop", title: "Backpropagation & Training", ex: "FF.Back.propagation.xlsx", body: "Leveling a pattern is 'training that component longer,' and the algorithm doing the training is backpropagation: run the forward pass, measure the loss, then apply the chain rule backwards, layer by layer, to get each weight's gradient, and step downhill — gradient descent, the game's namesake. Every Hyperparameter card names something that governs that loop: learning rate is the step size, batch size the rows averaged per step, momentum the velocity term. The forward passes on your Whiteboard are the exact quantities the backward pass differentiates." },
  { id: "word2vec", title: "Embeddings", ex: "Vector.database_Tom.Yeh.xlsx", body: "Words, pixels patches, and table categories enter a network as integer ids, which carry no geometry. An Embedding layer is a lookup table of learned vectors: id 7 → row 7 of a matrix. Train it to predict context (Word2Vec, 2013) and similar things end up near each other; famously, king − man + woman lands near queen. This is also how vector databases retrieve: embed the query, find nearest stored vectors by dot product — the same arithmetic as one attention score." },
  { id: "autoencoder", title: "Bottlenecks & Autoencoders", ex: "Superpositon_Tom.Yeh.xlsx", body: "Force a wide input through a narrow middle and back out — wide → narrow → wide — and the network must keep only what matters: a learned compression. The narrow code is a representation; decode it to reconstruct the input and you have an autoencoder. Squeeze more features than dimensions through the middle and features must share directions — superposition, the subject of the exercise. U-Net's symmetric shape is this idea with skip connections rescuing the details." },
  { id: "moe", title: "Mixture of Experts", ex: "Deepseek_V4_Blank_Tom.Yeh.copy.xlsx", body: "Instead of pushing every input through every parameter, a small router scores a set of expert subnetworks and sends each token to the top-k — usually 2. Capacity scales with the number of experts while compute stays nearly flat, which is how frontier models grow parameters without growing cost per token. Your MoE paper is literal: only the top 2 cards trigger, at ×4 — sparse activation, amplified experts. The DeepSeek exercise walks the routing arithmetic by hand." },
];

/* ═══════════════ SCORING ENGINE ═══════════════
   SCORE = ( Σ Signal ) × Gain × Generalization  */
function scoreHand(stack, ctx) {
  // ctx: { kind, era, boss, bossSuit, capVal, data, papers(Set), levels, suits, streak, handIndex, adamBonus, seed, grokking }
  const P = ctx.papers;
  const n = stack.length;
  const pat = matchPattern(stack);
  const lvl = (ctx.levels[pat.id] || 1);
  const patSig = lvlSig(pat, lvl);
  const patGain = lvlGain(pat, lvl);
  const suitsSet = new Set(ctx.suits);
  const rr = mulberry32(hashStr(ctx.seed + "|hand" + ctx.handIndex));
  const notes = [];
  const isBoss = ctx.kind === "boss";
  const bossId = isBoss && ctx.boss ? ctx.boss.id : null;
  const distinctSuits = new Set(stack.map(c => c.suit)).size;

  // per-card signal
  let gainAdd = 0, gainMult = 1, reg = 0;
  const cardSigs = stack.map((c, i) => {
    const tc = cat(c);
    let aff = suitsSet.has(c.suit) ? 1 : 0.5;
    if (P.has("alexnet2012") && c.suit === "V") aff = 1;
    let s = Math.round(wSig(c.width) * aff);
    let note = aff < 1 ? "off-suit ×0.5" : "";
    if (P.has("xavier2010") && i === 0) { s += Math.round(wSig(c.width) * aff); note = "Xavier: 1st card ×2 width"; }
    if (tc === "conv") { s += 6; if (P.has("alexnet2012")) { s *= 2; note = "AlexNet: conv ×2"; } }
    if (tc === "pool") s += 4;
    if (tc === "embed") { s += 6; if (P.has("word2vec2013")) { s += 4 * distinctSuits; note = "Word2Vec +" + 4 * distinctSuits; } }
    if (tc === "recur") s += 4;
    if (tc === "act") gainAdd += P.has("relu2011") ? 4 : 2;
    if (tc === "norm") { gainAdd += 1; if (P.has("batchnorm2015")) gainAdd += 2; if (P.has("layernorm2016") && stack.some(x => x.suit === "S")) gainAdd += 5; }
    if (tc === "skip") { gainAdd += 1; if (P.has("resnet2015")) gainMult *= 1.5; }
    if (["gate", "q", "k", "v", "softmax", "concat"].includes(tc)) gainAdd += 1;
    if (tc === "dropout") reg += 0.10;
    if (c.pGain) gainAdd += c.pGain;
    if (P.has("weightdecay") && tc === "dense" && ctx.kind !== "train") reg += 0.10;
    if (bossId === "shift" && c.suit === ctx.bossSuit) { s = 0; note = "Distribution Shift: zeroed"; }
    if (bossId === "imbalance" && c.width < 16) { s = 0; note = "Class Imbalance: zeroed"; }
    return { sig: s, note };
  });

  if (P.has("moe")) {
    const order = cardSigs.map((c, i) => [c.sig, i]).sort((a, b) => b[0] - a[0]);
    const keep = new Set(order.slice(0, 2).map(o => o[1]));
    cardSigs.forEach((c, i) => { if (keep.has(i)) { c.sig *= 4; c.note = "MoE expert ×4"; } else { c.sig = 0; c.note = "MoE: not routed"; } });
    notes.push("Mixture of Experts: top-2 cards ×4, others skipped");
  }
  if (bossId === "adversarial" && n > 0) {
    let hi = 0; cardSigs.forEach((c, i) => { if (c.sig > cardSigs[hi].sig) hi = i; });
    cardSigs[hi].sig = 0; cardSigs[hi].note = "Adversarial: discarded";
    notes.push("Adversarial Examples removed your strongest card");
  }
  let dropIdx = -1;
  if (P.has("dropout2014") && n > 0) {
    dropIdx = Math.floor(rr() * n);
    cardSigs[dropIdx].sig = 0; cardSigs[dropIdx].note = "Dropout: disabled";
    gainAdd += 6; reg += 0.15;
  }
  if (P.has("dropout2014")) notes.push("Dropout paper: 1 card disabled, +6 Gain, +0.15 Gen");

  let sumCards = cardSigs.reduce((a, c) => a + c.sig, 0);
  let totalSig = patSig + sumCards;

  // U-Net symmetry
  const w = stack.map(c => c.width);
  if (P.has("unet2015") && n >= 3 && w.every((x, i) => x === w[n - 1 - i])) { totalSig *= 2; notes.push("U-Net: symmetric widths, Signal ×2"); }
  // Attention paper hurts recurrence
  if (P.has("attention2017") && (pat.id === "recloop" || pat.id === "lstm")) { totalSig = Math.round(totalSig * 0.5); notes.push("Attention Is All You Need: recurrent Signal −50%"); }

  // depth penalty (vanishing gradients)
  let pStart = P.has("resnet2015") ? 5 : 3;
  if (bossId === "vanish") pStart = 1;
  const hasSkip = stack.some(c => cat(c) === "skip");
  const hasNorm = stack.some(c => cat(c) === "norm");
  let protectd = hasSkip || hasNorm;
  if (bossId === "vanish") protectd = hasSkip || (hasNorm && P.has("batchnorm2015"));
  const extraDepth = Math.max(0, n - pStart);
  let depthApplied = false;
  if (extraDepth > 0 && !protectd) {
    totalSig = Math.round(totalSig * Math.pow(0.8, extraDepth));
    depthApplied = true;
    notes.push(`Depth penalty: ×0.8^${extraDepth} (no Skip/Norm)`);
  } else if (extraDepth > 0) {
    notes.push("Depth penalty removed by " + (hasSkip ? "Skip" : "Norm"));
  }
  if (P.has("dataaug")) { totalSig = Math.round(totalSig * 0.8); reg += 0.20; notes.push("Data Augmentation: Signal −20%, +0.20 Gen"); }

  // parameters
  let params = n > 1 ? w.slice(0, -1).reduce((a, x, i) => a + x * w[i + 1], 0) : w[0] * w[0];

  // gain
  let gain = patGain + gainAdd;
  if (P.has("momentum1986") && ctx.streak && ctx.streak.pat === pat.id && ctx.streak.count > 0) { gain += 3 * ctx.streak.count; notes.push(`Momentum streak ×${ctx.streak.count}: +${3 * ctx.streak.count} Gain`); }
  if (ctx.adamBonus) { gain += ctx.adamBonus; notes.push(`Adam: +${ctx.adamBonus} Gain (fast convergence last blind)`); }
  gain *= gainMult;
  if (P.has("attention2017") && ["attn", "mha", "transformer"].includes(pat.id)) { gain *= 2; notes.push("Attention Is All You Need: ×2 Gain"); }
  if (P.has("scalinglaws2020") && params > 2000) { const m = r1(lg2(params / 1000)); gain *= m; notes.push(`Scaling Laws: Gain ×${m} = log₂(${fmt(params)}/1000)`); }
  gain = r1(gain);

  // generalization
  let gen, genExpr;
  const dataB = P.has("chinchilla2022") ? ctx.data * 3 : ctx.data;
  if (ctx.grokking) { gen = 2.0; genExpr = "Grokking: fixed at 2.0"; }
  else if (ctx.kind === "train") { gen = 1.0; genExpr = "Train split: 1.0"; }
  else {
    let base = dataB / params;
    if (!P.has("chinchilla2022")) base = clamp(base, 0.25, 1.0);
    base = r2(Math.max(0, base));
    gen = r2(base + reg);
    genExpr = `${fmt(dataB)} data ÷ ${fmt(params)} params = ${base}` + (reg > 0 ? ` + ${r2(reg)} reg` : "");
    if (bossId === "overfit") { gen = r2(gen * gen); genExpr += " → squared (boss)"; }
  }

  let score = Math.round(totalSig * gain * gen);
  let diffMult = 0;
  if (P.has("diffusion2020")) { diffMult = r1(0.5 + rr() * 2.5); score = Math.round(score * diffMult); notes.push(`Diffusion: hidden multiplier revealed ×${diffMult}`); }
  if (P.has("gan2014")) { score = Math.round(score * 1.4); notes.push("GAN: discriminator's turn, +40%"); }
  if (bossId === "computecap" && params > ctx.capVal) { score = Math.round(score / 2); notes.push(`Compute Cap exceeded (${fmt(params)} > ${fmt(ctx.capVal)}): score halved`); }
  if (bossId === "explode" && cardSigs.some(c => c.sig > 100)) { score = 0; notes.push("Exploding Gradient: a card exceeded 100 Signal — hand zeroed"); }
  if (bossId === "coldstart" && ctx.handIndex === 0) { score = 0; notes.push("Cold Start: first hand scores nothing"); }

  return { pat, lvl, patSig, patGain, cardSigs, totalSig, gain, gen, genExpr, params, score, notes, depthApplied, dropIdx };
}

/* ═══════════════ FORWARD PASS (the Whiteboard's math) ═══════════════ */
const sig01 = x => r2(1 / (1 + Math.exp(-x)));
const actFns = { relu: x => Math.max(0, x), sigmoid: sig01, tanh: x => r2(Math.tanh(x)), gelu: x => r2(x * (1 / (1 + Math.exp(-1.702 * x)))) };
const col = v => v.map(x => [x]);
function matmul(A, B) { return A.map(row => B[0].map((_, j) => r2(row.reduce((a, x, k) => a + x * B[k][j], 0)))); }
function smallMat(r, rows, cols, lo, hi) { return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ri(r, lo, hi))); }

function computeForwardPass(stack, seed, res, dataBudget) {
  const r = mulberry32(hashStr(seed + "|fwd"));
  const steps = [];
  const patId = res.pat.id;
  const attnLike = ["attn", "mha", "transformer"].includes(patId);

  if (attnLike) {
    const X = smallMat(r, 3, 4, 0, 2);
    steps.push({ card: -1, title: "Benchmark input · 3 tokens × 4 dims", mats: [{ name: "X", m: X }], note: "Each row is one token's vector." });
    const Wq = smallMat(r, 4, 3, -1, 1), Wk = smallMat(r, 4, 3, -1, 1), Wv = smallMat(r, 4, 3, -1, 1);
    const Q = matmul(X, Wq), K = matmul(X, Wk), V = matmul(X, Wv);
    let ci = 0;
    stack.forEach((c, i) => {
      const tc = cat(c);
      if (tc === "q") steps.push({ card: i, title: "Q = X·W_q", mats: [{ name: "W_q", m: Wq }, { name: "Q", m: Q, hot: true }] });
      else if (tc === "k") {
        const Kt = K[0].map((_, j) => K.map(row => row[j]));
        const S = matmul(Q, Kt);
        steps.push({ card: i, title: "K = X·W_k, then scores S = Q·Kᵀ", mats: [{ name: "K", m: K }, { name: "S = QKᵀ", m: S, hot: true }], note: "S[i][j]: how much token i attends to token j.", S });
      }
      else if (tc === "softmax") {
        const S = steps.find(s => s.S) ? steps.find(s => s.S).S : matmul(Q, K[0].map((_, j) => K.map(row => row[j])));
        const A = S.map(row => { const ex = row.map(x => Math.exp(x / 2)); const su = ex.reduce((a, b) => a + b, 0); return ex.map(x => r2(x / su)); });
        steps.push({ card: i, title: "A = softmax(S/2), row-wise", mats: [{ name: "A", m: A, hot: true }], note: "Each row sums to 1.00 — attention weights.", A });
      }
      else if (tc === "v") {
        const A = steps.find(s => s.A) ? steps.find(s => s.A).A : null;
        const O = A ? matmul(A, V) : V;
        steps.push({ card: i, title: "V = X·W_v, output O = A·V", mats: [{ name: "V", m: V }, { name: "O = A·V", m: O, hot: true }], note: "Weighted average of Values — the Tom Yeh self-attention exercise, exactly." });
      }
      else if (tc === "norm") {
        steps.push({ card: i, title: "LayerNorm over each row", mats: [], note: "x̂ = (x − μ)/σ per token — keeps the residual stream in range." });
      }
      else if (tc === "concat") {
        steps.push({ card: i, title: "Concat heads", mats: [], note: "Parallel heads' outputs are joined, then mixed by a linear map." });
      }
      else if (tc === "act") {
        steps.push({ card: i, title: TYPES[c.type].name + " applied position-wise", mats: [], note: "The same nonlinearity hits every token's vector elementwise." });
      } else {
        const Wd = smallMat(r, 4, 3, -1, 1);
        steps.push({ card: i, title: TYPES[c.type].name + " on the stream", mats: [{ name: "W", m: Wd }], note: "Applied position-wise to each token." });
      }
      ci++;
    });
  } else if (patId === "lstm") {
    const x = Array.from({ length: 4 }, () => ri(r, 0, 2));
    const cPrev = Array.from({ length: 4 }, () => ri(r, -1, 2));
    steps.push({ card: -1, title: "Input x and previous cell state c", mats: [{ name: "x", m: col(x) }, { name: "c_prev", m: col(cPrev) }] });
    const gates = {};
    stack.forEach((c, i) => {
      const W = smallMat(r, 4, 4, -1, 1);
      const z = matmul(W, col(x)).map(row => row[0]);
      if (c.type === "gatef") { gates.f = z.map(sig01); steps.push({ card: i, title: "Forget gate f = σ(W_f·x)", mats: [{ name: "W_f", m: W }, { name: "f", m: col(gates.f), hot: true }] }); }
      else if (c.type === "gatei") { gates.i = z.map(sig01); steps.push({ card: i, title: "Input gate i = σ(W_i·x)", mats: [{ name: "W_i", m: W }, { name: "i", m: col(gates.i), hot: true }] }); }
      else if (c.type === "gatec") { gates.ct = z.map(v => r2(Math.tanh(v))); steps.push({ card: i, title: "Candidate c̃ = tanh(W_c·x)", mats: [{ name: "W_c", m: W }, { name: "c̃", m: col(gates.ct), hot: true }] }); }
      else if (c.type === "gateo") { gates.o = z.map(sig01); steps.push({ card: i, title: "Output gate o = σ(W_o·x)", mats: [{ name: "W_o", m: W }, { name: "o", m: col(gates.o), hot: true }] }); }
      else if (c.type === "recur") {
        const f = gates.f || [1, 1, 1, 1], ii = gates.i || [1, 1, 1, 1], ct = gates.ct || [0, 0, 0, 0], o = gates.o || [1, 1, 1, 1];
        const cNew = cPrev.map((cv, j) => r2(f[j] * cv + ii[j] * ct[j]));
        const h = cNew.map((cv, j) => r2(o[j] * Math.tanh(cv)));
        steps.push({ card: i, title: "Cell update c = f⊙c_prev + i⊙c̃, then h = o⊙tanh(c)", mats: [{ name: "c_new", m: col(cNew), hot: true }, { name: "h", m: col(h), hot: true }], note: "One LSTM timestep, by hand — the LSTM spreadsheet exercise." });
      }
    });
  } else {
    let x = Array.from({ length: 4 }, () => ri(r, 0, 3));
    const x0 = x.slice();
    steps.push({ card: -1, title: "Benchmark input vector", mats: [{ name: "x", m: col(x) }], note: "Small integers — check everything with a calculator." });
    stack.forEach((c, i) => {
      const tc = cat(c);
      if (["dense", "conv", "embed", "recur", "gate", "q", "k", "v"].includes(tc)) {
        const W = smallMat(r, 4, 4, -1, 1);
        const y = matmul(W, col(x)).map(row => row[0]);
        steps.push({ card: i, title: `${TYPES[c.type].name} (width ${c.width}) · h = W·x`, mats: [{ name: "W", m: W }, { name: "x", m: col(x) }, { name: "h", m: col(y), hot: true }], note: "Row i of W dotted with x gives h[i]." });
        x = y;
      } else if (tc === "act") {
        const f = actFns[c.type]; const y = x.map(f);
        steps.push({ card: i, title: `${TYPES[c.type].name} applied elementwise`, mats: [{ name: "x", m: col(x) }, { name: TYPES[c.type].name.toLowerCase() + "(x)", m: col(y), hot: true }] });
        x = y;
      } else if (tc === "norm") {
        const mu = r2(x.reduce((a, b) => a + b, 0) / x.length);
        const sd = r2(Math.sqrt(x.reduce((a, b) => a + (b - mu) * (b - mu), 0) / x.length)) || 1;
        const y = x.map(v => r2((v - mu) / sd));
        steps.push({ card: i, title: `LayerNorm · μ=${mu}, σ=${sd}`, mats: [{ name: "x", m: col(x) }, { name: "(x−μ)/σ", m: col(y), hot: true }], note: "The Batch Normalization exercise, per-vector." });
        x = y;
      } else if (tc === "pool") {
        const y = x.map((v, j) => Math.max(v, x[(j + 1) % x.length]));
        steps.push({ card: i, title: "MaxPool (window 2)", mats: [{ name: "x", m: col(x) }, { name: "max", m: col(y), hot: true }] });
        x = y;
      } else if (tc === "softmax") {
        const ex = x.map(v => Math.exp(v / 2)); const su = ex.reduce((a, b) => a + b, 0);
        const y = ex.map(v => r2(v / su));
        steps.push({ card: i, title: "Softmax(x/2)", mats: [{ name: "x", m: col(x) }, { name: "softmax", m: col(y), hot: true }], note: "Values sum to 1.00." });
        x = y;
      } else if (tc === "dropout") {
        const j = ri(r, 0, x.length - 1); const y = x.map((v, idx) => idx === j ? 0 : v);
        steps.push({ card: i, title: `Dropout · unit ${j + 1} zeroed`, mats: [{ name: "x", m: col(x) }, { name: "drop(x)", m: col(y), hot: true }], note: "The Dropout exercise: strike one cell, watch the rest carry it." });
        x = y;
      } else if (tc === "skip") {
        const y = x.map((v, j) => r2(v + x0[j]));
        steps.push({ card: i, title: "Skip · h = f(x) + x₀", mats: [{ name: "f(x)", m: col(x) }, { name: "x₀", m: col(x0) }, { name: "sum", m: col(y), hot: true }], note: "The identity path — gradients flow through the +x₀ untouched." });
        x = y;
      } else {
        steps.push({ card: i, title: TYPES[c.type].name, mats: [{ name: "x", m: col(x) }] });
      }
    });
  }

  // parameter arithmetic + generalization fraction
  const w = stack.map(c => c.width);
  const terms = w.length > 1 ? w.slice(0, -1).map((x, i) => `${x}×${w[i + 1]}`).join(" + ") : `${w[0]}×${w[0]}`;
  steps.push({ card: stack.length, title: "Parameter count", mats: [], note: `Params = ${terms} = ${fmt(res.params)}` });
  steps.push({ card: stack.length + 1, title: "Generalization", mats: [], note: `Gen = ${res.genExpr} → ${res.gen}`, final: true });
  return steps;
}

/* ═══════════════ GAME LOGIC ═══════════════ */
const unlockedTypes = era => Object.keys(TYPES).filter(t => TYPES[t].era <= era);
const randomSeed = () => { const r = mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0); return "RUN-" + Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(r() * 31)]).join(""); };

function makeDeck(rng, lab) {
  let id = 0;
  const deck = [];
  for (const s of SUIT_IDS) for (const w of WIDTHS) deck.push({ id: "c" + (id++), type: "dense", suit: s, width: w, pGain: 0 });
  // Two activation cards per suit so MLP Block is reachable on day one.
  const acts = ["relu", "sigmoid", "tanh", "relu", "sigmoid", "tanh", "relu", "relu"];
  let ai = 0;
  for (const s of SUIT_IDS) { deck[SUIT_IDS.indexOf(s) * 13 + 1].type = acts[ai++]; deck[SUIT_IDS.indexOf(s) * 13 + 4].type = acts[ai++]; }
  if (lab === "vision") { [0, 2, 5].forEach(i => deck[i].type = "conv"); deck[7].type = "pool"; deck[3].type = "norm"; }
  if (lab === "nlp") { const off = 13; deck[off].type = "embed"; deck[off + 2].type = "embed"; deck[off + 5].type = "q"; deck[off + 6].type = "k"; deck[off + 7].type = "v"; deck[off + 8].type = "softmax"; }
  if (lab === "opt") { deck.splice(48, 4); }
  return deck;
}

function targetFor(gg, era, blindIdx) {
  let t = [1, 1.5, 2.2][blindIdx] * eraBase(era);
  if (gg.papers.includes("curriculum") && blindIdx === 0) t *= 0.75;
  if (gg.papers.includes("scalinghyp")) t *= 1.4;
  return Math.round(t);
}

function startBlind(gg) {
  const r = mulberry32(hashStr(gg.seedStr + "|blind" + gg.era + "-" + gg.blindIdx));
  const ids = shuffle(r, gg.deck.map(c => c.id));
  const hand = ids.slice(0, gg.handSize);
  const drawPile = ids.slice(gg.handSize);
  let boss = null, bossSuit = null, capVal = 0;
  if (gg.blindIdx === 2) { boss = pick(r, BOSSES); bossSuit = pick(r, eraInfo(gg.era).suits); capVal = Math.round(eraData(gg.era) * 1.5); }
  return {
    ...gg, drawPile, hand, stack: [], discard: [], epochs: 4, ablations: 3,
    target: targetFor(gg, gg.era, gg.blindIdx), progress: 0, boss, bossSuit, capVal,
    handIndex: 0, grokking: false, playedPatterns: [], data: eraData(gg.era),
    cleared: false, failed: false, reward: 0, lastResult: null, lastWb: null,
  };
}

function clearBlindState(gg) {
  const P = new Set(gg.papers);
  const spare = gg.epochs;
  let reward = [4, 5, 8][gg.blindIdx] + Math.min(5, Math.floor(gg.compute / 5));
  if (P.has("earlystop")) reward += 4 * spare;
  const adamBonus = P.has("adam2015") ? spare : 0;
  const levels = { ...gg.levels };
  if (P.has("backprop1986")) gg.playedPatterns.forEach(p => { levels[p] = (levels[p] || 1) + 1; });
  return { ...gg, cleared: true, reward, adamBonus, levels, compute: gg.compute + reward };
}

function makeShop(gg, rerolls) {
  const r = mulberry32(hashStr(gg.seedStr + "|shop" + gg.era + "-" + gg.blindIdx + "-" + rerolls));
  const owned = new Set(gg.papers);
  const pool = PAPERS.filter(p => p.rar < 3 && !owned.has(p.id));
  const papers = [];
  for (let i = 0; i < 2 && pool.length; i++) {
    const roll = r(); const tier = roll < 0.55 ? 0 : roll < 0.85 ? 1 : 2;
    let cand = pool.filter(p => p.rar === tier && !papers.includes(p));
    if (!cand.length) cand = pool.filter(p => !papers.includes(p));
    if (cand.length) papers.push(pick(r, cand));
  }
  const types = unlockedTypes(Math.min(8, gg.era + (gg.blindIdx === 2 ? 1 : 0)));
  const cards = Array.from({ length: 2 }, () => ({ type: pick(r, types), suit: pick(r, SUIT_IDS), width: pick(r, WIDTHS), cost: 4 }));
  const cons = [];
  for (let i = 0; i < 2; i++) {
    const roll = r();
    if (roll < 0.45) { const pid = pick(r, PATTERNS.map(p => p.id)); cons.push({ kind: "hyper", pat: pid, cost: 3 }); }
    else if (roll < 0.8) cons.push({ kind: "data", def: pick(r, DATA_CARDS), cost: 3 });
    else cons.push({ kind: "research", def: pick(r, RESEARCH_CARDS), cost: 5 });
  }
  const vouchers = [];
  if (gg.era >= 5 && gg.stackLimit < 7) vouchers.push({ id: "stack", name: "Deeper Stack", cost: 8, fx: `Stack size ${gg.stackLimit} → ${gg.stackLimit + 1} (Multi-Head needs 6, Transformer needs 7).` });
  return { papers, cards, cons, vouchers, rerolls };
}

function makeDerive(gg) {
  const r = mulberry32(hashStr(gg.seedStr + "|derive" + gg.era));
  const W = smallMat(r, 3, 3, -2, 2);
  const x = Array.from({ length: 3 }, () => ri(r, 0, 3));
  const y = W.map(row => row.reduce((a, v, j) => a + v * x[j], 0));
  const blank = ri(r, 0, 2);
  return { W, x, y, blank };
}

/* ═══════════════ COMPONENT ═══════════════ */
export default function GradientDescent() {
  const [screen, setScreen] = useState("menu");
  const [g, setG] = useState(null);
  const [seedInput, setSeedInput] = useState("");
  const [lab, setLab] = useState("default");
  const [anim, setAnim] = useState(null);
  const [fast, setFast] = useState(false);
  const [wbOpen, setWbOpen] = useState(true);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [shop, setShop] = useState(null);
  const gRef = useRef(null); gRef.current = g;
  const fastRef = useRef(false); fastRef.current = fast;
  const animRef = useRef(null);
  const busyRef = useRef(false);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(t => t === msg ? null : t), 3200); };
  const cardById = (gg, id) => gg.deck.find(c => c.id === id);

  function newRun() {
    const seedStr = seedInput.trim() || randomSeed();
    const rng = mulberry32(hashStr(seedStr));
    const deck = makeDeck(rng, lab);
    const g0 = {
      seedStr, lab, era: 1, blindIdx: 0, compute: 4, deck,
      papers: lab === "opt" ? ["adam2015", "momentum1986"] : [],
      consumables: [], levels: {}, notebookUnlocked: [], stackLimit: 5, paperSlots: 5,
      handSize: 8, adamBonus: 0, trainScoreEra: 0, streak: { pat: null, count: 0 },
      endless: false, deriveEra: 0, rcount: 0, bestHand: null, legendGiven: false,
    };
    setG(startBlind(g0));
    setAnim(null); setModal(null); setShop(null);
    setScreen("blind");
  }

  function toggleCard(id) {
    if (busyRef.current) return;
    setG(gg => {
      if (!gg || gg.cleared || gg.failed) return gg;
      if (gg.stack.includes(id)) return { ...gg, stack: gg.stack.filter(x => x !== id) };
      if (gg.stack.length >= gg.stackLimit) return gg;
      return { ...gg, stack: [...gg.stack, id] };
    });
  }
  function moveStack(i, dir) {
    setG(gg => {
      if (!gg) return gg;
      const s = gg.stack.slice(); const j = i + dir;
      if (j < 0 || j >= s.length) return gg;
      [s[i], s[j]] = [s[j], s[i]];
      return { ...gg, stack: s };
    });
  }

  function playHand() {
    const gg = gRef.current;
    if (!gg || busyRef.current || gg.epochs <= 0 || gg.stack.length === 0 || gg.cleared || gg.failed) return;
    busyRef.current = true;
    const stackCards = gg.stack.map(id => cardById(gg, id));
    const ctx = {
      kind: gg.blindIdx === 0 ? "train" : gg.blindIdx === 1 ? "val" : "boss",
      era: gg.era, boss: gg.boss, bossSuit: gg.bossSuit, capVal: gg.capVal, data: gg.data,
      papers: new Set(gg.papers), levels: gg.levels, suits: eraInfo(gg.era).suits,
      streak: gg.streak, handIndex: gg.handIndex, adamBonus: gg.adamBonus,
      seed: gg.seedStr + "|" + gg.era + "-" + gg.blindIdx, grokking: gg.grokking,
    };
    const res = scoreHand(stackCards, ctx);
    const wb = computeForwardPass(stackCards, ctx.seed + "|h" + gg.handIndex, res, gg.data);
    const total = stackCards.length + 3;
    setAnim({ step: 0, total, res, wb, stack: stackCards, done: false });
    let s = 0;
    const tick = () => {
      s++;
      if (s >= total) {
        clearInterval(animRef.current);
        setAnim(a => a ? { ...a, step: total, done: true } : a);
        commitScore(res, wb, stackCards);
        busyRef.current = false;
      } else setAnim(a => a ? { ...a, step: s } : a);
    };
    animRef.current = setInterval(tick, fastRef.current ? 55 : 190);
  }

  function commitScore(res, wb, stackCards) {
    setG(gg => {
      if (!gg) return gg;
      const levels = { ...gg.levels };
      if (gg.boss && gg.boss.id === "forgetting") levels[res.pat.id] = Math.max(1, (levels[res.pat.id] || 1) - 1);
      const streak = gg.streak.pat === res.pat.id ? { pat: res.pat.id, count: gg.streak.count + 1 } : { pat: res.pat.id, count: 0 };
      const progress = gg.progress + res.score;
      const epochs = gg.epochs - 1;
      const hand = gg.hand.filter(id => !gg.stack.includes(id));
      let drawPile = gg.drawPile.slice(), discard = [...gg.discard, ...gg.stack];
      while (hand.length < gg.handSize && (drawPile.length || discard.length)) {
        if (!drawPile.length) { drawPile = shuffle(mulberry32(hashStr(gg.seedStr + "|re" + gg.handIndex)), discard); discard = []; }
        hand.push(drawPile.shift());
      }
      const unlocks = [];
      const un = id => { if (!gg.notebookUnlocked.includes(id) && !unlocks.includes(id)) unlocks.push(id); };
      if (res.gen < 0.5 && gg.blindIdx > 0 && !gg.grokking) un("overfitting");
      if (res.depthApplied) un("vanishing");
      const cats = stackCards.map(cat);
      if (cats.includes("dropout") || res.dropIdx >= 0) un("dropout");
      if (cats.includes("norm")) un("batchnorm");
      if (cats.includes("skip")) un("resnet");
      if (cats.includes("embed")) un("word2vec");
      if (res.pat.id === "attn" || res.pat.id === "transformer") un("attention");
      if (res.pat.id === "mha") un("mha");
      if (res.pat.id === "lstm") un("lstm");
      if (res.pat.id === "bottleneck") un("autoencoder");
      if (gg.papers.includes("moe")) un("moe");
      if (unlocks.length) showToast("📓 Lab Notebook: " + unlocks.map(u => NOTEBOOK.find(n => n.id === u).title).join(", "));
      let g2 = {
        ...gg, levels, streak, progress, epochs, hand, drawPile, discard, stack: [],
        handIndex: gg.handIndex + 1, playedPatterns: [...new Set([...gg.playedPatterns, res.pat.id])],
        lastResult: res, lastWb: wb,
        notebookUnlocked: [...gg.notebookUnlocked, ...unlocks],
        trainScoreEra: gg.blindIdx === 0 ? gg.trainScoreEra + res.score : gg.trainScoreEra,
        bestHand: (!gg.bestHand || res.score > gg.bestHand.score) ? { score: res.score, pat: res.pat.name, arch: stackCards.map(c => TYPES[c.type].name + "·" + c.width).join(" → "), params: res.params } : gg.bestHand,
      };
      if (progress >= g2.target) g2 = clearBlindState(g2);
      else if (epochs <= 0) g2.failed = true;
      return g2;
    });
  }

  function ablate() {
    setG(gg => {
      if (!gg || busyRef.current || gg.ablations <= 0 || gg.stack.length === 0 || gg.cleared || gg.failed) return gg;
      const n = gg.stack.length;
      const hand = gg.hand.filter(id => !gg.stack.includes(id));
      let drawPile = gg.drawPile.slice(), discard = [...gg.discard, ...gg.stack];
      for (let i = 0; i < n && (drawPile.length || discard.length); i++) {
        if (!drawPile.length) { drawPile = shuffle(mulberry32(hashStr(gg.seedStr + "|ab" + gg.handIndex + i)), discard); discard = []; }
        hand.push(drawPile.shift());
      }
      return { ...gg, hand, drawPile, discard, stack: [], ablations: gg.ablations - 1 };
    });
  }

  function skipBlind() {
    const gg = gRef.current;
    if (!gg || gg.blindIdx === 2 || busyRef.current) return;
    const r = mulberry32(hashStr(gg.seedStr + "|skip" + gg.era + "-" + gg.blindIdx));
    const roll = r();
    let item;
    if (roll < 0.45) item = { kind: "hyper", pat: pick(r, PATTERNS.map(p => p.id)) };
    else if (roll < 0.8) item = { kind: "data", def: pick(r, DATA_CARDS) };
    else item = { kind: "research", def: pick(r, RESEARCH_CARDS) };
    setG(g0 => {
      let g2 = { ...g0 };
      if (g2.consumables.length < 6) g2.consumables = [...g2.consumables, item];
      g2.blindIdx += 1;
      g2 = startBlind(g2);
      return g2;
    });
    showToast("Skipped — research token gained");
    maybeDerive();
  }

  function proceedToShop() {
    const gg = gRef.current; if (!gg) return;
    setShop(makeShop(gg, 0));
    setAnim(null);
    if (gg.blindIdx === 2 && !gg.legendGiven) {
      const r = mulberry32(hashStr(gg.seedStr + "|legend" + gg.era));
      const legends = shuffle(r, PAPERS.filter(p => p.rar === 3 && !gg.papers.includes(p.id))).slice(0, 2);
      if (legends.length) setModal({ type: "legend", legends });
    }
    setScreen("shop");
  }

  function pickLegend(p) {
    setG(gg => {
      let g2 = { ...gg, papers: [...gg.papers, p.id], legendGiven: true };
      if (p.id === "scalinghyp") g2 = { ...g2, stackLimit: g2.stackLimit + 1, paperSlots: g2.paperSlots + 1 };
      return g2;
    });
    setModal(null);
    showToast("Legendary paper acquired: " + p.name);
  }

  function nextFromShop() {
    const gg = gRef.current; if (!gg) return;
    let era = gg.era, blindIdx = gg.blindIdx + 1, endless = gg.endless;
    let g2 = { ...gg };
    if (blindIdx > 2) {
      era++; blindIdx = 0; g2.trainScoreEra = 0; g2.legendGiven = era <= 8 ? g2.legendGiven : g2.legendGiven;
      if (era === 9 && !endless) { setG({ ...g2, era, blindIdx }); setScreen("win"); setShop(null); return; }
    }
    g2 = startBlind({ ...g2, era, blindIdx });
    setG(g2); setShop(null); setScreen("blind");
    maybeDerive();
  }

  function maybeDerive() {
    setTimeout(() => {
      const gg = gRef.current; if (!gg) return;
      const due = gg.lab === "theory" ? true : (gg.blindIdx === 2 && gg.deriveEra !== gg.era);
      if (due && screenRef.current === "blind") {
        setG(x => ({ ...x, deriveEra: x.era }));
        setModal({ type: "derive", ch: makeDerive({ ...gg, seedStr: gg.seedStr + "-" + gg.blindIdx }), guess: "" });
      }
    }, 60);
  }
  const screenRef = useRef("menu"); screenRef.current = screen;

  function startEndless() {
    setG(gg => startBlind({ ...gg, endless: true, era: 9, blindIdx: 0 }));
    setScreen("blind");
  }

  /* shop actions */
  function buyPaper(p) {
    setG(gg => {
      if (gg.compute < p.cost || gg.papers.length >= gg.paperSlots || gg.papers.includes(p.id)) return gg;
      return { ...gg, compute: gg.compute - p.cost, papers: [...gg.papers, p.id] };
    });
    setShop(s => ({ ...s, papers: s.papers.filter(x => x.id !== p.id) }));
  }
  function buyCard(cItem, idx) {
    setG(gg => {
      if (gg.compute < cItem.cost) return gg;
      const card = { id: "shop" + gg.era + "_" + gg.blindIdx + "_" + idx + "_" + gg.deck.length, type: cItem.type, suit: cItem.suit, width: cItem.width, pGain: 0 };
      return { ...gg, compute: gg.compute - cItem.cost, deck: [...gg.deck, card] };
    });
    setShop(s => ({ ...s, cards: s.cards.filter((_, i) => i !== idx) }));
  }
  function buyCons(item, idx) {
    setG(gg => {
      if (gg.compute < item.cost || gg.consumables.length >= 6) return gg;
      return { ...gg, compute: gg.compute - item.cost, consumables: [...gg.consumables, { kind: item.kind, pat: item.pat, def: item.def }] };
    });
    setShop(s => ({ ...s, cons: s.cons.filter((_, i) => i !== idx) }));
  }
  function buyVoucher(v) {
    setG(gg => {
      if (gg.compute < v.cost) return gg;
      return { ...gg, compute: gg.compute - v.cost, stackLimit: gg.stackLimit + 1 };
    });
    setShop(s => ({ ...s, vouchers: [] }));
  }
  function reroll() {
    setG(gg => {
      if (gg.compute < 2) return gg;
      setShop(makeShop(gg, (shop ? shop.rerolls : 0) + 1));
      return { ...gg, compute: gg.compute - 2 };
    });
  }

  /* consumable use */
  function useConsumable(i) {
    const gg = gRef.current; if (!gg || busyRef.current) return;
    const item = gg.consumables[i]; if (!item) return;
    const drop = g2 => ({ ...g2, consumables: g2.consumables.filter((_, j) => j !== i) });
    if (item.kind === "hyper") {
      setG(g0 => {
        const lv = { ...g0.levels }; lv[item.pat] = (lv[item.pat] || 1) + 1;
        let nb = g0.notebookUnlocked;
        if (!nb.includes("backprop")) { nb = [...nb, "backprop"]; showToast("📓 Lab Notebook: Backpropagation & Training"); }
        return drop({ ...g0, levels: lv, notebookUnlocked: nb });
      });
      showToast(PAT[item.pat].name + " leveled up — trained longer");
      return;
    }
    if (item.kind === "research") {
      const r = mulberry32(hashStr(gg.seedStr + "|res" + gg.rcount));
      setG(g0 => {
        let g2 = { ...g0, rcount: g0.rcount + 1 };
        if (item.def.id === "pretrain") {
          const p = pick(r, PATTERNS.map(x => x.id));
          const lv = { ...g2.levels }; lv[p] = (lv[p] || 1) + 2;
          let deck = g2.deck.slice();
          for (let k = 0; k < 2 && deck.length > 10; k++) {
            const victim = pick(r, deck.filter(c => !g2.stack.includes(c.id)));
            deck = deck.filter(c => c.id !== victim.id);
            g2.hand = g2.hand.filter(id => id !== victim.id);
            g2.drawPile = g2.drawPile.filter(id => id !== victim.id);
            g2.discard = g2.discard.filter(id => id !== victim.id);
          }
          g2 = { ...g2, levels: lv, deck };
          showToast(PAT[p].name + " +2 levels; 2 cards left the deck");
        } else if (item.def.id === "distill") {
          const deck = g2.deck.map(c => ({ ...c, width: Math.max(2, Math.round(c.width / 2)) }));
          const lv = { ...g2.levels }; PATTERNS.forEach(p => { lv[p.id] = (lv[p.id] || 1) + 1; });
          g2 = { ...g2, deck, levels: lv };
          showToast("Distilled: widths halved, every pattern +1 level");
        } else if (item.def.id === "grokking") {
          g2 = { ...g2, grokking: true, epochs: Math.min(g2.epochs, 1) };
          showToast("Grokking: Gen fixed at 2.0 — one epoch left");
        } else if (item.def.id === "nas") {
          const types = unlockedTypes(g2.era);
          const deck = g2.deck.slice();
          for (let k = 0; k < 6; k++) { const c = pick(r, deck); c.type = pick(r, types); }
          g2 = { ...g2, deck: [...deck] };
          showToast("Architecture search rerolled 6 cards");
        }
        return drop(g2);
      });
      return;
    }
    // data cards act on the current stack selection
    const sel = gg.stack.map(id => cardById(gg, id));
    const need = { normalize: [2, 3], tokenize: [1, 9], onehot: [1, 9], augmentc: [1, 1], quantize: [1, 1], pca: [2, 2], labelnoise: [1, 1] }[item.def.id];
    if (sel.length < need[0] || sel.length > need[1]) { showToast(`${item.def.name} needs ${item.def.need} selected in your stack`); return; }
    setG(g0 => {
      let g2 = { ...g0, deck: g0.deck.map(c => ({ ...c })) };
      const cards = g2.stack.map(id => g2.deck.find(c => c.id === id));
      const rm = id => { g2.deck = g2.deck.filter(c => c.id !== id); g2.hand = g2.hand.filter(x => x !== id); g2.stack = g2.stack.filter(x => x !== id); g2.drawPile = g2.drawPile.filter(x => x !== id); g2.discard = g2.discard.filter(x => x !== id); };
      if (item.def.id === "normalize") { const mx = Math.max(...cards.map(c => c.width)); cards.forEach(c => c.width = mx); showToast("Normalized to width " + mx); }
      if (item.def.id === "tokenize") { cards.forEach(c => c.suit = "L"); showToast("Converted to Language ¶"); }
      if (item.def.id === "onehot") { cards.forEach(c => c.suit = "T"); showToast("Converted to Tabular ▤"); }
      if (item.def.id === "augmentc") { const c = cards[0]; const copy = { ...c, id: c.id + "_a" + g2.deck.length }; g2.deck = [...g2.deck, copy]; showToast("Copied " + TYPES[c.type].name + " " + c.width + " into the deck"); }
      if (item.def.id === "quantize") { const c = cards[0]; c.width = Math.max(2, Math.round(c.width / 2)); c.pGain = (c.pGain || 0) + 3; showToast("Quantized: width halved, permanent +3 Gain"); }
      if (item.def.id === "pca") { const wsum = Math.min(512, cards[0].width + cards[1].width); const nc = { id: "pca" + g2.deck.length, type: "dense", suit: cards[0].suit, width: wsum, pGain: 0 }; rm(cards[0].id); rm(cards[1].id); g2.deck = [...g2.deck, nc]; g2.hand = [...g2.hand, nc.id]; showToast("PCA: combined into Dense " + wsum); }
      if (item.def.id === "labelnoise") { rm(cards[0].id); g2.compute += 4; showToast("Card destroyed · +4⚡"); }
      return { ...g2, consumables: g2.consumables.filter((_, j) => j !== i) };
    });
  }

  function submitDerive() {
    const m = modal; if (!m || m.type !== "derive") return;
    const correct = parseInt(m.guess, 10) === m.ch.y[m.ch.blank];
    const gg = gRef.current;
    const payout = gg && gg.lab === "theory" ? 8 : 4;
    if (correct) { setG(g0 => ({ ...g0, compute: g0.compute + payout })); showToast(`Correct — +${payout}⚡`); }
    setModal({ ...m, done: true, correct });
  }

  /* effects: transition on clear/fail */
  useEffect(() => {
    if (!g) return;
    if (g.failed && screen === "blind") { const t = setTimeout(() => setScreen("gameover"), 900); return () => clearTimeout(t); }
  }, [g, screen]);

  useEffect(() => () => clearInterval(animRef.current), []);

  /* keyboard */
  useEffect(() => {
    const onKey = e => {
      if (screenRef.current !== "blind" || modal) return;
      const gg = gRef.current; if (!gg || gg.cleared || gg.failed) return;
      if (e.key >= "1" && e.key <= "9") { const idx = +e.key - 1; if (gg.hand[idx]) toggleCard(gg.hand[idx]); }
      else if (e.key === "Enter") { e.preventDefault(); playHand(); }
      else if (e.key === "Backspace") { e.preventDefault(); ablate(); }
      else if (e.key === "ArrowLeft" && gg.stack.length) moveStack(gg.stack.length - 1, -1);
      else if (e.key === "ArrowRight" && gg.stack.length >= 2) moveStack(gg.stack.length - 2, 1);
      else if (e.key.toLowerCase() === "w") setWbOpen(o => !o);
      else if (e.key.toLowerCase() === "f") setFast(f => !f);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  /* ---------- derived display ---------- */
  const stackCards = g ? g.stack.map(id => cardById(g, id)) : [];
  const previewPat = stackCards.length ? matchPattern(stackCards) : null;
  const live = (() => {
    if (anim) {
      const { res, step, stack } = anim; const n = stack.length;
      let sig = res.patSig; const upto = Math.min(step, n);
      for (let i = 0; i < upto; i++) sig += res.cardSigs[i].sig;
      if (step > n) sig = res.totalSig;
      return { sig, gain: step > n ? res.gain : res.patGain, gen: step > n + 1 ? res.gen : "…", score: anim.done ? res.score : "…", res, cardStep: upto };
    }
    if (g && g.lastResult) { const r = g.lastResult; return { sig: r.totalSig, gain: r.gain, gen: r.gen, score: r.score, res: r, cardStep: 99 }; }
    return null;
  })();

  /* ═══════════════ RENDER ═══════════════ */
  if (screen === "menu") return (
    <div className="gd-root gd-center">
      <style>{css()}</style>
      <div className="gd-menu">
        <div className="gd-eyebrow">a roguelike deck-builder about how neural networks actually work</div>
        <h1 className="gd-title">GRADIENT<br />DESCENT</h1>
        <p className="gd-sub">Your poker hands are architectures. Your jokers are landmark papers. Your score is a real forward pass — every number checkable by hand on the Whiteboard.</p>
        <div className="gd-menurow">
          <label className="gd-lab">Seed
            <input className="gd-input" value={seedInput} onChange={e => setSeedInput(e.target.value)} placeholder="blank = random" />
          </label>
        </div>
        <div className="gd-menurow gd-labs">
          {[["default", "Fresh Lab", "the standard 52-card Dense deck"], ["vision", "Vision Lab", "starts with Convs, Pool & Norm"], ["nlp", "NLP Lab", "starts with Embeddings + attention parts"], ["opt", "Optimization Lab", "starts with Adam & Momentum papers, 48 cards"], ["theory", "Theory Lab", "Derive-It challenges every boss pay double"]].map(([id, nm, d]) => (
            <button key={id} className={"gd-labbtn" + (lab === id ? " on" : "")} onClick={() => setLab(id)}>
              <b>{nm}</b><span>{d}</span>
            </button>
          ))}
        </div>
        <button className="gd-play" onClick={newRun}>Begin the run →</button>
        <div className="gd-howto">
          Clear 8 Eras of benchmarks. Each Era: <b>Train Split</b> → <b>Validation Split</b> (where overfitting starts to bite) → <b>Benchmark Boss</b>.
          Build ordered stacks of layer cards — order matters. Keys: <kbd>1–9</kbd> select · <kbd>←→</kbd> reorder · <kbd>Enter</kbd> play · <kbd>Bksp</kbd> ablate · <kbd>W</kbd> whiteboard · <kbd>F</kbd> fast.
        </div>
      </div>
    </div>
  );

  if (screen === "gameover" || screen === "win") {
    const won = screen === "win";
    return (
      <div className="gd-root gd-center"><style>{css()}</style>
        <div className="gd-menu">
          <div className="gd-eyebrow">{won ? "benchmark saturated" : "training diverged"}</div>
          <h1 className="gd-title" style={{ fontSize: 46 }}>{won ? "STATE OF THE ART" : "RUN REJECTED"}</h1>
          <p className="gd-sub">{won ? "All 8 Eras cleared. Reviewer #2 has no notes." : `Era ${g.era}, ${BLINDS[g.blindIdx]} — target ${fmt(g.target)}, reached ${fmt(g.progress)}.`}</p>
          {g.bestHand && <div className="gd-abstract">
            <div className="gd-absHead">ABSTRACT</div>
            <p>We present <i>{g.bestHand.pat}</i>, a {fmt(g.bestHand.params)}-parameter architecture ({g.bestHand.arch}) achieving a benchmark score of <b>{fmt(g.bestHand.score)}</b> on seed {g.seedStr}. We attribute our results to {g.papers.length ? g.papers.slice(0, 3).map(p => PAPER[p].name).join(", ") : "sheer stubbornness"} and {g.notebookUnlocked.length} hard-won notebook entries.</p>
          </div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {won && <button className="gd-play" onClick={startEndless}>Endless mode →</button>}
            <button className="gd-play alt" onClick={() => { setSeedInput(g.seedStr); setScreen("menu"); }}>Retry seed</button>
            <button className="gd-play alt" onClick={() => { setSeedInput(""); setScreen("menu"); }}>New run</button>
          </div>
        </div>
      </div>
    );
  }

  if (!g) return null;
  const info = eraInfo(g.era);
  const P = new Set(g.papers);

  const header = (
    <div className="gd-top">
      <div className="gd-brand">GRADIENT DESCENT <span className="gd-seed">seed {g.seedStr}</span></div>
      <div className="gd-topmid">Era {g.era}{g.era > 8 ? " (endless)" : ""} · {info.theme}</div>
      <div className="gd-topbtns">
        <span className="gd-chip">⚡ {g.compute} GPU-hrs</span>
        <button className="gd-tbtn" onClick={() => setModal({ type: "notebook", sel: null })}>📓 Notebook {g.notebookUnlocked.length}/{NOTEBOOK.length}</button>
        <button className="gd-tbtn" onClick={() => setWbOpen(o => !o)}>{wbOpen ? "Hide" : "Show"} Whiteboard</button>
        <button className={"gd-tbtn" + (fast ? " on" : "")} onClick={() => setFast(f => !f)}>Fast {fast ? "✓" : ""}</button>
      </div>
    </div>
  );

  const equation = (
    <div className="gd-eq">
      <span className="gd-eqLabel">SCORE =</span>
      <span className="gd-eqTerm">( Σ SIGNAL <b className="gd-num">{live ? fmt(Math.round(live.sig)) : "—"}</b> )</span>
      <span className="gd-eqOp">×</span>
      <span className="gd-eqTerm">GAIN <b className="gd-num">{live ? live.gain : "—"}</b></span>
      <span className="gd-eqOp">×</span>
      <span className="gd-eqTerm">GEN <b className="gd-num">{live ? live.gen : g.blindIdx === 0 ? "1.0" : "?"}</b></span>
      <span className="gd-eqOp">=</span>
      <b className="gd-eqScore">{live && live.score !== "…" ? fmt(live.score) : "…"}</b>
      <div className="gd-progressWrap">
        <div className="gd-progressLabel">{BLINDS[Math.min(g.blindIdx, 2)]} · {fmt(g.progress)} / {fmt(g.target)}</div>
        <div className="gd-bar"><div className="gd-barFill" style={{ width: Math.min(100, 100 * g.progress / g.target) + "%" }} /></div>
      </div>
    </div>
  );

  const leftPanel = (
    <div className="gd-left">
      <div className="gd-panel">
        <div className="gd-pHead">{BLINDS[Math.min(g.blindIdx, 2)]}</div>
        <div className="gd-kv"><span>Target</span><b>{fmt(g.target)}</b></div>
        <div className="gd-kv"><span>Epochs</span><b>{"●".repeat(g.epochs)}{"○".repeat(Math.max(0, 4 - g.epochs))}</b></div>
        <div className="gd-kv"><span>Ablations</span><b>{"▮".repeat(g.ablations)}{"▯".repeat(Math.max(0, 3 - g.ablations))}</b></div>
        <div className="gd-kv"><span>Data budget</span><b>{fmt(P.has("chinchilla2022") ? g.data * 3 : g.data)}</b></div>
        <div className="gd-kv"><span>Benchmark suits</span><b>{info.suits.map(s => <i key={s} style={{ color: SUITS[s].color, fontStyle: "normal", marginRight: 4 }}>{SUITS[s].sym}</i>)}</b></div>
        <div className="gd-kv"><span>Deck</span><b>{g.drawPile.length}/{g.deck.length}</b></div>
        {g.blindIdx === 1 && <div className="gd-warn">Generalization applies: Data ÷ Parameters, floor 0.25</div>}
        {g.boss && <div className="gd-boss"><b>⚠ {g.boss.name}</b><div>{g.boss.desc(g.bossSuit, g.capVal)}</div></div>}
        {g.blindIdx < 2 && !g.cleared && <button className="gd-tbtn" style={{ width: "100%", marginTop: 6 }} onClick={skipBlind}>Skip blind → research token</button>}
      </div>
      <div className="gd-panel">
        <div className="gd-pHead">Papers {g.papers.length}/{g.paperSlots}</div>
        {g.papers.length === 0 && <div className="gd-dim">None yet — visit the Expo.</div>}
        {g.papers.map(pid => <PaperMini key={pid} p={PAPER[pid]} />)}
      </div>
      <div className="gd-panel">
        <div className="gd-pHead">Consumables {g.consumables.length}/6</div>
        {g.consumables.length === 0 && <div className="gd-dim">Skip a blind or shop for these.</div>}
        {g.consumables.map((c, i) => (
          <div key={i} className="gd-consRow">
            <div className="gd-consTxt">
              {c.kind === "hyper" && <span><b>{HYPER_MAP[c.pat][0]}</b> → level up <i>{PAT[c.pat].name}</i><em className="gd-tiny"> ({HYPER_MAP[c.pat][1]})</em></span>}
              {c.kind === "data" && <span><b>{c.def.name}</b> <em className="gd-tiny">{c.def.fx} Needs: {c.def.need}.</em></span>}
              {c.kind === "research" && <span><b>{c.def.name}</b> <em className="gd-tiny">{c.def.fx}</em></span>}
            </div>
            <button className="gd-mini" onClick={() => useConsumable(i)}>Use</button>
          </div>
        ))}
      </div>
    </div>
  );

  const stackArea = (
    <div className="gd-stackWrap">
      <div className="gd-stackHead">
        <span>ARCHITECTURE STACK <em className="gd-tiny">(order = forward pass, left → right)</em></span>
        <span className="gd-patPrev">{previewPat ? `${previewPat.name} · Lv${g.levels[previewPat.id] || 1} · base ${lvlSig(previewPat, g.levels[previewPat.id] || 1)} sig × ${lvlGain(previewPat, g.levels[previewPat.id] || 1)} gain` : stackCards.length ? "" : "select cards below"}</span>
      </div>
      <div className="gd-stack">
        {Array.from({ length: g.stackLimit }).map((_, i) => {
          const c = stackCards[i];
          const trig = anim && !anim.done && live && live.cardStep === i + 1 && anim.step <= anim.stack.length;
          return (
            <div key={i} className={"gd-slot" + (c ? " full" : "")}>
              {c ? (
                <div className={"gd-slotCard" + (trig ? " firing" : "")} style={{ borderColor: SUITS[c.suit].color }}>
                  <div className="gd-slotIdx">{i + 1}</div>
                  <CardBody c={c} />
                  {anim && anim.res.cardSigs[i] && anim.step > i && <div className="gd-sigPop">+{anim.res.cardSigs[i].sig}{anim.res.cardSigs[i].note ? "*" : ""}</div>}
                  <div className="gd-slotBtns">
                    <button className="gd-mini" onClick={() => moveStack(i, -1)}>◂</button>
                    <button className="gd-mini" onClick={() => toggleCard(c.id)}>✕</button>
                    <button className="gd-mini" onClick={() => moveStack(i, 1)}>▸</button>
                  </div>
                </div>
              ) : <div className="gd-slotGhost">{i + 1}</div>}
            </div>
          );
        })}
      </div>
      <div className="gd-actions">
        <button className="gd-play" disabled={!stackCards.length || g.epochs <= 0 || !!(anim && !anim.done) || g.cleared} onClick={playHand}>▶ Run forward pass <span className="gd-tiny">(Enter)</span></button>
        <button className="gd-play alt" disabled={!stackCards.length || g.ablations <= 0 || !!(anim && !anim.done) || g.cleared} onClick={ablate}>Ablate {g.ablations} <span className="gd-tiny">(Bksp)</span></button>
      </div>
      {live && live.res && (anim ? anim.step > (anim.stack ? anim.stack.length : 0) : true) && live.res.notes.length > 0 && (
        <div className="gd-notes">{live.res.notes.map((n, i) => <div key={i}>· {n}</div>)}</div>
      )}
    </div>
  );

  const handArea = (
    <div className="gd-handWrap">
      <div className="gd-stackHead"><span>HAND</span><span className="gd-tiny">click or press 1–{Math.min(9, g.hand.length)}</span></div>
      <div className="gd-hand">
        {g.hand.map((id, i) => {
          const c = cardById(g, id); if (!c) return null;
          const inStack = g.stack.includes(id);
          return (
            <button key={id} className={"gd-card" + (inStack ? " sel" : "")} style={{ borderColor: inStack ? SUITS[c.suit].color : undefined }} onClick={() => toggleCard(id)}>
              <div className="gd-cardKey">{i + 1}</div>
              {inStack && <div className="gd-ordBadge" style={{ background: SUITS[c.suit].color }}>{g.stack.indexOf(id) + 1}</div>}
              <CardBody c={c} />
            </button>
          );
        })}
      </div>
    </div>
  );

  const clearedOverlay = g.cleared && (
    <div className="gd-overlay">
      <div className="gd-modal">
        <div className="gd-eyebrow">benchmark cleared</div>
        <h2 className="gd-h2">{BLINDS[Math.min(g.blindIdx, 2)]} ✓</h2>
        <p>Reached {fmt(g.progress)} / {fmt(g.target)}. Payout <b>+{g.reward}⚡</b>{g.adamBonus ? ` · Adam banks +${g.adamBonus} Gain for next blind` : ""}{P.has("backprop1986") ? " · Backprop leveled your played patterns" : ""}.</p>
        <button className="gd-play" onClick={proceedToShop}>To the Expo →</button>
      </div>
    </div>
  );

  const failedOverlay = g.failed && (
    <div className="gd-overlay"><div className="gd-modal"><h2 className="gd-h2">Out of epochs</h2><p>The run diverged…</p></div></div>
  );

  if (screen === "shop" && shop) return (
    <div className="gd-root"><style>{css()}</style>
      {header}
      <div className="gd-shop">
        <div className="gd-shopHead">
          <h2 className="gd-h2">THE EXPO <span className="gd-tiny">poster session & compute vendor</span></h2>
          <div><span className="gd-chip">⚡ {g.compute}</span> <button className="gd-tbtn" onClick={reroll} disabled={g.compute < 2}>Reroll (2⚡)</button> <button className="gd-play" onClick={nextFromShop}>Next blind →</button></div>
        </div>
        <div className="gd-shopGrid">
          <div className="gd-shopSec">
            <div className="gd-pHead">Papers</div>
            {shop.papers.length === 0 && <div className="gd-dim">Sold out.</div>}
            {shop.papers.map(p => (
              <div key={p.id} className="gd-arxiv">
                <div className="gd-arxTag">arXiv · {p.yr} · {RARITY[p.rar]}</div>
                <div className="gd-arxTitle">{p.name}</div>
                <div className="gd-arxFx">{p.fx}</div>
                <div className="gd-arxReal">{p.real}</div>
                <button className="gd-mini buy" disabled={g.compute < p.cost || g.papers.length >= g.paperSlots} onClick={() => buyPaper(p)}>Buy {p.cost}⚡</button>
              </div>
            ))}
          </div>
          <div className="gd-shopSec">
            <div className="gd-pHead">Layer cards</div>
            {shop.cards.map((it, i) => (
              <div key={i} className="gd-shopCardRow">
                <div className="gd-card static" style={{ borderColor: SUITS[it.suit].color }}><CardBody c={it} /></div>
                <button className="gd-mini buy" disabled={g.compute < it.cost} onClick={() => buyCard(it, i)}>Add to deck {it.cost}⚡</button>
              </div>
            ))}
            {shop.vouchers.map(v => (
              <div key={v.id} className="gd-arxiv" style={{ marginTop: 8 }}>
                <div className="gd-arxTitle">{v.name}</div>
                <div className="gd-arxFx">{v.fx}</div>
                <button className="gd-mini buy" disabled={g.compute < v.cost} onClick={() => buyVoucher(v)}>Buy {v.cost}⚡</button>
              </div>
            ))}
          </div>
          <div className="gd-shopSec">
            <div className="gd-pHead">Consumables</div>
            {shop.cons.length === 0 && <div className="gd-dim">Sold out.</div>}
            {shop.cons.map((it, i) => (
              <div key={i} className="gd-arxiv">
                <div className="gd-arxTag">{it.kind === "hyper" ? "Hyperparameter" : it.kind === "data" ? "Data card" : "Research card"}</div>
                <div className="gd-arxTitle">{it.kind === "hyper" ? HYPER_MAP[it.pat][0] : it.def.name}</div>
                <div className="gd-arxFx">{it.kind === "hyper" ? `Level up ${PAT[it.pat].name} — ${HYPER_MAP[it.pat][1]}.` : it.def.fx}</div>
                <button className="gd-mini buy" disabled={g.compute < it.cost || g.consumables.length >= 6} onClick={() => buyCons(it, i)}>Buy {it.cost}⚡</button>
              </div>
            ))}
          </div>
        </div>
      </div>
      {modal && modal.type === "legend" && (
        <div className="gd-overlay"><div className="gd-modal">
          <div className="gd-eyebrow">boss reward · choose one</div>
          <h2 className="gd-h2">Legendary result</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {modal.legends.map(p => (
              <div key={p.id} className="gd-arxiv legend" onClick={() => pickLegend(p)} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && pickLegend(p)}>
                <div className="gd-arxTag">arXiv · {p.yr} · Legendary</div>
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

  /* blind screen */
  return (
    <div className="gd-root"><style>{css()}</style>
      {header}
      {equation}
      <div className={"gd-main" + (wbOpen ? " wb" : "")}>
        {leftPanel}
        <div className="gd-center2">
          {stackArea}
          {handArea}
        </div>
        {wbOpen && <Whiteboard anim={anim} g={g} />}
      </div>
      {clearedOverlay}
      {failedOverlay}
      {modal && modal.type === "notebook" && (
        <div className="gd-overlay" onClick={() => setModal(null)}>
          <div className="gd-modal wide" onClick={e => e.stopPropagation()}>
            <h2 className="gd-h2">📓 Lab Notebook <span className="gd-tiny">{g.notebookUnlocked.length}/{NOTEBOOK.length} — entries unlock when you meet the idea in play</span></h2>
            <div className="gd-nbGrid">
              <div className="gd-nbList">
                {NOTEBOOK.map(n => {
                  const open = g.notebookUnlocked.includes(n.id);
                  return <button key={n.id} disabled={!open} className={"gd-nbItem" + (modal.sel === n.id ? " on" : "")} onClick={() => setModal({ ...modal, sel: n.id })}>{open ? n.title : "···"}</button>;
                })}
              </div>
              <div className="gd-nbBody">
                {modal.sel ? (() => { const n = NOTEBOOK.find(x => x.id === modal.sel); return (<><h3>{n.title}</h3><p>{n.body}</p><div className="gd-tiny">Try it by hand: <b>{n.ex}</b> (Tom Yeh's AI-by-Hand spreadsheet exercises)</div></>); })() : <div className="gd-dim">Select an unlocked entry.</div>}
              </div>
            </div>
            <button className="gd-play alt" onClick={() => setModal(null)}>Close</button>
          </div>
        </div>
      )}
      {modal && modal.type === "derive" && (
        <div className="gd-overlay">
          <div className="gd-modal">
            <div className="gd-eyebrow">derive-it · optional · pre-boss</div>
            <h2 className="gd-h2">Fill in the blank cell</h2>
            <p className="gd-tiny">h = W·x. Row i of W dotted with x gives h[i]. Correct pays {g.lab === "theory" ? 8 : 4}⚡; wrong just shows the working.</p>
            <div className="gd-deriveRow">
              <MatrixV m={modal.ch.W} name="W" />
              <span className="gd-eqOp">·</span>
              <MatrixV m={modal.ch.x.map(v => [v])} name="x" />
              <span className="gd-eqOp">=</span>
              <MatrixV m={modal.ch.y.map((v, i) => [i === modal.ch.blank && !modal.done ? "?" : v])} name="h" hot={modal.done} />
            </div>
            {!modal.done ? (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <input className="gd-input" style={{ width: 100 }} value={modal.guess} onChange={e => setModal({ ...modal, guess: e.target.value })} placeholder={`h[${modal.ch.blank + 1}] = ?`} />
                <button className="gd-play" onClick={submitDerive}>Check</button>
                <button className="gd-play alt" onClick={() => setModal(null)}>Skip</button>
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <p>{modal.correct ? "✓ Correct — that's a dot product you just did by hand." : `The row gives ${modal.ch.W[modal.ch.blank].map((w, j) => `${w}×${modal.ch.x[j]}`).join(" + ")} = ${modal.ch.y[modal.ch.blank]}.`}</p>
                <button className="gd-play" onClick={() => setModal(null)}>Continue to boss</button>
              </div>
            )}
          </div>
        </div>
      )}
      {toast && <div className="gd-toast">{toast}</div>}
    </div>
  );
}

/* ---------- small components ---------- */
function CardBody({ c }) {
  const t = TYPES[c.type], s = SUITS[c.suit];
  return (
    <div className="gd-cb" title={t.tip}>
      <div className="gd-cbTop" style={{ background: s.bg, color: s.color }}><span>{s.sym}</span><span className="gd-cbW">{c.width}</span></div>
      <div className="gd-cbGlyph">{t.glyph}</div>
      <div className="gd-cbName">{t.name}</div>
      <div className="gd-cbSig">{Math.round(8 * lg2(c.width))} sig{c.pGain ? ` · +${c.pGain}g` : ""}</div>
    </div>
  );
}
function PaperMini({ p }) {
  return (
    <div className="gd-paperMini" title={p.real}>
      <div className="gd-pmName">{p.name} <span className="gd-tiny">{p.yr}</span></div>
      <div className="gd-pmFx">{p.fx}</div>
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
function Whiteboard({ anim, g }) {
  const steps = anim ? anim.wb : g.lastWb;
  const reveal = st => !anim || anim.done ? true : (st.card < anim.step);
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [anim && anim.step, steps]);
  return (
    <div className="gd-wb">
      <div className="gd-wbHead">WHITEBOARD <span className="gd-tiny">the actual math — check any cell with a calculator</span></div>
      <div className="gd-wbBody" ref={ref}>
        {!steps && <div className="gd-dim" style={{ padding: 12 }}>Play a hand and the forward pass appears here, matrix by matrix — in the style of Tom Yeh's AI-by-Hand exercises.</div>}
        {steps && steps.filter(reveal).map((st, i) => (
          <div key={i} className={"gd-wbStep" + (st.final ? " fin" : "")}>
            <div className="gd-wbTitle">{st.title}</div>
            {st.mats.length > 0 && <div className="gd-wbMats">{st.mats.map((mm, j) => <MatrixV key={j} m={mm.m} name={mm.name} hot={mm.hot} />)}</div>}
            {st.note && <div className="gd-wbNote">{st.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- styles ---------- */
function css() {
  return `
  .gd-root{min-height:100vh;background:#f6f2e7;color:#2b2a25;font-family:ui-monospace,'SF Mono','Cascadia Code',Menlo,Consolas,monospace;font-size:13px;
    background-image:linear-gradient(rgba(60,55,40,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(60,55,40,.055) 1px,transparent 1px);background-size:22px 22px;}
  .gd-root *{box-sizing:border-box}
  .gd-root button{font-family:inherit;cursor:pointer}
  .gd-root button:focus-visible,.gd-root input:focus-visible{outline:2px solid #2b2a25;outline-offset:2px}
  .gd-center{display:flex;align-items:center;justify-content:center;padding:24px}
  .gd-menu{max-width:680px;text-align:center;background:#fffdf6;border:1.5px solid #2b2a25;border-radius:10px;box-shadow:4px 4px 0 rgba(43,42,37,.15);padding:34px 30px}
  .gd-eyebrow{letter-spacing:.14em;text-transform:uppercase;font-size:10px;color:#8a8271}
  .gd-title{font-family:Georgia,'Times New Roman',serif;font-size:58px;line-height:.95;margin:10px 0 12px;letter-spacing:.02em}
  .gd-sub{color:#57534a;max-width:520px;margin:0 auto 18px;line-height:1.5}
  .gd-menurow{margin:10px 0}
  .gd-lab{display:inline-flex;gap:8px;align-items:center;font-size:12px}
  .gd-input{border:1.5px solid #2b2a25;border-radius:6px;background:#fff;padding:6px 9px;font-family:inherit;font-size:13px}
  .gd-labs{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
  .gd-labbtn{display:flex;flex-direction:column;gap:2px;align-items:flex-start;text-align:left;border:1.5px solid #b7b0a0;background:#fff;border-radius:8px;padding:8px 10px;max-width:150px;font-size:11px;color:#57534a}
  .gd-labbtn b{color:#2b2a25}
  .gd-labbtn.on{border-color:#2b2a25;box-shadow:2px 2px 0 rgba(43,42,37,.25);background:#fbf7ea}
  .gd-play{border:1.5px solid #2b2a25;background:#2b2a25;color:#f6f2e7;border-radius:8px;padding:9px 16px;font-size:13px;box-shadow:3px 3px 0 rgba(43,42,37,.2)}
  .gd-play:disabled{opacity:.4;cursor:default;box-shadow:none}
  .gd-play.alt{background:#fffdf6;color:#2b2a25}
  .gd-howto{margin-top:16px;font-size:11px;color:#6d675a;line-height:1.7;border-top:1px dashed #b7b0a0;padding-top:12px}
  .gd-howto kbd{border:1px solid #8a8271;border-radius:4px;padding:0 4px;background:#fff;font-size:10px}
  .gd-top{display:flex;align-items:center;gap:14px;padding:8px 14px;border-bottom:1.5px solid #2b2a25;background:#fbf7ea;flex-wrap:wrap}
  .gd-brand{font-family:Georgia,serif;font-weight:700;letter-spacing:.03em}
  .gd-seed{font-size:10px;color:#8a8271;margin-left:6px}
  .gd-topmid{flex:1;color:#57534a;font-size:12px;min-width:180px}
  .gd-topbtns{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  .gd-chip{border:1.5px solid #2b2a25;border-radius:20px;background:#fff;padding:3px 10px;font-weight:700}
  .gd-tbtn{border:1.5px solid #2b2a25;border-radius:6px;background:#fffdf6;padding:4px 9px;font-size:11px}
  .gd-tbtn.on{background:#2b2a25;color:#f6f2e7}
  .gd-eq{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1.5px solid #2b2a25;background:#fffdf6;flex-wrap:wrap}
  .gd-eqLabel{font-family:Georgia,serif;font-weight:700}
  .gd-eqTerm{font-size:12px;color:#57534a}
  .gd-eqOp{color:#8a8271}
  .gd-num{font-size:17px;color:#2b2a25;margin-left:4px}
  .gd-eqScore{font-size:24px;color:#0f766e}
  .gd-progressWrap{flex:1;min-width:220px;margin-left:auto}
  .gd-progressLabel{font-size:10px;color:#57534a;text-align:right;margin-bottom:2px}
  .gd-bar{height:10px;border:1.5px solid #2b2a25;border-radius:6px;background:#fff;overflow:hidden}
  .gd-barFill{height:100%;background:repeating-linear-gradient(45deg,#0f766e,#0f766e 6px,#15857c 6px,#15857c 12px);transition:width .4s}
  .gd-main{display:grid;grid-template-columns:250px 1fr;gap:12px;padding:12px;align-items:start}
  .gd-main.wb{grid-template-columns:250px 1fr 350px}
  @media(max-width:980px){.gd-main,.gd-main.wb{grid-template-columns:1fr}}
  .gd-panel{background:#fffdf6;border:1.5px solid #2b2a25;border-radius:9px;box-shadow:3px 3px 0 rgba(43,42,37,.12);padding:10px;margin-bottom:12px}
  .gd-pHead{font-family:Georgia,serif;font-weight:700;font-size:13px;border-bottom:1px dashed #b7b0a0;padding-bottom:4px;margin-bottom:6px}
  .gd-kv{display:flex;justify-content:space-between;padding:2px 0;font-size:12px}
  .gd-kv span{color:#6d675a}
  .gd-warn{margin-top:6px;border:1.5px dashed #b45309;color:#b45309;border-radius:6px;padding:5px 7px;font-size:11px}
  .gd-boss{margin-top:6px;border:1.5px solid #b3261e;background:#fbeeed;color:#7f1d17;border-radius:6px;padding:6px 8px;font-size:11px;line-height:1.45}
  .gd-dim{color:#8a8271;font-size:11px}
  .gd-tiny{font-size:10px;color:#8a8271;font-style:normal}
  .gd-paperMini{border:1px solid #b7b0a0;border-left:4px solid #2b2a25;border-radius:4px;background:#fff;padding:5px 7px;margin-bottom:5px}
  .gd-pmName{font-weight:700;font-size:11px}
  .gd-pmFx{font-size:10px;color:#57534a;line-height:1.4}
  .gd-consRow{display:flex;gap:6px;align-items:flex-start;border-top:1px dotted #b7b0a0;padding:5px 0}
  .gd-consTxt{flex:1;font-size:11px;line-height:1.45}
  .gd-mini{border:1.5px solid #2b2a25;background:#fffdf6;border-radius:5px;font-size:10px;padding:2px 6px}
  .gd-mini.buy{background:#2b2a25;color:#f6f2e7;margin-top:5px}
  .gd-mini:disabled{opacity:.4;cursor:default}
  .gd-stackWrap,.gd-handWrap{background:#fffdf6;border:1.5px solid #2b2a25;border-radius:9px;box-shadow:3px 3px 0 rgba(43,42,37,.12);padding:10px;margin-bottom:12px}
  .gd-stackHead{display:flex;justify-content:space-between;gap:10px;font-size:11px;letter-spacing:.08em;color:#57534a;margin-bottom:8px;flex-wrap:wrap}
  .gd-patPrev{color:#0f766e;font-weight:700;letter-spacing:0}
  .gd-stack{display:flex;gap:8px;flex-wrap:wrap;min-height:132px}
  .gd-slot{width:104px}
  .gd-slotGhost{height:128px;border:1.5px dashed #b7b0a0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#c7c0af;font-size:20px}
  .gd-slotCard{position:relative;border:2px solid;border-radius:8px;background:#fff;box-shadow:2px 2px 0 rgba(43,42,37,.18);padding:4px}
  .gd-slotCard.firing{transform:translateY(-6px) scale(1.04);box-shadow:0 6px 0 rgba(15,118,110,.35);transition:transform .12s}
  @media(prefers-reduced-motion:reduce){.gd-slotCard.firing{transform:none}}
  .gd-slotIdx{position:absolute;top:-9px;left:-7px;width:18px;height:18px;border-radius:50%;background:#2b2a25;color:#f6f2e7;font-size:10px;display:flex;align-items:center;justify-content:center}
  .gd-sigPop{position:absolute;top:-11px;right:-4px;background:#0f766e;color:#fff;font-size:10px;border-radius:8px;padding:1px 6px}
  .gd-slotBtns{display:flex;justify-content:space-between;margin-top:4px}
  .gd-actions{display:flex;gap:10px;margin-top:10px;flex-wrap:wrap}
  .gd-notes{margin-top:8px;border-top:1px dashed #b7b0a0;padding-top:6px;font-size:11px;color:#57534a;line-height:1.5}
  .gd-hand{display:flex;gap:8px;flex-wrap:wrap}
  .gd-card{position:relative;width:96px;border:2px solid #57534a;border-radius:8px;background:#fff;box-shadow:2px 2px 0 rgba(43,42,37,.16);padding:4px;text-align:left;transition:transform .1s}
  .gd-card:hover{transform:translateY(-3px)}
  .gd-card.sel{transform:translateY(-8px);background:#fbf7ea}
  .gd-card.static{cursor:default}
  .gd-cardKey{position:absolute;bottom:2px;right:5px;font-size:9px;color:#b7b0a0}
  .gd-ordBadge{position:absolute;top:-8px;right:-6px;color:#fff;width:18px;height:18px;border-radius:50%;font-size:10px;display:flex;align-items:center;justify-content:center;font-weight:700}
  .gd-cb{display:flex;flex-direction:column;gap:2px}
  .gd-cbTop{display:flex;justify-content:space-between;border-radius:5px;padding:2px 6px;font-weight:700}
  .gd-cbW{font-size:13px}
  .gd-cbGlyph{font-size:19px;text-align:center;padding:4px 0 0}
  .gd-cbName{font-size:10px;text-align:center;color:#2b2a25}
  .gd-cbSig{font-size:9px;text-align:center;color:#8a8271}
  .gd-wb{background:#fffdf6;border:1.5px solid #2b2a25;border-radius:9px;box-shadow:3px 3px 0 rgba(43,42,37,.12);display:flex;flex-direction:column;max-height:78vh;position:sticky;top:10px}
  .gd-wbHead{font-family:Georgia,serif;font-weight:700;border-bottom:1.5px solid #2b2a25;padding:8px 10px;background:#fbf7ea;border-radius:8px 8px 0 0}
  .gd-wbBody{overflow-y:auto;padding:8px 10px}
  .gd-wbStep{border-bottom:1px dashed #cfc8b6;padding:7px 0}
  .gd-wbStep.fin{background:#f0f7ee;border:1px solid #0f766e;border-radius:6px;padding:7px}
  .gd-wbTitle{font-size:11px;font-weight:700;margin-bottom:4px}
  .gd-wbMats{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
  .gd-wbNote{font-size:10px;color:#57534a;margin-top:4px;line-height:1.45}
  .gd-matWrap{display:flex;flex-direction:column;align-items:center;gap:2px}
  .gd-matName{font-size:9px;color:#6d675a}
  .gd-mat{display:grid;border:1px solid #8a8271;background:#8a8271;gap:1px}
  .gd-cell{background:#fff;min-width:30px;padding:3px 5px;text-align:center;font-size:11px}
  .gd-cell.hot{background:#e2f2df}
  .gd-mat .gd-cell:nth-child(odd){background:#fff}
  .gd-wbMats .gd-matWrap:last-child .gd-cell{background:#e2f2df}
  .gd-shop{padding:14px}
  .gd-shopHead{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
  .gd-h2{font-family:Georgia,serif;margin:6px 0}
  .gd-shopGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
  .gd-shopSec{background:#fffdf6;border:1.5px solid #2b2a25;border-radius:9px;padding:10px;box-shadow:3px 3px 0 rgba(43,42,37,.12)}
  .gd-arxiv{border:1px solid #8a8271;background:#fff;border-radius:4px;padding:8px 10px;margin-bottom:8px;box-shadow:2px 2px 0 rgba(43,42,37,.08)}
  .gd-arxiv.legend{cursor:pointer;border:2px solid #b45309;max-width:260px}
  .gd-arxiv.legend:hover{background:#fbf3e4}
  .gd-arxTag{font-size:9px;letter-spacing:.1em;color:#8a8271;text-transform:uppercase}
  .gd-arxTitle{font-family:Georgia,serif;font-weight:700;font-size:14px;margin:2px 0}
  .gd-arxFx{font-size:11px;line-height:1.45}
  .gd-arxReal{font-size:10px;color:#57534a;font-style:italic;margin-top:3px;line-height:1.4}
  .gd-shopCardRow{display:flex;gap:10px;align-items:center;margin-bottom:8px}
  .gd-overlay{position:fixed;inset:0;background:rgba(43,42,37,.45);display:flex;align-items:center;justify-content:center;padding:16px;z-index:40}
  .gd-modal{background:#fffdf6;border:2px solid #2b2a25;border-radius:10px;box-shadow:6px 6px 0 rgba(43,42,37,.3);padding:20px 22px;max-width:640px;width:100%;max-height:88vh;overflow:auto}
  .gd-modal.wide{max-width:860px}
  .gd-nbGrid{display:grid;grid-template-columns:170px 1fr;gap:12px;margin:10px 0}
  @media(max-width:640px){.gd-nbGrid{grid-template-columns:1fr}}
  .gd-nbList{display:flex;flex-direction:column;gap:4px}
  .gd-nbItem{text-align:left;border:1px solid #b7b0a0;border-radius:5px;background:#fff;padding:5px 8px;font-size:11px}
  .gd-nbItem.on{border-color:#2b2a25;background:#fbf7ea;font-weight:700}
  .gd-nbItem:disabled{color:#c7c0af;cursor:default}
  .gd-nbBody h3{font-family:Georgia,serif;margin:0 0 6px}
  .gd-nbBody p{line-height:1.6;font-size:12px}
  .gd-deriveRow{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px}
  .gd-abstract{border:1px solid #8a8271;background:#fff;text-align:left;border-radius:4px;padding:12px 14px;margin:14px auto;max-width:520px}
  .gd-absHead{font-size:9px;letter-spacing:.14em;color:#8a8271}
  .gd-abstract p{font-size:12px;line-height:1.6}
  .gd-toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#2b2a25;color:#f6f2e7;border-radius:8px;padding:9px 16px;font-size:12px;z-index:60;box-shadow:0 4px 14px rgba(0,0,0,.3);max-width:90vw}
  `;
}
