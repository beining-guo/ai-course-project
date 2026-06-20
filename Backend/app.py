from copy import deepcopy
from uuid import uuid4

from flask import Flask, jsonify, request
from flask_cors import CORS

from data.causal_graph import CAUSAL_DAG, CAUSAL_EFFECT_STUDIES
from data.family_graph import FAMILY_GRAPH
from data.keypoint_analysis import KEYPOINT_ANALYSIS
from data.knowledge_overview import COURSE_OVERVIEW
from data.reasoning_knowledge_base import REASONING_KNOWLEDGE_BASE
from data.student_accounts import STUDENT_ACCOUNT_INDEX, STUDENT_ACCOUNTS
from reasoning import (
    compare_methods,
    derive_samples,
    natural_deduction,
    resolution_deduction,
    run_foil,
    traffic_natural_deduction,
)


KNOWLEDGE_BASE_STATE = deepcopy(REASONING_KNOWLEDGE_BASE)
FAMILY_GRAPH_STATE = deepcopy(FAMILY_GRAPH)
CAUSAL_DAG_STATE = deepcopy(CAUSAL_DAG)
TEACHER_ACCOUNT = {
    "username": "wlc",
    "password": "wlc",
    "name": "教师",
}


def _json_response(data=None, code=200, message="success", status=200):
    return jsonify({"code": code, "message": message, "data": data}), status


def _auth_payload(role, account, name, student_id=None):
    return {
        "role": role,
        "account": account,
        "name": name,
        "studentId": student_id,
    }


def _validate_login(role, username, password):
    if role == "teacher":
        if username == TEACHER_ACCOUNT["username"] and password == TEACHER_ACCOUNT["password"]:
            return _auth_payload("teacher", username, TEACHER_ACCOUNT["name"])
        return None

    if role == "student":
        student = STUDENT_ACCOUNT_INDEX.get(username)
        if student and password == f"st{username}":
            return _auth_payload("student", username, student["name"], username)
        return None

    return None


def _make_fact_formula(predicate, arguments):
    cleaned_args = [str(item).strip() for item in arguments if str(item).strip()]
    return f"{predicate}({', '.join(cleaned_args)})"


def _normalize_fact(payload, existing=None):
    payload = payload or {}
    item = {**(existing or {}), **payload}
    predicate = str(item.get("predicate", "")).strip()
    arguments = item.get("arguments", [])
    if isinstance(arguments, str):
        arguments = [part.strip() for part in arguments.split(",") if part.strip()]
    if not predicate:
        raise ValueError("predicate is required")
    if not arguments:
        raise ValueError("arguments are required")
    item["predicate"] = predicate
    item["arguments"] = arguments
    item["formula"] = str(item.get("formula") or _make_fact_formula(predicate, arguments)).strip()
    item["naturalLanguage"] = str(item.get("naturalLanguage", "")).strip()
    item["source"] = str(item.get("source", "手动维护")).strip()
    item["confidence"] = str(item.get("confidence", "确定")).strip()
    return item


def _normalize_rule(payload, existing=None):
    payload = payload or {}
    item = {**(existing or {}), **payload}
    name = str(item.get("name", "")).strip()
    formula = str(item.get("formula", "")).strip()
    conclusion = str(item.get("conclusion", "")).strip()
    premises = item.get("premises", [])
    if isinstance(premises, str):
        premises = [part.strip() for part in premises.split(",") if part.strip()]
    if not name:
        raise ValueError("name is required")
    if not formula:
        raise ValueError("formula is required")
    if not conclusion:
        raise ValueError("conclusion is required")
    item["name"] = name
    item["formula"] = formula
    item["premises"] = premises
    item["conclusion"] = conclusion
    item["naturalLanguage"] = str(item.get("naturalLanguage", "")).strip()
    item["method"] = str(item.get("method", "自然演绎 / 归结演绎")).strip()
    return item


def _normalize_member(payload, existing=None):
    payload = payload or {}
    item = {**(existing or {}), **payload}
    name = str(item.get("name", "")).strip()
    gender = str(item.get("gender", "")).strip() or "unknown"
    if not name:
        raise ValueError("name is required")
    if gender not in ("male", "female", "unknown"):
        gender = "unknown"
    item["name"] = name
    item["gender"] = gender
    return item


def _normalize_relation(payload, members, existing=None):
    payload = payload or {}
    item = {**(existing or {}), **payload}
    predicate = str(item.get("predicate", "")).strip()
    head = str(item.get("head", "")).strip()
    tail = str(item.get("tail", "")).strip()
    if not predicate:
        raise ValueError("predicate is required")
    if not head or not tail:
        raise ValueError("head and tail are required")
    member_names = {m["name"] for m in members}
    if head not in member_names:
        raise ValueError(f"head member '{head}' does not exist")
    if tail not in member_names:
        raise ValueError(f"tail member '{tail}' does not exist")
    if head == tail:
        raise ValueError("head and tail must be different members")
    item["predicate"] = predicate
    item["head"] = head
    item["tail"] = tail
    return item


def _normalize_relation_type(payload):
    payload = payload or {}
    value = str(payload.get("value") or payload.get("predicate") or "").strip()
    label = str(payload.get("label") or "").strip()
    desc = str(payload.get("desc") or "").strip()
    if not value:
        raise ValueError("relation type value is required")
    if any(ch.isspace() for ch in value):
        raise ValueError("relation type value cannot contain spaces")
    return {
        "value": value,
        "label": label or value,
        "desc": desc or "自定义二元关系",
    }


def _normalize_causal_variable(payload, existing=None):
    payload = payload or {}
    item = {**(existing or {}), **payload}
    key = str(item.get("key", "")).strip().upper()
    name = str(item.get("name", "")).strip()
    role = str(item.get("role", "")).strip() or "covariate"
    var_type = str(item.get("type", "")).strip() or "变量"
    values = item.get("values", [])
    if isinstance(values, str):
        values = [part.strip() for part in values.replace("，", ",").split(",") if part.strip()]
    if not key:
        raise ValueError("variable key is required")
    if any(ch.isspace() for ch in key):
        raise ValueError("variable key cannot contain spaces")
    if not name:
        raise ValueError("variable name is required")
    item["key"] = key
    item["name"] = name
    item["role"] = role
    item["type"] = var_type
    item["values"] = values
    item["description"] = str(item.get("description", "")).strip()
    return item


def _normalize_causal_edge(payload, variables, existing=None):
    payload = payload or {}
    item = {**(existing or {}), **payload}
    source = str(item.get("source", "")).strip().upper()
    target = str(item.get("target", "")).strip().upper()
    label = str(item.get("label", "")).strip()
    if not source or not target:
        raise ValueError("source and target are required")
    variable_keys = {v["key"] for v in variables}
    if source not in variable_keys:
        raise ValueError(f"source variable '{source}' does not exist")
    if target not in variable_keys:
        raise ValueError(f"target variable '{target}' does not exist")
    if source == target:
        raise ValueError("source and target must be different variables")
    item["source"] = source
    item["target"] = target
    item["label"] = label or f"{source} → {target}"
    item["mechanism"] = str(item.get("mechanism", "")).strip()
    item["strength"] = str(item.get("strength", "因果边")).strip()
    return item


def _topological_sort(variable_keys, edges):
    indegree = {key: 0 for key in variable_keys}
    adjacency = {key: [] for key in variable_keys}
    for edge in edges:
        source = edge["source"]
        target = edge["target"]
        if source not in indegree or target not in indegree:
            continue
        adjacency[source].append(target)
        indegree[target] += 1
    queue = [key for key in variable_keys if indegree[key] == 0]
    ordered = []
    while queue:
        key = queue.pop(0)
        ordered.append(key)
        for target in adjacency[key]:
            indegree[target] -= 1
            if indegree[target] == 0:
                queue.append(target)
    if len(ordered) != len(variable_keys):
        raise ValueError("causal graph must be a DAG; this edge would create a cycle")
    return ordered


def _causal_structures():
    variables = CAUSAL_DAG_STATE["variables"]
    edges = CAUSAL_DAG_STATE["edges"]
    keys = [v["key"] for v in variables]
    adjacency_list = {key: [] for key in keys}
    parent_list = {key: [] for key in keys}
    for edge in edges:
        if edge["source"] in adjacency_list and edge["target"] in adjacency_list:
            adjacency_list[edge["source"]].append(edge["target"])
            parent_list[edge["target"]].append(edge["source"])
    adjacency_matrix = [
        {
            "source": source,
            "targets": {target: 1 if target in adjacency_list[source] else 0 for target in keys},
        }
        for source in keys
    ]
    try:
        topological_order = _topological_sort(keys, edges)
        is_dag = True
    except ValueError:
        topological_order = []
        is_dag = False
    return {
        "adjacencyList": adjacency_list,
        "parentList": parent_list,
        "adjacencyMatrix": adjacency_matrix,
        "topologicalOrder": topological_order,
        "isDag": is_dag,
    }


def _normalize_key_set(value, valid_keys, field_name):
    if value is None:
        items = []
    elif isinstance(value, str):
        items = [part.strip().upper() for part in value.replace("，", ",").split(",") if part.strip()]
    else:
        items = [str(part).strip().upper() for part in value if str(part).strip()]
    unknown = [item for item in items if item not in valid_keys]
    if unknown:
        raise ValueError(f"{field_name} contains unknown variable(s): {', '.join(unknown)}")
    seen = set()
    result = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


def _causal_neighbors(edges):
    directed = {}
    undirected = {}
    parents = {}
    children = {}
    for variable in CAUSAL_DAG_STATE["variables"]:
        key = variable["key"]
        directed[key] = set()
        undirected[key] = set()
        parents[key] = set()
        children[key] = set()
    for edge in edges:
        source = edge["source"]
        target = edge["target"]
        directed.setdefault(source, set()).add(target)
        undirected.setdefault(source, set()).add(target)
        undirected.setdefault(target, set()).add(source)
        parents.setdefault(target, set()).add(source)
        children.setdefault(source, set()).add(target)
    return directed, undirected, parents, children


def _descendants(nodes, children):
    result = set()
    stack = list(nodes)
    while stack:
        node = stack.pop()
        for child in children.get(node, set()):
            if child not in result:
                result.add(child)
                stack.append(child)
    return result


def _ancestors(nodes, parents):
    result = set(nodes)
    stack = list(nodes)
    while stack:
        node = stack.pop()
        for parent in parents.get(node, set()):
            if parent not in result:
                result.add(parent)
                stack.append(parent)
    return result


def _all_simple_paths(start, goal, undirected, max_paths=80):
    paths = []
    stack = [(start, [start])]
    while stack and len(paths) < max_paths:
        node, path = stack.pop()
        if node == goal:
            paths.append(path)
            continue
        for neighbor in sorted(undirected.get(node, set()), reverse=True):
            if neighbor in path:
                continue
            stack.append((neighbor, [*path, neighbor]))
    return paths


def _triple_kind(left, middle, right, directed):
    left_to_middle = middle in directed.get(left, set())
    middle_to_left = left in directed.get(middle, set())
    right_to_middle = middle in directed.get(right, set())
    middle_to_right = right in directed.get(middle, set())
    if left_to_middle and right_to_middle:
        return "collider"
    if middle_to_left and middle_to_right:
        return "fork"
    return "chain"


def _triple_label(kind):
    return {
        "chain": "链结构",
        "fork": "分叉结构",
        "collider": "汇连结构",
    }.get(kind, "路径结构")


def _triple_formula(left, middle, right, directed):
    left_to_middle = middle in directed.get(left, set())
    middle_to_left = left in directed.get(middle, set())
    right_to_middle = middle in directed.get(right, set())
    middle_to_right = right in directed.get(middle, set())
    left_arrow = "→" if left_to_middle else "←" if middle_to_left else "-"
    right_arrow = "←" if right_to_middle else "→" if middle_to_right else "-"
    return f"{left} {left_arrow} {middle} {right_arrow} {right}"


def _analyze_path(path, conditioned, directed, children):
    conditioned_set = set(conditioned)
    conditioned_desc = _descendants(conditioned_set, children)
    active = True
    triples = []
    blockers = []
    if len(path) <= 2:
        blocked = any(node in conditioned_set for node in path)
        return {
            "nodes": path,
            "label": " - ".join(path),
            "active": not blocked,
            "blockedBy": path if blocked else [],
            "triples": [],
            "reason": "端点被给定时路径被阻断" if blocked else "直接相连，未被条件集合阻断",
        }
    for index in range(1, len(path) - 1):
        left, middle, right = path[index - 1], path[index], path[index + 1]
        kind = _triple_kind(left, middle, right, directed)
        if kind == "collider":
            opened = middle in conditioned_set or bool(_descendants({middle}, children) & conditioned_set)
            blocked = not opened
            reason = "汇连点及其后代未被给定，路径阻断" if blocked else "汇连点或其后代被给定，路径激活"
        else:
            blocked = middle in conditioned_set
            opened = not blocked
            reason = "中间节点被给定，路径阻断" if blocked else "中间节点未被给定，路径保持激活"
        if blocked:
            active = False
            blockers.append(middle)
        triples.append(
            {
                "left": left,
                "middle": middle,
                "right": right,
                "kind": kind,
                "kindLabel": _triple_label(kind),
                "formula": _triple_formula(left, middle, right, directed),
                "active": opened,
                "blocked": blocked,
                "reason": reason,
            }
        )
    return {
        "nodes": path,
        "label": " - ".join(path),
        "active": active,
        "blockedBy": blockers,
        "triples": triples,
        "reason": "存在至少一个未阻断路径" if active else "路径中的局部结构被条件集合阻断",
    }


def _moralized_reachable(a_set, b_set, conditioned, variables, edges):
    valid_keys = [v["key"] for v in variables]
    directed, _, parents, children = _causal_neighbors(edges)
    ancestor_nodes = _ancestors(set(a_set) | set(b_set) | set(conditioned), parents)
    moral = {key: set() for key in ancestor_nodes}
    for edge in edges:
        source = edge["source"]
        target = edge["target"]
        if source in ancestor_nodes and target in ancestor_nodes:
            moral[source].add(target)
            moral[target].add(source)
    for child, parent_set in parents.items():
        if child not in ancestor_nodes:
            continue
        selected = [parent for parent in parent_set if parent in ancestor_nodes]
        for i, first in enumerate(selected):
            for second in selected[i + 1 :]:
                moral[first].add(second)
                moral[second].add(first)
    blocked = set(conditioned)
    queue = [node for node in a_set if node in ancestor_nodes and node not in blocked]
    visited = set(queue)
    while queue:
        node = queue.pop(0)
        for neighbor in moral.get(node, set()):
            if neighbor in visited or neighbor in blocked:
                continue
            visited.add(neighbor)
            queue.append(neighbor)
    return any(node in visited for node in b_set), sorted(ancestor_nodes), {key: sorted(value) for key, value in moral.items()}


def _d_separation_result(payload):
    variables = CAUSAL_DAG_STATE["variables"]
    edges = CAUSAL_DAG_STATE["edges"]
    valid_keys = {v["key"] for v in variables}
    a_set = _normalize_key_set((payload or {}).get("a") or (payload or {}).get("A"), valid_keys, "A")
    b_set = _normalize_key_set((payload or {}).get("b") or (payload or {}).get("B"), valid_keys, "B")
    c_set = _normalize_key_set((payload or {}).get("c") or (payload or {}).get("C"), valid_keys, "C")
    if not a_set:
        raise ValueError("A must contain at least one variable")
    if not b_set:
        raise ValueError("B must contain at least one variable")
    if set(a_set) & set(b_set):
        raise ValueError("A and B must not overlap")

    directed, undirected, _, children = _causal_neighbors(edges)
    path_details = []
    for source in a_set:
        for target in b_set:
            for path in _all_simple_paths(source, target, undirected):
                path_details.append(_analyze_path(path, c_set, directed, children))
    has_active_path = any(item["active"] for item in path_details)
    moral_connected, ancestor_nodes, moral_graph = _moralized_reachable(a_set, b_set, c_set, variables, edges)
    independent = not has_active_path
    return {
        "query": {"A": a_set, "B": b_set, "C": c_set},
        "formula": f"{', '.join(a_set)} ⟂ {', '.join(b_set)} | {', '.join(c_set) if c_set else '∅'}",
        "independent": independent,
        "hasActivePath": has_active_path,
        "summary": "所有路径均被条件集合阻断，条件独立成立。" if independent else "存在未被阻断的激活路径，条件独立不成立。",
        "paths": path_details,
        "activePaths": [item for item in path_details if item["active"]],
        "blockedPaths": [item for item in path_details if not item["active"]],
        "moralCheck": {
            "connectedAfterRemovingC": moral_connected,
            "ancestorNodes": ancestor_nodes,
            "moralGraph": moral_graph,
        },
    }


def _ensure_relation_type(predicate):
    if any(rt["value"] == predicate for rt in FAMILY_GRAPH_STATE["relationTypes"]):
        return
    FAMILY_GRAPH_STATE["relationTypes"].append(
        {"value": predicate, "label": predicate, "desc": "自定义二元关系"}
    )


def _kg_samples():
    return derive_samples(
        FAMILY_GRAPH_STATE["members"],
        FAMILY_GRAPH_STATE["relations"],
        FAMILY_GRAPH_STATE["targetPredicate"],
    )


def _kg_payload():
    return {
        "members": FAMILY_GRAPH_STATE["members"],
        "relations": FAMILY_GRAPH_STATE["relations"],
        "relationTypes": FAMILY_GRAPH_STATE["relationTypes"],
        "targetPredicate": FAMILY_GRAPH_STATE["targetPredicate"],
        "samples": _kg_samples(),
    }


def _causal_payload():
    return {
        "topic": CAUSAL_DAG_STATE["topic"],
        "variables": CAUSAL_DAG_STATE["variables"],
        "edges": CAUSAL_DAG_STATE["edges"],
        "structures": _causal_structures(),
    }


def _safe_rate(numerator, denominator):
    return numerator / denominator if denominator else 0


def _cell_with_metrics(cell):
    total = int(cell.get("total", 0))
    recovered = int(cell.get("recovered", 0))
    failed = max(total - recovered, 0)
    return {
        **cell,
        "recovered": recovered,
        "total": total,
        "failed": failed,
        "rate": _safe_rate(recovered, total),
    }


def _causal_effect_analysis(study):
    cells = [_cell_with_metrics(cell) for cell in study["cells"]]
    total_n = sum(cell["total"] for cell in cells)
    z_order = []
    for cell in cells:
        if cell["z"] not in z_order:
            z_order.append(cell["z"])

    treatment = {}
    for x_value in (0, 1):
        x_cells = [cell for cell in cells if cell["x"] == x_value]
        recovered = sum(cell["recovered"] for cell in x_cells)
        total = sum(cell["total"] for cell in x_cells)
        treatment[str(x_value)] = {
            "x": x_value,
            "label": study["treatment"]["treated"] if x_value == 1 else study["treatment"]["untreated"],
            "recovered": recovered,
            "total": total,
            "rate": _safe_rate(recovered, total),
        }

    z_distribution = []
    subgroup_effects = []
    components = []
    for z_value in z_order:
        z_cells = [cell for cell in cells if cell["z"] == z_value]
        z_total = sum(cell["total"] for cell in z_cells)
        z_label = z_cells[0].get("zLabel", z_value)
        p_z = _safe_rate(z_total, total_n)
        treated_cell = next((cell for cell in z_cells if cell["x"] == 1), None)
        untreated_cell = next((cell for cell in z_cells if cell["x"] == 0), None)
        treated_rate = treated_cell["rate"] if treated_cell else 0
        untreated_rate = untreated_cell["rate"] if untreated_cell else 0
        z_distribution.append({"z": z_value, "zLabel": z_label, "total": z_total, "probability": p_z})
        subgroup_effects.append(
            {
                "z": z_value,
                "zLabel": z_label,
                "treatedRate": treated_rate,
                "untreatedRate": untreated_rate,
                "effect": treated_rate - untreated_rate,
                "treatedCell": treated_cell,
                "untreatedCell": untreated_cell,
            }
        )
        components.append(
            {
                "z": z_value,
                "zLabel": z_label,
                "weight": p_z,
                "treatedRate": treated_rate,
                "untreatedRate": untreated_rate,
                "treatedContribution": treated_rate * p_z,
                "untreatedContribution": untreated_rate * p_z,
            }
        )

    observational_effect = treatment["1"]["rate"] - treatment["0"]["rate"]
    do_treated = sum(component["treatedContribution"] for component in components)
    do_untreated = sum(component["untreatedContribution"] for component in components)
    ace = do_treated - do_untreated
    observational_harm = observational_effect < 0
    causal_effective = ace > 0

    return {
        "cells": cells,
        "total": total_n,
        "zDistribution": z_distribution,
        "observational": {
            "treated": treatment["1"],
            "untreated": treatment["0"],
            "effect": observational_effect,
            "label": "药效有害假象" if observational_harm else "原始相关显示有益",
        },
        "subgroupEffects": subgroup_effects,
        "backdoor": {
            "formulaTreated": "P(Y=1 | do(X=1)) = Σ_z P(Y=1 | X=1, Z=z)P(Z=z)",
            "formulaUntreated": "P(Y=1 | do(X=0)) = Σ_z P(Y=1 | X=0, Z=z)P(Z=z)",
            "components": components,
            "treated": do_treated,
            "untreated": do_untreated,
            "ace": ace,
        },
        "conclusion": {
            "observationalHarm": observational_harm,
            "causalEffective": causal_effective,
            "reversal": observational_harm and causal_effective,
            "text": (
                "原始条件概率呈现“药效有害”假象；经 do 算子后门调整后 ACE 为正，"
                "说明消除性别/风险混淆后药物真正有效。"
                if observational_harm and causal_effective
                else "经 do 算子后门调整后，结论以 ACE 的符号为准。"
            ),
        },
    }


def _causal_effects_payload():
    studies = []
    for study in CAUSAL_EFFECT_STUDIES:
        item = deepcopy(study)
        item["analysis"] = _causal_effect_analysis(study)
        studies.append(item)
    return {
        "topic": {
            "title": "基于 do 算子的效应计算",
            "subtitle": "用后门调整消除混淆偏差，计算平均因果效应 ACE",
            "dag": "Z -> X, Z -> Y, X -> Y",
        },
        "studies": studies,
    }


def _find_item(collection, item_id):
    for index, item in enumerate(collection):
        if item["id"] == item_id:
            return index, item
    return None, None


def create_app():
    app = Flask(__name__)
    app.json.ensure_ascii = False
    CORS(app)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "AI Principle Course Backend"})

    @app.post("/api/auth/login")
    def auth_login():
        payload = request.get_json(silent=True) or {}
        role = str(payload.get("role", "")).strip()
        username = str(payload.get("username", "")).strip()
        password = str(payload.get("password", "")).strip()
        if not role or not username or not password:
            return _json_response(None, code=400, message="请填写账号、密码和登录端口", status=400)

        user = _validate_login(role, username, password)
        if not user:
            return _json_response(None, code=401, message="账号或密码错误", status=401)

        return _json_response(user)

    @app.get("/api/auth/profile")
    def auth_profile():
        return _json_response(
            {
                "teacher": {"username": TEACHER_ACCOUNT["username"], "name": TEACHER_ACCOUNT["name"]},
                "studentCount": len(STUDENT_ACCOUNTS),
            }
        )

    @app.get("/api/knowledge/overview")
    def knowledge_overview():
        return jsonify({"code": 200, "message": "success", "data": COURSE_OVERVIEW})

    @app.get("/api/knowledge/lesson/<lesson_id>")
    def knowledge_lesson(lesson_id):
        lesson = COURSE_OVERVIEW["lessonGraphs"].get(lesson_id)
        if not lesson:
            return jsonify({"code": 404, "message": "lesson not found", "data": None}), 404
        return jsonify({"code": 200, "message": "success", "data": lesson})

    @app.get("/api/knowledge/keypoints")
    def knowledge_keypoints():
        return jsonify({"code": 200, "message": "success", "data": KEYPOINT_ANALYSIS})

    @app.get("/api/reasoning/knowledge-base")
    def reasoning_knowledge_base():
        return jsonify({"code": 200, "message": "success", "data": KNOWLEDGE_BASE_STATE})

    def _resolve_goal():
        goal = (request.args.get("goal") or "").strip()
        return goal or KNOWLEDGE_BASE_STATE["caseProfile"]["goal"]

    @app.get("/api/reasoning/natural-deduction")
    def reasoning_natural_deduction():
        example = (request.args.get("example") or "").strip()
        if example == "traffic":
            result = traffic_natural_deduction()
        else:
            goal = _resolve_goal()
            result = natural_deduction(
                KNOWLEDGE_BASE_STATE["facts"], KNOWLEDGE_BASE_STATE["rules"], goal
            )
            result["caseProfile"] = KNOWLEDGE_BASE_STATE["caseProfile"]
        return _json_response(result)

    @app.get("/api/reasoning/resolution")
    def reasoning_resolution():
        goal = _resolve_goal()
        result = resolution_deduction(
            KNOWLEDGE_BASE_STATE["facts"], KNOWLEDGE_BASE_STATE["rules"], goal
        )
        result["caseProfile"] = KNOWLEDGE_BASE_STATE["caseProfile"]
        return _json_response(result)

    @app.get("/api/reasoning/comparison")
    def reasoning_comparison():
        goal = _resolve_goal()
        result = compare_methods(
            KNOWLEDGE_BASE_STATE["facts"], KNOWLEDGE_BASE_STATE["rules"], goal
        )
        result["caseProfile"] = KNOWLEDGE_BASE_STATE["caseProfile"]
        return _json_response(result)

    @app.post("/api/reasoning/knowledge-base/facts")
    def reasoning_create_fact():
        try:
            item = _normalize_fact(request.get_json(silent=True))
        except ValueError as exc:
            return _json_response(None, code=400, message=str(exc), status=400)
        item["id"] = f"fact-{uuid4().hex[:8]}"
        KNOWLEDGE_BASE_STATE["facts"].append(item)
        return _json_response(item, status=201)

    @app.put("/api/reasoning/knowledge-base/facts/<fact_id>")
    def reasoning_update_fact(fact_id):
        index, existing = _find_item(KNOWLEDGE_BASE_STATE["facts"], fact_id)
        if existing is None:
            return _json_response(None, code=404, message="fact not found", status=404)
        try:
            item = _normalize_fact(request.get_json(silent=True), existing)
        except ValueError as exc:
            return _json_response(None, code=400, message=str(exc), status=400)
        item["id"] = fact_id
        KNOWLEDGE_BASE_STATE["facts"][index] = item
        return _json_response(item)

    @app.delete("/api/reasoning/knowledge-base/facts/<fact_id>")
    def reasoning_delete_fact(fact_id):
        index, existing = _find_item(KNOWLEDGE_BASE_STATE["facts"], fact_id)
        if existing is None:
            return _json_response(None, code=404, message="fact not found", status=404)
        KNOWLEDGE_BASE_STATE["facts"].pop(index)
        return _json_response({"id": fact_id})

    @app.post("/api/reasoning/knowledge-base/rules")
    def reasoning_create_rule():
        try:
            item = _normalize_rule(request.get_json(silent=True))
        except ValueError as exc:
            return _json_response(None, code=400, message=str(exc), status=400)
        item["id"] = f"rule-{uuid4().hex[:8]}"
        KNOWLEDGE_BASE_STATE["rules"].append(item)
        return _json_response(item, status=201)

    @app.put("/api/reasoning/knowledge-base/rules/<rule_id>")
    def reasoning_update_rule(rule_id):
        index, existing = _find_item(KNOWLEDGE_BASE_STATE["rules"], rule_id)
        if existing is None:
            return _json_response(None, code=404, message="rule not found", status=404)
        try:
            item = _normalize_rule(request.get_json(silent=True), existing)
        except ValueError as exc:
            return _json_response(None, code=400, message=str(exc), status=400)
        item["id"] = rule_id
        KNOWLEDGE_BASE_STATE["rules"][index] = item
        return _json_response(item)

    @app.delete("/api/reasoning/knowledge-base/rules/<rule_id>")
    def reasoning_delete_rule(rule_id):
        index, existing = _find_item(KNOWLEDGE_BASE_STATE["rules"], rule_id)
        if existing is None:
            return _json_response(None, code=404, message="rule not found", status=404)
        KNOWLEDGE_BASE_STATE["rules"].pop(index)
        return _json_response({"id": rule_id})

    # ------------------------------------------------------------------
    # 基于知识图谱推理：家庭关系知识图谱构建（增删改查）与 FOIL 推理
    # ------------------------------------------------------------------
    @app.get("/api/kg/family-graph")
    def kg_family_graph():
        return _json_response(_kg_payload())

    @app.post("/api/kg/family-graph/reset")
    def kg_reset():
        fresh = deepcopy(FAMILY_GRAPH)
        FAMILY_GRAPH_STATE["members"] = fresh["members"]
        FAMILY_GRAPH_STATE["relations"] = fresh["relations"]
        FAMILY_GRAPH_STATE["targetPredicate"] = fresh["targetPredicate"]
        FAMILY_GRAPH_STATE["relationTypes"] = fresh["relationTypes"]
        return _json_response(_kg_payload())

    @app.post("/api/kg/family-graph/clear")
    def kg_clear():
        FAMILY_GRAPH_STATE["members"] = []
        FAMILY_GRAPH_STATE["relations"] = []
        return _json_response(_kg_payload())

    @app.put("/api/kg/family-graph/target")
    def kg_set_target():
        payload = request.get_json(silent=True) or {}
        target = str(payload.get("targetPredicate", "")).strip()
        if not target:
            return _json_response(None, code=400, message="targetPredicate is required", status=400)
        _ensure_relation_type(target)
        FAMILY_GRAPH_STATE["targetPredicate"] = target
        return _json_response(_kg_payload())

    @app.post("/api/kg/family-graph/relation-types")
    def kg_create_relation_type():
        try:
            item = _normalize_relation_type(request.get_json(silent=True))
        except ValueError as exc:
            return _json_response(None, code=400, message=str(exc), status=400)
        if any(rt["value"] == item["value"] for rt in FAMILY_GRAPH_STATE["relationTypes"]):
            return _json_response(None, code=400, message="relation type already exists", status=400)
        FAMILY_GRAPH_STATE["relationTypes"].append(item)
        return _json_response(_kg_payload(), status=201)

    @app.post("/api/kg/family-graph/members")
    def kg_create_member():
        try:
            item = _normalize_member(request.get_json(silent=True))
        except ValueError as exc:
            return _json_response(None, code=400, message=str(exc), status=400)
        if any(m["name"] == item["name"] for m in FAMILY_GRAPH_STATE["members"]):
            return _json_response(None, code=400, message="member name already exists", status=400)
        item["id"] = f"m-{uuid4().hex[:8]}"
        FAMILY_GRAPH_STATE["members"].append(item)
        return _json_response(_kg_payload(), status=201)

    @app.put("/api/kg/family-graph/members/<member_id>")
    def kg_update_member(member_id):
        index, existing = _find_item(FAMILY_GRAPH_STATE["members"], member_id)
        if existing is None:
            return _json_response(None, code=404, message="member not found", status=404)
        try:
            item = _normalize_member(request.get_json(silent=True), existing)
        except ValueError as exc:
            return _json_response(None, code=400, message=str(exc), status=400)
        if any(m["name"] == item["name"] and m["id"] != member_id for m in FAMILY_GRAPH_STATE["members"]):
            return _json_response(None, code=400, message="member name already exists", status=400)
        old_name = existing["name"]
        item["id"] = member_id
        FAMILY_GRAPH_STATE["members"][index] = item
        # 成员改名时级联更新相关关系的 head / tail
        if old_name != item["name"]:
            for rel in FAMILY_GRAPH_STATE["relations"]:
                if rel["head"] == old_name:
                    rel["head"] = item["name"]
                if rel["tail"] == old_name:
                    rel["tail"] = item["name"]
        return _json_response(_kg_payload())

    @app.delete("/api/kg/family-graph/members/<member_id>")
    def kg_delete_member(member_id):
        index, existing = _find_item(FAMILY_GRAPH_STATE["members"], member_id)
        if existing is None:
            return _json_response(None, code=404, message="member not found", status=404)
        name = existing["name"]
        FAMILY_GRAPH_STATE["members"].pop(index)
        # 级联删除引用该成员的关系
        FAMILY_GRAPH_STATE["relations"] = [
            r for r in FAMILY_GRAPH_STATE["relations"] if r["head"] != name and r["tail"] != name
        ]
        return _json_response(_kg_payload())

    @app.post("/api/kg/family-graph/relations")
    def kg_create_relation():
        try:
            item = _normalize_relation(request.get_json(silent=True), FAMILY_GRAPH_STATE["members"])
        except ValueError as exc:
            return _json_response(None, code=400, message=str(exc), status=400)
        if any(
            r["predicate"] == item["predicate"] and r["head"] == item["head"] and r["tail"] == item["tail"]
            for r in FAMILY_GRAPH_STATE["relations"]
        ):
            return _json_response(None, code=400, message="relation already exists", status=400)
        _ensure_relation_type(item["predicate"])
        item["id"] = f"r-{uuid4().hex[:8]}"
        FAMILY_GRAPH_STATE["relations"].append(item)
        return _json_response(_kg_payload(), status=201)

    @app.put("/api/kg/family-graph/relations/<relation_id>")
    def kg_update_relation(relation_id):
        index, existing = _find_item(FAMILY_GRAPH_STATE["relations"], relation_id)
        if existing is None:
            return _json_response(None, code=404, message="relation not found", status=404)
        try:
            item = _normalize_relation(request.get_json(silent=True), FAMILY_GRAPH_STATE["members"], existing)
        except ValueError as exc:
            return _json_response(None, code=400, message=str(exc), status=400)
        _ensure_relation_type(item["predicate"])
        item["id"] = relation_id
        FAMILY_GRAPH_STATE["relations"][index] = item
        return _json_response(_kg_payload())

    @app.delete("/api/kg/family-graph/relations/<relation_id>")
    def kg_delete_relation(relation_id):
        index, existing = _find_item(FAMILY_GRAPH_STATE["relations"], relation_id)
        if existing is None:
            return _json_response(None, code=404, message="relation not found", status=404)
        FAMILY_GRAPH_STATE["relations"].pop(index)
        return _json_response(_kg_payload())

    # ------------------------------------------------------------------
    # 因果推理：DAG 构建与拓扑表示（增删改查）
    # ------------------------------------------------------------------
    @app.get("/api/causal/dag")
    def causal_dag():
        return _json_response(_causal_payload())

    @app.post("/api/causal/dag/reset")
    def causal_reset():
        fresh = deepcopy(CAUSAL_DAG)
        CAUSAL_DAG_STATE["topic"] = fresh["topic"]
        CAUSAL_DAG_STATE["variables"] = fresh["variables"]
        CAUSAL_DAG_STATE["edges"] = fresh["edges"]
        return _json_response(_causal_payload())

    @app.post("/api/causal/dag/clear")
    def causal_clear():
        CAUSAL_DAG_STATE["variables"] = []
        CAUSAL_DAG_STATE["edges"] = []
        return _json_response(_causal_payload())

    @app.post("/api/causal/dag/variables")
    def causal_create_variable():
        try:
            item = _normalize_causal_variable(request.get_json(silent=True))
        except ValueError as exc:
            return _json_response(None, code=400, message=str(exc), status=400)
        if any(v["key"] == item["key"] for v in CAUSAL_DAG_STATE["variables"]):
            return _json_response(None, code=400, message="variable key already exists", status=400)
        item["id"] = f"cv-{uuid4().hex[:8]}"
        CAUSAL_DAG_STATE["variables"].append(item)
        return _json_response(_causal_payload(), status=201)

    @app.put("/api/causal/dag/variables/<variable_id>")
    def causal_update_variable(variable_id):
        index, existing = _find_item(CAUSAL_DAG_STATE["variables"], variable_id)
        if existing is None:
            return _json_response(None, code=404, message="variable not found", status=404)
        try:
            item = _normalize_causal_variable(request.get_json(silent=True), existing)
        except ValueError as exc:
            return _json_response(None, code=400, message=str(exc), status=400)
        if any(v["key"] == item["key"] and v["id"] != variable_id for v in CAUSAL_DAG_STATE["variables"]):
            return _json_response(None, code=400, message="variable key already exists", status=400)
        old_key = existing["key"]
        item["id"] = variable_id
        CAUSAL_DAG_STATE["variables"][index] = item
        if old_key != item["key"]:
            for edge in CAUSAL_DAG_STATE["edges"]:
                if edge["source"] == old_key:
                    edge["source"] = item["key"]
                if edge["target"] == old_key:
                    edge["target"] = item["key"]
        return _json_response(_causal_payload())

    @app.delete("/api/causal/dag/variables/<variable_id>")
    def causal_delete_variable(variable_id):
        index, existing = _find_item(CAUSAL_DAG_STATE["variables"], variable_id)
        if existing is None:
            return _json_response(None, code=404, message="variable not found", status=404)
        key = existing["key"]
        CAUSAL_DAG_STATE["variables"].pop(index)
        CAUSAL_DAG_STATE["edges"] = [
            edge for edge in CAUSAL_DAG_STATE["edges"] if edge["source"] != key and edge["target"] != key
        ]
        return _json_response(_causal_payload())

    @app.post("/api/causal/dag/edges")
    def causal_create_edge():
        try:
            item = _normalize_causal_edge(request.get_json(silent=True), CAUSAL_DAG_STATE["variables"])
        except ValueError as exc:
            return _json_response(None, code=400, message=str(exc), status=400)
        if any(edge["source"] == item["source"] and edge["target"] == item["target"] for edge in CAUSAL_DAG_STATE["edges"]):
            return _json_response(None, code=400, message="edge already exists", status=400)
        trial_edges = [*CAUSAL_DAG_STATE["edges"], item]
        try:
            _topological_sort([v["key"] for v in CAUSAL_DAG_STATE["variables"]], trial_edges)
        except ValueError as exc:
            return _json_response(None, code=400, message=str(exc), status=400)
        item["id"] = f"ce-{uuid4().hex[:8]}"
        CAUSAL_DAG_STATE["edges"].append(item)
        return _json_response(_causal_payload(), status=201)

    @app.put("/api/causal/dag/edges/<edge_id>")
    def causal_update_edge(edge_id):
        index, existing = _find_item(CAUSAL_DAG_STATE["edges"], edge_id)
        if existing is None:
            return _json_response(None, code=404, message="edge not found", status=404)
        try:
            item = _normalize_causal_edge(request.get_json(silent=True), CAUSAL_DAG_STATE["variables"], existing)
        except ValueError as exc:
            return _json_response(None, code=400, message=str(exc), status=400)
        if any(
            edge["source"] == item["source"]
            and edge["target"] == item["target"]
            and edge["id"] != edge_id
            for edge in CAUSAL_DAG_STATE["edges"]
        ):
            return _json_response(None, code=400, message="edge already exists", status=400)
        trial_edges = list(CAUSAL_DAG_STATE["edges"])
        item["id"] = edge_id
        trial_edges[index] = item
        try:
            _topological_sort([v["key"] for v in CAUSAL_DAG_STATE["variables"]], trial_edges)
        except ValueError as exc:
            return _json_response(None, code=400, message=str(exc), status=400)
        CAUSAL_DAG_STATE["edges"][index] = item
        return _json_response(_causal_payload())

    @app.delete("/api/causal/dag/edges/<edge_id>")
    def causal_delete_edge(edge_id):
        index, existing = _find_item(CAUSAL_DAG_STATE["edges"], edge_id)
        if existing is None:
            return _json_response(None, code=404, message="edge not found", status=404)
        CAUSAL_DAG_STATE["edges"].pop(index)
        return _json_response(_causal_payload())

    @app.post("/api/causal/dag/d-separation")
    def causal_d_separation():
        try:
            result = _d_separation_result(request.get_json(silent=True) or {})
        except ValueError as exc:
            return _json_response(None, code=400, message=str(exc), status=400)
        return _json_response(result)

    @app.get("/api/causal/effects")
    def causal_effects():
        return _json_response(_causal_effects_payload())

    @app.get("/api/kg/foil")
    def kg_foil():
        target = (request.args.get("target") or "").strip() or FAMILY_GRAPH_STATE["targetPredicate"]
        result = run_foil(
            FAMILY_GRAPH_STATE["members"],
            FAMILY_GRAPH_STATE["relations"],
            target,
        )
        result["targetPredicate"] = target
        result["relationTypes"] = FAMILY_GRAPH_STATE["relationTypes"]
        return _json_response(result)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
