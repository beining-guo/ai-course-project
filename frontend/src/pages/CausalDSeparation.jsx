import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Select, Skeleton, Space, Tag, Typography, message } from "antd";
import { NodeIndexOutlined, ReloadOutlined, ShareAltOutlined } from "@ant-design/icons";
import { getCausalDag, judgeDSeparation } from "../api/causal.js";
import CausalDagGraph from "../components/CausalDagGraph.jsx";
import "../styles/kg-overview.css";

const { Paragraph } = Typography;

const DSEP_DEMOS = [
  {
    key: "chain",
    name: "链结构",
    formula: "A → C → B",
    middle: "C",
    plain: "不给定中间节点 C 时，影响可以沿 A → C → B 传播，A 与 B 通常不独立。",
    conditioned: "给定中间节点 C 后，传播在 C 处被截断，A 与 B 条件独立。",
    activeWhenConditioned: false,
  },
  {
    key: "fork",
    name: "分叉结构",
    formula: "A ← C → B",
    middle: "C",
    plain: "不给定共同原因 C 时，A 与 B 会通过 C 产生相关，路径保持激活。",
    conditioned: "给定共同原因 C 后，混淆路径被阻断，A 与 B 条件独立。",
    activeWhenConditioned: false,
  },
  {
    key: "collider",
    name: "汇连结构",
    formula: "A → C ← B",
    middle: "C",
    plain: "不给定汇连点 C 及其后代时，路径天然阻断，A 与 B 独立。",
    conditioned: "给定汇连点 C 后，原本阻断的路径被打开，A 与 B 变得相关。",
    activeWhenConditioned: true,
  },
];

function Formula({ children, tone }) {
  return (
    <code className="kb-formula-code" style={tone ? { color: tone } : undefined}>
      {children}
    </code>
  );
}

function formatSet(items) {
  return items?.length ? `{ ${items.join(", ")} }` : "∅";
}

function unique(items) {
  return [...new Set(items || [])];
}

function ResultCard({ title, result, muted }) {
  return (
    <article className={`cdag-compare-card ${result?.independent ? "is-independent" : "is-dependent"} ${muted ? "is-muted" : ""}`}>
      <span>{title}</span>
      {result ? (
        <>
          <strong>{result.independent ? "独立成立" : "存在传播"}</strong>
          <Formula tone={result.independent ? "#16a34a" : "#dc2626"}>{result.formula}</Formula>
          <p>{result.independent ? "所有路径被阻断，A 与 B 不再互相传递影响。" : "至少存在一条激活路径，A 与 B 之间仍有影响传播。"}</p>
        </>
      ) : (
        <p>等待选择集合 A 与集合 B。</p>
      )}
    </article>
  );
}

function StructureDiagram({ type, active, middle }) {
  const markerId = `dsep-${type}-${active ? "active" : "blocked"}`;
  const color = active ? "#dc2626" : "#16a34a";
  const commonLine = {
    stroke: color,
    strokeWidth: 3,
    strokeLinecap: "round",
    markerEnd: `url(#${markerId})`,
  };
  const positions = {
    chain: {
      A: { x: 78, y: 62 },
      C: { x: 180, y: 62 },
      B: { x: 282, y: 62 },
      captionY: 126,
    },
    fork: {
      A: { x: 92, y: 100 },
      C: { x: 180, y: 36 },
      B: { x: 268, y: 100 },
      captionY: 136,
    },
    collider: {
      A: { x: 92, y: 38 },
      C: { x: 180, y: 102 },
      B: { x: 268, y: 38 },
      captionY: 138,
    },
  }[type];

  return (
    <svg className={`cdag-demo-svg is-${type}`} viewBox="0 0 360 150" role="img" aria-label={`${type} d-separation structure`}>
      <defs>
        <marker id={markerId} markerWidth="10" markerHeight="10" refX="8" refY="3.2" orient="auto">
          <path d="M0,0 L8,3.2 L0,6.4 Z" fill={color} />
        </marker>
      </defs>
      {type === "chain" ? (
        <>
          <line x1="104" y1="62" x2="156" y2="62" {...commonLine} />
          <line x1="204" y1="62" x2="256" y2="62" {...commonLine} />
        </>
      ) : null}
      {type === "fork" ? (
        <>
          <line x1="158" y1="51" x2="111" y2="86" {...commonLine} />
          <line x1="202" y1="51" x2="249" y2="86" {...commonLine} />
        </>
      ) : null}
      {type === "collider" ? (
        <>
          <line x1="111" y1="52" x2="158" y2="88" {...commonLine} />
          <line x1="249" y1="52" x2="202" y2="88" {...commonLine} />
        </>
      ) : null}
      <g className="cdag-demo-svg-node">
        <circle cx={positions.A.x} cy={positions.A.y} r="25" />
        <text x={positions.A.x} y={positions.A.y}>A</text>
      </g>
      <g className="cdag-demo-svg-node is-middle">
        <circle cx={positions.C.x} cy={positions.C.y} r="28" />
        <text x={positions.C.x} y={positions.C.y}>{middle}</text>
      </g>
      <g className="cdag-demo-svg-node">
        <circle cx={positions.B.x} cy={positions.B.y} r="25" />
        <text x={positions.B.x} y={positions.B.y}>B</text>
      </g>
      <text className="cdag-demo-svg-caption" x="180" y={positions.captionY}>
        {active ? "路径激活：影响可以传播" : "路径阻断：影响停止传播"}
      </text>
    </svg>
  );
}

function PathFlow({ path }) {
  return (
    <div className={`cdag-path-flow ${path.active ? "is-active" : "is-blocked"}`}>
      {path.nodes.map((node, index) => (
        <span key={`${path.label}-${node}-${index}`}>
          <b>{node}</b>
          {index < path.nodes.length - 1 ? <i>—</i> : null}
        </span>
      ))}
    </div>
  );
}

export default function CausalDSeparation() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState({ A: ["X"], B: ["Y"], C: ["Z"] });
  const [result, setResult] = useState(null);
  const [plainResult, setPlainResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [structureConditioned, setStructureConditioned] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const dag = await getCausalDag();
      setData(dag);
    } catch (err) {
      setError(err?.message || "因果 DAG 数据加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const variableKeys = useMemo(() => (data?.variables || []).map((variable) => variable.key), [data]);
  const validKeySet = useMemo(() => new Set(variableKeys), [variableKeys]);
  const variableOptions = useMemo(
    () => (data?.variables || []).map((variable) => ({ label: `${variable.key} · ${variable.name}`, value: variable.key })),
    [data],
  );

  const sanitizeQuery = (draft) => {
    const A = unique(draft.A).filter((key) => validKeySet.has(key));
    const B = unique(draft.B).filter((key) => validKeySet.has(key) && !A.includes(key));
    const C = unique(draft.C).filter((key) => validKeySet.has(key) && !A.includes(key) && !B.includes(key));
    return { A, B, C };
  };

  const runDSeparation = async (nextQuery = query) => {
    if (!data?.variables?.length || !nextQuery.A?.length || !nextQuery.B?.length) {
      setResult(null);
      setPlainResult(null);
      return;
    }
    setChecking(true);
    try {
      const [plain, current] = await Promise.all([
        judgeDSeparation({ a: nextQuery.A, b: nextQuery.B, c: [] }),
        judgeDSeparation({ a: nextQuery.A, b: nextQuery.B, c: nextQuery.C }),
      ]);
      setPlainResult(plain);
      setResult(current);
    } catch (err) {
      setResult(null);
      setPlainResult(null);
      message.error(err?.response?.data?.message || "D-分离验证失败");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!data?.variables?.length) return;
    const fallback = {
      A: variableKeys.includes("X") ? ["X"] : variableKeys.slice(0, 1),
      B: variableKeys.includes("Y") ? ["Y"] : variableKeys.slice(1, 2),
      C: variableKeys.includes("Z") ? ["Z"] : [],
    };
    const nextQuery = sanitizeQuery({
      A: query.A.length ? query.A : fallback.A,
      B: query.B.length ? query.B : fallback.B,
      C: query.C.length ? query.C : fallback.C,
    });
    setQuery(nextQuery);
    runDSeparation(nextQuery);
  }, [data]);

  const updateQuery = (field, value) => {
    const nextQuery = sanitizeQuery({ ...query, [field]: value || [] });
    setQuery(nextQuery);
    runDSeparation(nextQuery);
  };

  const clearCondition = () => updateQuery("C", []);
  const useDefaultCondition = () => {
    const candidate = variableKeys.find((key) => !query.A.includes(key) && !query.B.includes(key));
    updateQuery("C", candidate ? [candidate] : []);
  };

  if (loading) {
    return (
      <main className="page-shell cdag-page">
        <Skeleton active paragraph={{ rows: 14 }} />
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell cdag-page">
        <Alert
          type="error"
          showIcon
          message="D-分离验证暂不可用"
          description="请确认后端服务已启动（python app.py），并刷新页面。"
          action={
            <Button icon={<ReloadOutlined />} onClick={loadData}>
              重试
            </Button>
          }
        />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="page-shell cdag-page">
        <Empty description="暂无因果 DAG 数据" />
      </main>
    );
  }

  const activeCount = result?.activePaths?.length || 0;
  const blockedCount = result?.blockedPaths?.length || 0;
  const changedByCondition = plainResult && result && plainResult.independent !== result.independent;

  return (
    <main className="page-shell cdag-page">
      <section className="kb-panel kgb-section cdag-section is-s3">
        <div className="kb-panel-head">
          <div>
            <span>Step 02 · D-separation</span>
            <h2>② D-分离与路径阻断动态演示</h2>
          </div>
          <Space wrap>
            <Button icon={<ReloadOutlined />} loading={checking} onClick={() => runDSeparation()}>
              重新验证
            </Button>
          </Space>
        </div>
        <Paragraph className="kgb-copy">
          基于上一页动态构建的因果图，先选定集合 <b>A</b> 与 <b>B</b>，再决定是否给定条件集合 <b>C</b>。系统会枚举 A 到 B 的所有路径，动态展示影响传播是被
          “阻断”还是被“激活”，从而判断 <b>A ⟂ B | C</b> 是否成立。
        </Paragraph>

        <div className="cdag-dsep-page-grid">
          <div className="cdag-dsep-main">
            <div className="cdag-dsep-dashboard">
              <article className="cdag-dsep-query">
                <header>
                  <ShareAltOutlined />
                  <strong>① 设置查询</strong>
                </header>
                <div className="cdag-dsep-selects">
                  <label>
                    <span>集合 A</span>
                    <Select
                      mode="multiple"
                      options={variableOptions.map((option) => ({ ...option, disabled: query.B.includes(option.value) || query.C.includes(option.value) }))}
                      value={query.A}
                      onChange={(value) => updateQuery("A", value)}
                      placeholder="选择 A"
                    />
                  </label>
                  <label>
                    <span>集合 B</span>
                    <Select
                      mode="multiple"
                      options={variableOptions.map((option) => ({ ...option, disabled: query.A.includes(option.value) || query.C.includes(option.value) }))}
                      value={query.B}
                      onChange={(value) => updateQuery("B", value)}
                      placeholder="选择 B"
                    />
                  </label>
                  <label>
                    <span>给定集合 C</span>
                    <Select
                      mode="multiple"
                      allowClear
                      options={variableOptions.map((option) => ({ ...option, disabled: query.A.includes(option.value) || query.B.includes(option.value) }))}
                      value={query.C}
                      onChange={(value) => updateQuery("C", value)}
                      placeholder="不选择表示 C = ∅"
                    />
                  </label>
                </div>
                <div className="cdag-condition-tools">
                  <Button size="small" type={query.C.length ? "default" : "primary"} onClick={clearCondition}>
                    不给定 C
                  </Button>
                  <Button size="small" type={query.C.length ? "primary" : "default"} onClick={useDefaultCondition}>
                    给定一个条件
                  </Button>
                  <Formula tone="#2563eb">
                    {formatSet(query.A)} ⟂ {formatSet(query.B)} | {formatSet(query.C)}
                  </Formula>
                </div>
              </article>

              <article className={`cdag-dsep-result ${result?.independent ? "is-independent" : "is-dependent"}`}>
                <header>
                  <NodeIndexOutlined />
                  <strong>② 当前结论</strong>
                </header>
                {result ? (
                  <>
                    <div className="cdag-dsep-verdict">
                      <Tag color={result.independent ? "green" : "red"}>
                        {result.independent ? "条件独立成立" : "条件独立不成立"}
                      </Tag>
                      <b>{result.formula}</b>
                    </div>
                    <p>{result.summary}</p>
                    <div className="cdag-dsep-counts">
                      <span>激活路径：{activeCount}</span>
                      <span>阻断路径：{blockedCount}</span>
                      <span>{changedByCondition ? "C 改变了独立性" : "当前 C 未改变总判断"}</span>
                    </div>
                  </>
                ) : checking ? (
                  <Skeleton active paragraph={{ rows: 2 }} title={false} />
                ) : (
                  <Empty description="等待系统枚举 A 与 B 之间的传播路径" />
                )}
              </article>

              <article className="cdag-dsep-compare">
                <header>
                  <strong>③ 对比判断</strong>
                </header>
                <div>
                  <ResultCard title="不给定 C" result={plainResult} muted={query.C.length > 0} />
                  <ResultCard title={query.C.length ? `给定 C = ${formatSet(query.C)}` : "当前：C = ∅"} result={result} />
                </div>
              </article>
            </div>

            <div className="cdag-flow-strip">
              <article>
                <span>01</span>
                <b>选定集合</b>
                <p>A={formatSet(query.A)}，B={formatSet(query.B)}</p>
              </article>
              <article>
                <span>02</span>
                <b>设置条件</b>
                <p>C={formatSet(query.C)}</p>
              </article>
              <article>
                <span>03</span>
                <b>枚举路径</b>
                <p>共 {(result?.paths || []).length} 条 A-B 路径</p>
              </article>
              <article>
                <span>04</span>
                <b>判定传播</b>
                <p>{result?.independent ? "全部阻断，条件独立" : "存在激活路径，不独立"}</p>
              </article>
            </div>

            <div className="cdag-path-list">
              {(result?.paths || []).map((path, index) => (
                <article className={`cdag-path-card ${path.active ? "is-active" : "is-blocked"}`} key={`${path.label}-${index}`}>
                  <header>
                    <Tag color={path.active ? "red" : "green"}>{path.active ? "影响可传播" : "路径被阻断"}</Tag>
                    <b>{path.label}</b>
                    <span>{path.reason}</span>
                  </header>
                  <PathFlow path={path} />
                  {path.triples?.length ? (
                    <div className="cdag-triple-list">
                      {path.triples.map((triple, tripleIndex) => (
                        <div className={triple.blocked ? "is-blocked" : "is-active"} key={`${triple.formula}-${tripleIndex}`}>
                          <Formula tone={triple.blocked ? "#16a34a" : "#dc2626"}>{triple.formula}</Formula>
                          <Tag color={triple.kind === "collider" ? "purple" : triple.kind === "fork" ? "orange" : "blue"}>{triple.kindLabel}</Tag>
                          <span>{triple.reason}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
              {!result?.paths?.length ? <Empty description="当前 A 与 B 之间暂无可枚举路径" /> : null}
            </div>
          </div>

          <aside className="cdag-dsep-graph">
            <CausalDagGraph
              variables={data.variables}
              edges={data.edges}
              highlightNodes={[...query.A, ...query.B]}
              conditionedNodes={query.C}
              caption="图：当前因果 DAG。A/B 查询节点与给定条件 C 会同步高亮；路径卡片展示每条传播路径是否被阻断。"
            />
            <div className="cdag-graph-note">
              <strong>图中传播关系</strong>
              <p>
                当前从 {formatSet(query.A)} 到 {formatSet(query.B)} 的路径由当前 DAG 自动枚举；当 C 命中链/分叉的中间节点时路径会阻断，命中汇连点时路径会被激活。
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="kb-panel kgb-section cdag-section is-s3">
        <div className="cdag-demo-head">
          <div>
            <strong>三种基本拓扑结构演示</strong>
            <p>按 PPT 中的链、分叉、汇连结构展示给定或不给定条件时的传播变化。</p>
          </div>
          <Space>
            <Button size="small" type={!structureConditioned ? "primary" : "default"} onClick={() => setStructureConditioned(false)}>
              不给定 C
            </Button>
            <Button size="small" type={structureConditioned ? "primary" : "default"} onClick={() => setStructureConditioned(true)}>
              给定中间节点 C
            </Button>
          </Space>
        </div>
        <div className="cdag-demo-grid">
          {DSEP_DEMOS.map((demo) => {
            const active = structureConditioned ? demo.activeWhenConditioned : demo.key !== "collider";
            return (
              <article className={`cdag-demo-card ${active ? "is-active" : "is-blocked"}`} key={demo.key}>
                <header>
                  <Tag color={active ? "red" : "green"}>{active ? "路径激活" : "路径阻断"}</Tag>
                  <strong>{demo.name}</strong>
                </header>
                <StructureDiagram type={demo.key} active={active} middle={demo.middle} />
                <Formula tone="#2563eb">{demo.formula}</Formula>
                <p>{structureConditioned ? demo.conditioned : demo.plain}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
