import axios from "axios";

const request = axios.create({
  baseURL: "/api",
  timeout: 10000,
});

export async function getReasoningKnowledgeBase() {
  const response = await request.get("/reasoning/knowledge-base");
  return response.data.data;
}

export async function getNaturalDeduction(goal, options = {}) {
  const response = await request.get("/reasoning/natural-deduction", {
    params: { ...(goal ? { goal } : {}), ...(options.example ? { example: options.example } : {}) },
  });
  return response.data.data;
}

export async function getResolution(goal) {
  const response = await request.get("/reasoning/resolution", { params: goal ? { goal } : {} });
  return response.data.data;
}

export async function getMethodComparison(goal) {
  const response = await request.get("/reasoning/comparison", { params: goal ? { goal } : {} });
  return response.data.data;
}

export async function createReasoningFact(payload) {
  const response = await request.post("/reasoning/knowledge-base/facts", payload);
  return response.data.data;
}

export async function updateReasoningFact(id, payload) {
  const response = await request.put(`/reasoning/knowledge-base/facts/${id}`, payload);
  return response.data.data;
}

export async function deleteReasoningFact(id) {
  const response = await request.delete(`/reasoning/knowledge-base/facts/${id}`);
  return response.data.data;
}

export async function createReasoningRule(payload) {
  const response = await request.post("/reasoning/knowledge-base/rules", payload);
  return response.data.data;
}

export async function updateReasoningRule(id, payload) {
  const response = await request.put(`/reasoning/knowledge-base/rules/${id}`, payload);
  return response.data.data;
}

export async function deleteReasoningRule(id) {
  const response = await request.delete(`/reasoning/knowledge-base/rules/${id}`);
  return response.data.data;
}
