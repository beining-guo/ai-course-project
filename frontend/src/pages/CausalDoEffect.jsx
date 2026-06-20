import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Segmented, Skeleton, Space, Table, Tag, Typography, message } from "antd";
import {
  BarChartOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
  FunctionOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { getCausalEffects } from "../api/causal.js";
import "../styles/kg-overview.css";

const { Paragraph } = Typography;

const DEMO_STAGES = [
  { label: "原始相关", value: "observed" },
  { label: "分层检查", value: "strata" },
  { label: "do 调整", value: "do" },
  { label: "ACE 结论", value: "ace" },
];

function Formula({ children, tone }) {
  return (
    <code className="kb-formula-code" style={tone ? { color: tone } : undefined}>
      {children}
    </code>
  );
}

function formatPercent(value, digits = 1) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`;
}

function formatPoint(value, digits = 2) {
  const number = Number(value || 0) * 100;
  return `${number >= 0 ? "+" : ""}${number.toFixed(digits)} 个百分点`;
}

function formatDecimal(value, digits = 4) {
  const number = Number(value || 0);
  return `${number >= 0 ? "+" : ""}${number.toFixed(digits)}`;
}

function buildCellsByKey(cells) {
  return Object.fromEntries((cells || []).map((cell) => [`${cell.x}-${cell.z}`, cell]));
}

function buildRawRows(study) {
  const cellsByKey = buildCellsByKey(study.analysis.cells);
  const zItems = study.analysis.zDistribution;
  const xItems = [
    { x: 0, label: study.treatment.untreated },
    { x: 1, label: study.treatment.treated },
  ];
  const metrics = [
    { key: "recovered", label: "恢复人数", render: (cell) => cell?.recovered ?? 0 },
    { key: "total", label: "总人数", render: (cell) => cell?.total ?? 0 },
    { key: "rate", label: "康复率", render: (cell) => formatPercent(cell?.rate, 1) },
  ];
  return metrics.map((metric) => {
    const row = { key: metric.key, metric: metric.label };
    xItems.forEach((xItem) => {
      zItems.forEach((zItem) => {
        row[`${xItem.x}-${zItem.z}`] = metric.render(cellsByKey[`${xItem.x}-${zItem.z}`]);
      });
    });
    return row;
  });
}

function rawColumns(study) {
  const zItems = study.analysis.zDistribution;
  const xItems = [
    { x: 0, label: study.treatment.untreated },
    { x: 1, label: study.treatment.treated },
  ];
  return [
    {
      title: "统计项",
      dataIndex: "metric",
      fixed: "left",
      width: 110,
      render: (value) => <strong>{value}</strong>,
    },
    ...xItems.map((xItem) => ({
      title: xItem.label,
      children: zItems.map((zItem) => ({
        title: zItem.zLabel,
        dataIndex: `${xItem.x}-${zItem.z}`,
        align: "center",
        width: 110,
      })),
    })),
  ];
}

function rateFraction(metric) {
  return `${metric.recovered}/${metric.total} = ${formatPercent(metric.rate, 1)}`;
}

function CellFraction({ cell }) {
  return (
    <span className="cdo-fraction">
      <b>{cell.recovered}</b>
      <i>/</i>
      <b>{cell.total}</b>
      <em>{formatPercent(cell.rate, 1)}</em>
    </span>
  );
}

function ObservationPanel({ study, active }) {
  const observed = study.analysis.observational;
  return (
    <article className={`cdo-demo-card is-observed ${active ? "is-active" : ""}`}>
      <header>
        <span>
          <BarChartOutlined />
        </span>
        <div>
          <strong>1. 原始条件概率：表面上“用药更差”</strong>
          <p>不控制 {study.confounder.name}，直接比较总体用药组和不用药组。</p>
        </div>
        <Tag color={observed.effect < 0 ? "red" : "green"}>{observed.label}</Tag>
      </header>
      <div className="cdo-equation-row">
        <Formula tone="#dc2626">P(Y=1 | X=1) = {rateFraction(observed.treated)}</Formula>
        <Formula tone="#0f766e">P(Y=1 | X=0) = {rateFraction(observed.untreated)}</Formula>
        <Formula tone={observed.effect < 0 ? "#dc2626" : "#16a34a"}>
          Δ_obs = {formatPoint(observed.effect)}
        </Formula>
      </div>
      <p className="cdo-card-note">
        因为 {study.treatment.treated} 人群中 {study.confounder.name} 分布不均，原始 P(Y|X) 混入了后门路径
        Z → X 与 Z → Y 的影响，不能直接当作药物因果效应。
      </p>
    </article>
  );
}

function StrataPanel({ study, active }) {
  return (
    <article className={`cdo-demo-card is-strata ${active ? "is-active" : ""}`}>
      <header>
        <span>
          <BranchesOutlined />
        </span>
        <div>
          <strong>2. 分层检查：每个 {study.confounder.name} 组内都显示药物有益</strong>
          <p>固定 Z 后比较 P(Y=1 | X, Z=z)，混淆变量不再在组内变化。</p>
        </div>
        <Tag color="green">组内效应均为正</Tag>
      </header>
      <div className="cdo-strata-grid">
        {study.analysis.subgroupEffects.map((item) => (
          <div className="cdo-strata-card" key={item.z}>
            <strong>{item.zLabel}</strong>
            <div>
              <span>{study.treatment.treated}</span>
              <CellFraction cell={item.treatedCell} />
            </div>
            <div>
              <span>{study.treatment.untreated}</span>
              <CellFraction cell={item.untreatedCell} />
            </div>
            <Formula tone="#16a34a">组内差 = {formatPoint(item.effect)}</Formula>
          </div>
        ))}
      </div>
    </article>
  );
}

function DoDiagram({ study }) {
  return (
    <svg className="cdo-do-svg" viewBox="0 0 760 420" role="img" aria-label="do operator backdoor adjustment diagram">
      <defs>
        <marker id="cdo-arrow-z" markerWidth="12" markerHeight="12" refX="9" refY="4" orient="auto">
          <path d="M0,0 L9,4 L0,8 Z" fill="#334155" />
        </marker>
        <marker id="cdo-arrow-effect" markerWidth="12" markerHeight="12" refX="9" refY="4" orient="auto">
          <path d="M0,0 L9,4 L0,8 Z" fill="#2563eb" />
        </marker>
      </defs>

      <path className="cdo-svg-edge is-z-y" d="M146 202 C266 56 488 52 620 192" markerEnd="url(#cdo-arrow-z)" />
      <path className="cdo-svg-edge is-cut" d="M146 226 C238 340 322 350 390 270" markerEnd="url(#cdo-arrow-z)" />
      <path className="cdo-svg-edge is-effect" d="M442 264 C498 244 552 222 618 210" markerEnd="url(#cdo-arrow-effect)" />

      <rect className="cdo-edge-label is-z-y" x="308" y="46" width="154" height="32" rx="16" />
      <text className="cdo-edge-label-text is-z-y" x="385" y="63">影响康复概率</text>
      <rect className="cdo-edge-label is-cut" x="170" y="266" width="154" height="32" rx="16" />
      <text className="cdo-edge-label-text is-cut" x="247" y="283">影响服药选择</text>
      <rect className="cdo-edge-label is-effect" x="512" y="260" width="122" height="32" rx="16" />
      <text className="cdo-edge-label-text is-effect" x="573" y="277">药物疗效</text>

      <g className="cdo-cut-mark" transform="translate(288 310)">
        <line x1="-14" y1="-22" x2="14" y2="22" />
        <line x1="14" y1="-22" x2="-14" y2="22" />
      </g>
      <text className="cdo-svg-label" x="287" y="354">do(X=x) 切断 Z → X</text>

      <g className="cdo-svg-node is-z" transform="translate(110 218)">
        <circle className="cdo-svg-node-ring" r="58" />
        <circle className="cdo-svg-node-core" r="51" />
        <text className="cdo-svg-node-key" y="-10">Z</text>
        <text className="cdo-svg-node-name" y="25">{study.confounder.name}</text>
      </g>
      <g className="cdo-svg-node is-x" transform="translate(404 260)">
        <circle className="cdo-svg-node-ring" r="58" />
        <circle className="cdo-svg-node-core" r="51" />
        <text className="cdo-svg-node-key" y="-10">X</text>
        <text className="cdo-svg-node-name" y="25">{study.treatment.name}</text>
      </g>
      <g className="cdo-svg-node is-y" transform="translate(654 205)">
        <circle className="cdo-svg-node-ring" r="58" />
        <circle className="cdo-svg-node-core" r="51" />
        <text className="cdo-svg-node-key" y="-10">Y</text>
        <text className="cdo-svg-node-name" y="25">{study.outcome.name}</text>
      </g>
    </svg>
  );
}

function BackdoorPanel({ study, active }) {
  const rows = study.analysis.backdoor.components;
  const columns = [
    { title: "z", dataIndex: "zLabel", width: 100, render: (value) => <strong>{value}</strong> },
    { title: "P(Z=z)", dataIndex: "weight", align: "center", render: (value) => formatPercent(value, 1) },
    { title: "P(Y=1|X=1,Z=z)", dataIndex: "treatedRate", align: "center", render: (value) => formatPercent(value, 1) },
    { title: "乘积", dataIndex: "treatedContribution", align: "center", render: (value) => value.toFixed(4) },
    { title: "P(Y=1|X=0,Z=z)", dataIndex: "untreatedRate", align: "center", render: (value) => formatPercent(value, 1) },
    { title: "乘积", dataIndex: "untreatedContribution", align: "center", render: (value) => value.toFixed(4) },
  ];

  return (
    <article className={`cdo-demo-card is-do ${active ? "is-active" : ""}`}>
      <header>
        <span>
          <FunctionOutlined />
        </span>
        <div>
          <strong>3. do 算子后门调整：统一按总体 P(Z=z) 加权</strong>
          <p>模拟干预 do(X=x) 时，切断所有进入 X 的后门边，再对 Z 求和。</p>
        </div>
        <Tag color="blue">后门调整</Tag>
      </header>
      <div className="cdo-adjust-layout">
        <DoDiagram study={study} />
        <div className="cdo-formula-stack">
          <Formula tone="#2563eb">{study.analysis.backdoor.formulaTreated}</Formula>
          <Formula tone="#0f766e">{study.analysis.backdoor.formulaUntreated}</Formula>
          <p>{study.doNote}</p>
        </div>
      </div>
      <Table
        className="cdo-component-table"
        columns={columns}
        dataSource={rows}
        pagination={false}
        rowKey="z"
        size="small"
        scroll={{ x: 760 }}
      />
      <div className="cdo-sum-row">
        <Formula tone="#2563eb">
          P(Y=1 | do(X=1)) = Σ 乘积 = {study.analysis.backdoor.treated.toFixed(4)} ={" "}
          {formatPercent(study.analysis.backdoor.treated, 2)}
        </Formula>
        <Formula tone="#0f766e">
          P(Y=1 | do(X=0)) = Σ 乘积 = {study.analysis.backdoor.untreated.toFixed(4)} ={" "}
          {formatPercent(study.analysis.backdoor.untreated, 2)}
        </Formula>
      </div>
      <div className="cdo-ace-subtraction">
        <span>ACE 因果效应差</span>
        <Formula tone={study.analysis.backdoor.ace > 0 ? "#16a34a" : "#dc2626"}>
          ACE = P(Y=1 | do(X=1)) - P(Y=1 | do(X=0)) = {study.analysis.backdoor.treated.toFixed(4)} -{" "}
          {study.analysis.backdoor.untreated.toFixed(4)} = {formatDecimal(study.analysis.backdoor.ace)} ={" "}
          {formatPoint(study.analysis.backdoor.ace)}
        </Formula>
      </div>
    </article>
  );
}

function AcePanel({ study, active }) {
  const conclusion = study.analysis.conclusion;
  return (
    <article className={`cdo-conclusion ${conclusion.reversal ? "is-reversal" : ""} ${active ? "is-active" : ""}`}>
      <span>
        <CheckCircleOutlined />
      </span>
      <div>
        <strong>4. 平均因果效应 ACE：{formatPoint(study.analysis.backdoor.ace)}</strong>
        <p>{conclusion.text}</p>
        <div className="cdo-conclusion-tags">
          <Tag color={conclusion.observationalHarm ? "red" : "green"}>
            原始 Δ_obs = {formatPoint(study.analysis.observational.effect)}
          </Tag>
          <Tag color={conclusion.causalEffective ? "green" : "red"}>ACE = {formatDecimal(study.analysis.backdoor.ace)}</Tag>
          <Tag color={conclusion.reversal ? "purple" : "blue"}>
            {conclusion.reversal ? "辛普森悖论已消除" : "以 do 调整结论为准"}
          </Tag>
        </div>
      </div>
    </article>
  );
}

function DatasetSummary({ study }) {
  const observed = study.analysis.observational;
  const backdoor = study.analysis.backdoor;
  return (
    <div className="cdo-summary-grid">
      <article className="cdo-summary-card is-bad">
        <span>总体观察差</span>
        <strong>{formatPoint(observed.effect)}</strong>
        <p>{observed.treated.label} {formatPercent(observed.treated.rate, 1)}，{observed.untreated.label} {formatPercent(observed.untreated.rate, 1)}</p>
      </article>
      <article className="cdo-summary-card is-good">
        <span>do 调整后 ACE</span>
        <strong>{formatPoint(backdoor.ace)}</strong>
        <p>{formatPercent(backdoor.treated, 2)} - {formatPercent(backdoor.untreated, 2)}</p>
      </article>
      <article className="cdo-summary-card is-neutral">
        <span>样本总量</span>
        <strong>{study.analysis.total}</strong>
        <p>{study.analysis.zDistribution.map((item) => `${item.zLabel} ${formatPercent(item.probability, 1)}`).join("，")}</p>
      </article>
    </div>
  );
}

function HeroFormula({ study }) {
  const observed = study.analysis.observational;
  const backdoor = study.analysis.backdoor;
  return (
    <div className="cdo-hero-grid">
      <article className="cdo-hero-formula">
        <span>核心公式</span>
        <Formula tone="#2563eb">P(Y=1 | do(X=x)) = Σ_z P(Y=1 | X=x, Z=z)P(Z=z)</Formula>
        <Formula tone="#7c3aed">ACE = P(Y=1 | do(X=1)) - P(Y=1 | do(X=0))</Formula>
      </article>
      <article className="cdo-hero-verdict">
        <span>本页结论</span>
        <strong>{formatPoint(backdoor.ace)}</strong>
        <p>
          原始观察差为 {formatPoint(observed.effect)}，后门调整后 ACE = {formatDecimal(backdoor.ace)}。
          “药效有害”来自 Z 的混淆，真正因果效应为正。
        </p>
      </article>
    </div>
  );
}

function ProcessRoadmap({ stage, onStageChange }) {
  const items = [
    { value: "observed", no: "01", title: "原始相关", desc: "先看到药效有害假象" },
    { value: "strata", no: "02", title: "分层检查", desc: "固定 Z 后组内均有益" },
    { value: "do", no: "03", title: "do 调整", desc: "按 P(Z=z) 重新加权" },
    { value: "ace", no: "04", title: "ACE 结论", desc: "得到正向因果效应" },
  ];

  return (
    <div className="cdo-roadmap" aria-label="do 算子效应计算流程">
      {items.map((item) => (
        <button
          className={stage === item.value ? "is-active" : ""}
          key={item.value}
          onClick={() => onStageChange(item.value)}
          type="button"
        >
          <span>{item.no}</span>
          <strong>{item.title}</strong>
          <small>{item.desc}</small>
        </button>
      ))}
    </div>
  );
}

function GenerationPanel({ study }) {
  if (!study.generation) return null;

  return (
    <section className="kb-panel kgb-section cdag-section cdo-section is-s4">
      <div className="kb-panel-head">
        <div>
          <span>Page 04 · Simulation</span>
          <h2>第二组数据：线性结构方程 + 高斯噪声生成</h2>
        </div>
        <Tag color="blue">seed = {study.generation.seed}</Tag>
      </div>
      <div className="cdo-generation-grid">
        <article>
          <header>
            <ExperimentOutlined />
            <strong>生成式模型</strong>
          </header>
          <div className="cdo-sem-list">
            {study.generation.steps.map((step, index) => (
              <Formula key={step} tone={index === 2 ? "#16a34a" : "#2563eb"}>
                {step}
              </Formula>
            ))}
          </div>
        </article>
        <article>
          <header>
            <NodeIndexOutlined />
            <strong>因果含义</strong>
          </header>
          <p>{study.generation.interpretation}</p>
          <p>
            样本量 n={study.generation.sampleSize}，生成后仍使用同一后门调整公式计算 ACE，验证系统能够推广到非课件数据。
          </p>
        </article>
      </div>
    </section>
  );
}

export default function CausalDoEffect() {
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stage, setStage] = useState("observed");

  const desiredKey = location.pathname.includes("do-simulation") ? "sem-simulated" : "courseware-simpson";

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getCausalEffects();
      setData(result);
    } catch (err) {
      setError(err?.message || "do 算子效应数据加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setStage("observed");
  }, [desiredKey]);

  const study = useMemo(() => {
    if (!data?.studies?.length) return null;
    return data.studies.find((item) => item.key === desiredKey) || data.studies[0];
  }, [data, desiredKey]);

  if (loading) {
    return (
      <main className="page-shell cdag-page cdo-page">
        <Skeleton active paragraph={{ rows: 14 }} />
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell cdag-page cdo-page">
        <Alert
          type="error"
          showIcon
          message="do 算子效应计算暂不可用"
          description="请确认后端服务已启动，并刷新页面。"
          action={
            <Button icon={<ReloadOutlined />} onClick={loadData}>
              重试
            </Button>
          }
        />
      </main>
    );
  }

  if (!study) {
    return (
      <main className="page-shell cdag-page cdo-page">
        <Empty description="暂无 do 算子效应数据" />
      </main>
    );
  }

  return (
    <main className="page-shell cdag-page cdo-page">
      <section className="kb-panel kgb-section cdag-section cdo-section is-s3">
        <div className="kb-panel-head">
          <div>
            <span>Page {study.page} · do-Calculus</span>
            <h2>{study.title}</h2>
          </div>
          <Space wrap>
            <Button
              type={desiredKey === "courseware-simpson" ? "primary" : "default"}
              icon={<FunctionOutlined />}
              onClick={() => navigate("/causal/do-effect")}
            >
              第一组课件数据
            </Button>
            <Button
              type={desiredKey === "sem-simulated" ? "primary" : "default"}
              icon={<ExperimentOutlined />}
              onClick={() => navigate("/causal/do-simulation")}
            >
              第二组模拟数据
            </Button>
          </Space>
        </div>
        <Paragraph className="kgb-copy">
          {study.story} 这里的目标不是估计普通相关性，而是计算平均因果效应：
          <Formula tone="#2563eb">ACE = P(Y=1 | do(X=1)) - P(Y=1 | do(X=0))</Formula>
        </Paragraph>
        <HeroFormula study={study} />
        <ProcessRoadmap stage={stage} onStageChange={setStage} />
        <div className="cdo-stage-row">
          <Segmented options={DEMO_STAGES} value={stage} onChange={setStage} />
          <Formula tone={study.analysis.conclusion.reversal ? "#7c3aed" : "#2563eb"}>
            {study.analysis.conclusion.reversal
              ? "原始结论为负，do 调整结论为正"
              : "使用后门调整后的 ACE 作为因果结论"}
          </Formula>
        </div>
      </section>

      <GenerationPanel study={study} />

      <section className="kb-panel kgb-section cdag-section cdo-section is-s2">
        <div className="kb-panel-head">
          <div>
            <span>Data Table</span>
            <h2>读入数据表：{study.source}</h2>
          </div>
          <Tag color="cyan">{study.confounder.name} Z 为后门调整变量</Tag>
        </div>
        <Table
          className="cdo-raw-table"
          columns={rawColumns(study)}
          dataSource={buildRawRows(study)}
          pagination={false}
          bordered
          size="small"
          scroll={{ x: 620 }}
        />
      </section>

      <section className="kb-panel kgb-section cdag-section cdo-section is-s1">
        <div className="kb-panel-head">
          <div>
            <span>Demo & Compare</span>
            <h2>演示对比：从“药效有害”假象到 do 算子纠偏</h2>
          </div>
          <Tag color={stage === "ace" ? "green" : "blue"}>当前阶段：{DEMO_STAGES.find((item) => item.value === stage)?.label}</Tag>
        </div>
        <div className="cdo-demo-stack">
          <ObservationPanel study={study} active={stage === "observed"} />
          <StrataPanel study={study} active={stage === "strata"} />
          <BackdoorPanel study={study} active={stage === "do"} />
          <AcePanel study={study} active={stage === "ace"} />
        </div>
      </section>

      <section className="kb-panel kgb-section cdag-section cdo-section is-s4">
        <div className="kb-panel-head">
          <div>
            <span>Final Comparison</span>
            <h2>结论对照：相关性结论与因果结论为何相反</h2>
          </div>
          <SwapOutlined className="cdo-head-icon" />
        </div>
        <div className="cdo-final-grid">
          <article className="is-wrong">
            <strong>只看原始 P(Y|X)</strong>
            <Formula tone="#dc2626">
              P(Y=1|X=1) - P(Y=1|X=0) = {formatDecimal(study.analysis.observational.effect)}
            </Formula>
            <p>总体样本中治疗选择受 Z 影响，因此这个差值包含混淆偏差。</p>
          </article>
          <article className="is-right">
            <strong>使用 do(X) 后门调整</strong>
            <Formula tone="#16a34a">
              P(Y=1|do(X=1)) - P(Y=1|do(X=0)) = {formatDecimal(study.analysis.backdoor.ace)}
            </Formula>
            <p>统一按总体 P(Z=z) 加权后，Z 带来的偏差被消除，ACE 给出真正因果效应。</p>
          </article>
        </div>
      </section>
    </main>
  );
}
