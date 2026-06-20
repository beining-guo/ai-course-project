import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Space, Statistic, Table, Tag, Typography } from "antd";
import {
  AimOutlined,
  BarChartOutlined,
  BorderOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  CompassOutlined,
  FieldTimeOutlined,
  FlagOutlined,
  ForkOutlined,
  LineChartOutlined,
  NodeIndexOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RocketOutlined,
  SearchOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import StepPlayerBar from "../components/StepPlayerBar.jsx";
import { useStepPlayer } from "../hooks/useStepPlayer.js";
import "../styles/astar.css";

const { Paragraph, Title } = Typography;

const ROWS = 11;
const COLS = 18;
const START = { x: 1, y: 1 };
const GOAL = { x: 16, y: 9 };
const ASTAR_OBSTACLE_STORAGE_KEY = "ai-course-astar-obstacles";
const DIRECTIONS = [
  { dx: 1, dy: 0, label: "右" },
  { dx: 0, dy: 1, label: "下" },
  { dx: -1, dy: 0, label: "左" },
  { dx: 0, dy: -1, label: "上" },
];

const DESIGNED_OBSTACLES = [
  [5, 0],
  [5, 1],
  [5, 2],
  [5, 4],
  [5, 5],
  [5, 6],
  [2, 3],
  [3, 3],
  [4, 3],
  [7, 2],
  [8, 2],
  [9, 2],
  [10, 2],
  [11, 2],
  [8, 3],
  [8, 4],
  [1, 5],
  [2, 5],
  [3, 5],
  [4, 5],
  [7, 5],
  [8, 5],
  [9, 5],
  [12, 4],
  [12, 5],
  [12, 6],
  [12, 7],
  [14, 1],
  [14, 2],
  [14, 3],
  [15, 6],
  [16, 6],
  [3, 8],
  [4, 8],
  [5, 8],
  [6, 8],
  [7, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [9, 6],
  [9, 7],
  [2, 9],
  [15, 4],
  [16, 4],
];

const HEURISTICS = {
  euclidean: {
    key: "euclidean",
    name: "h1 欧氏距离",
    shortName: "A* h1",
    tone: "#0f766e",
    formula: "f1(n)=g(n)+h1(n)，h1(n)=sqrt((x_n-x_g)^2+(y_n-y_g)^2)",
    description: "评价函数由实际代价 g(n) 与欧氏启发 h1(n) 相加得到；h1 满足可采纳性，但在四方向栅格中信息量弱于曼哈顿距离。",
    calculate: (node, goal) => Math.hypot(node.x - goal.x, node.y - goal.y),
  },
  manhattan: {
    key: "manhattan",
    name: "h2 曼哈顿距离",
    shortName: "A* h2",
    tone: "#7c3aed",
    formula: "f2(n)=g(n)+h2(n)，h2(n)=|x_n-x_g|+|y_n-y_g|",
    description: "评价函数由实际代价 g(n) 与曼哈顿启发 h2(n) 相加得到；四方向移动时 h2 通常更接近真实最小代价，信息性更强。",
    calculate: (node, goal) => Math.abs(node.x - goal.x) + Math.abs(node.y - goal.y),
  },
};

const RUN_LABELS = {
  astarEuclidean: "A* h1 欧氏",
  astarManhattan: "A* h2 曼哈顿",
  ucs: "一致代价 UCS",
};

function keyOf(point) {
  return `${point.x},${point.y}`;
}

function pointFromKey(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

function coordinateOf(pointOrKey) {
  const point = typeof pointOrKey === "string" ? pointFromKey(pointOrKey) : pointOrKey;
  return `（${point.x}，${point.y}）`;
}

function isInside(point) {
  return point.x >= 0 && point.x < COLS && point.y >= 0 && point.y < ROWS;
}

function toObstacleSet(obstacles) {
  return new Set(obstacles.map(([x, y]) => `${x},${y}`));
}

function makeSeededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function neighborsOf(point, obstacleSet) {
  return DIRECTIONS.map((dir) => ({ x: point.x + dir.dx, y: point.y + dir.dy, move: dir.label }))
    .filter((next) => isInside(next))
    .filter((next) => !obstacleSet.has(keyOf(next)));
}

function hasPath(obstacleSet) {
  const startKey = keyOf(START);
  const goalKey = keyOf(GOAL);
  const queue = [START];
  const seen = new Set([startKey]);

  while (queue.length) {
    const current = queue.shift();
    if (keyOf(current) === goalKey) return true;
    neighborsOf(current, obstacleSet).forEach((next) => {
      const nextKey = keyOf(next);
      if (!seen.has(nextKey)) {
        seen.add(nextKey);
        queue.push(next);
      }
    });
  }

  return false;
}

function createRandomObstacles(seed) {
  const startKey = keyOf(START);
  const goalKey = keyOf(GOAL);

  for (let attempt = 0; attempt < 90; attempt += 1) {
    const random = makeSeededRandom(seed + attempt * 97);
    const obstacles = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const key = `${x},${y}`;
        if (key === startKey || key === goalKey) continue;
        const nearStart = Math.abs(x - START.x) + Math.abs(y - START.y) <= 1;
        const nearGoal = Math.abs(x - GOAL.x) + Math.abs(y - GOAL.y) <= 1;
        if (!nearStart && !nearGoal && random() < 0.22) {
          obstacles.push([x, y]);
        }
      }
    }

    const obstacleSet = toObstacleSet(obstacles);
    if (hasPath(obstacleSet)) return obstacles;
  }

  return DESIGNED_OBSTACLES;
}

function normalizeObstacles(obstacles) {
  const startKey = keyOf(START);
  const goalKey = keyOf(GOAL);
  const seen = new Set();
  const normalized = [];

  obstacles.forEach((item) => {
    if (!Array.isArray(item) || item.length < 2) return;
    const [x, y] = item.map(Number);
    const point = { x, y };
    const key = keyOf(point);
    if (!Number.isInteger(x) || !Number.isInteger(y)) return;
    if (!isInside(point) || key === startKey || key === goalKey || seen.has(key)) return;
    seen.add(key);
    normalized.push([x, y]);
  });

  return hasPath(toObstacleSet(normalized)) ? normalized : DESIGNED_OBSTACLES;
}

function loadInitialObstacles() {
  if (typeof window === "undefined") return DESIGNED_OBSTACLES;
  try {
    const stored = window.localStorage.getItem(ASTAR_OBSTACLE_STORAGE_KEY);
    return stored ? normalizeObstacles(JSON.parse(stored)) : DESIGNED_OBSTACLES;
  } catch {
    return DESIGNED_OBSTACLES;
  }
}

function reconstructNodePath(nodeId, nodeMap) {
  const path = [];
  let cursor = nodeMap.get(nodeId);
  while (cursor) {
    path.unshift(cursor.key);
    cursor = cursor.parentId === null ? null : nodeMap.get(cursor.parentId);
  }
  return path;
}

function reconstructNodeIdPath(nodeId, nodeMap) {
  const path = [];
  let cursor = nodeMap.get(nodeId);
  while (cursor) {
    path.unshift(cursor.id);
    cursor = cursor.parentId === null ? null : nodeMap.get(cursor.parentId);
  }
  return path;
}

function makeSnapshot({
  label,
  detail,
  mode,
  current,
  open,
  closed,
  generatedThisStep,
  nodeMap,
  treeEdges,
  expandedCount,
  generatedCount,
  foundNodeId,
}) {
  const currentPath = current ? reconstructNodePath(current.id, nodeMap) : [keyOf(START)];
  const finalPath = foundNodeId !== null ? reconstructNodePath(foundNodeId, nodeMap) : [];
  const finalPathNodeIds = foundNodeId !== null ? reconstructNodeIdPath(foundNodeId, nodeMap) : [];
  const openSnapshot = [...open].sort((a, b) =>
    mode === "ucs" ? a.g - b.g || a.order - b.order : a.f - b.f || a.h - b.h || b.g - a.g || a.order - b.order,
  );

  return {
    label,
    detail,
    mode,
    currentKey: current?.key || null,
    currentNodeId: current?.id ?? null,
    openKeys: openSnapshot.map((item) => item.key),
    closedKeys: Array.from(closed),
    generatedKeys: generatedThisStep,
    nodes: Array.from(nodeMap.values()).map((node) => ({ ...node })),
    edges: treeEdges.map((edge) => ({ ...edge })),
    scores: Object.fromEntries(Array.from(nodeMap.values()).map((node) => [node.key, node])),
    currentPath,
    finalPath,
    finalPathNodeIds,
    expandedCount,
    generatedCount,
  };
}

function getSearchRule(type) {
  if (type === "astar") return "按 f(n)=g(n)+h(n) 最小优先";
  return "按 g(n) 最小优先，等价于 A* 中 h(n)=0";
}

function runSearch({ type, heuristic, obstacleSet }) {
  const startedAt = performance.now();
  const startKey = keyOf(START);
  const goalKey = keyOf(GOAL);
  const h0 = type === "astar" ? heuristic.calculate(START, GOAL, obstacleSet) : 0;
  const startNode = {
    id: 0,
    key: startKey,
    x: START.x,
    y: START.y,
    g: 0,
    h: h0,
    f: h0,
    parentId: null,
    depth: 0,
    order: 0,
  };

  let nodeCounter = 1;
  const nodeMap = new Map([[0, startNode]]);
  const open = [startNode];
  const closed = new Set();
  const bestG = new Map([[startKey, { g: 0, id: 0 }]]);
  const treeEdges = [];
  let expandedCount = 0;
  let generatedCount = 1;
  let foundNodeId = null;
  const snapshots = [
    makeSnapshot({
      label: "初始状态",
      detail: `起点 S=${coordinateOf(startKey)}，目标 G=${coordinateOf(goalKey)}，OPEN 表只包含起点。`,
      mode: type,
      current: null,
      open,
      closed,
      generatedThisStep: [startKey],
      nodeMap,
      treeEdges,
      expandedCount,
      generatedCount,
      foundNodeId,
    }),
  ];

  while (open.length) {
    open.sort((a, b) =>
      type === "ucs"
        ? a.g - b.g || a.order - b.order
        : a.f - b.f || a.h - b.h || b.g - a.g || a.order - b.order,
    );

    const current = open.shift();
    if (closed.has(current.key)) continue;
    closed.add(current.key);
    expandedCount += 1;
    const generatedThisStep = [];

    if (current.key === goalKey) {
      foundNodeId = current.id;
      snapshots.push(
        makeSnapshot({
          label: `扩展 ${coordinateOf(current.key)}：到达目标`,
          detail: `目标节点从 OPEN 表弹出，回溯父指针得到红色最短路径，总代价 g=${current.g}。`,
          mode: type,
          current,
          open,
          closed,
          generatedThisStep,
          nodeMap,
          treeEdges,
          expandedCount,
          generatedCount,
          foundNodeId,
        }),
      );
      break;
    }

    neighborsOf(current, obstacleSet).forEach((next) => {
      const nextKey = keyOf(next);
      if (closed.has(nextKey)) return;
      const tentativeG = current.g + 1;
      const best = bestG.get(nextKey);
      if (best && tentativeG >= best.g) return;

      const h = type === "astar" ? heuristic.calculate(next, GOAL, obstacleSet) : 0;
      const f = tentativeG + h;
      const node = {
        id: nodeCounter,
        key: nextKey,
        x: next.x,
        y: next.y,
        g: tentativeG,
        h,
        f,
        parentId: current.id,
        depth: current.depth + 1,
        order: nodeCounter,
      };
      nodeCounter += 1;
      nodeMap.set(node.id, node);
      bestG.set(nextKey, { g: tentativeG, id: node.id });
      treeEdges.push({ from: current.id, to: node.id });
      const oldIndex = open.findIndex((item) => item.key === nextKey);
      if (oldIndex >= 0) open.splice(oldIndex, 1);
      open.push(node);
      generatedCount += 1;
      generatedThisStep.push(nextKey);
    });

    snapshots.push(
      makeSnapshot({
        label: `扩展 ${coordinateOf(current.key)}`,
        detail:
          generatedThisStep.length > 0
            ? `生成 ${generatedThisStep.map(coordinateOf).join("、")}，随后${getSearchRule(type)}继续选择下一节点。`
            : "该节点没有产生新的可行后继，继续从 OPEN 表选择下一节点。",
        mode: type,
        current,
        open,
        closed,
        generatedThisStep,
        nodeMap,
        treeEdges,
        expandedCount,
        generatedCount,
        foundNodeId,
      }),
    );
  }

  const durationMs = performance.now() - startedAt;
  const finalSnapshot = snapshots[snapshots.length - 1];
  const path = finalSnapshot.finalPath;

  return {
    type,
    key: type === "astar" ? heuristic.key : "ucs",
    name: type === "astar" ? heuristic.name : "一致代价搜索 UCS",
    shortName: type === "astar" ? heuristic.shortName : "UCS",
    tone: type === "astar" ? heuristic.tone : "#2563eb",
    formula: type === "astar" ? heuristic.formula : "f(n)=g(n)+0，UCS 是 A* 在 h(n)=0 时的特殊情况",
    snapshots,
    metrics: {
      expanded: finalSnapshot.expandedCount,
      generated: finalSnapshot.generatedCount,
      runtime: Number(durationMs.toFixed(3)),
      pathLength: path.length ? path.length - 1 : 0,
      treeNodes: finalSnapshot.nodes.length,
      steps: snapshots.length - 1,
      found: path.length > 0,
    },
    path,
  };
}

function buildMetricChart(results) {
  const labels = results.map((item) => item.shortName);
  return {
    color: ["#0f766e", "#7c3aed", "#2563eb"],
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { top: 0 },
    grid: { left: 42, right: 20, top: 42, bottom: 32 },
    xAxis: { type: "category", data: labels, axisTick: { show: false } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: "#e4ece8" } } },
    series: [
      {
        name: "扩展节点数",
        type: "bar",
        data: results.map((item) => item.metrics.expanded),
        barMaxWidth: 26,
      },
      {
        name: "生成节点数",
        type: "bar",
        data: results.map((item) => item.metrics.generated),
        barMaxWidth: 26,
      },
      {
        name: "路径长度",
        type: "bar",
        data: results.map((item) => item.metrics.pathLength),
        barMaxWidth: 26,
      },
    ],
  };
}

function buildRuntimeChart(results) {
  return {
    color: ["#b45309"],
    tooltip: { trigger: "axis", formatter: (params) => `${params[0].name}<br/>运行时间：${params[0].value} ms` },
    grid: { left: 48, right: 20, top: 24, bottom: 34 },
    xAxis: { type: "category", data: results.map((item) => item.shortName), axisTick: { show: false } },
    yAxis: {
      type: "value",
      name: "ms",
      splitLine: { lineStyle: { color: "#e4ece8" } },
    },
    series: [
      {
        type: "line",
        smooth: true,
        symbolSize: 10,
        areaStyle: { opacity: 0.12 },
        data: results.map((item) => item.metrics.runtime),
      },
    ],
  };
}

function buildHeuristicValueRows(obstacleSet) {
  const rows = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const point = { x, y };
      const key = keyOf(point);
      if (obstacleSet.has(key)) continue;
      const h1 = HEURISTICS.euclidean.calculate(point, GOAL);
      const h2 = HEURISTICS.manhattan.calculate(point, GOAL);
      rows.push({
        key,
        node: coordinateOf(point),
        h1: formatScore(h1),
        h2: formatScore(h2),
        f1: `g(n)+${formatScore(h1)}`,
        f2: `g(n)+${formatScore(h2)}`,
        role: key === keyOf(START) ? "起点 S" : key === keyOf(GOAL) ? "终点 G" : "可通行节点",
      });
    }
  }
  return rows;
}

function GridMap({ snapshot, obstacleSet, compact = false, showAxis = true, showCellCoordinates = false }) {
  const finalPathSet = new Set(snapshot.finalPath);
  const currentPathSet = new Set(snapshot.currentPath);
  const openSet = new Set(snapshot.openKeys);
  const closedSet = new Set(snapshot.closedKeys);
  const generatedSet = new Set(snapshot.generatedKeys);
  const startKey = keyOf(START);
  const goalKey = keyOf(GOAL);
  const cells = [];

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const key = `${x},${y}`;
      const score = snapshot.scores[key];
      const classes = ["astar-cell"];
      if (obstacleSet.has(key)) classes.push("is-wall");
      if (openSet.has(key)) classes.push("is-open");
      if (closedSet.has(key)) classes.push("is-closed");
      if (currentPathSet.has(key)) classes.push("is-current-path");
      if (generatedSet.has(key)) classes.push("is-generated");
      if (finalPathSet.has(key)) classes.push("is-final-path");
      if (snapshot.currentKey === key) classes.push("is-current");
      if (key === startKey) classes.push("is-start");
      if (key === goalKey) classes.push("is-goal");

      let label = "";
      if (key === startKey) label = "S";
      else if (key === goalKey) label = "G";
      else if (obstacleSet.has(key)) label = "";
      else if (snapshot.currentKey === key) label = "●";
      const showCoordinate =
        !compact &&
        (showCellCoordinates || key === startKey || key === goalKey || snapshot.currentKey === key || finalPathSet.has(key));

      cells.push(
        <div
          className={classes.join(" ")}
          key={key}
          title={`${coordinateOf(key)}${score ? ` f=${formatScore(score.f)}` : ""}`}
        >
          {showCoordinate ? <em>{coordinateOf(key)}</em> : null}
          <span>{label}</span>
          {!compact && score && !obstacleSet.has(key) ? <small>{score.f.toFixed(score.f % 1 ? 1 : 0)}</small> : null}
        </div>,
      );
    }
  }

  return (
    <div className={`astar-map-shell ${showAxis ? "has-axis" : ""}`}>
      {showAxis ? (
        <div className="astar-axis-grid" style={{ "--cols": COLS, "--rows": ROWS }}>
          <span className="astar-axis-corner">y/x</span>
          {Array.from({ length: COLS }, (_, x) => (
            <span className="astar-axis-x" key={`x-${x}`} style={{ gridColumn: x + 2, gridRow: 1 }}>
              {x}
            </span>
          ))}
          {Array.from({ length: ROWS }, (_, y) => (
            <span className="astar-axis-y" key={`y-${y}`} style={{ gridColumn: 1, gridRow: y + 2 }}>
              {y}
            </span>
          ))}
        </div>
      ) : null}
      <div className={`astar-grid ${compact ? "is-compact" : ""}`} style={{ "--cols": COLS }}>
        {cells}
      </div>
    </div>
  );
}

function MapLegend() {
  const items = [
    ["is-start", "起点 S"],
    ["is-goal", "终点 G"],
    ["is-wall", "路障"],
    ["is-open", "OPEN 表"],
    ["is-closed", "已扩展"],
    ["is-generated", "新生成"],
    ["is-current", "当前节点"],
    ["is-final-path", "最终路径"],
  ];

  return (
    <div className="astar-legend">
      {items.map(([type, label]) => (
        <span key={type}>
          <i className={type} />
          {label}
        </span>
      ))}
    </div>
  );
}

function formatScore(value) {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(value % 1 ? 1 : 0);
}

function formatNodeScore(node, type) {
  if (!node) return "-";
  if (type === "ucs") {
    return `${coordinateOf(node.key)}（f=g=${formatScore(node.g)}）`;
  }
  return `${coordinateOf(node.key)}（f=${formatScore(node.g)}+${formatScore(node.h)}=${formatScore(node.f)}）`;
}

function ProcessTable({ snapshots, visible }) {
  const mode = snapshots[0]?.mode || "astar";
  const rows = snapshots.slice(1, Math.max(1, visible + 1)).map((snapshot, index) => {
    const current = snapshot.nodes.find((node) => node.id === snapshot.currentNodeId);
    const generated = snapshot.generatedKeys
      .map((key) => {
        const node = snapshot.scores[key];
        return formatNodeScore(node, snapshot.mode);
      })
      .join("、");
    const openText = snapshot.openKeys
      .map((key) => {
        const node = snapshot.scores[key];
        return formatNodeScore(node, snapshot.mode);
      })
      .join("、");

    return {
      key: `${index}-${snapshot.label}`,
      step: index + 1,
      open: openText || "-",
      expanded: formatNodeScore(current, snapshot.mode),
      generated: generated || "-",
      closed: snapshot.closedKeys.map(coordinateOf).join("、") || "-",
    };
  });

  return (
    <div className="astar-process-table-wrap">
      <Table
        className="astar-process-table"
        columns={[
          { title: "步骤", dataIndex: "step", width: 62 },
          { title: mode === "ucs" ? "优先队列（OPEN表，按 g(n)）" : "优先队列（OPEN表，按 f(n)）", dataIndex: "open" },
          { title: "扩展节点", dataIndex: "expanded", width: 150 },
          { title: "生成节点", dataIndex: "generated" },
          { title: "已搜索集合（CLOSED表）", dataIndex: "closed" },
        ]}
        dataSource={rows}
        locale={{ emptyText: "点击播放后，将逐步记录 OPEN 表、扩展节点、生成节点与 CLOSED 表" }}
        pagination={false}
        rowKey="key"
        size="small"
      />
    </div>
  );
}

function SearchTree({ snapshot }) {
  const nodeById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map();
  snapshot.edges.forEach((edge) => {
    if (!childrenByParent.has(edge.from)) childrenByParent.set(edge.from, []);
    childrenByParent.get(edge.from).push(edge.to);
  });
  childrenByParent.forEach((children) => {
    children.sort((a, b) => {
      const nodeA = nodeById.get(a);
      const nodeB = nodeById.get(b);
      return (nodeA?.order ?? 0) - (nodeB?.order ?? 0);
    });
  });

  const nodeWidth = 120;
  const nodeHeight = 68;
  const horizontalGap = 46;
  const verticalGap = 112;
  const marginX = 72;
  const marginY = 62;
  const positioned = new Map();
  let leafCursor = 0;

  const placeNode = (nodeId) => {
    const node = nodeById.get(nodeId);
    if (!node) return 0;
    const children = (childrenByParent.get(nodeId) || []).filter((childId) => nodeById.has(childId));
    let x;
    if (children.length === 0) {
      x = marginX + nodeWidth / 2 + leafCursor * (nodeWidth + horizontalGap);
      leafCursor += 1;
    } else {
      const childCenters = children.map(placeNode);
      x = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
    }
    positioned.set(nodeId, {
      x,
      y: marginY + node.depth * verticalGap,
    });
    return x;
  };

  if (nodeById.has(0)) placeNode(0);
  snapshot.nodes.forEach((node) => {
    if (!positioned.has(node.id)) {
      const x = marginX + nodeWidth / 2 + leafCursor * (nodeWidth + horizontalGap);
      leafCursor += 1;
      positioned.set(node.id, { x, y: marginY + node.depth * verticalGap });
    }
  });

  const maxX = Math.max(...Array.from(positioned.values()).map((pos) => pos.x + nodeWidth / 2), 0);
  const maxWidth = Math.max(920, maxX + marginX);
  const maxDepth = Math.max(0, ...snapshot.nodes.map((node) => node.depth));
  const height = Math.max(360, marginY * 2 + nodeHeight + maxDepth * verticalGap);
  const finalNodeSet = new Set(snapshot.finalPathNodeIds);

  return (
    <div className="astar-tree-scroll">
      <svg className="astar-tree" width={maxWidth} height={height} viewBox={`0 0 ${maxWidth} ${height}`}>
        <defs>
          <linearGradient id="tree-current-gradient" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <marker id="astar-arrow" markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5">
            <path d="M0,0 L7,3.5 L0,7 Z" fill="#98a7a1" />
          </marker>
          <marker id="astar-arrow-hot" markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5">
            <path d="M0,0 L7,3.5 L0,7 Z" fill="#be123c" />
          </marker>
        </defs>
        {snapshot.edges.map((edge) => {
            const from = positioned.get(edge.from);
            const to = positioned.get(edge.to);
            if (!from || !to) return null;
            const hot = finalNodeSet.has(edge.from) && finalNodeSet.has(edge.to);
            const startY = from.y + nodeHeight / 2 - 2;
            const endY = to.y - nodeHeight / 2 + 2;
            const midY = (startY + endY) / 2;
            return (
              <path
                className={hot ? "is-hot" : ""}
                d={`M ${from.x} ${startY} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${endY}`}
                fill="none"
                key={`${edge.from}-${edge.to}`}
                markerEnd={hot ? "url(#astar-arrow-hot)" : "url(#astar-arrow)"}
              />
            );
          })}
        {snapshot.nodes.map((node) => {
          const pos = positioned.get(node.id);
          if (!pos) return null;
          const point = nodeById.get(node.id);
          const classes = ["tree-node"];
          if (snapshot.currentNodeId === node.id) classes.push("is-current");
          if (finalNodeSet.has(node.id)) classes.push("is-path");
          if (node.key === keyOf(START)) classes.push("is-start");
          if (node.key === keyOf(GOAL)) classes.push("is-goal");
          return (
            <g className={classes.join(" ")} key={node.id} transform={`translate(${pos.x - 60},${pos.y - 34})`}>
              <rect height="68" rx="8" width="120" />
              <text className="tree-node-key" x="60" y="17">
                {coordinateOf(point.key)}
              </text>
              <text className="tree-node-score" x="60" y="37">
                {snapshot.mode === "ucs" ? `g=${formatScore(point.g)}  h=0` : `g=${formatScore(point.g)}  h=${formatScore(point.h)}`}
              </text>
              <text className="tree-node-f" x="60" y="55">
                {snapshot.mode === "ucs"
                  ? `f=g+0=${formatScore(point.f)}`
                  : `f=${formatScore(point.g)}+${formatScore(point.h)}=${formatScore(point.f)}`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MetricStrip({ result }) {
  const items = [
    { label: "扩展节点", value: result.metrics.expanded, suffix: "个" },
    { label: "生成节点", value: result.metrics.generated, suffix: "个" },
    { label: "运行时间", value: result.metrics.runtime, suffix: "ms", precision: 3 },
    { label: "路径长度", value: result.metrics.pathLength, suffix: "步" },
  ];

  return (
    <div className="astar-metrics">
      {items.map((item) => (
        <Statistic
          key={item.label}
          title={item.label}
          value={item.value}
          suffix={item.suffix}
          precision={item.precision}
        />
      ))}
    </div>
  );
}

function SearchPlayback({ result, obstacleSet, emphasis = "default" }) {
  const player = useStepPlayer(result.snapshots.length - 1, { intervalMs: 720, autoStart: false });
  const snapshot = result.snapshots[player.visible] || result.snapshots[0];

  return (
    <section className={`astar-workbench is-${emphasis}`}>
      <div className="astar-play-head">
        <div>
          <Tag color={result.tone}>{result.name}</Tag>
          <h3>{snapshot.label}</h3>
          <p>{snapshot.detail}</p>
        </div>
        <MetricStrip result={result} />
      </div>
      <StepPlayerBar player={player} label="搜索过程" tone={result.tone} />
      <div className="astar-live-layout">
        <div className="astar-live-map">
          <GridMap snapshot={snapshot} obstacleSet={obstacleSet} />
          <MapLegend />
        </div>
        <div className="astar-live-tree">
          <div className="astar-tree-head">
            <BranchesOutlined />
            <div>
              <strong>同步生成搜索树</strong>
              <span>每个树节点标注对应状态与 f(n) 值，红色链路为最终回溯路径。</span>
            </div>
          </div>
          <SearchTree snapshot={snapshot} />
        </div>
      </div>
      <div className="astar-process-panel">
        <div className="astar-tree-head">
          <FieldTimeOutlined />
          <div>
            <strong>搜索步骤表：OPEN / CLOSED</strong>
            <span>按优先队列、扩展节点、生成节点和已搜索集合记录每一步搜索状态。</span>
          </div>
        </div>
        <ProcessTable snapshots={result.snapshots} visible={player.visible} />
      </div>
    </section>
  );
}

function HeuristicValueTable({ obstacleSet }) {
  const rows = useMemo(() => buildHeuristicValueRows(obstacleSet), [obstacleSet]);

  return (
    <Table
      className="astar-table astar-heuristic-table"
      columns={[
        { title: "节点坐标", dataIndex: "node", width: 110, fixed: "left" },
        { title: "节点类型", dataIndex: "role", width: 110 },
        { title: "h1 欧氏距离", dataIndex: "h1", width: 120 },
        { title: "h2 曼哈顿距离", dataIndex: "h2", width: 130 },
        { title: "f1(n)=g(n)+h1(n)", dataIndex: "f1", width: 170 },
        { title: "f2(n)=g(n)+h2(n)", dataIndex: "f2", width: 170 },
      ]}
      dataSource={rows}
      pagination={{ pageSize: 12, showSizeChanger: false }}
      rowKey="key"
      scroll={{ x: 820 }}
      size="middle"
    />
  );
}

function IntroPage({ results, obstacleSet, regenerate, resetDesigned, goHeuristics }) {
  const initialSnapshot = results.astarEuclidean.snapshots[0];
  const formulas = [HEURISTICS.euclidean, HEURISTICS.manhattan];

  return (
    <div className="astar-tab-panel">
      <section className="astar-hero">
        <div className="astar-hero-copy">
          <Tag className="astar-hero-tag" icon={<CompassOutlined />}>
            第五部分 · A* 搜索
          </Tag>
          <Title level={1}>基于长方形栅格地图的迷宫最短路径搜索</Title>
          <Paragraph>
            地图规模为 {COLS}×{ROWS}，从左上区域的 S 出发，到右下区域的 G
            为目标；黑色方格为路障，只允许上下左右四方向移动，每一步代价为 1。
          </Paragraph>
          <Space wrap>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={goHeuristics}>
              查看动态搜索
            </Button>
            <Button icon={<ReloadOutlined />} onClick={regenerate}>
              随机生成路障
            </Button>
            <Button icon={<BorderOutlined />} onClick={resetDesigned}>
              恢复设计地图
            </Button>
          </Space>
        </div>
        <div className="astar-hero-map">
          <GridMap snapshot={initialSnapshot} obstacleSet={obstacleSet} />
          <MapLegend />
        </div>
      </section>

      <section className="astar-section">
        <header className="astar-section-head">
          <span>
            <AimOutlined />
          </span>
          <div>
            <h2>问题建模与评估函数</h2>
            <p>代价 g(n) 表示从起点走到 n 的实际代价，h(n) 表示 n 到目标的估计代价。A* 使用 f(n)=g(n)+h(n) 在 OPEN 表中选择 f 最小的边缘节点。</p>
          </div>
        </header>
        <div className="astar-formula-grid">
          {formulas.map((item) => (
            <article key={item.key} style={{ "--tone": item.tone }}>
              <div className="formula-icon">
                <RocketOutlined />
              </div>
              <div>
                <strong>{item.name}</strong>
                <code>{item.formula}</code>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="astar-section">
        <header className="astar-section-head">
          <span>
            <NodeIndexOutlined />
          </span>
          <div>
            <h2>状态空间与地图参数</h2>
            <p>同一张地图会被用于两种启发函数和一致代价搜索 UCS 对比，保证初始状态与目标状态完全一致。</p>
          </div>
        </header>
        <div className="astar-state-grid">
          <article>
            <FlagOutlined />
            <strong>S = {coordinateOf(START)}</strong>
            <span>初始状态</span>
          </article>
          <article>
            <AimOutlined />
            <strong>G = {coordinateOf(GOAL)}</strong>
            <span>目标状态</span>
          </article>
          <article>
            <BorderOutlined />
            <strong>{obstacleSet.size}</strong>
            <span>路障数量</span>
          </article>
          <article>
            <ForkOutlined />
            <strong>4</strong>
            <span>每个状态最多后继</span>
          </article>
        </div>
      </section>

      <section className="astar-section">
        <header className="astar-section-head">
          <span>
            <BarChartOutlined />
          </span>
          <div>
            <h2>当前地图各节点 h1 / h2 启发值表</h2>
            <p>随机生成或恢复地图后，本表会按相同的起点与目标重新计算所有可通行节点的 h1、h2，并给出对应评价函数形式 f(n)=g(n)+h(n)。</p>
          </div>
        </header>
        <HeuristicValueTable obstacleSet={obstacleSet} />
      </section>
    </div>
  );
}

function HeuristicComparePage({ results, obstacleSet }) {
  const rows = [results.astarEuclidean, results.astarManhattan].map((result) => ({
    key: result.key,
    name: result.name,
    formula: result.formula,
    expanded: result.metrics.expanded,
    generated: result.metrics.generated,
    runtime: `${result.metrics.runtime} ms`,
    pathLength: result.metrics.pathLength,
  }));

  return (
    <div className="astar-tab-panel" id="astar-compare-heuristics">
      <section className="astar-section">
        <header className="astar-section-head">
          <span>
            <SearchOutlined />
          </span>
          <div>
            <h2>两种启发函数下的 A* 动态搜索</h2>
            <p>OPEN 表保存待扩展的边缘节点，CLOSED 表保存已扩展节点。下面分别展示 h1 与 h2 两套搜索过程，每一步都按 f(n)=g(n)+h(n) 选择 f 最小的节点。</p>
          </div>
        </header>
        <div className="astar-dual-search">
          <SearchPlayback result={results.astarEuclidean} obstacleSet={obstacleSet} />
          <SearchPlayback result={results.astarManhattan} obstacleSet={obstacleSet} />
        </div>
      </section>

      <section className="astar-section">
        <header className="astar-section-head">
          <span>
            <BarChartOutlined />
          </span>
          <div>
            <h2>启发函数信息性对比</h2>
            <p>在可采纳前提下，h(n) 越接近真实最小代价 h*(n)，携带的方向信息越充分，A* 扩展节点通常越少。</p>
          </div>
        </header>
        <div className="astar-chart-grid">
          <ReactECharts className="astar-chart" option={buildMetricChart([results.astarEuclidean, results.astarManhattan])} />
          <ReactECharts className="astar-chart" option={buildRuntimeChart([results.astarEuclidean, results.astarManhattan])} />
        </div>
        <Table
          className="astar-table"
          dataSource={rows}
          pagination={false}
          rowKey="key"
          size="middle"
          columns={[
            { title: "算法", dataIndex: "name" },
            { title: "评估函数", dataIndex: "formula" },
            { title: "扩展节点数", dataIndex: "expanded" },
            { title: "生成节点数", dataIndex: "generated" },
            { title: "运行时间", dataIndex: "runtime" },
            { title: "路径长度", dataIndex: "pathLength" },
          ]}
        />
        <div className="astar-analysis">
          <LineChartOutlined />
          <p>
            在四方向栅格寻路中，曼哈顿距离 h2(n) 通常不小于欧氏距离 h1(n)，且仍不超过真实最小路径代价，因此 h2
            更具有信息性。若 h2 的扩展节点少于 h1，说明启发函数越接近 h*(n)，搜索方向越集中，效率越高。
          </p>
        </div>
      </section>
    </div>
  );
}

function BlindComparePage({ results, obstacleSet }) {
  const orderedResults = [results.astarEuclidean, results.astarManhattan, results.ucs];
  const optimalLength = Math.min(...orderedResults.filter((result) => result.metrics.found).map((result) => result.metrics.pathLength));
  const rows = orderedResults.map((result) => ({
    key: result.shortName,
    name: RUN_LABELS[result.key === "euclidean" ? "astarEuclidean" : result.key === "manhattan" ? "astarManhattan" : "ucs"],
    expanded: result.metrics.expanded,
    generated: result.metrics.generated,
    runtime: `${result.metrics.runtime} ms`,
    pathLength: result.metrics.pathLength,
    found: result.metrics.found ? "找到路径" : "未找到",
    optimal: result.metrics.found && result.metrics.pathLength === optimalLength ? "是" : "否",
  }));

  return (
    <div className="astar-tab-panel">
      <section className="astar-section">
        <header className="astar-section-head">
          <span>
            <FieldTimeOutlined />
          </span>
          <div>
            <h2>A* 与一致代价搜索 UCS 性能对比</h2>
            <p>本页主动态演示 UCS：它等价于 A* 在 h(n)=0 时的特殊情况，OPEN 表按 g(n) 从小到大弹出节点，不使用目标方向启发信息。</p>
          </div>
          <Tag className="astar-page-badge" color={results.ucs.tone}>当前动态演示：UCS</Tag>
        </header>
        <SearchPlayback result={results.ucs} obstacleSet={obstacleSet} emphasis="ucs" />
      </section>

      <section className="astar-section">
        <header className="astar-section-head">
          <span>
            <BarChartOutlined />
          </span>
          <div>
            <h2>综合结果图表</h2>
            <p>三种算法使用相同地图、相同起点和终点，统计扩展节点数、生成节点数、运行时间和路径长度。</p>
          </div>
        </header>
        <div className="astar-chart-grid">
          <ReactECharts className="astar-chart" option={buildMetricChart(orderedResults)} />
          <ReactECharts className="astar-chart" option={buildRuntimeChart(orderedResults)} />
        </div>
        <Table
          className="astar-table"
          dataSource={rows}
          pagination={false}
          rowKey="key"
          size="middle"
          columns={[
            { title: "算法", dataIndex: "name" },
            { title: "扩展节点数", dataIndex: "expanded" },
            { title: "生成节点数", dataIndex: "generated" },
            { title: "运行时间", dataIndex: "runtime" },
            { title: "路径长度", dataIndex: "pathLength" },
            {
              title: "结果",
              dataIndex: "found",
              render: (value) => (
                <Tag className={`astar-result-tag ${value === "找到路径" ? "is-found" : "is-warn"}`}>
                  {value === "找到路径" ? <CheckCircleOutlined /> : <AimOutlined />}
                  {value}
                </Tag>
              ),
            },
            {
              title: "是否最优解",
              dataIndex: "optimal",
              render: (value) => (
                <Tag className={`astar-result-tag ${value === "是" ? "is-best" : "is-warn"}`}>
                  {value === "是" ? <CheckCircleOutlined /> : <AimOutlined />}
                  {value}
                </Tag>
              ),
            },
          ]}
        />
        <div className="astar-analysis is-strong">
          <LineChartOutlined />
          <p>
            对比可以看到，UCS 只按 g(n) 从小到大扩展，属于不利用启发信息的代价搜索；A* 在 g(n) 的基础上加入 h(n)，能更早把搜索方向指向目标。
            当 h(n) 满足可采纳性与一致性时，图搜索仍能保持最优性。
          </p>
        </div>
        <div className="astar-check-grid">
          <article style={{ "--tone": "#2563eb" }}>
            <FieldTimeOutlined />
            <strong>UCS 动态演示</strong>
            <span>本页上方播放的是 UCS，令 h(n)=0，因此 f(n)=g(n)+0，OPEN 表按 g(n) 最小优先。</span>
          </article>
          <article style={{ "--tone": "#0f766e" }}>
            <SearchOutlined />
            <strong>A* 对比口径</strong>
            <span>A* h1 / h2 使用同一张地图、同一起点和终点，按 f(n)=g(n)+h(n) 弹出节点。</span>
          </article>
          <article style={{ "--tone": "#be123c" }}>
            <AimOutlined />
            <strong>最短路径回溯</strong>
            <span>目标节点从 OPEN 表弹出后，沿父指针回溯并高亮红色路径，统计扩展节点、生成节点与运行时间。</span>
          </article>
        </div>
      </section>
    </div>
  );
}

function AnalysisPage({ results }) {
  const orderedResults = [results.astarEuclidean, results.astarManhattan, results.ucs];
  const optimalLength = Math.min(...orderedResults.filter((result) => result.metrics.found).map((result) => result.metrics.pathLength));
  const rows = orderedResults.map((result) => ({
    key: result.shortName,
    name: RUN_LABELS[result.key === "euclidean" ? "astarEuclidean" : result.key === "manhattan" ? "astarManhattan" : "ucs"],
    formula: result.formula,
    expanded: result.metrics.expanded,
    generated: result.metrics.generated,
    runtime: `${result.metrics.runtime} ms`,
    pathLength: result.metrics.pathLength,
    found: result.metrics.found ? "找到路径" : "未找到",
    optimal: result.metrics.found && result.metrics.pathLength === optimalLength ? "是" : "否",
  }));

  return (
    <div className="astar-tab-panel">
      <section className="astar-section">
        <header className="astar-section-head">
          <span>
            <BarChartOutlined />
          </span>
          <div>
            <h2>结果图表与性能分析</h2>
            <p>汇总两种 A* 启发函数与 UCS 的运行结果，重点比较扩展节点数、生成节点数、运行时间和路径长度。</p>
          </div>
        </header>
        <div className="astar-chart-grid">
          <ReactECharts className="astar-chart" option={buildMetricChart(orderedResults)} />
          <ReactECharts className="astar-chart" option={buildRuntimeChart(orderedResults)} />
        </div>
        <Table
          className="astar-table"
          dataSource={rows}
          pagination={false}
          rowKey="key"
          size="middle"
          columns={[
            { title: "算法", dataIndex: "name" },
            { title: "评价函数", dataIndex: "formula" },
            { title: "扩展节点数", dataIndex: "expanded" },
            { title: "生成节点数", dataIndex: "generated" },
            { title: "运行时间", dataIndex: "runtime" },
            { title: "路径长度", dataIndex: "pathLength" },
            {
              title: "结果",
              dataIndex: "found",
              render: (value) => (
                <Tag className={`astar-result-tag ${value === "找到路径" ? "is-found" : "is-warn"}`}>
                  {value === "找到路径" ? <CheckCircleOutlined /> : <AimOutlined />}
                  {value}
                </Tag>
              ),
            },
            {
              title: "是否最优解",
              dataIndex: "optimal",
              render: (value) => (
                <Tag className={`astar-result-tag ${value === "是" ? "is-best" : "is-warn"}`}>
                  {value === "是" ? <TrophyOutlined /> : <AimOutlined />}
                  {value}
                </Tag>
              ),
            },
          ]}
        />
      </section>

      <section className="astar-section">
        <header className="astar-section-head">
          <span>
            <LineChartOutlined />
          </span>
          <div>
            <h2>结论分析</h2>
            <p>从评价函数、启发函数性质和搜索效率三个角度归纳本实验结果。</p>
          </div>
        </header>
        <div className="astar-analysis-list">
          <article>
            <strong>1. A* 的评价函数</strong>
            <p>A* 按 f(n)=g(n)+h(n) 选择 OPEN 表中的节点，既考虑已经付出的代价，也考虑到目标的估计代价。</p>
          </article>
          <article>
            <strong>2. 信息性对扩展节点的影响</strong>
            <p>在本四方向地图中，曼哈顿距离比欧氏距离更贴近真实剩余代价，因此 A* h2 的扩展节点数少于 A* h1。</p>
          </article>
          <article>
            <strong>3. UCS 是 A* 的特殊情况</strong>
            <p>UCS 等价于 h(n)=0 的 A*，只按 g(n) 扩展，能找到最短路径，但会搜索更多与目标方向无关的节点。</p>
          </article>
          <article>
            <strong>4. 最优性条件</strong>
            <p>欧氏距离和曼哈顿距离都不高估四方向栅格的真实最短代价，满足可采纳性；曼哈顿距离在该场景下也满足一致性，因此图搜索结果保持最优。</p>
          </article>
        </div>
      </section>
    </div>
  );
}

export default function AStarPathfinding() {
  const navigate = useNavigate();
  const location = useLocation();
  const [obstacles, setObstacles] = useState(loadInitialObstacles);
  const obstacleSet = useMemo(() => toObstacleSet(obstacles), [obstacles]);

  useEffect(() => {
    window.localStorage.setItem(ASTAR_OBSTACLE_STORAGE_KEY, JSON.stringify(obstacles));
  }, [obstacles]);

  const results = useMemo(() => {
    const astarEuclidean = runSearch({ type: "astar", heuristic: HEURISTICS.euclidean, obstacleSet });
    const astarManhattan = runSearch({ type: "astar", heuristic: HEURISTICS.manhattan, obstacleSet });
    const ucs = runSearch({ type: "ucs", heuristic: HEURISTICS.euclidean, obstacleSet });
    return { astarEuclidean, astarManhattan, ucs };
  }, [obstacleSet]);

  const regenerate = () => {
    setObstacles(normalizeObstacles(createRandomObstacles(Date.now() % 100000)));
  };

  const resetDesigned = () => {
    setObstacles(DESIGNED_OBSTACLES);
  };

  const page = (() => {
    if (location.pathname.endsWith("/heuristics")) return "heuristics";
    if (location.pathname.endsWith("/ucs")) return "ucs";
    if (location.pathname.endsWith("/analysis")) return "analysis";
    return "map";
  })();

  return (
    <main className="page-shell astar-page">
      {page === "map" ? (
        <IntroPage
          results={results}
          obstacleSet={obstacleSet}
          regenerate={regenerate}
          resetDesigned={resetDesigned}
          goHeuristics={() => navigate("/search/astar/heuristics")}
        />
      ) : null}
      {page === "heuristics" ? <HeuristicComparePage results={results} obstacleSet={obstacleSet} /> : null}
      {page === "ucs" ? <BlindComparePage results={results} obstacleSet={obstacleSet} /> : null}
      {page === "analysis" ? <AnalysisPage results={results} /> : null}
    </main>
  );
}
