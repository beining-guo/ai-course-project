import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import {
  ApartmentOutlined,
  ClearOutlined,
  DeleteOutlined,
  DeploymentUnitOutlined,
  EditOutlined,
  ExperimentOutlined,
  NodeIndexOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShareAltOutlined,
  SwapOutlined,
  TableOutlined,
  TeamOutlined,
  UndoOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  createRelationType,
  createMember,
  createRelation,
  clearFamilyGraph,
  deleteMember,
  deleteRelation,
  getFamilyGraph,
  resetFamilyGraph,
  setTargetPredicate,
  updateMember,
  updateRelation,
} from "../api/kg.js";
import FamilyRelationGraph, { buildFamilyRelationColorMap } from "../components/FamilyRelationGraph.jsx";
import "../styles/kg-overview.css";

const { Paragraph, Title } = Typography;

function StatCard({ icon, label, value, note }) {
  return (
    <Badge.Ribbon text={label}>
      <article>
        <span>{icon}</span>
        <div>
          <Statistic value={value} valueStyle={{ color: "#10201f", fontWeight: 950, fontSize: 28 }} />
          <p>{note}</p>
        </div>
      </article>
    </Badge.Ribbon>
  );
}

function Formula({ children, tone }) {
  return (
    <code className="kb-formula-code" style={tone ? { color: tone } : undefined}>
      {children}
    </code>
  );
}

const SYMMETRIC_QUERY = new Set(["Couple", "Sibling"]);

function findKnownRelations(relations, head, tail) {
  if (!head || !tail || head === tail) return [];
  return (relations || [])
    .filter((relation) => {
      const direct = relation.head === head && relation.tail === tail;
      const reverse = relation.head === tail && relation.tail === head;
      return direct || reverse;
    })
    .map((relation) => ({
      ...relation,
      direction:
        relation.head === head && relation.tail === tail
          ? "direct"
          : SYMMETRIC_QUERY.has(relation.predicate)
            ? "symmetric"
            : "reverse",
    }));
}

export default function FamilyKnowledgeBase() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("members");
  const [modalState, setModalState] = useState({ open: false, type: "member", mode: "create", record: null });
  const [saving, setSaving] = useState(false);
  const [targetSaving, setTargetSaving] = useState(false);
  const [addingRelationType, setAddingRelationType] = useState(false);
  const [newRelationType, setNewRelationType] = useState("");
  const [queryDraft, setQueryDraft] = useState({ head: undefined, tail: undefined });
  const [queryPair, setQueryPair] = useState(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getFamilyGraph();
      setData(result);
    } catch (err) {
      setError(err?.message || "家庭关系知识图谱加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const colorMap = useMemo(() => buildFamilyRelationColorMap(data?.relationTypes), [data]);

  const memberOptions = useMemo(
    () => (data?.members || []).map((m) => ({ label: m.name, value: m.name })),
    [data],
  );
  const predicateOptions = useMemo(
    () => (data?.relationTypes || []).map((rt) => ({ label: rt.label, value: rt.value })),
    [data],
  );
  const queryResult = useMemo(
    () => (queryPair ? findKnownRelations(data?.relations || [], queryPair.head, queryPair.tail) : []),
    [data?.relations, queryPair],
  );

  const factRows = useMemo(
    () =>
      (data?.relations || []).map((r) => ({
        ...r,
        binary: `${r.predicate}(${r.head}, ${r.tail})`,
        triple: `⟨${r.head}, ${r.predicate}, ${r.tail}⟩`,
      })),
    [data],
  );

  const handleTargetChange = async (value) => {
    setTargetSaving(true);
    try {
      const result = await setTargetPredicate(value);
      setData(result);
      message.success(`目标谓词已切换为 ${value}`);
    } catch (err) {
      message.error(err?.response?.data?.message || "切换目标谓词失败");
    } finally {
      setTargetSaving(false);
    }
  };

  const handleCreateRelationType = async () => {
    const value = newRelationType.trim();
    if (!value) {
      message.warning("请输入新的关系谓词名称");
      return;
    }
    setAddingRelationType(true);
    try {
      const result = await createRelationType({
        value,
        label: `${value} 自定义`,
        desc: "自定义二元关系",
      });
      setData(result);
      form.setFieldsValue({ predicate: value });
      setNewRelationType("");
      message.success(`已添加关系类型 ${value}`);
    } catch (err) {
      message.error(err?.response?.data?.message || "添加关系类型失败");
    } finally {
      setAddingRelationType(false);
    }
  };

  const handleQueryRelation = () => {
    if (!queryDraft.head || !queryDraft.tail) {
      message.warning("请选择两个要查询的实体");
      return;
    }
    if (queryDraft.head === queryDraft.tail) {
      message.warning("请选择两个不同实体");
      return;
    }
    setQueryPair(queryDraft);
  };

  const handleSwapQuery = () => {
    setQueryDraft((current) => ({ head: current.tail, tail: current.head }));
    setQueryPair((current) => (current ? { head: current.tail, tail: current.head } : current));
  };

  const openModal = (type, mode, record = null) => {
    setModalState({ open: true, type, mode, record });
    if (type === "member") {
      form.setFieldsValue({ name: record?.name, gender: record?.gender || "male" });
    } else {
      form.setFieldsValue({
        predicate: record?.predicate,
        head: record?.head,
        tail: record?.tail,
      });
    }
  };

  const closeModal = () => {
    setModalState({ open: false, type: "member", mode: "create", record: null });
    setNewRelationType("");
    form.resetFields();
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      let result;
      if (modalState.type === "member") {
        result =
          modalState.mode === "create"
            ? await createMember(values)
            : await updateMember(modalState.record.id, values);
      } else {
        result =
          modalState.mode === "create"
            ? await createRelation(values)
            : await updateRelation(modalState.record.id, values);
      }
      setData(result);
      message.success(modalState.mode === "create" ? "新增成功" : "修改成功");
      closeModal();
    } catch (err) {
      message.error(err?.response?.data?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type, id) => {
    try {
      const result = type === "member" ? await deleteMember(id) : await deleteRelation(id);
      setData(result);
      message.success("删除成功");
    } catch (err) {
      message.error(err?.response?.data?.message || "删除失败");
    }
  };

  const handleReset = async () => {
    try {
      const result = await resetFamilyGraph();
      setData(result);
      message.success("已恢复默认家庭关系知识图谱");
    } catch (err) {
      message.error(err?.response?.data?.message || "恢复失败");
    }
  };

  const handleClear = async () => {
    try {
      const result = await clearFamilyGraph();
      setData(result);
      message.success("已清空知识图谱，可从零开始构建");
    } catch (err) {
      message.error(err?.response?.data?.message || "清空失败");
    }
  };

  const memberColumns = [
    {
      title: "成员实体（节点）",
      dataIndex: "name",
      render: (value, record) => (
        <Space>
          <span className={`kgb-gender-dot is-${record.gender}`} />
          <strong>{value}</strong>
        </Space>
      ),
    },
    {
      title: "性别",
      dataIndex: "gender",
      width: 90,
      render: (value) =>
        value === "male" ? <Tag color="blue">男</Tag> : value === "female" ? <Tag color="magenta">女</Tag> : <Tag>未知</Tag>,
    },
    {
      title: "操作",
      width: 100,
      render: (_, record) => (
        <Space size={6}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal("member", "edit", record)} />
          <Popconfirm
            title="删除该成员？"
            description="将同时删除与其相关的所有关系"
            onConfirm={() => handleDelete("member", record.id)}
          >
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const relationColumns = [
    {
      title: "关系类型",
      dataIndex: "predicate",
      width: 110,
      render: (value) => (
        <Tag color={colorMap[value] || "#64748b"} style={{ color: "#fff", borderColor: "transparent" }}>
          {value}
        </Tag>
      ),
    },
    {
      title: "二元谓词（边）",
      render: (_, record) => <Formula>{`${record.predicate}(${record.head}, ${record.tail})`}</Formula>,
    },
    {
      title: "操作",
      width: 100,
      render: (_, record) => (
        <Space size={6}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal("relation", "edit", record)} />
          <Popconfirm title="删除该关系？" onConfirm={() => handleDelete("relation", record.id)}>
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const factColumns = [
    {
      title: "关系类型",
      dataIndex: "predicate",
      width: 120,
      render: (v) => (
        <Tag color={colorMap[v] || "#64748b"} style={{ color: "#fff", borderColor: "transparent" }}>
          {v}
        </Tag>
      ),
    },
    {
      title: "二元谓词形式 Predicate(head, tail)",
      render: (_, record) => <Formula>{record.binary}</Formula>,
    },
    {
      title: "三元组形式 ⟨head, relation, tail⟩",
      render: (_, record) => <Formula tone="#6d28d9">{record.triple}</Formula>,
    },
  ];

  if (loading) {
    return (
      <main className="page-shell kgb-page">
        <Skeleton active paragraph={{ rows: 14 }} />
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell kgb-page">
        <Alert
          type="error"
          showIcon
          message="家庭关系知识图谱暂不可用"
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
      <main className="page-shell kgb-page">
        <Empty description="暂无知识图谱数据" />
      </main>
    );
  }

  const samples = data.samples || { background: [], positives: [], negatives: [], counts: {} };

  return (
    <main className="page-shell kgb-page">
      {/* Hero */}
      <section className="kb-hero kgb-hero">
        <div className="kb-hero-copy">
          <Tag className="kb-section-tag">知识库的构建与表达</Tag>
          <Title level={1}>家庭关系知识库的构建与表达</Title>
          <Paragraph>
            从「增删改查」出发动态地构建家庭关系知识图谱——每新增一个成员就多一个节点，每新增一条关系就多一条边。再选定目标谓词，把所有事实统一表示为二元谓词
            / 三元组形式，并自动划分出 FOIL 所需的背景样例集合 B 与目标谓词训练样例（正例 E⁺、反例 E⁻）。
          </Paragraph>
          <div className="kb-hero-tags">
            <Tag color="#4f46e5">增删改查</Tag>
            <Tag color="#0891b2">动态构建</Tag>
            <Tag color="#7c3aed">二元谓词 / 三元组</Tag>
            <Tag color="#e11d48">目标谓词样例</Tag>
          </div>
        </div>
        <div className="kgb-flow-board">
          <strong>构建流程</strong>
          <ol>
            {[
              { t: "增删改查", d: "维护成员与关系", ic: <TableOutlined /> },
              { t: "构建图谱", d: "节点 + 有向边动态生成", ic: <ShareAltOutlined /> },
              { t: "选目标谓词", d: "确定要学习的关系 P", ic: <ExperimentOutlined /> },
              { t: "统一表示", d: "二元谓词 / 三元组", ic: <ApartmentOutlined /> },
              { t: "划分样例", d: "B / E⁺ / E⁻", ic: <DeploymentUnitOutlined /> },
            ].map((s, i) => (
              <li key={s.t}>
                <span className="kgb-flow-num">{i + 1}</span>
                <span className="kgb-flow-ic">{s.ic}</span>
                <span className="kgb-flow-copy">
                  <b>{s.t}</b>
                  <small>{s.d}</small>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 统计 */}
      <section className="kb-stat-grid">
        <StatCard icon={<TeamOutlined />} label="家庭成员" value={data.members.length} note="知识图谱中的实体 / 节点" />
        <StatCard icon={<ShareAltOutlined />} label="关系事实" value={data.relations.length} note="二元谓词 / 三元组 / 有向边" />
        <StatCard icon={<NodeIndexOutlined />} label="正例 E⁺" value={samples.counts?.positives ?? 0} note={`目标谓词 ${data.targetPredicate} 的已知实例`} />
        <StatCard icon={<DeploymentUnitOutlined />} label="反例 E⁻" value={samples.counts?.negatives ?? 0} note="由与目标相悖的已知关系构造" />
      </section>

      {/* ① 增删改查 + 动态构建图谱 */}
      <section className="kb-panel kgb-section is-s1">
        <div className="kb-panel-head">
          <div>
            <span>Step 01 · CRUD</span>
            <h2>① 增删改查：动态构建家庭关系知识图谱</h2>
          </div>
          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openModal(activeTab === "members" ? "member" : "relation", "create")}
            >
              新增{activeTab === "members" ? "成员" : "关系"}
            </Button>
            <Popconfirm title="恢复默认知识图谱？" description="将丢弃当前所有修改，回到课件示例图谱" onConfirm={handleReset}>
              <Button icon={<UndoOutlined />}>恢复默认</Button>
            </Popconfirm>
            <Popconfirm title="清空整个知识图谱？" description="将删除所有成员与关系，从零开始构建" onConfirm={handleClear}>
              <Button danger icon={<ClearOutlined />}>
                清空
              </Button>
            </Popconfirm>
          </Space>
        </div>
        <Paragraph className="kgb-copy">
          先新增家庭成员作为图谱的<b>节点</b>，再以「关系类型 + 头实体 + 尾实体」新增关系作为<b>有向边</b>——右侧图谱会随操作实时更新。删除成员会一并删除与其相关的关系；修改成员名称会自动同步到相关关系。可随时<b>清空</b>从零构建，或<b>恢复默认</b>课件示例图谱。
        </Paragraph>
        <div className="kgb-build-layout">
          <div className="kgb-build-left">
            <div className="kgb-build-crud">
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                  {
                    key: "members",
                    label: (
                      <span>
                        <UserOutlined /> 成员 ({data.members.length})
                      </span>
                    ),
                    children: <Table rowKey="id" columns={memberColumns} dataSource={data.members} pagination={{ pageSize: 6 }} size="small" />,
                  },
                  {
                    key: "relations",
                    label: (
                      <span>
                        <ShareAltOutlined /> 关系 ({data.relations.length})
                      </span>
                    ),
                    children: <Table rowKey="id" columns={relationColumns} dataSource={data.relations} pagination={{ pageSize: 8 }} size="small" />,
                  },
                ]}
              />
            </div>
            <div className="kgb-query-card">
              <header>
                <span>
                  <SearchOutlined /> 关系查询
                </span>
                <Tag color={queryPair ? (queryResult.length ? "green" : "default") : "blue"}>
                  {queryPair ? (queryResult.length ? "已知" : "未知") : "待查询"}
                </Tag>
              </header>
              <strong>查询两个实体在当前知识图谱中的已知关系</strong>
              <div className="kgb-query-controls">
                <Select
                  value={queryDraft.head}
                  options={memberOptions}
                  showSearch
                  placeholder="实体 A"
                  onChange={(value) => setQueryDraft((current) => ({ ...current, head: value }))}
                />
                <Button icon={<SwapOutlined />} onClick={handleSwapQuery} />
                <Select
                  value={queryDraft.tail}
                  options={memberOptions}
                  showSearch
                  placeholder="实体 B"
                  onChange={(value) => setQueryDraft((current) => ({ ...current, tail: value }))}
                />
                <Button type="primary" icon={<SearchOutlined />} onClick={handleQueryRelation}>
                  查询
                </Button>
              </div>
              {queryPair ? (
                <div className={`kgb-query-result ${queryResult.length ? "is-known" : "is-unknown"}`}>
                  <span>{queryPair.head} ↔ {queryPair.tail}</span>
                  {queryResult.length ? (
                    <div className="kgb-chip-list">
                      {queryResult.map((r) => (
                        <code key={`${r.id}-${r.direction}`} className="kgb-chip is-bg">
                          {`${r.predicate}(${r.head}, ${r.tail})${r.direction === "reverse" ? " · 反向已知" : ""}`}
                        </code>
                      ))}
                    </div>
                  ) : (
                    <b>未知</b>
                  )}
                </div>
              ) : (
                <p>只查询图谱中已经维护的事实；FOIL 推断出的新关系会在最终补全图中单独高亮。</p>
              )}
            </div>
          </div>
          <div className="kgb-build-graph">
            <FamilyRelationGraph
              members={data.members}
              relations={data.relations}
              target={data.targetPredicate}
              colorMap={colorMap}
              caption="图 · 当前家庭关系知识图谱：这里只展示已知事实；推断补全得到的新关系会在 FOIL 最终图中高亮标注。"
            />
          </div>
        </div>
      </section>

      {/* ② 选定目标谓词 */}
      <section className="kb-panel kgb-section is-s2">
        <div className="kb-panel-head">
          <div>
            <span>Step 02 · Target</span>
            <h2>② 选定目标谓词 P</h2>
          </div>
        </div>
        <div className="kgb-target-row">
          <div className="kgb-target-pick">
            <p>从图谱的关系类型中选出要让 FOIL 学习的目标关系，它将作为推理规则的头部 P(x, y)。切换后，下方正例 / 反例集合会随之重新划分。</p>
            <Space size={12} align="center" wrap>
              <Select
                className="kgb-target-select"
                value={data.targetPredicate}
                loading={targetSaving}
                onChange={handleTargetChange}
                options={predicateOptions}
                size="large"
              />
              <span className="kgb-target-arrow">⟶ 规则头</span>
              <Formula tone="#e11d48">{`${data.targetPredicate}(x, y)`}</Formula>
            </Space>
          </div>
          <div className="kgb-target-types">
            {(data.relationTypes || []).map((rt) => (
              <button
                key={rt.value}
                type="button"
                className={`kgb-type-chip ${rt.value === data.targetPredicate ? "is-active" : ""}`}
                style={{ "--chip": colorMap[rt.value] || "#64748b" }}
                onClick={() => rt.value !== data.targetPredicate && handleTargetChange(rt.value)}
              >
                <b>{rt.value}</b>
                <small>{rt.desc}</small>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ③ 事实的统一表示 */}
      <section className="kb-panel kgb-section is-s3">
        <div className="kb-panel-head">
          <div>
            <span>Step 03 · Representation</span>
            <h2>③ 将所有事实统一表示：二元谓词 / 三元组</h2>
          </div>
          <div className="kgb-repr-eg">
            <span>等价表示</span>
            <Formula>Father(David, Mike)</Formula>
            <em>＝</em>
            <Formula tone="#6d28d9">⟨David, Father, Mike⟩</Formula>
          </div>
        </div>
        <Paragraph className="kgb-copy">
          图谱中每条边都可以无损地写成二元谓词或等价的三元组——这正是「基于知识图谱推理」的逻辑基础：先把所有边转写为谓词事实，再在其上做归纳与演绎。
        </Paragraph>
        {factRows.length ? (
          <Table rowKey="id" columns={factColumns} dataSource={factRows} pagination={{ pageSize: 8 }} size="middle" />
        ) : (
          <Empty description="暂无关系事实，请先在上方新增关系" />
        )}
      </section>

      {/* ④ 样例集合 */}
      <section className="kb-panel kgb-section is-s4">
        <div className="kb-panel-head">
          <div>
            <span>Step 04 · Samples</span>
            <h2>④ 背景样例集合与目标谓词训练样例</h2>
          </div>
        </div>
        <div className="kgb-sample-lead">
          <article className="is-target">
            <span>目标谓词</span>
            <Formula tone="#e11d48">{`${data.targetPredicate}(x, y)`}</Formula>
            <small>作为 FOIL 要学习的规则头</small>
          </article>
          <article className="is-bg">
            <span>B</span>
            <strong>{samples.counts?.background ?? 0}</strong>
            <small>非目标谓词事实，用来生成候选前提</small>
          </article>
          <article className="is-pos">
            <span>E⁺</span>
            <strong>{samples.counts?.positives ?? 0}</strong>
            <small>目标谓词已知成立的正例</small>
          </article>
          <article className="is-neg">
            <span>E⁻</span>
            <strong>{samples.counts?.negatives ?? 0}</strong>
            <small>由非目标关系构造的反例</small>
          </article>
        </div>
        <div className="kgb-sample-grid">
          <article className="kgb-sample-card is-bg">
            <header>
              <div>
                <span className="kgb-card-kicker">候选材料</span>
                <strong>背景样例集合 B</strong>
              </div>
              <Tag>{samples.background.length} 条</Tag>
            </header>
            <p>除目标谓词外其他谓词的实例化结果，作为构造规则前提的候选材料。</p>
            <div className="kgb-chip-list">
              {samples.background.length ? (
                samples.background.map((f) => (
                  <code key={f} className="kgb-chip is-bg">
                    {f}
                  </code>
                ))
              ) : (
                <span className="kgb-empty">暂无背景事实</span>
              )}
            </div>
          </article>

          <article className="kgb-sample-card is-pos">
            <header>
              <div>
                <span className="kgb-card-kicker">学习目标</span>
                <strong>正例集合 E⁺</strong>
              </div>
              <Tag color="green">{samples.positives.length} 个</Tag>
            </header>
            <p>图谱中已知成立的目标谓词实例，驱动规则归纳（m₊）。</p>
            <div className="kgb-chip-list">
              {samples.positives.length ? (
                samples.positives.map((f) => (
                  <code key={f} className="kgb-chip is-pos">
                    {f}
                  </code>
                ))
              ) : (
                <span className="kgb-empty">暂无正例，请新增目标谓词的关系实例</span>
              )}
            </div>
          </article>

          <article className="kgb-sample-card is-neg">
            <header>
              <div>
                <span className="kgb-card-kicker">排除对象</span>
                <strong>反例集合 E⁻</strong>
              </div>
              <Tag color="red">{samples.negatives.length} 个</Tag>
            </header>
            <p>由与目标谓词相悖的已知关系构造而成（m₋）。</p>
            <div className="kgb-chip-list">
              {samples.negatives.length ? (
                samples.negatives.map((f) => (
                  <code key={f} className="kgb-chip is-neg">
                    {f}
                  </code>
                ))
              ) : (
                <span className="kgb-empty">暂无反例</span>
              )}
            </div>
          </article>
        </div>
        <div className="reasoning-summary-band kgb-summary">
          <ExperimentOutlined />
          <div>
            <strong>下一步：FOIL 规则归纳</strong>
            <p>
              当前已构建出正例 {samples.counts?.positives ?? 0} 个、反例 {samples.counts?.negatives ?? 0} 个、背景事实 {samples.counts?.background ?? 0} 条。
              进入「FOIL 规则归纳」页，即可在该知识图谱之上，用序贯覆盖与信息增益逐步学出可推出 {data.targetPredicate} 的一阶逻辑规则。
            </p>
          </div>
        </div>
      </section>

      <Modal
        title={`${modalState.mode === "create" ? "新增" : "编辑"}${modalState.type === "member" ? "成员" : "关系"}`}
        open={modalState.open}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={saving}
        width={560}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          {modalState.type === "member" ? (
            <>
              <Form.Item label="成员姓名" name="name" rules={[{ required: true, message: "请输入成员姓名" }]}>
                <Input placeholder="例如：David" />
              </Form.Item>
              <Form.Item label="性别" name="gender" initialValue="male">
                <Select
                  options={[
                    { label: "男", value: "male" },
                    { label: "女", value: "female" },
                    { label: "未知", value: "unknown" },
                  ]}
                />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item label="关系类型 Predicate" name="predicate" rules={[{ required: true, message: "请选择关系类型" }]}>
                <Select options={predicateOptions} showSearch placeholder="选择二元关系" />
              </Form.Item>
              <div className="kgb-custom-predicate">
                <Input
                  value={newRelationType}
                  onChange={(event) => setNewRelationType(event.target.value)}
                  onPressEnter={handleCreateRelationType}
                  placeholder="新增谓词类型，例如 Friend / Teaches / WorksWith"
                />
                <Button
                  icon={<PlusOutlined />}
                  loading={addingRelationType}
                  onClick={handleCreateRelationType}
                >
                  添加类型
                </Button>
              </div>
              <Form.Item label="头实体 head" name="head" rules={[{ required: true, message: "请选择头实体" }]}>
                <Select options={memberOptions} showSearch placeholder="关系的主语" />
              </Form.Item>
              <Form.Item label="尾实体 tail" name="tail" rules={[{ required: true, message: "请选择尾实体" }]}>
                <Select options={memberOptions} showSearch placeholder="关系的宾语" />
              </Form.Item>
              <Alert
                type="info"
                showIcon
                message="系统默认给出 Couple / Mother / Father / Sibling；也可以先添加自定义 Predicate，再用它构建新的二元关系。"
              />
            </>
          )}
        </Form>
      </Modal>
    </main>
  );
}
