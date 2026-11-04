import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as api from './api';
import type { ToolInfo, ToolStep, TurnResult } from './api';

type Message =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'bot'; text: string; steps: ToolStep[] }
  | { id: number; role: 'error'; text: string };

type Pending = { name: string; args: Record<string, unknown>; steps: ToolStep[] };

const SUGGESTIONS = ['Who are the active users?', 'Show me user 1', 'Add a new user', 'Are any users missing a phone number?'];

let nextId = 1;
const newSessionId = () => crypto.randomUUID();

export default function App() {
  const [sessionId, setSessionId] = useState(newSessionId);
  const [info, setInfo] = useState<{ model: string; tools: ToolInfo[] } | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.getInfo().then(setInfo, (e: Error) => setInfoError(e.message));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending, busy]);

  /** Applies a backend turn result; `carried` are tool steps from before a confirmation pause. */
  function applyResult(result: TurnResult, carried: ToolStep[]) {
    const steps = [...carried, ...result.steps];
    if (result.confirm) {
      setPending({ ...result.confirm, steps });
    } else {
      setPending(null);
      setMessages((m) => [...m, { id: nextId++, role: 'bot', text: result.reply ?? '', steps }]);
    }
  }

  async function run(action: () => Promise<TurnResult>, carried: ToolStep[]) {
    setBusy(true);
    try {
      applyResult(await action(), carried);
    } catch (e) {
      setPending(null);
      setMessages((m) => [...m, { id: nextId++, role: 'error', text: (e as Error).message }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function send(text: string) {
    const message = text.trim();
    if (!message || busy || pending) return;
    setInput('');
    setMessages((m) => [...m, { id: nextId++, role: 'user', text: message }]);
    void run(() => api.sendMessage(sessionId, message), []);
  }

  function decide(approve: boolean) {
    if (!pending) return;
    const carried = pending.steps;
    setPending(null);
    void run(() => api.confirmTool(sessionId, approve), carried);
  }

  async function newChat() {
    if (busy) return;
    await api.resetChat(sessionId).catch(() => undefined);
    setSessionId(newSessionId());
    setMessages([]);
    setPending(null);
    inputRef.current?.focus();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="logo" aria-hidden>
            ◆
          </span>
          <div>
            <h1>User Directory Chat</h1>
            <p className="sub">
              {info ? (
                <>
                  {info.model} · <button className="link" onClick={() => setShowTools((s) => !s)}>
                    {info.tools.length} MCP tools
                  </button>
                </>
              ) : infoError ? (
                <span className="err-text">{infoError}</span>
              ) : (
                'Connecting…'
              )}
            </p>
          </div>
        </div>
        <button className="btn ghost" onClick={newChat} disabled={busy}>
          New chat
        </button>
      </header>

      {showTools && info && (
        <section className="tools-panel">
          {info.tools.map((t) => (
            <div key={t.name} className="tool-row">
              <code>{t.name}</code>
              {t.destructive && <span className="badge warn">needs approval</span>}
              <p>{t.description}</p>
            </div>
          ))}
        </section>
      )}

      <main className="messages">
        {messages.length === 0 && !busy && (
          <div className="empty">
            <h2>What would you like to do?</h2>
            <p>Ask about users, add new ones, or deactivate accounts. The assistant uses the MCP server's tools.</p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)} disabled={!info}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`row ${m.role}`}>
            {m.role === 'bot' && m.steps.length > 0 && <Steps steps={m.steps} />}
            <div className={`bubble ${m.role}`}>
              {m.role === 'bot' ? <Markdown remarkPlugins={[remarkGfm]}>{m.text}</Markdown> : m.text}
            </div>
          </div>
        ))}

        {pending && (
          <div className="row bot">
            {pending.steps.length > 0 && <Steps steps={pending.steps} />}
            <div className="confirm">
              <p>
                The assistant wants to run <code>{pending.name}</code>
              </p>
              <pre>{JSON.stringify(pending.args, null, 2)}</pre>
              <div className="confirm-actions">
                <button className="btn danger" onClick={() => decide(true)}>
                  Allow
                </button>
                <button className="btn ghost" onClick={() => decide(false)}>
                  Deny
                </button>
              </div>
            </div>
          </div>
        )}

        {busy && (
          <div className="row bot">
            <div className="bubble bot typing" aria-label="Thinking">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <form className="composer" onSubmit={onSubmit}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={pending ? 'Approve or deny the action above…' : 'Message the assistant…'}
          rows={1}
          disabled={!!pending}
          autoFocus
        />
        <button className="btn primary" type="submit" disabled={busy || !!pending || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

function Steps({ steps }: { steps: ToolStep[] }) {
  return (
    <div className="steps">
      {steps.map((s, i) => (
        <details key={i} className={`step ${s.status}`}>
          <summary>
            <span className="dot" />
            <code>{s.name}</code>
            <span className="args">{JSON.stringify(s.args)}</span>
            <span className="status">{s.status === 'ok' ? 'done' : s.status}</span>
          </summary>
          {s.result && <pre>{s.result}</pre>}
        </details>
      ))}
    </div>
  );
}
