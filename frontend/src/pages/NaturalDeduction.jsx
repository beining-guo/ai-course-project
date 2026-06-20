import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Skeleton, Tag, Timeline, Tooltip, Typography } from "antd";
import {
  AimOutlined,
  BranchesOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  ExperimentOutlined,
  FunctionOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { getNaturalDeduction } from "../api/reasoning.js";
import { useStepPlayer } from "../hooks/useStepPlayer.js";
import StepPlayerBar from "../components/StepPlayerBar.jsx";

const { Paragraph, Title } = Typography;

const ruleCards = [
  {
    id: "∧I",
    icon: <BranchesOutlined />,
    name: "合取引入",
    formula: "RedLight(CarA), CausesCrash(CarA) ⇒ RedLight(CarA) ∧ CausesCrash(CarA)",
    text: "把两个已确认的事故事实合并成主责规则所需要的合取前提。",
    tone: "#5EC2B4",
  },
  {
    id: "∀E",
    icon: <NodeIndexOutlined />,
    name: "全称量词消去",
    formula: "∀x((RedLight(x) ∧ CausesCrash(x)) → MainResponsibility(x)) ⇒ (RedLight(CarA) ∧ CausesCrash(CarA)) → MainResponsibility(CarA)",
    text: "把通用交通定责规则实例化到车辆 A，得到本案可以直接使用的规则。",
    tone: "#17B0C2",
  },
  {
    id: "MP",
    icon: <FunctionOutlined />,
    name: "肯定前件式",
    formula: "RedLight(CarA) ∧ CausesCrash(CarA), 其蕴含 MainResponsibility(CarA) ⇒ MainResponsibility(CarA)",
    text: "当前件事实成立，且规则说明该前件蕴含结论时，推出车辆 A 承担主要责任。",
    tone: "#4181C6",
  },
  {
    id: "Z3",
    icon: <SafetyCertificateOutlined />,
    name: "Z3 Solver 校验",
    formula: "Facts ∧ Rule ∧ ¬MainResponsibility(CarA) ⇒ unsat",
    text: "若前提成立而结论不成立不可满足，说明该证明在逻辑上有效。",
    tone: "#15803D",
  },
];

const DERIVED_TONE = "#7263ae";

function StepFormula({ children }) {
  return <code className="nd-formula">{children}</code>;
}

export default function NaturalDeduction() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getNaturalDeduction(null, { example: "traffic" });
      setData(result);
    } catch (err) {
      setError(err?.message || "自然演绎推理服务暂不可用");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const proofSteps = useMemo(() => data?.steps || [], [data]);
  const player = useStepPlayer(proofSteps.length, { intervalMs: 1200 });
  const visibleProofSteps = proofSteps.slice(0, player.visible);

  if (loading) {
    return (
      <main className="page-shell reasoning-proof-page nd-page">
        <Skeleton active paragraph={{ rows: 14 }} />
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell reasoning-proof-page nd-page">
        <Alert
          type="error"
          showIcon
          message="自然演绎推理暂不可用"
          description="请确认后端服务已启动（python app.py），并已安装 z3-solver。"
          action={
            <Button icon={<ReloadOutlined />} onClick={load}>
              重试
            </Button>
          }
        />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="page-shell reasoning-proof-page nd-page">
        <Empty description="暂无推理数据" />
      </main>
    );
  }

  const profile = data.caseProfile || {};
  const premises = data.premises || [];

  return (
    <main className="page-shell reasoning-proof-page nd-page">
      <section className="proof-hero nd-hero">
        <div className="proof-hero-copy">
          <Tag className="proof-hero-tag">自然演绎推理 · 事故责任判定</Tag>
          <Title level={1}>自然演绎推理：智能网联汽车事故责任判定</Title>
          <Paragraph>
            本页对应前两个部分的选题内容：从事故知识库中的现场事实出发，先明确已知前提与待证责任结论，
            再动态演示“事实合取、规则实例化、肯定前件式、Z3 校验”的自然演绎过程。
          </Paragraph>
          <div className="proof-hero-tags">
            <Tag color="#0f766e">先列前提</Tag>
            <Tag color="#2563eb">再证结论</Tag>
            <Tag color="#7c3aed">动态推导</Tag>
            <Tag color="#15803d">Z3 Solver</Tag>
          </div>
        </div>
        <div className="proof-hero-board">
          <div className="proof-hero-board-head">
            <span>
              <AimOutlined />
            </span>
            <div>
              <strong>{profile.scene || "智能网联汽车事故责任辅助判定"}</strong>
              <small>事故事实推出责任结论</small>
            </div>
          </div>
          <StepFormula>{profile.summary}</StepFormula>
          <p className="proof-hero-summary">{data.proofIdea}</p>
          <div className={`proof-verdict ${data.proved ? "is-ok" : "is-fail"}`}>
            {data.proved ? <CheckCircleFilled /> : <ThunderboltOutlined />}
            <span>{data.proved ? "责任结论成立" : "责任结论未通过"}</span>
            <Tag className="proof-engine-tag" icon={<SafetyCertificateOutlined />}>
              {data.engine}
            </Tag>
          </div>
        </div>
      </section>

      <section className="proof-block nd-proof-map">
        <header className="proof-section-head">
          <span style={{ "--head-tone": "#2563eb" }}>
            <AimOutlined />
          </span>
          <div>
            <h2>第一步 · 明确前提与结论</h2>
            <p>这里是事故责任证明任务的输入，不参与动态播放；后面的播放器只演示真正的推导过程。</p>
          </div>
        </header>
        <div className="nd-proof-map-grid">
          <article className="is-premise">
            <span>Premises</span>
            <strong>已知前提</strong>
            <div>
              {premises.map((premise) => (
                <StepFormula key={premise.line}>{`(${premise.line}) ${premise.formula}`}</StepFormula>
              ))}
            </div>
          </article>
          <article className="is-goal">
            <span>Conclusion</span>
            <strong>待证结论</strong>
            <StepFormula>{data.conclusionFormula || data.goal}</StepFormula>
          </article>
          <article className="is-engine">
            <span>Engine</span>
            <strong>Z3 Solver 反证校验</strong>
            <StepFormula>{`Premises ∧ ¬(${data.goal}) = ${data.z3Verdict}`}</StepFormula>
          </article>
        </div>
      </section>

      <section className="proof-block">
        <header className="proof-section-head">
          <span>
            <ExperimentOutlined />
          </span>
          <div>
            <h2>采用的推理规则</h2>
            <p>自然演绎部分负责给出可读证明链，Z3 Solver 负责从语义层面复核车辆 A 主责结论是否有效。</p>
          </div>
        </header>
        <div className="nd-rule-grid">
          {ruleCards.map((rule) => (
            <article key={rule.id} className="is-used" style={{ "--rule-tone": rule.tone }}>
              <div className="nd-rule-top">
                <span className="nd-rule-icon">{rule.icon}</span>
                <span className="nd-rule-badge">{rule.id}</span>
                <Tag className="nd-rule-used" icon={<CheckCircleOutlined />}>
                  已采用
                </Tag>
              </div>
              <strong>{rule.name}</strong>
              <StepFormula>{rule.formula}</StepFormula>
              <p>{rule.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="proof-block">
        <header className="proof-section-head">
          <span style={{ "--head-tone": DERIVED_TONE }}>
            <BranchesOutlined />
          </span>
          <div>
            <h2>第二步 · 动态演示推导过程</h2>
            <p>从事故事实合取开始播放，依次实例化定责规则、应用肯定前件式，并用 Z3 Solver 复核主责结论。</p>
          </div>
        </header>
        {proofSteps.length === 0 ? (
          <Empty description="当前没有可演示的推理步骤" />
        ) : (
          <>
            <StepPlayerBar player={player} label="推理步骤" tone="#7263ae" />
            <Timeline
              className="nd-timeline"
              items={visibleProofSteps.map((step, idx) => {
                const isLatest = idx === visibleProofSteps.length - 1 && !player.done;
                return {
                  color: step.verified ? "green" : "blue",
                  dot: step.verified ? <CheckCircleFilled style={{ color: "#15803d" }} /> : undefined,
                  children: (
                    <div className={`nd-step-card step-reveal is-derive ${isLatest ? "is-active" : ""}`}>
                      <div className="nd-step-head">
                        <span className="nd-step-line">{`(${step.line})`}</span>
                        <strong className="nd-step-title">{step.rule}</strong>
                        <StepFormula>{step.formula}</StepFormula>
                        {step.verified ? (
                          <Tooltip title="该步已经过 Z3 Solver 复核，前提与结论否定共同不可满足。">
                            <Tag className="nd-verified" icon={<CheckCircleOutlined />}>
                              Z3 已校验
                            </Tag>
                          </Tooltip>
                        ) : null}
                      </div>
                      <div className="nd-step-meta">
                        <Tag className="nd-rule-name">{step.appliedRules?.join(" + ") || step.rule}</Tag>
                        {step.premises?.length ? (
                          <span className="nd-premise-ref">
                            由 {step.premises.map((p) => `(${p})`).join("、")} 得
                          </span>
                        ) : null}
                      </div>
                      <p className="nd-step-explain">{step.description}</p>
                    </div>
                  ),
                };
              })}
            />
          </>
        )}
      </section>

      <section
        className={`proof-conclusion ${data.proved ? "is-ok" : "is-fail"} ${
          player.done ? "is-revealed" : "is-pending"
        }`}
      >
        <span>
          <SafetyCertificateOutlined />
        </span>
        <div>
          <strong>{data.proved ? "推理结论：车辆 A 主责成立" : "推理结论：车辆 A 主责未证出"}</strong>
          <p>{data.conclusion}</p>
          <div className="proof-conclusion-foot">
            <StepFormula>{data.goal}</StepFormula>
            <Tag color="#15803d">Z3 Solver：{data.z3Verdict}</Tag>
          </div>
        </div>
      </section>
    </main>
  );
}
