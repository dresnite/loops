import type { StreamEvent } from "../providers/types.js";
import { ASSISTANT_LOG_LABEL, formatAssistantLogText } from "./logs.js";

export interface StreamLogWriter {
  writeLine(message: string): Promise<void>;
  writeBlock(label: string, body: string): Promise<void>;
}

const TOOL_ACTIVITY_LABELS: Record<string, string> = {
  read: "reading...",
  shell: "running command...",
  grep: "searching...",
  glob: "finding files...",
  write: "writing...",
  edit: "editing...",
  search_replace: "editing...",
};

export function normalizeToolName(toolName: string): string {
  return toolName.trim().toLowerCase();
}

export function formatToolActivity(toolName: string): string {
  const normalized = normalizeToolName(toolName);
  return TOOL_ACTIVITY_LABELS[normalized] ?? `using ${toolName}...`;
}

export class StreamEventLogger {
  private assistantBuffer = "";
  private activeToolName: string | null = null;

  constructor(private readonly writer: StreamLogWriter) {}

  async handle(event: StreamEvent): Promise<void> {
    if (event.type === "assistant" && event.text) {
      this.assistantBuffer += event.text;
      return;
    }

    await this.flushAssistant();

    if (event.type === "tool_call" && event.toolName) {
      const normalizedToolName = normalizeToolName(event.toolName);
      if (this.activeToolName === normalizedToolName) {
        return;
      }

      this.activeToolName = normalizedToolName;
      await this.writer.writeLine(
        `[tool] ${formatToolActivity(event.toolName)}`,
      );
    }
  }

  async flush(): Promise<void> {
    await this.flushAssistant();
    this.activeToolName = null;
  }

  private async flushAssistant(): Promise<void> {
    if (!this.assistantBuffer) {
      return;
    }

    const text = formatAssistantLogText(this.assistantBuffer);
    this.assistantBuffer = "";
    this.activeToolName = null;

    if (!text) {
      return;
    }

    await this.writer.writeBlock(ASSISTANT_LOG_LABEL, text);
  }
}
