import { AsyncQueue } from "../../platform/async-queue.ts";
import type { IdGenerator } from "../../platform/id-generator.ts";
import type { BackendEvent, BackendSession } from "../backend-adapter.ts";
import { type FakeStep, scriptForMessage } from "./fake-script.ts";
import type { FakeTranscript } from "./fake-transcript-store.ts";

export type Pace = () => Promise<void>;

export class FakeBackendSession implements BackendSession {
  readonly backendSessionId: string;
  readonly events: AsyncQueue<BackendEvent> = new AsyncQueue();
  private readonly transcript: FakeTranscript;
  private readonly ids: IdGenerator;
  private readonly pace: Pace;
  private turnInProgress = false;
  private interruptRequested = false;

  constructor(backendSessionId: string, transcript: FakeTranscript, ids: IdGenerator, pace: Pace) {
    this.backendSessionId = backendSessionId;
    this.transcript = transcript;
    this.ids = ids;
    this.pace = pace;
  }

  async send(text: string): Promise<void> {
    if (this.events.isClosed) {
      throw new Error("Fake backend session is closed");
    }
    if (this.turnInProgress) {
      throw new Error("Fake backend session is already running a turn");
    }
    this.turnInProgress = true;
    this.interruptRequested = false;
    this.transcript.userMessages.push(text);
    const steps = await scriptForMessage(
      text,
      this.transcript.userMessages.length,
      this.transcript.workingDirectory,
    );
    void this.runTurn(text, steps);
  }

  async interrupt(): Promise<void> {
    this.interruptRequested = this.turnInProgress;
  }

  async close(): Promise<void> {
    this.events.close();
  }

  private async runTurn(text: string, steps: FakeStep[]): Promise<void> {
    let outputLength = 0;
    for (const step of steps) {
      if (step.kind === "failure") {
        return this.completeTurn("error", step.message);
      }
      const completed =
        step.kind === "tool" ? await this.emitTool(step) : await this.emitText(step);
      if (!completed) {
        return this.completeTurn("interrupted", null);
      }
      outputLength += step.kind === "text" ? step.chunks.join("").length : 0;
    }
    this.emit({ type: "usage", inputTokens: text.length, outputTokens: outputLength });
    this.completeTurn("end", null);
  }

  private async emitTool(step: Extract<FakeStep, { kind: "tool" }>): Promise<boolean> {
    const toolCallId = this.ids.next();
    this.emit({
      type: "tool.started",
      toolCallId,
      name: step.name,
      kind: step.toolKind,
      summary: step.summary,
      input: { command: step.summary },
    });
    await this.pace();
    this.emit({ type: "tool.completed", toolCallId, output: step.output, isError: false });
    return !this.interruptRequested;
  }

  private async emitText(step: Extract<FakeStep, { kind: "text" }>): Promise<boolean> {
    const messageId = this.ids.next();
    let streamed = "";
    for (const chunk of step.chunks) {
      await this.pace();
      if (this.interruptRequested) {
        return false;
      }
      streamed += chunk;
      this.emit({ type: "assistant.delta", messageId, text: chunk });
    }
    this.emit({ type: "assistant.message", messageId, text: streamed });
    return true;
  }

  private completeTurn(reason: "end" | "interrupted" | "error", errorMessage: string | null): void {
    this.turnInProgress = false;
    this.interruptRequested = false;
    this.emit({ type: "turn.completed", reason, errorMessage });
  }

  private emit(event: BackendEvent): void {
    if (!this.events.isClosed) {
      this.events.push(event);
    }
  }
}
