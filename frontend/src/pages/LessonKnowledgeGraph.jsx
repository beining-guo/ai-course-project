import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Skeleton, Space, Tag, Tooltip, Typography } from "antd";
import { ArrowLeftOutlined, MenuFoldOutlined, MenuUnfoldOutlined, ReloadOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { getKnowledgeLesson, getKnowledgeOverview } from "../api/knowledge.js";
import { useSvgPanZoom } from "../hooks/useSvgPanZoom.js";

const { Paragraph, Title } = Typography;
const VIEWBOX = { width: 1600, height: 900 };
const CENTER = { x: 800, y: 465 };
const CLUSTER_COLORS = ["#147a5c", "#7c3aed", "#2563eb", "#c2410c", "#be123c", "#0f766e"];

function getLessonNodeTypeLabel(node) {
  if (!node) return "全节中心";
  if (node.type === "root") return "全节中心";
  if (node.type === "chapter") return "知识簇";
  return "知识点";
}

function getLessonGuideItems(lesson, selectedNode, focusedCluster) {
  if (!lesson) return [];
  if (!selectedNode || selectedNode.type === "root") {
    return [
      { title: "先读中心主题", text: `把“${lesson.title}”的核心问题和应用场景先弄清楚。` },
      { title: "展开知识簇", text: "再从图谱外圈进入每一类知识簇，建立分类记忆。" },
      { title: "回到课件验证", text: `最后对照 ${lesson.source} 补充案例、定义和推导过程。` },
    ];
  }
  if (selectedNode.type === "chapter") {
    return [
      { title: "聚焦这一簇", text: `先看“${selectedNode.name}”下面包含哪些具体知识点。` },
      { title: "抓住共同问题", text: "把同簇知识点放在同一个问题背景里理解。" },
      { title: "切换关联知识", text: "再回到全节图谱，比较它与其他知识簇的分工。" },
    ];
  }
  return [
    { title: "定位所属知识簇", text: `把“${selectedNode.name}”放回“${selectedNode.clusterName || focusedCluster}”中理解。` },
    { title: "补全概念解释", text: "用自己的话说明它是什么、解决什么问题。" },
    { title: "联系相邻节点", text: "沿图谱连线回看中心主题和同簇知识点。" },
  ];
}

function formatLessonTitle(name) {
  return name.replace(/^\d+\.\d+\s*/, "");
}

function polarPoint(angleDeg, radius, origin = CENTER) {
  const angle = (angleDeg * Math.PI) / 180;
  return {
    x: origin.x + Math.cos(angle) * radius,
    y: origin.y + Math.sin(angle) * radius,
  };
}

function curvePath(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return `M ${from.x} ${from.y} C ${from.x + dx * 0.32} ${from.y + dy * 0.08}, ${to.x - dx * 0.32} ${
    to.y - dy * 0.08
  }, ${to.x} ${to.y}`;
}

function labelSide(angleDeg) {
  const angle = ((angleDeg % 360) + 360) % 360;
  if (angle > 50 && angle < 130) return "bottom";
  if (angle > 230 && angle < 310) return "top";
  if (angle >= 130 && angle <= 230) return "left";
  return "right";
}

function labelProps(side) {
  const props = {
    top: { x: 0, y: -24, anchor: "middle" },
    bottom: { x: 0, y: 38, anchor: "middle" },
    left: { x: -28, y: 5, anchor: "end" },
    right: { x: 28, y: 5, anchor: "start" },
    center: { x: 0, y: 8, anchor: "middle" },
  };
  return props[side] || props.right;
}

function evenAngles(start, end, count) {
  if (count <= 1) return [(start + end) / 2];
  return Array.from({ length: count }, (_, index) => start + ((end - start) / (count - 1)) * index);
}

function getLessonLayout(lesson, focusedCluster) {
  const allClusters = lesson.clusters || [];
  const visibleClusters = focusedCluster ? allClusters.filter((cluster) => cluster.name === focusedCluster) : allClusters;
  const center = focusedCluster ? { x: 360, y: 465 } : CENTER;
  const clusterAngles = focusedCluster ? [0] : evenAngles(-135, 225, visibleClusters.length + 1).slice(0, visibleClusters.length);
  const nodes = [
    {
      id: lesson.id,
      name: lesson.title,
      x: center.x,
      y: center.y,
      type: "root",
      side: "center",
      color: "#24306f",
      description: lesson.overview,
    },
  ];
  const links = [];

  visibleClusters.forEach((cluster, clusterIndex) => {
    const originalIndex = allClusters.findIndex((item) => item.name === cluster.name);
    const color = CLUSTER_COLORS[originalIndex % CLUSTER_COLORS.length];
    const angle = clusterAngles[clusterIndex];
    const clusterRadius = focusedCluster ? 240 : 205;
    const itemRadius = focusedCluster ? 515 : 365;
    const clusterPoint = polarPoint(angle, clusterRadius, center);
    const clusterId = `${lesson.id}-cluster-${originalIndex}`;

    nodes.push({
      id: clusterId,
      name: cluster.name,
      x: clusterPoint.x,
      y: clusterPoint.y,
      type: "chapter",
      side: labelSide(angle),
      color,
      clusterName: cluster.name,
      description: `${lesson.title} 中的“${cluster.name}”知识簇。`,
    });
    links.push({ id: `${lesson.id}-${clusterId}`, from: center, to: clusterPoint, color, width: 4.1 });

    const spread = focusedCluster ? 110 : Math.min(54, 26 + cluster.items.length * 6);
    const itemAngles = evenAngles(angle - spread / 2, angle + spread / 2, cluster.items.length);
    cluster.items.forEach((item, itemIndex) => {
      const itemAngle = itemAngles[itemIndex];
      const point = polarPoint(itemAngle, itemRadius, center);
      const itemId = `${clusterId}-item-${itemIndex}`;
      nodes.push({
        id: itemId,
        name: item,
        x: point.x,
        y: point.y,
        type: "lesson",
        side: labelSide(itemAngle),
        color,
        clusterName: cluster.name,
        description: `属于“${cluster.name}”知识簇，是本节需要掌握的具体知识点。`,
      });
      links.push({ id: `${clusterId}-${itemIndex}`, from: clusterPoint, to: point, color, width: 2.6 });
    });
  });

  return { nodes, links };
}

function GraphNode({ node, selected, onClick }) {
  const isRoot = node.type === "root";
  const gemSize = isRoot ? 82 : node.type === "chapter" ? 30 : 20;
  const text = node.type === "lesson" ? labelProps(node.side) : { x: 0, y: isRoot ? 7 : 5, anchor: "middle" };

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
        x={node.x + text.x}
        y={node.y + text.y}
        textAnchor={text.anchor}
        className={`svg-node-label ${node.type}-label`}
      >
        {node.name}
      </text>
    </g>
  );
}

export default function LessonKnowledgeGraph() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [focusedCluster, setFocusedCluster] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [catalogHidden, setCatalogHidden] = useState(
    () => window.localStorage.getItem("ai-course-catalog-hidden") === "true",
  );
  const panZoom = useSvgPanZoom({ viewBoxWidth: VIEWBOX.width, viewBoxHeight: VIEWBOX.height });

  const loadLesson = async () => {
    setLoading(true);
    setError("");
    try {
      const [result, overview] = await Promise.all([getKnowledgeLesson(lessonId), getKnowledgeOverview()]);
      setLesson(result);
      setCatalog(overview.tree.children || []);
      setFocusedCluster("");
      setSelectedNode({ id: result.id, name: result.title, description: result.overview, source: result.source, type: "root" });
    } catch (err) {
      setError(err?.message || "本节知识图谱加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLesson();
  }, [lessonId]);

  useEffect(() => {
    window.localStorage.setItem("ai-course-catalog-hidden", String(catalogHidden));
  }, [catalogHidden]);

  const map = useMemo(() => {
    if (!lesson) return { nodes: [], links: [] };
    return getLessonLayout(lesson, focusedCluster);
  }, [lesson, focusedCluster]);

  const activeChapter = catalog.find((chapter) => chapter.id === lesson?.chapterId);
  const lessonTotal = catalog.reduce((total, chapter) => total + (chapter.children?.length || 0), 0);
  const selectedNodeType = getLessonNodeTypeLabel(selectedNode);
  const selectedCluster = selectedNode?.clusterName || focusedCluster;
  const selectedClusterData = lesson?.clusters?.find((cluster) => cluster.name === selectedCluster);
  const relatedPointCount =
    selectedNode?.type === "chapter" ? selectedClusterData?.items?.length || 0 : lesson?.clusters?.length || 0;
  const guideItems = getLessonGuideItems(lesson, selectedNode, focusedCluster);

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
          message="本节知识图谱暂不可用"
          description="请确认后端服务已启动，并检查该节编号是否存在。"
          action={
            <Button icon={<ReloadOutlined />} onClick={loadLesson}>
              重试
            </Button>
          }
        />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="page-shell">
        <Empty description="暂无本节知识图谱数据" />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className={`knowledge-layout lesson-knowledge-layout ${catalogHidden ? "is-catalog-hidden" : ""}`}>
        {catalogHidden ? (
          <Tooltip title="展开章节目录">
            <Button
              aria-label="展开章节目录"
              className="catalog-restore-button"
              icon={<MenuUnfoldOutlined />}
              onClick={() => setCatalogHidden(false)}
            />
          </Tooltip>
        ) : (
          <aside className="chapter-catalog-panel">
            <div className="catalog-head">
              <div>
                <span>章节目录</span>
                <strong>各节知识图谱</strong>
              </div>
              <div className="catalog-actions">
                <Tag>{lessonTotal} 节</Tag>
                <Tooltip title="隐藏章节目录">
                  <Button
                    aria-label="隐藏章节目录"
                    className="catalog-hide-button"
                    icon={<MenuFoldOutlined />}
                    onClick={() => setCatalogHidden(true)}
                    type="text"
                  />
                </Tooltip>
              </div>
            </div>
            <div className="catalog-list">
              {catalog.map((chapter, chapterIndex) => (
                <section
                  className={`catalog-chapter ${chapter.id === lesson.chapterId ? "is-current" : ""}`}
                  key={chapter.id}
                >
                  <button
                    className="catalog-chapter-button"
                    onClick={() => {
                      const firstLesson = chapter.children?.[0];
                      if (firstLesson) navigate(`/knowledge/lesson/${firstLesson.id}`);
                    }}
                    type="button"
                  >
                    <span>{String(chapterIndex + 1).padStart(2, "0")}</span>
                    <strong>{chapter.name}</strong>
                  </button>
                  <div className="catalog-lessons">
                    {chapter.children?.map((item) => (
                      <button
                        className={`catalog-lesson-button ${item.id === lessonId ? "is-active" : ""}`}
                        key={item.id}
                        onClick={() => navigate(`/knowledge/lesson/${item.id}`)}
                        type="button"
                      >
                        <span>{item.name.split(" ")[0]}</span>
                        <strong>{formatLessonTitle(item.name)}</strong>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </aside>
        )}

        <section className="graph-card">
          <div className="graph-head">
            <div>
              <Tag className="section-tag">
                {lesson.chapter}
              </Tag>
              <Title level={1}>{lesson.title}</Title>
              <Paragraph className="header-copy">{lesson.overview}</Paragraph>
            </div>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/knowledge/overview")}>
                返回总览
              </Button>
              <Button onClick={() => setFocusedCluster("")}>显示全部</Button>
              <Button onClick={panZoom.zoomOut}>缩小</Button>
              <Button onClick={panZoom.zoomIn}>放大</Button>
              <Button onClick={panZoom.reset}>复位</Button>
            </Space>
          </div>

          <div className="svg-map-stage">
            <svg
              className="svg-map"
              viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
              preserveAspectRatio="xMidYMid meet"
              {...panZoom.svgHandlers}
            >
              <rect className="svg-pan-capture" x="0" y="0" width={VIEWBOX.width} height={VIEWBOX.height} />
              <g transform={panZoom.transform}>
                <g className="svg-link-layer">
                  {map.links.map((link) => (
                    <path key={link.id} d={curvePath(link.from, link.to)} stroke={link.color} strokeWidth={link.width} />
                  ))}
                </g>
                <g className="svg-node-layer">
                  {map.nodes.map((node) => (
                    <GraphNode
                      key={node.id}
                      node={node}
                      selected={selectedNode?.id === node.id}
                      onClick={() => {
                        setSelectedNode(node);
                        if (node.type === "root") {
                          setFocusedCluster("");
                        } else if (node.type === "chapter") {
                          setFocusedCluster(node.clusterName);
                        }
                      }}
                    />
                  ))}
                </g>
              </g>
            </svg>
          </div>
        </section>

        <aside className="info-panel knowledge-inspector lesson-inspector">
          <section className="inspector-hero">
            <div className="inspector-eyebrow">
              <span className="category-dot" style={{ background: selectedNode?.color || "#24306f" }} />
              <span>当前节点</span>
              <Tag className={`category-chip ${focusedCluster ? "is-focused" : ""}`}>{selectedNodeType}</Tag>
            </div>
            <h2>{selectedNode?.name || lesson.title}</h2>
            <p>{selectedNode?.description || lesson.overview}</p>
            <div className="node-meta-grid">
              <div className="node-meta-item">
                <span>当前章节</span>
                <strong>{activeChapter?.name || lesson.chapter}</strong>
              </div>
              <div className="node-meta-item">
                <span>关联数量</span>
                <strong>{relatedPointCount} 项</strong>
              </div>
            </div>
            <div className="source-card">
              <span>课件依据</span>
              <strong>{lesson.source}</strong>
            </div>
          </section>

          <section className="inspector-section">
            <div className="inspector-section-title">
              <span>学习向导</span>
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
              <span>知识簇导航</span>
              <small>{lesson.clusters.length} 项</small>
            </div>
            <div className="entry-list">
              {lesson.clusters.map((cluster, index) => (
                <Button
                  key={cluster.name}
                  className={`entry-button cluster-entry-button ${focusedCluster === cluster.name ? "is-active" : ""}`}
                  block
                  style={{ "--entry-color": CLUSTER_COLORS[index % CLUSTER_COLORS.length] }}
                  onClick={() => {
                    setFocusedCluster(cluster.name);
                    setSelectedNode({
                      id: `${lesson.id}-cluster-${index}`,
                      name: cluster.name,
                      type: "chapter",
                      clusterName: cluster.name,
                      color: CLUSTER_COLORS[index % CLUSTER_COLORS.length],
                      description: `${lesson.title} 中的“${cluster.name}”知识簇，包含 ${cluster.items.length} 个具体知识点。`,
                    });
                  }}
                >
                  <span className="entry-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="entry-copy">
                    <span className="entry-name">{cluster.name}</span>
                    <small>{cluster.items.join(" / ")}</small>
                  </span>
                </Button>
              ))}
            </div>
          </section>

          <section className="inspector-section">
            <div className="inspector-section-title">
              <span>相关知识</span>
              <small>Related</small>
            </div>
            <div className="tag-cloud">
              {(lesson.related || []).map((item) => (
                <Tag key={item}>{item}</Tag>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
