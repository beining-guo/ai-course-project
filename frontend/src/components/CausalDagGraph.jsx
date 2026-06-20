import { useMemo } from "react";
import dagre from "@dagrejs/dagre";
import { Empty } from "antd";

const ROLE_META = {
  confounder: { color: "#b45309", label: "混淆变量" },
  treatment: { color: "#2563eb", label: "干预变量" },
  outcome: { color: "#16a34a", label: "结果变量" },
  mediator: { color: "#7c3aed", label: "中介变量" },
  covariate: { color: "#64748b", label: "协变量" },
};

const EDGE_META = {
  confounder: { color: "#334155" },
  effect: { color: "#2563eb" },
  default: { color: "#0f766e" },
};

const NODE_R = 42;
const FALLBACK_NODE_SIZE = NODE_R * 2;

const DEFAULT_LAYOUT = {
  positions: {
    Z: { x: 105, y: 245 },
    X: { x: 360, y: 372 },
    Y: { x: 620, y: 245 },
  },
  width: 740,
  height: 500,
  fixed: true,
};

const DEFAULT_EDGE_LAYOUT = {
  "Z->Y": {
    control: { x: 362, y: 72 },
    label: { x: 362, y: 72 },
    labelWidth: 154,
    tone: "confounder",
  },
  "Z->X": {
    control: { x: 212, y: 428 },
    label: { x: 226, y: 318 },
    labelWidth: 154,
    tone: "confounder",
  },
  "X->Y": {
    control: { x: 494, y: 330 },
    label: { x: 504, y: 314 },
    labelWidth: 118,
    tone: "effect",
  },
};

function roleMeta(role) {
  return ROLE_META[role] || ROLE_META.covariate;
}

function edgeKey(edge) {
  return `${edge.source}->${edge.target}`;
}

function labelFor(edge) {
  if (edge.source === "Z" && edge.target === "X") return "影响服药选择";
  if (edge.source === "Z" && edge.target === "Y") return "影响康复概率";
  if (edge.source === "X" && edge.target === "Y") return "药物疗效";
  return edge.label || edge.strength || "因果影响";
}

function isDefaultCausalCase(variables) {
  const keys = new Set((variables || []).map((variable) => variable.key));
  return variables?.length === 3 && keys.has("Z") && keys.has("X") && keys.has("Y");
}

function quadraticPoint(sx, sy, cx, cy, ex, ey, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * sx + 2 * mt * t * cx + t * t * ex,
    y: mt * mt * sy + 2 * mt * t * cy + t * t * ey,
  };
}

function estimateLabelWidth(text) {
  return Math.max(82, text.length * 17 + 28);
}

function buildPath(source, target, control, endGap = NODE_R + 9) {
  const va = Math.hypot(control.x - source.x, control.y - source.y) || 1;
  const vb = Math.hypot(control.x - target.x, control.y - target.y) || 1;
  const sx = source.x + ((control.x - source.x) / va) * NODE_R;
  const sy = source.y + ((control.y - source.y) / va) * NODE_R;
  const ex = target.x + ((control.x - target.x) / vb) * endGap;
  const ey = target.y + ((control.y - target.y) / vb) * endGap;
  return {
    d: `M ${sx} ${sy} Q ${control.x} ${control.y} ${ex} ${ey}`,
    start: { x: sx, y: sy },
    end: { x: ex, y: ey },
  };
}

function genericEdgeSpec(edge, positions, index) {
  const source = positions[edge.source];
  const target = positions[edge.target];
  if (!source || !target) return null;

  const mx = (source.x + target.x) / 2;
  const my = (source.y + target.y) / 2;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = (index % 2 === 0 ? 1 : -1) * (34 + Math.floor(index / 2) * 18);
  const control = { x: mx + nx * bend, y: my + ny * bend };
  const path = buildPath(source, target, control);
  const labelPoint = quadraticPoint(path.start.x, path.start.y, control.x, control.y, path.end.x, path.end.y, 0.5);

  return {
    ...path,
    label: { x: labelPoint.x + nx * 10, y: labelPoint.y + ny * 10 },
    labelWidth: estimateLabelWidth(labelFor(edge)),
    tone: edge.source === "X" && edge.target === "Y" ? "effect" : "default",
  };
}

function edgeSpec(edge, positions, fixed, index) {
  const source = positions[edge.source];
  const target = positions[edge.target];
  if (!source || !target) return null;

  const defaultSpec = fixed ? DEFAULT_EDGE_LAYOUT[edgeKey(edge)] : null;
  if (defaultSpec) {
    return {
      ...buildPath(source, target, defaultSpec.control),
      label: defaultSpec.label,
      labelWidth: defaultSpec.labelWidth,
      tone: defaultSpec.tone,
    };
  }

  return genericEdgeSpec(edge, positions, index);
}

export default function CausalDagGraph({
  variables,
  edges,
  className = "",
  caption = "图：当前因果 DAG：节点表示变量，箭头表示直接因果影响，整体保持有向无环。",
  highlightNodes = [],
  conditionedNodes = [],
}) {
  const safeVariables = variables || [];
  const safeEdges = edges || [];
  const highlightedSet = useMemo(() => new Set(highlightNodes), [highlightNodes]);
  const conditionedSet = useMemo(() => new Set(conditionedNodes), [conditionedNodes]);

  const layout = useMemo(() => {
    if (!safeVariables.length) return null;
    if (isDefaultCausalCase(safeVariables)) return DEFAULT_LAYOUT;

    const graph = new dagre.graphlib.Graph();
    graph.setGraph({ rankdir: "LR", nodesep: 96, ranksep: 120, marginx: 76, marginy: 70 });
    graph.setDefaultEdgeLabel(() => ({}));
    safeVariables.forEach((variable) => graph.setNode(variable.key, { width: FALLBACK_NODE_SIZE, height: FALLBACK_NODE_SIZE }));
    safeEdges.forEach((edge) => graph.setEdge(edge.source, edge.target, { weight: 2 }));
    dagre.layout(graph);

    const positions = {};
    safeVariables.forEach((variable) => {
      const node = graph.node(variable.key);
      positions[variable.key] = node ? { x: node.x, y: node.y } : { x: 120, y: 120 };
    });

    const meta = graph.graph();
    return {
      positions,
      width: Math.max(meta.width || 760, 760),
      height: Math.max(meta.height || 460, 460),
      fixed: false,
    };
  }, [safeVariables, safeEdges]);

  if (!layout) {
    return (
      <figure className={`cdag-graph cdag-family-like ${className}`.trim()}>
        <div className="cdag-graph-empty">
          <Empty description="暂无变量，请先在左侧新增因果变量" />
        </div>
      </figure>
    );
  }

  const { positions, width, height, fixed } = layout;
  const usedTones = [...new Set(safeEdges.map((edge, index) => edgeSpec(edge, positions, fixed, index)?.tone || "default"))];

  return (
    <figure className={`cdag-graph cdag-family-like ${className}`.trim()}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="因果 DAG 拓扑图" preserveAspectRatio="xMidYMid meet">
        <defs>
          {usedTones.map((tone) => {
            const color = EDGE_META[tone]?.color || EDGE_META.default.color;
            return (
              <marker
                key={tone}
                id={`cdag-arr-${tone}`}
                markerWidth="10"
                markerHeight="10"
                refX="8"
                refY="3.2"
                orient="auto"
              >
                <path d="M0,0 L8,3.2 L0,6.4 Z" fill={color} />
              </marker>
            );
          })}
        </defs>

        {safeEdges.map((edge, index) => {
          const spec = edgeSpec(edge, positions, fixed, index);
          if (!spec) return null;
          const label = labelFor(edge);
          const color = EDGE_META[spec.tone]?.color || EDGE_META.default.color;
          const labelWidth = spec.labelWidth || estimateLabelWidth(label);
          const labelHeight = spec.tone === "effect" ? 30 : 26;
          return (
            <g className={`cdag-family-edge is-${spec.tone}`} key={edge.id}>
              <path
                className="cdag-family-edge-line"
                d={spec.d}
                fill="none"
                stroke={color}
                strokeWidth={spec.tone === "effect" ? 3.2 : 3}
                markerEnd={`url(#cdag-arr-${spec.tone})`}
              />
              <rect
                className="cdag-family-label-bg"
                x={spec.label.x - labelWidth / 2}
                y={spec.label.y - labelHeight / 2}
                width={labelWidth}
                height={labelHeight}
                rx={labelHeight / 2}
                fill="#ffffff"
                stroke={color}
              />
              <text className="cdag-family-label" x={spec.label.x} y={spec.label.y} fill={color}>
                {label}
              </text>
            </g>
          );
        })}

        {safeVariables.map((variable) => {
          const position = positions[variable.key];
          if (!position) return null;
          const meta = roleMeta(variable.role);
          return (
            <g
              className={`cdag-family-node is-${variable.role || "covariate"} ${
                highlightedSet.has(variable.key) ? "is-query" : ""
              } ${conditionedSet.has(variable.key) ? "is-conditioned" : ""}`}
              key={variable.id}
              style={{ "--node-ring": meta.color }}
              transform={`translate(${position.x}, ${position.y})`}
            >
              <circle className="cdag-family-node-ring" r={NODE_R + 5} />
              <circle className="cdag-family-node-core" r={NODE_R} />
              <text className="cdag-family-node-key" x="0" y="-8">{variable.key}</text>
              <text className="cdag-family-node-name" x="0" y="17">{variable.name}</text>
            </g>
          );
        })}
      </svg>

      <div className="cdag-family-legend">
        {safeVariables.map((variable) => {
          const meta = roleMeta(variable.role);
          return (
            <span key={variable.id}>
              <i style={{ borderColor: meta.color }} />
              {variable.key}：{meta.label}
            </span>
          );
        })}
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
