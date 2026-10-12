export type AuthProvider = "email" | "google" | "github";

export interface AuthUser {
  id: string | number;
  provider: AuthProvider;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  email: string | null;
  bio: string | null;
}

export interface AuthData {
  provider: AuthProvider | null;
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
}

export interface EmailLoginPayload {
  email: string;
  password: string;
}

export interface EmailRegisterPayload {
  email: string;
  password: string;
  name?: string;
  code: string;
}
