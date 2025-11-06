// backend/src/services/ollamaAdapter.ts

// Node 22 has global `fetch`, no import needed.
// Make sure tsconfig lib includes "DOM" so TS knows about fetch/ReadableStream.

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
const MODEL_ID = process.env.MODEL_ID ?? "llama3.2:3b";

// Small system prompt to keep CPU work minimal
function makePrompt(userPrompt: string): string {
  return `You are PocketLLM, a concise, helpful assistant.
User: ${userPrompt}
Assistant:`;
}

// -------- single-shot generation (no streaming) ----------
export async function generateOnceOllama(prompt: string): Promise<string> {
  const body = {
    model: MODEL_ID,
    prompt: makePrompt(prompt),
    stream: false,
  };

  const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama generate error: ${res.status} ${text}`);
  }

  const json: any = await res.json();
  // Ollama returns the full text in `response`
  return json.response ?? "";
}

// -------- token streaming generation ----------
export async function* generateStreamOllama(
  prompt: string
): AsyncGenerator<string> {
  const body = {
    model: MODEL_ID,
    prompt: makePrompt(prompt),
    stream: true,
  };

  const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama stream error: ${res.status} ${text}`);
  }

  // In Node 22, res.body is a web ReadableStream, so getReader() works
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Ollama streaming returns one JSON object per line
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (!line) continue;

      let obj: any;
      try {
        obj = JSON.parse(line);
      } catch {
        continue; // skip partial / bad lines
      }

      const token = obj.response as string | undefined;
      if (typeof token === "string" && token.length > 0) {
        yield token;
      }

      // Ollama marks the final chunk with done: true
      if (obj.done === true) {
        return;
      }
    }
  }
}

// // src/services/ollamaAdapter.ts
// // import fetch from "node-fetch";

// export interface IModelAdapter {
//   generateOnce(prompt: string): Promise<string>;
//   generateStream(prompt: string): AsyncIterable<string>;
// }

// const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
// const MODEL_ID    = process.env.MODEL_ID    || "llama3.2:3b-instruct";

// function systemPrompt() {
//   // Keep it short to minimize CPU time.
//   return "You are PocketLLM, a concise helpful assistant.";
// }

// export class OllamaAdapter implements IModelAdapter {
//   async generateOnce(prompt: string): Promise<string> {
//     const body = {
//       model: MODEL_ID,
//       prompt: `${systemPrompt()}\n\nUser: ${prompt}\nAssistant:`,
//       stream: false
//     };

//     const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
//       method: "POST",
//       headers: { "content-type": "application/json" },
//       body: JSON.stringify(body),
//     });

//     if (!res.ok) {
//       const text = await res.text().catch(() => "");
//       throw new Error(`Ollama generate error: ${res.status} ${text}`);
//     }

//     const json: any = await res.json();
//     return json.response ?? "";
//   }

//   async *generateStream(prompt: string): AsyncIterable<string> {
//     const body = {
//       model: MODEL_ID,
//       prompt: `${systemPrompt()}\n\nUser: ${prompt}\nAssistant:`,
//       stream: true
//     };

//     const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
//       method: "POST",
//       headers: { "content-type": "application/json" },
//       body: JSON.stringify(body),
//     });

//     if (!res.ok || !res.body) {
//       const text = await res.text().catch(() => "");
//       throw new Error(`Ollama stream error: ${res.status} ${text}`);
//     }

//     // Ollama streams JSON lines (one per token/chunk)
//     const reader = res.body.getReader();
//     const decoder = new TextDecoder();

//     let buffer = "";
//     while (true) {
//       const { value, done } = await reader.read();
//       if (done) break;
//       buffer += decoder.decode(value, { stream: true });

//       // Split on newlines to parse JSONL safely
//       let idx;
//       while ((idx = buffer.indexOf("\n")) >= 0) {
//         const line = buffer.slice(0, idx).trim();
//         buffer = buffer.slice(idx + 1);
//         if (!line) continue;
//         try {
//           const obj = JSON.parse(line);
//           if (obj.response) yield obj.response as string; // token/chunk
//         } catch {
//           // ignore partial/invalid lines
//         }
//       }
//     }
//   }
// }
