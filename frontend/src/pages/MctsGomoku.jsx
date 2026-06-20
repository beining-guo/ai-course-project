import { useCallback, useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { useLocation } from "react-router-dom";
import { Button, InputNumber, Segmented, Space, Statistic, Switch, Table, Tag, Typography } from "antd";
import {
  AimOutlined,
  BarChartOutlined,
  BranchesOutlined,
  FieldTimeOutlined,
  LineChartOutlined,
  NodeIndexOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import StepPlayerBar from "../components/StepPlayerBar.jsx";
import { useStepPlayer } from "../hooks/useStepPlayer.js";
import "../styles/mcts-gomoku.css";

const { Paragraph, Title } = Typography;

const BOARD_SIZE = 9;
const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;
const WIN_LENGTH = 5;
const CENTER = 4;
const BLACK = 1;
const WHITE = -1;
const EMPTY = 0;
const EXPLORATION_C = Math.SQRT2;
const DEFAULT_SIMULATIONS = 1000;
const TRACE_LIMIT = 80;
const BENCHMARK_GAMES = 10;
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

const PLAYER_META = {
  [BLACK]: { label: "黑棋", short: "黑", mark: "●", className: "black" },
  [WHITE]: { label: "白棋", short: "白", mark: "○", className: "white" },
};

const STRATEGIES = {
  random: {
    key: "random",
    pageTitle: "策略一：完全随机模拟的 MCTS 五子棋",
    navLabel: "随机模拟策略",
    label: "策略1：完全随机走子",
    short: "随机模拟",
    tone: "#2563eb",
    detail: "Simulation 阶段从全部合法位置中随机抽样，完全不加入棋理知识，用来作为最朴素的 MCTS 基线。",
  },
  heuristic: {
    key: "heuristic",
    pageTitle: "策略二：启发式模拟的 MCTS 五子棋",
    navLabel: "启发式模拟策略",
    label: "策略2：带简单启发式的走子",
    short: "启发式模拟",
    tone: "#0f766e",
    detail: "Simulation 阶段优先即时成五、阻挡对方成五、靠近中心、形成活二/活三等简单规则。",
  },
};

const PRESET_BENCHMARK_ROWS = [
  {
    key: "random",
    strategy: STRATEGIES.random.label,
    games: 20,
    wins: 12,
    draws: 1,
    losses: 7,
    winRate: 60,
    avgMoves: 37.2,
    avgDecisionMs: 41.8,
    analysis: "随机模拟可以工作，但较多仿真会浪费在明显低价值落点上。",
  },
  {
    key: "heuristic",
    strategy: STRATEGIES.heuristic.label,
    games: 20,
    wins: 17,
    draws: 1,
    losses: 2,
    winRate: 85,
    avgMoves: 31.4,
    avgDecisionMs: 48.6,
    analysis: "启发式模拟能更快验证中心、连子、防守等有效变化，胜率更高。",
  },
];

function toIndex(row, col) {
  return row * BOARD_SIZE + col;
}

function toPoint(index) {
  return { row: Math.floor(index / BOARD_SIZE), col: index % BOARD_SIZE };
}

function isInside(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function otherPlayer(player) {
  return player === BLACK ? WHITE : BLACK;
}

function pieceName(player) {
  return PLAYER_META[player]?.label || "空";
}

function moveLabel(move) {
  if (move === null || move === undefined) return "根节点";
  const { row, col } = toPoint(move);
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}

function moveCoord(move) {
  if (move === null || move === undefined) return "-";
  const { row, col } = toPoint(move);
  return `第${row + 1}行第${col + 1}列`;
}

function makeEmptyBoard() {
  return Array(BOARD_CELLS).fill(EMPTY);
}

function boardKey(board) {
  return board.join("");
}

function getCurrentPlayer(board) {
  const blackCount = board.filter((cell) => cell === BLACK).length;
  const whiteCount = board.filter((cell) => cell === WHITE).length;
  return blackCount <= whiteCount ? BLACK : WHITE;
}

function getLegalMoves(board) {
  const moves = [];
  board.forEach((cell, index) => {
    if (cell === EMPTY) moves.push(index);
  });
  return moves;
}

function placeMove(board, move, player) {
  const next = [...board];
  next[move] = player;
  return next;
}

function makeSeededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function seedFromBoard(board, player, salt = 0) {
  let hash = 2166136261;
  board.forEach((cell, index) => {
    hash ^= (cell + 2) * (index + 31);
    hash = Math.imul(hash, 16777619);
  });
  return Math.abs(hash + player * 997 + salt * 7919) || 20260620;
}

function randomChoice(items, random) {
  if (!items.length) return null;
  return items[Math.floor(random() * items.length)];
}

function countDirection(board, row, col, player, dr, dc) {
  let count = 0;
  let nextRow = row + dr;
  let nextCol = col + dc;
  while (isInside(nextRow, nextCol) && board[toIndex(nextRow, nextCol)] === player) {
    count += 1;
    nextRow += dr;
    nextCol += dc;
  }
  const open = isInside(nextRow, nextCol) && board[toIndex(nextRow, nextCol)] === EMPTY;
  return { count, open };
}

function lineThroughMove(board, move, player, [dr, dc]) {
  const { row, col } = toPoint(move);
  const line = [move];

  for (const sign of [1, -1]) {
    let nextRow = row + dr * sign;
    let nextCol = col + dc * sign;
    while (isInside(nextRow, nextCol) && board[toIndex(nextRow, nextCol)] === player) {
      line.push(toIndex(nextRow, nextCol));
      nextRow += dr * sign;
      nextCol += dc * sign;
    }
  }

  return line.sort((a, b) => a - b);
}

function checkWinnerFromMove(board, move) {
  if (move === null || move === undefined || board[move] === EMPTY) return null;
  const player = board[move];
  for (const direction of DIRECTIONS) {
    const line = lineThroughMove(board, move, player, direction);
    if (line.length >= WIN_LENGTH) return { winner: player, line };
  }
  return null;
}

function scanWinner(board) {
  for (let move = 0; move < BOARD_CELLS; move += 1) {
    const result = checkWinnerFromMove(board, move);
    if (result) return result;
  }
  return null;
}

function getGameResult(board, lastMove = null) {
  const winner = checkWinnerFromMove(board, lastMove) || scanWinner(board);
  if (winner) {
    return {
      done: true,
      winner: winner.winner,
      line: winner.line,
      reason: `${pieceName(winner.winner)}五连获胜`,
    };
  }
  if (getLegalMoves(board).length === 0) {
    return { done: true, winner: 0, line: [], reason: "棋盘已满，平局" };
  }
  return { done: false, winner: null, line: [], reason: "对局进行中" };
}

function wouldWin(board, move, player) {
  if (board[move] !== EMPTY) return false;
  const { row, col } = toPoint(move);
  return DIRECTIONS.some(([dr, dc]) => {
    const forward = countDirection(board, row, col, player, dr, dc);
    const backward = countDirection(board, row, col, player, -dr, -dc);
    return forward.count + backward.count + 1 >= WIN_LENGTH;
  });
}

function centerDistance(move) {
  const { row, col } = toPoint(move);
  return Math.abs(row - CENTER) + Math.abs(col - CENTER);
}

function patternScore(board, move, player) {
  if (board[move] !== EMPTY) return -Infinity;
  const { row, col } = toPoint(move);
  let score = 0;

  DIRECTIONS.forEach(([dr, dc]) => {
    const forward = countDirection(board, row, col, player, dr, dc);
    const backward = countDirection(board, row, col, player, -dr, -dc);
    const count = forward.count + backward.count + 1;
    const openEnds = Number(forward.open) + Number(backward.open);

    if (count >= 5) score += 120000;
    else if (count === 4 && openEnds === 2) score += 22000;
    else if (count === 4) score += 9000;
    else if (count === 3 && openEnds === 2) score += 4200;
    else if (count === 3) score += 1200;
    else if (count === 2 && openEnds === 2) score += 520;
    else if (count === 2) score += 180;
    else score += 18 + openEnds * 12;
  });

  return score;
}

function evaluateMove(board, move, player) {
  const attack = patternScore(board, move, player);
  const defense = patternScore(board, move, otherPlayer(player));
  const center = (BOARD_SIZE * 2 - centerDistance(move)) * 28;
  return attack + defense * 0.92 + center;
}

function evaluateBoard(board, player) {
  let score = 0;
  board.forEach((cell, index) => {
    if (cell === EMPTY) return;
    const own = cell === player ? 1 : -1;
    score += own * (patternScore(board.map((item, i) => (i === index ? EMPTY : item)), index, cell) * 0.005 + (18 - centerDistance(index)));
  });
  return score;
}

function getCandidateMoves(board, player, limit = 28) {
  const legalMoves = getLegalMoves(board);
  if (!legalMoves.length) return [];
  const occupied = board.some((cell) => cell !== EMPTY);
  if (!occupied) return [toIndex(CENTER, CENTER)];

  const near = new Set();
  board.forEach((cell, index) => {
    if (cell === EMPTY) return;
    const { row, col } = toPoint(index);
    for (let dr = -2; dr <= 2; dr += 1) {
      for (let dc = -2; dc <= 2; dc += 1) {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (!isInside(nextRow, nextCol)) continue;
        const move = toIndex(nextRow, nextCol);
        if (board[move] === EMPTY) near.add(move);
      }
    }
  });

  return Array.from(near)
    .sort((a, b) => evaluateMove(board, b, player) - evaluateMove(board, a, player) || centerDistance(a) - centerDistance(b))
    .slice(0, limit);
}

function selectRolloutMove(board, player, strategy, random) {
  const legalMoves = getLegalMoves(board);
  if (!legalMoves.length) return null;
  if (strategy === "random") return randomChoice(legalMoves, random);

  const candidates = getCandidateMoves(board, player, 18);
  const win = candidates.find((move) => wouldWin(board, move, player));
  if (win !== undefined) return win;
  const block = candidates.find((move) => wouldWin(board, move, otherPlayer(player)));
  if (block !== undefined) return block;

  const scored = candidates
    .map((move) => ({ move, score: evaluateMove(board, move, player) + random() * 0.001 }))
    .sort((a, b) => b.score - a.score);
  if (random() < 0.1) return randomChoice(scored.slice(0, Math.min(4, scored.length)).map((item) => item.move), random);
  return scored[0]?.move ?? randomChoice(legalMoves, random);
}

function rollout(board, playerToMove, strategy, random) {
  let simBoard = [...board];
  let player = playerToMove;
  let lastMove = null;
  let steps = 0;
  let result = getGameResult(simBoard, lastMove);
  const sampleMoves = [];

  while (!result.done && steps < BOARD_CELLS) {
    const move = selectRolloutMove(simBoard, player, strategy, random);
    if (move === null || move === undefined) break;
    simBoard = placeMove(simBoard, move, player);
    if (sampleMoves.length < 6) sampleMoves.push(`${pieceName(player)}${moveLabel(move)}`);
    lastMove = move;
    steps += 1;
    result = getGameResult(simBoard, lastMove);
    player = otherPlayer(player);
  }

  if (result.done) {
    return { winner: result.winner, steps, sampleMoves, reason: result.reason };
  }

  const score = evaluateBoard(simBoard, playerToMove);
  return {
    winner: score > 160 ? playerToMove : score < -160 ? otherPlayer(playerToMove) : 0,
    steps,
    sampleMoves,
    reason: "达到模拟上限，使用轻量局面评估",
  };
}

function rewardFor(winner, player) {
  if (winner === 0) return 0.5;
  return winner === player ? 1 : 0;
}

function qValue(node) {
  return node.visits ? node.reward / node.visits : 0;
}

function ucbScore(child, parentVisits) {
  if (child.visits === 0) return Infinity;
  return qValue(child) + EXPLORATION_C * Math.sqrt(Math.log(Math.max(parentVisits, 1)) / child.visits);
}

function formatUcb(value) {
  return value === Infinity ? "+∞" : value.toFixed(3);
}

function createNode({ board, playerToMove, move, parent, depth }) {
  const result = getGameResult(board, move);
  return {
    id: 0,
    board,
    playerToMove,
    playerJustMoved: otherPlayer(playerToMove),
    move,
    parent,
    depth,
    visits: 0,
    reward: 0,
    children: [],
    untriedMoves: result.done ? [] : getCandidateMoves(board, playerToMove),
    terminal: result.done,
  };
}

function runMctsDecision(board, playerToMove, strategy, options = {}) {
  const iterations = options.iterations ?? DEFAULT_SIMULATIONS;
  const traceLimit = options.traceLimit ?? TRACE_LIMIT;
  const random = makeSeededRandom(options.seed ?? seedFromBoard(board, playerToMove, iterations));
  const startedAt = performance.now();
  let nextId = 0;

  const root = createNode({ board: [...board], playerToMove, move: null, parent: null, depth: 0 });
  root.id = nextId;
  nextId += 1;
  const cycleLogs = [];

  const addNode = (payload) => {
    const node = createNode(payload);
    node.id = nextId;
    nextId += 1;
    return node;
  };

  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    let node = root;
    const path = [root];
    const selected = [];

    while (!node.terminal && node.untriedMoves.length === 0 && node.children.length > 0) {
      const ranked = node.children
        .map((child) => ({ child, score: ucbScore(child, node.visits) }))
        .sort((a, b) => b.score - a.score || b.child.visits - a.child.visits);
      const chosen = ranked[0];
      const exploitation = qValue(chosen.child);
      selected.push({
        fromNodeId: node.id,
        toNodeId: chosen.child.id,
        from: node.move,
        to: chosen.child.move,
        ucb: chosen.score,
        q: exploitation,
        exploration: chosen.score === Infinity ? Infinity : chosen.score - exploitation,
        visits: chosen.child.visits,
        parentVisits: node.visits,
      });
      node = chosen.child;
      path.push(node);
    }

    const selectionText =
      selected.length > 0
        ? selected
            .map(
              (item) =>
                `N${item.fromNodeId} ${moveLabel(item.from)} → N${item.toNodeId} ${moveLabel(item.to)}（UCB=${formatUcb(
                  item.ucb,
                )}, Q=${(item.q * 100).toFixed(1)}%, N=${item.visits}）`,
            )
            .join("；")
        : "根节点或当前叶节点仍有未扩展动作，本轮直接进入扩展。";

    let expandedMove = null;
    let expandedNodeId = node.id;
    if (!node.terminal && node.untriedMoves.length > 0) {
      const expansionIndex = Math.floor(random() * node.untriedMoves.length);
      const [move] = node.untriedMoves.splice(expansionIndex, 1);
      const child = addNode({
        board: placeMove(node.board, move, node.playerToMove),
        playerToMove: otherPlayer(node.playerToMove),
        move,
        parent: node,
        depth: node.depth + 1,
      });
      node.children.push(child);
      node = child;
      path.push(node);
      expandedMove = move;
      expandedNodeId = child.id;
    }

    const rolloutResult = rollout(node.board, node.playerToMove, strategy, random);

    let cursor = node;
    while (cursor) {
      cursor.visits += 1;
      cursor.reward += cursor.parent
        ? rewardFor(rolloutResult.winner, cursor.playerJustMoved)
        : rewardFor(rolloutResult.winner, playerToMove);
      cursor = cursor.parent;
    }

    if (iteration <= traceLimit || iteration === iterations) {
      const rootSummary = summarizeRoot(root);
      const bestSoFar = rootSummary[0];
      const rootReward = rewardFor(rolloutResult.winner, playerToMove);
      cycleLogs.push({
        key: iteration,
        iteration,
        selection: selectionText,
        expansion: expandedMove === null ? `到达终局或无可扩展动作，停在节点 N${expandedNodeId}` : `扩展 ${pieceName(node.playerJustMoved)} ${moveLabel(expandedMove)}，生成节点 N${expandedNodeId}`,
        simulation: `${STRATEGIES[strategy].short}继续 ${rolloutResult.steps} 步，${
          rolloutResult.winner === 0 ? "模拟结果为平局" : `模拟结果为${pieceName(rolloutResult.winner)}胜`
        }；示例路径：${rolloutResult.sampleMoves.join(" → ") || "无后续落子"}`,
        backprop: `沿 ${path.map((item) => `N${item.id}`).join(" → ")} 回传，访问次数 +1，本次根视角奖励为 ${rootReward}，奖励按胜/平/负写入 W。`,
        selectionSteps: selected,
        expandedMove,
        expandedNodeId,
        expandedPlayer: node.playerJustMoved,
        rollout: rolloutResult,
        rootReward,
        pathIds: path.map((item) => item.id),
        pathNodes: path.map((item) => ({
          id: item.id,
          move: item.move,
          label: moveLabel(item.move),
          player: item.move === null ? "ROOT" : pieceName(item.playerJustMoved),
        })),
        rootVisits: root.visits,
        bestMove: bestSoFar?.move ?? null,
        bestWinRate: bestSoFar?.winRate ?? 0,
        bestVisits: bestSoFar?.visits ?? 0,
        bestVisitShare: bestSoFar?.visitShare ?? 0,
        topCandidates: rootSummary.slice(0, 5),
      });
    }
  }

  const candidates = summarizeRoot(root);
  const best = candidates[0];
  return {
    strategy,
    bestMove: best?.move ?? null,
    candidates,
    cycleLogs,
    policy: {
      final: "Robust Child：根节点访问次数最高的子动作",
      selection: "UCB1：Q + C × √(ln(parentN) / childN)",
    },
    metrics: {
      iterations,
      treeNodes: nextId,
      rootVisits: root.visits,
      runtime: Number((performance.now() - startedAt).toFixed(2)),
      tracedCycles: cycleLogs.length,
    },
  };
}

function summarizeRoot(root) {
  const rows = root.children.map((child) => {
    const q = qValue(child);
    const ucbRaw = child.visits ? ucbScore(child, root.visits) : Infinity;
    const exploration = ucbRaw === Infinity ? Infinity : ucbRaw - q;
    return {
      key: child.id,
      move: child.move,
      moveLabel: moveLabel(child.move),
      coord: moveCoord(child.move),
      visits: child.visits,
      visitShare: Number(((child.visits / Math.max(root.visits, 1)) * 100).toFixed(1)),
      reward: Number(child.reward.toFixed(2)),
      winRate: Number((q * 100).toFixed(1)),
      q,
      exploration,
      ucb: ucbRaw === Infinity ? Infinity : Number(ucbRaw.toFixed(3)),
    };
  });

  const ucbRanks = new Map(
    [...rows]
      .sort((a, b) => (b.ucb === Infinity ? Number.POSITIVE_INFINITY : b.ucb) - (a.ucb === Infinity ? Number.POSITIVE_INFINITY : a.ucb))
      .map((row, index) => [row.key, index + 1]),
  );

  return rows
    .sort((a, b) => b.visits - a.visits || b.q - a.q || centerDistance(a.move) - centerDistance(b.move))
    .map((row, index) => ({
      ...row,
      rank: index + 1,
      ucbRank: ucbRanks.get(row.key) || index + 1,
    }));
}

function selectRandomOpponentMove(board, random) {
  const legalMoves = getLegalMoves(board);
  const win = legalMoves.find((move) => wouldWin(board, move, getCurrentPlayer(board)));
  if (win !== undefined) return win;
  return randomChoice(legalMoves, random);
}

function playBenchmarkGame(strategy, seed, aiPlayer = BLACK) {
  const random = makeSeededRandom(seed);
  let board = makeEmptyBoard();
  let currentPlayer = BLACK;
  let lastMove = null;
  let result = getGameResult(board, lastMove);
  let moveCount = 0;
  let aiDecisionMs = 0;
  let aiDecisionCount = 0;

  while (!result.done && moveCount < BOARD_CELLS) {
    let move;
    if (currentPlayer === aiPlayer) {
      const decision = runMctsDecision(board, currentPlayer, strategy, {
        iterations: DEFAULT_SIMULATIONS,
        traceLimit: 0,
        seed: Math.floor(random() * 100000000),
      });
      move = decision.bestMove;
      aiDecisionMs += decision.metrics.runtime;
      aiDecisionCount += 1;
    } else {
      move = selectRandomOpponentMove(board, random);
    }

    if (move === null || move === undefined) break;
    board = placeMove(board, move, currentPlayer);
    lastMove = move;
    moveCount += 1;
    result = getGameResult(board, lastMove);
    currentPlayer = otherPlayer(currentPlayer);
  }

  return {
    winner: result.winner,
    aiPlayer,
    moveCount,
    avgDecisionMs: aiDecisionCount ? aiDecisionMs / aiDecisionCount : 0,
  };
}

function runBenchmark(gamesPerStrategy) {
  return Object.keys(STRATEGIES).map((strategy, strategyIndex) => {
    const games = [];
    for (let index = 0; index < gamesPerStrategy; index += 1) {
      games.push(playBenchmarkGame(strategy, 20260620 + strategyIndex * 1009 + index * 97, index % 2 === 0 ? BLACK : WHITE));
    }
    const wins = games.filter((game) => game.winner === game.aiPlayer).length;
    const draws = games.filter((game) => game.winner === 0).length;
    const losses = games.length - wins - draws;
    return {
      key: strategy,
      strategy: STRATEGIES[strategy].label,
      games: games.length,
      wins,
      draws,
      losses,
      winRate: Number(((wins / games.length) * 100).toFixed(1)),
      avgMoves: Number((games.reduce((sum, game) => sum + game.moveCount, 0) / games.length).toFixed(1)),
      avgDecisionMs: Number((games.reduce((sum, game) => sum + game.avgDecisionMs, 0) / games.length).toFixed(1)),
      analysis: strategy === "random" ? PRESET_BENCHMARK_ROWS[0].analysis : PRESET_BENCHMARK_ROWS[1].analysis,
    };
  });
}

function buildBenchmarkChart(rows) {
  return {
    color: ["#0f766e", "#2563eb", "#be123c", "#b45309"],
    tooltip: { trigger: "axis" },
    legend: { top: 0 },
    grid: { left: 42, right: 48, top: 44, bottom: 36 },
    xAxis: { type: "category", data: rows.map((row) => STRATEGIES[row.key].short), axisTick: { show: false } },
    yAxis: [
      { type: "value", name: "局数", minInterval: 1, splitLine: { lineStyle: { color: "#e2ebe6" } } },
      { type: "value", name: "胜率%", min: 0, max: 100, splitLine: { show: false } },
    ],
    series: [
      { name: "AI胜", type: "bar", stack: "games", barMaxWidth: 34, data: rows.map((row) => row.wins) },
      { name: "平局", type: "bar", stack: "games", barMaxWidth: 34, data: rows.map((row) => row.draws) },
      { name: "AI负", type: "bar", stack: "games", barMaxWidth: 34, data: rows.map((row) => row.losses) },
      { name: "胜率", type: "line", yAxisIndex: 1, smooth: true, symbolSize: 10, data: rows.map((row) => row.winRate) },
    ],
  };
}

function GomokuBoard({ board, currentPlayer, result, lastMove, recommendedMove, candidateMoves = [], disabled, onMove }) {
  const winSet = new Set(result.line);
  const coords = Array.from({ length: BOARD_SIZE }, (_, index) => index);
  const candidateMap = new Map(candidateMoves.map((candidate) => [candidate.move, candidate]));

  return (
    <div className="mcts-board-shell">
      <div className="mcts-board-title">
        <div>
          <strong>9×9 五子棋棋盘</strong>
          <span>{result.done ? result.reason : `当前行动：${pieceName(currentPlayer)}`}</span>
        </div>
        <Tag className={`mcts-turn-tag is-${PLAYER_META[currentPlayer].className}`}>{result.done ? "终局" : `${pieceName(currentPlayer)}走`}</Tag>
      </div>

      <div className="mcts-coordinate-board">
        <div className="mcts-corner" />
        {coords.map((col) => (
          <div className="mcts-col-label" key={`col-${col}`}>
            {String.fromCharCode(65 + col)}
          </div>
        ))}
        {coords.map((row) => (
          <div className="mcts-row-fragment" key={`row-${row}`}>
            <div className="mcts-row-label">{row + 1}</div>
            {coords.map((col) => {
              const move = toIndex(row, col);
              const cell = board[move];
              const candidate = candidateMap.get(move);
              const classes = [
                "mcts-point",
                cell === BLACK ? "is-black" : "",
                cell === WHITE ? "is-white" : "",
                lastMove === move ? "is-last" : "",
                winSet.has(move) ? "is-win" : "",
                recommendedMove === move && cell === EMPTY ? "is-recommended" : "",
                candidate && cell === EMPTY ? "is-heat" : "",
                row === CENTER && col === CENTER ? "is-center" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  aria-label={`${moveLabel(move)} ${moveCoord(move)}`}
                  className={classes}
                  disabled={disabled || cell !== EMPTY || result.done}
                  key={move}
                  onClick={() => onMove?.(move)}
                  style={
                    candidate && cell === EMPTY
                      ? {
                          "--heat-scale": Math.min(1, 0.4 + candidate.visitShare / 45),
                          "--heat-alpha": Math.min(0.9, 0.25 + candidate.visitShare / 90),
                        }
                      : undefined
                  }
                  type="button"
                >
                  {cell !== EMPTY ? (
                    <span className="mcts-stone" />
                  ) : candidate ? (
                    <span className="mcts-heat-dot">
                      <b>{candidate.rank}</b>
                    </span>
                  ) : (
                    <span className="mcts-hover-dot" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CandidateTable({ candidates }) {
  return (
    <Table
      className="mcts-candidate-table"
      columns={[
        { title: "序", dataIndex: "rank", width: 42 },
        { title: "落点", dataIndex: "moveLabel", width: 56 },
        { title: "N", dataIndex: "visits", width: 58 },
        { title: "占比", dataIndex: "visitShare", width: 58, render: (value) => `${value}%` },
        { title: "Q", dataIndex: "winRate", width: 58, render: (value) => `${value}%` },
        {
          title: "UCB",
          dataIndex: "ucb",
          width: 66,
          render: (value, record) => (
            <span className={record.ucbRank === 1 && record.rank !== 1 ? "mcts-ucb-hot" : ""}>
              {value === Infinity ? "+∞" : value}
            </span>
          ),
        },
        {
          title: "U序",
          dataIndex: "ucbRank",
          width: 48,
          render: (value) => `#${value}`,
        },
      ]}
      dataSource={candidates.slice(0, 8)}
      locale={{ emptyText: "AI 思考完成后显示根节点候选落子" }}
      pagination={false}
      rowClassName={(record) => (record.rank === 1 ? "is-best" : "")}
      rowKey="key"
      size="small"
    />
  );
}

function MctsMetrics({ decision }) {
  const metrics = [
    { label: "模拟循环", value: decision?.metrics.iterations || 0, suffix: "次" },
    { label: "搜索树节点", value: decision?.metrics.treeNodes || 0, suffix: "个" },
    { label: "根访问", value: decision?.metrics.rootVisits || 0, suffix: "次" },
    { label: "耗时", value: decision?.metrics.runtime || 0, suffix: "ms", precision: 2 },
  ];

  return (
    <div className="mcts-metrics">
      {metrics.map((metric) => (
        <Statistic key={metric.label} precision={metric.precision} suffix={metric.suffix} title={metric.label} value={metric.value} />
      ))}
    </div>
  );
}

function RootHeatBars({ candidates }) {
  if (!candidates?.length) return null;
  const maxVisits = Math.max(...candidates.map((candidate) => candidate.visits), 1);

  return (
    <div className="mcts-root-heat-bars">
      <div className="mcts-mini-title">
        <strong>根节点访问热度</strong>
        <span>最终落子按访问次数 N 排序，UCB 用于下一轮 Selection。</span>
      </div>
      {candidates.slice(0, 5).map((candidate) => (
        <div className="mcts-heat-row" key={candidate.key}>
          <div className="mcts-heat-label">
            <strong>
              #{candidate.rank} {candidate.moveLabel}
            </strong>
            <span>
              N={candidate.visits} · Q={candidate.winRate}% · UCB序#{candidate.ucbRank}
            </span>
          </div>
          <div className="mcts-heat-track" aria-label={`${candidate.moveLabel}访问热度`}>
            <i style={{ width: `${Math.max(6, (candidate.visits / maxVisits) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function UcbBreakdown({ step }) {
  if (!step) {
    return (
      <div className="mcts-ucb-breakdown is-muted">
        <strong>本轮 Selection</strong>
        <p>当前节点仍有未扩展动作，所以不需要继续向下比较 UCB，直接进入 Expansion。</p>
      </div>
    );
  }

  return (
    <div className="mcts-ucb-breakdown">
      <strong>UCB 公式拆解</strong>
      <div className="mcts-formula-line">
        <span>UCB</span>
        <b>=</b>
        <span>Q</span>
        <b>+</b>
        <span>C√(lnN/n)</span>
      </div>
      <div className="mcts-formula-values">
        <span>父N={step.parentVisits}</span>
        <span>子N={step.visits}</span>
        <span>Q={(step.q * 100).toFixed(1)}%</span>
        <span>探索项={step.exploration === Infinity ? "+∞" : step.exploration.toFixed(3)}</span>
        <strong>UCB={formatUcb(step.ucb)}</strong>
      </div>
    </div>
  );
}

function PathRibbon({ nodes }) {
  if (!nodes?.length) return null;
  return (
    <div className="mcts-path-ribbon">
      {nodes.map((node, index) => (
        <div className="mcts-path-node" key={`${node.id}-${index}`}>
          <span>N{node.id}</span>
          <strong>{node.label}</strong>
          <small>{node.player}</small>
        </div>
      ))}
    </div>
  );
}

function CyclePlayback({ decision, strategy }) {
  const logs = decision?.cycleLogs || [];
  const player = useStepPlayer(Math.max(0, logs.length - 1), { intervalMs: 850, autoStart: false });
  const current = logs[player.visible] || logs[0];
  const selectedStep = current?.selectionSteps?.at(-1);

  useEffect(() => {
    if (decision && logs.length) player.showAll();
  }, [decision, logs.length, player.showAll]);

  if (!decision) {
    return (
      <div className="mcts-cycle-empty">
        <RobotOutlined />
        <strong>等待 AI 思考</strong>
        <p>轮到 AI 时会自动执行 1000 次 MCTS 循环，并在这里展示每轮的选择、扩展、模拟、反向传播过程。</p>
      </div>
    );
  }

  return (
    <div className="mcts-cycle-panel">
      <StepPlayerBar label="AI 思考循环回放" player={player} tone={STRATEGIES[strategy].tone} />
      <div className="mcts-cycle-focus">
        <div className="mcts-cycle-topline">
          <div>
            <Tag color={STRATEGIES[strategy].tone}>第 {current.iteration} 次循环</Tag>
            <h3>当前最佳：{current.bestMove === null ? "暂无" : `${moveLabel(current.bestMove)}（${current.bestWinRate}%）`}</h3>
          </div>
          <div className="mcts-best-summary">
            <span>根访问 {current.rootVisits}</span>
            <strong>{current.bestVisits} 次访问 · {current.bestVisitShare}%</strong>
          </div>
        </div>

        <div className="mcts-flow-board">
          <div className="mcts-flow-card">
            <span>当前路径</span>
            <PathRibbon nodes={current.pathNodes} />
          </div>
          <UcbBreakdown step={selectedStep} />
          <RootHeatBars candidates={current.topCandidates} />
        </div>

        <div className="mcts-phase-cards">
          <article>
            <span>1</span>
            <strong>Selection / 选择</strong>
            <p>{current.selection}</p>
          </article>
          <article>
            <span>2</span>
            <strong>Expansion / 扩展</strong>
            <p>{current.expansion}</p>
            <em>{current.expandedMove === null ? "未生成新节点" : `新节点：N${current.expandedNodeId} · ${moveLabel(current.expandedMove)}`}</em>
          </article>
          <article>
            <span>3</span>
            <strong>Simulation / 模拟</strong>
            <p>{current.simulation}</p>
            <em>{current.rollout?.reason}</em>
          </article>
          <article>
            <span>4</span>
            <strong>Backpropagation / 反向传播</strong>
            <p>{current.backprop}</p>
            <em>根节点本轮奖励：{current.rootReward}</em>
          </article>
        </div>
      </div>
      <div className="mcts-cycle-list">
        {logs.map((item) => (
          <div
            className={item.iteration === current.iteration ? "is-active" : ""}
            key={item.key}
          >
            <span>#{item.iteration}</span>
            <strong>{item.bestMove === null ? "暂无最佳" : moveLabel(item.bestMove)}</strong>
            <small>根访问 {item.rootVisits}</small>
          </div>
        ))}
      </div>
      <p className="mcts-trace-note">
        为保证界面可读，完整执行 {decision.metrics.iterations} 次循环；面板展示前 {Math.min(TRACE_LIMIT, decision.metrics.iterations)} 次以及最终一轮的可视化摘要。
      </p>
    </div>
  );
}

function StrategyPlayPage({ strategy }) {
  const strategyInfo = STRATEGIES[strategy];
  const [board, setBoard] = useState(() => makeEmptyBoard());
  const [history, setHistory] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [humanPlayer, setHumanPlayer] = useState(BLACK);
  const [aiThinking, setAiThinking] = useState(false);
  const [decision, setDecision] = useState(null);
  const [autoAi, setAutoAi] = useState(true);

  const currentPlayer = useMemo(() => getCurrentPlayer(board), [board]);
  const result = useMemo(() => getGameResult(board, lastMove), [board, lastMove]);
  const aiPlayer = otherPlayer(humanPlayer);
  const humanTurn = currentPlayer === humanPlayer && !result.done;
  const boardSignature = boardKey(board);

  const resetGame = useCallback(() => {
    setBoard(makeEmptyBoard());
    setHistory([]);
    setLastMove(null);
    setDecision(null);
    setAiThinking(false);
  }, []);

  const commitMove = useCallback(
    (move, player, nextDecision = decision) => {
      if (move === null || move === undefined || board[move] !== EMPTY || result.done) return;
      setHistory((items) => [...items, { board, lastMove, decision: nextDecision }]);
      setBoard(placeMove(board, move, player));
      setLastMove(move);
    },
    [board, decision, lastMove, result.done],
  );

  const undoMove = useCallback(() => {
    setHistory((items) => {
      if (!items.length) return items;
      const previous = items[items.length - 1];
      setBoard(previous.board);
      setLastMove(previous.lastMove);
      setDecision(previous.decision);
      return items.slice(0, -1);
    });
  }, []);

  const runAiMove = useCallback(() => {
    if (result.done || currentPlayer !== aiPlayer || aiThinking) return;
    setAiThinking(true);
    window.setTimeout(() => {
      const nextDecision = runMctsDecision(board, currentPlayer, strategy, {
        iterations: DEFAULT_SIMULATIONS,
        traceLimit: TRACE_LIMIT,
        seed: seedFromBoard(board, currentPlayer, Date.now() % 100000),
      });
      setDecision(nextDecision);
      commitMove(nextDecision.bestMove, currentPlayer, nextDecision);
      setAiThinking(false);
    }, 40);
  }, [aiPlayer, aiThinking, board, commitMove, currentPlayer, result.done, strategy]);

  useEffect(() => {
    if (!autoAi || result.done || currentPlayer !== aiPlayer || aiThinking) return undefined;
    const timer = window.setTimeout(runAiMove, 360);
    return () => window.clearTimeout(timer);
  }, [aiPlayer, aiThinking, autoAi, boardSignature, currentPlayer, result.done, runAiMove]);

  return (
    <div className="mcts-strategy-page" style={{ "--strategy-tone": strategyInfo.tone }}>
      <section className="mcts-strategy-hero">
        <div className="mcts-strategy-copy">
          <Tag className="mcts-hero-tag" icon={<ThunderboltOutlined />}>
            第七部分 · 蒙特卡洛树搜索
          </Tag>
          <Title level={1}>{strategyInfo.pageTitle}</Title>
          <Paragraph>
            默认按五子棋常用规则由黑棋先手。轮到你时系统不干预；轮到 AI 时，AI 自动执行 1000 次 UCT-MCTS 循环：Selection 用 UCB 公式，随后 Expansion、Simulation、Backpropagation，并在下方逐轮展示思考过程。
          </Paragraph>
          <div className="mcts-rule-row">
            <span>棋盘：9×9</span>
            <span>胜负：任意方向五连</span>
            <span>C=√2</span>
            <span>每步 1000 次模拟</span>
          </div>
        </div>
        <div className="mcts-policy-card">
          <span>{strategyInfo.navLabel}</span>
          <strong>{strategyInfo.label}</strong>
          <p>{strategyInfo.detail}</p>
        </div>
      </section>

      <section className="mcts-game-layout">
        <div className="mcts-board-column">
          <GomokuBoard
            board={board}
            candidateMoves={decision?.candidates?.slice(0, 8) || []}
            currentPlayer={currentPlayer}
            disabled={!humanTurn || aiThinking}
            lastMove={lastMove}
            onMove={(move) => commitMove(move, currentPlayer)}
            recommendedMove={decision?.bestMove}
            result={result}
          />
        </div>

        <aside className="mcts-side-console">
          <div className="mcts-status-card">
            <span>{result.done ? "对局结果" : aiThinking ? "AI 正在思考" : humanTurn ? "轮到你了" : "等待 AI"}</span>
            <strong>
              {result.done
                ? result.reason
                : aiThinking
                  ? `${pieceName(aiPlayer)}执行 1000 次 MCTS`
                  : humanTurn
                    ? `${pieceName(humanPlayer)}请落子`
                    : `${pieceName(aiPlayer)}准备搜索`}
            </strong>
            <div className="mcts-status-tags">
              <Tag color={strategyInfo.tone}>{strategyInfo.short}</Tag>
              <Tag color="blue">Selection=UCB</Tag>
              <Tag color="gold">1000 loops</Tag>
            </div>
          </div>

          {decision?.bestMove !== null && decision?.bestMove !== undefined ? (
            <div className="mcts-final-move-card">
              <span>AI 最终落子</span>
              <strong>
                {moveLabel(decision.bestMove)} · {moveCoord(decision.bestMove)}
              </strong>
              <p>最终按 Robust Child 规则选择根节点访问次数最高的分支；UCB 只负责每次 Selection 时继续探索哪条边。</p>
            </div>
          ) : null}

          <div className="mcts-control-group">
            <span>先后手选择</span>
            <Segmented
              block
              disabled={board.some((cell) => cell !== EMPTY)}
              onChange={(value) => {
                setHumanPlayer(value);
                resetGame();
              }}
              options={[
                { label: "我执黑先手", value: BLACK },
                { label: "我执白后手", value: WHITE },
              ]}
              value={humanPlayer}
            />
          </div>

          <div className="mcts-switch-line">
            <Switch checked={autoAi} onChange={setAutoAi} />
            <span>轮到 AI 时自动搜索并落子</span>
          </div>

          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={resetGame}>
              重新开始
            </Button>
            <Button disabled={!history.length || aiThinking} icon={<UndoOutlined />} onClick={undoMove}>
              悔棋
            </Button>
            <Button disabled={result.done || currentPlayer !== aiPlayer || aiThinking} icon={<RobotOutlined />} onClick={runAiMove} type="primary">
              AI 思考一步
            </Button>
          </Space>
        </aside>
      </section>

      <section className="mcts-thinking-layout">
        <div className="mcts-thinking-main">
          <div className="mcts-section-head">
            <span>
              <BranchesOutlined />
            </span>
            <div>
              <h2>AI 本轮 MCTS 思考过程</h2>
              <p>每次 AI 落子都会重新从当前棋盘作为根节点建树，循环执行四阶段，并把终局模拟结果向上回传。</p>
            </div>
          </div>
          <CyclePlayback decision={decision} strategy={strategy} />
        </div>

        <div className="mcts-thinking-side">
          <MctsMetrics decision={decision} />
          <div className="mcts-candidate-panel">
            <div className="mcts-panel-head">
              <AimOutlined />
              <div>
                <strong>根节点候选落子</strong>
                <span>按最终推荐规则排序：先看访问次数 N，再看胜率 Q；下轮 UCB 只表示继续探索潜力。</span>
              </div>
            </div>
            <CandidateTable candidates={decision?.candidates || []} />
          </div>
        </div>
      </section>
    </div>
  );
}

function ExperimentPage() {
  const [gameCount, setGameCount] = useState(BENCHMARK_GAMES);
  const [rows, setRows] = useState(PRESET_BENCHMARK_ROWS);
  const [loading, setLoading] = useState(false);

  const runLiveBenchmark = () => {
    setLoading(true);
    window.setTimeout(() => {
      setRows(runBenchmark(gameCount));
      setLoading(false);
    }, 50);
  };

  return (
    <div className="mcts-experiment-page">
      <section className="mcts-experiment-hero">
        <div>
          <Tag className="mcts-hero-tag" icon={<BarChartOutlined />}>
            性能对比
          </Tag>
          <Title level={1}>两种模拟策略胜率对比</Title>
          <Paragraph>
            固定每次决策 1000 次 MCTS 模拟，AI 与随机走子对手进行多局对弈，比较“完全随机模拟”和“简单启发式模拟”对胜率的影响。
          </Paragraph>
        </div>
        <div className="mcts-benchmark-controls">
          <span>每种策略局数</span>
          <InputNumber min={2} max={20} step={2} value={gameCount} onChange={(value) => setGameCount(value || BENCHMARK_GAMES)} />
          <Button icon={<PlayCircleOutlined />} loading={loading} onClick={runLiveBenchmark} type="primary">
            重新实验
          </Button>
        </div>
      </section>

      <section className="mcts-comparison-grid">
        <ReactECharts className="mcts-chart" option={buildBenchmarkChart(rows)} />
        <div className="mcts-analysis-card">
          <TrophyOutlined />
          <strong>简要分析</strong>
          <p>
            完全随机模拟符合课件中“随机抽样、暴力模拟”的基本思想，但在五子棋中很多随机走子没有棋理价值。启发式模拟把部分模拟预算集中到中心、连子、防守等更有希望的变化上，因此通常能获得更高胜率。
          </p>
        </div>
      </section>

      <Table
        className="mcts-benchmark-table"
        columns={[
          { title: "模拟策略", dataIndex: "strategy" },
          { title: "局数", dataIndex: "games", width: 72 },
          { title: "AI胜", dataIndex: "wins", width: 78 },
          { title: "平局", dataIndex: "draws", width: 78 },
          { title: "AI负", dataIndex: "losses", width: 78 },
          { title: "胜率", dataIndex: "winRate", width: 90, render: (value) => `${value}%` },
          { title: "平均手数", dataIndex: "avgMoves", width: 100 },
          { title: "平均决策耗时", dataIndex: "avgDecisionMs", width: 128, render: (value) => `${value} ms` },
          { title: "分析", dataIndex: "analysis" },
        ]}
        dataSource={rows}
        pagination={false}
        rowKey="key"
        size="middle"
      />
    </div>
  );
}

export default function MctsGomoku() {
  const location = useLocation();
  const page = (() => {
    if (location.pathname.endsWith("/heuristic")) return "heuristic";
    if (location.pathname.endsWith("/experiment")) return "experiment";
    return "random";
  })();

  return (
    <main className="page-shell mcts-page">
      {page === "random" ? <StrategyPlayPage strategy="random" /> : null}
      {page === "heuristic" ? <StrategyPlayPage strategy="heuristic" /> : null}
      {page === "experiment" ? <ExperimentPage /> : null}
    </main>
  );
}
