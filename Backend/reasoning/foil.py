# -*- coding: utf-8 -*-
"""FOIL（First Order Inductive Learner，一阶归纳学习器）。

输入：成员（实体）、关系（二元谓词事实）、目标谓词 P。
过程：序贯覆盖 + 从一般到特殊 + 信息增益（FOIL_Gain）。
输出：学到的推理规则、逐轮增益计算轨迹、以及据规则补全得到的新关系。
"""

import math
from itertools import product

HEAD_VARS = {"x", "y"}
BASE_CANDIDATE_VARS = ["x", "y", "z"]
EXTRA_CANDIDATE_VARS = ["w", "u", "v", "t", "r", "s"]
MAX_CANDIDATE_VAR_COUNT = len(BASE_CANDIDATE_VARS) + len(EXTRA_CANDIDATE_VARS)


def _fmt_literal(pred, v1, v2):
    return f"{pred}({v1}, {v2})"


def _fmt_body(body):
    if not body:
        return "∅"
    return " ∧ ".join(_fmt_literal(*lit) for lit in body)


def _fmt_rule(body, target):
    head = f"{target}(x, y)"
    if not body:
        return f"→ {head}"
    return f"{_fmt_body(body)} → {head}"


def _body_vars(body):
    return {var for _, v1, v2 in body for var in (v1, v2)}


def _is_safe_body(body):
    """规则安全性：规则头 Father(x, y) 中的 x、y 必须都被规则体约束。"""
    return HEAD_VARS.issubset(_body_vars(body))


def _build_examples(relations, target):
    """构造正例 E⁺ 与反例 E⁻。

    正例：图谱中已知的目标谓词实例。
    反例：对每条非目标的已知事实 rel(a,b)，若 target(a,b) 不是正例，
          则 ¬target(a,b) 是一个反例（与课件一致的反例构造法）。
    """
    positives = []
    seen_pos = set()
    for r in relations:
        if r["predicate"] == target:
            pair = (r["head"], r["tail"])
            if pair not in seen_pos:
                seen_pos.add(pair)
                positives.append(pair)

    negatives = []
    seen_neg = set()
    for r in relations:
        if r["predicate"] == target:
            continue
        pair = (r["head"], r["tail"])
        if pair in seen_pos or pair in seen_neg:
            continue
        seen_neg.add(pair)
        negatives.append(pair)
    return positives, negatives


def _index_facts(relations, target):
    """背景事实（非目标谓词）按谓词建立索引，便于匹配规则体。"""
    index = {}
    for r in relations:
        if r["predicate"] == target:
            continue
        index.setdefault(r["predicate"], set()).add((r["head"], r["tail"]))
    return index


def _covers(body, a, b, fact_index):
    """规则体 body 在 x=a, y=b 时能否被满足（存在体变量的一组赋值）。"""
    if not body:
        return True

    def match(i, binding):
        if i == len(body):
            return True
        pred, v1, v2 = body[i]
        for (e1, e2) in fact_index.get(pred, ()):
            nb = dict(binding)
            ok = True
            for var, ent in ((v1, e1), (v2, e2)):
                if var in nb:
                    if nb[var] != ent:
                        ok = False
                        break
                else:
                    nb[var] = ent
            if ok and match(i + 1, nb):
                return True
        return False

    return match(0, {"x": a, "y": b})


def _var_sort_key(var):
    order = ["x", "y", "z", "w", "u", "v", "t", "r", "s"]
    return (order.index(var) if var in order else len(order), var)


def _find_witness(body, a, b, fact_index):
    """返回规则体成立时的一组变量绑定与事实匹配路径，用于前端推理溯源。"""
    if not body:
        return None

    def match(i, binding, path):
        if i == len(body):
            ordered_binding = {
                key: binding[key]
                for key in sorted(binding.keys(), key=_var_sort_key)
            }
            return {"binding": ordered_binding, "path": path}

        pred, v1, v2 = body[i]
        for (e1, e2) in sorted(fact_index.get(pred, ())):
            nb = dict(binding)
            ok = True
            for var, ent in ((v1, e1), (v2, e2)):
                if var in nb:
                    if nb[var] != ent:
                        ok = False
                        break
                else:
                    nb[var] = ent
            if not ok:
                continue

            step = {
                "literal": _fmt_literal(pred, v1, v2),
                "fact": f"{pred}({e1}, {e2})",
                "predicate": pred,
                "head": e1,
                "tail": e2,
                "vars": [v1, v2],
            }
            result = match(i + 1, nb, [*path, step])
            if result:
                return result
        return None

    return match(0, {"x": a, "y": b}, [])


def _count_cover(body, examples, fact_index):
    return sum(1 for (a, b) in examples if _covers(body, a, b, fact_index))


def _fmt_examples(target, examples, neg=False):
    prefix = "¬" if neg else ""
    return [f"{prefix}{target}({a}, {b})" for (a, b) in examples]


def _foil_gain(chp, chn, mp, mn):
    """FOIL_Gain = m̂₊ · ( log2(m̂₊/(m̂₊+m̂₋)) − log2(m₊/(m₊+m₋)) )。

    m̂₊ = 0 时为负无穷，记为 None（NA）。
    """
    if chp == 0:
        return None
    new_purity = math.log2(chp / (chp + chn)) if (chp + chn) > 0 else 0.0
    old_purity = math.log2(mp / (mp + mn)) if (mp + mn) > 0 else 0.0
    return chp * (new_purity - old_purity)


def _base_var_pool(body):
    """课件例子从 x/y/z 开始；若规则体已引入更多变量，则后续轮次继续保留它们。"""
    body_vars = _body_vars(body)
    pool = list(BASE_CANDIDATE_VARS)
    for var in EXTRA_CANDIDATE_VARS:
        if var in body_vars:
            pool.append(var)
    return pool


def _next_candidate_var(var_pool):
    for var in EXTRA_CANDIDATE_VARS:
        if var not in var_pool:
            return var
    return None


def _candidate_literals(body_predicates, var_pool):
    """生成候选前提：背景谓词 × 当前变量池中两两不同的变量绑定。"""
    candidates = []
    for pred in body_predicates:
        for v1, v2 in product(var_pool, repeat=2):
            if v1 == v2:
                continue
            candidates.append((pred, v1, v2))
    return candidates


def _score_candidates(candidates, body, current_pos, current_neg, fact_index, mp, mn):
    scored = []
    body_vars = _body_vars(body)
    missing_head = HEAD_VARS - body_vars
    for lit in candidates:
        trial = body + [lit]
        chp = _count_cover(trial, current_pos, fact_index)
        chn = _count_cover(trial, current_neg, fact_index)
        gain = _foil_gain(chp, chn, mp, mn)
        literal_vars = {lit[1], lit[2]}
        trial_vars = _body_vars(trial)
        scored.append(
            {
                "literal": _fmt_literal(*lit),
                "lit": lit,
                "coverPos": chp,
                "coverNeg": chn,
                "gain": None if gain is None else round(gain, 2),
                "gainRaw": gain,
                "bindsMissingHead": len(missing_head & literal_vars),
                "isSafe": HEAD_VARS.issubset(trial_vars),
                "newExistentialCount": sum(
                    1 for var in (literal_vars - body_vars) if var not in HEAD_VARS
                ),
            }
        )
    return scored


def _best_candidate(scored):
    valid = [s for s in scored if s["gainRaw"] is not None]
    if not valid:
        return None, valid
    return max(
        valid,
        key=lambda s: (
            s["gainRaw"],
            -s["coverNeg"],
            1 if s["isSafe"] else 0,
            s["bindsMissingHead"],
            -s["newExistentialCount"],
        ),
    ), valid


def _candidate_formula(body_predicates, var_pool, candidate_count):
    n = len(var_pool)
    return f"{len(body_predicates)} × {n} × ({n} - 1) = {candidate_count}"


def _pick_candidate_pool(body, body_predicates, current_pos, current_neg, fact_index, mp, mn):
    """按课件流程先用 x/y/z；若这一池无法产生有效细化，再扩展到 w/u/...。"""
    var_pool = _base_var_pool(body)
    attempts = []

    while True:
        candidates = _candidate_literals(body_predicates, var_pool)
        scored = _score_candidates(candidates, body, current_pos, current_neg, fact_index, mp, mn)
        best, valid = _best_candidate(scored)
        attempts.append(
            {
                "vars": list(var_pool),
                "candidateCount": len(scored),
                "bestGain": None if not best else (None if best["gain"] is None else best["gain"]),
            }
        )

        useful = False
        if best:
            useful = best["gainRaw"] > 0
            # 反例已经清空时，若规则头变量还没被约束，继续补充能绑定缺失变量的文字。
            if mn == 0 and not _is_safe_body(body) and best["bindsMissingHead"] > 0:
                useful = True

        next_var = _next_candidate_var(var_pool)
        if useful or len(var_pool) >= MAX_CANDIDATE_VAR_COUNT or next_var is None:
            return var_pool, scored, valid, best, attempts

        var_pool = [*var_pool, next_var]


def _learn_one_rule(positives, negatives, fact_index, body_predicates, target, max_len=6):
    body = []
    current_pos = list(positives)
    current_neg = list(negatives)
    mp = len(current_pos)
    mn = len(current_neg)
    rounds = []

    while (mn > 0 or not _is_safe_body(body)) and len(body) < max_len:
        var_pool, scored, valid, best, pool_attempts = _pick_candidate_pool(
            body, body_predicates, current_pos, current_neg, fact_index, mp, mn
        )
        candidate_formula = _candidate_formula(body_predicates, var_pool, len(scored))

        # 选信息增益最大者（NA 视为无效）
        if not valid:
            rounds.append(
                {
                    "baseRule": _fmt_rule(body, target),
                    "basePos": mp,
                    "baseNeg": mn,
                    "candidateVars": var_pool,
                    "candidateFormula": candidate_formula,
                    "candidatePoolAttempts": pool_attempts,
                    "beforePos": _fmt_examples(target, current_pos),
                    "beforeNeg": _fmt_examples(target, current_neg, neg=True),
                    "candidates": _public(scored),
                    "chosen": None,
                    "chosenStats": None,
                    "filterRule": None,
                    "afterPos": _fmt_examples(target, current_pos),
                    "afterNeg": _fmt_examples(target, current_neg, neg=True),
                    "removedPos": [],
                    "removedNeg": [],
                }
            )
            break
        trial_body = body + [best["lit"]]
        next_pos = [p for p in current_pos if _covers(trial_body, p[0], p[1], fact_index)]
        next_neg = [p for p in current_neg if _covers(trial_body, p[0], p[1], fact_index)]
        removed_pos = [p for p in current_pos if p not in next_pos]
        removed_neg = [p for p in current_neg if p not in next_neg]
        rounds.append(
            {
                "baseRule": _fmt_rule(body, target),
                "basePos": mp,
                "baseNeg": mn,
                "candidateVars": var_pool,
                "candidateFormula": candidate_formula,
                "candidatePoolAttempts": pool_attempts,
                "beforePos": _fmt_examples(target, current_pos),
                "beforeNeg": _fmt_examples(target, current_neg, neg=True),
                "candidates": _public(scored),
                "chosen": best["literal"],
                "chosenStats": {
                    "coverPos": best["coverPos"],
                    "coverNeg": best["coverNeg"],
                    "gain": None if best["gain"] is None else best["gain"],
                },
                "filterRule": _fmt_rule(trial_body, target),
                "afterPos": _fmt_examples(target, next_pos),
                "afterNeg": _fmt_examples(target, next_neg, neg=True),
                "removedPos": _fmt_examples(target, removed_pos),
                "removedNeg": _fmt_examples(target, removed_neg, neg=True),
            }
        )

        lit = best["lit"]
        body.append(lit)
        prev_mn = mn
        current_pos = next_pos
        current_neg = next_neg
        mp = len(current_pos)
        mn = len(current_neg)

        if best["gainRaw"] <= 0 and mn >= prev_mn and _is_safe_body(body):
            # 已经是安全规则，但无法继续降低反例覆盖，停止。
            break

    return body, rounds


def _public(scored):
    return [{k: s[k] for k in ("literal", "coverPos", "coverNeg", "gain")} for s in scored]


def run_foil(members, relations, target):
    entities = [m["name"] for m in members]
    positives, negatives = _build_examples(relations, target)
    fact_index = _index_facts(relations, target)
    body_predicates = sorted(fact_index.keys())

    rules = []
    trace = []
    remaining = list(positives)
    guard = 0

    while remaining and guard < 12:
        guard += 1
        remaining_before = list(remaining)
        body, rounds = _learn_one_rule(remaining, negatives, fact_index, body_predicates, target)
        covered = [p for p in remaining if _covers(body, p[0], p[1], fact_index)]
        rule_obj = {
            "body": [_fmt_literal(*lit) for lit in body],
            "formula": _fmt_rule(body, target),
            "covered": [f"{target}({a}, {b})" for (a, b) in covered],
        }
        rules.append(rule_obj)
        # 序贯覆盖：移除已覆盖的正例
        before = len(remaining)
        remaining = [p for p in remaining if p not in covered]
        trace.append(
            {
                "rule": rule_obj["formula"],
                "rounds": rounds,
                "remainingBefore": [f"{target}({a}, {b})" for (a, b) in remaining_before],
                "covered": rule_obj["covered"],
                "remainingAfter": [f"{target}({a}, {b})" for (a, b) in remaining],
            }
        )
        if len(remaining) == before:
            # 没有任何正例被覆盖，避免死循环
            break
        if not body:
            break

    # 用学到的规则补全：对所有有序实体对应用规则（见 _finalize）
    return _finalize(members, relations, target, positives, negatives,
                     body_predicates, fact_index, rules, trace)


def _parse_literal(text):
    # "Couple(x, z)" -> ("Couple","x","z")
    pred, rest = text.split("(", 1)
    args = rest.rstrip(")").split(",")
    return (pred.strip(), args[0].strip(), args[1].strip())


def _finalize(members, relations, target, positives, negatives,
              body_predicates, fact_index, rules, trace):
    entities = [m["name"] for m in members]
    pos_set = set(positives)
    inferred = []
    seen = set()
    for a, b in product(entities, repeat=2):
        if a == b:
            continue
        if (a, b) in pos_set:
            continue
        for rule_index, rule in enumerate(rules):
            body = [_parse_literal(t) for t in rule["body"]]
            proof = _find_witness(body, a, b, fact_index) if body and _is_safe_body(body) else None
            if proof:
                if (a, b) not in seen:
                    seen.add((a, b))
                    inferred.append({"predicate": target, "head": a, "tail": b,
                                     "formula": f"{target}({a}, {b})",
                                     "proof": {
                                         "ruleIndex": rule_index,
                                         "ruleFormula": rule["formula"],
                                         "body": rule["body"],
                                         "binding": proof["binding"],
                                         "path": proof["path"],
                                     }})
                break

    return {
        "target": target,
        "members": members,
        "relations": relations,
        "positives": [f"{target}({a}, {b})" for (a, b) in positives],
        "negatives": [f"¬{target}({a}, {b})" for (a, b) in negatives],
        "background": sorted(
            f"{pred}({a}, {b})"
            for pred, pairs in fact_index.items()
            for (a, b) in pairs
        ),
        "bodyPredicates": body_predicates,
        "rules": rules,
        "trace": trace,
        "inferred": inferred,
        "counts": {"positives": len(positives), "negatives": len(negatives)},
    }


def derive_samples(members, relations, target):
    """供知识库构建页展示：背景样例集合 + 正例/反例集合。"""
    positives, negatives = _build_examples(relations, target)
    fact_index = _index_facts(relations, target)
    background = sorted(
        f"{pred}({a}, {b})" for pred, pairs in fact_index.items() for (a, b) in pairs
    )
    return {
        "background": background,
        "positives": [f"{target}({a}, {b})" for (a, b) in positives],
        "negatives": [f"¬{target}({a}, {b})" for (a, b) in negatives],
        "counts": {"positives": len(positives), "negatives": len(negatives),
                   "background": len(background)},
    }
