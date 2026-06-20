import axios from "axios";

const request = axios.create({
  baseURL: "/api",
  timeout: 10000,
});

export async function getFamilyGraph() {
  const response = await request.get("/kg/family-graph");
  return response.data.data;
}

export async function resetFamilyGraph() {
  const response = await request.post("/kg/family-graph/reset");
  return response.data.data;
}

export async function clearFamilyGraph() {
  const response = await request.post("/kg/family-graph/clear");
  return response.data.data;
}

export async function setTargetPredicate(targetPredicate) {
  const response = await request.put("/kg/family-graph/target", { targetPredicate });
  return response.data.data;
}

export async function createRelationType(payload) {
  const response = await request.post("/kg/family-graph/relation-types", payload);
  return response.data.data;
}

export async function createMember(payload) {
  const response = await request.post("/kg/family-graph/members", payload);
  return response.data.data;
}

export async function updateMember(id, payload) {
  const response = await request.put(`/kg/family-graph/members/${id}`, payload);
  return response.data.data;
}

export async function deleteMember(id) {
  const response = await request.delete(`/kg/family-graph/members/${id}`);
  return response.data.data;
}

export async function createRelation(payload) {
  const response = await request.post("/kg/family-graph/relations", payload);
  return response.data.data;
}

export async function updateRelation(id, payload) {
  const response = await request.put(`/kg/family-graph/relations/${id}`, payload);
  return response.data.data;
}

export async function deleteRelation(id) {
  const response = await request.delete(`/kg/family-graph/relations/${id}`);
  return response.data.data;
}

export async function getFoilResult(target) {
  const response = await request.get("/kg/foil", { params: target ? { target } : {} });
  return response.data.data;
}
