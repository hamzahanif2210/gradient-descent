import React, { useState, useRef } from "react";
import { Icon2 } from "./icons2.js";
import {
  FLAVORS, SLOT_LABEL, MODELS, PROBLEMS, BONUS_DEFS, difficultyTone,
  fmtTime, rankBoard, loadBoard, storageOK, clamp, TUTORIAL_V4,
} from "./gd4-data.js";

/* ═══════════════ small shared pieces, reused by the main v4 component ═══════════════ */

export function CardFace({ card, type, size = "md", onClick, draggable, onDragStart, title }) {
  if (!card) {
    return (
      <div className={"gd4-slot empty " + size}>
        <Icon2 id="frame_common" size={size === "lg" ? 40 : 30} primary="var(--muted)" accent="var(--muted)" />
        <div className="gd4-slotType">{SLOT_LABEL[type]}</div>
      </div>
    );
  }
  return (
    <div className={"gd4-cardFace " + size} title={title || card.tip} onClick={onClick} draggable={draggable} onDragStart={onDragStart}>
      <div className="gd4-cardIconWrap"><Icon2 id={card.icon} size={size === "lg" ? 40 : 30} primary="var(--primary)" accent="var(--accent)" /></div>
      <div className="gd4-cardName">{card.name}</div>
      <div className="gd4-cardType">{SLOT_LABEL[card.slotType]}</div>
    </div>
  );
}

export function LossCurve({ curve, step, outcome }) {
  const W = 520, H = 200;
  const { pts, N, oomCut } = curve;
  const visible = pts.slice(0, Math.max(1, step));
  const x = e => 30 + (e / N) * (W - 50);
  const y = v => 14 + clamp(v, 0, 1) * (H - 36);
  const path = key => visible.map((p, i) => (i === 0 ? "M" : "L") + x(p.e).toFixed(1) + "," + y(p[key]).toFixed(1)).join(" ");
  const glitching = outcome === "oom" && oomCut != null && step >= pts.length;
  return (
    <div className={"gd4-curveBox" + (glitching ? " glitch" : "")}>
      <svg viewBox={`0 0 ${W} ${H}`} className="gd4-curveSvg" preserveAspectRatio="none">
        {Array.from({ length: 5 }).map((_, i) => {
          const gy = 14 + i * (H - 36) / 4;
          return <line key={i} x1={30} x2={W - 20} y1={gy} y2={gy} className="gd4-gridline" />;
        })}
        <path d={path("train")} className="gd4-trainLine" fill="none" />
        <path d={path("val")} className="gd4-valLine" fill="none" />
        {glitching && <text x={W / 2} y={H / 2} textAnchor="middle" className="gd4-glitchText">⚠ CUDA OUT OF MEMORY</text>}
      </svg>
      <div className="gd4-curveLegend"><span className="gd4-legTrain">━ train loss</span><span className="gd4-legVal">┄ val loss</span></div>
    </div>
  );
}

export function Tutorial({ step, setStep }) {
  const s = TUTORIAL_V4[step];
  if (!s) return null;
  return (
    <div className="gd4-overlay">
      <div className="gd4-modal narrow">
        <div className="gd4-eyebrow">how to play · {step + 1} / {TUTORIAL_V4.length}</div>
        <h2 className="gd4-h2">{s.t}</h2>
        <p className="gd4-body">{s.b}</p>
        <div className="gd4-modalFoot">
          <button className="gd4-btn" onClick={() => setStep(null)}>Skip</button>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && <button className="gd4-btn" onClick={() => setStep(step - 1)}>← Back</button>}
            {step < TUTORIAL_V4.length - 1
              ? <button className="gd4-btn primary" onClick={() => setStep(step + 1)}>Next →</button>
              : <button className="gd4-btn primary" onClick={() => setStep(null)}>Let's build! →</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LeaderboardPanel({ flavorId, onClose }) {
  const [filter, setFilter] = useState(flavorId || "all");
  const board = rankBoard(loadBoard());
  const flavorName = f => (FLAVORS.find(x => x.id === f) || {}).name || f;
  const rows = filter === "all" ? board : board.filter(r => r.flavour === flavorName(filter));
  return (
    <div className="gd4-overlay" onClick={onClose}>
      <div className="gd4-modal wide" onClick={e => e.stopPropagation()}>
        <h2 className="gd4-h2">🏆 Userboard</h2>
        <div className="gd4-lbFilters">
          <button className={"gd4-btn sm" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>All flavours</button>
          {flavorId && <button className={"gd4-btn sm" + (filter === flavorId ? " on" : "")} onClick={() => setFilter(flavorId)}>This flavour</button>}
        </div>
        {!storageOK && <p className="gd4-tiny">⚠ Local storage is unavailable — scores are only kept for this browser session.</p>}
        {rows.length === 0 ? <p className="gd4-dim">No Speedrun finishes yet — be the first.</p> : (
          <div className="gd4-lbTableWrap">
            <table className="gd4-lbTable">
              <thead><tr><th>#</th><th>Nickname</th><th>Flavour</th><th>Solved</th><th>Best model</th><th>Time</th><th>Tries</th><th>Date</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r.fullClear ? "gold" : ""}>
                    <td>{i + 1}</td><td>{r.nickname}</td><td>{r.flavour}</td><td>{r.solvedCount}/10</td><td>{r.bestModel || "—"}</td>
                    <td>{fmtTime(r.totalTimeMs)}</td><td>{r.totalTries}</td>
                    <td>{new Date(r.date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button className="gd4-btn" onClick={onClose} style={{ marginTop: 12 }}>Close</button>
      </div>
    </div>
  );
}

export function FlavorCarousel({ idx, setIdx }) {
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
    <div className="gd4-carouselWrap">
      <button className="gd4-carArrow" onClick={() => setIdx(clamp(idx - 1, 0, FLAVORS.length - 1))} aria-label="Previous flavour">‹</button>
      <div className="gd4-carViewport" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        <div className="gd4-carTrack" style={{ transform: `translateX(${offset}px)`, transition: dragRef.current ? "none" : "transform .35s cubic-bezier(.2,.8,.2,1)" }}>
          {FLAVORS.map((f, i) => (
            <button key={f.id} type="button" className={"gd4-flavCard" + (i === idx ? " active" : "")} style={{ "--primary": f.primary, "--accent": f.accent, "--bg": f.bg, "--text": f.text }} onClick={() => setIdx(i)}>
              <div className="gd4-flavSwatchRow"><span className="gd4-swatch" style={{ background: f.primary }} /><span className="gd4-swatch" style={{ background: f.accent }} /></div>
              <div className="gd4-flavName">{f.name}</div>
              <div className="gd4-flavMood">{f.mood}</div>
            </button>
          ))}
        </div>
      </div>
      <button className="gd4-carArrow" onClick={() => setIdx(clamp(idx + 1, 0, FLAVORS.length - 1))} aria-label="Next flavour">›</button>
      <div className="gd4-dots">
        {FLAVORS.map((f, i) => <button key={f.id} type="button" className={"gd4-dot" + (i === idx ? " on" : "")} onClick={() => setIdx(i)} aria-label={"Go to " + f.name} />)}
      </div>
    </div>
  );
}

export function BriefingModal({ problem, revealed, onClose }) {
  const b = problem.briefing;
  return (
    <div className="gd4-overlay" onClick={onClose}>
      <div className="gd4-modal wide" onClick={e => e.stopPropagation()}>
        <div className="gd4-eyebrow">mission briefing · problem {PROBLEMS.indexOf(problem) + 1} / 10</div>
        <div className="gd4-briefHead">
          <Icon2 id={problem.icon} size={40} primary="var(--primary)" accent="var(--accent)" />
          <div>
            <h2 className="gd4-h2" style={{ margin: 0 }}>{problem.title}</h2>
            <div className="gd4-tiny">{problem.field} · <span className={"gd4-diff " + difficultyTone(problem.difficulty)}>{problem.difficulty}</span></div>
          </div>
        </div>
        <div className="gd4-briefGrid">
          <div><b>The problem</b><p>{b.problem}</p></div>
          <div><b>The data</b><p>{b.data}</p></div>
          <div><b>Why it's hard</b><p>{b.hard}</p></div>
          <div><b>A nudge</b><p>{b.nudge}</p></div>
          <div><b>Real-world impact</b><p>{b.impact}</p></div>
        </div>
        {revealed && <p className="gd4-reveal">🔭 Peer Review: the ideal model family here is <b>{problem.bestFit.map(id => MODELS.find(m => m.id === id).name).join(" or ")}</b>.</p>}
        <div className="gd4-targetRow">Target: beat <b>{problem.target} {problem.metricLabel}</b> on validation.</div>
        <button className="gd4-btn primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export function NotebookModal({ notebookUnlocked, onClose }) {
  const [sel, setSel] = useState(null);
  return (
    <div className="gd4-overlay" onClick={onClose}>
      <div className="gd4-modal wide" onClick={e => e.stopPropagation()}>
        <h2 className="gd4-h2">📓 Lab Notebook <span className="gd4-tiny">{notebookUnlocked.length}/10 — pages unlock as you solve each problem</span></h2>
        <div className="gd4-nbGrid">
          <div className="gd4-nbList">
            {PROBLEMS.map(p => {
              const open = notebookUnlocked.includes(p.id);
              return <button key={p.id} disabled={!open} className={"gd4-nbItem" + (sel === p.id ? " on" : "")} onClick={() => setSel(p.id)}>{open ? p.title : "· · ·"}</button>;
            })}
          </div>
          <div className="gd4-nbBody">
            {sel ? (() => {
              const p = PROBLEMS.find(q => q.id === sel), b = p.briefing;
              return (<>
                <h3>{p.title}</h3>
                <p><b>The problem</b><br />{b.problem}</p>
                <p><b>The data</b><br />{b.data}</p>
                <p><b>Why it's hard</b><br />{b.hard}</p>
                <p><b>A nudge</b><br />{b.nudge}</p>
                <p><b>Real-world impact</b><br />{b.impact}</p>
              </>);
            })() : <div className="gd4-dim">Pick an unlocked page.</div>}
          </div>
        </div>
        <button className="gd4-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export function BonusCard({ inst, onPlay, disabled }) {
  const def = BONUS_DEFS.find(d => d.id === inst.defId);
  if (!def) return null;
  return (
    <div className="gd4-bonusCard" title={def.tip}>
      <Icon2 id={def.icon} size={24} primary="var(--accent)" accent="var(--primary)" />
      <div className="gd4-bonusName">{def.name}</div>
      <button className="gd4-btn sm primary" disabled={disabled} onClick={() => onPlay(inst.uid)}>Play</button>
    </div>
  );
}
