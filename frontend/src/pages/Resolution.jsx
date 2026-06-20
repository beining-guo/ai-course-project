import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Skeleton, Tag, Timeline, Tooltip, Typography } from "antd";
import {
  AimOutlined,
  ApiOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  MinusCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { getResolution } from "../api/reasoning.js";
import { useStepPlayer } from "../hooks/useStepPlayer.js";
import StepPlayerBar from "../components/StepPlayerBar.jsx";

const { Paragraph, Title } = Typography;

const CLAUSE_GROUPS = [
  { kind: "fact", label: "事实子句", tone: "#0f766e", icon: <DatabaseOutlined /> },
  { kind: "rule", label: "规则子句（蕴含化为析取）", tone: "#4181C6", icon: <ApiOutlined /> },
  { kind: "goal-negation", label: "目标否定子句", tone: "#8E4184", icon: <StopOutlined /> },
];

function Clause({ children }) {
  return <code className="res-clause">{children}</code>;
}

export default function Resolution() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getResolution();
      setData(result);
    } catch (err) {
      setError(err?.message || "归结演绎推理服务暂不可用");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const map = { fact: [], rule: [], "goal-negation": [], resolvent: [] };
    (data?.clauses || []).forEach((c) => {
      (map[c.kind] || (map[c.kind] = [])).push(c);
    });
    return map;
  }, [data]);

  const stepCount = data?.steps?.length || 0;
  const player = useStepPlayer(stepCount, { intervalMs: 1300 });
  const visibleSteps = (data?.steps || []).slice(0, player.visible);

  if (loading) {
    return (
      <main className="page-shell reasoning-proof-page res-page">
        <Skeleton active paragraph={{ rows: 14 }} />
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell reasoning-proof-page res-page">
        <Alert
          type="error"
          showIcon
          message="归结演绎推理暂不可用"
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
      <main className="page-shell reasoning-proof-page res-page">
        <Empty description="暂无推理数据" />
      </main>
    );
  }

  const profile = data.caseProfile || {};

  return (
    <main className="page-shell reasoning-proof-page res-page">
      {/* Hero */}
      <section className="proof-hero res-hero">
        <div className="proof-hero-copy">
          <Tag className="proof-hero-tag">归结演绎判定 · Resolution</Tag>
          <Title level={1}>归结演绎推理：反证法求出空子句</Title>
          <Paragraph>
            把事实、规则和「目标的否定」统一转化为子句集，反复对含互补文字的子句做归结。
            一旦推出空子句 □，即说明假设矛盾，反演成功，从而证明责任结论成立。全过程由 Z3 权威验证。
          </Paragraph>
          <div className="proof-hero-tags">
            <Tag color="#0f766e">子句化 CNF</Tag>
            <Tag color="#2563eb">集合支持策略</Tag>
            <Tag color="#7c3aed">归结反演</Tag>
            <Tag color="#8E4184">空子句 □</Tag>
          </div>
        </div>
        <div className="proof-hero-board">
          <div className="proof-hero-board-head">
            <span>
              <AimOutlined />
            </span>
            <div>
              <strong>反演目标</strong>
              <small>{profile.scene || "城市十字路口"}</small>
            </div>
          </div>
          <Clause>{data.goal}</Clause>
          <div className="res-negate-row">
            <span>加入目标否定</span>
            <Clause>¬{data.goal}</Clause>
          </div>
          <div className={`proof-verdict ${data.derivedEmptyClause ? "is-ok" : "is-fail"}`}>
            {data.derivedEmptyClause ? <CheckCircleFilled /> : <ThunderboltOutlined />}
            <span>{data.derivedEmptyClause ? "已得到空子句 □" : "未得到空子句"}</span>
            <Tag className="proof-engine-tag" icon={<SafetyCertificateOutlined />}>
              Z3 {data.z3Verdict}
            </Tag>
          </div>
        </div>
      </section>

      {/* 子句集 */}
      <section className="proof-block">
        <header className="proof-section-head">
          <span style={{ "--head-tone": "#17B0C2" }}>
            <FileSearchOutlined />
          </span>
          <div>
            <h2>第一步 · 构建子句集</h2>
            <p>
              事实直接作为单位子句；规则 (P ∧ Q → R) 化为析取子句 (¬P ∨ ¬Q ∨ R)；再加入目标否定子句，准备归结。
            </p>
          </div>
        </header>
        <div className="res-clause-groups">
          {CLAUSE_GROUPS.map((group) => {
            const items = grouped[group.kind] || [];
            if (!items.length) return null;
            return (
              <div className="res-clause-group" key={group.kind} style={{ "--group-tone": group.tone }}>
                <div className="res-clause-group-head">
                  <span>{group.icon}</span>
                  <strong>{group.label}</strong>
                  <Tag>{items.length}</Tag>
                </div>
                <div className="res-clause-list">
                  {items.map((c) => (
                    <article key={c.id}>
                      <span className="res-clause-id">C{c.id}</span>
                      <Clause>{c.text}</Clause>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 归结过程 */}
      <section className="proof-block">
        <header className="proof-section-head">
          <span style={{ "--head-tone": "#7263AE" }}>
            <ThunderboltOutlined />
          </span>
          <div>
            <h2>第二步 · 归结反演过程</h2>
            <p>点击播放，逐步演示归结：每一步选取含互补文字的两个亲本子句，消去互补文字得到归结式，直到推出空子句 □。</p>
          </div>
        </header>
        {data.steps?.length === 0 ? (
          <Empty description="无归结步骤" />
        ) : (
          <>
            <StepPlayerBar player={player} label="归结步骤" tone="#7263ae" />
            <Timeline
              className="res-timeline"
              items={visibleSteps.map((step, idx) => {
                const isLatest = idx === visibleSteps.length - 1 && !player.done;
                return {
                  color: step.isEmpty ? "green" : "blue",
                  dot: step.isEmpty ? <CheckCircleFilled style={{ color: "#15803d" }} /> : undefined,
                  children: (
                    <div
                      className={`res-step-card step-reveal ${step.isEmpty ? "is-empty" : ""} ${
                        isLatest ? "is-active" : ""
                      }`}
                    >
                      <div className="res-step-head">
                        <span className="res-step-no">归结 {step.step}</span>
                        <span className="res-step-parents">
                          C{step.parents[0]} <span>+</span> C{step.parents[1]}
                        </span>
                        <Tag className="res-step-cut" icon={<MinusCircleOutlined />}>
                          消去 {step.literal}
                        </Tag>
                      </div>
                      <div className="res-step-parents-text">
                        <Clause>{step.parentText[0]}</Clause>
                        <Clause>{step.parentText[1]}</Clause>
                      </div>
                      <div className="res-step-arrow">↓ 归结得到</div>
                      {step.isEmpty ? (
                        <div className="res-empty-clause">
                          <CheckCircleFilled />
                          <strong>空子句 □</strong>
                          <span>矛盾出现，反演成功</span>
                        </div>
                      ) : (
                        <Clause>
                          C{step.resolventId}：{step.resolvent}
                        </Clause>
                      )}
                    </div>
                  ),
                };
              })}
            />
          </>
        )}
      </section>

      {/* 结论 */}
      <section
        className={`proof-conclusion ${data.derivedEmptyClause ? "is-ok" : "is-fail"} ${
          player.done ? "is-revealed" : "is-pending"
        }`}
      >
        <span>
          <SafetyCertificateOutlined />
        </span>
        <div>
          <strong>{data.derivedEmptyClause ? "反演成功：责任成立" : "反演未完成"}</strong>
          <p>{data.conclusion}</p>
          <div className="proof-conclusion-foot">
            <Clause>{data.goal}</Clause>
            <Tag color="#15803d" icon={<CheckCircleOutlined />}>
              Z3 验证：{data.z3Verdict}
            </Tag>
          </div>
        </div>
      </section>
    </main>
  );
}
