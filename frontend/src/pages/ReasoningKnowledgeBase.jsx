import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Descriptions,
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
} from "antd";
import {
  ApiOutlined,
  CodeOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  FileProtectOutlined,
  FunctionOutlined,
  SearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import {
  createReasoningFact,
  createReasoningRule,
  deleteReasoningFact,
  deleteReasoningRule,
  getReasoningKnowledgeBase,
  updateReasoningFact,
  updateReasoningRule,
} from "../api/reasoning.js";

const { Paragraph, Title } = Typography;

const confidenceOptions = [
  { label: "确定", value: "确定" },
  { label: "待核验", value: "待核验" },
  { label: "推断", value: "推断" },
];

const methodOptions = [
  { label: "自然演绎 / 归结演绎", value: "自然演绎 / 归结演绎" },
  { label: "自然演绎", value: "自然演绎" },
  { label: "归结演绎", value: "归结演绎" },
];

const predicateTheme = {
  对象类型: {
    "--predicate-color": "#0f766e",
    "--predicate-soft": "#edf8f5",
    "--predicate-border": "#cce9e2",
  },
  行为事实: {
    "--predicate-color": "#0284c7",
    "--predicate-soft": "#eef8ff",
    "--predicate-border": "#c8e8f8",
  },
  因果事实: {
    "--predicate-color": "#2563eb",
    "--predicate-soft": "#eef4ff",
    "--predicate-border": "#cfddff",
  },
  碰撞关系: {
    "--predicate-color": "#4f46e5",
    "--predicate-soft": "#f1f0ff",
    "--predicate-border": "#d9d6ff",
  },
  违规事实: {
    "--predicate-color": "#be185d",
    "--predicate-soft": "#fff1f6",
    "--predicate-border": "#f7c9dc",
  },
  路权事实: {
    "--predicate-color": "#16a34a",
    "--predicate-soft": "#effaf1",
    "--predicate-border": "#ccefd3",
  },
  让行事实: {
    "--predicate-color": "#0d9488",
    "--predicate-soft": "#ecfdf9",
    "--predicate-border": "#c6eee7",
  },
  状态事实: {
    "--predicate-color": "#64748b",
    "--predicate-soft": "#f4f7fb",
    "--predicate-border": "#d9e0ea",
  },
  责任结论: {
    "--predicate-color": "#7c3aed",
    "--predicate-soft": "#f6f0ff",
    "--predicate-border": "#dfd0ff",
  },
};

const requirementCards = [
  {
    key: "a",
    icon: <FunctionOutlined />,
    title: "a）形式化过程",
    text: "自然语言事故描述要逐步转换为对象、谓词、事实公式和规则公式，并说明每一步思路。",
    accent: "#5EC2B4",
  },
  {
    key: "b",
    icon: <CodeOutlined />,
    title: "b）代码实现",
    text: "代码段中要清楚包含 Fact 事实和 Rule 规则，例如 RedLight(CarA) 与全称责任规则。",
    accent: "#4181C6",
  },
  {
    key: "c",
    icon: <DatabaseOutlined />,
    title: "c）增删改查",
    text: "知识库需要支持事实和规则的新增、查询、修改、删除，为后续推理提供可维护输入。",
    accent: "#8E4184",
  },
];

function splitList(value) {
  if (Array.isArray(value)) return value;
  return String(value || "")
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function Formula({ children }) {
  return <code className="kb-formula-code">{children}</code>;
}

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

export default function ReasoningKnowledgeBase() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("facts");
  const [searchText, setSearchText] = useState("");
  const [modalState, setModalState] = useState({ open: false, type: "fact", mode: "create", record: null });
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getReasoningKnowledgeBase();
      setData(result);
    } catch (err) {
      setError(err?.message || "事故知识库加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const predicateOptions = useMemo(() => {
    return (data?.predicates || []).map((item) => ({
      label: item.name.split("(")[0],
      value: item.name.split("(")[0],
    }));
  }, [data]);

  const filteredFacts = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return data?.facts || [];
    return (data?.facts || []).filter((item) =>
      [item.formula, item.naturalLanguage, item.source, item.confidence, item.predicate]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [data, searchText]);

  const filteredRules = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return data?.rules || [];
    return (data?.rules || []).filter((item) =>
      [item.name, item.formula, item.naturalLanguage, item.method, item.conclusion, ...(item.premises || [])]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [data, searchText]);

  const openModal = (type, mode, record = null) => {
    setModalState({ open: true, type, mode, record });
    if (type === "fact") {
      form.setFieldsValue({
        predicate: record?.predicate,
        arguments: record?.arguments?.join(", "),
        formula: record?.formula,
        naturalLanguage: record?.naturalLanguage,
        source: record?.source || "手动维护",
        confidence: record?.confidence || "确定",
      });
    } else {
      form.setFieldsValue({
        name: record?.name,
        formula: record?.formula,
        premises: record?.premises?.join(", "),
        conclusion: record?.conclusion,
        naturalLanguage: record?.naturalLanguage,
        method: record?.method || "自然演绎 / 归结演绎",
      });
    }
  };

  const closeModal = () => {
    setModalState({ open: false, type: "fact", mode: "create", record: null });
    form.resetFields();
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (modalState.type === "fact") {
        const payload = {
          ...values,
          arguments: splitList(values.arguments),
        };
        if (modalState.mode === "create") {
          await createReasoningFact(payload);
        } else {
          await updateReasoningFact(modalState.record.id, payload);
        }
      } else {
        const payload = {
          ...values,
          premises: splitList(values.premises),
        };
        if (modalState.mode === "create") {
          await createReasoningRule(payload);
        } else {
          await updateReasoningRule(modalState.record.id, payload);
        }
      }
      closeModal();
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type, id) => {
    if (type === "fact") {
      await deleteReasoningFact(id);
    } else {
      await deleteReasoningRule(id);
    }
    await loadData();
  };

  const factsColumns = [
    {
      title: "事实公式",
      dataIndex: "formula",
      width: 230,
      render: (value) => <Formula>{value}</Formula>,
    },
    {
      title: "自然语言说明",
      dataIndex: "naturalLanguage",
      render: (value, record) => (
        <div className="kb-table-main">
          <strong>{value}</strong>
          <small>{record.source}</small>
        </div>
      ),
    },
    {
      title: "可信度",
      dataIndex: "confidence",
      width: 92,
      render: (value) => <Tag color={value === "确定" ? "green" : value === "推断" ? "blue" : "gold"}>{value}</Tag>,
    },
    {
      title: "操作",
      width: 140,
      render: (_, record) => (
        <Space size={6}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal("fact", "edit", record)} />
          <Popconfirm title="删除这条事实？" onConfirm={() => handleDelete("fact", record.id)}>
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const rulesColumns = [
    {
      title: "规则名称",
      dataIndex: "name",
      width: 210,
      render: (value, record) => (
        <div className="kb-table-main">
          <strong>{value}</strong>
          <small>{record.method}</small>
        </div>
      ),
    },
    {
      title: "规则公式",
      dataIndex: "formula",
      render: (value) => <Formula>{value}</Formula>,
    },
    {
      title: "前提 / 结论",
      width: 260,
      render: (_, record) => (
        <div className="kb-rule-io">
          <div>
            {record.premises?.map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
          </div>
          <Formula>{record.conclusion}</Formula>
        </div>
      ),
    },
    {
      title: "操作",
      width: 140,
      render: (_, record) => (
        <Space size={6}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal("rule", "edit", record)} />
          <Popconfirm title="删除这条规则？" onConfirm={() => handleDelete("rule", record.id)}>
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <main className="page-shell reasoning-kb-page">
        <Skeleton active paragraph={{ rows: 14 }} />
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell reasoning-kb-page">
        <Alert
          type="error"
          showIcon
          message="事故知识库暂不可用"
          description="请确认后端服务已启动，并刷新页面。"
          action={<Button icon={<ReloadOutlined />} onClick={loadData}>重试</Button>}
        />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="page-shell reasoning-kb-page">
        <Empty description="暂无事故知识库数据" />
      </main>
    );
  }

  return (
    <main className="page-shell reasoning-kb-page">
      <section className="kb-hero">
        <div className="kb-hero-copy">
          <Tag className="kb-section-tag">事故知识库</Tag>
          <Title level={1}>{data.meta.title}</Title>
          <div className="kb-hero-tags">
            <Tag color="#0f766e">Fact 事实</Tag>
            <Tag color="#2563eb">Rule 规则</Tag>
            <Tag color="#7c3aed">Predicate 谓词</Tag>
            <Tag color="#c2410c">CRUD 增删改查</Tag>
          </div>
        </div>
        <div className="kb-case-card">
          <span><SafetyCertificateOutlined /></span>
          <div>
            <strong>{data.caseProfile.scene}</strong>
            <p>{data.caseProfile.summary}</p>
            <Descriptions
              className="kb-case-descriptions"
              column={1}
              items={[
                { key: "case", label: "案例目标", children: <Formula>{data.caseProfile.goal}</Formula> },
                { key: "engine", label: "推理引擎", children: data.meta.engineTarget },
              ]}
              size="small"
            />
          </div>
        </div>
      </section>

      <section className="kb-requirement-strip">
        {requirementCards.map((item) => (
          <article key={item.key} style={{ "--requirement-color": item.accent }}>
            <span>{item.icon}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="kb-stat-grid">
        <StatCard icon={<DatabaseOutlined />} label="事故事实" value={data.facts.length} note="可新增、修改、删除和查询" />
        <StatCard icon={<FileProtectOutlined />} label="责任规则" value={data.rules.length} note="用于自然演绎和归结演绎" />
        <StatCard icon={<FunctionOutlined />} label="谓词定义" value={data.predicates.length} note="统一事实和规则的表达口径" />
        <StatCard icon={<ApiOutlined />} label="接口能力" value="CRUD" note="后端提供知识库维护接口" />
      </section>

      <div className="kb-sequence-layout">
        <section className="kb-panel kb-sequence-section is-formalization">
          <div className="kb-panel-head">
            <div>
              <span>Requirement A</span>
              <h2>a）形式化过程：自然语言知识转化为逻辑公式</h2>
            </div>
          </div>
          <Paragraph className="kb-section-copy">
            按照“事故自然语言描述 → 对象抽取 → 谓词定义 → 事实公式 → 规则公式”的路线，把智能网联汽车事故责任知识转换为推理工具能够接受的逻辑表达。
          </Paragraph>
          <div className="kb-formal-track">
            {data.formalizationSteps.map((item, index) => (
              <article key={item.title}>
                <span>{index + 1 < data.formalizationSteps.length ? "✓" : String(index + 1)}</span>
                <strong>{item.title}</strong>
              </article>
            ))}
          </div>
          <div className="kb-step-grid">
            {data.formalizationSteps.map((item, index) => (
              <article key={item.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.title}</strong>
                <p>{item.content}</p>
                <Formula>{item.output}</Formula>
              </article>
            ))}
          </div>

          <div className="kb-subhead">
            <div>
              <span>Predicate Table</span>
              <h3>谓词说明表</h3>
            </div>
          </div>
          <div className="kb-predicate-grid">
            {data.predicates.map((item) => (
              <article key={item.name} style={predicateTheme[item.type]}>
                <div>
                  <Formula>{item.name}</Formula>
                  <Tag>{item.type}</Tag>
                </div>
                <p>{item.description}</p>
                <small>{item.example}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="kb-panel kb-sequence-section is-code">
          <div className="kb-panel-head">
            <div>
              <span>Requirement B</span>
              <h2>b）代码实现：清晰展示 Fact 与 Rule</h2>
            </div>
          </div>
          <Paragraph className="kb-section-copy">
            代码层将“具体事故证据”保存为 Fact，将“责任判定条件”保存为 Rule。Fact 用于描述案例事实，Rule 用于自然演绎或归结演绎时推出责任结论。
          </Paragraph>
          <div className="kb-code-list kb-code-showcase">
            {data.codeSnippets.map((item) => (
              <article key={item.title}>
                <div>
                  <CodeOutlined />
                  <strong>{item.title}</strong>
                  <Tag>{item.language}</Tag>
                </div>
                <Formula>{item.code}</Formula>
              </article>
            ))}
          </div>
        </section>

        <section className="kb-panel kb-sequence-section is-crud">
          <div className="kb-panel-head">
            <div>
              <span>Requirement C</span>
              <h2>c）知识库增删改查：事实库与规则库维护</h2>
            </div>
            <Space>
              <Input
                allowClear
                className="kb-search-input"
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="查询公式、来源或说明"
                prefix={<SearchOutlined />}
                value={searchText}
              />
              <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
              <Button
                icon={<PlusOutlined />}
                onClick={() => openModal(activeTab === "facts" ? "fact" : "rule", "create")}
                type="primary"
              >
                新增{activeTab === "facts" ? "事实" : "规则"}
              </Button>
            </Space>
          </div>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: "facts",
                label: `事实 Fact (${filteredFacts.length}/${data.facts.length})`,
                children: (
                  <Table
                    rowKey="id"
                    columns={factsColumns}
                    dataSource={filteredFacts}
                    pagination={{ pageSize: 6 }}
                    size="middle"
                  />
                ),
              },
              {
                key: "rules",
                label: `规则 Rule (${filteredRules.length}/${data.rules.length})`,
                children: (
                  <Table
                    rowKey="id"
                    columns={rulesColumns}
                    dataSource={filteredRules}
                    pagination={{ pageSize: 5 }}
                    size="middle"
                  />
                ),
              },
            ]}
          />
        </section>
      </div>

      <Modal
        title={`${modalState.mode === "create" ? "新增" : "编辑"}${modalState.type === "fact" ? "事实" : "规则"}`}
        open={modalState.open}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={saving}
        width={760}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          {modalState.type === "fact" ? (
            <>
              <Form.Item label="谓词 Predicate" name="predicate" rules={[{ required: true, message: "请选择或输入谓词" }]}>
                <Select options={predicateOptions} showSearch />
              </Form.Item>
              <Form.Item label="参数 Arguments" name="arguments" rules={[{ required: true, message: "请输入参数" }]}>
                <Input placeholder="例如：CarA, CarB" />
              </Form.Item>
              <Form.Item label="事实公式 Formula" name="formula">
                <Input placeholder="为空时后端会按 Predicate(arguments) 自动生成" />
              </Form.Item>
              <Form.Item label="自然语言说明" name="naturalLanguage" rules={[{ required: true, message: "请输入事实说明" }]}>
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item label="证据来源" name="source">
                <Input />
              </Form.Item>
              <Form.Item label="可信度" name="confidence">
                <Select options={confidenceOptions} />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item label="规则名称" name="name" rules={[{ required: true, message: "请输入规则名称" }]}>
                <Input />
              </Form.Item>
              <Form.Item label="规则公式" name="formula" rules={[{ required: true, message: "请输入规则公式" }]}>
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item label="前提 Premises" name="premises">
                <Input placeholder="例如：RedLight(x), CausesCrash(x)" />
              </Form.Item>
              <Form.Item label="结论 Conclusion" name="conclusion" rules={[{ required: true, message: "请输入规则结论" }]}>
                <Input placeholder="例如：MainResponsibility(x)" />
              </Form.Item>
              <Form.Item label="自然语言说明" name="naturalLanguage" rules={[{ required: true, message: "请输入规则说明" }]}>
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item label="适用推理方法" name="method">
                <Select options={methodOptions} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </main>
  );
}
