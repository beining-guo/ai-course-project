import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Space,
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
  EditOutlined,
  NodeIndexOutlined,
  PlusOutlined,
  ReloadOutlined,
  ShareAltOutlined,
  TableOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import {
  clearCausalDag,
  createCausalEdge,
  createCausalVariable,
  deleteCausalEdge,
  deleteCausalVariable,
  getCausalDag,
  resetCausalDag,
  updateCausalEdge,
  updateCausalVariable,
} from "../api/causal.js";
import CausalDagGraph from "../components/CausalDagGraph.jsx";
import "../styles/kg-overview.css";

const { Paragraph, Title } = Typography;

const ROLE_OPTIONS = [
  { label: "混淆变量", value: "confounder" },
  { label: "干预变量", value: "treatment" },
  { label: "结果变量", value: "outcome" },
  { label: "中介变量", value: "mediator" },
  { label: "协变量", value: "covariate" },
];

const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map((item) => [item.value, item.label]));
const ROLE_COLOR = {
  confounder: "orange",
  treatment: "blue",
  outcome: "green",
  mediator: "purple",
  covariate: "default",
};

function Formula({ children, tone }) {
  return (
    <code className="kb-formula-code" style={tone ? { color: tone } : undefined}>
      {children}
    </code>
  );
}

function splitValues(value) {
  if (Array.isArray(value)) return value;
  return String(value || "")
    .replace(/，/g, ",")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function adjacencyRows(structures) {
  const list = structures?.adjacencyList || {};
  return Object.entries(list).map(([key, targets]) => ({
    key,
    variable: key,
    directTargets: targets.length ? targets.join(", ") : "∅",
    formula: `${key}: [${targets.join(", ")}]`,
  }));
}

function formatSet(items) {
  return items?.length ? `{ ${items.join(", ")} }` : "∅";
}

function matrixValue(structures, source, target) {
  const row = (structures?.adjacencyMatrix || []).find((item) => item.source === source);
  return row?.targets?.[target] ? 1 : 0;
}

export default function CausalDagBuilder() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("variables");
  const [modalState, setModalState] = useState({ open: false, type: "variable", mode: "create", record: null });
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getCausalDag();
      setData(result);
    } catch (err) {
      setError(err?.message || "因果 DAG 数据加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const variableOptions = useMemo(
    () => (data?.variables || []).map((variable) => ({ label: `${variable.key} · ${variable.name}`, value: variable.key })),
    [data],
  );

  const variableKeys = useMemo(() => (data?.variables || []).map((variable) => variable.key), [data]);

  const openModal = (type, mode, record = null) => {
    setModalState({ open: true, type, mode, record });
    if (type === "variable") {
      form.setFieldsValue({
        key: record?.key,
        name: record?.name,
        role: record?.role || "covariate",
        type: record?.type || "二值变量",
        valuesText: (record?.values || []).join(", "),
        description: record?.description,
      });
    } else {
      form.setFieldsValue({
        source: record?.source,
        target: record?.target,
        label: record?.label,
        strength: record?.strength || "因果边",
        mechanism: record?.mechanism,
      });
    }
  };

  const closeModal = () => {
    setModalState({ open: false, type: "variable", mode: "create", record: null });
    form.resetFields();
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      let result;
      if (modalState.type === "variable") {
        const payload = { ...values, values: splitValues(values.valuesText) };
        delete payload.valuesText;
        result =
          modalState.mode === "create"
            ? await createCausalVariable(payload)
            : await updateCausalVariable(modalState.record.id, payload);
      } else {
        result =
          modalState.mode === "create"
            ? await createCausalEdge(values)
            : await updateCausalEdge(modalState.record.id, values);
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
      const result = type === "variable" ? await deleteCausalVariable(id) : await deleteCausalEdge(id);
      setData(result);
      message.success("删除成功");
    } catch (err) {
      message.error(err?.response?.data?.message || "删除失败");
    }
  };

  const handleReset = async () => {
    try {
      const result = await resetCausalDag();
      setData(result);
      message.success("已恢复课件默认因果 DAG");
    } catch (err) {
      message.error(err?.response?.data?.message || "恢复失败");
    }
  };

  const handleClear = async () => {
    try {
      const result = await clearCausalDag();
      setData(result);
      message.success("已清空因果 DAG，可以从零开始构建");
    } catch (err) {
      message.error(err?.response?.data?.message || "清空失败");
    }
  };

  const variableColumns = [
    {
      title: "变量（节点）",
      dataIndex: "key",
      width: 120,
      render: (value, record) => (
        <Space>
          <span className={`cdag-role-dot is-${record.role || "covariate"}`} />
          <strong>{value}</strong>
          <span>{record.name}</span>
        </Space>
      ),
    },
    {
      title: "角色",
      dataIndex: "role",
      width: 110,
      render: (value) => <Tag color={ROLE_COLOR[value] || "default"}>{ROLE_LABEL[value] || "协变量"}</Tag>,
    },
    {
      title: "取值",
      dataIndex: "values",
      render: (values) => (values?.length ? values.join(" / ") : "未设置"),
    },
    {
      title: "操作",
      width: 100,
      render: (_, record) => (
        <Space size={6}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal("variable", "edit", record)} />
          <Popconfirm
            title="删除该变量？"
            description="会同时删除所有以它为起点或终点的因果边。"
            onConfirm={() => handleDelete("variable", record.id)}
          >
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const edgeColumns = [
    {
      title: "因果边",
      width: 140,
      render: (_, record) => <Formula tone="#2563eb">{`${record.source} → ${record.target}`}</Formula>,
    },
    {
      title: "含义",
      dataIndex: "label",
      width: 160,
    },
    {
      title: "机制说明",
      dataIndex: "mechanism",
      ellipsis: true,
    },
    {
      title: "操作",
      width: 100,
      render: (_, record) => (
        <Space size={6}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal("edge", "edit", record)} />
          <Popconfirm title="删除该因果边？" onConfirm={() => handleDelete("edge", record.id)}>
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

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
          message="因果 DAG 暂不可用"
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

  const structures = data.structures || {};
  const topoText = structures.topologicalOrder?.length ? structures.topologicalOrder.join(" → ") : "暂无";

  return (
    <main className="page-shell cdag-page">
      <section className="kb-panel kgb-section cdag-section is-s1">
        <div className="kb-panel-head">
          <div>
            <span>Step 01 · CRUD</span>
            <h2>① 增删改查：动态构建因果图 DAG（性别藏起的药效真相）</h2>
          </div>
          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openModal(activeTab === "variables" ? "variable" : "edge", "create")}
            >
              新增{activeTab === "variables" ? "变量" : "因果边"}
            </Button>
            <Popconfirm title="恢复默认因果 DAG？" description="将回到课件示例：Z→X、Z→Y、X→Y。" onConfirm={handleReset}>
              <Button icon={<UndoOutlined />}>恢复默认</Button>
            </Popconfirm>
            <Popconfirm title="清空整个因果 DAG？" description="将删除所有变量与因果边，从零开始构建。" onConfirm={handleClear}>
              <Button danger icon={<ClearOutlined />}>
                清空
              </Button>
            </Popconfirm>
          </Space>
        </div>
        <Paragraph className="kgb-copy">
          先维护变量作为图的<b>节点</b>，再用“原因变量 → 结果变量”新增<b>有向边</b>。系统在保存每条边时都会检查是否成环，
          因此右侧始终保持有向无环图。删除变量会同步删除与该变量相关的所有因果边。
        </Paragraph>
        <div className="kgb-build-layout cdag-build-layout">
          <div className="kgb-build-left">
            <div className="kgb-build-crud">
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                  {
                    key: "variables",
                    label: (
                      <span>
                        <NodeIndexOutlined /> 变量 ({data.variables.length})
                      </span>
                    ),
                    children: <Table rowKey="id" columns={variableColumns} dataSource={data.variables} pagination={{ pageSize: 6 }} size="small" />,
                  },
                  {
                    key: "edges",
                    label: (
                      <span>
                        <ShareAltOutlined /> 因果边 ({data.edges.length})
                      </span>
                    ),
                    children: <Table rowKey="id" columns={edgeColumns} dataSource={data.edges} pagination={{ pageSize: 6 }} size="small" />,
                  },
                ]}
              />
            </div>
          </div>
          <div className="kgb-build-graph">
            <CausalDagGraph variables={data.variables} edges={data.edges} structures={structures} />
          </div>
        </div>
      </section>

      <section className="kb-panel kgb-section cdag-section is-s2">
        <div className="kb-panel-head">
          <div>
            <span>Step 02 · Structure</span>
            <h2>② 数据结构表示：邻接表与邻接矩阵</h2>
          </div>
        </div>
        <Paragraph className="kgb-copy">
          设变量顺序为 <b>{variableKeys.join("，")}</b>。邻接矩阵中第 i 行第 j 列为 1 表示第 i 个变量指向第 j 个变量，为 0 表示不存在直接因果边。
        </Paragraph>
        <div className="cdag-structure-grid">
          <article>
            <header>
              <ApartmentOutlined />
              <strong>邻接表</strong>
            </header>
            <div className="cdag-adj-list">
              {adjacencyRows(structures).map((row) => (
                <div key={row.key}>
                  <b>Adj({row.variable})</b>
                  <span>=</span>
                  <code>{formatSet(structures.adjacencyList?.[row.variable] || [])}</code>
                </div>
              ))}
            </div>
          </article>
          <article>
            <header>
              <TableOutlined />
              <strong>邻接矩阵</strong>
            </header>
            <div className="cdag-matrix-wrap">
              <div className="cdag-matrix-label">A =</div>
              <table className="cdag-matrix">
                <thead>
                  <tr>
                    <th />
                    {variableKeys.map((key) => (
                      <th key={key}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {variableKeys.map((source) => (
                    <tr key={source}>
                      <th>{source}</th>
                      {variableKeys.map((target) => (
                        <td key={`${source}-${target}`}>{matrixValue(structures, source, target)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
        <div className="cdag-topology-line">
          <Tag color={structures.isDag ? "green" : "red"}>{structures.isDag ? "DAG 无环" : "存在有向环"}</Tag>
          <Formula tone="#0f766e">拓扑序：{topoText}</Formula>
        </div>
      </section>

      <Modal
        title={`${modalState.mode === "create" ? "新增" : "编辑"}${modalState.type === "variable" ? "变量" : "因果边"}`}
        open={modalState.open}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={saving}
        width={600}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          {modalState.type === "variable" ? (
            <>
              <Form.Item label="变量符号" name="key" rules={[{ required: true, message: "请输入变量符号" }]}>
                <Input placeholder="例如：Z / X / Y" />
              </Form.Item>
              <Form.Item label="变量名称" name="name" rules={[{ required: true, message: "请输入变量名称" }]}>
                <Input placeholder="例如：性别" />
              </Form.Item>
              <Form.Item label="变量角色" name="role" initialValue="covariate">
                <Select options={ROLE_OPTIONS} />
              </Form.Item>
              <Form.Item label="变量类型" name="type" initialValue="二值变量">
                <Input placeholder="例如：二值变量 / 连续变量" />
              </Form.Item>
              <Form.Item label="可取值" name="valuesText">
                <Input placeholder="用逗号分隔，例如：男, 女" />
              </Form.Item>
              <Form.Item label="说明" name="description">
                <Input.TextArea rows={3} placeholder="说明变量在当前因果问题中的含义" />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item label="原因变量 source" name="source" rules={[{ required: true, message: "请选择原因变量" }]}>
                <Select options={variableOptions} showSearch placeholder="箭头起点" />
              </Form.Item>
              <Form.Item label="结果变量 target" name="target" rules={[{ required: true, message: "请选择结果变量" }]}>
                <Select options={variableOptions} showSearch placeholder="箭头终点" />
              </Form.Item>
              <Form.Item label="边标签" name="label" rules={[{ required: true, message: "请输入边标签" }]}>
                <Input placeholder="例如：影响服药选择" />
              </Form.Item>
              <Form.Item label="边类型 / 强度" name="strength" initialValue="因果边">
                <Input placeholder="例如：混淆路径 / 目标因果效应" />
              </Form.Item>
              <Form.Item label="机制说明" name="mechanism">
                <Input.TextArea rows={3} placeholder="说明 source 如何影响 target" />
              </Form.Item>
              <Alert
                type="info"
                showIcon
                message="因果边必须保持无环；例如已存在 X→Y 时，不能再添加 Y→X。"
              />
            </>
          )}
        </Form>
      </Modal>
    </main>
  );
}
