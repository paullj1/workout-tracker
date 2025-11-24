import axios from "axios";
const API_BASE = import.meta.env.VITE_API_URL ?? "";
export const api = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});
export const fetchSession = async () => {
    const { data } = await api.get("/auth/session");
    return data;
};
export const registerUser = async (payload) => {
    const { data } = await api.post("/users", payload);
    return data;
};
export const appleLogin = async (payload) => {
    const { data } = await api.post("/auth/apple/complete", payload);
    return data;
};
export const listWorkouts = async () => {
    const { data } = await api.get("/workouts");
    return data;
};
export const createWorkout = async (payload) => {
    const { data } = await api.post("/workouts", payload);
    return data;
};
export const updateWorkout = async (payload) => {
    const { data } = await api.put(`/workouts/${payload.id}`, payload);
    return data;
};
export const deleteWorkout = async (id) => api.delete(`/workouts/${id}`);
export const fetchTrends = async () => {
    const { data } = await api.get("/workouts/trends/body");
    return data;
};
export const listTemplates = async () => {
    const { data } = await api.get("/templates");
    return data;
};
export const createTemplate = async (payload) => {
    const { data } = await api.post("/templates", payload);
    return data;
};
export const updateTemplate = async (payload) => {
    const { id, ...rest } = payload;
    const { data } = await api.put(`/templates/${id}`, rest);
    return data;
};
export const deleteTemplate = async (id) => api.delete(`/templates/${id}`);
