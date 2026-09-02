# Gradient Descent

An educational roguelike card game about how machine learning actually works — build tiny neural network "recipes" out of cards and train them against 10 real open-science problems, from Higgs boson detection to protein folding.

You share one deck across the whole run: draw a hand, drag Model / Compute / Activation / Loss / Helper cards into your network, hit **Run**, and watch a live loss curve decide whether you solved the problem. Fail a Run and the whole attempt ends — permadeath, roguelike-style — so spend your compute wisely at the Grant Committee shop between problems.

## How to play

1. **Pick a nickname and a flavour** (also your run's seed — same flavour gives you the same deck and problem order) on the start screen, then hit **Start**.
2. **Read the briefing.** Each of the 10 problems is based on a real ML challenge (Higgs ML, exoplanet transit detection, AlphaFold-style protein folding, gravitational wave detection, and more) with a short "why this matters" blurb and a difficulty tag.
3. **Build your network.** Drag cards from your hand into the build zone, in any order (up to 7 cards). You need at least one **Model**, one **Activation**, and one **Loss** card before you can Run — hover the Run button to see the requirement, and hover the small **ⓘ** on any card for its stats, flavor, and how well it fits the current problem.
4. **Run it.** Hit **▶ Run** to train. The animation shows a training log on the left and the live loss curve on the right. No GPU-boost bonus yet? You're training on an old CPU — it'll just run slower, not score worse.
5. **Watch for overfitting.** Too many parameters for too little data, the wrong loss function, missing an activation, or stacking multiple Model cards all change how the curve behaves — sometimes in very real ways (vanishing gradients, unstable/conflicting training, flat collapse).
6. **Discard smartly.** Click a card in your hand to highlight it, then use the red **🗑 Discard selected** button — you only get a limited number of discards for the whole run.
7. **Spend compute (⚡)** at the Grant Committee shop after each solved problem on one-time bonus cards (extra discards, a GPU boost, Peer Review hints, Second Attempt insurance, and more).
8. **Clear all 10 problems** to reach State of the Art. Fail a Run and it's game over — check the Notebook (📓) for what you've unlocked, and the Userboard (🏆) for speedrun times, then try again.

Press **?** any time in-game to reopen the tutorial.

## Running it locally

Requires [Node.js](https://nodejs.org/) (v18+) and npm.

```bash
cd gradient-descent
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

### Build for production

```bash
npm run build      # outputs to dist/
npm run preview    # serve the production build locally
```

## Project structure

- [gradient-descent-v4.jsx](gradient-descent-v4.jsx) — the live game component (rendered by [src/main.jsx](src/main.jsx))
- [src/gd4-data.js](src/gd4-data.js) — game data: models, problems, bonuses, scoring/outcome logic
- [src/gd4-components.jsx](src/gd4-components.jsx) — shared UI pieces (cards, loss curve, modals, leaderboard)
- [src/icons2.js](src/icons2.js) — icon sprites
- `gradient-descent.jsx` / `gradient-descent-v3.jsx` — earlier prototype versions, kept for reference (not used by the live app)
