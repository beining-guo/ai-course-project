import axios from "axios";

const request = axios.create({
  baseURL: "/api",
  timeout: 10000,
});

export async function login(payload) {
  const response = await request.post("/auth/login", payload);
  return response.data.data;
}

export async function getAuthProfile() {
  const response = await request.get("/auth/profile");
  return response.data.data;
}
