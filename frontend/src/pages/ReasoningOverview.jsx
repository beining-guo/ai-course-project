import { Alert, Badge, Progress, Tag, Typography } from "antd";
import {
  ApiOutlined,
  AuditOutlined,
  BranchesOutlined,
  BulbOutlined,
  CarOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  CodeOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  FunctionOutlined,
  MedicineBoxOutlined,
  NodeIndexOutlined,
  PartitionOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
  TagOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from "@ant-design/icons";

const { Paragraph, Title } = Typography;

const learningPath = [
  { title: "问题背景", detail: "明确事故定责场景与证据来源", icon: <CarOutlined /> },
  { title: "命题表示", detail: "用 P、Q、R 抽象规则骨架", icon: <CodeOutlined /> },
  { title: "谓词表示", detail: "用对象、谓词、量词细化知识", icon: <NodeIndexOutlined /> },
  { title: "推理规则", detail: "整理自然演绎和量词推理依据", icon: <ExperimentOutlined /> },
  { title: "系统落地", detail: "连接事实库、规则库与解释链", icon: <CloudServerOutlined /> },
];

const heroFormula = [
  "事实：RedLight(CarA)",
  "规则：RedLight(x) ∧ CausesCrash(x) → MainResponsibility(x)",
  "结论：MainResponsibility(CarA)",
];

const PALETTE = [
  { color: "#5EC2B4", ink: "#0f766e", soft: "rgba(94, 194, 180, 0.16)" },
  { color: "#17B0C2", ink: "#0e7490", soft: "rgba(23, 176, 194, 0.14)" },
  { color: "#009BCB", ink: "#075985", soft: "rgba(0, 155, 203, 0.13)" },
  { color: "#4181C6", ink: "#1d4ed8", soft: "rgba(65, 129, 198, 0.13)" },
  { color: "#7263AE", ink: "#5b4aa0", soft: "rgba(114, 99, 174, 0.13)" },
  { color: "#8E4184", ink: "#86198f", soft: "rgba(142, 65, 132, 0.12)" },
];

const heroMetrics = [
  { label: "选题场景", value: "车路协同", note: "智能网联汽车事故责任辅助判定", percent: 92 },
  { label: "核心目标", value: "可解释", note: "把事实、规则、结论串成推理链", percent: 88 },
  { label: "推理路线", value: "双方法", note: "自然演绎 + 归结演绎对照验证", percent: 95 },
];

const roadmap = [
  {
    label: "01",
    icon: <CarOutlined />,
    title: "问题背景",
    text: "从事故场景、证据来源、责任判定需求出发，说明为什么需要确定性推理。",
  },
  {
    label: "02",
    icon: <CodeOutlined />,
    title: "逻辑表示",
    text: "先用命题逻辑建立规则骨架，再用一阶谓词逻辑细化对象与关系。",
  },
  {
    label: "03",
    icon: <PartitionOutlined />,
    title: "推理规则",
    text: "整理命题逻辑和谓词逻辑中的常用规则，为后续推理机实现做准备。",
  },
  {
    label: "04",
    icon: <SafetyCertificateOutlined />,
    title: "责任结论",
    text: "把事实库、规则库、推理过程和结论解释落到事故责任辅助判定系统中。",
  },
];

const backgroundCards = [
  {
    icon: <CarOutlined />,
    title: "研究对象",
    text: "智能网联汽车事故责任辅助判定关注的是车辆、驾驶员、道路信号、传感器记录、交通规则和责任结论之间的逻辑关系。",
    tags: ["车辆对象", "道路环境", "责任结论"],
  },
  {
    icon: <DatabaseOutlined />,
    title: "证据来源",
    text: "车载日志、路侧感知、信号灯状态、碰撞位置、行驶速度、制动记录、V2X 通信信息都可以转化为系统可处理的事实。",
    tags: ["车载日志", "路侧感知", "V2X 记录"],
  },
  {
    icon: <AuditOutlined />,
    title: "判定任务",
    text: "系统需要判断车辆是否违反交通规则、违规行为是否导致事故、是否可以推出主要责任或次要责任等结论。",
    tags: ["违规判断", "因果关联", "责任划分"],
  },
  {
    icon: <SafetyCertificateOutlined />,
    title: "方法价值",
    text: "自然演绎适合展示逐步证明，归结演绎适合自动化验证。两种方法结合，可以让责任结论更透明、更可检查。",
    tags: ["过程透明", "规则可查", "结论可验"],
  },
];

const scenarioSteps = [
  ["事实采集", "提取车辆、道路、信号灯、碰撞位置、速度与制动记录等客观信息。"],
  ["形式表示", "把自然语言事实写成命题符号或谓词公式，例如 RedLight(CarA)。"],
  ["规则匹配", "将交通法规、让行规则、追尾规则等转化为可触发的逻辑规则。"],
  ["推理判定", "通过自然演绎或归结演绎推出责任结论，并展示每一步依据。"],
];

const propositionCards = [
  {
    title: "命题抽象",
    intro: "命题逻辑把一个完整陈述看成整体，不分析内部对象和关系，只关心该陈述是真还是假。",
    code: "P：车辆A闯红灯\nQ：车辆A导致碰撞\nR：车辆A承担主要责任",
    note: "适合快速搭建“事实成立 -> 触发规则 -> 推出结论”的责任判定骨架。",
  },
  {
    title: "联结词建模",
    intro: "通过否定、合取、析取、蕴含和等价，可以把多个事故事实组合成条件规则。",
    code: "P ∧ Q\nP ∨ Q\nP → R\n(P ∧ Q) → R",
    note: "例如“闯红灯且导致碰撞，则承担主要责任”可写成 (P ∧ Q) → R。",
  },
  {
    title: "规则触发",
    intro: "当前提事实已经确认，系统可以根据推理规则推出新的责任判断。",
    code: "已知：P\n已知：P → R\n推出：R",
    note: "这是肯定前件式，也是事故责任辅助判定中最常用的规则触发方式。",
  },
  {
    title: "表达边界",
    intro: "命题逻辑无法表达“谁闯红灯”“撞到了谁”“在哪个路口”等内部结构。",
    code: "命题层：P：车辆A闯红灯\n谓词层：RedLight(CarA)",
    note: "因此命题逻辑适合作为入门表示，真正建模时还需要一阶谓词逻辑。",
  },
];

const predicateCards = [
  {
    title: "对象与变量",
    intro: "一阶谓词逻辑先明确领域对象，再用变量表示可以替换的一类对象。",
    code: "CarA, CarB, DriverA, Road1\nx, y, t",
    note: "CarA 是具体车辆，x 可以代表任意车辆，t 可以表示事故发生时刻。",
  },
  {
    title: "谓词设计",
    intro: "谓词用来描述对象属性或对象之间的关系，是事故事实形式化的核心。",
    code: "RedLight(CarA)\nRearEnd(CarA, CarB)\nCausesCrash(CarA)",
    note: "这些谓词能够清楚表达“谁违反了什么规则、谁与谁发生了关系”。",
  },
  {
    title: "量词表达",
    intro: "全称量词适合表达交通规则，存在量词适合表达至少有一个满足条件的对象。",
    code: "∀x(Vehicle(x) → NeedSafeDistance(x))\n∃x(RedLight(x) ∧ Accident(x))",
    note: "规则库通常由全称规则组成，事故证据通常会实例化到具体车辆。",
  },
  {
    title: "责任规则",
    intro: "复杂责任规则可以写成谓词公式，再将变量替换为具体车辆进行推理。",
    code: "∀x((RedLight(x) ∧ CausesCrash(x))\n  → MainResponsibility(x))",
    note: "若 RedLight(CarA) 和 CausesCrash(CarA) 成立，就可推出 MainResponsibility(CarA)。",
  },
];

const propositionRules = [
  ["I1", "简化规则", "G ∧ H ⇒ G", "从合取事实中取出左侧事实。"],
  ["I2", "简化规则", "G ∧ H ⇒ H", "从合取事实中取出右侧事实。"],
  ["I3", "添加规则", "G ⇒ G ∨ H", "已知一个事实成立，可构造析取式。"],
  ["I4", "添加规则", "H ⇒ G ∨ H", "从另一侧事实构造析取式。"],
  ["I5", "条件构造", "¬G ⇒ G → H", "当前件不成立时，蕴含式成立。"],
  ["I6", "条件构造", "H ⇒ G → H", "当后件成立时，可构造蕴含式。"],
  ["I7", "否定蕴含", "¬(G → H) ⇒ G", "蕴含不成立时，前件必须成立。"],
  ["I8", "否定蕴含", "¬(G → H) ⇒ ¬H", "蕴含不成立时，后件必须失败。"],
  ["I9", "合取引入", "G, H ⇒ G ∧ H", "把两个已确认事实合成为合取。"],
  ["I10", "选言三段论", "¬G, G ∨ H ⇒ H", "排除一个分支后推出另一分支。"],
  ["I11", "选言三段论", "¬G, G ∨ ¬H ⇒ ¬H", "排除一个分支后推出否定分支。"],
  ["I12", "肯定前件式", "G, G → H ⇒ H", "事故规则中最常见的结论触发。"],
  ["I13", "否定后件式", "¬H, G → H ⇒ ¬G", "结论不成立时反推前件不成立。"],
  ["I14", "假言三段论", "G → H, H → I ⇒ G → I", "把多条责任条件链连接起来。"],
  ["I15", "二难推论", "G ∨ H, G → I, H → I ⇒ I", "不同分支都指向同一责任结论。"],
];

const predicateRules = [
  {
    id: "US",
    name: "全称特指",
    formula: "∀x G(x) ⇒ G(a)",
    note: "把普遍交通规则应用到某一辆具体车辆。",
    example: "∀x(RedLight(x) → Violation(x)) ⇒ RedLight(CarA) → Violation(CarA)",
  },
  {
    id: "ES",
    name: "存在特指",
    formula: "∃x G(x) ⇒ G(c)",
    note: "用一个新常量表示已经存在的事故对象或证据对象。",
    example: "∃x(CameraCaptured(x)) ⇒ CameraCaptured(CarA)",
  },
  {
    id: "UG",
    name: "全称推广",
    formula: "G(a) ⇒ ∀x G(x)",
    note: "当证明不依赖某个特殊对象时，可推广为普遍规则。",
    example: "对任意车辆证明规则成立后，推广为 ∀x RuleApplies(x)",
  },
  {
    id: "EG",
    name: "存在推广",
    formula: "G(a) ⇒ ∃x G(x)",
    note: "由具体事故事实成立，推出至少存在一个满足条件的对象。",
    example: "RearEnd(CarA, CarB) ⇒ ∃x∃y RearEnd(x,y)",
  },
  {
    id: "I16",
    name: "全称推出存在",
    formula: "∀xG(x) ⇒ ∃xG(x)",
    note: "全体对象都满足某性质时，至少有一个对象满足。",
    example: "所有事故车辆需记录轨迹 ⇒ 至少存在一辆事故车需记录轨迹",
  },
  {
    id: "I17",
    name: "全称合并",
    formula: "∀xG(x) ∧ ∀xH(x) ⇒ ∀x(G(x) ∧ H(x))",
    note: "将同一对象上的两条全称约束合并，便于统一触发规则。",
    example: "所有车需保持车距且遵守信号 ⇒ 所有车同时满足两类义务",
  },
  {
    id: "I18",
    name: "存在分解",
    formula: "∃x(G(x) ∧ H(x)) ⇒ ∃xG(x) ∧ ∃xH(x)",
    note: "将同一对象满足的多个事实拆成可分别使用的事实。",
    example: "存在车辆闯红灯且导致碰撞 ⇒ 存在闯红灯车辆，也存在致碰车辆",
  },
  {
    id: "I19",
    name: "全称条件传递",
    formula: "∀x(G(x) → H(x)), G(a) ⇒ H(a)",
    note: "先实例化全称规则，再使用肯定前件式推出结论。",
    example: "∀x(RedLight(x) → Fault(x)), RedLight(CarA) ⇒ Fault(CarA)",
  },
  {
    id: "I20",
    name: "量词辖域提醒",
    formula: "∀x∃yG(x,y) ≠ ∃y∀xG(x,y)",
    note: "量词顺序改变会改变语义，建模交通关系时必须谨慎。",
    example: "每辆车都有前车 ≠ 存在一辆车是所有车的前车",
  },
  {
    id: "I21",
    name: "变量替换",
    formula: "G(x), x := CarA ⇒ G(CarA)",
    note: "用具体车辆替换变量时，要避免变量捕获和对象混淆。",
    example: "CausesCrash(x) 中 x 替换为 CarA，得到 CausesCrash(CarA)",
  },
];

const reasoningCases = [
  {
    title: "命题逻辑层",
    label: "快速判断",
    facts: ["P：车辆A闯红灯", "Q：车辆A导致碰撞", "(P ∧ Q) → R：满足条件则主责"],
    formula: "P\nQ\n(P ∧ Q) → R\n∴ R",
    output: "推出 R：车辆A承担主要责任。",
    warning: "优点是简洁；缺点是无法表达对象结构。",
    explain: "适合在系统原型中快速展示“事实触发规则”的基本推理链。",
  },
  {
    title: "谓词逻辑层",
    label: "对象关系",
    facts: ["Vehicle(CarA)", "RedLight(CarA)", "CausesCrash(CarA)"],
    formula: "∀x((RedLight(x) ∧ CausesCrash(x))\n  → MainResponsibility(x))\n∴ MainResponsibility(CarA)",
    output: "推出 MainResponsibility(CarA)。",
    warning: "能定位具体对象，也能解释触发的责任规则。",
    explain: "适合把事故数据、车辆对象和责任谓词统一到可扩展的知识库中。",
  },
  {
    title: "归结演绎层",
    label: "反证验证",
    facts: ["¬RedLight(x) ∨ ¬CausesCrash(x) ∨ MainResponsibility(x)", "RedLight(CarA)", "CausesCrash(CarA)"],
    formula: "加入目标否定：¬MainResponsibility(CarA)\n连续归结\n得到空子句 □",
    output: "推出空子句，说明目标结论成立。",
    warning: "重点是子句化和自动化搜索，适合程序实现。",
    explain: "后续系统可以把规则库转成子句集，用归结反演验证责任结论是否被支持。",
  },
];

const methodCards = [
  {
    icon: <PartitionOutlined />,
    title: "自然演绎推理",
    lead: "从已知事故事实出发，按推理规则逐步推出责任结论。每一步都有规则名称和前提来源，适合课堂展示和人工检查。",
    steps: ["列出事实", "匹配规则", "逐步推导", "输出证明链"],
    formula: "1. RedLight(CarA)\n2. RedLight(CarA) → MainResponsibility(CarA)\n3. MainResponsibility(CarA)    由 1,2 肯定前件式",
    details: [
      ["输入", "事实 + 规则"],
      ["过程", "逐行证明"],
      ["输出", "证明链 + 结论"],
      ["优势", "解释直观"],
    ],
  },
  {
    icon: <FileSearchOutlined />,
    title: "归结演绎推理",
    lead: "把公式转化为子句集，加入目标结论的否定，通过互补文字归结。如果最终得到空子句，就证明原结论成立。",
    steps: ["消去蕴含", "前束化", "子句化", "归结反演"],
    formula: "规则：¬RedLight(x) ∨ MainResponsibility(x)\n事实：RedLight(CarA)\n目标否定：¬MainResponsibility(CarA)\n归结结果：□",
    details: [
      ["输入", "子句集"],
      ["过程", "反证搜索"],
      ["输出", "空子句或失败"],
      ["优势", "便于自动化"],
    ],
  },
];

const systemFlow = [
  {
    icon: <CloudServerOutlined />,
    title: "事实库",
    text: "存放事故事实，例如 RedLight(CarA)、RearEnd(CarA, CarB)、WetRoad(Scene1)。",
  },
  {
    icon: <CodeOutlined />,
    title: "规则库",
    text: "存放交通法规和责任判定规则，例如闯红灯且导致事故时推定主要责任。",
  },
  {
    icon: <NodeIndexOutlined />,
    title: "推理机",
    text: "执行规则匹配、自然演绎证明、子句转换和归结反演。",
  },
  {
    icon: <ApiOutlined />,
    title: "结果解释",
    text: "展示责任结论、触发事实、使用规则和每一步推理依据。",
  },
];

const domains = [
  {
    icon: <CarOutlined />,
    title: "智能网联汽车事故定责",
    intro: "本课设的核心选题，适合展示知识表示、确定性推理和可解释结论。",
    tags: ["责任划分", "证据链", "规则推导"],
  },
  {
    icon: <MedicineBoxOutlined />,
    title: "疾病辅助诊断",
    intro: "把症状和检查结果写成事实，把医学知识写成规则，推理得到可能诊断。",
    tags: ["症状事实", "诊断规则", "辅助决策"],
  },
  {
    icon: <ToolOutlined />,
    title: "设备故障诊断",
    intro: "告警、日志、温度、电压等状态可转化为事实，故障机理可转化为规则。",
    tags: ["状态监测", "故障定位", "排障建议"],
  },
  {
    icon: <BranchesOutlined />,
    title: "法律与合规审查",
    intro: "条款、证据和行为之间存在条件关系，适合用确定性推理生成解释链。",
    tags: ["条款匹配", "证据审查", "结论解释"],
  },
];

function sectionTone(index) {
  const tone = PALETTE[index % PALETTE.length];
  return {
    "--tone-color": tone.color,
    "--tone-ink": tone.ink,
    "--tone-soft": tone.soft,
  };
}

function SectionHeader({ index, title, description }) {
  return (
    <header className="lecture-section-head-v3">
      <span>{String(index).padStart(2, "0")}</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
  );
}

function FormulaCode({ children }) {
  return <code className="formula-code-v3">{children}</code>;
}

export default function ReasoningOverview() {
  return (
    <main className="page-shell reasoning-overview-page lecture-page-v2">
      <section className="reasoning-knowledge-hero reasoning-hero-v3">
        <div className="reasoning-hero-copy-v3">
          <Tag className="lecture-tag-v2">问题背景与相关知识</Tag>
          <Title level={1}>智能网联汽车事故责任辅助判定</Title>
          <Paragraph>
            本系统面向“事故事实复杂、交通规则明确、责任结论需要解释”的场景。页面先介绍选题背景，再从命题逻辑和一阶谓词逻辑说明如何表示事故知识，最后整理自然演绎与归结演绎所依赖的推理规则。
          </Paragraph>
          <Paragraph>
            设计目标不是简单给出“谁负责”的结果，而是让系统能够说明：哪些事实被确认、哪些规则被触发、每一步如何推出责任结论。
          </Paragraph>
          <div className="reasoning-action-row">
            <Tag color="#0f766e">命题逻辑</Tag>
            <Tag color="#0891b2">一阶谓词逻辑</Tag>
            <Tag color="#2563eb">自然演绎</Tag>
            <Tag color="#7c3aed">归结演绎</Tag>
            <Tag color="#8E4184">可解释定责</Tag>
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
            <span><CarOutlined /></span>
            <div>
              <strong>选题定位</strong>
              <small>从事故证据到责任结论的确定性推理系统</small>
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
                <Progress percent={item.percent} showInfo={false} strokeColor={PALETTE[index].color} trailColor="rgba(255,255,255,0.16)" />
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
            {["事故事实", "逻辑表示", "规则推理", "责任解释"].map((item, index) => (
              <span key={item} style={sectionTone(index)}>{item}</span>
            ))}
          </div>
        </div>
      </section>

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

      <Alert
        className="overview-study-alert-v4"
        icon={<ThunderboltOutlined />}
        message="展示重点"
        description="本页面不改变老师要求的介绍顺序：先交代问题背景，再说明命题逻辑知识表示法和一阶谓词逻辑表示法，随后整理命题逻辑与谓词逻辑中的常用推理规则，最后自然过渡到后续自然演绎和归结演绎两个实现模块。"
        showIcon
        type="info"
      />

      <section className="lecture-block-v2 reasoning-block-v3 reasoning-background-section is-background-topic">
        <SectionHeader
          index={1}
          title="问题背景：为什么选择智能网联汽车事故责任辅助判定"
          description="事故责任判定需要把多源证据、交通规则和责任结论连成可解释的推理链，正好适合用确定性推理来建模。"
        />
        <div className="reasoning-background-grid reasoning-card-grid-v3">
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
        <div className="scenario-flow-v3">
          {scenarioSteps.map(([title, text], index) => (
            <article key={title} style={sectionTone(index)}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{title}</strong>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <div className="reasoning-summary-band is-dense reasoning-summary-v3">
          <CheckCircleOutlined />
          <div>
            <strong>建模主线</strong>
            <p>
              自然语言事实先转成逻辑事实，交通规则再转成逻辑规则。推理系统根据事实和规则推出责任结论，并展示推理依据，从而体现人工智能原理中“知识表示 + 确定性推理 + 可解释应用”的完整链条。
            </p>
          </div>
        </div>
      </section>

      <section className="lecture-block-v2 reasoning-block-v3 is-proposition-topic">
        <SectionHeader
          index={2}
          title="命题逻辑知识表示法"
          description="命题逻辑适合先建立责任判定的规则骨架：把事故陈述抽象为真假命题，再用联结词构造推理条件。"
        />
        <div className="concept-strip-v2 predicate-strip-v2 concept-grid-v3">
          {propositionCards.map((item, index) => (
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
            <span className="contrast-icon-v3"><TagOutlined /></span>
            <div>
              <span>命题层表达</span>
              <strong>P：车辆A闯红灯</strong>
              <p>把完整陈述作为一个整体命题，只判断它是否成立。</p>
            </div>
          </div>
          <SwapOutlined />
          <div className="contrast-card-v3 is-predicate">
            <span className="contrast-icon-v3"><FunctionOutlined /></span>
            <div>
              <span>谓词层表达</span>
              <strong>RedLight(CarA)</strong>
              <p>拆出谓词 RedLight 和对象 CarA，可以继续表达对象关系。</p>
            </div>
          </div>
        </div>
      </section>

      <section className="lecture-block-v2 reasoning-block-v3 is-predicate-topic">
        <SectionHeader
          index={3}
          title="一阶谓词逻辑表示法"
          description="一阶谓词逻辑能描述车辆、驾驶员、道路、时间、行为之间的关系，更适合作为事故知识库的正式表示。"
        />
        <div className="concept-strip-v2 predicate-strip-v2 concept-grid-v3">
          {predicateCards.map((item, index) => (
            <article key={item.title} style={sectionTone(index + 2)}>
              <strong>{item.title}</strong>
              <Paragraph>{item.intro}</Paragraph>
              <FormulaCode>{item.code}</FormulaCode>
              <Paragraph>{item.note}</Paragraph>
            </article>
          ))}
        </div>
        <div className="reasoning-summary-band is-dense reasoning-summary-v3">
          <ThunderboltOutlined />
          <div>
            <strong>事故定责中的谓词化思路</strong>
            <p>
              先确定对象：CarA、CarB、Scene1；再设计谓词：RedLight(x)、RearEnd(x,y)、HasPriority(x,y)、MainResponsibility(x)；最后把法规规则写成全称条件式，把现场证据写成具体事实。
            </p>
          </div>
        </div>
      </section>

      <section className="lecture-block-v2 reasoning-block-v3 is-proposition-rules-topic">
        <SectionHeader
          index={4}
          title="命题逻辑中常用的推理规则"
          description="这些规则负责把已知命题推进到新命题，是自然演绎证明和归结前逻辑转换的基础。"
        />
        <div className="rule-table-v2 rule-grid-v3">
          {propositionRules.map(([id, name, formula, note], index) => (
            <article key={id} style={sectionTone(index)}>
              <span>{id}</span>
              <strong>{name}</strong>
              <FormulaCode>{formula}</FormulaCode>
              <p>{note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lecture-block-v2 reasoning-block-v3 is-predicate-rules-topic">
        <SectionHeader
          index={5}
          title="谓词逻辑中的推理规则"
          description="谓词逻辑推理的重点是量词处理、变量替换和规则实例化，必须保证对象语义清楚、变量不混淆。"
        />
        <div className="reasoning-summary-band is-dense reasoning-summary-v3">
          <AuditOutlined />
          <div>
            <strong>推理前提定理</strong>
            <p>
              H 是前提集合 Γ = {"{G1, G2, ..., Gn}"} 的逻辑结果，当且仅当 G1 ∧ G2 ∧ ... ∧ Gn → H 为有效公式。也就是说，可以把“前提是否推出结论”转化为“公式是否有效”来判断。
            </p>
          </div>
        </div>
        <div className="predicate-rule-grid predicate-grid-v3">
          {predicateRules.map((item, index) => (
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
      </section>

      <section className="lecture-block-v2 reasoning-block-v3 is-cases-topic">
        <SectionHeader
          index={6}
          title="从事故事实到责任结论：三种表示层次"
          description="同一个事故责任问题，可以先用命题逻辑建立规则骨架，再用谓词逻辑细化对象，最后用归结演绎做自动验证。"
        />
        <div className="reasoning-case-grid case-grid-v3">
          {reasoningCases.map((item, index) => (
            <article key={item.title} style={sectionTone(index + 2)}>
              <div className="case-card-head">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.label}</small>
                </div>
              </div>
              <div className="case-card-body">
                <div className="case-fact-list">
                  <b>输入事实 / 规则</b>
                  <ul>
                    {item.facts.map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                </div>
                <div className="case-formula-box">
                  <b>推理形式</b>
                  <FormulaCode>{item.formula}</FormulaCode>
                </div>
              </div>
              <div className="case-output-row">
                <span>{item.output}</span>
                <span>{item.warning}</span>
              </div>
              <p>{item.explain}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lecture-block-v2 reasoning-block-v3 is-methods-topic">
        <SectionHeader
          index={7}
          title="基于推理规则的基本方法"
          description="自然演绎和归结演绎都属于确定性推理，但一个强调证明过程，一个强调自动化反证验证。"
        />
        <div className="method-panel-v2 method-grid-v3">
          {methodCards.map((item, index) => (
            <article key={item.title} style={sectionTone(index + 2)}>
              <span>{item.icon}</span>
              <div>
                <h3>{item.title}</h3>
                <Paragraph>{item.lead}</Paragraph>
                <ul>
                  {item.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
                <div className="method-detail-grid">
                  {item.details.map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <FormulaCode>{item.formula}</FormulaCode>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="lecture-block-v2 reasoning-block-v3 is-system-topic">
        <SectionHeader
          index={8}
          title="确定性推理系统如何落到本课设"
          description="后续系统实现可以围绕事实库、规则库、推理机和结果解释四个部分展开。"
        />
        <div className="system-flow-grid system-flow-v3">
          {systemFlow.map((item, index) => (
            <article key={item.title} style={sectionTone(index)}>
              <span>{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lecture-block-v2 reasoning-block-v3 is-domains-topic">
        <SectionHeader
          index={9}
          title="确定性推理的相关应用领域"
          description="只要领域中存在明确事实、明确规则和可验证结论，就可以考虑使用确定性推理进行辅助决策。"
        />
        <div className="domain-grid-v2 domain-grid-v3">
          {domains.map((item, index) => (
            <article key={item.title} style={sectionTone(index)}>
              <span>{item.icon}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.intro}</p>
              </div>
              <div className="domain-tag-row tag-row-v3">
                {item.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
