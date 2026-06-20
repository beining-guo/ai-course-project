import { useEffect, useState } from "react";
import { Alert, Button, Empty, Skeleton, Table, Tag, Typography } from "antd";
import {
  AuditOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  FileSearchOutlined,
  PartitionOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { getMethodComparison } from "../api/reasoning.js";

const { Paragraph, Title } = Typography;

const COMPARE_ROWS = [
  { key: "idea", dim: "核心思想", nd: "正向推理：从事实出发，按规则逐步推出结论", res: "反证法：假设结论不成立，归结出矛盾（空子句）" },
  { key: "process", dim: "过程形态", nd: "线性证明链，每步一条新公式", res: "子句间反复归结，逐步消去文字" },
  { key: "rules", dim: "主要规则", nd: "全称特指、合取引入、肯定前件式", res: "子句化、互补文字归结、集合支持策略" },
  { key: "read", dim: "可读性", nd: "贴近人工推理，便于课堂讲解与人工检查", res: "更机械化，便于程序自动搜索" },
  { key: "auto", dim: "自动化", nd: "需要规则匹配与前向链控制", res: "天然适合自动定理证明器实现" },
  { key: "use", dim: "适用场景", nd: "展示推理依据、解释责任结论", res: "快速判定结论是否成立" },
];

export default function MethodComparison() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getMethodComparison();
      setData(result);
    } catch (err) {
      setError(err?.message || "双方法对比服务暂不可用");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <main className="page-shell reasoning-proof-page cmp-page">
        <Skeleton active paragraph={{ rows: 12 }} />
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell reasoning-proof-page cmp-page">
        <Alert
          type="error"
          showIcon
          message="双方法对比暂不可用"
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
      <main className="page-shell reasoning-proof-page cmp-page">
        <Empty description="暂无对比数据" />
      </main>
    );
  }

  const { natural = {}, resolution = {} } = data;

  const columns = [
    { title: "对比维度", dataIndex: "dim", width: 130, render: (v) => <strong className="cmp-dim">{v}</strong> },
    {
      title: (
        <span className="cmp-th nd">
          <PartitionOutlined /> 自然演绎推理
        </span>
      ),
      dataIndex: "nd",
    },
    {
      title: (
        <span className="cmp-th res">
          <FileSearchOutlined /> 归结演绎推理
        </span>
      ),
      dataIndex: "res",
    },
  ];

  return (
    <main className="page-shell reasoning-proof-page cmp-page">
      {/* Hero */}
      <section className="proof-hero cmp-hero">
        <div className="proof-hero-copy">
          <Tag className="proof-hero-tag">双方法对比 · Comparison</Tag>
          <Title level={1}>自然演绎 vs 归结演绎：同案例双重验证</Title>
          <Paragraph>
            对同一智能网联汽车事故案例，分别用自然演绎与归结演绎两种确定性推理方法判定责任，
            对照两者的推理路径、步骤规模与结论，互为印证，让责任结论更可信、更可解释。
          </Paragraph>
        </div>
        <div className={`cmp-consistency ${data.consistent ? "is-ok" : "is-fail"}`}>
          <SwapOutlined />
          <strong>{data.consistent ? "结论一致" : "结论不一致"}</strong>
          <p>{data.summary}</p>
          <Tag className="proof-engine-tag" icon={<SafetyCertificateOutlined />}>
            引擎 {data.engine}
          </Tag>
        </div>
      </section>

      {/* 两方法结论卡 */}
      <section className="cmp-method-grid">
        <article className="cmp-method-card is-nd">
          <div className="cmp-method-head">
            <span>
              <PartitionOutlined />
            </span>
            <div>
              <strong>自然演绎推理</strong>
              <small>前向链逐步证明</small>
            </div>
            {natural.proved ? (
              <Tag className="cmp-proved" icon={<CheckCircleOutlined />}>
                已证明
              </Tag>
            ) : (
              <Tag color="red">未证出</Tag>
            )}
          </div>
          <div className="cmp-metric-row">
            <div>
              <span>证明步数</span>
              <strong>{natural.stepCount}</strong>
            </div>
            <div>
              <span>采用规则</span>
              <strong>{natural.usedRules?.length || 0}</strong>
            </div>
          </div>
          <div className="cmp-rule-tags">
            {(natural.usedRules || []).map((r) => (
              <Tag key={r}>{r}</Tag>
            ))}
          </div>
          <p>{natural.conclusion}</p>
        </article>

        <div className="cmp-vs">
          <SwapOutlined />
          <span>VS</span>
        </div>

        <article className="cmp-method-card is-res">
          <div className="cmp-method-head">
            <span>
              <FileSearchOutlined />
            </span>
            <div>
              <strong>归结演绎推理</strong>
              <small>反证法归结反演</small>
            </div>
            {resolution.proved ? (
              <Tag className="cmp-proved" icon={<CheckCircleOutlined />}>
                已证明
              </Tag>
            ) : (
              <Tag color="red">未证出</Tag>
            )}
          </div>
          <div className="cmp-metric-row">
            <div>
              <span>子句数量</span>
              <strong>{resolution.clauseCount}</strong>
            </div>
            <div>
              <span>归结步数</span>
              <strong>{resolution.stepCount}</strong>
            </div>
            <div>
              <span>空子句</span>
              <strong>{resolution.derivedEmptyClause ? "□" : "—"}</strong>
            </div>
          </div>
          <div className="cmp-rule-tags">
            <Tag icon={<CheckCircleOutlined />} color="#15803d">
              Z3 验证：{resolution.z3Verdict}
            </Tag>
          </div>
          <p>{resolution.conclusion}</p>
        </article>
      </section>

      {/* 对比表 */}
      <section className="proof-block">
        <header className="proof-section-head">
          <span style={{ "--head-tone": "#4181C6" }}>
            <AuditOutlined />
          </span>
          <div>
            <h2>方法特点对照</h2>
            <p>从核心思想、过程形态、可读性、自动化等维度对照两种确定性推理方法。</p>
          </div>
        </header>
        <Table
          className="cmp-table"
          columns={columns}
          dataSource={COMPARE_ROWS}
          rowKey="key"
          pagination={false}
          size="middle"
        />
      </section>

      {/* 结论 */}
      <section className={`proof-conclusion ${data.consistent ? "is-ok" : "is-fail"}`}>
        <span>
          <CheckCircleFilled />
        </span>
        <div>
          <strong>综合结论</strong>
          <p>
            {data.consistent
              ? `两种方法对目标 ${data.goal} 给出一致结论，相互印证，责任判定结果可信。`
              : `两种方法结论存在差异，请检查知识库中的事实与规则。`}
          </p>
          <div className="proof-conclusion-foot">
            <code className="nd-formula">{data.goal}</code>
            <Tag color="#15803d">双方法 + Z3 三重验证</Tag>
          </div>
        </div>
      </section>
    </main>
  );
}
