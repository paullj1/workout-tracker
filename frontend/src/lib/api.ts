import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export type WorkoutSet = {
  exercise: string;
  reps: number;
  weight?: number | null;
  unit: "kg" | "lb";
  rpe?: number | null;
};

export type WorkoutPayload = {
  title: string;
  start_time: string;
  end_time?: string | null;
  template_id?: string | null;
  body_weight?: number | null;
  body_weight_timing?: "before" | "after" | null;
  notes?: string | null;
  sets: WorkoutSet[];
};

export type Workout = WorkoutPayload & {
  id: string;
  created_at: string;
  updated_at: string;
};

export type TrendPoint = {
  date: string;
  total_sets: number;
  total_reps: number;
  tonnage: number;
  average_body_weight?: number | null;
};

export type User = {
  id: string;
  display_name?: string | null;
  email?: string | null;
  created_at: string;
  updated_at: string;
};

export type UserCreate = {
  display_name: string;
  email?: string;
  encryption_token: string;
};

export type AppleAuthPayload = {
  authorization_code: string;
  encryption_token?: string;
  display_name?: string;
};

export type TemplateExercise = {
  name: string;
  target_sets: number;
  target_reps: number;
  rest_seconds?: number;
};

export type TemplatePayload = {
  name: string;
  notes?: string | null;
  exercises: TemplateExercise[];
};

export type Template = TemplatePayload & {
  id: string;
  created_at: string;
  updated_at: string;
};

export type TemplateUpdate = TemplatePayload & { id: string };

export const fetchSession = async (): Promise<User | null> => {
  const { data } = await api.get<User | null>("/auth/session");
  return data;
};

export const registerUser = async (payload: UserCreate): Promise<User> => {
  const { data } = await api.post<User>("/users", payload);
  return data;
};

export const appleLogin = async (payload: AppleAuthPayload): Promise<User> => {
  const { data } = await api.post<User>("/auth/apple/complete", payload);
  return data;
};

export const listWorkouts = async (): Promise<Workout[]> => {
  const { data } = await api.get<Workout[]>("/workouts");
  return data;
};

export const createWorkout = async (payload: WorkoutPayload) => {
  const { data } = await api.post<Workout>("/workouts", payload);
  return data;
};

export const updateWorkout = async (payload: Workout) => {
  const { data } = await api.put<Workout>(`/workouts/${payload.id}`, payload);
  return data;
};

export const deleteWorkout = async (id: string) => api.delete(`/workouts/${id}`);

export const fetchTrends = async (): Promise<TrendPoint[]> => {
  const { data } = await api.get<TrendPoint[]>("/workouts/trends/body");
  return data;
};

export const listTemplates = async (): Promise<Template[]> => {
  const { data } = await api.get<Template[]>("/templates");
  return data;
};

export const createTemplate = async (payload: TemplatePayload) => {
  const { data } = await api.post<Template>("/templates", payload);
  return data;
};

export const updateTemplate = async (payload: TemplateUpdate) => {
  const { id, ...rest } = payload;
  const { data } = await api.put<Template>(`/templates/${id}`, rest);
  return data;
};

export const deleteTemplate = async (id: string) => api.delete(`/templates/${id}`);
