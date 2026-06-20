import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { Alert, Button, Empty, Skeleton, Tag, Typography } from "antd";
import {
  AimOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  FireOutlined,
  LineChartOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  RocketOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { getKnowledgeKeypoints } from "../api/knowledge.js";

const { Paragraph, Title } = Typography;

const TYPE_META = {
  全部: { color: "#24306f", soft: "#eef2ff", icon: <AimOutlined /> },
  重点: { color: "#0f766e", soft: "#e2f7f0", icon: <FireOutlined /> },
  难点: { color: "#7c3aed", soft: "#f0eaff", icon: <WarningOutlined /> },
  易混: { color: "#2563eb", soft: "#eaf2ff", icon: <NodeIndexOutlined /> },
  高阶: { color: "#c2410c", soft: "#fff2e6", icon: <RocketOutlined /> },
};

const MISCONCEPTION_PALETTES = [
  { left: "#2563eb", right: "#f97316", soft: "#eff6ff", warm: "#fff7ed" },
  { left: "#7c3aed", right: "#0f766e", soft: "#f5f3ff", warm: "#ecfdf5" },
  { left: "#db2777", right: "#0891b2", soft: "#fdf2f8", warm: "#ecfeff" },
  { left: "#c2410c", right: "#4f46e5", soft: "#fff7ed", warm: "#eef2ff" },
  { left: "#16a34a", right: "#dc2626", soft: "#f0fdf4", warm: "#fef2f2" },
  { left: "#9333ea", right: "#ca8a04", soft: "#faf5ff", warm: "#fefce8" },
];

function getTypeMeta(type) {
  return TYPE_META[type] || TYPE_META.重点;
}

function splitPair(pair) {
  const parts = pair.split(/\s+vs\s+/i);
  return parts.length === 2 ? parts : [pair, "对照概念"];
}

function LevelDots({ value }) {
  const active = Math.max(1, Math.round(value / 20));
  return (
    <span className="level-dots" aria-label={`${value} 分`}>
      {Array.from({ length: 5 }, (_, index) => (
        <i className={index < active ? "is-on" : ""} key={index} />
      ))}
    </span>
  );
}

function MetricBar({ label, value }) {
  return (
    <div className="metric-bar">
      <span>{label}</span>
      <div>
        <i style={{ width: `${value}%` }} />
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function buildRadarOption(data, activeChapter) {
  const series = data.radar.series.filter((item) => activeChapter === "all" || item.chapterId === activeChapter);
  return {
    color: series.map((item) => item.color),
    tooltip: { trigger: "item" },
    legend: {
      bottom: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: "#31443c", fontWeight: 700, fontSize: 11 },
    },
    radar: {
      radius: "48%",
      center: ["50%", "48%"],
      splitNumber: 4,
      axisName: { color: "#31443c", fontWeight: 800, fontSize: 11 },
      axisLine: { lineStyle: { color: "rgba(15, 118, 110, 0.18)" } },
      splitLine: { lineStyle: { color: "rgba(15, 118, 110, 0.16)" } },
      splitArea: {
        areaStyle: {
          color: ["rgba(255,255,255,0.86)", "rgba(239,250,247,0.78)"],
        },
      },
      indicator: data.radar.axes.map((name) => ({ name, max: 100 })),
    },
    series: [
      {
        type: "radar",
        symbolSize: 5,
        lineStyle: { width: 2.5 },
        areaStyle: { opacity: 0.16 },
        data: series.map((item) => ({
          value: item.value,
          name: item.name,
          itemStyle: { color: item.color },
        })),
      },
    ],
  };
}

function buildBubbleOption(hotspots) {
  return {
    animationDuration: 650,
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        const item = params.data;
        return `${item[4]}<br/>重要度 ${item[0]} / 难度 ${item[1]} / 风险 ${item[2]}`;
      },
    },
    grid: { left: 12, right: 18, top: 28, bottom: 8, containLabel: true },
    xAxis: {
      min: 70,
      max: 100,
      name: "重要",
      nameGap: 18,
      nameLocation: "middle",
      nameTextStyle: { color: "#4b5563", fontWeight: 900, padding: [12, 0, 0, 0] },
      axisLabel: { color: "#63706b", fontWeight: 700 },
      axisLine: { lineStyle: { color: "rgba(36, 48, 111, 0.24)" } },
      splitLine: { lineStyle: { color: "rgba(36, 48, 111, 0.1)" } },
    },
    yAxis: {
      min: 45,
      max: 100,
      name: "难度",
      nameGap: 28,
      nameLocation: "middle",
      nameTextStyle: { color: "#4b5563", fontWeight: 900, padding: [0, 0, 22, 0] },
      axisLabel: { color: "#63706b", fontWeight: 700 },
      axisLine: { lineStyle: { color: "rgba(36, 48, 111, 0.24)" } },
      splitLine: { lineStyle: { color: "rgba(36, 48, 111, 0.1)" } },
    },
    series: [
      {
        type: "scatter",
        data: hotspots.map((item) => [
          item.importance,
          item.difficulty,
          item.risk,
          item.type,
          item.title,
          getTypeMeta(item.type).color,
        ]),
        symbolSize: (value) => Math.max(16, value[2] / 3),
        itemStyle: {
          color: (params) => params.data[5],
          opacity: 0.82,
          shadowBlur: 16,
          shadowColor: "rgba(23, 32, 29, 0.18)",
        },
      },
    ],
  };
}

export default function KeypointAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeChapter, setActiveChapter] = useState("all");
  const [activeType, setActiveType] = useState("全部");
  const [activeHotspotId, setActiveHotspotId] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getKnowledgeKeypoints();
      setData(result);
      setActiveHotspotId(result.hotspots?.[0]?.id || "");
    } catch (err) {
      setError(err?.message || "重点难点分析数据加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const chapterFilters = useMemo(() => {
    if (!data) return [];
    return [{ id: "all", name: "全部章节", theme: "全局视角", color: "#0f766e" }, ...data.chapters];
  }, [data]);

  const typeFilters = useMemo(() => {
    if (!data) return ["全部"];
    return ["全部", ...Array.from(new Set(data.hotspots.map((item) => item.type)))];
  }, [data]);

  const filteredHotspots = useMemo(() => {
    if (!data) return [];
    return data.hotspots.filter((item) => {
      const chapterMatched = activeChapter === "all" || item.chapterId === activeChapter;
      const typeMatched = activeType === "全部" || item.type === activeType;
      return chapterMatched && typeMatched;
    });
  }, [activeChapter, activeType, data]);

  const selectedHotspot = useMemo(() => {
    if (!filteredHotspots.length) return null;
    return filteredHotspots.find((item) => item.id === activeHotspotId) || filteredHotspots[0];
  }, [activeHotspotId, filteredHotspots]);

  const misconceptions = useMemo(() => {
    if (!data) return [];
    return data.misconceptions.filter((item) => activeChapter === "all" || item.chapterId === activeChapter);
  }, [activeChapter, data]);

  const radarOption = useMemo(() => (data ? buildRadarOption(data, activeChapter) : null), [activeChapter, data]);
  const bubbleOption = useMemo(() => buildBubbleOption(filteredHotspots), [filteredHotspots]);

  useEffect(() => {
    if (!filteredHotspots.length) {
      setActiveHotspotId("");
      return;
    }
    if (!filteredHotspots.some((item) => item.id === activeHotspotId)) {
      setActiveHotspotId(filteredHotspots[0].id);
    }
  }, [activeHotspotId, filteredHotspots]);

  if (loading) {
    return (
      <main className="page-shell keypoint-page">
        <div className="keypoint-loading">
          <Skeleton active paragraph={{ rows: 11 }} />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell keypoint-page">
        <Alert
          action={
            <Button icon={<ReloadOutlined />} onClick={loadData}>
              重新加载
            </Button>
          }
          message="加载失败"
          description={error}
          type="error"
          showIcon
        />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="page-shell keypoint-page">
        <Empty description="暂无重点难点分析数据" />
      </main>
    );
  }

  return (
    <main className="page-shell keypoint-page">
      <section className="keypoint-hero">
        <div className="keypoint-hero-copy">
          <Title level={1}>{data.meta.title}</Title>
          <Paragraph>{data.meta.subtitle}</Paragraph>
          <div className="keypoint-hero-focus">
            <span><FireOutlined />重点定位</span>
            <span><WarningOutlined />难因拆解</span>
            <span><BulbOutlined />突破方案</span>
          </div>
          <div className="hero-quick-grid">
            <article>
              <span>高风险章节</span>
              <strong>第2章</strong>
              <small>表达推理最需要重点攻克</small>
            </article>
            <article>
              <span>核心清单</span>
              <strong>{data.overviewStats[2]?.value || filteredHotspots.length} 组</strong>
              <small>按重要度、难度、风险排序</small>
            </article>
            <article>
              <span>易混修正</span>
              <strong>{data.overviewStats[3]?.value || misconceptions.length} 对</strong>
              <small>概念边界和适用场景对照</small>
            </article>
          </div>
        </div>

        <div className="keypoint-hero-board">
          <div className="hero-board-head">
            <span><AimOutlined /></span>
            <div>
              <strong>学习诊断面板</strong>
              <small>把章节、类型、风险和易混点放在同一张复习看板里。</small>
            </div>
          </div>

          <div className="hero-stat-grid">
            {data.overviewStats.map((item) => (
              <article className="hero-stat-card" key={item.label}>
                <span>{item.label}</span>
                <strong>
                  {item.value}
                  <small>{item.unit}</small>
                </strong>
                <p>{item.note}</p>
              </article>
            ))}
          </div>

          <div className="hero-path-strip">
            <div><span>01</span><strong>先看章节主线</strong><small>确定每章要解决的问题</small></div>
            <div><span>02</span><strong>再抓高风险点</strong><small>按重要度、难度和风险排序</small></div>
            <div><span>03</span><strong>最后做对照修正</strong><small>把易混概念拆开记忆</small></div>
          </div>
        </div>
      </section>

      <section className="keypoint-filter-strip">
        <div className="filter-group">
          {chapterFilters.map((item) => (
            <button
              className={`filter-chip ${activeChapter === item.id ? "is-active" : ""}`}
              key={item.id}
              onClick={() => setActiveChapter(item.id)}
              style={{ "--chip-color": item.color }}
              type="button"
            >
              <span>{item.name}</span>
              <small>{item.theme}</small>
            </button>
          ))}
        </div>
        <div className="filter-group is-type">
          {typeFilters.map((type) => {
            const meta = getTypeMeta(type);
            return (
              <button
                className={`type-chip ${activeType === type ? "is-active" : ""}`}
                key={type}
                onClick={() => setActiveType(type)}
                style={{ "--type-color": meta.color, "--type-soft": meta.soft }}
                type="button"
              >
                {type === "全部" ? <AimOutlined /> : meta.icon}
                <span>{type}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="keypoint-dashboard">
        <div className="keypoint-main-column">
          <section className="analysis-section chapter-heat-section">
            <div className="analysis-section-head">
              <div>
                <h2>章节攻克地图</h2>
              </div>
              <Tag className="mode-tag">主线 + 难因 + 突破口</Tag>
            </div>
            <div className="chapter-heat-grid">
              {data.chapters.map((chapter, chapterIndex) => {
                const attackScore = Math.round((chapter.importance + chapter.difficulty + chapter.risk) / 3);
                return (
                <article className="chapter-heat-card" key={chapter.id} style={{ "--chapter-color": chapter.color }}>
                  <div className="chapter-heat-header">
                    <span className="chapter-number">{String(chapterIndex + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{chapter.name}</strong>
                      <small>{chapter.theme}</small>
                    </div>
                    <b>{attackScore}</b>
                  </div>
                  <p>{chapter.summary}</p>
                  <div className="chapter-diagnosis-grid">
                    <div>
                      <span>难在哪里</span>
                      <strong>{chapter.difficultyReason}</strong>
                    </div>
                    <div>
                      <span>怎么突破</span>
                      <strong>{chapter.breakthrough}</strong>
                    </div>
                  </div>
                  <div className="chapter-metrics">
                    <MetricBar label="重要度" value={chapter.importance} />
                    <MetricBar label="难度" value={chapter.difficulty} />
                    <MetricBar label="抽象度" value={chapter.abstraction} />
                    <MetricBar label="易错风险" value={chapter.risk} />
                  </div>
                  <div className="chapter-focus-tags">
                    {chapter.focus.map((item) => (
                      <Tag key={item}>{item}</Tag>
                    ))}
                  </div>
                </article>
                );
              })}
            </div>
          </section>

          <section className="analysis-section hotspot-section">
            <div className="analysis-section-head">
              <div>
                <h2>核心重难点优先级</h2>
              </div>
              <strong className="section-count">{filteredHotspots.length} 组</strong>
            </div>
            {filteredHotspots.length ? (
              <div className="hotspot-grid">
                {filteredHotspots.map((item) => {
                  const meta = getTypeMeta(item.type);
                  const active = selectedHotspot?.id === item.id;
                  return (
                    <button
                      className={`hotspot-card ${active ? "is-active" : ""}`}
                      key={item.id}
                      onClick={() => setActiveHotspotId(item.id)}
                      style={{ "--hotspot-color": meta.color, "--hotspot-soft": meta.soft }}
                      type="button"
                    >
                      <span className="hotspot-type">
                        {meta.icon}
                        {item.type}
                      </span>
                      <strong className="hotspot-score">{Math.round((item.importance + item.difficulty + item.risk) / 3)}</strong>
                      <h3>{item.title}</h3>
                      <p><b>重点价值</b>{item.whyImportant}</p>
                      <div className="hotspot-meta-row">
                        <span>{item.chapter}</span>
                        <span>难度 <LevelDots value={item.difficulty} /></span>
                      </div>
                      <div className="hotspot-tags">
                        {item.keywords.slice(0, 4).map((keyword) => (
                          <i key={keyword}>{keyword}</i>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <Empty description="当前筛选条件下暂无重难点" />
            )}
          </section>

          <section className="analysis-section misconception-section">
            <div className="analysis-section-head misconception-section-head">
              <div>
                <h2>易混概念对照修正</h2>
                <p>把容易混在一起的概念拆成左右两侧，对照“定义边界、适用场景、答题提醒”。</p>
              </div>
              <Tag className="mode-tag is-focused">考前高频失分点</Tag>
            </div>
            <div className="misconception-grid">
              {misconceptions.map((item, index) => {
                const [leftName, rightName] = splitPair(item.pair);
                const palette = MISCONCEPTION_PALETTES[index % MISCONCEPTION_PALETTES.length];
                return (
                <article
                  className="misconception-card"
                  key={item.id}
                  style={{
                    "--mix-left": palette.left,
                    "--mix-right": palette.right,
                    "--mix-left-soft": palette.soft,
                    "--mix-right-soft": palette.warm,
                  }}
                >
                  <div className="misconception-top">
                    <span className="misconception-index">{String(index + 1).padStart(2, "0")}</span>
                    <h3>{item.pair}</h3>
                  </div>
                  <div className="compare-row">
                    <div className="compare-concept is-left">
                      <span>{leftName}</span>
                      <p>{item.left}</p>
                    </div>
                    <strong className="compare-vs">VS</strong>
                    <div className="compare-concept is-right">
                      <span>{rightName}</span>
                      <p>{item.right}</p>
                    </div>
                  </div>
                  <div className="fix-row">
                    <BulbOutlined />
                    <span>{item.fix}</span>
                  </div>
                </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="keypoint-side-column">
          {selectedHotspot ? (
            <section className="insight-card selected-hotspot-card" style={{ "--hotspot-color": getTypeMeta(selectedHotspot.type).color }}>
              <div className="selected-card-head">
                <span>{getTypeMeta(selectedHotspot.type).icon}</span>
                <div>
                  <Tag>{selectedHotspot.type}</Tag>
                  <h2>{selectedHotspot.title}</h2>
                  <p>{selectedHotspot.chapter}</p>
                </div>
              </div>
              <div className="selected-score-grid">
                <div><span>重要</span><strong>{selectedHotspot.importance}</strong></div>
                <div><span>难度</span><strong>{selectedHotspot.difficulty}</strong></div>
                <div><span>风险</span><strong>{selectedHotspot.risk}</strong></div>
              </div>
              <div className="selected-note is-why">
                <strong>为什么重要</strong>
                <p>{selectedHotspot.whyImportant}</p>
              </div>
              <div className="selected-note">
                <strong>常见坑</strong>
                <p>{selectedHotspot.commonPitfall}</p>
              </div>
              <div className="selected-note is-strategy">
                <strong>突破策略</strong>
                <p>{selectedHotspot.strategy}</p>
              </div>
              <div className="selected-question">
                <CheckCircleOutlined />
                <span>{selectedHotspot.checkQuestion}</span>
              </div>
            </section>
          ) : null}

          <section className="insight-card chart-card">
            <div className="side-section-head">
              <LineChartOutlined />
              <div>
                <span>能力画像</span>
                <strong>章节难度画像</strong>
              </div>
            </div>
            {radarOption ? <ReactECharts className="radar-chart" option={radarOption} notMerge /> : null}
          </section>

          <section className="insight-card chart-card">
            <div className="side-section-head">
              <AimOutlined />
              <div>
                <span>风险分布</span>
                <strong>重点难点气泡分布</strong>
              </div>
            </div>
            <ReactECharts className="bubble-chart" option={bubbleOption} notMerge />
          </section>

        </aside>
      </div>
    </main>
  );
}
