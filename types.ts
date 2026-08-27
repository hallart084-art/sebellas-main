import type { ApiModel } from './constants';

export interface GeneratedPromptSet {
 id: string | number;
 originalConcept: string;
 prompts: (string | Record<string, any>)[];
 hasError?: boolean; // Flag to indicate if this set represents an error message
 thumbnailUrl?: string;
 inputMode?: InputMode;
 sourceId?: string;
 sourceFile?: File;
}

export type StyleOption = 'photographic' | 'sameAsReference' | 'isolated' | 'custom' | 'footage' | 'vector';

export type PromptQualityOptionType = 'default' | 'xml';

export interface UploadedImage {
 id: string;
 name: string;
 type: string;
 objectUrl: string; // Lightweight URL for preview
 file: File; // Raw file object for delayed processing
}

export interface UploadedVideo {
 id: string;
 name: string;
 objectUrl: string;
 file?: File;
}

export type ModelId = ApiModel;

export type InputMode = 'text' | 'image' | 'video' | 'vector';

export interface GenerationSettings {
 inputMode: InputMode;
 // For text/vector mode
 conceptsInput: string;
 // For image mode
 imageNames: string[];
 // For video mode
 videoNames: string[];
 // Common settings
 numPrompts: number;
 workerCount: number;
 batchDelaySeconds: number;
 styleOption: StyleOption;
 promptQualityOption: PromptQualityOptionType;
 selectedModel: ModelId;
 customTemplate: string;
 negativePrompt: string;
 targetFolderId?: string | null;
 // Vector studio settings
 vectorArtStyle?: string;
 vectorPreset?: string;
 vectorPose?: string;
 vectorAttributes?: string;
 vectorWhiteBg?: boolean;
}

export interface Folder {
 id: string;
 name: string;
 createdAt: number;
}

export interface HistoryEntry {
 id: number; // Using timestamp as ID
 timestamp: number;
 settings: GenerationSettings;
 sets: GeneratedPromptSet[];
 folderId?: string | null;
}

export type NotificationKind = 'info' | 'success' | 'warning' | 'error';
export type NotificationTarget = 'all' | 'single_user';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  kind: NotificationKind;
  recipientUsername: string;
  createdBy: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface SendNotificationPayload {
  senderUsername: string;
  senderSessionToken: string;
  title: string;
  message: string;
  target: NotificationTarget;
  recipientUsername?: string;
  kind?: NotificationKind;
}

export interface SentNotificationItem {
  dispatchId: string;
  title: string;
  message: string;
  kind: NotificationKind;
  createdBy: string;
  createdAt: string;
  recipientCount: number;
  readCount: number;
  unreadCount: number;
}

export interface UpdateSentNotificationPayload {
  senderUsername: string;
  senderSessionToken: string;
  dispatchId: string;
  title: string;
  message: string;
  kind: NotificationKind;
}

export interface AppErrorLog {
  id: string;
  errorMessage: string;
  aiModel: string;
  errorDetails: string;
  username: string;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  promptStyle: string;
  origin: string;
}
