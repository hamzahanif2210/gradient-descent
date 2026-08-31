/* ═══════════════════════════════════════════════════════════════
   GRADIENT DESCENT v4 — data & pure logic (no React here).
   Session-wide deck economy + roguelike permadeath, on top of the
   same 10 real science problems from v3.
   ═══════════════════════════════════════════════════════════════ */

/* ---------- seeded RNG ---------- */
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function fmtTime(ms) {
  if (ms == null || ms < 0 || !isFinite(ms)) ms = 0;
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), ss = s % 60;
  return String(m).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
}

/* ---------- the 10 flavours (seed + theme) ---------- */
export const FLAVORS = [
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
export const themeVars = f => ({ "--primary": f.primary, "--accent": f.accent, "--bg": f.bg, "--text": f.text });

/* ---------- card pools ---------- */
export const SLOT_TYPES = ["model", "compute", "activation", "loss", "helper"];
export const SLOT_LABEL = { model: "Model", compute: "Compute", activation: "Activation", loss: "Loss", helper: "Helper", helper2: "Helper 2" };

export const MODELS = [
  { id: "mlp", name: "MLP", icon: "mlp", tip: "Stacks of dense layers. The right default for tables of numbers." },
  { id: "cnn", name: "CNN", icon: "cnn", tip: "Slides filters over a grid to find local patterns. Built for images." },
  { id: "cnn1d", name: "1D-CNN", icon: "cnn1d", tip: "A CNN that slides along a single time axis. Great for signals & time-series." },
  { id: "rnn", name: "RNN / LSTM", icon: "rnn", tip: "Reads a sequence step by step and remembers what it saw." },
  { id: "transformer", name: "Transformer", icon: "transformer", tip: "Every element attends to every other at once. Hungry for data & compute." },
  { id: "gnn", name: "GNN", icon: "gnn", tip: "Passes messages along a graph of connected nodes." },
  { id: "unet", name: "U-Net", icon: "unet", tip: "A CNN that shrinks an image down, then rebuilds it. Pixel-perfect output." },
  { id: "cnn3d", name: "3D-CNN", icon: "cnn3d", tip: "A CNN with an extra spatial axis, for volumes instead of flat images." },
];
export const COMPUTE = [
  { id: "cpu", name: "Laptop CPU", tier: 0, icon: "cpu", tip: "Free and always around. Struggles with anything heavy." },
  { id: "gpu1", name: "Single GPU", tier: 1, icon: "gpu1", tip: "A real accelerator. Good for small-to-medium models." },
  { id: "gpu_multi", name: "Multi-GPU rig", tier: 2, icon: "gpu_multi", tip: "Several GPUs sharing the work. Handles big models." },
  { id: "datacenter", name: "Datacenter", tier: 3, icon: "datacenter", tip: "8× datacenter-class GPUs. Practically no ceiling — if you can afford it." },
];
export const ACTIVATIONS = [
  { id: "relu", name: "ReLU", icon: "relu", tip: "Negatives become 0. Simple, fast, the modern default." },
  { id: "gelu", name: "GELU", icon: "gelu", tip: "A smooth cousin of ReLU. Used in transformers." },
  { id: "sigmoid", name: "Sigmoid", icon: "sigmoid", tip: "Squashes to 0–1. Prone to vanishing gradients when stacked deep." },
  { id: "tanh", name: "Tanh", icon: "tanh", tip: "Squashes to −1..1. Same vanishing-gradient issue as Sigmoid." },
];
export const LOSSES = [
  { id: "xent", name: "Cross-Entropy", icon: "xent", tip: "The standard loss for classification." },
  { id: "mse", name: "MSE", icon: "mse", tip: "Mean Squared Error — the standard loss for regression." },
  { id: "contrastive", name: "Contrastive", icon: "contrastive", tip: "Pulls similar examples together, pushes different ones apart." },
  { id: "focal", name: "Focal", icon: "focal", tip: "Cross-Entropy that down-weights easy examples — built for rare events." },
];
export const HELPERS = [
  { id: "aiscientist", name: "AI Scientist", icon: "aiscientist", tip: "Reveals this problem's ideal model family." },
  { id: "gradstudent", name: "Grad Student", icon: "gradstudent", tip: "A pair of hands — no direct scoring effect, just morale." },
  { id: "dataaug", name: "Data Augmentation", icon: "dataaug", tip: "Synthesizes more training examples. Cuts overfitting risk." },
  { id: "dropout", name: "Dropout", icon: "dropout", tip: "Randomly mutes neurons while training. Cuts overfitting risk." },
  { id: "earlystop", name: "Early Stopping", icon: "earlystop", tip: "Stops training at the best epoch — the overfitting climb never happens." },
  { id: "norm", name: "Normalization", icon: "norm", tip: "Keeps activations well-scaled. Speeds up and stabilizes convergence." },
  { id: "ensemble", name: "Ensemble", icon: "ensemble", tip: "Averages several models together for a steadier final score." },
];
export const POOLS = { model: MODELS, compute: COMPUTE, activation: ACTIVATIONS, loss: LOSSES, helper: HELPERS };
export const HEAVY_MODELS = ["transformer", "cnn3d", "unet", "gnn"];
export const DATA_SCALE_TIER = { tiny: 0, small: 0, medium: 1, large: 2 };

/* ---------- the 10 real science problems, in unlock order ---------- */
export const PROBLEMS = [
  { id: "higgs", title: "Higgs ML Challenge", field: "Particle physics", difficulty: "Easy", dataType: "Tabular kinematic features",
    why: "Every collision at the Large Hadron Collider produces a spray of particles, and only a tiny fraction are genuine Higgs boson decays — the rest just look like them. A model that can tell real signal from background noise saves physicists from combing through millions of events by hand. This exact challenge, run in 2014, is credited with pulling particle physics seriously into machine learning. It's a clean tabular problem: no images, no sequences, just measured numbers per collision.",
    bestFit: ["mlp"], okFit: ["gnn"], validLoss: ["xent", "focal"], bestLoss: "xent", dataScale: "large", minTier: 0, target: 76, metricLabel: "AUC",
    briefing: {
      problem: "In 2012, physicists confirmed the Higgs boson exists — but every collision at the Large Hadron Collider produces mostly background noise that LOOKS like a Higgs decay. The task: tell real signal from background.",
      data: "Each collision event is one row of about 30 numbers — particle energies, momenta, angles — reconstructed by the detector. Roughly 800,000 labeled events to learn from.",
      hard: "Real Higgs events are a needle in a haystack: only a tiny fraction of collisions are true signal.",
      nudge: "No pixels, no time axis — just a flat table of measurements per event.",
      impact: "This exact challenge (Higgs ML, 2014) shaped how particle physics adopted machine learning for the LHC.",
    }, icon: "higgs" },
  { id: "molecular", title: "Molecular Property (ESOL / Tox21)", field: "Chemistry", difficulty: "Easy/Med", dataType: "SMILES strings",
    why: "Synthesizing and testing a new molecule in a lab is slow and expensive, so chemists want to know its solubility or toxicity before they ever make it. Machine learning lets you predict those properties straight from the molecule's structure, screening thousands of candidates in seconds. The tricky part is that the same atoms arranged differently can behave completely differently, so the model has to learn real structure, not just count atoms. This is a genuine part of modern drug and materials discovery pipelines today.",
    bestFit: ["mlp", "gnn"], validLoss: ["mse", "xent", "focal"], dataScale: "medium", minTier: 0, target: 78, metricLabel: "R² / AUC",
    briefing: {
      problem: "Predict a chemical property of a molecule — how soluble it is in water (ESOL), or whether it's toxic (Tox21) — before ever synthesizing it in a lab.",
      data: "Each molecule arrives as a SMILES string (a compact text encoding of its atoms and bonds) — a few thousand molecules depending on the dataset.",
      hard: "The same handful of atoms arranged differently can have wildly different properties — the model has to learn structure, not just atom counts.",
      nudge: "A molecule can be flattened into descriptor numbers, or kept as the literal graph of atoms and bonds it actually is.",
      impact: "Cheaper property prediction means fewer molecules need to be physically synthesized and tested — a real part of modern drug and materials discovery.",
    }, icon: "molecular" },
  { id: "climate", title: "Climate Pattern Detection (ClimateNet)", field: "Earth science", difficulty: "Med", dataType: "Gridded spatial data",
    why: "Climate simulations produce decades of gridded weather data — far too much for a human to scan by eye for atmospheric rivers and cyclones. A model that treats each snapshot like an image, with pressure and wind standing in for color channels, can pick out these patterns automatically. That matters because even human experts disagree on the exact boundary of a storm, so the model is learning a genuinely fuzzy target. Automating this lets scientists track how extreme weather frequency is shifting over long time spans.",
    bestFit: ["cnn", "unet"], validLoss: ["xent", "focal"], dataScale: "large", minTier: 1, target: 82, metricLabel: "IoU",
    briefing: {
      problem: "Automatically find extreme weather patterns — atmospheric rivers and tropical cyclones — in huge climate simulation outputs, instead of a human squinting at every map.",
      data: "Each example is a gridded snapshot of the atmosphere: multiple channels (pressure, wind, moisture) laid over latitude/longitude.",
      hard: "These patterns have fuzzy, irregular boundaries — even human experts disagree exactly where one starts and ends.",
      nudge: "This is fundamentally a picture — just with weather variables standing in for color channels.",
      impact: "Better automatic detection lets climate scientists track how extreme weather frequency is changing over decades of data.",
    }, icon: "climate" },
  { id: "jet", title: "Jet Classification", field: "Particle physics", difficulty: "Hard", dataType: "Detector images/features",
    why: "High-energy collisions spray out \"jets\" of secondary particles, and figuring out which fundamental particle started a given jet is central to searching for new physics at the LHC. A jet can be treated as an image of detector energy deposits or as a graph of the individual particles it contains — but a plain flat table misses the structure entirely. Different source particles can produce jets that look deceptively similar, so the differences the model has to learn are subtle and structural, not obvious. Jet tagging like this runs in real LHC analyses every day.",
    bestFit: ["cnn", "gnn"], validLoss: ["xent", "focal"], dataScale: "large", minTier: 2, target: 86, metricLabel: "Accuracy",
    briefing: {
      problem: "When particles collide at high energy, they spray out 'jets' of secondary particles. Figure out which fundamental particle a jet came from.",
      data: "Each jet can be represented as an image of energy deposited across detector cells, or as a list/graph of the individual particles inside it.",
      hard: "Different source particles can produce jets that look deceptively similar at first glance — the differences are subtle and structural.",
      nudge: "Whether you treat it as an image or as a set of connected particles, an order-independent flat table misses the structure.",
      impact: "Jet tagging like this is used daily in real LHC analyses to search for new physics.",
    }, icon: "jet" },
  { id: "exoplanet", title: "Exoplanet Detection", field: "Astronomy", difficulty: "Easy/Med", dataType: "1D light-curve time-series",
    why: "A planet crossing in front of its star dims that star's light by a fraction of a percent for a few hours — too subtle and too rare for a human to spot across millions of stars. ML models scan the brightness-over-time curve of every star and flag the faint dips that look like a transit. This is exactly how real missions like Kepler and TESS have confirmed thousands of exoplanets. Since it's one long strip of numbers over time, this is a natural fit for models built to read sequences.",
    bestFit: ["cnn1d", "rnn"], validLoss: ["xent", "focal"], bestLoss: "focal", dataScale: "medium", minTier: 0, target: 80, metricLabel: "Recall",
    briefing: {
      problem: "Find planets orbiting other stars by watching for the tiny dimming that happens when a planet passes in front of its star.",
      data: "Each example is a light curve: the star's brightness measured at thousands of points in time, across weeks of observation.",
      hard: "A real transit dims the star by a fraction of a percent, for just a few hours — and other noise can look similar.",
      nudge: "This is a single long strip of numbers over time, not a 2-D image.",
      impact: "This is how missions like Kepler and TESS have found thousands of real exoplanets.",
    }, icon: "exoplanet" },
  { id: "genomics", title: "Gene Expression / Cancer Subtype (TCGA)", field: "Biology/Medicine", difficulty: "Med", dataType: "High-dim tabular, tiny samples",
    why: "Knowing a tumor's cancer subtype from its gene activity can directly guide which treatment a patient gets. The catch: each patient row has around 20,000 gene measurements but there may be only a few hundred patients total, so a hungry model can \"memorize\" the training set and still know nothing real about new patients. The skill this problem tests isn't picking a fancy architecture — it's keeping the model humble enough to generalize. Gene-expression subtyping like this, based on real TCGA research, already informs actual clinical treatment decisions.",
    bestFit: ["mlp"], validLoss: ["xent"], dataScale: "tiny", minTier: 0, overfitTrap: true, target: 83, metricLabel: "Accuracy",
    briefing: {
      problem: "Given a tumor's gene activity levels, predict which cancer subtype it is — a diagnosis that guides treatment.",
      data: "Each patient is one row: the expression level of roughly 20,000 genes. There might be only a few hundred patients total.",
      hard: "Vastly more measurements (genes) than examples (patients) — a hungry model can fit the training data perfectly and still know nothing real.",
      nudge: "It's still a flat table of numbers per patient — the challenge isn't the architecture, it's keeping the model humble.",
      impact: "Gene-expression subtyping (as in real TCGA research) already informs which cancer treatments are likely to work for a given patient.",
    }, icon: "genomics" },
  { id: "gravwave", title: "Gravitational Wave Detection (G2Net)", field: "Physics", difficulty: "Med/Hard", dataType: "Noisy strain → spectrogram",
    why: "Colliding black holes send ripples through spacetime, but by the time they reach Earth the signal is a thousand times quieter than the instrument's own noise. Turning the raw strain measurement into a time-vs-frequency spectrogram makes the telltale rising \"chirp\" something a vision-style model can actually see. This is the real detection pipeline behind LIGO and Virgo's confirmed discoveries — and it's a genuinely hard needle-in-haystack search, since noise alone can mimic the shape of a real signal.",
    bestFit: ["cnn"], okFit: ["cnn1d"], validLoss: ["xent", "focal"], bestLoss: "focal", dataScale: "large", minTier: 1, target: 85, metricLabel: "AUC",
    briefing: {
      problem: "Detect gravitational waves — ripples in spacetime from colliding black holes — inside a wall of instrument noise a thousand times louder than the signal.",
      data: "Raw data is a strain signal measured over time. It's commonly converted into a spectrogram — a time-vs-frequency image — before modeling.",
      hard: "True detections are astronomically rare, and noise can easily mimic the shape of a real signal.",
      nudge: "Once you turn the signal into a time-vs-frequency picture, the telltale 'chirp' becomes something you can see.",
      impact: "This is the real detection pipeline behind LIGO/Virgo's confirmed gravitational wave discoveries.",
    }, icon: "gravwave" },
  { id: "neutrino", title: "Neutrino Event Classification (IceCube)", field: "Particle physics", difficulty: "Hard", dataType: "Detector data (different geometry)",
    why: "IceCube buries thousands of light sensors deep in Antarctic ice, waiting for the faint flash a neutrino leaves as it passes through — against a constant flood of ordinary cosmic-ray muons that look similar. The sensors aren't arranged in a neat camera grid, they're a large, sparse, irregular 3-D array, so this needs a model built for that kind of structure rather than a standard image model. Genuine neutrino events are a tiny minority of all hits, so the loss function has to avoid just learning to predict \"background\" every time. IceCube's real detections have opened a new window onto extreme cosmic events like black hole jets and neutron star collisions.",
    bestFit: ["cnn", "gnn"], validLoss: ["focal", "xent"], bestLoss: "focal", dataScale: "large", minTier: 2, target: 87, metricLabel: "AUC",
    briefing: {
      problem: "IceCube buries thousands of sensors deep in Antarctic ice to catch faint flashes of light from neutrinos passing through — and must pick those rare events out from a flood of ordinary cosmic-ray muons.",
      data: "Each event is a pattern of light-sensor hits across a large, sparse, irregularly-spaced 3-D array of detectors.",
      hard: "Real neutrino events are a tiny minority against an overwhelming background, and the detector geometry isn't a neat camera grid.",
      nudge: "This needs a model built for irregular structure — and a loss that doesn't just learn to predict 'background' every time.",
      impact: "IceCube's real detections opened a new window onto extreme cosmic events like black hole jets and neutron star collisions.",
    }, icon: "neutrino" },
  { id: "cosmology", title: "Cosmological Parameter Estimation (Quijote)", field: "Cosmology", difficulty: "Hard", dataType: "3D density fields",
    why: "Simulations like Quijote produce a 3-D snapshot of how matter clumps together across a slice of the universe, and from that clumping pattern you can estimate the underlying physical constants that produced it — like the total matter density. The relationship between subtle clumping and those parameters is complex and highly nonlinear, and critically, this data has real depth as well as height and width, so a model built only for flat images is missing a whole dimension. Models trained on simulations like this genuinely help cosmologists interpret real telescope surveys of the universe's large-scale structure.",
    bestFit: ["cnn3d"], validLoss: ["mse"], bestLoss: "mse", dataScale: "large", minTier: 2, target: 88, metricLabel: "R²",
    briefing: {
      problem: "From a simulated snapshot of how matter is distributed across a slice of the universe, estimate the true cosmological parameters that produced it — like the total matter density.",
      data: "Each example is a full 3-D density field — a cube of numbers describing matter clumping — from a single cosmological simulation.",
      hard: "The relationship between a subtle clumping pattern and the underlying physical parameters is complex and highly nonlinear.",
      nudge: "This data has depth as well as height and width — a model built for flat images is missing a whole dimension.",
      impact: "Simulations like Quijote and models trained on them help cosmologists interpret real telescope surveys of the universe's structure.",
    }, icon: "cosmology" },
  { id: "protein", title: "Protein Structure / Function", field: "Biology", difficulty: "Hard", dataType: "Amino-acid sequences",
    why: "A protein's function comes from how its chain of amino acids folds into a 3-D shape, and predicting that structure or function straight from the sequence is a huge head start over slow lab experiments. Sequences are read in order, one position after another, much like a sentence in a language — but positions that are far apart in the sequence can end up right next to each other once the chain folds, which is what makes this genuinely hard. This is the exact problem AlphaFold tackled, and solving it well transformed structural biology practically overnight.",
    bestFit: ["rnn", "transformer"], validLoss: ["xent", "contrastive"], dataScale: "large", minTier: 2, target: 90, metricLabel: "Accuracy",
    briefing: {
      problem: "Predict a protein's structure or function directly from the sequence of amino acids that make it up.",
      data: "Each example is a sequence — a chain of amino acids, read start to end, sometimes thousands of positions long.",
      hard: "Function depends on how the sequence folds in 3-D, and distant positions can end up right next to each other once folded.",
      nudge: "This is read in order, one position after another, much like a sentence in a language.",
      impact: "This is the exact problem AlphaFold tackled — and solving it well transformed structural biology practically overnight.",
    }, icon: "protein" },
];

export function difficultyTone(diff) {
  if (diff.includes("Hard")) return "hard";
  if (diff.includes("Med")) return "med";
  return "easy";
}

/* one-line briefing blurb keyed off difficulty tier */
export const DIFFICULTY_BRIEF = {
  easy: "Easy — plenty of room here, focus on fundamentals.",
  med: "Medium — balance fit and generalization.",
  hard: "Hard — precision required, mind your compute budget.",
};
export function difficultyBrief(diff) {
  return DIFFICULTY_BRIEF[difficultyTone(diff)] || "";
}

/* ---------- GPU compute-tier estimate for the currently built cards ---------- */
export function gpuComputeTier(built) {
  const list = built || [];
  const computeCard = list.find(c => c.slotType === "compute");
  if (!computeCard) return 0;
  let t = computeCard.tier || 0;
  if (list.some(c => c.slotType === "model" && HEAVY_MODELS.includes(c.id))) t += 1;
  return t;
}
export function gpuComputeLabel(tier) {
  if (tier >= 3) return "High";
  if (tier >= 2) return "Medium";
  return "Low";
}

/* ---------- best-effort "optimal solution" suggestion for a problem ---------- */
export function optimalSuggestion(problem) {
  const modelNames = problem.bestFit.map(id => (MODELS.find(m => m.id === id) || {}).name).filter(Boolean).join(" or ");
  const lossId = problem.bestLoss || problem.validLoss[0];
  const lossName = (LOSSES.find(l => l.id === lossId) || {}).name || lossId;
  const computeNote = problem.minTier >= 2 ? "a Multi-GPU rig or Datacenter" : problem.minTier === 1 ? "at least a Single GPU" : "even a Laptop CPU can handle this one";
  return { modelNames, lossName, computeNote };
}

/* ═══════════════ SESSION DECK (shared across all 10 problems) ═══════════════
   ~70 cards, category counts weighted so every problem's best-fit model and
   best-fit loss are reliably reachable — losses should come from decisions,
   not bad shuffles. ---------- */
function modelDemand(id) {
  return PROBLEMS.filter(p => p.bestFit.includes(id)).length * 3 + PROBLEMS.filter(p => p.okFit && p.okFit.includes(id)).length;
}
function lossDemand(id) {
  return PROBLEMS.filter(p => p.bestLoss === id).length * 3 + PROBLEMS.filter(p => p.validLoss.includes(id)).length;
}
function buildCategory(rng, pool, total, baseMin, weightFn) {
  const counts = {}; pool.forEach(c => counts[c.id] = baseMin);
  let used = pool.length * baseMin;
  while (used < total) {
    const weights = pool.map(c => Math.max(1, weightFn ? weightFn(c.id) : 1));
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = rng() * sum, chosen = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { chosen = pool[i]; break; } }
    counts[chosen.id]++; used++;
  }
  const cards = [];
  pool.forEach(c => { for (let i = 0; i < counts[c.id]; i++) cards.push({ ...c }); });
  return cards;
}
export const DECK_PLAN = [
  ["model", MODELS, 16, 1, modelDemand],
  ["compute", COMPUTE, 12, 2, null],
  ["activation", ACTIVATIONS, 10, 2, null],
  ["loss", LOSSES, 16, 1, lossDemand],
  ["helper", HELPERS, 16, 1, null],
];
export function buildMainDeck(rng) {
  let all = [];
  DECK_PLAN.forEach(([type, pool, total, baseMin, wf]) => {
    buildCategory(rng, pool, total, baseMin, wf).forEach(c => all.push({ ...c, slotType: type }));
  });
  all = shuffle(rng, all);
  return all.map((c, i) => ({ ...c, uid: "card" + i }));
}

/* ---------- required slot keys for a given problem-attempt config ---------- */
export function requiredTypes(ps) {
  if (ps.slotConfig === "six") return ["model", "compute", "activation", "loss", "helper", "helper2"];
  if (ps.slotConfig === "four") return ["model", "compute", "activation", "loss"];
  return ["model", "compute", "activation", "loss", "helper"];
}
export function freshProblemState() {
  return { slotConfig: "five", revealed: false, secondAttemptArmed: false, overclockArmed: false, safetyNetArmed: false };
}

/* ═══════════════ BONUS CARDS (shop-purchased, max 2 held, one-time use) ═══════════════ */
export const BONUS_DEFS = [
  { id: "slot_plus", name: "+1 Slot", cost: 5, icon: "ensemble", tip: "Load a 2nd Helper card this problem (6 cards total)." },
  { id: "slot_minus", name: "−1 Slot", cost: 4, icon: "contrastive", tip: "Skip the Helper slot this problem (4 cards) — pays +6⚡ immediately." },
  { id: "extra_discard", name: "Extra Discard", cost: 5, icon: "dataaug", tip: "+1 to your session discard pool, permanently." },
  { id: "recycle", name: "Recycle", cost: 9, icon: "gpu_multi", tip: "Shuffle every used & discarded card back into the main deck." },
  { id: "peer_review", name: "Peer Review", cost: 4, icon: "aiscientist", tip: "Reveals this problem's ideal model family." },
  { id: "second_attempt", name: "Second Attempt", cost: 8, icon: "gradstudent", tip: "If your next Run on this problem fails, you don't lose — retry instead." },
  { id: "fresh_funding", name: "Fresh Funding", cost: 5, icon: "datacenter", tip: "Immediately draw 2 extra cards into your hand." },
  { id: "overclock", name: "Overclock", cost: 6, icon: "gpu1", tip: "Your next Run: one Compute card counts one tier higher." },
  { id: "safety_net", name: "Safety Net", cost: 7, icon: "dropout", tip: "Your next Run: an overfitting result is cancelled instead." },
  { id: "deck_insight", name: "Deck Insight", cost: 3, icon: "cnn1d", tip: "Peek at the top 3 cards of the main deck." },
  { id: "transfer", name: "Transfer Learning", cost: 5, icon: "transformer", tip: "Adds the Model card from your last solved problem straight to your hand." },
  { id: "gpu_boost", name: "GPU Lab Access", cost: 6, icon: "gpu1", tip: "Permanently move your training runs off the old lab CPU and onto a real GPU — snappier run animations for the rest of this attempt (no scoring change)." },
];
export function makeBonusShop(rng, n) {
  return { offers: shuffle(rng, BONUS_DEFS).slice(0, 3), n };
}
export function solveReward(problem, tries) {
  const base = { easy: 6, med: 8, hard: 10 }[difficultyTone(problem.difficulty)];
  return base + Math.max(0, 2 - tries) * 2;
}
export const STARTING_COMPUTE = 0;
export const HAND_MAX = 8;

/* ═══════════════ SCORING (the actual rules) ═══════════════
   `built` is now a free-form array of whatever cards the player dropped
   into the build zone (any count, any order) rather than a fixed
   type→card slot map. We pull out the first card of each relevant type,
   and branch the outcome when the loadout is "odd" — more than one
   Model card (conflicting gradients) or no Activation card at all
   (linear collapse). Run is only enabled once model/activation/loss
   are all present at least once, so the missing-activation branch is
   mostly defensive, but kept consistent with the multi-model one. */
export function computeOutcome(built, problem, rng, opts = {}) {
  const list = built || [];
  const models = list.filter(c => c.slotType === "model");
  const activations = list.filter(c => c.slotType === "activation");
  const lossCards = list.filter(c => c.slotType === "loss");
  const computes = list.filter(c => c.slotType === "compute");
  const helpers = list.filter(c => c.slotType === "helper");

  const model = models[0] || null;
  const activation = activations[0] || null;
  const loss = lossCards[0] || null;
  const compute = computes[0] || { tier: 0 };

  const multiModel = models.length > 1;
  const noActivation = activations.length === 0;

  let modelMatch = 0.25;
  if (model) {
    if (problem.bestFit.includes(model.id)) modelMatch = 1;
    else if (problem.okFit && problem.okFit.includes(model.id)) modelMatch = 0.6;
  }
  if (multiModel) modelMatch *= 0.5; // conflicting gradients between two model heads

  let lossMatch = 0.4;
  if (loss) {
    if (problem.bestLoss === loss.id) lossMatch = 1;
    else if (problem.validLoss.includes(loss.id)) lossMatch = 0.85;
  }

  const actFactor = noActivation ? 0.5 : ((activation.id === "relu" || activation.id === "gelu") ? 1 : 0.9);
  const fit = clamp(modelMatch * 0.55 + lossMatch * 0.30 + actFactor * 0.15, 0, 1);

  const effectiveTier = compute.tier + (opts.overclock ? 1 : 0);
  const gap = problem.minTier - effectiveTier;
  let oom = false;
  if (model && effectiveTier === 0 && HEAVY_MODELS.includes(model.id)) oom = true;
  else if (gap >= 2) oom = true;
  else if (gap === 1) oom = rng() < 0.65;

  const expectedTier = DATA_SCALE_TIER[problem.dataScale];
  const oversize = Math.max(0, effectiveTier - expectedTier);
  let overfitScore = oversize * 0.3 + (problem.overfitTrap ? 0.4 : 0);
  const applyMitigation = h => {
    if (!h) return;
    if (h.id === "dataaug") overfitScore -= 0.28;
    if (h.id === "dropout") overfitScore -= 0.28;
    if (h.id === "norm") overfitScore -= 0.12;
    if (h.id === "earlystop") overfitScore -= 0.55;
  };
  helpers.forEach(applyMitigation);
  overfitScore = Math.max(0, overfitScore);

  const noise = Math.round(rng() * 4 - 2);
  const bonusFor = h => !h ? 0 : (h.id === "ensemble" ? 3 : 0) + (h.id === "norm" ? 2 : 0);
  const helperBonus = helpers.reduce((s, h) => s + bonusFor(h), 0);
  const rawScore = clamp(Math.round(40 + 56 * fit + noise + helperBonus), 1, 99);

  let outcome, finalScore = null, safetyNetUsed = false;
  if (oom) {
    outcome = "oom";
  } else if (multiModel) {
    outcome = "conflict";
    finalScore = clamp(Math.round(rawScore * 0.4), 1, 99);
  } else if (noActivation) {
    outcome = "collapse";
    finalScore = clamp(Math.round(rawScore * 0.35), 1, 99);
  } else if (overfitScore > 0.3) {
    if (opts.safetyNet) { outcome = "converge"; finalScore = rawScore; safetyNetUsed = true; }
    else { outcome = "overfit"; finalScore = clamp(Math.round(rawScore * 0.5), 1, 99); }
  } else if (fit < 0.55) {
    outcome = "underfit"; finalScore = clamp(Math.round(rawScore * 0.55), 1, 99);
  } else {
    outcome = "converge"; finalScore = rawScore;
  }
  const solved = outcome === "converge" && finalScore >= problem.target;
  return { outcome, fit, finalScore, solved, safetyNetUsed, modelUsed: model };
}

/* ---------- the loss curve itself, sampled epoch by epoch ---------- */
export function makeCurve(outcome, fit, rng) {
  const N = 22, pts = [];
  const trainK = 0.22 + fit * 0.14, trainFloor = 0.05 + (1 - fit) * 0.05;
  const valK = 0.16 + fit * 0.10, valFloor = 0.10 + (1 - fit) * 0.22;
  let turnE = null, oomCut = null;
  if (outcome === "overfit") turnE = Math.round(N * (0.28 + rng() * 0.18));
  if (outcome === "oom") oomCut = Math.round(N * (0.35 + rng() * 0.35));

  for (let e = 0; e <= N; e++) {
    if (oomCut != null && e > oomCut) break;
    let train, val;
    if (outcome === "collapse") {
      // linear collapse — no activation, no real nonlinearity to learn with.
      train = 0.74 + rng() * 0.03;
      val = train + 0.01 + rng() * 0.015;
    } else if (outcome === "conflict") {
      // conflicting gradients from multiple model heads — unstable, oscillating.
      train = clamp(0.5 + Math.sin(e * 1.3) * 0.16 + (rng() - 0.5) * 0.06, 0.05, 0.98);
      val = clamp(0.55 + Math.sin(e * 1.1 + 1) * 0.19 + (rng() - 0.5) * 0.07, 0.05, 1.0);
    } else if (outcome === "underfit") {
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

export function outcomeLabel(o) { return { converge: "training complete", overfit: "overfitting detected", underfit: "underfitting", oom: "run crashed", conflict: "conflicting gradients", collapse: "linear collapse" }[o] || o; }
export function verdictText(run, problem, saved) {
  if (run.outcome === "oom") return "💥 CUDA out of memory. Your compute couldn't fit that architecture on this data." + (saved ? " Second Attempt saves you — go again." : "");
  if (run.outcome === "conflict") return `Two Model cards fought over the same weights — the gradients never agreed on a direction and training never stabilized. Validation ${problem.metricLabel}: ${run.finalScore} (needed ${problem.target}).` + (saved ? " Second Attempt saves you — go again." : "");
  if (run.outcome === "collapse") return `No Activation card — with nothing but linear layers stacked together, the whole network collapses to one big linear function and can't learn the real pattern. Validation ${problem.metricLabel}: ${run.finalScore} (needed ${problem.target}).` + (saved ? " Second Attempt saves you — go again." : "");
  if (run.outcome === "overfit") return `Train loss kept dropping, but validation loss climbed back up — the model memorized the training set instead of learning it. Validation ${problem.metricLabel}: ${run.finalScore} (needed ${problem.target}).` + (saved ? " Second Attempt saves you — go again." : "");
  if (run.outcome === "underfit") return `The loss plateaued high on both lines — wrong tool for this data. Validation ${problem.metricLabel}: ${run.finalScore} (needed ${problem.target}).` + (saved ? " Second Attempt saves you — go again." : "");
  if (run.solved) return `Converged. Validation ${problem.metricLabel} ${run.finalScore} clears the ${problem.target} target.`;
  return `Converged, but validation ${problem.metricLabel} ${run.finalScore} falls short of the ${problem.target} target.` + (saved ? " Second Attempt saves you — go again." : "");
}
export function tickerText(runAnim) {
  const { result, curve, step } = runAnim;
  const N = curve.N, epoch = Math.min(step, curve.pts.length - 1);
  if (result.outcome === "oom" && step >= curve.pts.length) return "💥 CUDA out of memory — run wasted.";
  if (result.outcome === "conflict") return `⚠ epoch ${epoch}/${N} — gradients diverging between model heads (conflicting Model cards)`;
  if (result.outcome === "collapse") return `epoch ${epoch}/${N} — network behaving linearly (no Activation card loaded)`;
  if (result.outcome === "overfit" && curve.turnE != null && epoch > curve.turnE) return `⚠ epoch ${epoch}/${N} — validation loss climbing (overfitting)`;
  return `training… epoch ${epoch}/${N}`;
}

/* ---------- leaderboard storage ----------
   The original spec calls for the artifact `window.storage` API, but this
   is a plain local app (not a Claude artifact) — that API doesn't exist
   here, so this uses localStorage instead, with the same "fall back to
   in-memory if unavailable" behavior. Records both full clears and failed
   runs so the board shows progress across attempts. */
const LB_KEY = "gd4_leaderboard_v1";
let memoryBoard = [];
export let storageOK = true;
try { localStorage.setItem("__gd4_test__", "1"); localStorage.removeItem("__gd4_test__"); } catch { storageOK = false; }
export function loadBoard() {
  if (!storageOK) return memoryBoard;
  try { return JSON.parse(localStorage.getItem(LB_KEY) || "[]"); } catch { return memoryBoard; }
}
function saveBoard(list) {
  if (!storageOK) { memoryBoard = list; return; }
  try { localStorage.setItem(LB_KEY, JSON.stringify(list)); } catch { memoryBoard = list; }
}
export function addBoardResult(entry) { const list = loadBoard(); list.push(entry); saveBoard(list); }
export function rankBoard(list) {
  return [...list].sort((a, b) => {
    const aAll = a.solvedCount === 10, bAll = b.solvedCount === 10;
    if (aAll !== bAll) return aAll ? -1 : 1;
    if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
    if (a.totalTimeMs !== b.totalTimeMs) return a.totalTimeMs - b.totalTimeMs;
    return a.totalTries - b.totalTries;
  });
}

/* ---------- tutorial ---------- */
export const TUTORIAL_V4 = [
  { t: "Welcome to the lab", b: "You're an AI lab. Draw cards, build a loadout, train a model, and beat the target — across 10 real open science problems, sharing ONE deck for the whole run." },
  { t: "One deck, one life", b: "Your deck doesn't reset between problems. Up to 8 cards stay in your hand at all times, dealt automatically. Fail to converge on ANY problem — or run out of cards — and the whole run ends." },
  { t: "Build your loadout", b: "Drag hand cards into the build zone below — drop as many as you want, in any order. You need at least one Model, one Activation and one Loss card loaded before you can Run. You get 3 discards for the ENTIRE run, not per-problem — spend them wisely." },
  { t: "Hit Run", b: "Watch the loss curve, and the training log build up beside it. Both lines sliding down and flattening low = it's learning. A dotted validation line climbing back up after dropping = overfitting. The cards you loaded are gone either way." },
  { t: "The Grant Committee", b: "Solve a problem and you'll earn ⚡ compute to spend at the shop on bonus cards — extra slots, extra discards, insurance against a bad run. You can hold at most 2 at once." },
  { t: "Good luck", b: "Read each problem's briefing before you draw — it won't name the answer, but it'll point you the right way. Solve all 10 to reach the state of the art." },
];
