import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Skeleton, Tag, Typography } from "antd";
import {
  ApartmentOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { getFoilResult } from "../api/kg.js";
import FamilyRelationGraph, {
  buildFamilyRelationColorMap,
  familyRelationKey,
} from "../components/FamilyRelationGraph.jsx";
import "../styles/kg-overview.css";

const { Paragraph, Title } = Typography;

function Formula({ children, tone }) {
  return (
    <code className="kb-formula-code" style={tone ? { color: tone } : undefined}>
      {children}
    </code>
  );
}

function BindingGrid({ binding = {} }) {
  const entries = Object.entries(binding);
  if (!entries.length) return <span className="kgb-empty">暂无变量绑定</span>;
  return (
    <div className="kgv-binding-grid">
      {entries.map(([name, value]) => (
        <span key={name}>
          <b>{name}</b>
          <i />
          <strong>{value}</strong>
        </span>
      ))}
    </div>
  );
}

function proofPathKeys(proof) {
  return (proof?.path || []).flatMap((step) => {
    const direct = familyRelationKey({ predicate: step.predicate, head: step.head, tail: step.tail });
    if (step.predicate === "Couple" || step.predicate === "Sibling") {
      return [direct, `${step.predicate}|${[step.head, step.tail].sort().join("|")}`];
    }
    return [direct];
  });
}

export default function FoilVerification() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedKey, setSelectedKey] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getFoilResult();
      setData(result);
      const first = result?.inferred?.[0];
      setSelectedKey(first ? `${first.predicate}|${first.head}|${first.tail}` : "");
    } catch (err) {
      setError(err?.message || "推理验证数据加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const colorMap = useMemo(() => buildFamilyRelationColorMap(data?.relationTypes), [data]);
  const inferredRelations = useMemo(
    () =>
      (data?.inferred || []).map((rel, index) => ({
        ...rel,
        id: rel.id || `infer-${index}-${rel.head}-${rel.tail}`,
        inferred: true,
      })),
    [data]
  );
  const completedRelations = useMemo(
    () => [...(data?.relations || []), ...inferredRelations],
    [data, inferredRelations]
  );
  const selected = inferredRelations.find((rel) => familyRelationKey(rel) === selectedKey) || inferredRelations[0] || null;
  const selectedProof = selected?.proof || null;
  const pathKeys = proofPathKeys(selectedProof);
  const inferredKeys = inferredRelations.map(familyRelationKey);
  const highlightKeys = selected ? [...pathKeys, familyRelationKey(selected)] : pathKeys;

  if (loading) {
    return (
      <main className="page-shell kgv-page">
        <Skeleton active paragraph={{ rows: 14 }} />
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell kgv-page">
        <Alert
          type="error"
          showIcon
          message="推理验证暂不可用"
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
      <main className="page-shell kgv-page">
        <Empty description="暂无推理验证数据" />
      </main>
    );
  }

  return (
    <main className="page-shell kgv-page">
      <section className="kb-hero kgv-hero">
        <div className="kb-hero-copy">
          <Tag className="kb-section-tag">推理验证</Tag>
          <Title level={1}>推理验证界面：新关系发现与可解释溯源</Title>
          <Paragraph>
            对 FOIL 学到的规则进行实例化验证，集中展示新发现的 {data.target} 关系；
            点击任一结果后，高亮触发规则、变量绑定、背景事实路径与最终补全边。
          </Paragraph>
          <div className="kb-hero-tags">
            <Tag color="#0d9488">新关系发现</Tag>
            <Tag color="#7c3aed">规则触发</Tag>
            <Tag color="#e11d48">路径高亮</Tag>
            <Tag color="#2563eb">结果校验</Tag>
          </div>
        </div>
        <div className="kgv-hero-board">
          <div>
            <NodeIndexOutlined />
            <span>新发现关系</span>
            <strong>{inferredRelations.length}</strong>
          </div>
          <div>
            <ExperimentOutlined />
            <span>触发规则</span>
            <strong>{new Set(inferredRelations.map((rel) => rel.proof?.ruleIndex ?? -1)).size}</strong>
          </div>
          <div>
            <BranchesOutlined />
            <span>溯源事实</span>
            <strong>{selectedProof?.path?.length || 0}</strong>
          </div>
        </div>
      </section>

      <div className="kgf-action-row">
        <Button icon={<ReloadOutlined />} onClick={loadData}>
          重新读取当前推理结果
        </Button>
      </div>

      <section className="kb-panel kgv-section">
        <div className="kb-panel-head">
          <div>
            <span>Discovery</span>
            <h2>① 新关系发现面板</h2>
          </div>
        </div>
        {inferredRelations.length ? (
          <div className="kgv-discovery-grid">
            {inferredRelations.map((rel, index) => {
              const key = familyRelationKey(rel);
              const active = key === selectedKey;
              return (
                <button
                  type="button"
                  key={key}
                  className={`kgv-discovery-card ${active ? "is-active" : ""}`.trim()}
                  onClick={() => setSelectedKey(key)}
                >
                  <span>NEW {String(index + 1).padStart(2, "0")}</span>
                  <strong>{rel.formula}</strong>
                  <small>点击查看触发规则与推导路径</small>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="kgv-empty-result">
            <CheckCircleOutlined />
            <strong>当前图谱没有新的 {data.target} 关系需要补全</strong>
            <p>规则已经验证完毕，已知事实中暂无可由规则推出但尚未存在的目标关系。</p>
          </div>
        )}
      </section>

      <section className="kb-panel kgv-section">
        <div className="kb-panel-head">
          <div>
            <span>Trace</span>
            <h2>② 推理溯源：规则、绑定与事实路径</h2>
          </div>
        </div>
        {selected ? (
          <div className="kgv-trace-layout">
            <article className="kgv-trace-panel">
              <div className="kgv-selected-result">
                <span>当前验证结果</span>
                <Formula tone="#e11d48">{selected.formula}</Formula>
              </div>

              <div className="kgv-proof-card is-rule">
                <header>
                  <SafetyCertificateOutlined />
                  <strong>触发规则 R{(selectedProof?.ruleIndex ?? 0) + 1}</strong>
                </header>
                <Formula tone="#047857">{selectedProof?.ruleFormula || "暂无规则"}</Formula>
              </div>

              <div className="kgv-proof-card">
                <header>
                  <ApartmentOutlined />
                  <strong>变量绑定</strong>
                </header>
                <BindingGrid binding={selectedProof?.binding} />
              </div>

              <div className="kgv-proof-card">
                <header>
                  <SearchOutlined />
                  <strong>推导路径</strong>
                </header>
                <div className="kgv-path-list">
                  {(selectedProof?.path || []).map((step, index) => (
                    <div className="kgv-path-step" key={`${step.literal}-${step.fact}-${index}`}>
                      <span>{index + 1}</span>
                      <div>
                        <b>{step.literal}</b>
                        <i>匹配事实</i>
                        <Formula tone={colorMap[step.predicate] || "#2563eb"}>{step.fact}</Formula>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <div className="kgv-graph-panel">
              <FamilyRelationGraph
                members={data.members || []}
                relations={completedRelations}
                target={data.target}
                colorMap={colorMap}
                inferredKeys={inferredKeys}
                highlightKeys={highlightKeys}
                className="is-verification"
                emptyDescription="暂无成员，无法绘制验证图谱"
                caption={`图 · 点击新发现关系后，高亮显示触发该 ${data.target} 结果的背景事实路径与补全边。`}
              />
            </div>
          </div>
        ) : (
          <Empty description="暂无可溯源的新关系" />
        )}
      </section>
    </main>
  );
}
