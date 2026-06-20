"""基于 Z3 的事故责任推理引擎。

提供两种确定性推理：
1. natural_deduction —— 自然演绎：从事实出发，按推理规则（全称特指 US、
   合取引入 ∧I、肯定前件式 MP）前向链式逐步推出目标，每一步都用 Z3 校验其逻辑有效性。
2. resolution_deduction —— 归结演绎：把事实、规则、目标否定转成子句集，
   逐步执行归结反演直到推出空子句 □，并用 Z3 的 unsat 作为权威验证。

引擎输入是知识库的 facts / rules（与 reasoning_knowledge_base 结构一致），
所以知识库的增删改查会实时影响推理结果。
"""

import itertools
import re

from z3 import And, Bool, BoolSort, Const, DeclareSort, ForAll, Function, Implies, Not, Solver, sat, unsat


# ----------------------------------------------------------------------------
# 公式解析：把 "RedLight(CarA)" / "RearEnd(x, y)" 解析为 (谓词, [参数...])
# ----------------------------------------------------------------------------

ATOM_RE = re.compile(r"^\s*(?P<pred>[A-Za-z_][A-Za-z0-9_]*)\s*\((?P<args>[^)]*)\)\s*$")
VARIABLE_NAMES = {"x", "y", "z", "u", "v", "w", "t"}


def parse_atom(text):
    """把 'Pred(a, b)' 解析为 ('Pred', ['a', 'b'])，无法解析时返回 None。"""
    if not text:
        return None
    match = ATOM_RE.match(str(text))
    if not match:
        return None
    pred = match.group("pred")
    raw_args = match.group("args").strip()
    args = [part.strip() for part in raw_args.split(",") if part.strip()] if raw_args else []
    return pred, args


def is_variable(term):
    return term in VARIABLE_NAMES


def atom_to_str(pred, args):
    return f"{pred}({', '.join(args)})"


# ----------------------------------------------------------------------------
# Z3 符号工厂：把领域对象做成单一未解释 sort，谓词做成布尔函数。
# ----------------------------------------------------------------------------


class SymbolTable:
    """统一管理 Z3 的 sort、对象常量、谓词函数，保证同名复用。"""

    def __init__(self):
        self.sort = DeclareSort("Obj")
        self.consts = {}
        self.preds = {}

    def const(self, name):
        if name not in self.consts:
            self.consts[name] = Const(name, self.sort)
        return self.consts[name]

    def predicate(self, name, arity):
        key = (name, arity)
        if key not in self.preds:
            domain = [self.sort] * arity + [BoolSort()]
            self.preds[key] = Function(name, *domain)
        return self.preds[key]

    def atom_expr(self, pred, args):
        """把具体原子（参数均为常量）转成 Z3 布尔表达式。"""
        func = self.predicate(pred, len(args))
        return func(*[self.const(a) for a in args])


# ----------------------------------------------------------------------------
# 合一：把规则前提中的变量绑定到事实里的具体对象。
# ----------------------------------------------------------------------------


def unify(rule_args, fact_args, subst):
    """单个原子的合一：rule_args 里的变量尝试绑定 fact_args 的常量。"""
    if len(rule_args) != len(fact_args):
        return None
    new_subst = dict(subst)
    for r_arg, f_arg in zip(rule_args, fact_args):
        if is_variable(r_arg):
            if r_arg in new_subst and new_subst[r_arg] != f_arg:
                return None
            new_subst[r_arg] = f_arg
        elif r_arg != f_arg:
            return None
    return new_subst


def apply_subst(args, subst):
    return [subst.get(a, a) for a in args]


# ----------------------------------------------------------------------------
# 自然演绎：前向链 + 每步 Z3 校验
# ----------------------------------------------------------------------------


def natural_deduction(facts, rules, goal):
    """从 facts 出发，按规则前向链推理，返回逐步证明。

    返回 dict：
        proved: bool                是否推出目标
        goal: str                   目标公式
        usedRules: [..]             实际用到的推理规则（含元规则）
        steps: [..]                 证明步骤（行号、公式、依据、前提行）
        conclusion: str             结论说明
    """
    symbols = SymbolTable()

    goal_atom = parse_atom(goal)
    goal_norm = atom_to_str(*goal_atom) if goal_atom else str(goal).strip()

    # 已知事实集合：formula 文本 -> 行号
    known = {}
    steps = []
    line_no = 0

    def add_step(formula, rule, premises, kind="fact"):
        nonlocal line_no
        line_no += 1
        known[formula] = line_no
        steps.append(
            {
                "line": line_no,
                "formula": formula,
                "rule": rule,
                "premises": premises,
                "kind": kind,
            }
        )
        return line_no

    # 1) 录入初始事实
    fact_atoms = []
    for fact in facts:
        atom = parse_atom(fact.get("formula") or "")
        if not atom:
            continue
        pred, args = atom
        formula = atom_to_str(pred, args)
        if formula in known:
            continue
        fact_atoms.append((pred, args))
        add_step(formula, "前提引入", [], kind="premise")

    used_rules = []

    def note_rule(name):
        if name not in used_rules:
            used_rules.append(name)

    # 2) 前向链：反复用规则实例化 + MP 推出新事实，直到不动点或命中目标
    changed = True
    safety = 0
    while changed and safety < 64:
        changed = False
        safety += 1
        for rule in rules:
            premises = [parse_atom(p) for p in rule.get("premises", [])]
            conclusion = parse_atom(rule.get("conclusion") or "")
            if not conclusion or any(p is None for p in premises):
                continue

            # 枚举所有能满足全部前提的变量绑定
            current_known_atoms = [parse_atom(f) for f in list(known.keys())]
            current_known_atoms = [a for a in current_known_atoms if a]

            substitutions = [{}]
            premise_lines_per_subst = [[]]
            for p_pred, p_args in premises:
                next_subs = []
                next_lines = []
                for subst, lines in zip(substitutions, premise_lines_per_subst):
                    for k_pred, k_args in current_known_atoms:
                        if k_pred != p_pred:
                            continue
                        unified = unify(p_args, k_args, subst)
                        if unified is None:
                            continue
                        matched_formula = atom_to_str(k_pred, k_args)
                        next_subs.append(unified)
                        next_lines.append(lines + [known[matched_formula]])
                substitutions = next_subs
                premise_lines_per_subst = next_lines
                if not substitutions:
                    break

            for subst, prem_lines in zip(substitutions, premise_lines_per_subst):
                c_pred, c_args = conclusion
                concrete_args = apply_subst(c_args, subst)
                if any(is_variable(a) for a in concrete_args):
                    continue
                concrete_formula = atom_to_str(c_pred, concrete_args)
                if concrete_formula in known:
                    continue

                ordered_lines = sorted(set(prem_lines))

                # —— 元规则注记：体现"采用的推理规则" ——
                rule_label = rule.get("name", "规则")
                # 实例化规则（全称特指 US）
                instantiated = _instantiate_rule_text(rule, subst)
                note_rule("全称特指 (US)")
                if len(premises) > 1:
                    note_rule("合取引入 (∧I)")
                note_rule("肯定前件式 (MP)")

                # —— Z3 校验该步：前提合取 ∧ 实例化规则 → 结论，必须有效 ——
                valid = _verify_step_z3(symbols, [atom_to_str(*premises_i_subst(p, subst)) for p in premises], rule, subst, concrete_formula)

                detail = f"{rule_label}：{instantiated}"
                add_step(
                    concrete_formula,
                    detail,
                    ordered_lines,
                    kind="derived" if valid else "derived-unverified",
                )
                steps[-1]["verified"] = bool(valid)
                steps[-1]["appliedRules"] = ["全称特指 (US)"] + (["合取引入 (∧I)"] if len(premises) > 1 else []) + ["肯定前件式 (MP)"]
                changed = True

                if concrete_formula == goal_norm:
                    return {
                        "proved": True,
                        "goal": goal_norm,
                        "usedRules": used_rules,
                        "steps": steps,
                        "conclusion": f"目标 {goal_norm} 成立：已由事实经推理规则逐步推出。",
                        "engine": "Z3",
                    }

    proved = goal_norm in known
    return {
        "proved": proved,
        "goal": goal_norm,
        "usedRules": used_rules,
        "steps": steps,
        "conclusion": (
            f"目标 {goal_norm} 成立。" if proved else f"在当前事实与规则下，无法推出 {goal_norm}。"
        ),
        "engine": "Z3",
    }


def premises_i_subst(premise_atom, subst):
    pred, args = premise_atom
    return pred, apply_subst(args, subst)


def _instantiate_rule_text(rule, subst):
    """把规则公式里的变量按合一替换，得到实例化后的可读公式。"""
    formula = rule.get("formula") or ""
    # 去掉前面的全称量词 ∀x∀y 等
    body = re.sub(r"^\s*(∀[A-Za-z]\s*)+", "", formula).strip()
    for var, val in subst.items():
        body = re.sub(rf"(?<![A-Za-z]){var}(?![A-Za-z0-9_])", val, body)
    return body


def _verify_step_z3(symbols, premise_formulas, rule, subst, conclusion_formula):
    """用 Z3 校验：前提集合 ∧ 规则实例 → 结论 是否有效（取反应 unsat）。"""
    try:
        solver = Solver()
        # 断言所有前提为真
        for pf in premise_formulas:
            atom = parse_atom(pf)
            if atom:
                solver.add(symbols.atom_expr(*atom))
        # 断言规则实例：前提合取 → 结论
        prem_exprs = []
        for p in rule.get("premises", []):
            atom = parse_atom(p)
            if atom:
                pred, args = atom
                concrete = apply_subst(args, subst)
                if not any(is_variable(a) for a in concrete):
                    prem_exprs.append(symbols.atom_expr(pred, concrete))
        concl_atom = parse_atom(conclusion_formula)
        if not concl_atom:
            return False
        concl_expr = symbols.atom_expr(*concl_atom)
        if prem_exprs:
            solver.add(Implies(And(*prem_exprs) if len(prem_exprs) > 1 else prem_exprs[0], concl_expr))
        # 取结论的否定，若整体 unsat 则该步有效
        solver.add(Not(concl_expr))
        return solver.check() == unsat
    except Exception:
        return False


def traffic_natural_deduction():
    """选题式自然演绎样例：智能网联汽车事故责任辅助判定。

    用自然演绎步骤展示 RedLight(CarA)、CausesCrash(CarA) 与主责规则推出
    MainResponsibility(CarA)，并用 Z3 Solver 检查前提合取且结论取反是否不可满足。
    """
    obj = DeclareSort("Obj")
    x = Const("x", obj)
    car_a = Const("CarA", obj)
    red_light = Function("RedLight", obj, BoolSort())
    causes_crash = Function("CausesCrash", obj, BoolSort())
    main_responsibility = Function("MainResponsibility", obj, BoolSort())

    fact_1 = red_light(car_a)
    fact_2 = causes_crash(car_a)
    responsibility_rule = ForAll(
        [x],
        Implies(And(red_light(x), causes_crash(x)), main_responsibility(x)),
    )
    conclusion = main_responsibility(car_a)

    solver = Solver()
    solver.add(fact_1)
    solver.add(fact_2)
    solver.add(responsibility_rule)
    solver.add(Not(conclusion))
    verdict = solver.check()

    steps = [
        {
            "line": 4,
            "formula": "RedLight(CarA) ∧ CausesCrash(CarA)",
            "rule": "合取引入",
            "premises": [1, 2],
            "kind": "derived",
            "verified": True,
            "appliedRules": ["∧I"],
            "description": "由事故事实 (1) 与 (2) 可知：车辆 A 闯红灯，并且该行为导致事故，二者同时成立。",
        },
        {
            "line": 5,
            "formula": "(RedLight(CarA) ∧ CausesCrash(CarA)) → MainResponsibility(CarA)",
            "rule": "全称量词消去",
            "premises": [3],
            "kind": "derived",
            "verified": True,
            "appliedRules": ["∀E"],
            "description": "把主责规则中的任意车辆 x 实例化为 CarA，得到本案可直接使用的责任判定规则。",
        },
        {
            "line": 6,
            "formula": "MainResponsibility(CarA)",
            "rule": "肯定前件式",
            "premises": [4, 5],
            "kind": "derived",
            "verified": verdict == unsat,
            "appliedRules": ["MP"],
            "description": "前件 RedLight(CarA) ∧ CausesCrash(CarA) 已成立，且该前件蕴含 MainResponsibility(CarA)，因此推出车辆 A 承担主要责任。",
        },
        {
            "line": 7,
            "formula": "Facts ∧ Rule ∧ ¬MainResponsibility(CarA) = unsat",
            "rule": "Z3 Solver 反证校验",
            "premises": [1, 2, 3, 6],
            "kind": "derived",
            "verified": verdict == unsat,
            "appliedRules": ["Z3 Solver"],
            "description": "Z3 检查“事故事实与主责规则为真，但车辆 A 不承担主要责任”为不可满足，说明该结论在当前知识库下有效。",
        },
    ]

    return {
        "proved": verdict == unsat,
        "goal": "MainResponsibility(CarA)",
        "engine": "Z3 Solver",
        "z3Verdict": str(verdict),
        "caseProfile": {
            "scene": "智能网联汽车事故责任辅助判定",
            "summary": "车辆 A 在红灯状态下进入路口，且该违规通行行为导致事故；依据主责规则证明车辆 A 承担主要责任。",
        },
        "premises": [
            {
                "line": 1,
                "formula": "RedLight(CarA)",
                "name": "事故事实 1",
                "description": "车辆 A 在红灯状态下进入路口。",
            },
            {
                "line": 2,
                "formula": "CausesCrash(CarA)",
                "name": "事故事实 2",
                "description": "车辆 A 的违规通行行为是碰撞发生的重要原因。",
            },
            {
                "line": 3,
                "formula": "∀x((RedLight(x) ∧ CausesCrash(x)) → MainResponsibility(x))",
                "name": "定责规则",
                "description": "若车辆 x 闯红灯并导致事故，则车辆 x 承担主要责任。",
            },
        ],
        "conclusionFormula": "MainResponsibility(CarA)",
        "proofIdea": "先确认事故事实与待证结论，再把通用定责规则实例化到 CarA，最后由合取事实和肯定前件式推出主责结论。",
        "usedRules": ["合取引入", "全称量词消去", "肯定前件式", "Z3 Solver 反证校验"],
        "steps": steps,
        "conclusion": "Z3 Solver 返回 unsat，说明事故事实和主责规则成立而 MainResponsibility(CarA) 不成立的情况不存在，因此车辆 A 主责结论有效。",
    }


# ----------------------------------------------------------------------------
# 归结演绎：子句化 + 逐步归结反演 + Z3 权威验证
# ----------------------------------------------------------------------------


class Literal:
    """子句中的文字：谓词 + 参数 + 是否取反。"""

    __slots__ = ("pred", "args", "negated")

    def __init__(self, pred, args, negated):
        self.pred = pred
        self.args = tuple(args)
        self.negated = negated

    def negate(self):
        return Literal(self.pred, self.args, not self.negated)

    def key(self):
        return (self.pred, self.args, self.negated)

    def is_complement(self, other):
        return (
            self.pred == other.pred
            and self.args == other.args
            and self.negated != other.negated
        )

    def __str__(self):
        body = atom_to_str(self.pred, list(self.args))
        return f"¬{body}" if self.negated else body


def clause_to_str(literals):
    if not literals:
        return "□"
    return " ∨ ".join(str(lit) for lit in literals)


def _ground_rule_clauses(rule):
    """把一条全称规则（前提∧ → 结论）转成子句：¬P1 ∨ ¬P2 ∨ ... ∨ C。

    含变量时，按规则自身的变量保留（归结时再就地合一到常量）。
    这里为案例做地面化：把变量按规则常见绑定展开由调用方负责，
    本函数返回带变量的文字，统一在归结阶段用常量替换。
    """
    lits = []
    for p in rule.get("premises", []):
        atom = parse_atom(p)
        if atom:
            lits.append(Literal(atom[0], atom[1], True))
    concl = parse_atom(rule.get("conclusion") or "")
    if concl:
        lits.append(Literal(concl[0], concl[1], False))
    return lits


def _substitute_clause(literals, subst):
    return [Literal(l.pred, apply_subst(list(l.args), subst), l.negated) for l in literals]


def resolution_deduction(facts, rules, goal):
    """归结反演：返回子句集、归结步骤、是否得到空子句。"""
    symbols = SymbolTable()

    goal_atom = parse_atom(goal)
    goal_norm = atom_to_str(*goal_atom) if goal_atom else str(goal).strip()

    # 1) 收集地面事实（用于把规则变量实例化到具体对象）
    fact_lits = []
    const_pool = set()
    fact_atoms = []
    for fact in facts:
        atom = parse_atom(fact.get("formula") or "")
        if not atom:
            continue
        pred, args = atom
        fact_atoms.append((pred, args))
        fact_lits.append([Literal(pred, args, False)])
        for a in args:
            if not is_variable(a):
                const_pool.add(a)

    # 2) 规则子句：把变量地面化到事实涉及的对象组合。
    #    为得到聚焦、干净的反演链，只保留"结论谓词与目标一致、且全部前提都已是已知事实"
    #    的规则实例（即真正可触发的责任规则），其余无关支路不进入子句集。
    fact_formula_set = {atom_to_str(p, a) for p, a in fact_atoms}
    goal_pred = goal_atom[0] if goal_atom else None
    rule_clauses = []
    rule_sources = []
    for rule in rules:
        var_lits = _ground_rule_clauses(rule)
        concl = parse_atom(rule.get("conclusion") or "")
        variables = sorted({a for l in var_lits for a in l.args if is_variable(a)})
        if not variables:
            rule_clauses.append(var_lits)
            rule_sources.append(rule.get("name", "规则"))
            continue
        consts = sorted(const_pool) or ["CarA"]
        for combo in itertools.product(consts, repeat=len(variables)):
            subst = dict(zip(variables, combo))
            grounded = _substitute_clause(var_lits, subst)
            # 结论必须命中目标
            concl_args = apply_subst(list(concl[1]), subst) if concl else []
            if not concl or concl[0] != goal_pred or atom_to_str(concl[0], concl_args) != goal_norm:
                continue
            # 所有前提（负文字）必须都是已知事实，规则才真正可触发
            premise_formulas = [
                atom_to_str(l.pred, list(l.args)) for l in grounded if l.negated
            ]
            if all(pf in fact_formula_set for pf in premise_formulas):
                rule_clauses.append(grounded)
                rule_sources.append(rule.get("name", "规则"))

    # 收集被已触发规则前提引用的事实（仅这些事实进入归结展示）
    referenced_fact_formulas = set()
    for lits in rule_clauses:
        for l in lits:
            if l.negated:
                referenced_fact_formulas.add(atom_to_str(l.pred, list(l.args)))

    # 3) 目标否定子句
    goal_negation = None
    if goal_atom:
        goal_negation = [Literal(goal_atom[0], goal_atom[1], True)]

    # 组装初始子句集（带来源标签）
    clause_set = []
    clause_display = []

    def add_clause(literals, source, kind):
        key = frozenset(l.key() for l in literals)
        for existing in clause_set:
            if existing["key"] == key:
                return existing
        entry = {
            "id": len(clause_set) + 1,
            "literals": literals,
            "key": key,
            "text": clause_to_str(literals),
            "source": source,
            "kind": kind,
        }
        clause_set.append(entry)
        clause_display.append(entry)
        return entry

    for lits, (pred, args) in zip(fact_lits, fact_atoms):
        # 只展示真正参与归结的事实（被某条已触发规则的前提引用）
        formula = atom_to_str(pred, args)
        if formula in referenced_fact_formulas:
            add_clause(lits, f"事实 {clause_to_str(lits)}", "fact")
    for lits, src in zip(rule_clauses, rule_sources):
        add_clause(lits, f"规则 {src}", "rule")
    if goal_negation:
        goal_entry = add_clause(goal_negation, f"目标否定 ¬{goal_norm}", "goal-negation")

    # 4) 逐步归结（集合支持策略 Set-of-Support）：
    #    每次归结至少有一个亲本来自"支持集"（目标否定 + 已生成的归结式），
    #    从而避开与反演无关的支路，得到一条聚焦、干净的归结链直到空子句 □。
    steps = []
    derived_empty = False
    support_ids = {goal_entry["id"]} if goal_negation else set()
    seen_pairs = set()
    safety = 0

    while safety < 256 and not derived_empty:
        safety += 1
        found = False
        for ci, cj in itertools.combinations(list(clause_set), 2):
            # 集合支持：至少一方在支持集中
            if ci["id"] not in support_ids and cj["id"] not in support_ids:
                continue
            pair_id = (ci["id"], cj["id"])
            if pair_id in seen_pairs:
                continue
            for li in ci["literals"]:
                for lj in cj["literals"]:
                    if li.is_complement(lj):
                        # 归结：合并两子句去掉互补文字
                        resolvent = [l for l in ci["literals"] if l.key() != li.key()]
                        resolvent += [l for l in cj["literals"] if l.key() != lj.key()]
                        # 去重
                        uniq = []
                        seen = set()
                        for l in resolvent:
                            if l.key() not in seen:
                                seen.add(l.key())
                                uniq.append(l)
                        resolvent_key = frozenset(l.key() for l in uniq)
                        # 跳过已存在子句
                        if any(e["key"] == resolvent_key for e in clause_set):
                            seen_pairs.add(pair_id)
                            continue
                        entry = add_clause(uniq, "归结生成", "resolvent")
                        support_ids.add(entry["id"])
                        steps.append(
                            {
                                "step": len(steps) + 1,
                                "parents": [ci["id"], cj["id"]],
                                "parentText": [ci["text"], cj["text"]],
                                "eliminated": str(li if not li.negated else lj if not lj.negated else li),
                                "literal": atom_to_str(li.pred, list(li.args)),
                                "resolvent": entry["text"],
                                "resolventId": entry["id"],
                                "isEmpty": len(uniq) == 0,
                            }
                        )
                        seen_pairs.add(pair_id)
                        found = True
                        if len(uniq) == 0:
                            derived_empty = True
                        break
                if found:
                    break
            if found:
                break
        if derived_empty or not found:
            break

    # 5) Z3 权威验证：事实 ∧ 规则 ∧ ¬目标 是否 unsat
    z3_result = _verify_resolution_z3(symbols, facts, rules, goal_atom)

    return {
        "proved": derived_empty,
        "goal": goal_norm,
        "clauses": [
            {"id": c["id"], "text": c["text"], "source": c["source"], "kind": c["kind"]}
            for c in clause_display
        ],
        "steps": steps,
        "derivedEmptyClause": derived_empty,
        "z3Verdict": z3_result,
        "conclusion": (
            f"归结得到空子句 □，反演成功：目标 {goal_norm} 成立。"
            if derived_empty
            else f"未能归结出空子句，无法用反演确认 {goal_norm}。"
        ),
        "engine": "Z3",
    }


def _verify_resolution_z3(symbols, facts, rules, goal_atom):
    """用 Z3 验证子句集 + 目标否定是否 unsat（即反演成立）。"""
    if not goal_atom:
        return "unknown"
    try:
        solver = Solver()
        for fact in facts:
            atom = parse_atom(fact.get("formula") or "")
            if atom:
                solver.add(symbols.atom_expr(*atom))
        for rule in rules:
            prem = [parse_atom(p) for p in rule.get("premises", [])]
            concl = parse_atom(rule.get("conclusion") or "")
            if not concl or any(p is None for p in prem):
                continue
            variables = sorted({a for atom in prem + [concl] for a in atom[1] if is_variable(a)})
            consts = sorted({a for f in facts for a in (parse_atom(f.get("formula") or "") or ("", []))[1] if not is_variable(a)})
            consts = consts or ["CarA"]
            import itertools as _it
            for combo in _it.product(consts, repeat=len(variables)) if variables else [()]:
                subst = dict(zip(variables, combo))
                prem_exprs = []
                ok = True
                for p_pred, p_args in prem:
                    cargs = apply_subst(p_args, subst)
                    if any(is_variable(a) for a in cargs):
                        ok = False
                        break
                    prem_exprs.append(symbols.atom_expr(p_pred, cargs))
                c_args = apply_subst(concl[1], subst)
                if not ok or any(is_variable(a) for a in c_args):
                    continue
                concl_expr = symbols.atom_expr(concl[0], c_args)
                body = And(*prem_exprs) if len(prem_exprs) > 1 else prem_exprs[0]
                solver.add(Implies(body, concl_expr))
        solver.add(Not(symbols.atom_expr(*goal_atom)))
        result = solver.check()
        return "unsat" if result == unsat else ("sat" if result == sat else "unknown")
    except Exception:
        return "unknown"


# ----------------------------------------------------------------------------
# 双方法对比
# ----------------------------------------------------------------------------


def compare_methods(facts, rules, goal):
    nd = natural_deduction(facts, rules, goal)
    rd = resolution_deduction(facts, rules, goal)
    return {
        "goal": nd["goal"],
        "engine": "Z3",
        "natural": {
            "proved": nd["proved"],
            "stepCount": len(nd["steps"]),
            "usedRules": nd["usedRules"],
            "conclusion": nd["conclusion"],
        },
        "resolution": {
            "proved": rd["proved"],
            "clauseCount": len(rd["clauses"]),
            "stepCount": len(rd["steps"]),
            "derivedEmptyClause": rd["derivedEmptyClause"],
            "z3Verdict": rd["z3Verdict"],
            "conclusion": rd["conclusion"],
        },
        "consistent": nd["proved"] == rd["proved"],
        "summary": (
            "两种方法结论一致：都确认了目标责任结论。"
            if nd["proved"] == rd["proved"] and nd["proved"]
            else "两种方法结论存在差异，请检查知识库。"
            if nd["proved"] != rd["proved"]
            else "两种方法都未能推出目标结论。"
        ),
    }
