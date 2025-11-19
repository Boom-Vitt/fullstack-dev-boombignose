import type { AuthUser, ManualRecord, StoredMessage, ChatSessionRecord } from "../types";

const API_BASE = "/api";

interface AuthPayload {
  email: string;
  password: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

export const apiClient = {
  signup(payload: AuthPayload): Promise<AuthUser> {
    return request("/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  login(payload: AuthPayload): Promise<AuthUser> {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  logout() {
    return request("/auth/logout", {
      method: "POST",
    });
  },
  currentUser(): Promise<AuthUser> {
    return request("/auth/me");
  },
  listManuals(): Promise<ManualRecord[]> {
    return request("/manuals");
  },
  createManual(payload: {
    title: string;
    description?: string;
    ragStoreName: string;
    documentName?: string;
    mimeType?: string;
  }): Promise<ManualRecord> {
    return request("/manuals", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  createChat(manualId: string): Promise<ChatSessionRecord> {
    return request("/chats", {
      method: "POST",
      body: JSON.stringify({ manualId }),
    });
  },
  listMessages(chatId: string): Promise<StoredMessage[]> {
    return request(`/chats/${chatId}/messages`);
  },
  appendMessage(chatId: string, payload: { role: "USER" | "ASSISTANT"; content: string; grounding?: any }) {
    return request(`/chats/${chatId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

