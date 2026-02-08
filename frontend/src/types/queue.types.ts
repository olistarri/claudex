export interface QueueMessageAttachment {
  file_url: string;
  file_path?: string;
  file_type: string;
  filename?: string;
}

export interface QueuedMessage {
  id: string;
  content: string;
  model_id: string;
  queued_at: string;
  attachments?: QueueMessageAttachment[];
}

export interface QueueUpsertResponse {
  id: string;
  created: boolean;
  content: string;
  attachments?: QueueMessageAttachment[];
}

export interface LocalQueuedMessage {
  id: string;
  content: string;
  model_id: string;
  files?: File[];
  attachments?: QueueMessageAttachment[];
  queuedAt: number;
  synced: boolean;
}
