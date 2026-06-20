import axios from "axios";

const request = axios.create({
  baseURL: "/api",
  timeout: 10000,
});

export async function getKnowledgeOverview() {
  const response = await request.get("/knowledge/overview");
  return response.data.data;
}

export async function getKnowledgeLesson(lessonId) {
  const response = await request.get(`/knowledge/lesson/${lessonId}`);
  return response.data.data;
}

export async function getKnowledgeKeypoints() {
  const response = await request.get("/knowledge/keypoints");
  return response.data.data;
}
