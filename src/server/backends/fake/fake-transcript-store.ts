export interface FakeTranscript {
  workingDirectory: string;
  model: string;
  userMessages: string[];
}

export class FakeTranscriptStore {
  private readonly transcripts = new Map<string, FakeTranscript>();

  create(backendSessionId: string, workingDirectory: string, model: string): FakeTranscript {
    const transcript: FakeTranscript = { workingDirectory, model, userMessages: [] };
    this.transcripts.set(backendSessionId, transcript);
    return transcript;
  }

  find(backendSessionId: string): FakeTranscript | undefined {
    return this.transcripts.get(backendSessionId);
  }

  forget(backendSessionId: string): void {
    this.transcripts.delete(backendSessionId);
  }
}
