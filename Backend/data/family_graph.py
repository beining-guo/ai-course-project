# -*- coding: utf-8 -*-
"""家庭关系知识图谱的初始数据。

知识库中的每条事实统一表示为二元谓词形式，如 Father(David, Mike)，
等价于三元组 <David, Father, Mike>。前端通过增删改查在此基础上构建图谱。
"""

RELATION_TYPES = [
    {"value": "Couple", "label": "Couple 夫妻", "desc": "head 与 tail 是夫妻"},
    {"value": "Mother", "label": "Mother 母亲", "desc": "head 是 tail 的母亲"},
    {"value": "Father", "label": "Father 父亲", "desc": "head 是 tail 的父亲"},
    {"value": "Sibling", "label": "Sibling 兄弟姐妹", "desc": "head 与 tail 是兄弟姐妹"},
]

FAMILY_GRAPH = {
    # 当前选定的目标谓词（FOIL 要学习的关系）
    "targetPredicate": "Father",
    "relationTypes": RELATION_TYPES,
    # 成员（实体 / 节点）
    "members": [
        {"id": "m-mary", "name": "Mary", "gender": "female"},
        {"id": "m-george", "name": "George", "gender": "male"},
        {"id": "m-david", "name": "David", "gender": "male"},
        {"id": "m-james", "name": "James", "gender": "female"},
        {"id": "m-ann", "name": "Ann", "gender": "female"},
        {"id": "m-mike", "name": "Mike", "gender": "male"},
    ],
    # 关系（边 / 二元谓词 / 三元组），均为已知事实
    "relations": [
        {"id": "r-1", "predicate": "Couple", "head": "Mary", "tail": "George"},
        {"id": "r-2", "predicate": "Mother", "head": "Mary", "tail": "David"},
        {"id": "r-3", "predicate": "Couple", "head": "James", "tail": "David"},
        {"id": "r-4", "predicate": "Mother", "head": "James", "tail": "Ann"},
        {"id": "r-5", "predicate": "Mother", "head": "James", "tail": "Mike"},
        {"id": "r-6", "predicate": "Father", "head": "David", "tail": "Mike"},
        {"id": "r-7", "predicate": "Sibling", "head": "Ann", "tail": "Mike"},
    ],
}
