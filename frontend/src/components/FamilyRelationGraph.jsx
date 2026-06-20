import { useMemo } from "react";
import dagre from "@dagrejs/dagre";
import { Empty } from "antd";

const SYMMETRIC = new Set(["Couple", "Sibling"]);
const REL_BASE_COLOR = {
  Couple: "#7c3aed",
  Mother: "#2563eb",
  Father: "#e11d48",
  Sibling: "#059669",
};
const FALLBACK_PALETTE = ["#0891b2", "#d97706", "#c026d3", "#0d9488", "#4f46e5", "#b45309"];
const NODE_R = 34;
const GEN_RING = ["#7c3aed", "#0d9488", "#2563eb", "#d97706", "#db2777", "#0891b2"];
const CURVE_OFFSETS = [0, 38, -38, 72, -72, 108, -108];

function quadraticPoint(sx, sy, cx, cy, ex, ey, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * sx + 2 * mt * t * cx + t * t * ex,
    y: mt * mt * sy + 2 * mt * t * cy + t * t * ey,
  };
}

function labelTForPredicate(predicate, inferred) {
  if (inferred) return predicate === "Mother" ? 0.36 : 0.64;
  if (predicate === "Father") return 0.58;
  if (predicate === "Mother") return 0.42;
  if (predicate === "Couple") return 0.5;
  if (predicate === "Sibling") return 0.52;
  return 0.5;
}

function estimateLabelWidth(predicate, inferred) {
  const wideChars = [...predicate].reduce((sum, ch) => sum + (/[A-Z]/.test(ch) ? 9.4 : 8.2), 0);
  return Math.max(inferred ? 76 : 64, Math.ceil(wideChars + (inferred ? 32 : 24)));
}

export function buildFamilyRelationColorMap(relationTypes) {
  const map = { ...REL_BASE_COLOR };
  let i = 0;
  (relationTypes || []).forEach((rt) => {
    if (!map[rt.value]) {
      map[rt.value] = FALLBACK_PALETTE[i % FALLBACK_PALETTE.length];
      i += 1;
    }
  });
  return map;
}

export function familyRelationKey(relation) {
  return `${relation.predicate}|${relation.head}|${relation.tail}`;
}

function visualRelationKey(relation) {
  if (SYMMETRIC.has(relation.predicate)) {
    return `${relation.predicate}|${[relation.head, relation.tail].sort().join("|")}`;
  }
  return familyRelationKey(relation);
}

export default function FamilyRelationGraph({
  members,
  relations,
  target,
  colorMap,
  inferredKeys = [],
  highlightKeys = [],
  className = "",
  caption,
  emptyDescription = "暂无成员，请先在左侧新增家庭成员",
}) {
  const safeMembers = members || [];
  const safeRelations = relations || [];
  const inferredKeySet = useMemo(() => new Set(inferredKeys), [inferredKeys]);
  const highlightKeySet = useMemo(() => new Set(highlightKeys), [highlightKeys]);
  const visibleRelations = useMemo(() => {
    const seen = new Set();
    return safeRelations.filter((relation) => {
      const key = visualRelationKey(relation);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [safeRelations]);

  const layout = useMemo(() => {
    if (safeMembers.length === 0) return null;
    const lowerNameMap = new Map(safeMembers.map((m) => [m.name.toLowerCase(), m.name]));
    const referenceNames = ["mary", "george", "david", "james", "ann", "mike"];
    if (referenceNames.every((name) => lowerNameMap.has(name))) {
      const name = (key) => lowerNameMap.get(key);
      return {
        pos: {
          [name("mary")]: { x: 150, y: 92 },
          [name("george")]: { x: 690, y: 92 },
          [name("david")]: { x: 220, y: 330 },
          [name("james")]: { x: 690, y: 330 },
          [name("ann")]: { x: 380, y: 590 },
          [name("mike")]: { x: 660, y: 590 },
        },
        gen: {
          [name("mary")]: 0,
          [name("george")]: 0,
          [name("david")]: 1,
          [name("james")]: 1,
          [name("ann")]: 2,
          [name("mike")]: 2,
        },
        width: 850,
        height: 690,
      };
    }

    const compactNames = ["david", "james", "ann", "mike"];
    if (safeMembers.length === 4 && compactNames.every((name) => lowerNameMap.has(name))) {
      const name = (key) => lowerNameMap.get(key);
      return {
        pos: {
          [name("david")]: { x: 180, y: 110 },
          [name("james")]: { x: 580, y: 110 },
          [name("ann")]: { x: 245, y: 430 },
          [name("mike")]: { x: 580, y: 430 },
        },
        gen: {
          [name("david")]: 0,
          [name("james")]: 0,
          [name("ann")]: 1,
          [name("mike")]: 1,
        },
        width: 760,
        height: 560,
      };
    }

    const g = new dagre.graphlib.Graph({ multigraph: true });
    g.setGraph({ rankdir: "TB", nodesep: 104, ranksep: 132, marginx: 76, marginy: 62 });
    g.setDefaultEdgeLabel(() => ({}));

    const names = new Set(safeMembers.map((m) => m.name));
    safeMembers.forEach((m) => g.setNode(m.name, { width: NODE_R * 2, height: NODE_R * 2 }));
    visibleRelations.forEach((r, i) => {
      if (!names.has(r.head) || !names.has(r.tail)) return;
      if (SYMMETRIC.has(r.predicate)) return;
      g.setEdge(r.head, r.tail, { minlen: 1, weight: 2 }, `e${i}`);
    });

    dagre.layout(g);

    const pos = {};
    safeMembers.forEach((m) => {
      const n = g.node(m.name);
      if (n) pos[m.name] = { x: n.x, y: n.y };
    });
    const ys = [...new Set(safeMembers.map((m) => Math.round(pos[m.name]?.y ?? 0)))].sort((a, b) => a - b);
    const gen = {};
    safeMembers.forEach((m) => {
      gen[m.name] = ys.indexOf(Math.round(pos[m.name]?.y ?? 0));
    });
    const gg = g.graph();
    return { pos, gen, width: Math.max(gg.width || 760, 760), height: Math.max(gg.height || 520, 520) };
  }, [safeMembers, visibleRelations]);

  const genders = useMemo(() => {
    const m = {};
    safeMembers.forEach((mm) => {
      m[mm.name] = mm.gender;
    });
    return m;
  }, [safeMembers]);

  if (safeMembers.length === 0 || !layout) {
    return (
      <figure className={`kgb-graph ${className}`.trim()}>
        <div className="kgb-graph-empty">
          <Empty description={emptyDescription} />
        </div>
      </figure>
    );
  }

  const { pos, gen, width, height } = layout;
  const pairCount = {};
  const edges = visibleRelations
    .filter((r) => pos[r.head] && pos[r.tail])
    .map((r) => {
      const key = [r.head, r.tail].sort().join("|");
      const idx = pairCount[key] || 0;
      pairCount[key] = idx + 1;
      return {
        ...r,
        curveIndex: idx,
        inferred: Boolean(r.inferred || inferredKeySet.has(familyRelationKey(r))),
        pending: Boolean(r.pending),
        highlighted: highlightKeySet.has(familyRelationKey(r)) || highlightKeySet.has(visualRelationKey(r)),
        dimmed: highlightKeySet.size > 0 && !highlightKeySet.has(familyRelationKey(r)) && !highlightKeySet.has(visualRelationKey(r)),
      };
    });
  const usedColors = [...new Set(edges.map((e) => colorMap[e.predicate] || "#64748b"))];
  const usedPreds = [...new Set(visibleRelations.map((r) => r.predicate))];
  const hasInferred = edges.some((e) => e.inferred);
  const hasPending = edges.some((e) => e.pending);

  return (
    <figure className={`kgb-graph ${className}`.trim()}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="家庭关系知识图谱" preserveAspectRatio="xMidYMid meet">
        <defs>
          {usedColors.map((color) => (
            <marker
              key={color}
              id={`kgb-arr-${color.replace("#", "")}`}
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="3.2"
              orient="auto"
            >
              <path d="M0,0 L8,3.2 L0,6.4 Z" fill={color} />
            </marker>
          ))}
        </defs>

        {edges.map((e, i) => {
          const a = pos[e.head];
          const b = pos[e.tail];
          const color = colorMap[e.predicate] || "#64748b";
          const directional = !SYMMETRIC.has(e.predicate);
          const isTarget = e.predicate === target;
          const edgeClass = [
            "kgb-edge",
            e.inferred ? "is-inferred" : "",
            e.pending ? "is-pending" : "",
            e.highlighted ? "is-highlighted" : "",
            e.dimmed ? "is-dimmed" : "",
          ].filter(Boolean).join(" ");
          const labelClass = [
            "kgb-edge-label",
            e.inferred ? "is-inferred" : "",
            e.pending ? "is-pending" : "",
            e.highlighted ? "is-highlighted" : "",
            e.dimmed ? "is-dimmed" : "",
          ].filter(Boolean).join(" ");
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          const baseOffset = CURVE_OFFSETS[e.curveIndex] ?? (e.curveIndex % 2 ? -1 : 1) * (46 + e.curveIndex * 16);
          const inferredBend = e.inferred || e.pending ? (baseOffset >= 0 ? 30 : -30) : 0;
          const k = baseOffset + inferredBend;
          const ctrlX = mx + nx * k;
          const ctrlY = my + ny * k;
          const va = Math.hypot(ctrlX - a.x, ctrlY - a.y) || 1;
          const vb = Math.hypot(ctrlX - b.x, ctrlY - b.y) || 1;
          const sx = a.x + ((ctrlX - a.x) / va) * NODE_R;
          const sy = a.y + ((ctrlY - a.y) / va) * NODE_R;
          const endGap = directional ? NODE_R + 9 : NODE_R;
          const ex = b.x + ((ctrlX - b.x) / vb) * endGap;
          const ey = b.y + ((ctrlY - b.y) / vb) * endGap;
          const labelPoint = quadraticPoint(sx, sy, ctrlX, ctrlY, ex, ey, labelTForPredicate(e.predicate, e.inferred || e.pending));
          const labelLift = 10 + Math.min(e.curveIndex, 4) * 4 + (e.inferred || e.pending ? 10 : 0);
          const lx = labelPoint.x + nx * labelLift;
          const ly = labelPoint.y + ny * labelLift;
          const labelWidth = estimateLabelWidth(e.predicate, e.inferred || e.pending);
          const labelHeight = e.inferred || e.pending ? 28 : 24;
          const path = `M ${sx} ${sy} Q ${ctrlX} ${ctrlY} ${ex} ${ey}`;

          return (
            <g key={e.id || familyRelationKey(e) || i}>
              {e.inferred ? <path className="kgb-edge-halo" d={path} fill="none" /> : null}
              <path
                className={edgeClass}
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={e.inferred ? 3.8 : e.pending ? 3.2 : isTarget ? 3 : 2.4}
                strokeDasharray={e.inferred || e.pending ? "9 6" : undefined}
                markerEnd={directional ? `url(#kgb-arr-${color.replace("#", "")})` : undefined}
              />
              <rect
                className={`kgb-edge-label-bg ${e.inferred ? "is-inferred" : ""} ${e.pending ? "is-pending" : ""} ${e.highlighted ? "is-highlighted" : ""} ${e.dimmed ? "is-dimmed" : ""}`.trim()}
                x={lx - labelWidth / 2}
                y={ly - labelHeight / 2}
                width={labelWidth}
                height={labelHeight}
                rx={labelHeight / 2}
                fill={e.inferred || e.pending ? "#fff1f2" : "#ffffff"}
                stroke={color}
              />
              <text className={labelClass} x={lx} y={ly} fill={color}>
                {e.predicate}
              </text>
            </g>
          );
        })}

        {safeMembers.map((m) => {
          const p = pos[m.name];
          if (!p) return null;
          const gender = genders[m.name];
          const ring = GEN_RING[gen[m.name] % GEN_RING.length];
          return (
            <g
              className={`kgb-node ${gender === "male" ? "is-male" : gender === "female" ? "is-female" : "is-unknown"}`}
              key={m.id}
              style={{ "--node-ring": ring }}
            >
              <circle className="kgb-node-ring" cx={p.x} cy={p.y} r={NODE_R + 4} fill="none" stroke={ring} />
              <circle cx={p.x} cy={p.y} r={NODE_R} />
              <text x={p.x} y={p.y}>
                {m.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="kgb-graph-legend">
        {usedPreds.map((pred) => (
          <span key={pred}>
            <i style={{ borderColor: colorMap[pred] || "#64748b" }} />
            {pred}
            {pred === target ? "（目标）" : ""}
          </span>
        ))}
        {hasPending ? (
          <span>
            <i className="kgb-pending-line" />
            待推理
          </span>
        ) : null}
        {hasInferred ? (
          <span>
            <i className="kgb-infer-line" />
            推理补全
          </span>
        ) : null}
      </div>
      <figcaption>
        {caption ||
          `图 · 家庭关系知识图谱：节点按辈分分层，实线为已知事实，虚线为待推理或推理补全的 ${target} 关系。`}
      </figcaption>
    </figure>
  );
}
