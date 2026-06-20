import { useEffect, useState } from "react";
import { Button, ConfigProvider, Layout, Tooltip, theme } from "antd";
import {
  AimOutlined,
  ApartmentOutlined,
  BarChartOutlined,
  BranchesOutlined,
  CarOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  DownOutlined,
  ExperimentOutlined,
  FieldTimeOutlined,
  FileSearchOutlined,
  ForkOutlined,
  FunctionOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  NodeIndexOutlined,
  PartitionOutlined,
  ProfileOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ShareAltOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import OverallKnowledgeGraph from "./pages/OverallKnowledgeGraph.jsx";
import LessonKnowledgeGraph from "./pages/LessonKnowledgeGraph.jsx";
import KeypointAnalysis from "./pages/KeypointAnalysis.jsx";
import ReasoningOverview from "./pages/ReasoningOverview.jsx";
import ReasoningKnowledgeBase from "./pages/ReasoningKnowledgeBase.jsx";
import NaturalDeduction from "./pages/NaturalDeduction.jsx";
import Resolution from "./pages/Resolution.jsx";
import MethodComparison from "./pages/MethodComparison.jsx";
import KgReasoningOverview from "./pages/KgReasoningOverview.jsx";
import FamilyKnowledgeBase from "./pages/FamilyKnowledgeBase.jsx";
import FoilReasoning from "./pages/FoilReasoning.jsx";
import FoilVerification from "./pages/FoilVerification.jsx";
import CausalDagBuilder from "./pages/CausalDagBuilder.jsx";
import CausalDSeparation from "./pages/CausalDSeparation.jsx";
import CausalDoEffect from "./pages/CausalDoEffect.jsx";
import AStarPathfinding from "./pages/AStarPathfinding.jsx";
import TicTacToeGameTree from "./pages/TicTacToeGameTree.jsx";
import MctsGomoku from "./pages/MctsGomoku.jsx";
import Login from "./pages/Login.jsx";

const { Sider, Content } = Layout;
const SIDER_MIN_WIDTH = 340;
const SIDER_MAX_WIDTH = 480;
const SIDER_DEFAULT_WIDTH = 360;
const SIDER_COLLAPSED_WIDTH = 88;
const AUTH_STORAGE_KEY = "ai-course-auth-user";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value)); 

function readStoredUser() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const user = raw ? JSON.parse(raw) : null;
    if (user?.role && user?.account) return user;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
  return null;
}

const knowledgeModule = {
  title: "人工智能原理知识结构",
  subtitle: "课程结构总览与章节图谱",
  icon: <ClusterOutlined />,
  tone: "knowledge",
};

const knowledgeNavItems = [
  {
    key: "/knowledge/overview",
    number: "01",
    icon: <ApartmentOutlined />,
    label: "总体知识图谱",
    description: "课程主干与章节关系",
    tone: "overview",
  },
  {
    key: "/knowledge/chapters",
    number: "02",
    icon: <BranchesOutlined />,
    label: "各章节知识图谱",
    description: "逐节展开知识簇",
    tone: "chapter",
  },
  {
    key: "/knowledge/keypoints",
    number: "03",
    icon: <AimOutlined />,
    label: "重点难点分析",
    description: "高频概念与易错点",
    tone: "keypoint",
  },
];

const reasoningModule = {
  title: "自然演绎与归结演绎系统",
  subtitle: "智能网联汽车事故责任辅助判定",
  icon: <SafetyCertificateOutlined />,
  tone: "reasoning",
};

const reasoningNavItems = [
  {
    key: "/reasoning/overview",
    number: "01",
    icon: <CarOutlined />,
    label: "问题背景与相关知识",
    description: "理论基础与应用领域",
    tone: "reasoning-overview",
  },
  {
    key: "/reasoning/knowledge-base",
    number: "02",
    icon: <DatabaseOutlined />,
    label: "事故知识库",
    description: "事实规则与增删改查",
    tone: "knowledge-base",
  },
  {
    key: "/reasoning/natural-deduction",
    number: "03",
    icon: <PartitionOutlined />,
    label: "自然演绎判定",
    description: "推理规则与逐步证明",
    tone: "natural",
  },
  {
    key: "/reasoning/resolution",
    number: "04",
    icon: <FileSearchOutlined />,
    label: "归结演绎判定",
    description: "子句集与归结反演",
    tone: "resolution",
  },
];

const kgModule = {
  title: "基于知识图谱推理",
  subtitle: "家庭关系知识图谱的确定性推理",
  icon: <ShareAltOutlined />,
  tone: "knowledge",
};

const kgNavItems = [
  {
    key: "/kg/overview",
    number: "01",
    icon: <ProfileOutlined />,
    label: "问题背景与相关知识",
    description: "知识图谱概念与 FOIL 算法",
    tone: "reasoning-overview",
  },
  {
    key: "/kg/graph",
    number: "02",
    icon: <ShareAltOutlined />,
    label: "知识库的构建与表达",
    description: "增删改查 · 动态构建图谱",
    tone: "chapter",
  },
  {
    key: "/kg/foil",
    number: "03",
    icon: <ExperimentOutlined />,
    label: "FOIL 规则归纳",
    description: "序贯覆盖与信息增益",
    tone: "natural",
  },
  {
    key: "/kg/complete",
    number: "04",
    icon: <NodeIndexOutlined />,
    label: "推理验证",
    description: "新关系发现与溯源高亮",
    tone: "resolution",
  },
];

const causalModule = {
  title: "因果推理",
  subtitle: "性别藏起的药效真相",
  icon: <ForkOutlined />,
  tone: "reasoning",
};

const causalNavItems = [
  {
    key: "/causal/dag",
    number: "01",
    icon: <NodeIndexOutlined />,
    label: "DAG 构建与拓扑表示",
    description: "增删改查 · 动态构建因果图",
    tone: "natural",
  },
  {
    key: "/causal/d-separation",
    number: "02",
    icon: <PartitionOutlined />,
    label: "D-分离与路径阻断验证",
    description: "A ⟂ B | C · 链/分叉/汇连",
    tone: "chapter",
  },
  {
    key: "/causal/do-effect",
    number: "03",
    icon: <FunctionOutlined />,
    label: "do 算子效应计算",
    description: "课件数据 · 后门调整 · ACE",
    tone: "comparison",
  },
  {
    key: "/causal/do-simulation",
    number: "04",
    icon: <ExperimentOutlined />,
    label: "模拟因果数据验证",
    description: "结构方程 · 高斯噪声 · 对照测试",
    tone: "reasoning-overview",
  },
];

const searchModule = {
  title: "A*算法搜索",
  subtitle: "地图寻路、搜索树与性能对比",
  icon: <SearchOutlined />,
  tone: "reasoning",
};

const searchNavItems = [
  {
    key: "/search/astar/map",
    number: "01",
    icon: <SearchOutlined />,
    label: "地图与评估函数",
    description: "自设计地图 · f(n)=g(n)+h(n)",
    tone: "reasoning-overview",
  },
  {
    key: "/search/astar/heuristics",
    number: "02",
    icon: <NodeIndexOutlined />,
    label: "两种A*搜索",
    description: "欧氏距离与曼哈顿距离",
    tone: "natural",
  },
  {
    key: "/search/astar/ucs",
    number: "03",
    icon: <FieldTimeOutlined />,
    label: "A* 与 UCS 对比",
    description: "h(n)=0 的一致代价搜索",
    tone: "chapter",
  },
  {
    key: "/search/astar/analysis",
    number: "04",
    icon: <BarChartOutlined />,
    label: "结果图表与分析",
    description: "扩展节点、生成节点与运行时间",
    tone: "comparison",
  },
];

const gameTreeModule = {
  title: "博弈树算法",
  subtitle: "井字棋最大最小搜索与α-β剪枝",
  icon: <FunctionOutlined />,
  tone: "reasoning",
};

const gameTreeNavItems = [
  {
    key: "/game-tree/tictactoe/play",
    number: "01",
    icon: <FunctionOutlined />,
    label: "Minimax 对弈",
    description: "玩家对 AI · 动态生成搜索树",
    tone: "reasoning-overview",
  },
  {
    key: "/game-tree/tictactoe/depth",
    number: "02",
    icon: <NodeIndexOutlined />,
    label: "α-β 剪枝对弈",
    description: "极大极小搜索 · α、β 边界剪枝",
    tone: "natural",
  },
  {
    key: "/game-tree/tictactoe/analysis",
    number: "03",
    icon: <BarChartOutlined />,
    label: "搜索深度影响",
    description: "同一局面下 depth=1 与 depth=2 对比",
    tone: "comparison",
  },
];

const mctsModule = {
  title: "蒙特卡洛树搜索",
  subtitle: "9×9五子棋 UCT-MCTS 对弈",
  icon: <ThunderboltOutlined />,
  tone: "knowledge",
};

const mctsNavItems = [
  {
    key: "/mcts/gomoku/random",
    number: "01",
    icon: <ThunderboltOutlined />,
    label: "随机策略对弈",
    description: "Simulation 完全随机走子",
    tone: "overview",
  },
  {
    key: "/mcts/gomoku/heuristic",
    number: "02",
    icon: <BranchesOutlined />,
    label: "启发式策略对弈",
    description: "中心、活二、攻防优先",
    tone: "natural",
  },
  {
    key: "/mcts/gomoku/experiment",
    number: "03",
    icon: <BarChartOutlined />,
    label: "模拟策略对比",
    description: "固定1000次模拟 · 胜率图表",
    tone: "comparison",
  },
];

function getSelectedMenuKey(pathname) {
  if (pathname.startsWith("/mcts/gomoku/heuristic")) {
    return "/mcts/gomoku/heuristic";
  }
  if (pathname.startsWith("/mcts/gomoku/experiment")) {
    return "/mcts/gomoku/experiment";
  }
  if (pathname.startsWith("/mcts")) {
    return "/mcts/gomoku/random";
  }
  if (pathname.startsWith("/game-tree/tictactoe/depth")) {
    return "/game-tree/tictactoe/depth";
  }
  if (pathname.startsWith("/game-tree/tictactoe/analysis")) {
    return "/game-tree/tictactoe/analysis";
  }
  if (pathname.startsWith("/game-tree")) {
    return "/game-tree/tictactoe/play";
  }
  if (pathname.startsWith("/search/astar/analysis")) {
    return "/search/astar/analysis";
  }
  if (pathname.startsWith("/search/astar/ucs")) {
    return "/search/astar/ucs";
  }
  if (pathname.startsWith("/search/astar/heuristics")) {
    return "/search/astar/heuristics";
  }
  if (pathname.startsWith("/search/astar")) {
    return "/search/astar/map";
  }
  if (pathname.startsWith("/search")) {
    return "/search/astar/map";
  }
  if (pathname.startsWith("/causal/dag")) {
    return "/causal/dag";
  }
  if (pathname.startsWith("/causal/d-separation")) {
    return "/causal/d-separation";
  }
  if (pathname.startsWith("/causal/do-simulation")) {
    return "/causal/do-simulation";
  }
  if (pathname.startsWith("/causal/do-effect")) {
    return "/causal/do-effect";
  }
  if (pathname.startsWith("/causal")) {
    return "/causal/dag";
  }
  if (pathname.startsWith("/kg/graph")) {
    return "/kg/graph";
  }
  if (pathname.startsWith("/kg/foil")) {
    return "/kg/foil";
  }
  if (pathname.startsWith("/kg/complete")) {
    return "/kg/complete";
  }
  if (pathname.startsWith("/kg")) {
    return "/kg/overview";
  }
  if (pathname.startsWith("/reasoning/knowledge-base")) {
    return "/reasoning/knowledge-base";
  }
  if (pathname.startsWith("/reasoning/natural-deduction")) {
    return "/reasoning/natural-deduction";
  }
  if (pathname.startsWith("/reasoning/resolution")) {
    return "/reasoning/resolution";
  }
  if (pathname.startsWith("/reasoning/comparison")) {
    return "/reasoning/comparison";
  }
  if (pathname.startsWith("/reasoning")) {
    return "/reasoning/overview";
  }
  if (pathname.startsWith("/knowledge/lesson") || pathname.startsWith("/knowledge/chapters")) {
    return "/knowledge/chapters";
  }
  if (pathname.startsWith("/knowledge/keypoints")) {
    return "/knowledge/keypoints";
  }
  return "/knowledge/overview";
}

function ModuleNavigation({ module, items, open, onOpenChange, selectedKey, siderCollapsed, navigate }) {
  const moduleActive = items.some((item) => item.key === selectedKey);

  return (
    <nav aria-label={`${module.title}导航`} className={`module-nav ${open ? "is-open" : "is-closed"}`}>
      <Tooltip title={siderCollapsed ? module.title : ""} placement="right">
        <button
          aria-expanded={open}
          aria-label={`${open ? "收起" : "展开"}${module.title}`}
          className={`module-card is-${module.tone} ${moduleActive ? "is-active" : ""}`}
          onClick={() => onOpenChange((value) => !value)}
          type="button"
        >
          <span className="module-card-icon">{module.icon}</span>
          <span className="module-card-copy">
            <strong>{module.title}</strong>
            <small>{module.subtitle}</small>
          </span>
          <span className="module-card-toggle">
            {moduleActive ? <span className="module-card-current">当前</span> : open ? <DownOutlined /> : <RightOutlined />}
          </span>
        </button>
      </Tooltip>
      {open ? (
        <div className="module-nav-list">
          {items.map((item) => {
            const active = selectedKey === item.key;
            const button = (
              <button
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`module-nav-item is-${item.tone} ${active ? "is-active" : ""} ${
                  item.disabled ? "is-disabled" : ""
                }`}
                disabled={item.disabled}
                key={item.key}
                onClick={() => navigate(item.key)}
                type="button"
              >
                <span className="module-nav-number">{item.number}</span>
                <span className="module-nav-icon">{item.icon}</span>
                <span className="module-nav-copy">
                  <span className="module-nav-label">{item.label}</span>
                  <small>{item.description}</small>
                </span>
                <span className="module-nav-state">{item.disabled ? "待开放" : active ? "当前" : "进入"}</span>
              </button>
            );
            return siderCollapsed ? (
              <Tooltip key={item.key} title={item.label} placement="right">
                {button}
              </Tooltip>
            ) : (
              button
            );
          })}
        </div>
      ) : null}
    </nav>
  );
}

function AppShell({ currentUser, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedKey = getSelectedMenuKey(location.pathname);
  const [siderWidth, setSiderWidth] = useState(() => {
    const storedWidth = Number(window.localStorage.getItem("ai-course-sider-width"));
    return Number.isFinite(storedWidth) ? clamp(storedWidth, SIDER_MIN_WIDTH, SIDER_MAX_WIDTH) : SIDER_DEFAULT_WIDTH;
  });
  const [siderCollapsed, setSiderCollapsed] = useState(
    () =>
      window.localStorage.getItem("ai-course-sider-collapsed") === "true" ||
      window.localStorage.getItem("ai-course-sider-hidden") === "true",
  );
  const [knowledgeNavOpen, setKnowledgeNavOpen] = useState(
    () => window.localStorage.getItem("ai-course-knowledge-nav-open") !== "false",
  );
  const [reasoningNavOpen, setReasoningNavOpen] = useState(
    () => window.localStorage.getItem("ai-course-reasoning-nav-open") !== "false",
  );
  const [kgNavOpen, setKgNavOpen] = useState(
    () => window.localStorage.getItem("ai-course-kg-nav-open") !== "false",
  );
  const [causalNavOpen, setCausalNavOpen] = useState(
    () => window.localStorage.getItem("ai-course-causal-nav-open") !== "false",
  );
  const [searchNavOpen, setSearchNavOpen] = useState(
    () => window.localStorage.getItem("ai-course-search-nav-open") !== "false",
  );
  const [gameTreeNavOpen, setGameTreeNavOpen] = useState(
    () => window.localStorage.getItem("ai-course-game-tree-nav-open") !== "false",
  );
  const [mctsNavOpen, setMctsNavOpen] = useState(
    () => window.localStorage.getItem("ai-course-mcts-nav-open") !== "false",
  );
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("ai-course-sider-width", String(siderWidth));
  }, [siderWidth]);

  useEffect(() => {
    window.localStorage.setItem("ai-course-sider-collapsed", String(siderCollapsed));
    window.localStorage.removeItem("ai-course-sider-hidden");
  }, [siderCollapsed]);

  useEffect(() => {
    window.localStorage.setItem("ai-course-knowledge-nav-open", String(knowledgeNavOpen));
  }, [knowledgeNavOpen]);

  useEffect(() => {
    window.localStorage.setItem("ai-course-reasoning-nav-open", String(reasoningNavOpen));
  }, [reasoningNavOpen]);

  useEffect(() => {
    window.localStorage.setItem("ai-course-kg-nav-open", String(kgNavOpen));
  }, [kgNavOpen]);

  useEffect(() => {
    window.localStorage.setItem("ai-course-causal-nav-open", String(causalNavOpen));
  }, [causalNavOpen]);

  useEffect(() => {
    window.localStorage.setItem("ai-course-search-nav-open", String(searchNavOpen));
  }, [searchNavOpen]);

  useEffect(() => {
    window.localStorage.setItem("ai-course-game-tree-nav-open", String(gameTreeNavOpen));
  }, [gameTreeNavOpen]);

  useEffect(() => {
    window.localStorage.setItem("ai-course-mcts-nav-open", String(mctsNavOpen));
  }, [mctsNavOpen]);

  useEffect(() => {
    if (!resizing) return undefined;

    const handlePointerMove = (event) => {
      setSiderWidth(clamp(event.clientX, SIDER_MIN_WIDTH, SIDER_MAX_WIDTH));
    };
    const handlePointerUp = () => setResizing(false);

    document.body.classList.add("is-resizing-sider");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      document.body.classList.remove("is-resizing-sider");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [resizing]);

  return (
    <Layout
      className={`app-shell ${siderCollapsed ? "is-sider-collapsed" : ""}`}
      style={{ "--sider-width": `${siderCollapsed ? SIDER_COLLAPSED_WIDTH : siderWidth}px` }}
    >
      <Sider className="app-sider" width={siderCollapsed ? SIDER_COLLAPSED_WIDTH : siderWidth} trigger={null}>
        <div className="brand-block">
          <Tooltip title={siderCollapsed ? "展开侧栏" : "人工智能原理"}>
            <button
              aria-label={siderCollapsed ? "展开侧栏" : "人工智能原理"}
              className="brand-mark"
              onClick={() => {
                if (siderCollapsed) setSiderCollapsed(false);
              }}
              type="button"
            >
              <span className="brand-symbol" />
            </button>
          </Tooltip>
          <div className="brand-copy">
            <div className="brand-title">人工智能原理</div>
            <div className="brand-subtitle">课程学习系统</div>
          </div>
          <Tooltip title={siderCollapsed ? "展开侧栏" : "收起侧栏"}>
            <Button
              aria-label={siderCollapsed ? "展开侧栏" : "收起侧栏"}
              className="sider-collapse-button"
              icon={siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setSiderCollapsed((value) => !value)}
              type="text"
            />
          </Tooltip>
        </div>

        <ModuleNavigation
          module={knowledgeModule}
          items={knowledgeNavItems}
          open={knowledgeNavOpen}
          onOpenChange={setKnowledgeNavOpen}
          selectedKey={selectedKey}
          siderCollapsed={siderCollapsed}
          navigate={navigate}
        />
        <ModuleNavigation
          module={reasoningModule}
          items={reasoningNavItems}
          open={reasoningNavOpen}
          onOpenChange={setReasoningNavOpen}
          selectedKey={selectedKey}
          siderCollapsed={siderCollapsed}
          navigate={navigate}
        />
        <ModuleNavigation
          module={kgModule}
          items={kgNavItems}
          open={kgNavOpen}
          onOpenChange={setKgNavOpen}
          selectedKey={selectedKey}
          siderCollapsed={siderCollapsed}
          navigate={navigate}
        />
        <ModuleNavigation
          module={causalModule}
          items={causalNavItems}
          open={causalNavOpen}
          onOpenChange={setCausalNavOpen}
          selectedKey={selectedKey}
          siderCollapsed={siderCollapsed}
          navigate={navigate}
        />
        <ModuleNavigation
          module={searchModule}
          items={searchNavItems}
          open={searchNavOpen}
          onOpenChange={setSearchNavOpen}
          selectedKey={selectedKey}
          siderCollapsed={siderCollapsed}
          navigate={navigate}
        />
        <ModuleNavigation
          module={gameTreeModule}
          items={gameTreeNavItems}
          open={gameTreeNavOpen}
          onOpenChange={setGameTreeNavOpen}
          selectedKey={selectedKey}
          siderCollapsed={siderCollapsed}
          navigate={navigate}
        />
        <ModuleNavigation
          module={mctsModule}
          items={mctsNavItems}
          open={mctsNavOpen}
          onOpenChange={setMctsNavOpen}
          selectedKey={selectedKey}
          siderCollapsed={siderCollapsed}
          navigate={navigate}
        />
        <div className="sider-user-card">
          <span className="sider-user-icon">
            <UserOutlined />
          </span>
          <div className="sider-user-copy">
            <strong>{currentUser?.name || currentUser?.account}</strong>
            <small>{currentUser?.role === "teacher" ? "教师端" : "学生端"} · {currentUser?.account}</small>
          </div>
          <Tooltip title="退出登录" placement="right">
            <Button
              aria-label="退出登录"
              className="sider-logout-button"
              icon={<LogoutOutlined />}
              onClick={onLogout}
              type="text"
            />
          </Tooltip>
        </div>
      </Sider>
      {!siderCollapsed ? (
        <div
          aria-label="拖动调整侧栏宽度"
          aria-orientation="vertical"
          className={`sider-resizer ${resizing ? "is-active" : ""}`}
          onDoubleClick={() => setSiderWidth(SIDER_DEFAULT_WIDTH)}
          onPointerDown={(event) => {
            event.preventDefault();
            setResizing(true);
          }}
          role="separator"
          tabIndex={0}
          title="拖动调整侧栏宽度"
        >
          <span />
        </div>
      ) : null}
      <Layout>
        <Content className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/knowledge/overview" replace />} />
            <Route path="/knowledge/overview" element={<OverallKnowledgeGraph />} />
            <Route path="/knowledge/chapters" element={<Navigate to="/knowledge/lesson/ch1-1" replace />} />
            <Route path="/knowledge/lesson/:lessonId" element={<LessonKnowledgeGraph />} />
            <Route path="/knowledge/keypoints" element={<KeypointAnalysis />} />
            <Route path="/reasoning" element={<Navigate to="/reasoning/overview" replace />} />
            <Route path="/reasoning/overview" element={<ReasoningOverview />} />
            <Route
              path="/reasoning/knowledge-base"
              element={<ReasoningKnowledgeBase />}
            />
            <Route path="/reasoning/natural-deduction" element={<NaturalDeduction />} />
            <Route path="/reasoning/resolution" element={<Resolution />} />
            <Route path="/reasoning/comparison" element={<MethodComparison />} />
            <Route path="/kg" element={<Navigate to="/kg/overview" replace />} />
            <Route path="/kg/overview" element={<KgReasoningOverview />} />
            <Route path="/kg/graph" element={<FamilyKnowledgeBase />} />
            <Route path="/kg/foil" element={<FoilReasoning />} />
            <Route path="/kg/complete" element={<FoilVerification />} />
            <Route path="/causal" element={<Navigate to="/causal/dag" replace />} />
            <Route path="/causal/dag" element={<CausalDagBuilder />} />
            <Route path="/causal/d-separation" element={<CausalDSeparation />} />
            <Route path="/causal/do-effect" element={<CausalDoEffect />} />
            <Route path="/causal/do-simulation" element={<CausalDoEffect />} />
            <Route path="/search" element={<Navigate to="/search/astar/map" replace />} />
            <Route path="/search/astar" element={<Navigate to="/search/astar/map" replace />} />
            <Route path="/search/astar/map" element={<AStarPathfinding />} />
            <Route path="/search/astar/heuristics" element={<AStarPathfinding />} />
            <Route path="/search/astar/ucs" element={<AStarPathfinding />} />
            <Route path="/search/astar/analysis" element={<AStarPathfinding />} />
            <Route path="/game-tree" element={<Navigate to="/game-tree/tictactoe/play" replace />} />
            <Route path="/game-tree/tictactoe" element={<Navigate to="/game-tree/tictactoe/play" replace />} />
            <Route path="/game-tree/tictactoe/play" element={<TicTacToeGameTree />} />
            <Route path="/game-tree/tictactoe/depth" element={<TicTacToeGameTree />} />
            <Route path="/game-tree/tictactoe/analysis" element={<TicTacToeGameTree />} />
            <Route path="/mcts" element={<Navigate to="/mcts/gomoku/random" replace />} />
            <Route path="/mcts/gomoku" element={<Navigate to="/mcts/gomoku/random" replace />} />
            <Route path="/mcts/gomoku/play" element={<Navigate to="/mcts/gomoku/random" replace />} />
            <Route path="/mcts/gomoku/random" element={<MctsGomoku />} />
            <Route path="/mcts/gomoku/heuristic" element={<MctsGomoku />} />
            <Route path="/mcts/gomoku/experiment" element={<MctsGomoku />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

function AuthenticatedApp() {
  const [currentUser, setCurrentUser] = useState(readStoredUser);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogin = (user) => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setCurrentUser(null);
    navigate("/login", { replace: true });
  };

  if (!currentUser && location.pathname !== "/login") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (currentUser && location.pathname === "/login") {
    return <Navigate to="/knowledge/overview" replace />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login onLogin={handleLogin} />} />
      <Route path="/*" element={<AppShell currentUser={currentUser} onLogout={handleLogout} />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#0f766e",
          colorInfo: "#2563eb",
          colorSuccess: "#15803d",
          colorWarning: "#b45309",
          colorError: "#be123c",
          colorBgBase: "#f4f7f3",
          colorTextBase: "#17201d",
          colorBorder: "#d6e0da",
          borderRadius: 8,
          fontFamily:
            "'HarmonyOS Sans SC', 'MiSans', 'OPPO Sans', 'PingFang SC', 'Microsoft YaHei UI', 'Source Han Sans CN', 'Noto Sans SC', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        },
      }}
    >
      <BrowserRouter>
        <AuthenticatedApp />
      </BrowserRouter>
    </ConfigProvider>
  );
}
