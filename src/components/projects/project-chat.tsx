'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, MessageSquare, Check, X as XIcon } from 'lucide-react';
import { useProjectStore, type ProjectChatMsg } from '@/stores';
import { CategoryConfirm } from './category-confirm';
import type { NoteCategory } from '@/types';

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2 rounded-lg rounded-tl-sm bg-surface-2 text-text-2">
      <span className="w-2 h-2 rounded-full bg-amber/80 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 rounded-full bg-amber/80 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 rounded-full bg-amber/80 animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

function ToolResultBadge({ result }: { result: { toolName: string; success: boolean; message: string } }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${
      result.success
        ? 'bg-success/10 border-success/30 text-success'
        : 'bg-danger/10 border-danger/30 text-danger'
    }`}>
      {result.success ? <Check size={12} /> : <XIcon size={12} />}
      <span className="break-words">{result.message}</span>
    </div>
  );
}

export function ProjectChat() {
  const {
    projectChatMessages,
    projectChatLoading,
    addProjectChatMessage,
    setProjectChatLoading,
    noteConfirmation,
    setNoteConfirmation,
  } = useProjectStore();

  const [input, setInput] = useState('');
  const [greetingLoaded, setGreetingLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [projectChatMessages, projectChatLoading]);

  // AI greeting on first load
  useEffect(() => {
    if (greetingLoaded || projectChatMessages.length > 0) return;
    setGreetingLoaded(true);

    (async () => {
      try {
        const res = await fetch('/api/projects/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ greeting: true }),
        });
        const json = await res.json();
        const text = json.data?.response ?? 'Projects loaded. What do you need?';
        addProjectChatMessage({ role: 'assistant', content: text });
      } catch {
        addProjectChatMessage({ role: 'assistant', content: 'Projects loaded. What do you need?' });
      }
    })();
  }, [greetingLoaded, projectChatMessages.length, addProjectChatMessage]);

  const buildHistory = (): { role: string; content: string }[] =>
    projectChatMessages.slice(-6).map((m) => ({ role: m.role, content: m.content }));

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || projectChatLoading) return;
    setInput('');

    addProjectChatMessage({ role: 'user', content: text });
    setProjectChatLoading(true);

    try {
      const res = await fetch('/api/projects/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, chatHistory: buildHistory() }),
      });

      const json = await res.json();

      if (!res.ok) {
        addProjectChatMessage({
          role: 'assistant',
          content: `⚠️ ${json.error ?? 'Something went wrong. Try again.'}`,
        });
        return;
      }

      const { response, toolResults } = json.data ?? {};
      const results = Array.isArray(toolResults) ? toolResults : [];

      // Check for add_note tool calls that need category confirmation
      const noteResult = results.find(
        (r: { toolName: string; success: boolean; data?: { suggestedCategory?: string; projectName?: string; note?: { content: string; projectId: string } } }) =>
          r.toolName === 'add_note' && r.success && r.data
      );

      if (noteResult?.data) {
        // Note was already saved by the tool — no confirmation needed
        // But if we wanted confirmation first, we'd set noteConfirmation here
      }

      addProjectChatMessage({
        role: 'assistant',
        content: response ?? 'Done.',
        toolResults: results,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      addProjectChatMessage({
        role: 'assistant',
        content: `⚠️ ${msg}. Try again or check your connection.`,
      });
    } finally {
      setProjectChatLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden border-l border-border bg-surface-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <MessageSquare size={16} className="text-amber" />
        <h3 className="text-sm font-semibold text-text-0">Project Brain</h3>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-3"
      >
        {projectChatMessages.length === 0 && !projectChatLoading && (
          <p className="text-text-3 text-sm py-4">
            Ask about projects, assign crew, add notes, or create new projects.
          </p>
        )}

        {projectChatMessages.map((msg: ProjectChatMsg, i: number) => {
          if (msg.role === 'user') {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] px-3 py-2 rounded-lg rounded-tr-sm bg-amber/20 text-amber border border-amber/30 text-sm break-words">
                  {msg.content}
                </div>
              </div>
            );
          }

          return (
            <div key={i} className="flex justify-start">
              <div className="max-w-[95%] w-full space-y-1.5">
                <div className="px-3 py-2 rounded-lg rounded-tl-sm bg-surface-2 text-text-1 border border-border text-sm break-words whitespace-pre-wrap">
                  {msg.content}
                </div>
                {msg.toolResults?.map((result, ri) => (
                  <ToolResultBadge key={ri} result={result} />
                ))}
              </div>
            </div>
          );
        })}

        {projectChatLoading && (
          <div className="flex justify-start">
            <TypingIndicator />
          </div>
        )}

        {/* Category confirmation */}
        {noteConfirmation && <CategoryConfirm />}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-border shrink-0 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Ask about projects..."
          className="flex-1 h-10 px-3 rounded bg-surface-2 border border-border text-text-0 text-sm placeholder:text-text-3 focus:outline-none focus:border-amber"
          disabled={projectChatLoading}
        />
        <button
          onClick={sendMessage}
          disabled={projectChatLoading || !input.trim()}
          className="h-10 w-10 shrink-0 rounded bg-amber text-black flex items-center justify-center hover:bg-amber/90 disabled:opacity-50 transition-colors"
        >
          {projectChatLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>
    </div>
  );
}
