import { Badge, Progress, Tag, Typography } from "antd";
import {
  AimOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BranchesOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  ClusterOutlined,
  CodeOutlined,
  DeploymentUnitOutlined,
  ExperimentOutlined,
  FunctionOutlined,
  NodeIndexOutlined,
  PartitionOutlined,
  ProfileOutlined,
  ReadOutlined,
  RetweetOutlined,
  ShareAltOutlined,
  TableOutlined,
  TagsOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import "../styles/kg-overview.css";

const { Paragraph, Title } = Typography;

const PALETTE = [
  { color: "#4f46e5", ink: "#4338ca", soft: "rgba(79, 70, 229, 0.14)" },
  { color: "#0891b2", ink: "#0e7490", soft: "rgba(8, 145, 178, 0.13)" },
  { color: "#7c3aed", ink: "#6d28d9", soft: "rgba(124, 58, 237, 0.13)" },
  { color: "#059669", ink: "#047857", soft: "rgba(5, 150, 105, 0.13)" },
  { color: "#0284c7", ink: "#075985", soft: "rgba(2, 132, 199, 0.13)" },
  { color: "#c026d3", ink: "#a21caf", soft: "rgba(192, 38, 211, 0.12)" },
];

function sectionTone(index) {
  const tone = PALETTE[index % PALETTE.length];
  return {
    "--tone-color": tone.color,
    "--tone-ink": tone.ink,
    "--tone-soft": tone.soft,
  };
}

function SectionHeader({ index, icon, title, description }) {
  return (
    <header className="lecture-section-head-v3">
      <span>{icon}</span>
      <div>
        <h2>
          <em className="kgo-secnum">{String(index).padStart(2, "0")}</em>
          {title}
        </h2>
        <p>{description}</p>
      </div>
    </header>
  );
}

function FormulaCode({ children }) {
  return <code className="formula-code-v3">{children}</code>;
}

/* -------------------- 家庭关系知识图谱 -------------------- */
const REL_COLOR = {
  Couple: "#7c3aed",
  Mother: "#2563eb",
  Sibling: "#059669",
  Father: "#e11d48",
};

const GRAPH_NODES = {
  Mary: { x: 185, y: 80, gen: 1 },
  George: { x: 560, y: 80, gen: 1 },
  David: { x: 185, y: 295, gen: 2 },
  James: { x: 560, y: 295, gen: 2 },
  Ann: { x: 330, y: 500, gen: 3 },
  Mike: { x: 490, y: 500, gen: 3 },
};

// known=true 为已知关系（实线）；known=false 为待推理关系（红虚线）
const GRAPH_EDGES = [
  { from: "George", to: "Mary", rel: "Couple", dir: false, known: true },
  { from: "Mary", to: "David", rel: "Mother", dir: true, known: true },
  { from: "David", to: "James", rel: "Couple", dir: false, known: true },
  { from: "James", to: "Ann", rel: "Mother", dir: true, known: true },
  { from: "James", to: "Mike", rel: "Mother", dir: true, known: true },
  { from: "Ann", to: "Mike", rel: "Sibling", dir: false, known: true },
  { from: "David", to: "Mike", rel: "Father", dir: true, known: true }, // 已知正例 E⁺
  { from: "David", to: "Ann", rel: "Father", dir: true, known: false }, // 待推理
  { from: "George", to: "David", rel: "Father", dir: true, known: false }, // 待推理
];

const NODE_R = 37;

function FamilyGraph() {
  return (
    <figure className="kg-graph-figure">
      <svg className="kgfg-svg" viewBox="0 0 760 560" role="img" aria-label="家庭关系知识图谱">
        <defs>
          {Object.entries(REL_COLOR).map(([rel, color]) => (
            <marker key={rel} id={`arr-${rel}`} markerWidth="9" markerHeight="9" refX="7.5" refY="3" orient="auto">
              <path d="M0,0 L7.5,3 L0,6 Z" fill={color} />
            </marker>
          ))}
        </defs>

        {GRAPH_EDGES.map((e) => {
          const a = GRAPH_NODES[e.from];
          const b = GRAPH_NODES[e.to];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const endGap = e.dir ? NODE_R + 7 : NODE_R;
          const color = REL_COLOR[e.rel];
          return (
            <g key={`${e.from}-${e.to}-${e.rel}`}>
              <line
                className="kgfg-edge"
                x1={a.x + ux * NODE_R}
                y1={a.y + uy * NODE_R}
                x2={b.x - ux * endGap}
                y2={b.y - uy * endGap}
                stroke={color}
                strokeWidth={2.3}
                strokeDasharray={e.known ? undefined : "7 6"}
                markerEnd={e.dir ? `url(#arr-${e.rel})` : undefined}
              />
              <text
                className="kgfg-edge-label"
                x={(a.x + b.x) / 2 - uy * 13}
                y={(a.y + b.y) / 2 + ux * 13}
                fill={color}
              >
                {e.rel}
              </text>
            </g>
          );
        })}

        {Object.entries(GRAPH_NODES).map(([name, node]) => (
          <g className={`kgfg-node is-gen${node.gen}`} key={name}>
            <circle cx={node.x} cy={node.y} r={NODE_R} />
            <text x={node.x} y={node.y}>
              {name}
            </text>
          </g>
        ))}
      </svg>
      <div className="kg-graph-legend">
        <span><i style={{ borderColor: REL_COLOR.Couple }} />Couple 夫妻</span>
        <span><i style={{ borderColor: REL_COLOR.Mother }} />Mother 母子</span>
        <span><i style={{ borderColor: REL_COLOR.Sibling }} />Sibling 兄妹</span>
        <span><i style={{ borderColor: REL_COLOR.Father }} />Father 父子</span>
        <span><i style={{ borderColor: "#94a3b8", borderTopStyle: "solid" }} />实线＝已知</span>
        <span><i className="is-inferred" style={{ borderColor: REL_COLOR.Father, borderTopStyle: "dashed" }} />虚线＝待推理</span>
      </div>
      <figcaption>
        图 1 · 家庭关系知识图谱（在课件示例上扩展祖辈 George / Mary；实线为已知关系，其中 Father(David, Mike) 即正例 E⁺，红色虚线为待 FOIL 推理补全的关系）
      </figcaption>
    </figure>
  );
}

/* -------------------- 文本数据 -------------------- */
const learningPath = [
  { title: "问题背景", detail: "谓词逻辑手推关系的局限", icon: <BranchesOutlined /> },
  { title: "图谱概念", detail: "实体、关系、属性、三元组", icon: <ShareAltOutlined /> },
  { title: "关系推理", detail: "归纳与演绎两条路线", icon: <DeploymentUnitOutlined /> },
  { title: "FOIL 归纳", detail: "序贯覆盖 + 信息增益", icon: <ExperimentOutlined /> },
  { title: "规则补全", detail: "学到规则后补全缺失边", icon: <NodeIndexOutlined /> },
];

const heroFormula = [
  "目标谓词： Father(x, y)",
  "已知正例： Father(David, Mike)",
  "学到规则： Couple(x,z) ∧ Mother(z,y) → Father(x,y)",
];

const heroMetrics = [
  { label: "选题场景", value: "家庭关系", note: "多代际、多关系类型的家庭知识图谱", percent: 93 },
  { label: "推理方式", value: "确定性", note: "FOIL 归纳逻辑规则，结果可解释", percent: 90 },
  { label: "核心目标", value: "补全关系", note: "由已知边自动推出缺失的 Father 等关系", percent: 95 },
];

const roadmap = [
  { label: "01", icon: <ShareAltOutlined />, title: "知识图谱表达", text: "把家庭成员建成节点、亲属关系建成有向边，统一表示为三元组与一阶谓词。" },
  { label: "02", icon: <DeploymentUnitOutlined />, title: "关系推理", text: "从已有关系中归纳逻辑规则，再用规则演绎出图中尚不存在的关系。" },
  { label: "03", icon: <ExperimentOutlined />, title: "FOIL 归纳", text: "以目标谓词为规则头，序贯覆盖、用信息增益挑选最优前提约束谓词。" },
  { label: "04", icon: <NodeIndexOutlined />, title: "图谱补全", text: "将学到的规则实例化到具体成员，自动补全 Father 等缺失关系。" },
];

const backgroundCards = [
  {
    icon: <ProfileOutlined />,
    title: "谓词逻辑回顾",
    text: "已知 Couple(David,James)、Mother(James,Mike)，凭规则 Couple(x,z)∧Mother(z,y)→Father(x,y) 可手动推出 Father(David,Mike)。",
    tags: ["夫妻关系", "母子关系", "演绎推理"],
  },
  {
    icon: <ShareAltOutlined />,
    title: "图谱化表达",
    text: "把成员画成节点、关系画成带标签的有向边：实线是图中已知关系，红色虚线是需要推理补全的关系。",
    tags: ["节点", "有向边", "缺失关系"],
  },
  {
    icon: <ThunderboltOutlined />,
    title: "规模带来的难点",
    text: "若图谱有上百名成员、上千条关系，靠人手写规则、逐条演绎不现实，必须让机器自动从边中归纳规则。",
    tags: ["规模膨胀", "规则爆炸", "自动归纳"],
  },
  {
    icon: <AuditOutlined />,
    title: "核心问题",
    text: "如何让机器自动从图谱的“边（关系）”中归纳出逻辑规则，并基于规则补全图谱中缺失的关系——这正是 FOIL 要解决的。",
    tags: ["规则归纳", "关系补全", "可解释"],
  },
];

const conceptCards = [
  {
    title: "实体 / 概念",
    intro: "具有可区别性且独立存在的事物。在家庭图谱中，每位成员就是一个实体。",
    code: "实体：David、James、Ann、Mike\n概念：男性、女性、长辈",
    note: "实体对应一阶谓词逻辑中的“个体常项”，是图谱里的节点。",
  },
  {
    title: "属性",
    intro: "对实体或概念内涵的描述，刻画实体自身的特征。",
    code: "性别(David) = 男\n出生年份(Mike) = 2010",
    note: "属性可看作实体到属性值的单值关系，常作为推理时的附加条件。",
  },
  {
    title: "关系",
    intro: "两个节点之间的语义联系，是家庭图谱的主体，全部为二元关系。",
    code: "Couple(David, James)\nMother(James, Mike)\nSibling(Ann, Mike)",
    note: "关系对应一阶谓词逻辑中的“谓词”，是图谱里带标签的有向边。",
  },
  {
    title: "节点与边",
    intro: "知识图谱由有向图构成：节点表示实体，边表示节点间具有某一关系。",
    code: "节点 = 个体常项\n边   = 谓词 + 关系方向",
    note: "“节点—边—节点”天然对应“主语—谓词—宾语”，便于转写成逻辑形式。",
  },
];

const tripleCards = [
  {
    title: "三元组形式",
    intro: "图谱中存在连线的两个实体可写成 ⟨left_node, relation, right_node⟩ 的三元组。",
    code: "⟨James, Couple, David⟩\n⟨James, Mother, Mike⟩\n⟨Ann, Sibling, Mike⟩",
    note: "三元组是知识图谱最常用的存储与交换格式（主语、关系、宾语）。",
  },
  {
    title: "一阶谓词形式",
    intro: "可用一阶谓词刻画节点之间的关系，把三元组改写为谓词调用。",
    code: "couple(James, David)\nmother(James, Mike)\nfather(David, Mike)",
    note: "三元组 ⟨James, Couple, David⟩ 等价于谓词 couple(James, David)。",
  },
];

const relationReasoningCards = [
  {
    icon: <BulbOutlined />,
    title: "从数据到知识（归纳）",
    lead: "观察大量已有关系实例，归纳出普遍成立的逻辑规则。这是 FOIL 所做的事。",
    formula: "Mother(z,y) ∧ Couple(x,z) → Father(x,y)",
    points: ["输入：已有三元组（事实）", "输出：一般化的推理规则", "方向：特殊实例 → 一般规则"],
  },
  {
    icon: <PartitionOutlined />,
    title: "从知识到数据（演绎）",
    lead: "把已归纳出的规则实例化到具体成员，演绎出图中尚不存在的新关系。",
    formula: "规则 + Couple(David,James) + Mother(James,Ann) ⟹ Father(David,Ann)",
    points: ["输入：规则 + 具体事实", "输出：新的关系实例", "方向：一般规则 → 特殊实例"],
  },
];

const foilElements = [
  {
    id: "P",
    name: "目标谓词 P（规则头）",
    formula: "P : Father(x, y)",
    note: "需要推断的结论关系，已知名称，是推理规则箭头右侧的头部。",
    example: "本例要学习“父子/父女”关系 Father(x, y) 成立的前提条件。",
  },
  {
    id: "E⁺",
    name: "正例集合 E⁺",
    formula: "E⁺ = { Father(David, Mike) }",
    note: "图谱中已知成立的目标谓词实例（图 1 中那条实线 Father），驱动规则归纳。",
    example: "本例从图中仅得到 1 个正例 Father(David, Mike)，即 m₊ = 1。",
  },
  {
    id: "E⁻",
    name: "反例集合 E⁻",
    formula: "E⁻ = { ¬Father(David,James), ¬Father(James,Ann), … }",
    note: "图谱一般不显式给出反例，但可从“与目标谓词相悖的已知关系”构造。",
    example: "Couple(David,James) 成立 ⟹ Father(David,James) 不成立，记为一个反例。",
  },
  {
    id: "B",
    name: "背景知识样例",
    formula: "B = { Couple(David,James), Mother(James,Ann), Sibling(Ann,Mike), … }",
    note: "除目标谓词外其他谓词的实例化结果，是构造规则前提的候选材料。",
    example: "背景谓词 Couple、Mother、Sibling 将被依次试作前提约束谓词。",
  },
];

const searchStrategy = [
  { step: "01", title: "从一般到特殊", text: "初始规则只有目标谓词、前提为空（最一般，覆盖全部正反例），随后逐步添加前提约束谓词使其变“特殊”。" },
  { step: "02", title: "逐步加入前提约束谓词", text: "每轮把背景谓词以各种变量组合加入规则，用信息增益评估，挑增益最大的那个加入。" },
  { step: "03", title: "引入中介变量 z", text: "所有基础关系都是二元谓词，要把两个谓词“串联”需公共变量 z，形成推理链 x → z → y。" },
  { step: "04", title: "终止条件", text: "当规则不再覆盖任何反例时停止；再用序贯覆盖移除已覆盖正例，对剩余正例重复整个过程。" },
];

const gainSymbols = [
  { sym: "m₊", desc: "原规则（加入候选谓词之前）所覆盖的正例数量。" },
  { sym: "m₋", desc: "原规则（加入候选谓词之前）所覆盖的反例数量。" },
  { sym: "m̂₊", desc: "加入候选前提约束谓词后，新规则所覆盖的正例数量。" },
  { sym: "m̂₋", desc: "加入候选前提约束谓词后，新规则所覆盖的反例数量。" },
];

const gainRound1 = [
  { pre: "空集（基准）", mp: "m₊ = 1", mm: "m₋ = 4", gain: "／（基准）", best: false },
  { pre: "Mother(x, y)", mp: "m̂₊ = 0", mm: "m̂₋ = 2", gain: "NA", best: false },
  { pre: "Mother(z, y)", mp: "m̂₊ = 1", mm: "m̂₋ = 3", gain: "0.32", best: false },
  { pre: "Sibling(z, y)", mp: "m̂₊ = 1", mm: "m̂₋ = 2", gain: "0.74", best: false },
  { pre: "Couple(x, z)", mp: "m̂₊ = 1", mm: "m̂₋ = 1", gain: "1.32", best: true },
];

const gainRound2 = [
  { pre: "已有：Couple(x, z)（基准）", mp: "m₊ = 1", mm: "m₋ = 1", gain: "1.32（基准）", best: false },
  { pre: "∧ Mother(x, y)", mp: "m̂₊ = 0", mm: "m̂₋ = 0", gain: "NA", best: false },
  { pre: "∧ Sibling(z, y)", mp: "m̂₊ = 0", mm: "m̂₋ = 1", gain: "NA", best: false },
  { pre: "∧ Couple(x, z)", mp: "m̂₊ = 1", mm: "m̂₋ = 1", gain: "0", best: false },
  { pre: "∧ Mother(z, y)", mp: "m̂₊ = 1", mm: "m̂₋ = 0", gain: "1", best: true },
];

const foilFlow = [
  { n: "1", title: "初始化", text: "规则集为空；取最一般规则「→ Father(x,y)」，前提为空。" },
  { n: "2", title: "学一条规则", text: "内层从一般到特殊，逐个加增益最大的前提，直到不覆盖反例。" },
  { n: "3", title: "移除正例", text: "把该规则已覆盖的正例从训练集中去除（序贯覆盖）。" },
  { n: "4", title: "重复 / 结束", text: "对剩余正例重复，直到正例全部被覆盖，输出规则集。" },
];

export default function KgReasoningOverview() {
  return (
    <main className="page-shell reasoning-overview-page lecture-page-v2 kg-overview-page">
      {/* Hero */}
      <section className="reasoning-knowledge-hero reasoning-hero-v3">
        <div className="reasoning-hero-copy-v3">
          <Tag className="lecture-tag-v2">问题背景与相关知识</Tag>
          <Title level={1}>家庭关系知识图谱的确定性推理</Title>
          <Paragraph>
            本模块以“家庭关系知识图谱”为选题：成员之间的夫妻、父母、兄弟姐妹等关系构成一张有向图。我们要解决的问题是——当图谱中存在大量关系、却缺失了一部分（例如父子关系）时，如何让机器自动地把这些缺失关系补全。
          </Paragraph>
          <Paragraph>
            采用的方法是 <b>FOIL（First Order Inductive Learner，一阶归纳学习器）</b>：它从图谱已有的关系中归纳出一阶逻辑规则，再用规则演绎补全缺失关系。本页先交代问题背景与知识图谱相关概念，再详细介绍 FOIL 算法的目标、搜索策略与信息增益准则。
          </Paragraph>
          <div className="reasoning-action-row">
            <Tag color="#4f46e5">知识图谱</Tag>
            <Tag color="#0891b2">三元组</Tag>
            <Tag color="#7c3aed">一阶谓词逻辑</Tag>
            <Tag color="#059669">归纳逻辑程序设计</Tag>
            <Tag color="#e11d48">FOIL 算法</Tag>
          </div>
          <div className="hero-learning-path-v4">
            {learningPath.map((item, index) => (
              <article key={item.title} style={sectionTone(index)}>
                <span>{item.icon}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="reasoning-hero-board-v3">
          <div className="hero-board-title-v3">
            <span>
              <ShareAltOutlined />
            </span>
            <div>
              <strong>选题定位</strong>
              <small>从家庭关系图谱到缺失关系自动补全</small>
            </div>
          </div>
          <div className="hero-metric-grid-v3">
            {heroMetrics.map((item, index) => (
              <article key={item.label}>
                <div className="hero-metric-head-v4">
                  <span>{item.label}</span>
                  <Badge color={PALETTE[index].color} text={`${item.percent}%`} />
                </div>
                <strong>{item.value}</strong>
                <p>{item.note}</p>
                <Progress
                  percent={item.percent}
                  showInfo={false}
                  strokeColor={PALETTE[index].color}
                  trailColor="rgba(255,255,255,0.16)"
                />
              </article>
            ))}
          </div>
          <div className="hero-formula-card-v4">
            <div>
              <BulbOutlined />
              <strong>页面展示主线</strong>
            </div>
            <FormulaCode>{heroFormula.join("\n")}</FormulaCode>
          </div>
          <div className="hero-mini-flow-v3">
            {["已有关系", "归纳规则", "信息增益", "补全关系"].map((item, index) => (
              <span key={item} style={sectionTone(index)}>
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* roadmap */}
      <section className="reasoning-relation-board reasoning-roadmap-v3">
        {roadmap.map((item, index) => (
          <article key={item.label} style={sectionTone(index)}>
            <span className="roadmap-index-v3">{item.label}</span>
            <i>{item.icon}</i>
            <strong>{item.title}</strong>
            <p>{item.text}</p>
          </article>
        ))}
      </section>

      {/* 1. 问题背景 */}
      <section className="lecture-block-v2 reasoning-block-v3 reasoning-background-section is-background-topic">
        <SectionHeader
          index={1}
          icon={<ReadOutlined />}
          title="问题背景：为什么需要知识图谱推理"
          description="家庭关系本可用谓词逻辑手动演绎，但当图谱规模变大时，必须让机器自动归纳规则并补全关系。"
        />
        <div className="kg-two-col" style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 22, alignItems: "start" }}>
          <FamilyGraph />
          <div className="reasoning-background-grid reasoning-card-grid-v3" style={{ gridTemplateColumns: "1fr" }}>
            {backgroundCards.map((item, index) => (
              <article key={item.title} style={sectionTone(index)}>
                <span>{item.icon}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
                <div className="tag-row-v3">
                  {item.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="reasoning-summary-band is-dense reasoning-summary-v3">
          <AuditOutlined />
          <div>
            <strong>核心难点</strong>
            <p>
              如何让机器自动从图谱的“边（关系）”中归纳出逻辑规则，并基于规则完成缺失关系的补全。图 1 中红色虚线（如 Father(David,Ann)、Father(George,David)）就是需要推理得到的目标关系；而实线 Father(David,Mike) 是已知的正例。
            </p>
          </div>
        </div>
      </section>

      {/* 2. 知识图谱相关概念 */}
      <section className="lecture-block-v2 reasoning-block-v3 is-proposition-topic">
        <SectionHeader
          index={2}
          icon={<ShareAltOutlined />}
          title="知识图谱推理概述：相关概念"
          description="知识图谱由有向图构成，用来描述现实世界中实体及实体之间的关系，是人工智能中重要的知识表达方式。"
        />
        <div className="concept-strip-v2 predicate-strip-v2 concept-grid-v3">
          {conceptCards.map((item, index) => (
            <article key={item.title} style={sectionTone(index)}>
              <strong>{item.title}</strong>
              <Paragraph>{item.intro}</Paragraph>
              <FormulaCode>{item.code}</FormulaCode>
              <Paragraph>{item.note}</Paragraph>
            </article>
          ))}
        </div>
        <div className="logic-contrast-band logic-contrast-v3">
          <div className="contrast-card-v3 is-proposition">
            <span className="contrast-icon-v3">
              <ClusterOutlined />
            </span>
            <div>
              <span>图结构视角</span>
              <strong>节点 + 有向边</strong>
              <p>James、David 是节点，二者之间标注 Couple 的边表示夫妻关系。</p>
            </div>
          </div>
          <ApartmentOutlined />
          <div className="contrast-card-v3 is-predicate">
            <span className="contrast-icon-v3">
              <FunctionOutlined />
            </span>
            <div>
              <span>逻辑视角</span>
              <strong>个体常项 + 谓词</strong>
              <p>节点对应个体常项，边对应谓词，于是图谱可整体转写为一阶逻辑。</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. 三元组与一阶谓词 */}
      <section className="lecture-block-v2 reasoning-block-v3 is-predicate-topic">
        <SectionHeader
          index={3}
          icon={<NodeIndexOutlined />}
          title="知识图谱的表达：三元组与一阶谓词形式"
          description="知识图谱一般通过标注多关系图来表示，每条边都可以写成三元组，也可以写成一阶谓词。"
        />
        <div className="concept-strip-v2 predicate-strip-v2 concept-grid-v3" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          {tripleCards.map((item, index) => (
            <article key={item.title} style={sectionTone(index + 2)}>
              <strong>{item.title}</strong>
              <Paragraph>{item.intro}</Paragraph>
              <FormulaCode>{item.code}</FormulaCode>
              <Paragraph>{item.note}</Paragraph>
            </article>
          ))}
        </div>
        <div className="reasoning-summary-band is-dense reasoning-summary-v3">
          <TagsOutlined />
          <div>
            <strong>从图谱到逻辑的桥梁</strong>
            <p>
              正因为图谱中的三元组可以无损地表示为一阶逻辑形式，才为“基于知识图谱的逻辑推理”创造了条件：先把所有边转写成谓词事实，再在这些事实之上做归纳与演绎。
            </p>
          </div>
        </div>
      </section>

      {/* 4. 关系推理 */}
      <section className="lecture-block-v2 reasoning-block-v3 is-methods-topic">
        <SectionHeader
          index={4}
          icon={<PartitionOutlined />}
          title="关系推理：归纳与演绎两条路线"
          description="关系推理是统计关系学习的基本问题，能够从现有知识中发现新知识，在实体间建立新关联，从而扩充知识库。"
        />
        <div className="method-panel-v2 method-grid-v3">
          {relationReasoningCards.map((item, index) => (
            <article key={item.title} style={sectionTone(index + 3)}>
              <span>{item.icon}</span>
              <div>
                <h3>{item.title}</h3>
                <Paragraph>{item.lead}</Paragraph>
                <FormulaCode>{item.formula}</FormulaCode>
                <ul>
                  {item.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
        <div className="reasoning-summary-band is-dense reasoning-summary-v3">
          <BulbOutlined />
          <div>
            <strong>经典例子</strong>
            <p>
              ⟨奥巴马, 出生地, 夏威夷⟩ 且 ⟨夏威夷, 属于, 美国⟩ ⟹ ⟨奥巴马, 国籍, 美国⟩。本模块的家庭关系图谱同理：由 Couple 与 Mother 关系，推出图中并不存在的 Father 关系。
            </p>
          </div>
        </div>
      </section>

      {/* 5. 归纳学习与序贯覆盖 */}
      <section className="lecture-block-v2 reasoning-block-v3 is-proposition-rules-topic">
        <SectionHeader
          index={5}
          icon={<ExperimentOutlined />}
          title="FOIL 算法（一）：归纳学习与序贯覆盖"
          description="FOIL 属于归纳逻辑程序设计（ILP），用一阶谓词逻辑表示知识，通过修改和扩充逻辑表达式对现有知识归纳。"
        />
        <div className="concept-strip-v2 predicate-strip-v2 concept-grid-v3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <article style={sectionTone(4)}>
            <strong>归纳逻辑程序设计 ILP</strong>
            <Paragraph>
              Inductive Logic Programming，机器学习与逻辑程序设计的交叉领域。Plotkin 与 Shapiro 推动了在形式逻辑框架下进行归纳机器学习，奠定了 ILP 的理论基础。
            </Paragraph>
          </article>
          <article style={sectionTone(5)}>
            <strong>FOIL 一阶归纳学习器</strong>
            <Paragraph>
              First Order Inductive Learner，ILP 的代表性方法。它通过<b>序贯覆盖</b>逐条学习推理规则，每条规则都以目标谓词为头部。
            </Paragraph>
          </article>
          <article style={sectionTone(0)}>
            <strong>序贯覆盖的基本思想</strong>
            <Paragraph>
              逐条归纳：在训练集上每学到一条规则，就把该规则覆盖的训练样本去除，然后以剩下的样本重复上述过程，直到无正例可覆盖。
            </Paragraph>
          </article>
        </div>
      </section>

      {/* 6. FOIL 目标与四要素 */}
      <section className="lecture-block-v2 reasoning-block-v3 is-predicate-rules-topic">
        <SectionHeader
          index={6}
          icon={<AppstoreOutlined />}
          title="FOIL 算法（二）：算法目标与四个核心要素"
          description="给定目标谓词 P、P 的训练样例（正例 E⁺ 与反例 E⁻）以及背景知识样例，FOIL 要学到可推出 P 的推理规则。"
        />
        <div className="predicate-rule-grid predicate-grid-v3">
          {foilElements.map((item, index) => (
            <article className="logic-rule-card predicate-rule-card" key={item.id} style={sectionTone(index + 1)}>
              <span>{item.id}</span>
              <div>
                <strong>{item.name}</strong>
                <FormulaCode>{item.formula}</FormulaCode>
                <p>{item.note}</p>
                <small>{item.example}</small>
              </div>
            </article>
          ))}
        </div>
        <div className="reasoning-summary-band is-dense reasoning-summary-v3">
          <AuditOutlined />
          <div>
            <strong>构造反例的注意事项</strong>
            <p>
              只有在“已知两实体之间存在某关系、且该关系与目标谓词相悖”时，才能用这两个实体构造反例。例如不能用 David 和 Ann 构造 Father 的反例——现有知识无法确定二者是否存在 Father 关系。最终本例得到正例 1 个、反例 4 个，即 m₊ = 1、m₋ = 4。
            </p>
          </div>
        </div>
      </section>

      {/* 7. 搜索策略 */}
      <section className="lecture-block-v2 reasoning-block-v3 is-cases-topic">
        <SectionHeader
          index={7}
          icon={<AimOutlined />}
          title="FOIL 算法（三）：搜索策略——从一般到特殊"
          description="逐步给目标谓词添加前提约束谓词，直到所构成的推理规则不覆盖任何反例。"
        />
        <div className="scenario-flow-v3">
          {searchStrategy.map((item, index) => (
            <article key={item.title} style={sectionTone(index + 4)}>
              <span>{item.step}</span>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
        <div className="reasoning-summary-band is-dense reasoning-summary-v3">
          <NodeIndexOutlined />
          <div>
            <strong>为什么要引入中介变量 z？</strong>
            <p>
              图谱中的基础关系都是二元谓词（一个谓词只描述两个实体）。规则 Mother(z,y) ∧ Couple(x,z) → Father(x,y) 中含两个二元谓词，要让它们“串联”起来必须有公共变量 z，它把 x 和 y 连接成完整推理链 x → z → y。因此对每个候选谓词，都要讨论其变量分别取 x / y / z 的各种组合。
            </p>
          </div>
        </div>
      </section>

      {/* 8. 信息增益公式 */}
      <section className="lecture-block-v2 reasoning-block-v3 is-system-topic">
        <SectionHeader
          index={8}
          icon={<FunctionOutlined />}
          title="FOIL 算法（四）：信息增益公式及符号含义"
          description="添加前提约束谓词后，所得推理规则质量的好坏，由信息增益值（information gain）这一评估准则来判断。"
        />
        <div className="hero-formula-card-v4" style={{ marginBottom: 18 }}>
          <div>
            <FunctionOutlined />
            <strong>FOIL 信息增益值计算公式</strong>
          </div>
          <FormulaCode>{"FOIL_Gain = m̂₊ · ( log₂( m̂₊ / (m̂₊ + m̂₋) ) − log₂( m₊ / (m₊ + m₋) ) )"}</FormulaCode>
        </div>
        <div className="foil-symbol-grid">
          {gainSymbols.map((item, index) => (
            <article key={item.sym} style={sectionTone(index + 4)}>
              <b>{item.sym}</b>
              <p>{item.desc}</p>
            </article>
          ))}
        </div>
        <div className="reasoning-summary-band is-dense reasoning-summary-v3">
          <ThunderboltOutlined />
          <div>
            <strong>公式怎么理解</strong>
            <p>
              括号内两项分别是“加入谓词后”与“加入谓词前”规则覆盖正例的纯度（用比特度量），其差表示纯度提升；再乘以新规则覆盖的正例数 m̂₊ 作为权重，从而既偏好更“准”（反例少）又偏好更“全”（正例多）的规则。特别地，当 m̂₊ = 0 时，log₂ 项出现负无穷，此时 FOIL_Gain 记为 NA（Not Available）。
            </p>
          </div>
        </div>
      </section>

      {/* 9. 背景样例与目标谓词样例 + 计算表 */}
      <section className="lecture-block-v2 reasoning-block-v3 is-domains-topic">
        <SectionHeader
          index={9}
          icon={<TableOutlined />}
          title="FOIL 算法（五）：背景样例、目标谓词样例与增益计算"
          description="以目标谓词 Father(x,y) 为例，给出训练样例与背景知识，并演示逐步选取前提约束谓词的两轮计算。"
        />

        <div className="concept-strip-v2 predicate-strip-v2 concept-grid-v3" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          <article style={sectionTone(1)}>
            <strong>背景知识样例集合 B</strong>
            <FormulaCode>{"Sibling(Ann, Mike)\nCouple(David, James)\nMother(James, Ann)\nMother(James, Mike)"}</FormulaCode>
            <Paragraph>除目标谓词 Father 以外的其他谓词实例化结果，用作构造规则前提的候选。</Paragraph>
          </article>
          <article style={sectionTone(5)}>
            <strong>目标谓词训练样例集合</strong>
            <FormulaCode>{"Father(David, Mike)        ← 正例\n¬Father(David, James)\n¬Father(James, Ann)\n¬Father(James, Mike)\n¬Father(Ann, Mike)         ← 反例"}</FormulaCode>
            <Paragraph>正例 1 个、反例 4 个，于是基准规则有 m₊ = 1、m₋ = 4。</Paragraph>
          </article>
        </div>

        <h3 style={{ margin: "22px 0 10px", color: "#be123c" }}>第一轮：为 Father(x, y) ← … 选第一个前提约束谓词</h3>
        <table className="foil-gain-table">
          <thead>
            <tr>
              <th>推理规则前提</th>
              <th>覆盖正例</th>
              <th>覆盖反例</th>
              <th>FOIL 信息增益值</th>
            </tr>
          </thead>
          <tbody>
            {gainRound1.map((row) => (
              <tr key={row.pre} className={row.best ? "is-best" : ""}>
                <td>
                  <code>{row.pre}</code>
                </td>
                <td>{row.mp}</td>
                <td>{row.mm}</td>
                <td>{row.gain}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="foil-gain-caption">
          Couple(x, z) 带来的增益最大（1.32），故选它加入，得到规则 <b>Couple(x, z) → Father(x, y)</b>，并去除与之不符的训练样本。
        </p>

        <h3 style={{ margin: "22px 0 10px", color: "#be123c" }}>第二轮：在 Couple(x, z) → Father(x, y) 基础上继续加约束</h3>
        <table className="foil-gain-table">
          <thead>
            <tr>
              <th>拟加入前提约束谓词</th>
              <th>覆盖正例</th>
              <th>覆盖反例</th>
              <th>FOIL 信息增益值</th>
            </tr>
          </thead>
          <tbody>
            {gainRound2.map((row) => (
              <tr key={row.pre} className={row.best ? "is-best" : ""}>
                <td>
                  <code>{row.pre}</code>
                </td>
                <td>{row.mp}</td>
                <td>{row.mm}</td>
                <td>{row.gain}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="foil-gain-caption">
          Mother(z, y) 增益最大（1），加入后新规则覆盖正例 Father(David, Mike) 且不覆盖任何反例，算法终止。
        </p>

        <div className="reasoning-summary-band reasoning-summary-v3" style={{ marginTop: 18 }}>
          <ExperimentOutlined />
          <div>
            <strong>最终学到的推理规则</strong>
            <FormulaCode>{"(∀x)(∀y)(∀z)( Couple(x, z) ∧ Mother(z, y) → Father(x, y) )"}</FormulaCode>
            <p>
              把规则实例化（x=David、z=James、y=Ann）即可演绎出图谱中缺失的 Father(David, Ann)，完成关系补全。这正是“从数据归纳规则、再用规则补全图谱”的完整闭环，将在后续子页中动态演示。
            </p>
          </div>
        </div>
      </section>

      {/* 10. 算法整体流程 + 伪代码 */}
      <section className="lecture-block-v2 reasoning-block-v3 is-flow-topic">
        <SectionHeader
          index={10}
          icon={<CodeOutlined />}
          title="FOIL 算法（六）：完整流程与伪代码"
          description="把前面的思想整理成可执行流程——外层用序贯覆盖逐条学规则，内层从一般到特殊逐个加前提约束谓词。"
        />
        <div className="kgo-flow">
          {foilFlow.map((f) => (
            <article key={f.n}>
              <span className="fn">{f.n}</span>
              <strong>{f.title}</strong>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
        <div className="kgo-pseudo">
          <div className="pc-bar">
            <i style={{ background: "#ff5f56" }} />
            <i style={{ background: "#ffbd2e" }} />
            <i style={{ background: "#27c93f" }} />
            <span style={{ marginLeft: 8 }}>FOIL ALGORITHM</span>
          </div>
          <pre>
{``}<span className="kw">function</span>{` `}<span className="fnname">FOIL</span>{`(目标谓词 P, 正例 E⁺, 反例 E⁻, 背景知识 B):
    规则集 R ← ∅
    `}<span className="kw">while</span>{` E⁺ 非空:                         `}<span className="cm">// 外层：序贯覆盖</span>{`
        规则 r ← ( `}<span className="st">→ P(x, y)</span>{` )           `}<span className="cm">// 最一般规则，前提为空</span>{`
        `}<span className="kw">while</span>{` r 仍覆盖反例:                 `}<span className="cm">// 内层：从一般到特殊</span>{`
            best ← null
            `}<span className="kw">for</span>{` 每个候选谓词 q（变量取 x/y/z 各种绑定）:
                g ← `}<span className="fnname">FOIL_Gain</span>{`(q 加入 r 后)
                `}<span className="kw">if</span>{` g ≠ NA `}<span className="kw">and</span>{` g 比 best 大:  best ← q
            把 best 作为前提约束谓词加入 r  `}<span className="cm">// 选增益最大者</span>{`
        R ← R ∪ { r }
        E⁺ ← E⁺ − { 被 r 覆盖的正例 }      `}<span className="cm">// 移除已覆盖样本</span>{`
    `}<span className="kw">return</span>{` R`}
          </pre>
        </div>
        <div className="reasoning-summary-band is-dense reasoning-summary-v3">
          <CheckCircleOutlined />
          <div>
            <strong>小结</strong>
            <p>
              FOIL 用“序贯覆盖 + 从一般到特殊 + 信息增益”三件套，把家庭图谱里零散的关系，归纳成可解释的一阶逻辑规则，再据此补全缺失关系——既是确定性推理，也是可解释的知识发现。本例最终只学出一条规则即覆盖全部正例，故 R = {"{ Couple(x,z) ∧ Mother(z,y) → Father(x,y) }"}。
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
