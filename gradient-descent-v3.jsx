import React, { useState, useEffect, useRef } from "react";
import { Icon2 } from "./src/icons2.js";

/* ═══════════════════════════════════════════════════════════════
   GRADIENT DESCENT v3 — an educational roguelike about training
   real neural networks to solve real open science problems.
   Draw cards, build a 5-part loadout, watch the loss curve, beat
   the target. Single seed = same flavour = same card draws + the
   same 10-problem order, every time.
   ═══════════════════════════════════════════════════════════════ */

/* ---------- seeded RNG (same seed = same run) ---------- */
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function fmtTime(ms) {
  if (ms == null || ms < 0 || !isFinite(ms)) ms = 0;
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), ss = s % 60;
  return String(m).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
}

/* ---------- the 10 flavours (seed + theme) ---------- */
const FLAVORS = [
  { id: "blood-orange", name: "Blood Orange", primary: "#c2410c", accent: "#f97316", bg: "#fff7ed", text: "#2b1608", mood: "warm, energetic" },
  { id: "rose-milk", name: "Rose Milk", primary: "#be5985", accent: "#f4a7c3", bg: "#fdf2f6", text: "#3a1526", mood: "calm, soft" },
  { id: "cherry-cola", name: "Cherry Cola", primary: "#e11d48", accent: "#fb7185", bg: "#1a0b0e", text: "#fde8ec", mood: "bold", dark: true },
  { id: "brownie", name: "Brownie", primary: "#78350f", accent: "#b45309", bg: "#f5ece1", text: "#2a1608", mood: "cozy, retro" },
  { id: "matcha", name: "Matcha", primary: "#4d7c0f", accent: "#84cc16", bg: "#f4f7ec", text: "#1f2b0a", mood: "fresh, earthy" },
  { id: "blueberry", name: "Blueberry", primary: "#4338ca", accent: "#6366f1", bg: "#eef0fb", text: "#161634", mood: "cool, focused" },
  { id: "grape-soda", name: "Grape Soda", primary: "#7c3aed", accent: "#a855f7", bg: "#f5f0fd", text: "#241040", mood: "playful" },
  { id: "lemon-drop", name: "Lemon Drop", primary: "#a16207", accent: "#eab308", bg: "#fffbeb", text: "#2b2205", mood: "bright, zesty" },
  { id: "mint-chip", name: "Mint Chip", primary: "#0d9488", accent: "#2dd4bf", bg: "#effbf9", text: "#082b27", mood: "clean, calm" },
  { id: "charcoal", name: "Charcoal", primary: "#374151", accent: "#9ca3af", bg: "#f3f4f6", text: "#111827", mood: "minimal, serious" },
];
const themeVars = f => ({ "--primary": f.primary, "--accent": f.accent, "--bg": f.bg, "--text": f.text });

/* ---------- card pools ---------- */
const SLOT_TYPES = ["model", "compute", "activation", "loss", "helper"];
const SLOT_LABEL = { model: "Model", compute: "Compute", activation: "Activation", loss: "Loss", helper: "Helper" };

const MODELS = [
  { id: "mlp", name: "MLP", icon: "mlp", tip: "Stacks of dense layers. The right default for tables of numbers." },
  { id: "cnn", name: "CNN", icon: "cnn", tip: "Slides filters over a grid to find local patterns. Built for images." },
  { id: "cnn1d", name: "1D-CNN", icon: "cnn1d", tip: "A CNN that slides along a single time axis. Great for signals & time-series." },
  { id: "rnn", name: "RNN / LSTM", icon: "rnn", tip: "Reads a sequence step by step and remembers what it saw." },
  { id: "transformer", name: "Transformer", icon: "transformer", tip: "Every element attends to every other at once. Hungry for data & compute." },
  { id: "gnn", name: "GNN", icon: "gnn", tip: "Passes messages along a graph of connected nodes." },
  { id: "unet", name: "U-Net", icon: "unet", tip: "A CNN that shrinks an image down, then rebuilds it. Pixel-perfect output." },
  { id: "cnn3d", name: "3D-CNN", icon: "cnn3d", tip: "A CNN with an extra spatial axis, for volumes instead of flat images." },
];
const COMPUTE = [
  { id: "cpu", name: "Laptop CPU", tier: 0, icon: "cpu", tip: "Free and always around. Struggles with anything heavy." },
  { id: "gpu1", name: "Single GPU", tier: 1, icon: "gpu1", tip: "A real accelerator. Good for small-to-medium models." },
  { id: "gpu_multi", name: "Multi-GPU rig", tier: 2, icon: "gpu_multi", tip: "Several GPUs sharing the work. Handles big models." },
  { id: "datacenter", name: "Datacenter", tier: 3, icon: "datacenter", tip: "8× datacenter-class GPUs. Practically no ceiling — if you can afford it." },
];
const ACTIVATIONS = [
  { id: "relu", name: "ReLU", icon: "relu", tip: "Negatives become 0. Simple, fast, the modern default." },
  { id: "gelu", name: "GELU", icon: "gelu", tip: "A smooth cousin of ReLU. Used in transformers." },
  { id: "sigmoid", name: "Sigmoid", icon: "sigmoid", tip: "Squashes to 0–1. Prone to vanishing gradients when stacked deep." },
  { id: "tanh", name: "Tanh", icon: "tanh", tip: "Squashes to −1..1. Same vanishing-gradient issue as Sigmoid." },
];
const LOSSES = [
  { id: "xent", name: "Cross-Entropy", icon: "xent", tip: "The standard loss for classification." },
  { id: "mse", name: "MSE", icon: "mse", tip: "Mean Squared Error — the standard loss for regression." },
  { id: "contrastive", name: "Contrastive", icon: "contrastive", tip: "Pulls similar examples together, pushes different ones apart." },
  { id: "focal", name: "Focal", icon: "focal", tip: "Cross-Entropy that down-weights easy examples — built for rare events." },
];
const HELPERS = [
  { id: "aiscientist", name: "AI Scientist", icon: "aiscientist", tip: "Reveals this problem's ideal model family." },
  { id: "gradstudent", name: "Grad Student", icon: "gradstudent", tip: "+1 extra Run this problem." },
  { id: "dataaug", name: "Data Augmentation", icon: "dataaug", tip: "Synthesizes more training examples. Cuts overfitting risk." },
  { id: "dropout", name: "Dropout", icon: "dropout", tip: "Randomly mutes neurons while training. Cuts overfitting risk." },
  { id: "earlystop", name: "Early Stopping", icon: "earlystop", tip: "Stops training at the best epoch — the overfitting climb never happens." },
  { id: "norm", name: "Normalization", icon: "norm", tip: "Keeps activations well-scaled. Speeds up and stabilizes convergence." },
  { id: "ensemble", name: "Ensemble", icon: "ensemble", tip: "Averages several models together for a steadier final score." },
];
const POOLS = { model: MODELS, compute: COMPUTE, activation: ACTIVATIONS, loss: LOSSES, helper: HELPERS };
const HEAVY_MODELS = ["transformer", "cnn3d", "unet", "gnn"];
const DATA_SCALE_TIER = { tiny: 0, small: 0, medium: 1, large: 2 };

/* ---------- the 10 real science problems, in unlock order ---------- */
const PROBLEMS = [
  { id: "higgs", title: "Higgs ML Challenge", field: "Particle physics", difficulty: "Easy", dataType: "Tabular kinematic features",
    bestFit: ["mlp"], okFit: ["gnn"], validLoss: ["xent", "focal"], bestLoss: "xent", dataScale: "large", minTier: 0, target: 76, metricLabel: "AUC",
    infoShort: "Every event is a row of numbers — energies, angles, momenta. No pixels, no sequence, just a table.",
    infoFull: "The Higgs ML Challenge (2014) asked: given kinematic measurements from a particle collision, is this a real Higgs decay or background noise? The features are just numbers in a table — no spatial or sequential structure — which is exactly what a plain MLP (a stack of dense layers) is built for. Fancier architectures don't help when the data itself is already flat.",
    icon: "higgs" },
  { id: "molecular", title: "Molecular Property (ESOL / Tox21)", field: "Chemistry", difficulty: "Easy/Med", dataType: "SMILES strings",
    bestFit: ["mlp", "gnn"], validLoss: ["mse", "xent", "focal"], dataScale: "medium", minTier: 0, target: 78, metricLabel: "R² / AUC",
    infoShort: "Each molecule is a small graph of bonded atoms — or, flattened into descriptors, just another row of numbers.",
    infoFull: "Molecular property datasets like ESOL (solubility, regression) and Tox21 (toxicity, classification) represent each molecule as a SMILES string. Turn that into hand-built descriptors and a plain MLP does the job; keep the actual bond graph and a GNN — which passes messages along real chemical bonds — usually does better. Both are 'right', which is the point: the data's underlying structure decides the tool.",
    icon: "molecular" },
  { id: "exoplanet", title: "Exoplanet Detection", field: "Astronomy", difficulty: "Easy/Med", dataType: "1D light-curve time-series",
    bestFit: ["cnn1d", "rnn"], validLoss: ["xent", "focal"], bestLoss: "focal", dataScale: "medium", minTier: 0, target: 80, metricLabel: "Recall",
    infoShort: "A light curve is brightness measured over time — one long 1-D signal, not a picture.",
    infoFull: "Detecting a transiting exoplanet means spotting a tiny, periodic dip in a star's brightness over thousands of time steps. That's a 1-D sequence problem: a 1D-CNN (or an RNN) that slides along the time axis beats a 2D image model, which has no idea what to do with a single row of numbers. Real transits are also rare, so Focal loss — which down-weights the easy 'nothing happened' examples — usually beats plain Cross-Entropy.",
    icon: "exoplanet" },
  { id: "climate", title: "Climate Pattern Detection (ClimateNet)", field: "Earth science", difficulty: "Med", dataType: "Gridded spatial data",
    bestFit: ["cnn", "unet"], validLoss: ["xent", "focal"], dataScale: "large", minTier: 1, target: 82, metricLabel: "IoU",
    infoShort: "The data is a grid laid over the globe — rows and columns of pressure, wind, moisture. A picture, basically.",
    infoFull: "ClimateNet-style pattern detection (finding atmospheric rivers and tropical cyclones) works on gridded, multi-channel spatial data — structurally a picture. A CNN finds the local patterns; a U-Net, which shrinks the image down and rebuilds it, is built specifically for pixel-by-pixel labeling like this. It's real compute-hungry, though — this is not laptop-CPU territory.",
    icon: "climate" },
  { id: "genomics", title: "Gene Expression / Cancer Subtype (TCGA)", field: "Biology/Medicine", difficulty: "Med", dataType: "High-dim tabular, tiny samples",
    bestFit: ["mlp"], validLoss: ["xent"], dataScale: "tiny", minTier: 0, overfitTrap: true, target: 83, metricLabel: "Accuracy",
    infoShort: "Tens of thousands of genes measured... across only a few hundred patients. Way more columns than rows.",
    infoFull: "TCGA-style gene expression data is brutally high-dimensional but sample-starved: tens of thousands of genes, only a few hundred patients. An MLP is still the right family — it's a table — but with that few examples, a big model just memorizes the training set. This is the overfitting trap: without a helper that reduces overfitting (Dropout, Data Augmentation, or Early Stopping), a strong training score means nothing.",
    icon: "genomics" },
  { id: "gravwave", title: "Gravitational Wave Detection (G2Net)", field: "Physics", difficulty: "Med/Hard", dataType: "Noisy strain → spectrogram",
    bestFit: ["cnn"], okFit: ["cnn1d"], validLoss: ["xent", "focal"], bestLoss: "focal", dataScale: "large", minTier: 1, target: 85, metricLabel: "AUC",
    infoShort: "Raw detector strain is noisy 1-D data — but turn it into a spectrogram and the chirp becomes a shape you can see.",
    infoFull: "G2Net-style gravitational wave detection starts as a 1-D strain signal buried in noise, but the standard trick is to convert it into a spectrogram (a time-vs-frequency image) where the telltale 'chirp' of two black holes spiraling together is visually obvious. Once it's an image, a CNN wins. Real detections are extremely rare against a wall of noise, so Focal loss earns its keep here too.",
    icon: "gravwave" },
  { id: "jet", title: "Jet Classification", field: "Particle physics", difficulty: "Hard", dataType: "Detector images/features",
    bestFit: ["cnn", "gnn"], validLoss: ["xent", "focal"], dataScale: "large", minTier: 2, target: 86, metricLabel: "Accuracy",
    infoShort: "A particle jet can be rendered as an image of energy deposits, or kept as a graph of individual particles.",
    infoFull: "Jet classification (is this a quark, gluon, or boosted W/Z/top jet?) can be framed as an image — energy deposited in each detector cell, fed to a CNN — or as a point cloud / graph of individual particles, fed to a GNN. Both are used in real particle physics; either counts here. What doesn't work is treating jets as a flat, order-independent table.",
    icon: "jet" },
  { id: "neutrino", title: "Neutrino Event Classification (IceCube)", field: "Particle physics", difficulty: "Hard", dataType: "Detector data (different geometry)",
    bestFit: ["cnn", "gnn"], validLoss: ["focal", "xent"], bestLoss: "focal", dataScale: "large", minTier: 2, target: 87, metricLabel: "AUC",
    infoShort: "IceCube's detector geometry isn't a neat camera grid — it's a sparse, irregular 3-D lattice of sensors.",
    infoFull: "IceCube neutrino events light up a sparse, irregularly-spaced 3-D lattice of sensors buried in Antarctic ice — nothing like a regular camera grid. Real neutrino signal is a needle in a haystack of background muons, so this is a rare-event problem twice over: pick a CNN or GNN that can handle the geometry, and Focal loss to keep the model from just predicting 'background' every time.",
    icon: "neutrino" },
  { id: "cosmology", title: "Cosmological Parameter Estimation (Quijote)", field: "Cosmology", difficulty: "Hard", dataType: "3D density fields",
    bestFit: ["cnn3d"], validLoss: ["mse"], bestLoss: "mse", dataScale: "large", minTier: 2, target: 88, metricLabel: "R²",
    infoShort: "The universe's matter distribution, simulated as a full 3-D density cube — not a flat image.",
    infoFull: "The Quijote simulations map how matter clumps across the universe as a full 3-D density field. Estimating cosmological parameters (like the matter density Ωm or clustering amplitude σ8) from that cube needs a model that convolves in all three spatial dimensions — a 3D-CNN. It's also a regression problem (continuous physical constants, not classes), so MSE is the loss that makes sense.",
    icon: "cosmology" },
  { id: "protein", title: "Protein Structure / Function", field: "Biology", difficulty: "Hard", dataType: "Amino-acid sequences",
    bestFit: ["rnn", "transformer"], validLoss: ["xent", "contrastive"], dataScale: "large", minTier: 2, target: 90, metricLabel: "Accuracy",
    infoShort: "A protein is a long chain of amino acids — order matters enormously, just like a sentence.",
    infoFull: "Protein structure and function depend on the sequence of amino acids, read in order — much like language. RNNs read it step by step; Transformers (the family behind AlphaFold's building blocks) attend to the whole sequence at once and scale better with data. Either is a legitimate sequence model here, which is exactly what this data calls for.",
    icon: "protein" },
];

function difficultyTone(diff) {
  if (diff.includes("Hard")) return "hard";
  if (diff.includes("Med")) return "med";
  return "easy";
}

/* ---------- deck builder: 5 guaranteed-type cards + 3 wildcards, shuffled.
   Guarantees a solvable loadout is always reachable within the 8-draw cap. ---------- */
function buildDeck(rng, problem) {
  const guaranteed = SLOT_TYPES.map(type => {
    const pool = POOLS[type];
    let card = null;
    if (type === "model" && rng() < 0.5) card = pick(rng, pool.filter(c => problem.bestFit.includes(c.id)));
    if (type === "loss" && rng() < 0.5) card = pick(rng, pool.filter(c => problem.validLoss.includes(c.id)));
    if (!card) card = pick(rng, pool);
    return { ...card, slotType: type };
  });
  const wildcards = Array.from({ length: 3 }, () => {
    const type = pick(rng, SLOT_TYPES);
    return { ...pick(rng, POOLS[type]), slotType: type };
  });
  return shuffle(rng, [...guaranteed, ...wildcards]).map((c, i) => ({ ...c, uid: "d" + i }));
}

/* ═══════════════ SCORING (the actual rules) ═══════════════ */
function computeOutcome(slots, problem, rng) {
  const { model, compute, activation, loss, helper } = slots;

  let modelMatch = 0.25;
  if (problem.bestFit.includes(model.id)) modelMatch = 1;
  else if (problem.okFit && problem.okFit.includes(model.id)) modelMatch = 0.6;

  let lossMatch = 0.4;
  if (problem.bestLoss === loss.id) lossMatch = 1;
  else if (problem.validLoss.includes(loss.id)) lossMatch = 0.85;

  const actFactor = (activation.id === "relu" || activation.id === "gelu") ? 1 : 0.9;
  const fit = clamp(modelMatch * 0.55 + lossMatch * 0.30 + actFactor * 0.15, 0, 1);

  /* out-of-memory: compute too weak for the chosen architecture */
  const gap = problem.minTier - compute.tier;
  let oom = false;
  if (compute.tier === 0 && HEAVY_MODELS.includes(model.id)) oom = true;
  else if (gap >= 2) oom = true;
  else if (gap === 1) oom = rng() < 0.65;

  /* overfitting: compute (≈ model capacity) oversized for the data, or a known trap */
  const expectedTier = DATA_SCALE_TIER[problem.dataScale];
  const oversize = Math.max(0, compute.tier - expectedTier);
  let overfitScore = oversize * 0.3 + (problem.overfitTrap ? 0.4 : 0);
  if (helper.id === "dataaug") overfitScore -= 0.28;
  if (helper.id === "dropout") overfitScore -= 0.28;
  if (helper.id === "norm") overfitScore -= 0.12;
  if (helper.id === "earlystop") overfitScore -= 0.55;
  overfitScore = Math.max(0, overfitScore);

  const noise = Math.round(rng() * 4 - 2);
  const helperBonus = (helper.id === "ensemble" ? 3 : 0) + (helper.id === "norm" ? 2 : 0);
  const rawScore = clamp(Math.round(40 + 56 * fit + noise + helperBonus), 1, 99);

  let outcome, finalScore = null;
  if (oom) {
    outcome = "oom";
  } else if (overfitScore > 0.3) {
    outcome = "overfit";
    finalScore = clamp(Math.round(rawScore * 0.5), 1, 99);
  } else if (fit < 0.55) {
    outcome = "underfit";
    finalScore = clamp(Math.round(rawScore * 0.55), 1, 99);
  } else {
    outcome = "converge";
    finalScore = rawScore;
  }
  const solved = outcome === "converge" && finalScore >= problem.target;
  return { outcome, fit, finalScore, solved };
}

/* ---------- the loss curve itself, sampled epoch by epoch ---------- */
function makeCurve(outcome, fit, rng) {
  const N = 22, pts = [];
  const trainK = 0.22 + fit * 0.14, trainFloor = 0.05 + (1 - fit) * 0.05;
  const valK = 0.16 + fit * 0.10, valFloor = 0.10 + (1 - fit) * 0.22;
  let turnE = null, oomCut = null;
  if (outcome === "overfit") turnE = Math.round(N * (0.28 + rng() * 0.18));
  if (outcome === "oom") oomCut = Math.round(N * (0.35 + rng() * 0.35));

  for (let e = 0; e <= N; e++) {
    if (oomCut != null && e > oomCut) break;
    let train, val;
    if (outcome === "underfit") {
      train = 0.62 - 0.10 * (1 - Math.exp(-0.10 * e)) + rng() * 0.01;
      val = train + 0.05 + rng() * 0.02;
    } else {
      train = trainFloor + (0.92 - trainFloor) * Math.exp(-trainK * e);
      if (turnE != null && e > turnE) {
        const t = e - turnE;
        val = valFloor + (0.92 - valFloor) * Math.exp(-valK * turnE) + Math.pow(t, 1.35) * 0.018;
      } else {
        val = valFloor + (0.92 - valFloor) * Math.exp(-valK * e);
      }
    }
    pts.push({ e, train: clamp(train, 0.02, 0.98), val: clamp(val, 0.02, 1.05) });
  }
  return { pts, turnE, oomCut, N };
}

function outcomeLabel(o) { return { converge: "training complete", overfit: "overfitting detected", underfit: "underfitting", oom: "run crashed" }[o] || o; }
function verdictText(run, problem) {
  if (run.outcome === "oom") return "💥 CUDA out of memory. Your compute couldn't fit that architecture on this data — the run is wasted, but it didn't cost you the problem.";
  if (run.outcome === "overfit") return `Train loss kept dropping, but validation loss climbed back up — the model memorized the training set instead of learning it. Validation ${problem.metricLabel}: ${run.finalScore} (needed ${problem.target}).`;
  if (run.outcome === "underfit") return `The loss plateaued high on both lines — wrong tool for this data. Validation ${problem.metricLabel}: ${run.finalScore} (needed ${problem.target}).`;
  if (run.solved) return `Converged. Validation ${problem.metricLabel} ${run.finalScore} clears the ${problem.target} target.`;
  return `Converged, but validation ${problem.metricLabel} ${run.finalScore} falls short of the ${problem.target} target — close. Try a different loadout.`;
}
function tickerText(runAnim) {
  const { result, curve, step } = runAnim;
  const N = curve.N, epoch = Math.min(step, curve.pts.length - 1);
  if (result.outcome === "oom" && step >= curve.pts.length) return "💥 CUDA out of memory — run wasted.";
  if (result.outcome === "overfit" && curve.turnE != null && epoch > curve.turnE) return `⚠ epoch ${epoch}/${N} — validation loss climbing (overfitting)`;
  return `training… epoch ${epoch}/${N}`;
}

/* ---------- leaderboard storage (localStorage; falls back to in-memory) ---------- */
const LB_KEY = "gd3_leaderboard_v1";
let memoryBoard = [];
let storageOK = true;
try { localStorage.setItem("__gd3_test__", "1"); localStorage.removeItem("__gd3_test__"); } catch { storageOK = false; }
function loadBoard() {
  if (!storageOK) return memoryBoard;
  try { return JSON.parse(localStorage.getItem(LB_KEY) || "[]"); } catch { return memoryBoard; }
}
function saveBoard(list) {
  if (!storageOK) { memoryBoard = list; return; }
  try { localStorage.setItem(LB_KEY, JSON.stringify(list)); } catch { memoryBoard = list; }
}
function addBoardResult(entry) { const list = loadBoard(); list.push(entry); saveBoard(list); }
function rankBoard(list) {
  return [...list].sort((a, b) => {
    const aAll = a.solvedCount === 10, bAll = b.solvedCount === 10;
    if (aAll !== bAll) return aAll ? -1 : 1;
    if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
    if (a.totalTimeMs !== b.totalTimeMs) return a.totalTimeMs - b.totalTimeMs;
    return a.totalTries - b.totalTries;
  });
}

/* ---------- tutorial ---------- */
const TUTORIAL_V3 = [
  { t: "Welcome to the lab", b: "You're an AI lab. Pick tools, train a model, and beat the target — across 10 real open science problems." },
  { t: "The problem: cats vs. dogs", b: "Say the task is: is this photo a cat or a dog? It's images — so you'll want a model that's actually good at images." },
  { t: "Draw your loadout", b: "Click the deck to draw a card. You need 5: a Model, some Compute, an Activation, a Loss function, and one Helper. A card you can't use yet may be discarded — up to 3 times — to try again." },
  { t: "A worked example", b: "For cats-vs-dogs you'd want: a CNN (sees images) + a modest GPU + ReLU + Cross-Entropy (it's classification) + any Helper you like." },
  { t: "Hit Run", b: "Watch the loss curve. Both lines sliding down and flattening low = it's learning. If the dotted validation line shoots back up after dropping, you're overfitting — memorizing, not learning." },
  { t: "Race the clock (or don't)", b: "Solve all 10 problems as fast as you can, with as few tries as you can, in Speedrun mode — or take your time with unlimited tries in Learn mode. Each solve unlocks a notebook page. Good luck." },
];

/* ═══════════════ small shared pieces ═══════════════ */
function CardFace({ card, type, size = "md" }) {
  if (!card) {
    return (
      <div className={"gd3-slot empty " + size}>
        <Icon2 id="frame_common" size={size === "lg" ? 40 : 30} primary="var(--muted)" accent="var(--muted)" />
        <div className="gd3-slotType">{SLOT_LABEL[type]}</div>
      </div>
    );
  }
  return (
    <div className={"gd3-cardFace " + size} title={card.tip}>
      <div className="gd3-cardIconWrap"><Icon2 id={card.icon} size={size === "lg" ? 46 : 34} primary="var(--primary)" accent="var(--accent)" /></div>
      <div className="gd3-cardName">{card.name}</div>
      <div className="gd3-cardType">{SLOT_LABEL[type]}</div>
    </div>
  );
}

function LossCurve({ curve, step, outcome }) {
  const W = 520, H = 200;
  const { pts, N, oomCut } = curve;
  const visible = pts.slice(0, Math.max(1, step));
  const x = e => 30 + (e / N) * (W - 50);
  const y = v => 14 + clamp(v, 0, 1) * (H - 36);
  const path = key => visible.map((p, i) => (i === 0 ? "M" : "L") + x(p.e).toFixed(1) + "," + y(p[key]).toFixed(1)).join(" ");
  const glitching = outcome === "oom" && oomCut != null && step >= pts.length;
  return (
    <div className={"gd3-curveBox" + (glitching ? " glitch" : "")}>
      <svg viewBox={`0 0 ${W} ${H}`} className="gd3-curveSvg" preserveAspectRatio="none">
        {Array.from({ length: 5 }).map((_, i) => {
          const gy = 14 + i * (H - 36) / 4;
          return <line key={i} x1={30} x2={W - 20} y1={gy} y2={gy} className="gd3-gridline" />;
        })}
        <path d={path("train")} className="gd3-trainLine" fill="none" />
        <path d={path("val")} className="gd3-valLine" fill="none" />
        {glitching && <text x={W / 2} y={H / 2} textAnchor="middle" className="gd3-glitchText">⚠ CUDA OUT OF MEMORY</text>}
      </svg>
      <div className="gd3-curveLegend"><span className="gd3-legTrain">━ train loss</span><span className="gd3-legVal">┄ val loss</span></div>
    </div>
  );
}

function Tutorial({ step, setStep }) {
  const s = TUTORIAL_V3[step];
  if (!s) return null;
  return (
    <div className="gd3-overlay">
      <div className="gd3-modal narrow">
        <div className="gd3-eyebrow">how to play · {step + 1} / {TUTORIAL_V3.length}</div>
        <h2 className="gd3-h2">{s.t}</h2>
        <p className="gd3-body">{s.b}</p>
        <div className="gd3-modalFoot">
          <button className="gd3-btn" onClick={() => setStep(null)}>Skip</button>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && <button className="gd3-btn" onClick={() => setStep(step - 1)}>← Back</button>}
            {step < TUTORIAL_V3.length - 1
              ? <button className="gd3-btn primary" onClick={() => setStep(step + 1)}>Next →</button>
              : <button className="gd3-btn primary" onClick={() => setStep(null)}>Let's build! →</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaderboardPanel({ flavorId, onClose }) {
  const [filter, setFilter] = useState(flavorId || "all");
  const board = rankBoard(loadBoard());
  const flavorName = f => (FLAVORS.find(x => x.id === f) || {}).name || f;
  const rows = filter === "all" ? board : board.filter(r => r.flavour === flavorName(filter));
  return (
    <div className="gd3-overlay" onClick={onClose}>
      <div className="gd3-modal wide" onClick={e => e.stopPropagation()}>
        <h2 className="gd3-h2">🏆 Userboard</h2>
        <div className="gd3-lbFilters">
          <button className={"gd3-btn sm" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>All flavours</button>
          {flavorId && <button className={"gd3-btn sm" + (filter === flavorId ? " on" : "")} onClick={() => setFilter(flavorId)}>This flavour</button>}
        </div>
        {!storageOK && <p className="gd3-tiny">⚠ Local storage is unavailable — scores are only kept for this browser session.</p>}
        {rows.length === 0 ? <p className="gd3-dim">No Speedrun finishes yet — be the first.</p> : (
          <div className="gd3-lbTableWrap">
            <table className="gd3-lbTable">
              <thead><tr><th>#</th><th>Nickname</th><th>Flavour</th><th>Solved</th><th>Time</th><th>Tries</th><th>Date</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r.solvedCount === 10 ? "gold" : ""}>
                    <td>{i + 1}</td><td>{r.nickname}</td><td>{r.flavour}</td><td>{r.solvedCount}/10</td>
                    <td>{fmtTime(r.totalTimeMs)}</td><td>{r.totalTries}</td>
                    <td>{new Date(r.date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button className="gd3-btn" onClick={onClose} style={{ marginTop: 12 }}>Close</button>
      </div>
    </div>
  );
}

function FlavorCarousel({ idx, setIdx }) {
  const dragRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const CARD_W = 168;
  function onDown(e) { dragRef.current = { startX: e.clientX, startIdx: idx }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} }
  function onMove(e) { if (!dragRef.current) return; setDragX(e.clientX - dragRef.current.startX); }
  function onUp() {
    if (!dragRef.current) return;
    const steps = Math.round(-dragX / CARD_W);
    setIdx(clamp(dragRef.current.startIdx + steps, 0, FLAVORS.length - 1));
    dragRef.current = null; setDragX(0);
  }
  const offset = -idx * CARD_W + dragX;
  return (
    <div className="gd3-carouselWrap">
      <button className="gd3-carArrow" onClick={() => setIdx(clamp(idx - 1, 0, FLAVORS.length - 1))} aria-label="Previous flavour">‹</button>
      <div className="gd3-carViewport" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        <div className="gd3-carTrack" style={{ transform: `translateX(${offset}px)`, transition: dragRef.current ? "none" : "transform .35s cubic-bezier(.2,.8,.2,1)" }}>
          {FLAVORS.map((f, i) => (
            <button key={f.id} type="button" className={"gd3-flavCard" + (i === idx ? " active" : "")} style={themeVars(f)} onClick={() => setIdx(i)}>
              <div className="gd3-flavSwatchRow"><span className="gd3-swatch" style={{ background: f.primary }} /><span className="gd3-swatch" style={{ background: f.accent }} /></div>
              <div className="gd3-flavName">{f.name}</div>
              <div className="gd3-flavMood">{f.mood}</div>
            </button>
          ))}
        </div>
      </div>
      <button className="gd3-carArrow" onClick={() => setIdx(clamp(idx + 1, 0, FLAVORS.length - 1))} aria-label="Next flavour">›</button>
      <div className="gd3-dots">
        {FLAVORS.map((f, i) => <button key={f.id} type="button" className={"gd3-dot" + (i === idx ? " on" : "")} onClick={() => setIdx(i)} aria-label={"Go to " + f.name} />)}
      </div>
    </div>
  );
}

/* ═══════════════ MAIN COMPONENT ═══════════════ */
export default function GradientDescentV3() {
  const [screen, setScreen] = useState("start");
  const [nickname, setNickname] = useState("");
  const [mode, setMode] = useState("speedrun");
  const [flavorIdx, setFlavorIdx] = useState(0);
  const [g, setG] = useState(null);
  const [tut, setTut] = useState(null);
  const [seenTut, setSeenTut] = useState(false);
  const [modal, setModal] = useState(null); // 'notebook' | 'leaderboard' | null
  const [fast, setFast] = useState(false);
  const [now, setNow] = useState(0);

  const gRef = useRef(null); gRef.current = g;
  const busyRef = useRef(false);
  const fastRef = useRef(false); fastRef.current = fast;
  const animRef = useRef(null);

  useEffect(() => () => clearInterval(animRef.current), []);
  useEffect(() => {
    if (screen !== "game" || !g || g.mode !== "speedrun" || g.finishedAt) return;
    setNow(Date.now());
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [screen, g && g.mode, g && g.finishedAt, g && g.problemIndex]);

  const flavor = g ? (FLAVORS.find(f => f.id === g.flavorId) || FLAVORS[0]) : FLAVORS[flavorIdx];

  /* ---------- deck / problem lifecycle ---------- */
  function dealDeck(gg) {
    const problem = PROBLEMS[gg.problemIndex];
    const dealCounter = (gg.dealCounter || 0) + 1;
    const rng = mulberry32(hashStr(gg.seedStr + "-deck-" + problem.id + "-" + dealCounter));
    return { ...gg, dealCounter, deck: buildDeck(rng, problem), current: null,
      slots: { model: null, compute: null, activation: null, loss: null, helper: null },
      discardsUsed: 0, lastRun: null };
  }
  function freshProblem(gg) { return dealDeck({ ...gg, triesUsedThisProblem: 0 }); }

  function startGame() {
    const name = nickname.trim(); if (!name) return;
    const fl = FLAVORS[flavorIdx];
    const seedStr = fl.name.toUpperCase().replace(/[^A-Z]/g, "");
    let gg = {
      nickname: name, flavorId: fl.id, mode, seedStr,
      problemIndex: 0, dealCounter: 0, startedAt: Date.now(), finishedAt: null,
      totalTries: 0, results: [], notebookUnlocked: [], problemMeta: {}, runAnim: null,
    };
    gg = freshProblem(gg);
    setG(gg); setModal(null); setScreen("game");
    if (!seenTut) { setTut(0); setSeenTut(true); }
  }

  function drawCard() {
    setG(gg => {
      if (!gg || gg.current || busyRef.current || !gg.deck.length) return gg;
      const deck = [...gg.deck]; const current = deck.shift();
      return { ...gg, deck, current };
    });
  }
  function keepCurrent() {
    setG(gg => {
      if (!gg || !gg.current) return gg;
      const type = gg.current.slotType; if (gg.slots[type]) return gg;
      return { ...gg, slots: { ...gg.slots, [type]: gg.current }, current: null };
    });
  }
  function discardCurrent() {
    setG(gg => {
      if (!gg || !gg.current) return gg;
      const type = gg.current.slotType; if (gg.slots[type] || gg.discardsUsed >= 3) return gg;
      return { ...gg, discardsUsed: gg.discardsUsed + 1, current: null };
    });
  }
  function skipCurrent() { setG(gg => (gg && gg.current) ? { ...gg, current: null } : gg); }
  function redeal() {
    const gg = gRef.current; if (!gg || busyRef.current || gg.current || gg.runAnim) return;
    const problem = PROBLEMS[gg.problemIndex];
    if (gg.results.some(r => r.problemId === problem.id)) return;
    setG(x => dealDeck(x));
  }

  function runNetwork() {
    const gg = gRef.current;
    if (!gg || busyRef.current || gg.current || gg.runAnim) return;
    if (!SLOT_TYPES.every(t => gg.slots[t])) return;
    busyRef.current = true;
    const problem = PROBLEMS[gg.problemIndex];
    const rng = mulberry32(hashStr(gg.seedStr + "-run-" + problem.id + "-" + gg.triesUsedThisProblem + "-" + gg.dealCounter));
    const result = computeOutcome(gg.slots, problem, rng);
    const curve = makeCurve(result.outcome, result.fit, rng);
    const total = curve.pts.length;
    setG(x => ({ ...x, runAnim: { result, curve, step: 0 } }));
    const iv = setInterval(() => {
      setG(x => {
        if (!x || !x.runAnim) { clearInterval(iv); return x; }
        const step = x.runAnim.step + 1;
        if (step >= total) {
          clearInterval(iv);
          setTimeout(() => commitRun(result, curve, problem), fastRef.current ? 250 : 700);
          return { ...x, runAnim: { ...x.runAnim, step: total } };
        }
        return { ...x, runAnim: { ...x.runAnim, step } };
      });
    }, fastRef.current ? 70 : 130);
    animRef.current = iv;
  }

  function commitRun(result, curve, problem) {
    busyRef.current = false;
    setG(gg => {
      if (!gg) return gg;
      let g2 = { ...gg, runAnim: null, totalTries: gg.totalTries + 1, triesUsedThisProblem: gg.triesUsedThisProblem + 1 };
      const meta = { ...g2.problemMeta };
      if (g2.slots.helper && g2.slots.helper.id === "gradstudent" && !meta[problem.id]?.bonusGranted) {
        meta[problem.id] = { ...(meta[problem.id] || {}), bonusGranted: true };
      }
      g2.problemMeta = meta;
      g2.lastRun = { ...result, curve };
      if (result.solved) {
        if (!g2.notebookUnlocked.includes(problem.id)) g2.notebookUnlocked = [...g2.notebookUnlocked, problem.id];
        g2.results = [...g2.results.filter(r => r.problemId !== problem.id), { problemId: problem.id, solved: true, tries: g2.triesUsedThisProblem, score: result.finalScore }];
      } else {
        const allowed = g2.mode === "learn" ? Infinity : 1 + (meta[problem.id]?.bonusGranted ? 1 : 0);
        if (g2.triesUsedThisProblem >= allowed) {
          g2.results = [...g2.results.filter(r => r.problemId !== problem.id), { problemId: problem.id, solved: false, tries: g2.triesUsedThisProblem, score: result.finalScore }];
        }
      }
      return g2;
    });
  }

  function nextProblem() {
    const gg = gRef.current; if (!gg) return;
    if (gg.problemIndex + 1 >= PROBLEMS.length) {
      const finishedAt = Date.now();
      const solvedCount = gg.results.filter(r => r.solved).length;
      if (gg.mode === "speedrun") {
        addBoardResult({ nickname: gg.nickname, flavour: (FLAVORS.find(f => f.id === gg.flavorId) || {}).name || gg.flavorId,
          totalTimeMs: finishedAt - gg.startedAt, totalTries: gg.totalTries, solvedCount, date: finishedAt });
      }
      setG(x => ({ ...x, finishedAt }));
      setScreen("win");
      return;
    }
    setG(x => freshProblem({ ...x, problemIndex: x.problemIndex + 1, lastRun: null }));
  }

  function playAgain() { setG(null); setNickname(""); setScreen("start"); setModal(null); }

  /* ═══════════════ SCREENS ═══════════════ */
  if (screen === "start") {
    const fl = FLAVORS[flavorIdx];
    return (
      <div className="gd3-root gd3-center" style={themeVars(fl)}><style>{css()}</style>
        <div className="gd3-startCard">
          <div className="gd3-eyebrow">an educational roguelike about training real neural networks</div>
          <h1 className="gd3-title">GRADIENT<br />DESCENT</h1>
          <p className="gd3-sub">Run an AI lab across 10 real open-science problems. Draw cards, build a loadout, watch the loss curve, beat the target — every outcome comes from a simple, checkable rule.</p>

          <label className="gd3-field">
            <span>Nickname</span>
            <input className="gd3-input" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="shown on the leaderboard" maxLength={20} />
          </label>

          <div className="gd3-modeRow">
            <button className={"gd3-modeBtn" + (mode === "speedrun" ? " on" : "")} onClick={() => setMode("speedrun")}>
              <b>Speedrun</b><span>timed &amp; ranked · limited tries per problem</span>
            </button>
            <button className={"gd3-modeBtn" + (mode === "learn" ? " on" : "")} onClick={() => setMode("learn")}>
              <b>Learn</b><span>no timer · unlimited tries</span>
            </button>
          </div>

          <div className="gd3-fieldLabel">Flavour <em>— also your seed: same flavour = same draws &amp; problem order</em></div>
          <FlavorCarousel idx={flavorIdx} setIdx={setFlavorIdx} />

          <div className="gd3-startActions">
            <button className="gd3-btn primary lg" disabled={!nickname.trim()} onClick={startGame}>Start →</button>
            <button className="gd3-btn lg" onClick={() => setTut(0)}>How to play</button>
            <button className="gd3-btn lg" onClick={() => setModal("leaderboard")}>🏆 Userboard</button>
          </div>
        </div>
        {tut !== null && <Tutorial step={tut} setStep={setTut} />}
        {modal === "leaderboard" && <LeaderboardPanel flavorId={fl.id} onClose={() => setModal(null)} />}
      </div>
    );
  }

  if (!g) return null;

  if (screen === "win") {
    const solvedCount = g.results.filter(r => r.solved).length;
    return (
      <div className="gd3-root gd3-center" style={themeVars(flavor)}><style>{css()}</style>
        <div className="gd3-startCard">
          <div className="gd3-eyebrow">seed complete</div>
          <h1 className="gd3-title" style={{ fontSize: 40 }}>{solvedCount === 10 ? "STATE OF THE ART" : "SEED COMPLETE"}</h1>
          <p className="gd3-sub">{g.nickname} · {flavor.name} · {g.mode === "speedrun" ? "Speedrun" : "Learn"} mode</p>
          <div className="gd3-abstract">
            <div className="gd3-absRow"><span>Solved</span><b>{solvedCount} / 10</b></div>
            {g.mode === "speedrun" && <div className="gd3-absRow"><span>Total time</span><b>{fmtTime(g.finishedAt - g.startedAt)}</b></div>}
            <div className="gd3-absRow"><span>Total tries</span><b>{g.totalTries}</b></div>
            <div className="gd3-absRow"><span>Notebook pages</span><b>{g.notebookUnlocked.length} / 10</b></div>
          </div>
          <div className="gd3-startActions">
            <button className="gd3-btn primary lg" onClick={() => setModal("leaderboard")}>🏆 View userboard</button>
            <button className="gd3-btn lg" onClick={() => setModal("notebook")}>📓 Notebook</button>
            <button className="gd3-btn lg" onClick={playAgain}>Play again</button>
          </div>
        </div>
        {modal === "leaderboard" && <LeaderboardPanel flavorId={g.flavorId} onClose={() => setModal(null)} />}
        {modal === "notebook" && <NotebookModal g={g} onClose={() => setModal(null)} />}
      </div>
    );
  }

  /* ---------- main game screen ---------- */
  const problem = PROBLEMS[g.problemIndex];
  const resultEntry = g.results.find(r => r.problemId === problem.id);
  const allFilled = SLOT_TYPES.every(t => g.slots[t]);
  const elapsed = g.mode === "speedrun" ? (g.finishedAt || now || Date.now()) - g.startedAt : null;
  const showEndCard = !g.runAnim && g.lastRun;

  return (
    <div className="gd3-root" style={themeVars(flavor)}><style>{css()}</style>
      <div className="gd3-top">
        <div className="gd3-brand">GRADIENT DESCENT</div>
        <div className="gd3-progressDots">
          {PROBLEMS.map((p, i) => {
            const r = g.results.find(x => x.problemId === p.id);
            const cls = i === g.problemIndex ? "cur" : r ? (r.solved ? "solved" : "failed") : (i < g.problemIndex ? "done" : "locked");
            return <span key={p.id} className={"gd3-pdot " + cls} title={p.title} />;
          })}
        </div>
        <div className="gd3-topbtns">
          {g.mode === "speedrun" && <span className="gd3-chip">⏱ {fmtTime(elapsed)}</span>}
          <span className="gd3-chip">tries {g.totalTries}</span>
          <button className="gd3-tbtn" onClick={() => setModal("notebook")}>📓 {g.notebookUnlocked.length}/10</button>
          <button className="gd3-tbtn" onClick={() => setModal("leaderboard")}>🏆</button>
          <button className="gd3-tbtn" onClick={() => setTut(0)}>?</button>
          <button className={"gd3-tbtn" + (fast ? " on" : "")} onClick={() => setFast(f => !f)}>Fast{fast ? " ✓" : ""}</button>
        </div>
      </div>

      <div className="gd3-col">
        <div className="gd3-infoBox">
          <div className="gd3-infoHead">
            <Icon2 id={problem.icon} size={40} primary="var(--primary)" accent="var(--accent)" />
            <div>
              <div className="gd3-infoTitleRow">
                <b>{g.problemIndex + 1}. {problem.title}</b>
                <span className={"gd3-diff " + difficultyTone(problem.difficulty)}>{problem.difficulty}</span>
              </div>
              <div className="gd3-tiny">{problem.field} · {problem.dataType}</div>
            </div>
          </div>
          <p className="gd3-body">{problem.infoShort}</p>
          {g.slots.helper?.id === "aiscientist" && (
            <p className="gd3-reveal">🔭 AI Scientist: the ideal model family here is <b>{problem.bestFit.map(id => MODELS.find(m => m.id === id).name).join(" or ")}</b>.</p>
          )}
          <div className="gd3-targetRow">Target: beat <b>{problem.target} {problem.metricLabel}</b> on validation · tries this problem: <b>{g.triesUsedThisProblem}</b>{g.mode === "speedrun" && <>/{1 + (g.problemMeta[problem.id]?.bonusGranted ? 1 : 0)}</>}</div>
        </div>

        {!g.runAnim && !showEndCard && (
          <>
            <div className="gd3-deckRow">
              <button className="gd3-deckPile" onClick={drawCard} disabled={!!g.current || !g.deck.length || busyRef.current} title="Draw a card">
                <Icon2 id="deckback" size={44} primary="var(--primary)" accent="var(--accent)" />
                <div className="gd3-deckCount">{g.deck.length} left</div>
              </button>
              <div className="gd3-pips">Discards: {[0, 1, 2].map(i => <span key={i} className={"gd3-pip" + (i < g.discardsUsed ? " used" : "")} />)}</div>
              {g.current && (
                <div className="gd3-drawPanel">
                  <div className="gd3-drawCardWrap"><CardFace card={g.current} type={g.current.slotType} size="lg" /></div>
                  {g.slots[g.current.slotType] ? (
                    <div className="gd3-drawActions">
                      <p className="gd3-tiny">Already have a {SLOT_LABEL[g.current.slotType]} card — this one's surplus.</p>
                      <button className="gd3-btn" onClick={skipCurrent}>Continue →</button>
                    </div>
                  ) : (
                    <div className="gd3-drawActions">
                      <button className="gd3-btn primary" onClick={keepCurrent}>Keep → {SLOT_LABEL[g.current.slotType]} slot</button>
                      <button className="gd3-btn" disabled={g.discardsUsed >= 3} onClick={discardCurrent}>
                        {g.discardsUsed >= 3 ? "No discards left" : `Discard & redraw (${3 - g.discardsUsed} left)`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="gd3-slotsGrid">
              {SLOT_TYPES.map(type => <CardFace key={type} card={g.slots[type]} type={type} size="md" />)}
            </div>

            <div className="gd3-actionsRow">
              <button className="gd3-btn primary lg" disabled={!allFilled || !!g.current} onClick={runNetwork}>▶ Run</button>
              <button className="gd3-btn lg" disabled={!!g.current || !!resultEntry} onClick={redeal}>⟲ Redeal (free)</button>
            </div>
          </>
        )}

        {g.runAnim && (
          <div className="gd3-runBox">
            <LossCurve curve={g.runAnim.curve} step={g.runAnim.step} outcome={g.runAnim.result.outcome} />
            <div className="gd3-runTicker">{tickerText(g.runAnim)}</div>
          </div>
        )}
      </div>

      {showEndCard && (
        <div className="gd3-overlay">
          <div className="gd3-modal">
            <div className="gd3-eyebrow">{outcomeLabel(g.lastRun.outcome)}</div>
            <h2 className="gd3-h2">{g.lastRun.solved ? "Target beaten ✓" : (g.lastRun.outcome === "oom" ? "Run wasted" : "Target missed")}</h2>
            <LossCurve curve={g.lastRun.curve} step={g.lastRun.curve.pts.length} outcome={g.lastRun.outcome} />
            <p className="gd3-body">{verdictText(g.lastRun, problem)}</p>
            <div className="gd3-modalFoot">
              {resultEntry ? (
                <button className="gd3-btn primary lg" onClick={nextProblem}>{g.problemIndex + 1 >= PROBLEMS.length ? "See results →" : "Next problem →"}</button>
              ) : (
                <button className="gd3-btn primary lg" onClick={() => setG(x => dealDeck(x))}>Try again →</button>
              )}
            </div>
          </div>
        </div>
      )}

      {tut !== null && <Tutorial step={tut} setStep={setTut} />}
      {modal === "notebook" && <NotebookModal g={g} onClose={() => setModal(null)} />}
      {modal === "leaderboard" && <LeaderboardPanel flavorId={g.flavorId} onClose={() => setModal(null)} />}
    </div>
  );
}

function NotebookModal({ g, onClose }) {
  const [sel, setSel] = useState(null);
  return (
    <div className="gd3-overlay" onClick={onClose}>
      <div className="gd3-modal wide" onClick={e => e.stopPropagation()}>
        <h2 className="gd3-h2">📓 Lab Notebook <span className="gd3-tiny">{g.notebookUnlocked.length}/10 — pages unlock as you solve each problem</span></h2>
        <div className="gd3-nbGrid">
          <div className="gd3-nbList">
            {PROBLEMS.map(p => {
              const open = g.notebookUnlocked.includes(p.id);
              return <button key={p.id} disabled={!open} className={"gd3-nbItem" + (sel === p.id ? " on" : "")} onClick={() => setSel(p.id)}>{open ? p.title : "· · ·"}</button>;
            })}
          </div>
          <div className="gd3-nbBody">
            {sel ? (() => { const p = PROBLEMS.find(q => q.id === sel); return (<><h3>{p.title}</h3><p>{p.infoFull}</p></>); })() : <div className="gd3-dim">Pick an unlocked page.</div>}
          </div>
        </div>
        <button className="gd3-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/* ---------- styles ---------- */
function css() {
  return `
  .gd3-root{min-height:100vh;background:var(--bg);color:var(--text);font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:13px;
    --surface:color-mix(in srgb, var(--bg) 90%, var(--text) 10%);
    --muted:color-mix(in srgb, var(--text) 55%, var(--bg) 45%);
    --border:color-mix(in srgb, var(--text) 22%, transparent);
    --shadow:color-mix(in srgb, var(--text) 18%, transparent);
    background-image:linear-gradient(color-mix(in srgb, var(--text) 4%, transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb, var(--text) 4%, transparent) 1px,transparent 1px);background-size:22px 22px;}
  .gd3-root *{box-sizing:border-box}
  .gd3-root button{font-family:inherit;cursor:pointer;color:inherit}
  .gd3-root button:disabled{cursor:default;opacity:.4}
  .gd3-root input{font-family:inherit}
  .gd3-center{display:flex;align-items:center;justify-content:center;padding:24px}
  .gd3-eyebrow{letter-spacing:.14em;text-transform:uppercase;font-size:10px;color:var(--muted)}
  .gd3-tiny{font-size:10px;color:var(--muted)}
  .gd3-dim{color:var(--muted);font-size:11px}
  .gd3-body{line-height:1.6;font-size:12.5px}
  .gd3-h2{font-family:Georgia,serif;margin:6px 0}

  .gd3-startCard{max-width:640px;width:100%;text-align:center;background:var(--surface);border:1.5px solid var(--border);border-radius:14px;box-shadow:5px 5px 0 var(--shadow);padding:34px 30px}
  .gd3-title{font-family:Georgia,serif;font-size:50px;line-height:.95;margin:10px 0 12px;color:var(--primary)}
  .gd3-sub{color:var(--muted);max-width:520px;margin:0 auto 18px;line-height:1.6}
  .gd3-field{display:flex;flex-direction:column;gap:5px;text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:0 auto 14px;max-width:320px}
  .gd3-input{border:1.5px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text);padding:9px 11px;font-family:inherit;font-size:14px;text-transform:none;letter-spacing:0}
  .gd3-modeRow{display:flex;gap:10px;max-width:420px;margin:0 auto 18px}
  .gd3-modeBtn{flex:1;text-align:left;border:1.5px solid var(--border);border-radius:9px;background:var(--bg);padding:10px 12px;display:flex;flex-direction:column;gap:3px}
  .gd3-modeBtn b{font-size:12.5px}
  .gd3-modeBtn span{font-size:10px;color:var(--muted)}
  .gd3-modeBtn.on{border-color:var(--primary);box-shadow:0 0 0 2px color-mix(in srgb, var(--primary) 30%, transparent)}
  .gd3-fieldLabel{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:4px 0 8px}
  .gd3-fieldLabel em{font-style:normal;text-transform:none;letter-spacing:0;opacity:.8}
  .gd3-startActions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px}

  .gd3-btn{border:1.5px solid var(--border);background:var(--bg);color:var(--text);border-radius:8px;padding:9px 15px;font-size:12.5px;box-shadow:2px 2px 0 var(--shadow)}
  .gd3-btn.sm{padding:5px 10px;font-size:11px;box-shadow:none}
  .gd3-btn.lg{padding:11px 18px;font-size:13px}
  .gd3-btn.primary{background:var(--primary);border-color:var(--primary);color:var(--bg)}
  .gd3-btn.on{background:var(--primary);border-color:var(--primary);color:var(--bg)}

  .gd3-carouselWrap{display:flex;align-items:center;gap:8px;justify-content:center;margin-bottom:6px}
  .gd3-carArrow{border:1.5px solid var(--border);background:var(--bg);border-radius:50%;width:32px;height:32px;font-size:16px;line-height:1;flex:none}
  .gd3-carViewport{width:400px;max-width:60vw;overflow:hidden;touch-action:pan-y}
  .gd3-carTrack{display:flex;gap:18px;padding:4px 0}
  .gd3-flavCard{flex:none;width:150px;border:1.5px solid color-mix(in srgb, var(--text) 15%, transparent);border-radius:12px;background:var(--bg);color:var(--text);padding:12px;text-align:left;opacity:.55;transform:scale(.94);transition:opacity .25s,transform .25s}
  .gd3-flavCard.active{opacity:1;transform:scale(1);border-color:var(--primary);box-shadow:0 0 0 2px color-mix(in srgb, var(--primary) 35%, transparent)}
  .gd3-flavSwatchRow{display:flex;gap:5px;margin-bottom:8px}
  .gd3-swatch{width:16px;height:16px;border-radius:50%;display:inline-block;border:1px solid rgba(0,0,0,.15)}
  .gd3-flavName{font-weight:700;font-size:12.5px}
  .gd3-flavMood{font-size:10px;opacity:.7}
  .gd3-dots{display:flex;gap:5px;justify-content:center;margin-top:8px}
  .gd3-dot{width:6px;height:6px;border-radius:50%;border:none;background:var(--border);padding:0}
  .gd3-dot.on{background:var(--primary)}

  .gd3-top{display:flex;align-items:center;gap:14px;padding:9px 16px;border-bottom:1.5px solid var(--border);background:var(--surface);flex-wrap:wrap}
  .gd3-brand{font-family:Georgia,serif;font-weight:700;color:var(--primary)}
  .gd3-progressDots{display:flex;gap:5px;flex:1;min-width:140px}
  .gd3-pdot{width:9px;height:9px;border-radius:50%;background:var(--border);display:inline-block}
  .gd3-pdot.cur{background:var(--primary);box-shadow:0 0 0 3px color-mix(in srgb, var(--primary) 30%, transparent)}
  .gd3-pdot.solved{background:var(--accent)}
  .gd3-pdot.failed{background:color-mix(in srgb, var(--text) 35%, transparent)}
  .gd3-pdot.done{background:var(--accent)}
  .gd3-topbtns{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  .gd3-chip{border:1.5px solid var(--border);border-radius:20px;background:var(--bg);padding:3px 10px;font-weight:700;font-size:11px}
  .gd3-tbtn{border:1.5px solid var(--border);border-radius:6px;background:var(--bg);padding:5px 10px;font-size:11px}
  .gd3-tbtn.on{background:var(--primary);color:var(--bg)}

  .gd3-col{max-width:900px;margin:0 auto;padding:14px 14px 40px;display:flex;flex-direction:column;gap:12px}
  .gd3-infoBox{background:var(--surface);border:1.5px solid var(--border);border-radius:10px;box-shadow:3px 3px 0 var(--shadow);padding:14px 16px}
  .gd3-infoHead{display:flex;gap:12px;align-items:flex-start;margin-bottom:8px}
  .gd3-infoTitleRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .gd3-diff{font-size:9px;letter-spacing:.08em;text-transform:uppercase;border-radius:10px;padding:2px 8px;font-weight:700}
  .gd3-diff.easy{background:#dcfce7;color:#166534}
  .gd3-diff.med{background:#fef3c7;color:#92400e}
  .gd3-diff.hard{background:#fee2e2;color:#991b1b}
  .gd3-reveal{font-size:11.5px;color:var(--primary);margin:6px 0 0}
  .gd3-targetRow{margin-top:8px;font-size:11.5px;color:var(--muted);border-top:1px dashed var(--border);padding-top:8px}

  .gd3-deckRow{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;background:var(--surface);border:1.5px solid var(--border);border-radius:10px;box-shadow:3px 3px 0 var(--shadow);padding:14px}
  .gd3-deckPile{display:flex;flex-direction:column;align-items:center;gap:4px;border:1.5px dashed var(--border);border-radius:10px;background:var(--bg);padding:10px 14px}
  .gd3-deckCount{font-size:10px;color:var(--muted)}
  .gd3-pips{display:flex;gap:5px;align-items:center;font-size:11px;color:var(--muted)}
  .gd3-pip{width:9px;height:9px;border-radius:50%;border:1.5px solid var(--border);display:inline-block}
  .gd3-pip.used{background:var(--border)}
  .gd3-drawPanel{display:flex;gap:14px;align-items:center;flex-wrap:wrap;flex:1}
  .gd3-drawCardWrap{animation:gd3flip .45s ease}
  @keyframes gd3flip{from{transform:rotateY(85deg);opacity:0}to{transform:rotateY(0deg);opacity:1}}
  @media(prefers-reduced-motion:reduce){.gd3-drawCardWrap{animation:none}}
  .gd3-drawActions{display:flex;flex-direction:column;gap:6px;align-items:flex-start}

  .gd3-slotsGrid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
  @media(max-width:640px){.gd3-slotsGrid{grid-template-columns:repeat(2,1fr)}}
  .gd3-slot,.gd3-cardFace{border:2px solid var(--border);border-radius:10px;background:var(--bg);padding:10px 6px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px;min-height:96px;justify-content:center}
  .gd3-cardFace{border-color:var(--primary);box-shadow:2px 2px 0 var(--shadow)}
  .gd3-cardFace.lg,.gd3-slot.lg{min-height:120px;padding:14px 10px}
  .gd3-cardIconWrap{height:46px;display:flex;align-items:center}
  .gd3-cardName{font-size:11px;font-weight:700}
  .gd3-cardType{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
  .gd3-slotType{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}

  .gd3-actionsRow{display:flex;gap:10px;flex-wrap:wrap}

  .gd3-runBox{background:var(--surface);border:1.5px solid var(--border);border-radius:10px;box-shadow:3px 3px 0 var(--shadow);padding:14px;position:relative;overflow:hidden}
  .gd3-runBox::after{content:'';position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,color-mix(in srgb, var(--text) 3%, transparent) 0 1px,transparent 1px 3px)}
  .gd3-curveBox.glitch{animation:gd3shake .12s linear infinite}
  @keyframes gd3shake{0%{transform:translate(0,0)}25%{transform:translate(-2px,1px)}50%{transform:translate(2px,-1px)}75%{transform:translate(-1px,2px)}100%{transform:translate(0,0)}}
  .gd3-curveSvg{width:100%;height:200px;display:block}
  .gd3-gridline{stroke:var(--border);stroke-width:1}
  .gd3-trainLine{stroke:var(--primary);stroke-width:2.5}
  .gd3-valLine{stroke:var(--accent);stroke-width:2;stroke-dasharray:5 4}
  .gd3-glitchText{fill:#ef4444;font:700 13px ui-monospace,monospace}
  .gd3-curveLegend{display:flex;gap:14px;font-size:10px;color:var(--muted);margin-top:4px}
  .gd3-legTrain{color:var(--primary)}
  .gd3-legVal{color:var(--accent)}
  .gd3-runTicker{margin-top:8px;font-size:12px;color:var(--muted);border-top:1px dashed var(--border);padding-top:8px}

  .gd3-overlay{position:fixed;inset:0;background:color-mix(in srgb, var(--text) 45%, transparent);display:flex;align-items:center;justify-content:center;padding:16px;z-index:40}
  .gd3-modal{background:var(--surface);color:var(--text);border:2px solid var(--border);border-radius:12px;box-shadow:6px 6px 0 var(--shadow);padding:20px 24px;max-width:620px;width:100%;max-height:88vh;overflow:auto}
  .gd3-modal.narrow{max-width:480px}
  .gd3-modal.wide{max-width:820px}
  .gd3-modalFoot{display:flex;gap:8px;justify-content:space-between;margin-top:14px;flex-wrap:wrap}

  .gd3-abstract{border:1px solid var(--border);background:var(--bg);text-align:left;border-radius:8px;padding:12px 14px;margin:14px auto;max-width:400px}
  .gd3-absRow{display:flex;justify-content:space-between;padding:4px 0;font-size:12.5px}

  .gd3-lbFilters{display:flex;gap:8px;margin:8px 0 12px}
  .gd3-lbTableWrap{overflow-x:auto}
  .gd3-lbTable{width:100%;border-collapse:collapse;font-size:12px}
  .gd3-lbTable th{text-align:left;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--border);padding:5px 8px}
  .gd3-lbTable td{padding:6px 8px;border-bottom:1px dashed var(--border)}
  .gd3-lbTable tr.gold td{color:var(--primary);font-weight:700}

  .gd3-nbGrid{display:grid;grid-template-columns:220px 1fr;gap:14px;margin:12px 0}
  @media(max-width:640px){.gd3-nbGrid{grid-template-columns:1fr}}
  .gd3-nbList{display:flex;flex-direction:column;gap:4px;max-height:340px;overflow:auto}
  .gd3-nbItem{text-align:left;border:1px solid var(--border);border-radius:5px;background:var(--bg);padding:7px 9px;font-size:11px}
  .gd3-nbItem.on{border-color:var(--primary);font-weight:700}
  .gd3-nbItem:disabled{color:var(--muted)}
  .gd3-nbBody h3{font-family:Georgia,serif;margin:0 0 8px}
  .gd3-nbBody p{line-height:1.7;font-size:12.5px}
  `;
}
