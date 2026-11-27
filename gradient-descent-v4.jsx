import React, { useState, useEffect, useRef } from "react";
import { Icon2 } from "./src/icons2.js";
import {
  hashStr, mulberry32, shuffle, fmtTime, FLAVORS, themeVars,
  MODELS, PROBLEMS, difficultyTone, difficultyBrief, buildMainDeck, freshProblemState,
  BONUS_DEFS, makeBonusShop, solveReward, STARTING_COMPUTE, HAND_MAX,
  computeOutcome, makeCurve, outcomeLabel, verdictText, tickerText,
  addBoardResult, TUTORIAL_V4, gpuComputeTier, gpuComputeLabel, optimalSuggestion,
} from "./src/gd4-data.js";
import {
  CardFace, LossCurve, Tutorial, LeaderboardPanel, FlavorCarousel,
  BriefingModal, NotebookModal, BonusCard, HudChip,
} from "./src/gd4-components.jsx";

/* ═══════════════════════════════════════════════════════════════
   GRADIENT DESCENT v4 — deck economy + roguelike run.
   One shared deck across all 10 problems, a hand of up to 8 cards,
   3 discards for the whole session, a shop of one-time bonus cards,
   and permadeath: fail a Run (or run out of cards) and the whole
   attempt ends, gets recorded, and you restart from problem 1.
   ═══════════════════════════════════════════════════════════════ */

const BUILD_MAX = 7;

function buildFreshRun(base) {
  const rng = mulberry32(hashStr(base.seedStr + "-deck-life" + base.runAttempt));
  const deck = buildMainDeck(rng);
  let gg = {
    ...base,
    problemIndex: 0, startedAt: Date.now(),
    totalTries: 0, triesUsedThisProblem: 0, results: [], notebookUnlocked: [], compute: STARTING_COMPUTE,
    deck, hand: [], usedPile: [], bonusDeck: [], lastSolvedLoadout: null,
    discardsUsed: 0, discardsMax: 3,
    built: [], gpuBoostArmed: false,
    buildRefills: {},
    problemState: freshProblemState(),
    runAnim: null, lastRun: null, sessionOver: null, pendingShop: false, insightPeek: null, dealSeq: 0,
  };
  gg = dealUpTo(gg);
  return gg;
}

function dealUpTo(gg, capOverride = null) {
  const cap = capOverride != null ? capOverride : HAND_MAX;
  let deck = [...gg.deck], hand = [...gg.hand];
  while (hand.length < cap && deck.length > 0) hand.push(deck.shift());
  const requiredTypes = ["model", "activation", "loss"];
  for (const requiredType of requiredTypes) {
    if (hand.some(card => card.slotType === requiredType)) continue;
    const candidateIndex = deck.findIndex(card => card.slotType === requiredType);
    if (candidateIndex < 0) continue;
    const [candidate] = deck.splice(candidateIndex, 1);
    const replaceIndex = hand.findIndex(card => {
      if (!requiredTypes.includes(card.slotType)) return true;
      return hand.filter(other => other.slotType === card.slotType).length > 1;
    });
    if (replaceIndex >= 0) {
      const [replaced] = hand.splice(replaceIndex, 1, candidate);
      deck.unshift(replaced);
    } else {
      hand.push(candidate);
      if (hand.length > cap) {
        const overflow = hand.pop();
        deck.unshift(overflow);
      }
    }
  }
  return { ...gg, deck, hand };
}

const REQUIRED_BUILD_TYPES = ["model", "activation", "loss"];
function checkMillOut(gg) {
  if (gg.sessionOver || gg.deck.length > 0) return gg;
  const missing = REQUIRED_BUILD_TYPES.some(t => !gg.hand.some(c => c.slotType === t) && !gg.built.some(c => c.slotType === t));
  if (!missing) return gg;
  return endSession(gg, "milled");
}

function recapEntry(gg, fullClear) {
  const finishedAt = Date.now();
  const solvedCount = gg.results.filter(r => r.solved).length;
  const best = gg.results.filter(r => r.solved).sort((a, b) => b.score - a.score)[0];
  return {
    nickname: gg.nickname, flavour: (FLAVORS.find(f => f.id === gg.flavorId) || {}).name || gg.flavorId,
    mode: gg.mode, solvedCount, totalTimeMs: finishedAt - gg.startedAt, totalTries: gg.totalTries,
    bestModel: best ? best.modelName : "—", fullClear, date: finishedAt,
  };
}
function endSession(gg, reason, extra) {
  const entry = recapEntry(gg, false);
  if (gg.mode === "speedrun") addBoardResult(entry);
  return { ...gg, sessionOver: { reason, entry, ...(extra || {}) } };
}
function endSessionWin(gg) {
  const entry = recapEntry(gg, true);
  if (gg.mode === "speedrun") addBoardResult(entry);
  return { ...gg, sessionOver: { reason: "won", entry } };
}

function applyBonusEffect(gg, def) {
  let g2 = { ...gg };
  const ps = { ...g2.problemState };
  switch (def.id) {
    case "slot_plus": ps.slotConfig = "six"; break;
    case "slot_minus": ps.slotConfig = "four"; g2.compute += 6; break;
    case "extra_discard": g2.discardsMax += 1; break;
    case "recycle": {
      const rng = mulberry32(hashStr(g2.seedStr + "-recycle-" + g2.dealSeq));
      g2.deck = shuffle(rng, [...g2.deck, ...g2.usedPile]);
      g2.usedPile = [];
      g2.dealSeq += 1;
      break;
    }
    case "peer_review": ps.revealed = true; break;
    case "second_attempt": ps.secondAttemptArmed = true; break;
    case "fresh_funding": g2 = dealUpTo(g2, g2.hand.length + 2); break;
    case "overclock": ps.overclockArmed = true; break;
    case "safety_net": ps.safetyNetArmed = true; break;
    case "deck_insight": g2.insightPeek = g2.deck.slice(0, 3); break;
    case "gpu_boost": g2.gpuBoostArmed = true; break;
    case "transfer": {
      if (g2.lastSolvedLoadout) {
        const modelCard = g2.lastSolvedLoadout.find(c => c.slotType === "model");
        if (modelCard) g2.hand = [...g2.hand, { ...modelCard, uid: modelCard.uid + "-xfer" + g2.dealSeq }];
      }
      break;
    }
  }
  g2.problemState = ps;
  g2 = dealUpTo(g2);
  return g2;
}

/* ═══════════════ MAIN COMPONENT ═══════════════ */
export default function GradientDescentV4() {
  const [screen, setScreen] = useState("start");
  const [nickname, setNickname] = useState("");
  const [mode, setMode] = useState("speedrun");
  const [flavorIdx, setFlavorIdx] = useState(0);
  const [g, setG] = useState(null);
  const [tut, setTut] = useState(null);
  const [seenTut, setSeenTut] = useState(false);
  const [modal, setModal] = useState(null); // 'notebook' | 'leaderboard' | 'briefing' | null
  const [shop, setShop] = useState(null);
  const [fast, setFast] = useState(false);
  const [now, setNow] = useState(0);
  const [discSel, setDiscSel] = useState(new Set());
  const [showOptimalEnd, setShowOptimalEnd] = useState(false);
  const [showOptimalOver, setShowOptimalOver] = useState(false);

  const gRef = useRef(null); gRef.current = g;
  const busyRef = useRef(false);
  const fastRef = useRef(false); fastRef.current = fast;
  const animRef = useRef(null);

  useEffect(() => () => clearInterval(animRef.current), []);
  useEffect(() => {
    if (screen !== "game" || !g || g.mode !== "speedrun" || g.sessionOver) return;
    setNow(Date.now());
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [screen, g && g.mode, g && g.sessionOver, g && g.problemIndex]);
  useEffect(() => {
    if (g && g.sessionOver && screen !== "over") { setScreen("over"); setModal(null); setShop(null); }
  }, [g && g.sessionOver, screen]);

  const flavor = g ? (FLAVORS.find(f => f.id === g.flavorId) || FLAVORS[0]) : FLAVORS[flavorIdx];

  /* ---------- game start / restart ---------- */
  function startGame() {
    const name = nickname.trim(); if (!name) return;
    const fl = FLAVORS[flavorIdx];
    const seedStr = fl.name.toUpperCase().replace(/[^A-Z]/g, "");
    const gg = buildFreshRun({ nickname: name, flavorId: fl.id, mode, seedStr, runAttempt: 1 });
    setG(gg); setModal(!seenTut ? null : "briefing"); setShop(null); setScreen("game");
    if (!seenTut) { setTut(0); setSeenTut(true); }
  }
  function restartRun() {
    const gg = gRef.current; if (!gg) return;
    const g2 = buildFreshRun({ nickname: gg.nickname, flavorId: gg.flavorId, mode: gg.mode, seedStr: gg.seedStr, runAttempt: (gg.runAttempt || 1) + 1 });
    setG(g2); setModal("briefing"); setShop(null); setScreen("game"); setShowOptimalOver(false); setDiscSel(new Set());
  }
  function backToMenu() { setG(null); setNickname(""); setModal(null); setShop(null); setScreen("start"); setShowOptimalOver(false); }

  /* ---------- hand / build zone ----------
     Build is now a free-form list of dropped cards (any count, any
     order) instead of fixed named slots. */
  function placeCardToBuild(uid) {
    setDiscSel(s => (s.has(uid) ? (() => { const n = new Set(s); n.delete(uid); return n; })() : s));
    setG(gg => {
      if (!gg || busyRef.current || gg.runAnim || gg.sessionOver) return gg;
      if (gg.built.length >= BUILD_MAX) return gg;
      const card = gg.hand.find(c => c.uid === uid); if (!card) return gg;
      const priorState = { hand: [...gg.hand], deck: [...gg.deck] };
      const handBeforeRefill = gg.hand.filter(c => c.uid !== uid);
      let g2 = { ...gg, hand: handBeforeRefill, built: [...gg.built, card] };
      g2 = dealUpTo(g2);
      g2.buildRefills = { ...(g2.buildRefills || {}), [card.uid]: priorState };
      g2 = checkMillOut(g2);
      return g2;
    });
  }
  function unplaceFromBuild(uid) {
    setG(gg => {
      if (!gg || busyRef.current || gg.runAnim) return gg;
      const card = gg.built.find(c => c.uid === uid); if (!card) return gg;
      const buildRefills = { ...(gg.buildRefills || {}) };
      const priorState = buildRefills[uid];
      delete buildRefills[uid];
      if (!priorState) {
        return { ...gg, built: gg.built.filter(c => c.uid !== uid), hand: [...gg.hand, card], buildRefills };
      }
      const remainingBuiltIds = new Set(
        gg.built.filter(c => c.uid !== uid).map(c => c.uid)
      );
      const restoredHand = priorState.hand.filter(c => !remainingBuiltIds.has(c.uid));
      return {
        ...gg,
        built: gg.built.filter(c => c.uid !== uid),
        hand: [...restoredHand],
        deck: [...priorState.deck],
        buildRefills,
      };
    });
  }
  function toggleDiscSel(uid) {
    setDiscSel(s => {
      const n = new Set(s);
      if (n.has(uid)) n.delete(uid); else n.add(uid);
      return n;
    });
  }
  function discardSelected() {
    setG(gg => {
      if (!gg || busyRef.current || gg.runAnim) return gg;
      const remaining = gg.discardsMax - gg.discardsUsed;
      if (remaining <= 0) return gg;
      const uids = gg.hand.filter(c => discSel.has(c.uid)).map(c => c.uid).slice(0, remaining);
      if (uids.length === 0) return gg;
      const uidSet = new Set(uids);
      const discardedCards = gg.hand.filter(c => uidSet.has(c.uid));
      let g2 = { ...gg, hand: gg.hand.filter(c => !uidSet.has(c.uid)), discardsUsed: gg.discardsUsed + uids.length, usedPile: [...gg.usedPile, ...discardedCards] };
      g2 = dealUpTo(g2);
      g2 = checkMillOut(g2);
      return g2;
    });
    setDiscSel(new Set());
  }
  function onDragStartHand(e, uid) { e.dataTransfer.setData("text/plain", "h:" + uid); e.dataTransfer.effectAllowed = "move"; }
  function onDragStartBuilt(e, uid) { e.dataTransfer.setData("text/plain", "b:" + uid); e.dataTransfer.effectAllowed = "move"; }
  function onDropBuildZone(e) { e.preventDefault(); const d = e.dataTransfer.getData("text/plain"); if (d.startsWith("h:")) placeCardToBuild(d.slice(2)); }
  function onDropHand(e) { e.preventDefault(); const d = e.dataTransfer.getData("text/plain"); if (d.startsWith("b:")) unplaceFromBuild(d.slice(2)); }

  /* ---------- bonuses ---------- */
  function playBonus(instanceUid) {
    setG(gg => {
      if (!gg || busyRef.current || gg.runAnim || gg.sessionOver) return gg;
      const inst = gg.bonusDeck.find(b => b.uid === instanceUid); if (!inst) return gg;
      const def = BONUS_DEFS.find(d => d.id === inst.defId); if (!def) return gg;
      if (def.id === "transfer" && !gg.lastSolvedLoadout) return gg;
      let g2 = applyBonusEffect(gg, def);
      g2.bonusDeck = g2.bonusDeck.filter(b => b.uid !== instanceUid);
      g2 = checkMillOut(g2);
      return g2;
    });
  }

  /* ---------- running the network ---------- */
  function runNetwork() {
    const gg = gRef.current;
    if (!gg || busyRef.current || gg.runAnim || gg.sessionOver) return;
    const types = gg.built.map(c => c.slotType);
    if (!(types.includes("model") && types.includes("activation") && types.includes("loss"))) return;
    busyRef.current = true;
    const problem = PROBLEMS[gg.problemIndex];
    const rng = mulberry32(hashStr(gg.seedStr + "-run-" + problem.id + "-" + gg.triesUsedThisProblem + "-" + gg.dealSeq + "-" + gg.runAttempt));
    const usedBuiltSnapshot = [...gg.built];
    const opts = { overclock: !!gg.problemState.overclockArmed, safetyNet: !!gg.problemState.safetyNetArmed };
    const result = computeOutcome(usedBuiltSnapshot, problem, rng, opts);
    const curve = makeCurve(result.outcome, result.fit, rng);
    const total = curve.pts.length;
    // no GPU-boost bonus active → run on the old lab CPU: slower animation
    // pacing only, never affects the scoring math above.
    const cpuMode = !gg.gpuBoostArmed;
    const baseDelay = cpuMode ? 260 : 130;
    const delay = fastRef.current ? Math.round(baseDelay / 2) : baseDelay;
    const initLog = [cpuMode ? "Running on CPU (no GPU bonus active)..." : "Running on GPU — accelerated training..."];
    setG(x => ({ ...x, runAnim: { result, curve, step: 0, log: initLog, cpuMode } }));
    const iv = setInterval(() => {
      setG(x => {
        if (!x || !x.runAnim) { clearInterval(iv); return x; }
        const step = x.runAnim.step + 1;
        const log = [...x.runAnim.log, tickerText({ result, curve, step })];
        if (step >= total) {
          clearInterval(iv);
          setTimeout(() => commitRun(result, curve, problem, usedBuiltSnapshot), fastRef.current ? 250 : 700);
          return { ...x, runAnim: { ...x.runAnim, step: total, log } };
        }
        return { ...x, runAnim: { ...x.runAnim, step, log } };
      });
    }, delay);
    animRef.current = iv;
  }

  function commitRun(result, curve, problem, usedBuilt) {
    busyRef.current = false;
    setG(gg => {
      if (!gg) return gg;
      let g2 = { ...gg, runAnim: null, totalTries: gg.totalTries + 1, triesUsedThisProblem: gg.triesUsedThisProblem + 1, dealSeq: gg.dealSeq + 1 };
      g2.usedPile = [...g2.usedPile, ...usedBuilt];
      g2.built = [];
      const ps = { ...g2.problemState };
      if (ps.overclockArmed) ps.overclockArmed = false;
      if (result.safetyNetUsed) ps.safetyNetArmed = false;
      g2.problemState = ps;

      const saved = !result.solved && ps.secondAttemptArmed;
      g2.lastRun = { ...result, curve, saved };
      const modelCard = result.modelUsed || usedBuilt.find(c => c.slotType === "model");

      if (result.solved) {
        if (!g2.notebookUnlocked.includes(problem.id)) g2.notebookUnlocked = [...g2.notebookUnlocked, problem.id];
        g2.results = [...g2.results, { problemId: problem.id, solved: true, tries: g2.triesUsedThisProblem, score: result.finalScore, modelId: modelCard ? modelCard.id : null, modelName: modelCard ? modelCard.name : "—" }];
        g2.lastSolvedLoadout = usedBuilt;
        g2.compute += solveReward(problem, g2.triesUsedThisProblem);
        g2 = dealUpTo(g2);
        g2 = checkMillOut(g2);
        if (g2.sessionOver) return g2;
        if (g2.problemIndex + 1 >= PROBLEMS.length) return endSessionWin(g2);
        g2.pendingShop = true;
        return g2;
      }
      if (saved) {
        ps.secondAttemptArmed = false; g2.problemState = { ...ps };
        g2 = dealUpTo(g2);
        g2 = checkMillOut(g2);
        return g2;
      }
      const tier = gpuComputeTier(usedBuilt);
      const gpuOverkill = gpuComputeLabel(tier) === "High" && difficultyTone(problem.difficulty) === "easy";
      return endSession(g2, "failed", gpuOverkill ? { gpuOverkill: true } : null);
    });
  }

  /* ---------- shop / next problem ---------- */
  function openShop() {
    const gg = gRef.current; if (!gg) return;
    const rng = mulberry32(hashStr(gg.seedStr + "-shop-" + gg.problemIndex + "-0"));
    setShop(makeBonusShop(rng, 0));
    setG(x => ({ ...x, lastRun: null, pendingShop: false }));
    setScreen("shop");
  }
  function buyBonus(offer) {
    setG(gg => {
      if (!gg || gg.compute < offer.cost || gg.bonusDeck.length >= 2) return gg;
      return { ...gg, compute: gg.compute - offer.cost, bonusDeck: [...gg.bonusDeck, { defId: offer.id, uid: "b" + gg.bonusDeck.length + "_" + gg.problemIndex + "_" + Math.floor(Math.random() * 1e6) }] };
    });
  }
  function rerollShop() {
    const gg = gRef.current; if (!gg || gg.compute < 2) return;
    setG(x => ({ ...x, compute: x.compute - 2 }));
    const n = (shop?.n || 0) + 1;
    const rng = mulberry32(hashStr(gg.seedStr + "-shop-" + gg.problemIndex + "-" + n));
    setShop(makeBonusShop(rng, n));
  }
  function advanceToNextProblem() {
    const gg = gRef.current; if (!gg) return;
    let g2 = { ...gg, problemIndex: gg.problemIndex + 1, lastRun: null, pendingShop: false, problemState: freshProblemState(), triesUsedThisProblem: 0, insightPeek: null };
    // re-check mill-out against the RESET (five-slot) requirement — a four/six-slot
    // config on the just-solved problem could have masked an approaching mill-out.
    g2 = checkMillOut(g2);
    setG(g2);
    setShop(null);
    if (!g2.sessionOver) { setModal("briefing"); setScreen("game"); }
    // if sessionOver just got set, the screen-sync effect takes it to 'over' instead.
  }

  /* ═══════════════ SCREENS ═══════════════ */
  if (screen === "start") {
    const fl = FLAVORS[flavorIdx];
    return (
      <div className="gd4-root gd4-center" style={themeVars(fl)}><style>{css()}</style>
        <div className="gd4-startCard">
          <div className="gd4-eyebrow">an educational roguelike about training real neural networks</div>
          <h1 className="gd4-title">GRADIENT<br />DESCENT</h1>
          <p className="gd4-sub">Run an AI lab across 10 real open-science problems, sharing one deck for the whole attempt. Fail a Run, or run out of cards, and it's over — restart from problem 1.</p>

          <div className="gd4-howToWin">
            <div className="gd4-fieldLabel" style={{ margin: "0 0 6px" }}>How to win</div>
            <ul>
              <li>One shared deck across all 10 problems — nothing resets between them.</li>
              <li>Fill your hand of cards into each problem's required slots, then hit ▶ Run.</li>
              <li>Beat the target metric to solve a problem and move on.</li>
              <li>Discards are limited for the whole run — spend them wisely.</li>
              <li>Fail a Run and it's permadeath — the whole attempt ends, restart from problem 1.</li>
              <li>Second Attempt and Safety Net bonus cards can save a bad Run — buy them at the Grant Committee.</li>
            </ul>
          </div>

          <label className="gd4-field">
            <span>Nickname</span>
            <input className="gd4-input" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="shown on the leaderboard" maxLength={20} />
          </label>

          <div className="gd4-modeRow">
            <button className={"gd4-modeBtn" + (mode === "speedrun" ? " on" : "")} onClick={() => setMode("speedrun")}>
              <b>Speedrun</b><span>timed &amp; ranked</span>
            </button>
            <button className={"gd4-modeBtn" + (mode === "learn" ? " on" : "")} onClick={() => setMode("learn")}>
              <b>Learn</b><span>no timer, no leaderboard entry</span>
            </button>
          </div>

          <div className="gd4-fieldLabel">Flavour <em>— also your seed: same flavour = same deck &amp; problem order</em></div>
          <FlavorCarousel idx={flavorIdx} setIdx={setFlavorIdx} />

          <div className="gd4-startActions">
            <button className="gd4-btn primary lg" disabled={!nickname.trim()} onClick={startGame}>Start →</button>
            <button className="gd4-btn lg" onClick={() => setTut(0)}>How to play</button>
            <button className="gd4-btn lg" onClick={() => setModal("leaderboard")}>🏆 Userboard</button>
          </div>
        </div>
        {tut !== null && <Tutorial step={tut} setStep={setTut} />}
        {modal === "leaderboard" && <LeaderboardPanel flavorId={fl.id} onClose={() => setModal(null)} />}
      </div>
    );
  }

  if (!g) return null;

  if (screen === "over") {
    const so = g.sessionOver || {};
    const won = so.reason === "won";
    const milled = so.reason === "milled";
    const failed = so.reason === "failed";
    const headline = won ? "STATE OF THE ART" : milled ? "DECK EXHAUSTED" : "RUN OVER";
    const failProblem = PROBLEMS[g.problemIndex];
    return (
      <div className="gd4-root gd4-center" style={themeVars(flavor)}><style>{css()}</style>
        <div className="gd4-startCard">
          <div className="gd4-eyebrow">{won ? "full clear" : milled ? "out of cards" : "training diverged"}</div>
          <h1 className="gd4-title" style={{ fontSize: 40 }}>{headline}</h1>
          <p className="gd4-sub">{g.nickname} · {flavor.name} · {g.mode === "speedrun" ? "Speedrun" : "Learn"} mode · life #{g.runAttempt}</p>
          {so.gpuOverkill && (
            <p className="gd4-gpuOverkill">🎓 Your professor is disheartened that you used so much GPU compute on such a simple problem.</p>
          )}
          {g.lastRun && !milled && !won && <LossCurve curve={g.lastRun.curve} step={g.lastRun.curve.pts.length} outcome={g.lastRun.outcome} />}
          {failed && failProblem && (
            <div style={{ margin: "10px 0" }}>
              <button className="gd4-btn sm" onClick={() => setShowOptimalOver(o => !o)}>{showOptimalOver ? "Hide" : "View"} optimal solution</button>
              {showOptimalOver && (() => {
                const opt = optimalSuggestion(failProblem);
                return (
                  <div className="gd4-optimalBox">
                    Ideal model family: <b>{opt.modelNames}</b> · ideal loss: <b>{opt.lossName}</b> · compute: <b>{opt.computeNote}</b>.
                  </div>
                );
              })()}
            </div>
          )}
          <div className="gd4-abstract">
            <div className="gd4-absRow"><span>Solved</span><b>{so.entry ? so.entry.solvedCount : g.results.filter(r => r.solved).length} / 10</b></div>
            {g.mode === "speedrun" && <div className="gd4-absRow"><span>Total time</span><b>{fmtTime((so.entry && so.entry.totalTimeMs) || 0)}</b></div>}
            <div className="gd4-absRow"><span>Total tries</span><b>{g.totalTries}</b></div>
            <div className="gd4-absRow"><span>Best model</span><b>{(so.entry && so.entry.bestModel) || "—"}</b></div>
            <div className="gd4-absRow"><span>Notebook pages</span><b>{g.notebookUnlocked.length} / 10</b></div>
          </div>
          <div className="gd4-startActions">
            <button className="gd4-btn primary lg" onClick={restartRun}>↻ Try again (life #{(g.runAttempt || 1) + 1})</button>
            <button className="gd4-btn lg" onClick={() => setModal("leaderboard")}>🏆 Userboard</button>
            <button className="gd4-btn lg" onClick={() => setModal("notebook")}>📓 Notebook</button>
            <button className="gd4-btn lg" onClick={backToMenu}>Change flavour / nickname</button>
          </div>
        </div>
        {modal === "leaderboard" && <LeaderboardPanel flavorId={g.flavorId} onClose={() => setModal(null)} />}
        {modal === "notebook" && <NotebookModal notebookUnlocked={g.notebookUnlocked} onClose={() => setModal(null)} />}
      </div>
    );
  }

  const problem = PROBLEMS[g.problemIndex];
  const helperRevealActive =
    g.problemState.revealed ||
    g.built.some(card => card.slotType === "helper" && card.id === "aiscientist");

  if (screen === "shop" && shop) {
    return (
      <div className="gd4-root" style={themeVars(flavor)}><style>{css()}</style>
        <div className="gd4-top">
          <div className="gd4-brand">GRADIENT DESCENT</div>
          <div className="gd4-topbtns">
            <HudChip tip="Compute (⚡) — earned by solving problems, spent in the Grant Committee shop on bonus cards.">⚡ {g.compute}</HudChip>
          </div>
        </div>
        <div className="gd4-shop">
          <div className="gd4-shopHead">
            <div><h2 className="gd4-h2" style={{ margin: 0 }}>THE GRANT COMMITTEE</h2><span className="gd4-tiny">spend ⚡ compute on one-time bonus cards · held: {g.bonusDeck.length}/2</span></div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="gd4-btn" onClick={rerollShop} disabled={g.compute < 2}>Reroll (2⚡)</button>
              <button className="gd4-btn primary" onClick={advanceToNextProblem}>Continue →</button>
            </div>
          </div>
          <div className="gd4-shopGrid">
            {shop.offers.map(o => (
              <div key={o.id} className="gd4-arxiv">
                <Icon2 id={o.icon} size={30} primary="var(--primary)" accent="var(--accent)" />
                <div className="gd4-arxTitle">{o.name}</div>
                <div className="gd4-arxFx">{o.tip}</div>
                <button className="gd4-mini buy" disabled={g.compute < o.cost || g.bonusDeck.length >= 2} onClick={() => buyBonus(o)}>Buy {o.cost}⚡</button>
              </div>
            ))}
          </div>
          {g.bonusDeck.length >= 2 && <p className="gd4-tiny" style={{ marginTop: 10 }}>Bonus deck full (2/2) — play one during a problem to free a slot.</p>}
        </div>
      </div>
    );
  }

  /* ---------- main game screen ---------- */
  const builtTypes = g.built.map(c => c.slotType);
  const canRun = builtTypes.includes("model") && builtTypes.includes("activation") && builtTypes.includes("loss");
  const elapsed = g.mode === "speedrun" ? (now || Date.now()) - g.startedAt : null;
  const showEndCard = !g.runAnim && g.lastRun && !g.sessionOver;

  return (
    <div className="gd4-root" style={themeVars(flavor)}><style>{css()}</style>
      <div className="gd4-top">
        <div className="gd4-brand">GRADIENT DESCENT</div>
        <div className="gd4-progressDots">
          {PROBLEMS.map((p, i) => {
            const r = g.results.find(x => x.problemId === p.id);
            const cls = i === g.problemIndex ? "cur" : r ? "solved" : (i < g.problemIndex ? "done" : "locked");
            return <span key={p.id} className={"gd4-pdot " + cls} title={p.title} />;
          })}
        </div>
        <div className="gd4-topbtns">
          {g.mode === "speedrun" && <HudChip tip="Elapsed time this speedrun attempt — recorded on the userboard.">⏱ {fmtTime(elapsed)}</HudChip>}
          <HudChip tip="Compute (⚡) — earned by solving problems, spent in the Grant Committee shop on bonus cards.">⚡ {g.compute}</HudChip>
          <HudChip tip="Discards left for the whole run — swap unwanted hand cards for fresh ones from the deck.">discards {g.discardsMax - g.discardsUsed}/{g.discardsMax}</HudChip>
          <HudChip tip={`Main deck: ${g.deck.length} cards left to draw, ${g.usedPile.length} used so far this attempt.`}>🂠 {g.deck.length}/{g.usedPile.length}</HudChip>
          {(() => {
            const tier = gpuComputeTier(g.built);
            const label = gpuComputeLabel(tier);
            return <HudChip tip="Estimated GPU compute load of your current build — Low/Medium/High." className={"gpu-" + label.toLowerCase()}>GPU {label}</HudChip>;
          })()}
          <button className="gd4-tbtn" onClick={() => setModal("briefing")}>📖 Briefing</button>
          <button className="gd4-tbtn" onClick={() => setModal("notebook")}>📓 {g.notebookUnlocked.length}/10</button>
          <button className="gd4-tbtn" onClick={() => setModal("leaderboard")}>🏆</button>
          <button className="gd4-tbtn" onClick={() => setTut(0)}>?</button>
          <button className={"gd4-tbtn" + (fast ? " on" : "")} onClick={() => setFast(f => !f)}>Fast{fast ? " ✓" : ""}</button>
        </div>
      </div>

      <div className="gd4-gameBody">
        <div className="gd4-main">
          <div className="gd4-infoBox">
            <div className="gd4-infoHead">
              <Icon2 id={problem.icon} size={36} primary="var(--primary)" accent="var(--accent)" />
              <div>
                <div className="gd4-infoTitleRow">
                  <b>{g.problemIndex + 1}. {problem.title}</b>
                  <span className={"gd4-diff " + difficultyTone(problem.difficulty)}>{problem.difficulty}</span>
                </div>
                <div className="gd4-tiny">{problem.field} · {problem.dataType} · target {problem.target} {problem.metricLabel}</div>
                <div className="gd4-diffBrief">{difficultyBrief(problem.difficulty)}</div>
              </div>
              <button className="gd4-btn sm" style={{ marginLeft: "auto" }} onClick={() => setModal("briefing")}>Full briefing</button>
            </div>
            {problem.why && <p className="gd4-why">{problem.why}</p>}
            {helperRevealActive && (
              <p className="gd4-reveal">🔭 {g.problemState.revealed ? "Peer Review" : "AI Scientist"}: the ideal model family here is <b>{problem.bestFit.map(id => MODELS.find(m => m.id === id).name).join(" or ")}</b>.</p>
            )}
            {g.problemState.slotConfig === "four" && <p className="gd4-tiny">Helper slot skipped this problem (−1 Slot bonus).</p>}
            {g.problemState.slotConfig === "six" && <p className="gd4-tiny">A 2nd Helper slot is active this problem (+1 Slot bonus).</p>}
          </div>

          {g.bonusDeck.length > 0 && !g.runAnim && !showEndCard && (
            <div className="gd4-bonusRow">
              <span className="gd4-tiny" style={{ marginRight: 4 }}>BONUSES:</span>
              {g.bonusDeck.map(inst => <BonusCard key={inst.uid} inst={inst} onPlay={playBonus} disabled={busyRef.current} />)}
            </div>
          )}

          {g.insightPeek && (
            <div className="gd4-infoBox">
              <div className="gd4-infoTitleRow"><b>🔎 Deck Insight — top of deck</b><button className="gd4-btn sm" style={{ marginLeft: "auto" }} onClick={() => setG(x => ({ ...x, insightPeek: null }))}>Close</button></div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {g.insightPeek.map((c, i) => <CardFace key={i} card={c} type={c.slotType} size="sm" problem={problem} />)}
              </div>
            </div>
          )}

          {!g.runAnim && !showEndCard && (
            <>
              <div className="gd4-buildZone" onDragOver={e => e.preventDefault()} onDrop={onDropBuildZone}>
                <div className="gd4-netHead"><span>YOUR NETWORK <em className="gd4-tiny">drag cards here, any order (max {BUILD_MAX} cards)</em></span></div>
                <div className="gd4-buildRow">
                  {g.built.length === 0 && <div className="gd4-buildEmpty">drop cards here to build your network</div>}
                  {g.built.map(c => (
                    <CardFace key={c.uid} card={c} type={c.slotType} size="md" problem={problem}
                      onClick={() => unplaceFromBuild(c.uid)}
                      draggable onDragStart={e => onDragStartBuilt(e, c.uid)} />
                  ))}
                </div>
              </div>

              <div className="gd4-actionsRow">
                <span className="gd4-runTipWrap">
                  <button className="gd4-btn primary lg" disabled={!canRun} onClick={runNetwork}>▶ Run</button>
                  <span className="gd4-runTip">To run: at least one Model, one Activation and one Loss card</span>
                </span>
                <button className="gd4-btn lg danger" disabled={discSel.size === 0 || g.discardsUsed >= g.discardsMax} onClick={discardSelected}>
                  🗑 Discard selected {discSel.size > 0 ? `(${Math.min(discSel.size, g.discardsMax - g.discardsUsed)})` : ""}
                </button>
              </div>

              <div className="gd4-handWrap" onDragOver={e => e.preventDefault()} onDrop={onDropHand}>
                <div className="gd4-netHead"><span>YOUR HAND <em className="gd4-tiny">drag into your network below · click a card to select it, then discard</em></span></div>
                <div className="gd4-hand">
                  {g.hand.map(c => (
                    <div key={c.uid} className="gd4-handCard">
                      <CardFace card={c} type={c.slotType} size="sm" problem={problem} selected={discSel.has(c.uid)}
                        draggable onDragStart={e => onDragStartHand(e, c.uid)}
                        onClick={() => g.discardsUsed < g.discardsMax && toggleDiscSel(c.uid)} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {g.runAnim && (
            <div className="gd4-runLayout">
              <div className="gd4-runLog">
                <div className="gd4-tiny" style={{ marginBottom: 6 }}>TRAINING LOG</div>
                {g.runAnim.log.map((line, i) => <div key={i} className="gd4-runLogLine">{line}</div>)}
              </div>
              <div className="gd4-runPlot">
                <LossCurve curve={g.runAnim.curve} step={g.runAnim.step} outcome={g.runAnim.result.outcome} />
              </div>
            </div>
          )}
        </div>
      </div>

      {showEndCard && (
        <div className="gd4-overlay">
          <div className="gd4-modal">
            <div className="gd4-eyebrow">{outcomeLabel(g.lastRun.outcome)}</div>
            <h2 className="gd4-h2">{g.lastRun.solved ? "Target beaten ✓" : (g.lastRun.saved ? "Saved by Second Attempt" : (g.lastRun.outcome === "oom" ? "Run wasted" : "Target missed"))}</h2>
            <LossCurve curve={g.lastRun.curve} step={g.lastRun.curve.pts.length} outcome={g.lastRun.outcome} />
            <p className="gd4-body">{verdictText(g.lastRun, problem, g.lastRun.saved)}</p>
            <div style={{ margin: "4px 0 10px" }}>
              <button className="gd4-btn sm" onClick={() => setShowOptimalEnd(o => !o)}>{showOptimalEnd ? "Hide" : "View"} optimal solution</button>
              {showOptimalEnd && (() => {
                const opt = optimalSuggestion(problem);
                return (
                  <div className="gd4-optimalBox">
                    Ideal model family: <b>{opt.modelNames}</b> · ideal loss: <b>{opt.lossName}</b> · compute: <b>{opt.computeNote}</b>.
                  </div>
                );
              })()}
            </div>
            <div className="gd4-modalFoot">
              {g.lastRun.solved ? (
                <button className="gd4-btn primary lg" onClick={openShop}>Continue to Grant Committee →</button>
              ) : (
                <button className="gd4-btn primary lg" onClick={() => { setG(x => ({ ...x, lastRun: null })); setShowOptimalEnd(false); }}>Try again →</button>
              )}
            </div>
          </div>
        </div>
      )}

      {tut !== null && <Tutorial step={tut} setStep={setTut} />}
      {modal === "notebook" && <NotebookModal notebookUnlocked={g.notebookUnlocked} onClose={() => setModal(null)} />}
      {modal === "leaderboard" && <LeaderboardPanel flavorId={g.flavorId} onClose={() => setModal(null)} />}
      {modal === "briefing" && <BriefingModal problem={problem} revealed={helperRevealActive} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ---------- styles ---------- */
function css() {
  return `
  .gd4-root{min-height:100vh;background:var(--bg);color:var(--text);font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:13px;
    --surface:color-mix(in srgb, var(--bg) 90%, var(--text) 10%);
    --muted:color-mix(in srgb, var(--text) 55%, var(--bg) 45%);
    --border:color-mix(in srgb, var(--text) 22%, transparent);
    --shadow:color-mix(in srgb, var(--text) 18%, transparent);
    background-image:linear-gradient(color-mix(in srgb, var(--text) 4%, transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb, var(--text) 4%, transparent) 1px,transparent 1px);background-size:22px 22px;}
  .gd4-root *{box-sizing:border-box}
  .gd4-root button{font-family:inherit;cursor:pointer;color:inherit}
  .gd4-root button:disabled{cursor:default;opacity:.4}
  .gd4-root input{font-family:inherit}
  .gd4-center{display:flex;align-items:center;justify-content:center;padding:24px}
  .gd4-eyebrow{letter-spacing:.14em;text-transform:uppercase;font-size:10px;color:var(--muted)}
  .gd4-tiny{font-size:10px;color:var(--muted)}
  .gd4-dim{color:var(--muted);font-size:11px}
  .gd4-body{line-height:1.6;font-size:12.5px}
  .gd4-h2{font-family:Georgia,serif;margin:6px 0}

  .gd4-startCard{max-width:640px;width:100%;text-align:center;background:var(--surface);border:1.5px solid var(--border);border-radius:14px;box-shadow:5px 5px 0 var(--shadow);padding:34px 30px}
  .gd4-title{font-family:Georgia,serif;font-size:50px;line-height:.95;margin:10px 0 12px;color:var(--primary)}
  .gd4-sub{color:var(--muted);max-width:520px;margin:0 auto 18px;line-height:1.6}
  .gd4-field{display:flex;flex-direction:column;gap:5px;text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:0 auto 14px;max-width:320px}
  .gd4-input{border:1.5px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text);padding:9px 11px;font-family:inherit;font-size:14px;text-transform:none;letter-spacing:0}
  .gd4-modeRow{display:flex;gap:10px;max-width:420px;margin:0 auto 18px}
  .gd4-modeBtn{flex:1;text-align:left;border:1.5px solid var(--border);border-radius:9px;background:var(--bg);padding:10px 12px;display:flex;flex-direction:column;gap:3px}
  .gd4-modeBtn b{font-size:12.5px}
  .gd4-modeBtn span{font-size:10px;color:var(--muted)}
  .gd4-modeBtn.on{border-color:var(--primary);box-shadow:0 0 0 2px color-mix(in srgb, var(--primary) 30%, transparent)}
  .gd4-fieldLabel{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:4px 0 8px}
  .gd4-fieldLabel em{font-style:normal;text-transform:none;letter-spacing:0;opacity:.8}
  .gd4-startActions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px}

  .gd4-howToWin{text-align:left;background:var(--bg);border:1.5px solid var(--border);border-radius:9px;padding:12px 16px;margin:0 auto 18px;max-width:520px}
  .gd4-howToWin ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px}
  .gd4-howToWin li{color:var(--muted);font-size:12px;line-height:1.5}

  .gd4-btn{border:1.5px solid var(--border);background:var(--bg);color:var(--text);border-radius:8px;padding:9px 15px;font-size:12.5px;box-shadow:2px 2px 0 var(--shadow)}
  .gd4-btn.sm{padding:5px 10px;font-size:11px;box-shadow:none}
  .gd4-btn.lg{padding:11px 18px;font-size:13px}
  .gd4-btn.primary{background:var(--primary);border-color:var(--primary);color:var(--bg)}
  .gd4-btn.on{background:var(--primary);border-color:var(--primary);color:var(--bg)}

  .gd4-carouselWrap{display:flex;align-items:center;gap:8px;justify-content:center;margin-bottom:6px}
  .gd4-carArrow{border:1.5px solid var(--border);background:var(--bg);border-radius:50%;width:32px;height:32px;font-size:16px;line-height:1;flex:none}
  .gd4-carViewport{width:400px;max-width:60vw;overflow:hidden;touch-action:pan-y}
  .gd4-carTrack{display:flex;gap:18px;padding:4px 0}
  .gd4-flavCard{flex:none;width:150px;border:1.5px solid color-mix(in srgb, var(--text) 15%, transparent);border-radius:12px;background:var(--bg);color:var(--text);padding:12px;text-align:left;opacity:.55;transform:scale(.94);transition:opacity .25s,transform .25s}
  .gd4-flavCard.active{opacity:1;transform:scale(1);border-color:var(--primary);box-shadow:0 0 0 2px color-mix(in srgb, var(--primary) 35%, transparent)}
  .gd4-flavSwatchRow{display:flex;gap:5px;margin-bottom:8px}
  .gd4-swatch{width:16px;height:16px;border-radius:50%;display:inline-block;border:1px solid rgba(0,0,0,.15)}
  .gd4-flavName{font-weight:700;font-size:12.5px}
  .gd4-flavMood{font-size:10px;opacity:.7}
  .gd4-dots{display:flex;gap:5px;justify-content:center;margin-top:8px}
  .gd4-dot{width:6px;height:6px;border-radius:50%;border:none;background:var(--border);padding:0}
  .gd4-dot.on{background:var(--primary)}

  .gd4-top{display:flex;align-items:center;gap:14px;padding:9px 16px;border-bottom:1.5px solid var(--border);background:var(--surface);flex-wrap:wrap}
  .gd4-brand{font-family:Georgia,serif;font-weight:700;color:var(--primary)}
  .gd4-progressDots{display:flex;gap:5px;flex:1;min-width:140px}
  .gd4-pdot{width:9px;height:9px;border-radius:50%;background:var(--border);display:inline-block}
  .gd4-pdot.cur{background:var(--primary);box-shadow:0 0 0 3px color-mix(in srgb, var(--primary) 30%, transparent)}
  .gd4-pdot.solved,.gd4-pdot.done{background:var(--accent)}
  .gd4-topbtns{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .gd4-chip{border:1.5px solid var(--border);border-radius:22px;background:var(--bg);padding:7px 16px;font-weight:700;font-size:14px}
  .gd4-tbtn{border:1.5px solid var(--border);border-radius:7px;background:var(--bg);padding:8px 14px;font-size:13px}
  .gd4-tbtn.on{background:var(--primary);color:var(--bg)}

  .gd4-gameBody{display:flex;gap:16px;max-width:1100px;margin:0 auto;padding:14px 14px 40px;align-items:flex-start}
  .gd4-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:12px}
  .gd4-chip.gpu-low{color:var(--accent)}
  .gd4-chip.gpu-medium{color:#d97706}
  .gd4-chip.gpu-high{color:#ef4444}
  @media(max-width:760px){.gd4-gameBody{flex-direction:column}}

  .gd4-infoBox{background:var(--surface);border:1.5px solid var(--border);border-radius:10px;box-shadow:3px 3px 0 var(--shadow);padding:14px 16px}
  .gd4-infoHead{display:flex;gap:12px;align-items:flex-start;margin-bottom:6px}
  .gd4-infoTitleRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .gd4-diff{font-size:9px;letter-spacing:.08em;text-transform:uppercase;border-radius:10px;padding:2px 8px;font-weight:700}
  .gd4-diff.easy{background:#dcfce7;color:#166534}
  .gd4-diff.med{background:#fef3c7;color:#92400e}
  .gd4-diff.hard{background:#fee2e2;color:#991b1b}
  .gd4-reveal{font-size:11.5px;color:var(--primary);margin:6px 0 0}
  .gd4-why{font-size:11.5px;line-height:1.6;color:var(--muted);margin:8px 0 0;border-top:1px dashed var(--border);padding-top:8px}
  .gd4-diffBrief{font-size:11px;color:var(--muted);margin-top:3px;font-style:italic}
  .gd4-targetRow{margin-top:8px;font-size:11.5px;color:var(--muted);border-top:1px dashed var(--border);padding-top:8px}
  .gd4-gpuOverkill{background:color-mix(in srgb, #ef4444 15%, var(--bg));border:1.5px solid #ef4444;color:#ef4444;border-radius:8px;padding:9px 12px;font-size:12px;max-width:460px;margin:0 auto 12px}
  .gd4-optimalBox{margin-top:8px;font-size:12px;line-height:1.6;background:var(--bg);border:1px dashed var(--border);border-radius:8px;padding:8px 12px}

  .gd4-briefHead{display:flex;gap:12px;align-items:center;margin:8px 0 12px}
  .gd4-briefGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px 20px;text-align:left}
  @media(max-width:640px){.gd4-briefGrid{grid-template-columns:1fr}}
  .gd4-briefGrid b{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--primary)}
  .gd4-briefGrid p{margin:3px 0 0;font-size:12px;line-height:1.55}

  .gd4-bonusRow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:var(--surface);border:1.5px dashed var(--border);border-radius:10px;padding:8px 10px}
  .gd4-bonusCard{display:flex;flex-direction:column;align-items:center;gap:3px;border:1.5px solid color-mix(in srgb, var(--accent) 55%, var(--border));border-radius:8px;background:var(--bg);padding:6px 8px;min-width:78px}
  .gd4-bonusName{font-size:9.5px;font-weight:700;text-align:center}

  .gd4-buildZone{background:var(--surface);border:1.5px dashed var(--primary);border-radius:10px;box-shadow:3px 3px 0 var(--shadow);padding:12px}
  .gd4-buildRow{display:flex;flex-wrap:wrap;gap:10px;min-height:128px}
  .gd4-buildEmpty{flex:1;display:flex;align-items:center;justify-content:center;min-height:128px;color:var(--muted);font-size:12px;border:1.5px dashed var(--border);border-radius:10px}
  .gd4-slot,.gd4-cardFace{border:2px solid var(--border);border-radius:12px;background:var(--bg);padding:14px 8px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:5px;min-height:128px;justify-content:center;cursor:pointer;position:relative}
  .gd4-cardFace{border-color:var(--primary);box-shadow:2px 2px 0 var(--shadow)}
  .gd4-cardFace.sm,.gd4-slot.sm{min-height:112px;padding:10px 6px}
  .gd4-cardFace.selected{border-color:#ef4444;box-shadow:2px 2px 0 #ef4444;background:color-mix(in srgb, #ef4444 10%, var(--bg))}
  .gd4-cardInfo{position:absolute;top:-8px;right:-8px;z-index:2;width:19px;height:19px;border-radius:50%;border:1.5px solid var(--primary);background:var(--bg);color:var(--primary);font:italic 700 11px Georgia,serif;line-height:1;padding:0;display:flex;align-items:center;justify-content:center;cursor:help}
  .gd4-cardIconWrap{height:48px;display:flex;align-items:center}
  .gd4-cardName{font-size:12px;font-weight:700}
  .gd4-cardType{font-size:9.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
  .gd4-slotType{font-size:9.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}

  .gd4-cardTip{position:fixed;z-index:60;max-width:230px;background:var(--surface);color:var(--text);border:1.5px solid var(--primary);border-radius:9px;box-shadow:4px 4px 0 var(--shadow);padding:9px 11px;font-size:11px;line-height:1.5;text-align:left;pointer-events:none}
  .gd4-cardTipName{font-weight:700;margin-bottom:3px}
  .gd4-cardTipStat{color:var(--muted);margin-bottom:4px}
  .gd4-cardTipSlot{margin-bottom:4px}
  .gd4-cardTipFlavor{color:var(--accent);margin-bottom:4px}
  .gd4-cardTipEff{font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em}
  .gd4-cardTipEff.good{color:#16a34a}
  .gd4-cardTipEff.ok{color:#d97706}
  .gd4-cardTipEff.meh{color:var(--muted)}

  .gd4-actionsRow{display:flex;gap:10px;flex-wrap:wrap}
  .gd4-btn.danger{border-color:#ef4444;color:#ef4444}
  .gd4-btn.danger:disabled{opacity:.35}

  .gd4-handWrap{background:var(--surface);border:1.5px solid var(--border);border-radius:10px;box-shadow:3px 3px 0 var(--shadow);padding:12px}
  .gd4-netHead{font-size:11px;letter-spacing:.06em;color:var(--muted);margin-bottom:8px}
  .gd4-hand{display:flex;gap:10px;flex-wrap:wrap}
  .gd4-handCard{position:relative;animation:gd4deal .35s ease}
  @keyframes gd4deal{from{transform:translateY(14px) scale(.9);opacity:0}to{transform:none;opacity:1}}
  @media(prefers-reduced-motion:reduce){.gd4-handCard{animation:none}}
  .gd4-runTipWrap{position:relative;display:inline-block}
  .gd4-runTip{position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);white-space:nowrap;background:var(--surface);color:var(--text);border:1.5px solid var(--primary);border-radius:8px;box-shadow:3px 3px 0 var(--shadow);padding:7px 10px;font-size:11px;opacity:0;pointer-events:none;transition:opacity .12s;z-index:20}
  .gd4-runTipWrap:hover .gd4-runTip{opacity:1}

  .gd4-runBox{background:var(--surface);border:1.5px solid var(--border);border-radius:10px;box-shadow:3px 3px 0 var(--shadow);padding:14px;position:relative;overflow:hidden}
  .gd4-runBox::after{content:'';position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,color-mix(in srgb, var(--text) 3%, transparent) 0 1px,transparent 1px 3px)}
  .gd4-runLayout{display:grid;grid-template-columns:1fr 1.3fr;gap:14px;align-items:stretch}
  @media(max-width:760px){.gd4-runLayout{grid-template-columns:1fr}}
  .gd4-runLog{background:var(--surface);border:1.5px solid var(--border);border-radius:10px;box-shadow:3px 3px 0 var(--shadow);padding:12px;max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:5px}
  .gd4-runLogLine{font-size:11.5px;color:var(--muted);border-bottom:1px dashed var(--border);padding-bottom:5px;animation:gd4deal .25s ease}
  .gd4-runLogLine:last-child{color:var(--text);font-weight:600}
  .gd4-runPlot{background:var(--surface);border:1.5px solid var(--border);border-radius:10px;box-shadow:3px 3px 0 var(--shadow);padding:14px;position:relative;overflow:hidden}
  .gd4-runPlot::after{content:'';position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,color-mix(in srgb, var(--text) 3%, transparent) 0 1px,transparent 1px 3px)}
  .gd4-curveBox.glitch{animation:gd4shake .12s linear infinite}
  @keyframes gd4shake{0%{transform:translate(0,0)}25%{transform:translate(-2px,1px)}50%{transform:translate(2px,-1px)}75%{transform:translate(-1px,2px)}100%{transform:translate(0,0)}}
  .gd4-curveSvg{width:100%;height:200px;display:block}
  .gd4-gridline{stroke:var(--border);stroke-width:1}
  .gd4-trainLine{stroke:var(--primary);stroke-width:2.5}
  .gd4-valLine{stroke:var(--accent);stroke-width:2;stroke-dasharray:5 4}
  .gd4-glitchText{fill:#ef4444;font:700 13px ui-monospace,monospace}
  .gd4-curveLegend{display:flex;gap:14px;font-size:10px;color:var(--muted);margin-top:4px}
  .gd4-legTrain{color:var(--primary)}
  .gd4-legVal{color:var(--accent)}
  .gd4-runTicker{margin-top:8px;font-size:12px;color:var(--muted);border-top:1px dashed var(--border);padding-top:8px}

  .gd4-overlay{position:fixed;inset:0;background:color-mix(in srgb, var(--text) 45%, transparent);display:flex;align-items:center;justify-content:center;padding:16px;z-index:40}
  .gd4-modal{background:var(--surface);color:var(--text);border:2px solid var(--border);border-radius:12px;box-shadow:6px 6px 0 var(--shadow);padding:20px 24px;max-width:620px;width:100%;max-height:88vh;overflow:auto}
  .gd4-modal.narrow{max-width:480px}
  .gd4-modal.wide{max-width:820px}
  .gd4-modalFoot{display:flex;gap:8px;justify-content:space-between;margin-top:14px;flex-wrap:wrap}

  .gd4-abstract{border:1px solid var(--border);background:var(--bg);text-align:left;border-radius:8px;padding:12px 14px;margin:14px auto;max-width:400px}
  .gd4-absRow{display:flex;justify-content:space-between;padding:4px 0;font-size:12.5px}

  .gd4-lbFilters{display:flex;gap:8px;margin:8px 0 12px}
  .gd4-lbTableWrap{overflow-x:auto}
  .gd4-lbTable{width:100%;border-collapse:collapse;font-size:12px}
  .gd4-lbTable th{text-align:left;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--border);padding:5px 8px}
  .gd4-lbTable td{padding:6px 8px;border-bottom:1px dashed var(--border)}
  .gd4-lbTable tr.gold td{color:var(--primary);font-weight:700}

  .gd4-nbGrid{display:grid;grid-template-columns:220px 1fr;gap:14px;margin:12px 0}
  @media(max-width:640px){.gd4-nbGrid{grid-template-columns:1fr}}
  .gd4-nbList{display:flex;flex-direction:column;gap:4px;max-height:340px;overflow:auto}
  .gd4-nbItem{text-align:left;border:1px solid var(--border);border-radius:5px;background:var(--bg);padding:7px 9px;font-size:11px}
  .gd4-nbItem.on{border-color:var(--primary);font-weight:700}
  .gd4-nbItem:disabled{color:var(--muted)}
  .gd4-nbBody h3{font-family:Georgia,serif;margin:0 0 8px}
  .gd4-nbBody p{line-height:1.6;font-size:12px;margin:0 0 8px}

  .gd4-shop{max-width:1000px;margin:0 auto;padding:14px}
  .gd4-shopHead{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
  .gd4-shopGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
  .gd4-arxiv{border:1.5px solid color-mix(in srgb, var(--accent) 45%, var(--border));background:var(--surface);border-radius:8px;padding:12px;text-align:center;box-shadow:2px 2px 0 var(--shadow)}
  .gd4-arxTitle{font-family:Georgia,serif;font-weight:700;font-size:14px;margin:6px 0 4px}
  .gd4-arxFx{font-size:11px;line-height:1.5;color:var(--muted);min-height:44px}
  .gd4-mini{border:1.5px solid var(--border);background:var(--bg);color:var(--text);border-radius:5px;font-size:10px;padding:5px 10px;margin-top:8px}
  .gd4-mini.buy{background:var(--primary);border-color:var(--primary);color:var(--bg)}
  .gd4-mini:disabled{opacity:.4}
  `;
}
