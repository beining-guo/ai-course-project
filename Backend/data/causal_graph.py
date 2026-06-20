# -*- coding: utf-8 -*-
"""因果推理模块的默认 DAG 数据。

默认选题来自课件中的“性别藏起的药效真相”：性别 Z 是混淆变量，
是否服药 X 是干预变量，是否康复 Y 是结果变量。
"""

CAUSAL_DAG = {
    "topic": {
        "title": "性别藏起的药效真相",
        "subtitle": "用因果图区分相关性、混淆路径与真实药效",
        "description": (
            "性别 Z 同时影响是否服药 X 与是否康复 Y，因此只看 P(Y|X) 容易把混淆因素误当成药效。"
            "DAG 用有向无环图表达这些变量之间的因果关系。"
        ),
    },
    "variables": [
        {
            "id": "v-z",
            "key": "Z",
            "name": "性别",
            "role": "confounder",
            "type": "二值变量",
            "values": ["男", "女"],
            "description": "混淆变量：既影响是否服药，也影响康复概率。",
        },
        {
            "id": "v-x",
            "key": "X",
            "name": "是否服药",
            "role": "treatment",
            "type": "二值变量",
            "values": ["服药", "未服药"],
            "description": "干预变量：研究 do(X=服药) 对康复结果的影响。",
        },
        {
            "id": "v-y",
            "key": "Y",
            "name": "是否康复",
            "role": "outcome",
            "type": "二值变量",
            "values": ["康复", "未康复"],
            "description": "结果变量：用于观察治疗后的康复情况。",
        },
    ],
    "edges": [
        {
            "id": "e-z-x",
            "source": "Z",
            "target": "X",
            "label": "影响服药选择",
            "mechanism": "性别可能影响就医行为、用药倾向或医生处方策略。",
            "strength": "混淆路径",
        },
        {
            "id": "e-z-y",
            "source": "Z",
            "target": "Y",
            "label": "影响康复概率",
            "mechanism": "性别可能通过生理差异或基础健康状况影响康复。",
            "strength": "混淆路径",
        },
        {
            "id": "e-x-y",
            "source": "X",
            "target": "Y",
            "label": "药物疗效",
            "mechanism": "服药对康复产生直接因果影响，是本选题关注的真实药效。",
            "strength": "目标因果效应",
        },
    ],
}


CAUSAL_EFFECT_STUDIES = [
    {
        "key": "courseware-simpson",
        "page": "03",
        "title": "课件数据：性别混淆下的药效真相",
        "subtitle": "第一组数据来自课件中的辛普森悖论药物测试样本",
        "source": "课件完整样本数据",
        "confounder": {"key": "Z", "name": "性别"},
        "treatment": {"key": "X", "name": "是否服药", "treated": "用药", "untreated": "不用药"},
        "outcome": {"key": "Y", "name": "是否康复", "positive": "康复"},
        "story": (
            "总体条件概率显示用药组康复率更低，形成“药效有害”的表面假象；"
            "按性别分层后，男性和女性组内的用药康复率都高于不用药。"
        ),
        "doNote": "后门调整把总体人群的性别比例 P(Z=z) 作为统一权重，相当于切断 Z -> X 后重新比较 do(X=1) 与 do(X=0)。",
        "generation": None,
        "cells": [
            {"z": "male", "zLabel": "男性", "x": 0, "xLabel": "不用药", "recovered": 234, "total": 270},
            {"z": "female", "zLabel": "女性", "x": 0, "xLabel": "不用药", "recovered": 55, "total": 80},
            {"z": "male", "zLabel": "男性", "x": 1, "xLabel": "用药", "recovered": 81, "total": 87},
            {"z": "female", "zLabel": "女性", "x": 1, "xLabel": "用药", "recovered": 192, "total": 263},
        ],
    },
    {
        "key": "sem-simulated",
        "page": "04",
        "title": "模拟数据：生成式结构方程复现实验",
        "subtitle": "第二组数据由线性结构方程添加高斯噪声生成",
        "source": "固定随机种子 seed=2026 的模拟因果数据",
        "confounder": {"key": "Z", "name": "基础风险"},
        "treatment": {"key": "X", "name": "是否服药", "treated": "用药", "untreated": "不用药"},
        "outcome": {"key": "Y", "name": "是否康复", "positive": "康复"},
        "story": (
            "模拟数据让高风险人群更倾向于服药，同时高风险会降低康复概率；"
            "因此原始 P(Y|X) 仍会误导，而 do 调整能恢复正向治疗效应。"
        ),
        "doNote": "第二组数据检验系统不只会记住课件样例，而是能对任意满足后门条件的数据执行同一套 ACE 计算。",
        "generation": {
            "sampleSize": 1200,
            "seed": 2026,
            "steps": [
                "Z* ~ N(0, 1),  Z = 1[Z* > -0.05]",
                "X* = -0.90 + 1.85Z + eps_x,  eps_x ~ N(0, 0.85^2),  X = 1[X* > 0]",
                "Y* = 0.78 + 0.48X - 0.95Z + eps_y,  eps_y ~ N(0, 0.75^2),  Y = 1[Y* > 0]",
            ],
            "interpretation": "X 对 Y 的结构系数为正，Z 同时影响 X 与 Y，是需要调整的后门混淆变量。",
        },
        "cells": [
            {"z": "low", "zLabel": "低风险组", "x": 0, "xLabel": "不用药", "recovered": 401, "total": 480},
            {"z": "high", "zLabel": "高风险组", "x": 0, "xLabel": "不用药", "recovered": 28, "total": 75},
            {"z": "low", "zLabel": "低风险组", "x": 1, "xLabel": "用药", "recovered": 80, "total": 84},
            {"z": "high", "zLabel": "高风险组", "x": 1, "xLabel": "用药", "recovered": 382, "total": 561},
        ],
    },
]
