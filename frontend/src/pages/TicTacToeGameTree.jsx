import { useCallback, useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Statistic, Switch, Table, Tag, Typography } from "antd";
import {
  BranchesOutlined,
  FieldTimeOutlined,
  FireOutlined,
  MinusOutlined,
  NodeIndexOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  ScissorOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import StepPlayerBar from "../components/StepPlayerBar.jsx";
import { useStepPlayer } from "../hooks/useStepPlayer.js";
import "../styles/game-tree.css";

const { Paragraph, Title } = Typography;

const HUMAN = "X";
const AI = "O";
const EMPTY_BOARD = Array(9).fill(null);
const MIN_DEPTH = 1;
const MAX_DEPTH = 6;
const MOVE_NAMES = ["左上", "上中", "右上", "左中", "中心", "右中", "左下", "下中", "右下"];
const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
const CASE_START_BOARD = Array(9).fill(null);
const CASE_HUMAN_SEQUENCE = [0, 4, 8, 6, 3, 7, 1, 5, 2];
const START_ROUND_KEY = "game-tree-tictactoe-start-round";

function other(player) {
  return player === HUMAN ? AI : HUMAN;
}

function role(player) {
  return player === AI ? "AI / MAX" : "玩家 / MIN";
}

function getAvailableMoves(board) {
  return board.map((cell, index) => (cell ? null : index)).filter((index) => index !== null);
}

function applyMove(board, move, player) {
  const next = [...board];
  next[move] = player;
  return next;
}

function getWinner(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  if (getAvailableMoves(board).length === 0) return { winner: "draw", line: [] };
  return { winner: null, line: [] };
}

function getTurn(board, firstPlayer) {
  const moves = board.filter(Boolean).length;
  return moves % 2 === 0 ? firstPlayer : other(firstPlayer);
}

function terminalValue(board) {
  const { winner } = getWinner(board);
  if (winner === AI) return 100;
  if (winner === HUMAN) return -100;
  if (winner === "draw") return 0;
  return null;
}

function lineScore(cells) {
  const aiCount = cells.filter((cell) => cell === AI).length;
  const humanCount = cells.filter((cell) => cell === HUMAN).length;
  const emptyCount = cells.filter((cell) => !cell).length;
  if (aiCount && humanCount) return 0;
  if (aiCount === 2 && emptyCount === 1) return 42;
  if (humanCount === 2 && emptyCount === 1) return -46;
  if (aiCount === 1 && emptyCount === 2) return 8;
  if (humanCount === 1 && emptyCount === 2) return -9;
  return 0;
}

function evaluateBoard(board) {
  const terminal = terminalValue(board);
  if (terminal !== null) return terminal;

  let score = 0;
  for (const line of WIN_LINES) {
    score += lineScore(line.map((index) => board[index]));
  }

  if (board[4] === AI) score += 15;
  if (board[4] === HUMAN) score -= 15;

  [0, 2, 6, 8].forEach((index) => {
    if (board[index] === AI) score += 5;
    if (board[index] === HUMAN) score -= 5;
  });

  [1, 3, 5, 7].forEach((index) => {
    if (board[index] === AI) score += 2;
    if (board[index] === HUMAN) score -= 2;
  });

  return score;
}

function formatScore(value) {
  if (value === Infinity) return "+∞";
  if (value === -Infinity) return "-∞";
  if (value === null || value === undefined) return "...";
  return String(Math.round(value));
}

function describeResult(board) {
  const { winner } = getWinner(board);
  if (winner === AI) return "AI 获胜";
  if (winner === HUMAN) return "玩家获胜";
  if (winner === "draw") return "平局";
  return "对局进行中";
}

function resultTone(board) {
  const { winner } = getWinner(board);
  if (winner === AI) return "ai";
  if (winner === HUMAN) return "human";
  if (winner === "draw") return "draw";
  return "live";
}

function runMinimaxSearch({ board, player, depthLimit, useAlphaBeta }) {
  let nextId = 0;
  let order = 0;
  const nodes = [];
  const edges = [];
  const events = [];
  const rootMoves = [];
  const stats = {
    expanded: 0,
    generated: 0,
    leaves: 0,
    pruned: 0,
    cutoffs: 0,
  };

  const record = (type, nodeId, text, extra = {}) => {
    const event = { order, type, nodeId, text, ...extra };
    order += 1;
    events.push(event);
    return event.order;
  };

  const createNode = ({ parentId, state, currentPlayer, move, depth, createdAt, pruned = false }) => {
    const id = nextId;
    nextId += 1;
    if (!pruned) stats.generated += 1;
    nodes.push({
      id,
      parentId,
      board: [...state],
      player: currentPlayer,
      move,
      depth,
      value: null,
      alpha: null,
      beta: null,
      bestChildId: null,
      createdAt,
      evaluatedAt: null,
      prunedAt: pruned ? createdAt : null,
      terminal: "",
    });
    if (parentId !== null) edges.push({ from: parentId, to: id, pruned });
    return id;
  };

  const patchNode = (id, patch) => {
    Object.assign(nodes[id], patch);
  };

  const search = (nodeId, state, currentPlayer, depth, alpha, beta) => {
    stats.expanded += 1;
    patchNode(nodeId, { alpha, beta });
    record(
      "expand",
      nodeId,
      `展开 N${nodeId}：${role(currentPlayer)} 层，α=${formatScore(alpha)}，β=${formatScore(beta)}`,
    );

    const terminal = terminalValue(state);
    if (terminal !== null || depth >= depthLimit) {
      const value = terminal !== null ? terminal : evaluateBoard(state);
      const terminalText =
        terminal !== null ? `${describeResult(state)}，直接返回 utility=${formatScore(value)}` : `达到深度 ${depthLimit}，调用启发函数 evaluateBoard=${formatScore(value)}`;
      stats.leaves += 1;
      const evaluatedAt = record("evaluate", nodeId, terminalText, { value });
      patchNode(nodeId, { value, evaluatedAt, terminal: terminalText });
      return value;
    }

    const moves = getAvailableMoves(state);
    let bestValue = currentPlayer === AI ? -Infinity : Infinity;
    let bestMove = null;
    let bestChildId = null;

    for (let index = 0; index < moves.length; index += 1) {
      const move = moves[index];
      const childState = applyMove(state, move, currentPlayer);
      const childPlayer = other(currentPlayer);
      const childId = nextId;
      const createdAt = record(
        "generate",
        childId,
        `${role(currentPlayer)} 试下 ${MOVE_NAMES[move]}，生成 N${childId}`,
        { move },
      );
      createNode({ parentId: nodeId, state: childState, currentPlayer: childPlayer, move, depth: depth + 1, createdAt });
      const childValue = search(childId, childState, childPlayer, depth + 1, alpha, beta);

      const isBetter = currentPlayer === AI ? childValue > bestValue : childValue < bestValue;
      if (bestMove === null || isBetter) {
        bestValue = childValue;
        bestMove = move;
        bestChildId = childId;
      }

      if (currentPlayer === AI) alpha = Math.max(alpha, bestValue);
      else beta = Math.min(beta, bestValue);

      const evaluatedAt = record(
        "backup",
        nodeId,
        `${role(currentPlayer)} 回传 N${childId} 的 f(n)=${formatScore(childValue)}，当前最好走 ${MOVE_NAMES[bestMove]}，N${nodeId}=${formatScore(bestValue)}`,
        { value: bestValue },
      );
      patchNode(nodeId, { value: bestValue, alpha, beta, bestChildId, evaluatedAt });

      if (depth === 0) rootMoves.push({ move, value: childValue, childId, board: childState });

      if (useAlphaBeta && alpha > beta && index < moves.length - 1) {
        const remaining = moves.slice(index + 1);
        stats.cutoffs += 1;
        const prunedAt = record(
          "prune",
          nodeId,
          `α>β（${formatScore(alpha)}>${formatScore(beta)}），剪去 ${remaining.length} 个后续分支`,
          { alpha, beta },
        );
        remaining.forEach((restMove) => {
          const prunedState = applyMove(state, restMove, currentPlayer);
          const prunedId = createNode({
            parentId: nodeId,
            state: prunedState,
            currentPlayer: childPlayer,
            move: restMove,
            depth: depth + 1,
            createdAt: prunedAt,
            pruned: true,
          });
          stats.pruned += 1;
          patchNode(prunedId, { value: null, terminal: "被 α-β 剪枝" });
        });
        break;
      }
    }

    record("return", nodeId, `N${nodeId} 搜索完成，返回 f(n)=${formatScore(bestValue)}`);
    return bestValue;
  };

  const start = record(
    "start",
    0,
    `以当前棋盘为 Root，AI 使用 ${useAlphaBeta ? "α-β 剪枝" : "最大最小搜索"}，搜索深度=${depthLimit}`,
  );
  createNode({ parentId: null, state: board, currentPlayer: player, move: null, depth: 0, createdAt: start });
  const value = search(0, board, player, 0, -Infinity, Infinity);

  const best = rootMoves.reduce((currentBest, candidate) => {
    if (!currentBest) return candidate;
    return candidate.value > currentBest.value ? candidate : currentBest;
  }, null);

  return {
    value,
    bestMove: best?.move ?? null,
    rootMoves,
    nodes,
    edges,
    events,
    stats,
  };
}

function MiniBoard({ board, winLine = [] }) {
  const winSet = new Set(winLine);
  return (
    <div className="gt-mini-board">
      {board.map((cell, index) => (
        <span className={winSet.has(index) ? "is-win" : ""} key={index}>
          {cell || ""}
        </span>
      ))}
    </div>
  );
}

function Board({ board, turn, disabled, suggestedMove, onMove }) {
  const { line } = getWinner(board);
  const winSet = new Set(line);

  return (
    <div className="gt-board-shell">
      <div className="gt-board-grid">
        {board.map((cell, index) => (
          <button
            className={[
              "gt-board-cell",
              cell === HUMAN ? "is-human" : "",
              cell === AI ? "is-ai" : "",
              winSet.has(index) ? "is-win" : "",
              suggestedMove === index && !cell ? "is-suggested" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={disabled || Boolean(cell)}
            key={index}
            onClick={() => onMove(index)}
            type="button"
          >
            <span>{cell || ""}</span>
          </button>
        ))}
      </div>
      <div className="gt-coordinate-row">
        {MOVE_NAMES.map((name, index) => (
          <span key={name}>
            {index + 1}. {name}
          </span>
        ))}
      </div>
      <Tag className={`gt-turn-pill is-${turn === AI ? "ai" : "human"}`}>
        {turn === AI ? "AI 思考 / MAX" : "玩家落子 / MIN"}
      </Tag>
    </div>
  );
}

function ScoreBadge({ value }) {
  const tone = value > 0 ? "ai" : value < 0 ? "human" : "draw";
  return <Tag className={`gt-score-badge is-${tone}`}>f(n)={formatScore(value)}</Tag>;
}

function SearchTree({ search, visible }) {
  const event = search.events[Math.min(visible, search.events.length - 1)] || search.events[0];
  const visibleOrder = event?.order ?? 0;
  const visibleNodes = search.nodes.filter((node) => node.createdAt <= visibleOrder || (node.prunedAt !== null && node.prunedAt <= visibleOrder));
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const visibleNodeMap = new Map(visibleNodes.map((node) => [node.id, node]));
  const childrenByParent = new Map();
  search.edges.forEach((edge) => {
    if (!visibleIds.has(edge.from) || !visibleIds.has(edge.to)) return;
    if (!childrenByParent.has(edge.from)) childrenByParent.set(edge.from, []);
    childrenByParent.get(edge.from).push(edge.to);
  });
  const positions = new Map();
  const nodeGap = 38;
  const nodeWidth = 124;
  const nodeHeight = 108;
  const levelGap = 92;
  const margin = 54;

  const layout = (nodeId, left) => {
    const childIds = childrenByParent.get(nodeId) || [];
    const node = visibleNodeMap.get(nodeId);
    const childLayouts = [];
    let cursorX = left;

    childIds.forEach((childId) => {
      const childLayout = layout(childId, cursorX);
      childLayouts.push(childLayout);
      cursorX += childLayout.width + nodeGap;
    });

    const subtreeWidth = childLayouts.length
      ? childLayouts.reduce((sum, item) => sum + item.width, 0) + nodeGap * (childLayouts.length - 1)
      : nodeWidth;
    const x = childLayouts.length
      ? (childLayouts[0].center + childLayouts[childLayouts.length - 1].center) / 2
      : left + nodeWidth / 2;
    positions.set(nodeId, {
      x,
      y: margin + (node?.depth || 0) * (nodeHeight + levelGap) + nodeHeight / 2,
    });
    return { center: x, width: Math.max(subtreeWidth, nodeWidth) };
  };

  const rootLayout = visibleIds.has(0) ? layout(0, margin) : { width: 900 };
  const minX = Math.min(...Array.from(positions.values()).map((pos) => pos.x - nodeWidth / 2), margin);
  if (minX < margin) {
    const offset = margin - minX;
    positions.forEach((pos) => {
      pos.x += offset;
    });
  }
  const maxX = Math.max(...Array.from(positions.values()).map((pos) => pos.x + nodeWidth / 2), margin + rootLayout.width);
  const width = Math.max(980, maxX + margin);
  const height = Math.max(420, margin * 2 + (Math.max(0, ...visibleNodes.map((node) => node.depth)) + 1) * nodeHeight + Math.max(0, ...visibleNodes.map((node) => node.depth)) * levelGap);
  const bestPath = new Set();
  let cursor = search.nodes[0];
  while (cursor?.bestChildId !== null && cursor?.bestChildId !== undefined) {
    bestPath.add(cursor.id);
    bestPath.add(cursor.bestChildId);
    cursor = search.nodes[cursor.bestChildId];
  }

  return (
    <div className="gt-tree-canvas">
      <svg height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
        <defs>
          <linearGradient id="gtBestEdge" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="gtNormalEdge" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
        </defs>
        {search.edges
          .filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to))
          .map((edge) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;
            const midY = (from.y + to.y) / 2;
            return (
              <path
                className={`${bestPath.has(edge.from) && bestPath.has(edge.to) ? "is-best" : ""} ${edge.pruned ? "is-pruned" : ""}`}
                d={`M ${from.x} ${from.y + nodeHeight / 2 - 8} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y - nodeHeight / 2 + 8}`}
                fill="none"
                key={`${edge.from}-${edge.to}`}
              />
            );
          })}
        {visibleNodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const active = event?.nodeId === node.id;
          const valueVisible = node.evaluatedAt !== null && node.evaluatedAt <= visibleOrder;
          const pruned = node.prunedAt !== null && node.prunedAt <= visibleOrder;
          return (
            <foreignObject height={nodeHeight} key={node.id} width={nodeWidth} x={pos.x - nodeWidth / 2} y={pos.y - nodeHeight / 2}>
              <div
                className={[
                  "gt-tree-node",
                  node.player === AI ? "is-ai" : "is-human",
                  active ? "is-active" : "",
                  bestPath.has(node.id) ? "is-best" : "",
                  pruned ? "is-pruned" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="gt-tree-node-top">
                  <span>N{node.id}</span>
                  <b>{node.player === AI ? "MAX" : "MIN"}</b>
                </div>
                <MiniBoard board={node.board} />
                <div className="gt-tree-node-score">
                  <span>{pruned ? "剪枝" : valueVisible ? `f=${formatScore(node.value)}` : "待算"}</span>
                </div>
              </div>
            </foreignObject>
          );
        })}
      </svg>
    </div>
  );
}

function SearchProcess({ search, useAlphaBeta }) {
  const player = useStepPlayer(Math.max(0, search.events.length - 1), { intervalMs: 650, autoStart: true });
  const event = search.events[player.visible] || search.events[0];
  const rows = search.rootMoves.map((item, index) => ({
    key: item.move,
    order: index + 1,
    move: MOVE_NAMES[item.move],
    board: item.board,
    value: item.value,
    best: item.move === search.bestMove,
  }));

  return (
    <section className="gt-search-panel">
      <header className="gt-section-title">
        <span>{useAlphaBeta ? <ScissorOutlined /> : <BranchesOutlined />}</span>
        <div>
          <h2>{useAlphaBeta ? "α-β 剪枝搜索过程" : "最大最小搜索过程"}</h2>
          <p>{event?.text}</p>
        </div>
      </header>
      <StepPlayerBar label="搜索树生成过程" player={player} tone={useAlphaBeta ? "#8b5cf6" : "#0f766e"} />
      <div className="gt-search-grid">
        <SearchTree search={search} visible={player.visible} />
        <aside className="gt-log-panel">
          <strong>过程日志</strong>
          {search.events.slice(0, player.visible + 1).slice(-12).map((item) => (
            <article className={`is-${item.type}`} key={item.order}>
              <span>{String(item.order).padStart(2, "0")}</span>
              <p>{item.text}</p>
            </article>
          ))}
        </aside>
      </div>
      <Table
        className="gt-candidate-table"
        columns={[
          { title: "顺序", dataIndex: "order", width: 72 },
          { title: "AI 候选落子", dataIndex: "move", width: 130 },
          { title: "后继棋盘", dataIndex: "board", width: 130, render: (board) => <MiniBoard board={board} /> },
          { title: "评价值 f(n)", dataIndex: "value", width: 130, render: (value) => <ScoreBadge value={value} /> },
          { title: "是否选择", dataIndex: "best", render: (best) => (best ? <Tag color="green">AI 下一步</Tag> : <Tag>备选</Tag>) },
        ]}
        dataSource={rows}
        pagination={false}
        rowClassName={(row) => (row.best ? "is-best-row" : "")}
        rowKey="key"
        size="small"
      />
    </section>
  );
}

function readStartRound() {
  if (typeof window === "undefined") return 0;
  const value = Number(window.localStorage.getItem(START_ROUND_KEY));
  return Number.isFinite(value) ? value : 0;
}

function WaitingSearchPanel({ board, gameDone, turn }) {
  return (
    <section className="gt-search-panel gt-waiting-panel">
      <header className="gt-section-title">
        <span>
          <FieldTimeOutlined />
        </span>
        <div>
          <h2>{gameDone ? "本局已经结束" : turn === HUMAN ? "等待玩家落子" : "准备生成 AI 搜索树"}</h2>
          <p>只有轮到 AI 行动时，页面才会以当前棋盘为 Root 动态展开博弈树，并在每个节点标出评价值 f(n)。</p>
        </div>
      </header>
      <div className="gt-waiting-body">
        <MiniBoard board={board} winLine={getWinner(board).line} />
        <div>
          <strong>{describeResult(board)}</strong>
          <p>你落子以后，AI 会按当前深度重新构建搜索树；第二页会同时显示 α、β 边界和被剪掉的分支。</p>
        </div>
      </div>
    </section>
  );
}

function PanelTitle({ number, title, subtitle }) {
  return (
    <div className="gt-panel-title">
      <span>{number}</span>
      <div>
        <strong>{title}</strong>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function GameWorkbench({ useAlphaBeta }) {
  const [, setStartRound] = useState(() => readStartRound());
  const [firstPlayer, setFirstPlayer] = useState(() => (readStartRound() % 2 === 0 ? HUMAN : AI));
  const [board, setBoard] = useState(() => [...EMPTY_BOARD]);
  const [history, setHistory] = useState([]);
  const [depth, setDepth] = useState(useAlphaBeta ? 4 : 2);
  const [autoAi, setAutoAi] = useState(false);
  const turn = getTurn(board, firstPlayer);
  const gameDone = Boolean(getWinner(board).winner);
  const aiThinking = turn === AI && !gameDone;
  const searchDepth = Math.min(depth, Math.max(1, getAvailableMoves(board).length));
  const search = useMemo(
    () => runMinimaxSearch({ board, player: aiThinking ? AI : turn, depthLimit: searchDepth, useAlphaBeta }),
    [aiThinking, board, searchDepth, turn, useAlphaBeta],
  );
  const changeDepth = useCallback((delta) => {
    setDepth((value) => Math.min(MAX_DEPTH, Math.max(MIN_DEPTH, value + delta)));
  }, []);

  const reset = useCallback(() => {
    setStartRound((value) => {
      const next = value + 1;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(START_ROUND_KEY, String(next));
      }
      setFirstPlayer(next % 2 === 0 ? HUMAN : AI);
      return next;
    });
    setBoard([...EMPTY_BOARD]);
    setHistory([]);
  }, []);

  const place = useCallback(
    (move, player = turn) => {
      if (gameDone || board[move]) return;
      setHistory((items) => [...items, board]);
      setBoard(applyMove(board, move, player));
    },
    [board, gameDone, turn],
  );

  const undo = useCallback(() => {
    setHistory((items) => {
      if (!items.length) return items;
      setBoard(items[items.length - 1]);
      return items.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    if (!autoAi || gameDone || turn !== AI || search.bestMove === null) return undefined;
    const timer = window.setTimeout(() => place(search.bestMove, AI), 650);
    return () => window.clearTimeout(timer);
  }, [autoAi, gameDone, place, search.bestMove, turn]);

  return (
    <main className="gt-page">
      <section className={`gt-game-hero ${useAlphaBeta ? "is-prune" : ""}`}>
        <header className="gt-game-heading">
          <div>
            <Tag className="gt-kicker">{useAlphaBeta ? "第二页 · α-β 剪枝" : "第一页 · 最大最小搜索"}</Tag>
            <Title level={1}>{useAlphaBeta ? "带剪枝的 AI 井字棋对弈" : "我和 AI 的井字棋博弈"}</Title>
            <Paragraph>
              玩家执 X，AI 执 O。重新开始时先手自动轮换；AI 回合以当前棋盘为 Root，按设定深度生成搜索树并回传 f(n)。
            </Paragraph>
          </div>
          <div className="gt-rule-strip">
            <span>MAX：AI O</span>
            <span>MIN：玩家 X</span>
            <span>{useAlphaBeta ? "α-β 剪枝" : "Minimax"}</span>
          </div>
        </header>

        <div className="gt-control-panel">
          <PanelTitle number="01" title="参数设置" subtitle="先设置搜索深度，再观察 AI 如何选择下一步" />
          <div className="gt-depth-stepper" aria-label="AI 搜索深度">
            <Button aria-label="减少搜索深度" disabled={depth <= MIN_DEPTH} onClick={() => changeDepth(-1)}>
              <MinusOutlined />
            </Button>
            <div>
              <span>AI 搜索深度</span>
              <strong>{depth}</strong>
              <small>范围 {MIN_DEPTH}-{MAX_DEPTH}</small>
            </div>
            <Button aria-label="增加搜索深度" disabled={depth >= MAX_DEPTH} onClick={() => changeDepth(1)} type="primary">
              <PlusOutlined />
            </Button>
          </div>
          <div className="gt-switch">
            <Switch checked={autoAi} onChange={setAutoAi} />
            <span>AI 自动落子</span>
          </div>
          <div className="gt-actions">
            <Button icon={<ReloadOutlined />} onClick={reset} type="primary">
              重新开始并轮换先手
            </Button>
            <Button disabled={!history.length} icon={<UndoOutlined />} onClick={undo}>
              悔棋
            </Button>
            <Button disabled={gameDone || turn !== AI || search.bestMove === null} icon={<RobotOutlined />} onClick={() => place(search.bestMove, AI)}>
              执行 AI 推荐
            </Button>
          </div>
        </div>

        <div className="gt-board-card">
          <PanelTitle number="02" title="井字棋盘" subtitle="轮到玩家时直接点击格子；AI 回合会高亮推荐落子" />
          <div className="gt-board-card-head">
            <div>
              <strong>{describeResult(board)}</strong>
              <span>先手：{firstPlayer === HUMAN ? "玩家 X" : "AI O"} · 当前：{turn === HUMAN ? "玩家" : "AI"}</span>
            </div>
            <Tag className={`gt-result-tag is-${resultTone(board)}`}>{gameDone ? describeResult(board) : turn === HUMAN ? "请你下棋" : "AI 思考中"}</Tag>
          </div>
          <Board board={board} disabled={turn !== HUMAN || gameDone} onMove={(move) => place(move, HUMAN)} suggestedMove={aiThinking ? search.bestMove : null} turn={turn} />
        </div>

        <div className="gt-stat-strip">
          <PanelTitle number="03" title="搜索状态" subtitle="只统计 AI 当前回合生成的搜索树" />
          <Statistic title="根节点 f(n)" value={aiThinking ? formatScore(search.value) : gameDone ? describeResult(board) : "等待玩家"} />
          <Statistic title="生成节点" value={aiThinking ? search.stats.generated : 0} />
          <Statistic title="扩展节点" value={aiThinking ? search.stats.expanded : 0} />
          <Statistic title={useAlphaBeta ? "剪枝分支" : "叶节点"} value={aiThinking ? (useAlphaBeta ? search.stats.pruned : search.stats.leaves) : 0} />
        </div>
      </section>

      <section className="gt-heuristic-panel">
        <header className="gt-section-title">
          <span>
            <FireOutlined />
          </span>
          <div>
            <h2>启发函数 evaluateBoard()</h2>
            <p>AI 的目标是最大化得分，玩家的目标是最小化 AI 得分。深度没搜索到终局时，用下面的棋盘特征给非终止节点估值。</p>
          </div>
        </header>
        <div className="gt-heuristic-formula">
          <code>
            evaluateBoard(s) = terminal(s) + Σ lineScore(l) + positionScore(s)
          </code>
          <span>
            若棋盘已经终局，直接返回胜负效用；否则遍历 8 条可能连线，叠加攻防威胁分，再加入中心、角、边的位置分，得到当前局面对 AI 的估计收益。
          </span>
        </div>
        <div className="gt-heuristic-grid">
          <article>
            <code>terminal(board)</code>
            <strong>直接胜负</strong>
            <span>AI 胜 +100，玩家胜 -100，平局 0。</span>
          </article>
          <article>
            <code>Σ lineScore(l)</code>
            <strong>两子连线</strong>
            <span>AI 差一步成线 +42；玩家差一步成线 -46，优先防守。</span>
          </article>
          <article>
            <code>pos(center, corner, edge)</code>
            <strong>位置价值</strong>
            <span>中心 +15/-15，角 +5/-5，边 +2/-2。</span>
          </article>
          <article>
            <code>openLinePotential</code>
            <strong>单子潜力</strong>
            <span>未被对方阻挡的一子线给少量分，帮助浅层搜索判断方向。</span>
          </article>
        </div>
      </section>

      {aiThinking ? <SearchProcess search={search} useAlphaBeta={useAlphaBeta} /> : <WaitingSearchPanel board={board} gameDone={gameDone} turn={turn} />}
    </main>
  );
}

function runCase(depth) {
  let board = [...CASE_START_BOARD];
  const turns = [];
  const usedHumanMoves = new Set();

  while (!getWinner(board).winner && getAvailableMoves(board).length > 0) {
    const humanMove = CASE_HUMAN_SEQUENCE.find((move) => !board[move] && !usedHumanMoves.has(move)) ?? getAvailableMoves(board)[0];
    usedHumanMoves.add(humanMove);
    board = applyMove(board, humanMove, HUMAN);
    turns.push({ actor: "玩家", move: humanMove, value: terminalValue(board) ?? evaluateBoard(board), board: [...board] });

    if (getWinner(board).winner || getAvailableMoves(board).length === 0) break;

    const search = runMinimaxSearch({ board, player: AI, depthLimit: Math.min(depth, getAvailableMoves(board).length), useAlphaBeta: false });
    if (search.bestMove === null) break;
    board = applyMove(board, search.bestMove, AI);
    turns.push({ actor: "AI", move: search.bestMove, value: search.value, board: [...board] });
  }
  return { depth, board, turns, result: describeResult(board) };
}

function DepthCasePage() {
  const navigate = useNavigate();
  const depth1 = useMemo(() => runCase(1), []);
  const depth2 = useMemo(() => runCase(2), []);
  const playback = useStepPlayer(Math.max(depth1.turns.length, depth2.turns.length), {
    intervalMs: 900,
    autoStart: true,
  });
  const chart = {
    color: ["#ef4444", "#0f766e"],
    tooltip: { trigger: "axis" },
    legend: { top: 0 },
    grid: { left: 46, right: 24, top: 42, bottom: 32 },
    xAxis: { type: "category", data: ["深度 1", "深度 2"] },
    yAxis: { type: "value", name: "AI 终局收益", min: -100, max: 100 },
    series: [
      {
        name: "终局收益",
        type: "bar",
        barMaxWidth: 38,
        data: [
          { value: terminalValue(depth1.board) ?? evaluateBoard(depth1.board), itemStyle: { color: "#ef4444" } },
          { value: terminalValue(depth2.board) ?? evaluateBoard(depth2.board), itemStyle: { color: "#0f766e" } },
        ],
      },
    ],
  };

  return (
    <main className="gt-page">
      <section className="gt-depth-hero">
        <div>
          <Tag className="gt-kicker">第三页 · 搜索深度影响</Tag>
          <Title level={1}>玩家先手下同一组走法，AI 深度不同结果不同</Title>
          <Paragraph>
            从空棋盘开始，玩家 X 先手。玩家按固定优先顺序尝试落子：左上、中心、右下、左下、左中、下中。深度 1 的 AI 只看当前一步后的启发值，容易忽略玩家下一手连线；深度 2 会额外模拟玩家回应，因此能提前看到反击并抢到关键格。
          </Paragraph>
          <Button icon={<PlayCircleOutlined />} onClick={() => navigate("/game-tree/tictactoe/play")} type="primary">
            回到对弈页面
          </Button>
        </div>
        <div className="gt-case-start">
          <strong>案例初始棋盘</strong>
          <MiniBoard board={CASE_START_BOARD} />
          <span>玩家=X，AI=O，玩家先手</span>
        </div>
      </section>

      <section className="gt-depth-player">
        <StepPlayerBar label="深度影响动画" player={playback} tone="#0f766e" />
        <p>播放时，两张卡片会按相同步号逐步揭示落子，便于对比深度 1 和深度 2 在同一玩家走法下的分歧。</p>
      </section>

      <section className="gt-case-grid">
        {[depth1, depth2].map((item) => {
          const shownTurns = item.turns.slice(0, Math.min(playback.visible, item.turns.length));
          const displayBoard = shownTurns.length ? shownTurns[shownTurns.length - 1].board : CASE_START_BOARD;
          const done = playback.visible >= item.turns.length;

          return (
            <article className={`gt-case-card is-depth-${item.depth}`} key={item.depth}>
              <div className="gt-case-head">
                <strong>搜索深度 = {item.depth}</strong>
                <Tag>{done ? item.result : `第 ${shownTurns.length} 步`}</Tag>
              </div>
              <MiniBoard board={displayBoard} winLine={getWinner(displayBoard).line} />
              <div className="gt-case-timeline">
                {item.turns.map((turn, index) => {
                  const visible = index < shownTurns.length;
                  const active = index === shownTurns.length - 1;
                  return (
                    <div className={`${visible ? "is-visible" : ""} ${active ? "is-current" : ""}`} key={`${turn.actor}-${index}`}>
                      <span>{index + 1}</span>
                      <p>
                        {turn.actor} 下 {MOVE_NAMES[turn.move]}，f(n)={formatScore(turn.value)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </section>

      <section className="gt-depth-analysis">
        <header className="gt-section-title">
          <span>
            <NodeIndexOutlined />
          </span>
          <div>
            <h2>为什么深度 2 更稳</h2>
            <p>深度 1：AI 只比较自己每个候选落子后的静态评分；深度 2：AI 会继续假设玩家下一步选择最不利于 AI 的落子，再从这些结果里取最大值。</p>
          </div>
        </header>
        <div className="gt-depth-layout">
          <ReactECharts className="gt-depth-chart" option={chart} />
          <div className="gt-depth-tree-text">
            <strong>depth = 2 的搜索树形态</strong>
            <pre>{`Root：玩家已下左上，轮到 AI
├─ AI 试下 中心
│  ├─ 玩家试下 右下 -> evaluateBoard()
│  └─ 玩家试下 左下 -> evaluateBoard()
├─ AI 试下 上中
│  ├─ 玩家试下 右下 -> evaluateBoard()
│  └─ 玩家试下 左下 -> evaluateBoard()
└─ AI 试下 右上
   ├─ 玩家试下 右下 -> evaluateBoard()
   └─ 玩家试下 左下 -> evaluateBoard()`}</pre>
            <p>第一层 AI 试所有走法，取最大值；第二层玩家试所有走法，取最小值。搜索深度越大，AI 越能看到“我走完以后玩家会怎么反击”。</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function TicTacToeGameTree() {
  const location = useLocation();
  if (location.pathname.endsWith("/analysis")) return <DepthCasePage />;
  if (location.pathname.endsWith("/depth")) return <GameWorkbench useAlphaBeta />;
  return <GameWorkbench useAlphaBeta={false} />;
}
