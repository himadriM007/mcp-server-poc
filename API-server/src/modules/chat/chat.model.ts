/** One MCP tool call made while answering a message. */
export interface ToolStep {
  name: string;
  args: Record<string, unknown>;
  status: 'ok' | 'error' | 'declined';
  result: string;
}

/** A destructive tool call waiting for the user's approval. */
export interface PendingToolCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Result of POST /chat and POST /chat/confirm.
 * Exactly one of `reply` (turn finished) or `confirm` (turn paused) is set.
 */
export interface ChatTurn {
  steps: ToolStep[];
  reply?: string;
  confirm?: PendingToolCall;
}

export interface ChatToolInfo {
  name: string;
  description: string;
  destructive: boolean;
}

export interface ChatInfo {
  model: string;
  tools: ChatToolInfo[];
}
