/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
export interface RagStore {
    name: string;
    displayName: string;
}

export interface CustomMetadata {
  key?: string;
  stringValue?: string;
  stringListValue?: string[];
  numericValue?: number;
}

export interface Document {
    name: string;
    displayName: string;
    customMetadata?: CustomMetadata[];
}

export interface GroundingChunk {
    retrievedContext?: {
        text?: string;
    };
}

export interface QueryResult {
    text: string;
    groundingChunks: GroundingChunk[];
}

export enum AppStatus {
    Initializing,
    Auth,
    SelectManual,
    Uploading,
    Chatting,
    Error,
}

export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
    groundingChunks?: GroundingChunk[];
}

export interface ManualRecord {
    id: string;
    title: string;
    description?: string | null;
    ragStoreName: string;
    documentName?: string | null;
    mimeType?: string | null;
}

export interface AuthUser {
    id: string;
    email: string;
}

export interface ChatSessionRecord {
    id: string;
    manualId: string;
    createdAt: string;
    updatedAt: string;
    manual?: ManualRecord;
}

export interface StoredMessage {
    id: string;
    chatSessionId: string;
    role: 'USER' | 'ASSISTANT';
    content: string;
    grounding?: any;
    createdAt: string;
}
