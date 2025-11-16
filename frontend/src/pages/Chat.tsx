import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generate, stream, health } from '../lib/api';

type Msg = { id: string; role: 'user' | 'assistant'; text: string };

export default function Chat() {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'stream' | 'once'>('stream');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('unknown');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  // auto-scroll on new messages
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  async function checkHealth() {
    try {
      const h = await health();
      setStatus(`ok @ ${new Date(h.time).toLocaleTimeString()}`);
    } catch {
      setStatus('down');
    }
  }

  async function ask() {
    const text = prompt.trim();
    if (!text) return;

    const id = crypto.randomUUID();
    const userMsg: Msg = { id, role: 'user', text };
    setMsgs((m) => [...m, userMsg]);
    setPrompt('');
    setBusy(true);

    try {
      if (mode === 'once') {
        const r = await generate(text);
        const botMsg: Msg = { id: crypto.randomUUID(), role: 'assistant', text: r.completion.text };
        setMsgs((m) => [...m, botMsg]);
      } else {
        const botId = crypto.randomUUID();
        setMsgs((m) => [...m, { id: botId, role: 'assistant', text: '' }]);
        const stop = stream(text, (t) => {
          setMsgs((m) =>
            m.map((msg) => (msg.id === botId ? { ...msg, text: msg.text + t } : msg))
          );
        });
        // optional auto-stop after 15s for demo
        setTimeout(stop, 15000);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1020] via-[#0e1328] to-[#1a1f37] text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur border-b border-white/10 bg-black/30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-violet-500 to-cyan-400" />
            <h1 className="text-2xl font-bold font-display">PocketLLM Portal</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={checkHealth}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 transition"
            >
              Check backend
            </button>
            <span
              className={
                'px-2 py-1 rounded-md text-xs ' +
                (status.startsWith('ok') ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-700 text-zinc-200')
              }
            >
              status: {status}
            </span>
          </div>
        </div>
      </header>

      {/* Chat area */}
      <main className="max-w-5xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_360px] gap-6">
        <section className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur p-4 flex flex-col h-[72vh]">
          <div ref={listRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
            <AnimatePresence initial={false}>
              {msgs.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  className={
                    'max-w-[80%] rounded-2xl px-4 py-3 shadow ' +
                    (m.role === 'user'
                      ? 'ml-auto bg-violet-500/25 border border-violet-400/30'
                      : 'bg-zinc-800/70 border border-white/10')
                  }
                >
                  <div className="text-xs opacity-70 mb-1">{m.role === 'user' ? 'You' : 'Assistant'}</div>
                  <div className="leading-relaxed whitespace-pre-wrap">{m.text}</div>
                </motion.div>
              ))}
              {msgs.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center opacity-70 pt-10"
                >
                  ✨ Try asking: <span className="font-mono">“Summarize the CPU-only constraints.”</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Composer */}
          <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Type your prompt…"
              className="col-span-1 resize-none rounded-xl bg-black/30 border border-white/10 p-3 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'stream' | 'once')}
              className="px-3 rounded-xl bg-black/30 border border-white/10"
            >
              <option value="stream">Stream</option>
              <option value="once">Single</option>
            </select>
            <button
              onClick={ask}
              disabled={busy || !prompt.trim()}
              className="px-5 rounded-xl bg-gradient-to-tr from-violet-500 to-cyan-400 text-black font-medium disabled:opacity-50"
            >
              {busy ? 'Asking…' : 'Ask'}
            </button>
          </div>
        </section>

        {/* Fun side panel */}
        <aside className="space-y-4">
          <Card title="Quick Prompts">
            <div className="flex flex-wrap gap-2">
              {['Define NFRs', 'Draw component diagram', 'Explain cache TTL', 'List APIs'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPrompt(p)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 transition text-sm"
                >
                  {p}
                </button>
              ))}
            </div>
          </Card>
          <Card title="Tips">
            <ul className="list-disc list-inside text-sm opacity-80 space-y-1">
              <li>“Single” uses cache; repeat the same prompt to see instant responses.</li>
              <li>“Stream” shows tokens as they arrive.</li>
              <li>Check backend to verify health before chatting.</li>
            </ul>
          </Card>
        </aside>
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
      <h3 className="font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}

// import { useState } from 'react';
// import { generate, stream, health } from '../lib/api';

// export default function Chat() {
//   const [prompt, setPrompt] = useState('');
//   const [out, setOut] = useState('');
//   const [mode, setMode] = useState<'stream' | 'once'>('stream');
//   const [busy, setBusy] = useState(false);
//   const [status, setStatus] = useState<string>('unknown');

//   async function checkHealth() {
//     try {
//       const h = await health();
//       setStatus(`${h.status} @ ${new Date(h.time).toLocaleTimeString()}`);
//     } catch {
//       setStatus('down');
//     }
//   }

//   async function ask() {
//     setOut('');
//     setBusy(true);
//     try {
//       if (mode === 'once') {
//         const r = await generate(prompt);
//         setOut(r.completion.text);
//       } else {
//         const close = stream(prompt, (t) => setOut((o) => o + t));
//         // stop after 10s just to demo
//         setTimeout(close, 10_000);
//       }
//     } finally {
//       setBusy(false);
//     }
//   }

//   return (
//     <div style={{maxWidth: 760, margin: '2rem auto', padding: 16}}>
//       <h1 style={{marginBottom: 8}}>PocketLLM Portal</h1>

//       <div style={{display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8}}>
//         <button onClick={checkHealth}>Check backend</button>
//         <small>status: {status}</small>
//       </div>

//       <textarea
//         value={prompt}
//         onChange={(e) => setPrompt(e.target.value)}
//         rows={5}
//         style={{width: '100%'}}
//         placeholder="Type your prompt…"
//       />

//       <div style={{display: 'flex', gap: 8, marginTop: 8}}>
//         <button onClick={ask} disabled={busy || !prompt.trim()}>
//           {busy ? 'Asking…' : 'Ask'}
//         </button>
//         <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
//           <option value="stream">Stream</option>
//           <option value="once">Single</option>
//         </select>
//       </div>

//       <pre style={{whiteSpace: 'pre-wrap', marginTop: 16, minHeight: 120, border: '1px solid #eee', padding: 12}}>
//         {out}
//       </pre>
//     </div>
//   );
// }
