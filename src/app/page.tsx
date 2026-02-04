'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Truck, Users, Calendar, Inbox, FolderKanban, Settings,
  Search, Mic, Bell, LayoutDashboard, Loader2,
} from 'lucide-react';
import { useUiStore, useDispatchStore, useCommandCenterStore } from '@/stores';
import { DispatchTab } from '@/components/dispatch/dispatch-tab';
import { IntakeTab } from '@/components/intake/intake-tab';
import { toast } from 'sonner';

// ── TAB CONFIG ──────────────────────────────────────────────

const TABS = [
  // Tier 1 — Primary
  { id: 'dispatch', label: 'Dispatch', icon: LayoutDashboard, tier: 1 },
  { id: 'planner', label: 'Planner', icon: Calendar, tier: 1 },
  { id: 'intake', label: 'Intake', icon: Inbox, tier: 1 },
  // Tier 2 — Support
  { id: 'projects', label: 'Projects', icon: FolderKanban, tier: 2 },
  { id: 'fleet', label: 'Fleet', icon: Truck, tier: 2 },
  { id: 'crew', label: 'Crew', icon: Users, tier: 2 },
  { id: 'settings', label: 'Settings', icon: Settings, tier: 2 },
];

// ── MAIN LAYOUT ─────────────────────────────────────────────

export default function Home() {
  const { activeTab, setActiveTab, showSearch, setShowSearch, showChangeLog, setShowChangeLog } = useUiStore();
  const { micActive, setMicActive, selectedDate } = useDispatchStore();
  const setScenarioResult = useCommandCenterStore((s) => s.setScenarioResult);
  const setShowFloatingScenario = useCommandCenterStore((s) => s.setShowFloatingScenario);

  const [commandInput, setCommandInput] = useState('');
  const [commandLoading, setCommandLoading] = useState(false);

  const submitCommand = useCallback(async () => {
    const text = commandInput.trim();
    if (!text || commandLoading) return;
    setCommandLoading(true);
    setCommandInput('');
    try {
      const res = await fetch('/api/dispatch/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, date: selectedDate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Command failed');
      if (json.type === 'scenario') {
        setScenarioResult(json.result ?? null);
        setShowFloatingScenario(true);
      } else if (json.type === 'update') {
        const msg = json.result?.message ?? 'Done';
        toast.success(msg);
      } else if (json.type === 'query') {
        const answer = json.result?.answer ?? json.result;
        if (answer) toast.info(String(answer));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Command failed');
    } finally {
      setCommandLoading(false);
    }
  }, [commandInput, commandLoading, selectedDate, setScenarioResult, setShowFloatingScenario]);

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(!showSearch);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showSearch, setShowSearch]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── VOICE RECORDING BANNER ── */}
      {micActive && (
        <div className="bg-danger/20 border-b border-danger/40 px-4 py-2 flex items-center justify-center gap-2 text-danger text-sm font-medium animate-pulse">
          <div className="w-2 h-2 rounded-full bg-danger animate-pulse-glow" />
          Recording — speak your dispatch command
          <button onClick={() => setMicActive(false)} className="ml-4 underline text-xs">Cancel</button>
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="bg-surface-0 border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber rounded flex items-center justify-center">
              <span className="text-black font-bold font-mono text-sm">DH</span>
            </div>
            <span className="text-text-0 font-semibold text-lg hidden sm:block">DispatchHub</span>
          </div>

          {/* Tab Navigation */}
          <nav className="flex items-center">
            {/* Tier 1 */}
            <div className="flex items-center gap-1 mr-3">
              {TABS.filter(t => t.tier === 1).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-default ${
                    activeTab === tab.id
                      ? 'bg-amber/15 text-amber'
                      : 'text-text-2 hover:text-text-0 hover:bg-surface-2'
                  }`}
                >
                  <tab.icon size={16} />
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-border mx-1" />

            {/* Tier 2 */}
            <div className="flex items-center gap-1 ml-2">
              {TABS.filter(t => t.tier === 2).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-default ${
                    activeTab === tab.id
                      ? 'bg-amber/15 text-amber'
                      : 'text-text-3 hover:text-text-1 hover:bg-surface-2'
                  }`}
                >
                  <tab.icon size={14} />
                  <span className="hidden lg:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>

        {/* Right side — Command input, Search, Mic, Changelog */}
        <div className="flex items-center gap-2">
          <div className="relative w-[400px] max-w-[min(400px,50vw)] hidden md:block">
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitCommand()}
              placeholder="Type a command... (e.g. 'truck 8 broke', 'mark Queens job done')"
              className="w-full h-9 pl-3 pr-9 rounded bg-surface-2 border border-border text-text-0 text-sm placeholder:text-text-3 focus:outline-none focus:border-amber/50 focus:ring-1 focus:ring-amber/30"
              disabled={commandLoading}
            />
            {commandLoading && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <Loader2 className="h-4 w-4 animate-spin text-amber" />
              </div>
            )}
          </div>
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-surface-2 text-text-2 text-xs hover:text-text-0 transition-default"
          >
            <Search size={14} />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden md:inline text-text-3 text-[10px] ml-1 px-1 py-0.5 rounded bg-surface-0 border border-border">⌘K</kbd>
          </button>

          <button
            onClick={() => setMicActive(!micActive)}
            className={`p-2 rounded transition-default ${
              micActive ? 'bg-danger text-white' : 'bg-surface-2 text-text-2 hover:text-amber'
            }`}
          >
            <Mic size={16} />
          </button>

          <button
            onClick={() => setShowChangeLog(!showChangeLog)}
            className="relative p-2 rounded bg-surface-2 text-text-2 hover:text-purple transition-default"
          >
            <Bell size={16} />
            {/* TODO: Badge count from change log query */}
          </button>
        </div>
      </header>

      {/* ── CONTENT AREA ── */}
      <main className="flex-1 p-4">
        {/* TODO: Replace with actual tab components as you build them */}
        {activeTab === 'dispatch' && <DispatchTab />}
        {activeTab === 'planner' && <PlaceholderTab name="Planner" description="Monthly calendar with capacity dots and conflict flags" />}
        {activeTab === 'intake' && <IntakeTab />}
        {activeTab === 'projects' && <PlaceholderTab name="Projects" description="Demo project cards with crew assignments and Project Brain AI" />}
        {activeTab === 'fleet' && <PlaceholderTab name="Fleet" description="18 vehicles grid with GPS status from IntelliShift" />}
        {activeTab === 'crew' && <PlaceholderTab name="Crew" description="16 workers with roles, certs, and availability" />}
        {activeTab === 'settings' && <PlaceholderTab name="Settings" description="Integration panels: IntelliShift, Twilio, Outlook, RALCO" />}
      </main>

      {/* TODO: Global Search modal (showSearch) */}
      {/* TODO: Change Log drawer (showChangeLog) */}
    </div>
  );
}

// ── PLACEHOLDER ─────────────────────────────────────────────
// Temporary — gets replaced as you build each tab

function PlaceholderTab({ name, description }: { name: string; description: string }) {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-text-0 mb-2">{name}</h2>
        <p className="text-text-2 text-sm max-w-md">{description}</p>
        <p className="text-text-3 text-xs mt-4 font-mono">Phase 2+ — Ask Cursor to build this tab</p>
      </div>
    </div>
  );
}
