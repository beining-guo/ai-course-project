import axios from "axios";

const request = axios.create({
  baseURL: "/api",
  timeout: 10000,
});

export async function getCausalDag() {
  const response = await request.get("/causal/dag");
  return response.data.data;
}

export async function resetCausalDag() {
  const response = await request.post("/causal/dag/reset");
  return response.data.data;
}

export async function clearCausalDag() {
  const response = await request.post("/causal/dag/clear");
  return response.data.data;
}

export async function createCausalVariable(payload) {
  const response = await request.post("/causal/dag/variables", payload);
  return response.data.data;
}

export async function updateCausalVariable(id, payload) {
  const response = await request.put(`/causal/dag/variables/${id}`, payload);
  return response.data.data;
}

export async function deleteCausalVariable(id) {
  const response = await request.delete(`/causal/dag/variables/${id}`);
  return response.data.data;
}

export async function createCausalEdge(payload) {
  const response = await request.post("/causal/dag/edges", payload);
  return response.data.data;
}

export async function updateCausalEdge(id, payload) {
  const response = await request.put(`/causal/dag/edges/${id}`, payload);
  return response.data.data;
}

export async function deleteCausalEdge(id) {
  const response = await request.delete(`/causal/dag/edges/${id}`);
  return response.data.data;
}

export async function judgeDSeparation(payload) {
  const response = await request.post("/causal/dag/d-separation", payload);
  return response.data.data;
}

export async function getCausalEffects() {
  const response = await request.get("/causal/effects");
  return response.data.data;
}
