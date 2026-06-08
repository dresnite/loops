import type { StreamEvent } from "../providers/types.js";
import { formatAssistantLogText } from "./logs.js";

export class StreamEventLogger {
  private assistantBuffer = "";

  constructor(private readonly write: (message: string) => Promise<void>) {}

  async handle(event: StreamEvent): Promise<void> {
    if (event.type === "assistant" && event.text) {
      this.assistantBuffer += event.text;
      return;
    }

    await this.flush();

    if (event.type === "tool_call" && event.toolName) {
      await this.write(`[tool] ${event.toolName}`);
    }
  }

  async flush(): Promise<void> {
    if (!this.assistantBuffer) {
      return;
    }

    const text = formatAssistantLogText(this.assistantBuffer);
    this.assistantBuffer = "";

    if (!text) {
      return;
    }

    await this.write(`[assistant] ${text}`);
  }
}
