import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Skeleton, Tag, Typography } from "antd";
import {
  AimOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  FunctionOutlined,
  MinusCircleOutlined,
  NodeIndexOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import StepPlayerBar from "../components/StepPlayerBar.jsx";
import { useStepPlayer } from "../hooks/useStepPlayer.js";
import { getFoilResult } from "../api/kg.js";
import FamilyRelationGraph, {
  buildFamilyRelationColorMap,
  familyRelationKey,
} from "../components/FamilyRelationGraph.jsx";
import "../styles/kg-overview.css";

const { Paragraph, Title } = Typography;
const VAR_ORDER = ["x", "y", "z", "w", "u", "v", "t", "r", "s"];

function Formula({ children, tone }) {
  return (
    <code className="kb-formula-code" style={tone ? { color: tone } : undefined}>
      {children}
    </code>
  );
}

function gainText(value) {
  return value === null || value === undefined ? "NA" : value;
}

function ruleQuantifier(rule) {
  const text = `${rule?.formula || ""} ${(rule?.body || []).join(" ")}`;
  const found = new Set();
  const argGroups = text.matchAll(/\(([^()]+)\)/g);
  for (const group of argGroups) {
    group[1]
      .split(",")
      .map((item) => item.trim())
      .filter((item) => /^[a-z]$/.test(item))
      .forEach((item) => found.add(item));
  }
  const vars = VAR_ORDER.filter((item) => found.has(item));
  return (vars.length ? vars : ["x", "y"]).map((item) => `(∀${item})`).join("");
}

function trialStatusText({ tested, current, best, roundDone }) {
  if (!tested) return "等待试算";
  if (current && !roundDone) return "正在填表";
  if (best) return "本轮最大";
  return "已比较";
}

function SampleSet({ title, items = [], tone = "keep" }) {
  return (
    <div className={`kgf-sample-set is-${tone}`}>
      <span>{title}</span>
      <div>
        {items.length ? (
          items.map((item) => <code key={item}>{item}</code>)
        ) : (
          <em>∅</em>
        )}
      </div>
    </div>
  );
}

function FoilRoundBoard({ round, visible }) {
  const baselineVisible = visible > round.baselineStep;
  const samplesVisible = visible > round.samplesStep;
  const tableStarted = visible > round.tableStart;
  const revealedCount = Math.max(0, Math.min(round.candidateTotal, visible - round.tableStart));
  const complete = round.candidateTotal > 0 && visible > round.end;
  const activeRow = complete ? -1 : revealedCount - 1;
  const progress = round.candidateTotal ? Math.round((revealedCount / round.candidateTotal) * 100) : 0;

  return (
    <article className={`kgf-round-card ${complete ? "is-complete" : "is-active"}`.trim()}>
      <header className="kgf-round-card-head">
        <div>
          <span>内循环 · 第 {round.roundIndex + 1} 轮</span>
          <h3>{complete ? "本轮已完成，结果固定保留" : `正在逐条试算候选文字 ${revealedCount} / ${round.candidateTotal}`}</h3>
        </div>
        <Tag color={complete ? "green" : "purple"}>{complete ? "已选出最大增益" : "构建表格中"}</Tag>
      </header>

      <div className="kgf-round-steps">
        {baselineVisible ? (
          <section className="kgf-round-step is-baseline">
          <b>1. 先计算本轮基准</b>
          <div className="kgf-round-baseline">
            <Formula>{round.baseRule}</Formula>
            <span>m₊={round.basePos} · m₋={round.baseNeg}</span>
          </div>
          </section>
        ) : null}

        {samplesVisible ? (
          <section className="kgf-round-step is-samples">
          <b>2. 本轮训练样例集合</b>
          <div className="kgf-round-sample-grid">
            <SampleSet title={`正例 E⁺（${round.beforePos?.length || 0}）`} items={round.beforePos} tone="keep" />
            <SampleSet title={`反例 E⁻（${round.beforeNeg?.length || 0}）`} items={round.beforeNeg} tone="neg" />
          </div>
          </section>
        ) : null}

        {samplesVisible ? (
          <section className="kgf-round-step is-table">
          <div className="kgf-round-table-head">
            <b>3. 构建候选试算表</b>
            <span>{tableStarted ? `${revealedCount} / ${round.candidateTotal} 行已填入` : "等待逐行试算"}</span>
          </div>
          <div className="kgf-round-fill-track">
            <i style={{ width: `${progress}%` }} />
          </div>
          {tableStarted ? (
            <div className="kgf-candidate-table-wrap is-round-table">
              <table className="kgf-candidate-table">
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>拟加入前提约束谓词</th>
                    <th>m̂₊</th>
                    <th>m̂₋</th>
                    <th>FOIL Gain</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {(round.candidates || []).map((candidate, index) => {
                    const tested = index < revealedCount;
                    const current = index === activeRow;
                    const best = complete && round.chosen === candidate.literal;
                    return (
                      <tr
                        key={`${round.ruleIndex}-${round.roundIndex}-${candidate.literal}`}
                        className={`kgf-candidate-row ${tested ? "is-tested" : ""} ${current ? "is-current" : ""} ${best ? "is-best" : ""}`.trim()}
                      >
                        <td><span>{String(index + 1).padStart(2, "0")}</span></td>
                        <td><code>{candidate.literal}</code></td>
                        <td>{tested ? candidate.coverPos : "—"}</td>
                        <td>{tested ? candidate.coverNeg : "—"}</td>
                        <td>{tested ? gainText(candidate.gain) : "—"}</td>
                        <td>
                          <mark>{trialStatusText({ tested, current, best, roundDone: complete })}</mark>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="kgf-table-wait">下一步开始把候选前提约束谓词逐条加入规则并计算 FOIL 信息增益。</p>
          )}
          </section>
        ) : null}

        {complete ? (
          <section className="kgf-round-step is-prune">
            <b>4. 选择最大增益并划掉不符样例</b>
            <div className="kgf-round-choice-board">
              <div>
                <span>选入前提</span>
                <strong>{round.chosen || "无有效候选"}</strong>
                <small>Gain={gainText(round.chosenStats?.gain)} · m̂₊={round.chosenStats?.coverPos ?? "—"} · m̂₋={round.chosenStats?.coverNeg ?? "—"}</small>
              </div>
              {round.filterRule ? <Formula tone="#047857">{round.filterRule}</Formula> : null}
            </div>
            <div className="kgf-prune-grid">
              <SampleSet title="划掉不符正例" items={round.removedPos} tone="remove" />
              <SampleSet title="划掉不符反例" items={round.removedNeg} tone="remove" />
              <SampleSet title="保留到下一轮的正例" items={round.afterPos} tone="keep" />
              <SampleSet title="保留到下一轮的反例" items={round.afterNeg} tone="neg" />
            </div>
          </section>
        ) : null}
      </div>
    </article>
  );
}

function buildTrialProcess(trace = []) {
  const trialSteps = [];
  const roundMeta = [];
  let cursor = 0;

  trace.forEach((ruleTrace, ruleIndex) => {
    const start = cursor;
    (ruleTrace.rounds || []).forEach((round, roundIndex) => {
      const candidates = round.candidates || [];
      const baselineStep = cursor;
      trialSteps.push({ type: "baseline", ruleIndex, roundIndex, round, ruleTrace });
      cursor += 1;
      const samplesStep = cursor;
      trialSteps.push({ type: "samples", ruleIndex, roundIndex, round, ruleTrace });
      cursor += 1;
      const tableStart = cursor;
      const roundStart = cursor;
      const roundEnd = cursor + candidates.length - 1;
      roundMeta.push({
        ...round,
        ruleIndex,
        roundIndex,
        start: baselineStep,
        baselineStep,
        samplesStep,
        tableStart,
        end: roundEnd,
        candidateTotal: candidates.length,
      });
      candidates.forEach((candidate, candidateIndex) => {
        trialSteps.push({
          ...candidate,
          ruleIndex,
          roundIndex,
          roundStart,
          roundEnd,
          candidateIndex,
          candidateTotal: candidates.length,
          round,
          ruleTrace,
          isChosen: candidate.literal === round.chosen,
        });
        cursor += 1;
      });
    });
  });

  return { trialSteps, roundMeta };
}

export default function FoilReasoning() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getFoilResult();
      setData(result);
    } catch (err) {
      setError(err?.message || "FOIL 推理结果加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const process = useMemo(() => buildTrialProcess(data?.trace || []), [data]);
  const { trialSteps, roundMeta } = process;
  const player = useStepPlayer(trialSteps.length, { intervalMs: 420 });
  const { visible } = player;
  const visibleRounds = roundMeta.filter((round) => visible > round.start);
  const revealFinal = trialSteps.length > 0 && visible >= trialSteps.length;

  if (loading) {
    return (
      <main className="page-shell kgf-page">
        <Skeleton active paragraph={{ rows: 14 }} />
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell kgf-page">
        <Alert
          type="error"
          showIcon
          message="FOIL 推理暂不可用"
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

  if (!data) {
    return (
      <main className="page-shell kgf-page">
        <Empty description="暂无推理数据" />
      </main>
    );
  }

  const noPositives = (data.positives || []).length === 0;
  const colorMap = buildFamilyRelationColorMap(data.relationTypes);
  const inferredRelations = (data.inferred || []).map((rel, index) => ({
    ...rel,
    id: rel.id || `infer-${index}-${rel.head}-${rel.tail}`,
    inferred: true,
  }));
  const completedRelations = [...(data.relations || []), ...inferredRelations];
  const inferredKeys = inferredRelations.map(familyRelationKey);

  return (
    <main className="page-shell kgf-page">
      {/* Hero */}
      <section className="kb-hero kgf-hero">
        <div className="kb-hero-copy">
          <Tag className="kb-section-tag">FOIL 规则归纳</Tag>
          <Title level={1}>FOIL 推理过程：从知识图谱归纳逻辑规则</Title>
          <Paragraph>
            基于「知识库构建」页所构建的家庭关系知识图谱，以目标谓词{" "}
            <Formula tone="#fde68a">{`${data.target}(x, y)`}</Formula> 为规则头，运行 FOIL 算法：
            序贯覆盖逐条学规则，每条规则内部从一般到特殊、用信息增益逐个挑选前提约束谓词，最终把规则实例化补全图谱中缺失的关系。
          </Paragraph>
          <div className="kb-hero-tags">
            <Tag color="#4f46e5">序贯覆盖</Tag>
            <Tag color="#0891b2">从一般到特殊</Tag>
            <Tag color="#7c3aed">信息增益</Tag>
            <Tag color="#e11d48">规则补全</Tag>
          </div>
        </div>
        <div className="kgf-hero-board">
          <div className="kgf-hero-formula">
            <FunctionOutlined />
            <span>FOIL 信息增益值</span>
          </div>
          <Formula tone="#a5b4fc">{"FOIL_Gain = m̂₊·( log₂(m̂₊/(m̂₊+m̂₋)) − log₂(m₊/(m₊+m₋)) )"}</Formula>
          <div className="kgf-hero-stats">
            <div>
              <b>{(data.positives || []).length}</b>
              <small>正例 E⁺</small>
            </div>
            <div>
              <b>{(data.negatives || []).length}</b>
              <small>反例 E⁻</small>
            </div>
            <div>
              <b>{(data.rules || []).length}</b>
              <small>学到规则</small>
            </div>
            <div>
              <b>{(data.inferred || []).length}</b>
              <small>补全关系</small>
            </div>
          </div>
        </div>
      </section>

      <div className="kgf-action-row">
        <Button icon={<ReloadOutlined />} onClick={loadData}>
          重新基于当前图谱推理
        </Button>
      </div>

      {/* 输入：目标谓词与样例集合 */}
      <section className="kb-panel kgf-section">
        <div className="kb-panel-head">
          <div>
            <span>Input</span>
            <h2>① 推理输入：目标谓词与训练样例</h2>
          </div>
        </div>
        <div className="kgf-input-grid">
          <article className="kgf-input-card is-target">
            <header>
              <AimOutlined />
              <strong>目标谓词 P（规则头）</strong>
            </header>
            <Formula tone="#e11d48">{`${data.target}(x, y)`}</Formula>
          </article>
          <article className="kgf-input-card is-pos">
            <header>
              <PlusCircleOutlined />
              <strong>正例 E⁺（m₊ = {(data.positives || []).length}）</strong>
            </header>
            <div className="kgb-chip-list">
              {(data.positives || []).map((p) => (
                <code key={p} className="kgb-chip is-pos">
                  {p}
                </code>
              ))}
            </div>
          </article>
          <article className="kgf-input-card is-neg">
            <header>
              <MinusCircleOutlined />
              <strong>反例 E⁻（m₋ = {(data.negatives || []).length}）</strong>
            </header>
            <div className="kgb-chip-list">
              {(data.negatives || []).map((p) => (
                <code key={p} className="kgb-chip is-neg">
                  {p}
                </code>
              ))}
            </div>
          </article>
          <article className="kgf-input-card is-bg">
            <header>
              <DatabaseOutlined />
              <strong>背景样例 B</strong>
            </header>
            <div className="kgb-chip-list">
              {(data.background || []).map((p) => (
                <code key={p} className="kgb-chip is-bg">
                  {p}
                </code>
              ))}
            </div>
          </article>
        </div>
      </section>

      {noPositives ? (
        <Alert
          className="kgf-section"
          type="warning"
          showIcon
          message="当前图谱没有目标谓词的正例"
          description={`请先到「知识库构建」页，新增若干 ${data.target} 关系作为正例 E⁺，FOIL 才能归纳出规则。`}
        />
      ) : (
        <>
          {/* 逐步过程 */}
          <section className="kb-panel kgf-section">
            <div className="kb-panel-head">
              <div>
                <span>Process</span>
                <h2>② 归纳过程：逐轮挑选前提约束谓词（信息增益最大）</h2>
              </div>
            </div>
            <StepPlayerBar player={player} label="FOIL 归纳进度" tone="#6d28d9" />

            <div className="kgf-round-stack">
              {visibleRounds.length ? (
                visibleRounds.map((round) => (
                  <FoilRoundBoard key={`round-board-${round.ruleIndex}-${round.roundIndex}`} round={round} visible={visible} />
                ))
              ) : (
                <div className="kgf-process-empty">
                  <ThunderboltOutlined />
                  点击播放，开始第 1 轮：基准、样例、填表、划掉不符样例会按顺序展开。
                </div>
              )}
            </div>
          </section>

          {/* 最终规则 */}
          {revealFinal ? (
            <section className="kb-panel kgf-section kgf-reveal">
              <div className="kb-panel-head">
                <div>
                  <span>Rules</span>
                  <h2>③ 学到的推理规则集 R</h2>
                </div>
              </div>
              <div className="kgf-rule-list">
                {(data.rules || []).map((rule, i) => (
                  <article className="kgf-rule-card" key={rule.formula}>
                    <span className="kgf-rule-index">R{i + 1}</span>
                    <div>
                      <Formula tone="#047857">{`${ruleQuantifier(rule)}( ${rule.formula} )`}</Formula>
                      <div className="kgf-rule-covered">
                        <span>覆盖正例：</span>
                        {rule.covered.length ? (
                          rule.covered.map((c) => (
                            <code key={c} className="kgb-chip is-pos">
                              {c}
                            </code>
                          ))
                        ) : (
                          <code className="kgb-chip is-bg">∅</code>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {/* 关系补全 */}
          {revealFinal ? (
            <section className="kb-panel kgf-section kgf-reveal">
              <div className="kb-panel-head">
                <div>
                  <span>Completion</span>
                  <h2>④ 规则实例化：补全图谱中缺失的关系</h2>
                </div>
              </div>
              <Paragraph className="kgb-copy">
                把学到的规则实例化到具体成员（演绎推理），即可推出图谱中原本不存在的 {data.target} 关系，完成知识图谱补全。
              </Paragraph>
              <div className="kgb-chip-list kgf-inferred">
                {(data.inferred || []).length ? (
                  (data.inferred || []).map((rel) => (
                    <code key={rel.formula} className="kgb-chip is-infer">
                      <NodeIndexOutlined /> {rel.formula}
                    </code>
                  ))
                ) : (
                  <span className="kgb-empty">规则未推出新的关系（图谱中已无可补全的实例）</span>
                )}
              </div>
              <div className="kgf-completed-graph">
                <FamilyRelationGraph
                  members={data.members || []}
                  relations={completedRelations}
                  target={data.target}
                  colorMap={colorMap}
                  inferredKeys={inferredKeys}
                  className="is-completed"
                  emptyDescription="暂无成员，无法绘制补全图谱"
                  caption={`图 · FOIL 补全后的家庭关系知识图谱：虚线高亮边为根据规则新推出的 ${data.target} 关系。`}
                />
              </div>
              <div className="reasoning-summary-band kgf-summary">
                <CheckCircleOutlined />
                <div>
                  <strong>推理闭环小结</strong>
                  <p>
                    FOIL 用「序贯覆盖 + 从一般到特殊 + 信息增益」三件套，从家庭图谱零散的关系中归纳出 {(data.rules || []).length} 条可解释的一阶逻辑规则，
                    并据此补全了 {(data.inferred || []).length} 条缺失的 {data.target} 关系——这正是「从数据归纳规则、再用规则补全图谱」的完整闭环。
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <div className="kgf-pending">
              <ThunderboltOutlined /> 播放或单步执行上方过程，完成后将展示最终规则集与补全结果。
            </div>
          )}
        </>
      )}
    </main>
  );
}
