// export async function* generateStream(prompt: string) {
//   const tokens = (`You said: ${prompt}`).split(' ');
//   for (const t of tokens) { yield t + ' '; await new Promise(r=>setTimeout(r, 60)); }
// }
// export async function generateOnce(prompt: string) {
//   let out = ''; for await (const t of generateStream(prompt)) out += t; return out;
// }
// backend/src/services/modelRunner.ts

import {
  generateOnceOllama,
  generateStreamOllama,
} from "./ollamaAdapter";

// Single response mode – delegate to Ollama
export async function generateOnce(prompt: string): Promise<string> {
  return generateOnceOllama(prompt);
}

// Streaming mode – delegate to Ollama streaming generator
export async function* generateStream(
  prompt: string
): AsyncGenerator<string> {
  for await (const token of generateStreamOllama(prompt)) {
    yield token;
  }
}
