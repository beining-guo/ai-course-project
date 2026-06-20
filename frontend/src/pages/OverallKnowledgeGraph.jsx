import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Skeleton, Space, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { getKnowledgeOverview } from "../api/knowledge.js";
import { useSvgPanZoom } from "../hooks/useSvgPanZoom.js";

const { Paragraph, Title } = Typography;
const VIEWBOX = { width: 1500, height: 900 };
const CENTER = { x: 750, y: 470 };
const DEFAULT_CATEGORY = { name: "课程总览", color: "#24306f" };

function getNodeTypeLabel(node, rootId) {
  if (!node) return "知识节点";
  if (node.id === rootId) return "课程总览";
  if (node.children?.length) return "章节主干";
  return "小节入口";
}

function getOverviewGuideItems(node, relatedNodes) {
  if (!node) return [];
  if (node.id === "ai") {
    return [
      { title: "建立全局框架", text: "先看三章之间的关系，形成课程整体认知。" },
      { title: "选择学习主线", text: "从绪论、知识表达与推理、搜索三个方向切入。" },
      { title: "进入章节图谱", text: "点击章节或小节，进一步展开细分知识结构。" },
    ];
  }
  if (node.children?.length) {
    return [
      { title: "理解章节目标", text: `先抓住“${node.name}”在课程中的作用。` },
      { title: "按小节推进", text: `依次查看 ${relatedNodes.length} 个小节，建立章节内部脉络。` },
      { title: "进入细分图谱", text: "点击具体小节，查看知识簇、关键词和学习向导。" },
    ];
  }
  return [
    { title: "进入本节图谱", text: `打开“${node.name}”的知识簇结构。` },
    { title: "对照课件来源", text: `结合 ${node.source} 回看概念、案例与方法。` },
    { title: "回到章节主线", text: "再与同章其他小节对比，避免孤立记忆。" },
  ];
}

function flattenTree(node, parent = null, list = []) {
  if (!node) return list;
  list.push({ ...node, parent });
  node.children?.forEach((child) => flattenTree(child, node, list));
  return list;
}

function edgePoint(point, toward, padding = 0) {
  if (!padding) return point;
  const dx = toward.x - point.x;
  const dy = toward.y - point.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    x: point.x + (dx / length) * padding,
    y: point.y + (dy / length) * padding,
  };
}

function curvePath(from, to, fromPadding = 0, toPadding = 0) {
  const start = edgePoint(from, to, fromPadding);
  const end = edgePoint(to, from, toPadding);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return `M ${start.x} ${start.y} C ${start.x + dx * 0.32} ${start.y + dy * 0.08}, ${
    end.x - dx * 0.32
  } ${end.y - dy * 0.08}, ${end.x} ${end.y}`;
}

function polarPoint(origin, angleDeg, radius) {
  const angle = (angleDeg * Math.PI) / 180;
  return {
    x: origin.x + Math.cos(angle) * radius,
    y: origin.y + Math.sin(angle) * radius,
  };
}

function evenAngles(start, end, count) {
  if (count <= 1) return [(start + end) / 2];
  return Array.from({ length: count }, (_, index) => start + ((end - start) / (count - 1)) * index);
}

function labelSideFromAngle(angleDeg) {
  const angle = ((angleDeg % 360) + 360) % 360;
  if (angle >= 235 && angle <= 305) return "top";
  if (angle >= 55 && angle <= 125) return "bottom";
  if (angle > 125 && angle < 235) return "left";
  return "right";
}

function labelProps(side, offset = 40) {
  const props = {
    top: { x: 0, y: -offset, anchor: "middle" },
    bottom: { x: 0, y: offset + 12, anchor: "middle" },
    left: { x: -offset, y: 5, anchor: "end" },
    right: { x: offset, y: 5, anchor: "start" },
  };
  return props[side] || props.right;
}

function labelLines(node) {
  return [node.name];
}

function getOverviewLayout(data, focusedChapterId) {
  const chapters = data.tree.children || [];
  const visible = focusedChapterId ? chapters.filter((chapter) => chapter.id === focusedChapterId) : chapters;
  const chapterLayout = {
    ch1: { angle: -90, spread: 58 },
    ch2: { angle: 18, spread: 86 },
    ch3: { angle: 162, spread: 82, reverseLessons: true },
  };
  const focusLayout = {
    angle: 0,
    spread: 102,
  };
  const root = focusedChapterId ? { x: 315, y: 470 } : CENTER;
  const chapterRadius = focusedChapterId ? 250 : 260;
  const lessonRadius = focusedChapterId ? 570 : 470;
  const nodes = [{ ...data.tree, ...root, type: "root", side: "center", color: data.categories[0].color }];
  const links = [];

  visible.forEach((chapter) => {
    const color = data.categories[chapter.category]?.color || "#38bdf8";
    const layout = focusedChapterId ? focusLayout : chapterLayout[chapter.id];
    const chapterPoint = polarPoint(root, layout.angle, chapterRadius);
    nodes.push({ ...chapter, ...chapterPoint, type: "chapter", color, branchAngle: layout.angle });
    links.push({ id: `root-${chapter.id}`, from: root, to: chapterPoint, color, width: 4.6, fromPadding: 58, toPadding: 42 });

    const lessonAngles = evenAngles(layout.angle - layout.spread / 2, layout.angle + layout.spread / 2, chapter.children?.length || 0);
    const orderedAngles = layout.reverseLessons ? lessonAngles.reverse() : lessonAngles;
    chapter.children?.forEach((lesson, index) => {
      const angle = orderedAngles[index];
      const point = polarPoint(root, angle, lessonRadius);
      nodes.push({
        ...lesson,
        ...point,
        type: "lesson",
        color,
        chapterId: chapter.id,
        side: labelSideFromAngle(angle),
        branchAngle: angle,
      });
      links.push({ id: `${chapter.id}-${lesson.id}`, from: chapterPoint, to: point, color, width: 3.2, fromPadding: 42, toPadding: 30 });
    });
  });

  return { nodes, links };
}

function GraphNode({ node, selected, onClick }) {
  const isRoot = node.type === "root";
  const gemSize = isRoot ? 92 : node.type === "chapter" ? 38 : 26;
  const text = isRoot
    ? { x: 0, y: 8, anchor: "middle" }
    : node.type === "chapter"
      ? { x: 0, y: 8, anchor: "middle" }
      : labelProps(node.side, 38);
  const labelX = node.x + text.x;
  const labelY = node.y + text.y;
  const lines = labelLines(node);

  return (
    <g
      className={`svg-node ${node.type}-svg-node ${selected ? "is-selected" : ""}`}
      onClick={onClick}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {isRoot ? (
        <circle cx={node.x} cy={node.y} r={gemSize / 2} fill={node.color} stroke="#ffffff" strokeWidth="4" />
      ) : (
        <rect
          x={node.x - gemSize / 2}
          y={node.y - gemSize / 2}
          width={gemSize}
          height={gemSize}
          fill={node.color}
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="3"
          transform={`rotate(45 ${node.x} ${node.y})`}
        />
      )}
      <text
        x={labelX}
        y={labelY}
        textAnchor={text.anchor}
        transform={text.rotate ? `rotate(${text.rotate} ${labelX} ${labelY})` : undefined}
        className={`svg-node-label ${node.type}-label`}
      >
        {lines.map((line, index) => (
          <tspan key={line} x={labelX} dy={index === 0 ? 0 : 20}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

export default function OverallKnowledgeGraph() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [focusedChapterId, setFocusedChapterId] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const panZoom = useSvgPanZoom({ viewBoxWidth: VIEWBOX.width, viewBoxHeight: VIEWBOX.height });

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getKnowledgeOverview();
      setData(result);
      setSelectedNode(result.tree.children?.[0] || result.tree);
    } catch (err) {
      setError(err?.message || "知识图谱数据加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const treeNodes = useMemo(() => flattenTree(data?.tree), [data]);
  const map = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    return getOverviewLayout(data, focusedChapterId);
  }, [data, focusedChapterId]);

  const selectedWithParent = useMemo(() => {
    if (!selectedNode) return null;
    return treeNodes.find((node) => node.id === selectedNode.id) || selectedNode;
  }, [selectedNode, treeNodes]);

  const childNodes = selectedWithParent?.children || [];
  const chapterNodes = data?.tree?.children || [];
  const categories = data?.categories || [DEFAULT_CATEGORY];
  const currentCategory = categories[selectedWithParent?.category || 0] || categories[0];
  const relatedNodes = childNodes.length ? childNodes : chapterNodes;
  const guideItems = getOverviewGuideItems(selectedWithParent, relatedNodes);
  const nodeTypeLabel = getNodeTypeLabel(selectedWithParent, data?.tree?.id);

  if (loading) {
    return (
      <div className="page-shell">
        <Skeleton active paragraph={{ rows: 14 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell">
        <Alert
          type="error"
          message="后端接口暂不可用"
          description="请先进入 Backend 目录运行 python app.py，再刷新前端页面。"
          action={
            <Button icon={<ReloadOutlined />} onClick={loadData}>
              重试
            </Button>
          }
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-shell">
        <Empty description="暂无知识图谱数据" />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="knowledge-layout">
        <section className="graph-card">
          <div className="graph-head">
            <div>
              <Tag className="section-tag">
                模块一
              </Tag>
              <Title level={1}>总体知识图谱</Title>
              <Paragraph className="header-copy">人工智能原理知识结构：点击章节聚焦，点击每一节进入该节知识图谱。</Paragraph>
            </div>
            <Space>
              <Button onClick={() => setFocusedChapterId("")}>显示全部</Button>
              <Button onClick={panZoom.zoomOut}>缩小</Button>
              <Button onClick={panZoom.zoomIn}>放大</Button>
              <Button onClick={panZoom.reset}>复位</Button>
              <Button icon={<ReloadOutlined />} onClick={loadData}>
                刷新
              </Button>
            </Space>
          </div>

          <div className="svg-map-stage">
            <svg
              className="svg-map"
              viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
              preserveAspectRatio="xMidYMid meet"
              {...panZoom.svgHandlers}
            >
              <defs>
                <pattern id="overview-dot-grid" width="84" height="84" patternUnits="userSpaceOnUse">
                  <circle cx="8" cy="8" r="1.8" fill="#9aa8a1" opacity="0.24" />
                </pattern>
              </defs>
              <rect x="0" y="0" width={VIEWBOX.width} height={VIEWBOX.height} fill="url(#overview-dot-grid)" />
              <rect className="svg-pan-capture" x="0" y="0" width={VIEWBOX.width} height={VIEWBOX.height} />
              <g transform={panZoom.transform}>
                <g className="svg-link-layer">
                  {map.links.map((link) => (
                    <path
                      key={link.id}
                      d={curvePath(link.from, link.to, link.fromPadding, link.toPadding)}
                      stroke={link.color}
                      strokeWidth={link.width}
                    />
                  ))}
                </g>
                <g className="svg-node-layer">
                  {map.nodes.map((node) => (
                    <GraphNode
                      key={node.id}
                      node={node}
                      selected={selectedWithParent?.id === node.id}
                      onClick={() => {
                        setSelectedNode(node);
                        if (node.type === "root") {
                          setFocusedChapterId("");
                        } else if (node.type === "chapter") {
                          setFocusedChapterId(node.id);
                        } else {
                          navigate(`/knowledge/lesson/${node.id}`);
                        }
                      }}
                    />
                  ))}
                </g>
              </g>
            </svg>
          </div>
        </section>

        <aside className="info-panel knowledge-inspector">
          <section className="inspector-hero">
            <div className="inspector-eyebrow">
              <span className="category-dot" style={{ background: currentCategory?.color }} />
              <span>当前节点</span>
              <Tag className="category-chip">{currentCategory?.name}</Tag>
            </div>
            <h2>{selectedWithParent?.name}</h2>
            <p>{selectedWithParent?.description}</p>
            <div className="node-meta-grid">
              <div className="node-meta-item">
                <span>节点类型</span>
                <strong>{nodeTypeLabel}</strong>
              </div>
              <div className="node-meta-item">
                <span>关联入口</span>
                <strong>{relatedNodes.length} 项</strong>
              </div>
            </div>
            <div className="source-card">
              <span>课件依据</span>
              <strong>{selectedWithParent?.source}</strong>
            </div>
          </section>

          <section className="inspector-section">
            <div className="inspector-section-title">
              <span>学习路径</span>
              <small>Guide</small>
            </div>
            <div className="guide-rail">
              {guideItems.map((item, index) => (
                <div className="guide-step" key={item.title}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="inspector-section inspector-links">
            <div className="inspector-section-title">
              <span>相关入口</span>
              <small>{relatedNodes.length} 项</small>
            </div>
            <div className="entry-list">
              {relatedNodes.map((node, index) => (
                <Button
                  key={node.id}
                  className="entry-button"
                  block
                  onClick={() => {
                    if (node.children) {
                      setSelectedNode(node);
                      setFocusedChapterId(node.id);
                    } else {
                      navigate(`/knowledge/lesson/${node.id}`);
                    }
                  }}
                >
                  <span className="entry-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="entry-copy">
                    <span className="entry-name">{node.name}</span>
                    <small>{node.description}</small>
                  </span>
                </Button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
