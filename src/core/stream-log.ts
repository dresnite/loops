import type { StreamEvent } from "../providers/types.js";
import { formatAssistantLogText } from "./logs.js";

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

export function formatToolActivity(toolName: string): string {
  const normalized = toolName.trim().toLowerCase();
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
      if (this.activeToolName === event.toolName) {
        return;
      }

      this.activeToolName = event.toolName;
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

    await this.writer.writeBlock("[assistant]", text);
  }
}
