import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { Toaster, toast } from "sonner";
import {
  LayoutDashboard, Plus, History, Bookmark, BarChart3, Settings,
  ChevronLeft, ChevronRight, Search, Bell, Sun, Moon, Menu, X,
  Download, Copy, Share2, ExternalLink, CheckCircle2, AlertTriangle,
  Loader2, XCircle, Clock, Zap, Star, Globe, FileText, Eye,
  Sparkles, ArrowRight, Database, Award, Filter, ChevronDown,
  BookOpen, PenLine, MessageSquare, Flag, BarChart2,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line,
} from "recharts";

// ──────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────
type AgentStatus = "waiting" | "running" | "completed" | "failed";
type Page = "dashboard" | "history" | "saved" | "analytics" | "settings";
type ResearchTab = "report" | "sources" | "critic" | "raw";

interface AgentState {
  id: string; name: string; emoji: string; tagline: string;
  status: AgentStatus; progress: number;
}
interface LogEntry { id: number; emoji: string; agent: string; message: string; ts: string; type: "info" | "success" | "warn"; }
interface HistoryItem { id: number; topic: string; date: string; score: number; tags: string[]; words: number; }
interface ApiResult { topic: string; search_result: string; scraped_content: string; report: string; feedback: string; }

// Backend API base URL — change this if your FastAPI server runs on a different host/port.
const API_BASE_URL = "http://localhost:8000";

// Parses the raw "Title: ...\nURL: ...\nSnippet: ...\n----\n..." text the
// search agent returns into a simple list of source objects.
function parseSources(searchResult: string): { title: string; url: string; snippet: string; domain: string }[] {
  if (!searchResult) return [];
  return searchResult.split(/\n?-{3,}\n?/).map((block) => {
    const title = block.match(/Title:\s*(.*)/)?.[1]?.trim() || "Untitled source";
    const url = block.match(/URL:\s*(.*)/)?.[1]?.trim() || "";
    const snippet = block.match(/Snippet:\s*([\s\S]*)/)?.[1]?.trim() || "";
    let domain = "";
    try { domain = url ? new URL(url).hostname.replace(/^www\./, "") : ""; } catch { domain = ""; }
    return { title, url, snippet, domain };
  }).filter((s) => s.title !== "Untitled source" || s.url);
}

// ──────────────────────────────────────────────────
// Constants & Mock Data
// ──────────────────────────────────────────────────
const PIPELINE_NODES = [
  { label: "User Query", icon: MessageSquare, color: "#94a3b8" },
  { label: "Search Agent", icon: Search, color: "#a78bfa" },
  { label: "Reader Agent", icon: BookOpen, color: "#818cf8" },
  { label: "Writer Agent", icon: PenLine, color: "#60a5fa" },
  { label: "Critic Agent", icon: Eye, color: "#34d399" },
  { label: "Final Report", icon: Flag, color: "#fbbf24" },
];

const INITIAL_AGENTS: AgentState[] = [
  { id: "search", name: "Search Agent", emoji: "🔍", tagline: "Querying Tavily API", status: "waiting", progress: 0 },
  { id: "reader", name: "Reader Agent", emoji: "📖", tagline: "Scraping & parsing URLs", status: "waiting", progress: 0 },
  { id: "writer", name: "Writer Agent", emoji: "✍️", tagline: "Synthesizing report draft", status: "waiting", progress: 0 },
  { id: "critic", name: "Critic Agent", emoji: "🧐", tagline: "Reviewing & scoring quality", status: "waiting", progress: 0 },
];

const MOCK_SOURCES = [
  { id: 1, title: "The Future of Agentic AI Systems", url: "https://arxiv.org/abs/2024.18291", domain: "arxiv.org", summary: "A comprehensive survey of autonomous AI agent architectures, exploring multi-agent coordination, tool use, and emergent capabilities in LLMs deployed at scale.", credibility: 9.2 },
  { id: 2, title: "Autonomous Agents in Production: Lessons Learned", url: "https://openai.com/research/agents", domain: "openai.com", summary: "OpenAI's findings on deploying agentic systems at scale — safety considerations, failure modes, and human-in-the-loop design patterns for enterprise environments.", credibility: 8.8 },
  { id: 3, title: "Multi-Agent Frameworks: AutoGen vs LangGraph", url: "https://microsoft.com/research/autogen", domain: "microsoft.com", summary: "Technical comparison of leading multi-agent orchestration frameworks evaluating architecture, performance characteristics, and suitability for production use cases.", credibility: 8.5 },
  { id: 4, title: "Agentic AI: Economic Impact and Labor Markets", url: "https://mckinsey.com/ai-agents-2024", domain: "mckinsey.com", summary: "McKinsey's analysis of how autonomous AI agents will reshape knowledge work, productivity, and workforce composition by 2030 across major industries.", credibility: 7.9 },
];

const REPORT_SECTIONS = [
  { title: "Introduction", body: "Agentic AI represents a paradigm shift from passive language models to autonomous systems capable of planning, tool use, and multi-step reasoning. As of 2024, the field is transitioning from research prototypes to production deployments across enterprise environments, with adoption accelerating significantly." },
  { title: "Key Findings", body: "The ecosystem is converging around two dominant patterns: orchestrator-executor hierarchies and reactive agent networks. Modern agentic systems are defined by their tool ecosystems — agents with access to web search, code execution, and structured data APIs consistently outperform monolithic agents by +34% on GAIA. Specialized multi-agent collaboration (search → read → write → critique) produces measurably higher-quality outputs." },
  { title: "Conclusion", body: "Agentic AI is maturing rapidly. The next 18 months will likely see widespread enterprise adoption driven by reliability improvements and cost reductions. Organizations that invest now in agent infrastructure and evaluation frameworks will hold significant competitive advantages as the technology commoditizes across verticals." },
];

const HISTORY_DATA: HistoryItem[] = [
  { id: 1, topic: "Future of Agentic AI", date: "Dec 18, 2024", score: 8.7, tags: ["AI", "Technology"], words: 1240 },
  { id: 2, topic: "Quantum Computing & Post-Quantum Cryptography", date: "Dec 17, 2024", score: 9.1, tags: ["Quantum", "Security"], words: 1580 },
  { id: 3, topic: "Climate Change Solutions in 2025", date: "Dec 15, 2024", score: 7.8, tags: ["Climate", "Energy"], words: 980 },
  { id: 4, topic: "CRISPR Gene Editing Ethics and Regulation", date: "Dec 12, 2024", score: 8.3, tags: ["Biology", "Ethics"], words: 1120 },
  { id: 5, topic: "Decentralized Finance Trends & Risks", date: "Dec 10, 2024", score: 7.2, tags: ["Finance", "Web3"], words: 890 },
  { id: 6, topic: "Nuclear Fusion Commercial Breakthroughs", date: "Dec 08, 2024", score: 9.4, tags: ["Energy", "Physics"], words: 1440 },
];

const ANALYTICS_DATA = [
  { month: "Jul", sessions: 12, score: 7.8, sources: 180 },
  { month: "Aug", sessions: 18, score: 8.1, sources: 264 },
  { month: "Sep", sessions: 24, score: 8.3, sources: 348 },
  { month: "Oct", sessions: 31, score: 8.5, sources: 442 },
  { month: "Nov", sessions: 28, score: 8.7, sources: 398 },
  { month: "Dec", sessions: 42, score: 8.9, sources: 618 },
];

const PIE_DATA = [
  { name: "Technology", value: 38 }, { name: "Science", value: 26 },
  { name: "Finance", value: 18 }, { name: "Health", value: 12 }, { name: "Other", value: 6 },
];
const PIE_COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#6366f1"];

const AGENT_LOGS: Record<string, { msg: string; type: "info" | "success" | "warn" }[]> = {
  search: [
    { msg: "Initializing Tavily search client...", type: "info" },
    { msg: 'Querying: topic with depth:advanced mode', type: "info" },
    { msg: "Fetching results from 6 search engines simultaneously...", type: "info" },
    { msg: "Found 24 relevant URLs across 12 unique domains", type: "info" },
    { msg: "Deduplicating and ranking by semantic relevance score...", type: "info" },
    { msg: "✓ Search complete — 18 high-quality sources selected", type: "success" },
  ],
  reader: [
    { msg: "Starting parallel URL scraping (18 sources)...", type: "info" },
    { msg: "Scraping arxiv.org/abs/2024.18291 [200 OK]", type: "info" },
    { msg: "Scraping openai.com/research/agents [200 OK]", type: "info" },
    { msg: "Scraping microsoft.com/research/autogen [200 OK]", type: "info" },
    { msg: "Extracting structured content with Trafilatura...", type: "info" },
    { msg: "✓ Reader complete — 42,800 tokens processed across 18 docs", type: "success" },
  ],
  writer: [
    { msg: "Loading 42.8k context tokens into prompt window...", type: "info" },
    { msg: "Generating Introduction section...", type: "info" },
    { msg: "Synthesizing Key Findings from 18 source documents...", type: "info" },
    { msg: "Writing Conclusion and actionable recommendations...", type: "info" },
    { msg: "Formatting citations in APA 7 style...", type: "info" },
    { msg: "✓ Draft complete — 420 words, 4 sections, 3 references", type: "success" },
  ],
  critic: [
    { msg: "Loading report draft for autonomous quality review...", type: "info" },
    { msg: "Evaluating factual accuracy against source corpus...", type: "info" },
    { msg: "Checking logical coherence and argument depth...", type: "info" },
    { msg: "Warning: Limited coverage of open-source alternatives", type: "warn" },
    { msg: "Scoring: accuracy 9.1, depth 8.4, clarity 8.8, sources 8.6", type: "info" },
    { msg: "✓ Review complete — overall quality score: 8.7 / 10", type: "success" },
  ],
};

const NAV_ITEMS = [
  { id: "dashboard" as Page, label: "Dashboard", icon: LayoutDashboard },
  { id: "history" as Page, label: "Research History", icon: History },
  { id: "saved" as Page, label: "Saved Reports", icon: Bookmark },
  { id: "analytics" as Page, label: "Analytics", icon: BarChart3 },
  { id: "settings" as Page, label: "Settings", icon: Settings },
];

const EXAMPLE_TOPICS = [
  "Future of Agentic AI", "Quantum Computing in 2025",
  "Climate Tech Breakthroughs", "Nuclear Fusion Progress",
];

// ──────────────────────────────────────────────────
// Utility helpers
// ──────────────────────────────────────────────────
function nowTime() {
  return new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function clsx(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ──────────────────────────────────────────────────
// Small shared components
// ──────────────────────────────────────────────────
function StatusBadge({ status }: { status: AgentStatus }) {
  const map: Record<AgentStatus, { cls: string; icon: React.ReactNode; label: string }> = {
    waiting: { cls: "bg-white/5 text-slate-400 border-white/10", icon: <Clock size={9} />, label: "waiting" },
    running: { cls: "bg-violet-500/15 text-violet-300 border-violet-500/25", icon: <Loader2 size={9} className="animate-spin" />, label: "running" },
    completed: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", icon: <CheckCircle2 size={9} />, label: "completed" },
    failed: { cls: "bg-red-500/15 text-red-400 border-red-500/25", icon: <XCircle size={9} />, label: "failed" },
  };
  const { cls, icon, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cls}`}>
      {icon} {label}
    </span>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className}`} />;
}

function GlassCard({ children, className, hover = true }: { children: React.ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={clsx(
      "relative rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm",
      hover && "transition-all duration-200 hover:border-white/14 hover:bg-white/5",
      className,
    )}>
      {children}
    </div>
  );
}

function ScoreRing({ score, max = 10, size = 88 }: { score: number; max?: number; size?: number }) {
  const pct = (score / max) * 100;
  const r = size / 2 - 7;
  const circ = 2 * Math.PI * r;
  const stroke = (pct / 100) * circ;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#rg)" strokeWidth={6}
        strokeDasharray={`${stroke} ${circ - stroke}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <defs>
        <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={size * 0.23} fontWeight="700" fontFamily="Inter,sans-serif">{score}</text>
      <text x="50%" y="64%" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.35)" fontSize={size * 0.13} fontFamily="Inter,sans-serif">/ {max}</text>
    </svg>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111127] border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-white/40 mb-1.5 font-mono">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: p.color }} />
          <span className="text-white/60">{p.name}</span>
          <span className="text-white font-semibold ml-auto pl-4">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────
// Pipeline Graph (top of dashboard)
// ──────────────────────────────────────────────────
function PipelineGraph({ agents, phase }: { agents: AgentState[]; phase: null | "running" | "completed" }) {
  const getNodeStatus = (nodeLabel: string): "idle" | "active" | "done" => {
    if (phase === null) return "idle";
    if (nodeLabel === "User Query") return "done";
    if (nodeLabel === "Final Report") return phase === "completed" ? "done" : "idle";
    const agent = agents.find((a) =>
      (nodeLabel === "Search Agent" && a.id === "search") ||
      (nodeLabel === "Reader Agent" && a.id === "reader") ||
      (nodeLabel === "Writer Agent" && a.id === "writer") ||
      (nodeLabel === "Critic Agent" && a.id === "critic")
    );
    if (!agent) return "idle";
    if (agent.status === "completed") return "done";
    if (agent.status === "running") return "active";
    return "idle";
  };

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
      {PIPELINE_NODES.map((node, i) => {
        const st = getNodeStatus(node.label);
        const Icon = node.icon;
        return (
          <div key={node.label} className="flex items-center shrink-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.07, type: "spring", stiffness: 300, damping: 24 }}
              className={clsx(
                "flex flex-col items-center gap-2 px-4 py-3 rounded-xl border transition-all duration-500 relative min-w-[100px]",
                st === "active" && "border-violet-500/50 shadow-[0_0_18px_rgba(139,92,246,0.18)]",
                st === "done" && "border-emerald-500/30",
                st === "idle" && "border-white/6",
              )}
              style={{
                background: st === "active"
                  ? "rgba(139,92,246,0.07)"
                  : st === "done"
                  ? "rgba(52,211,153,0.05)"
                  : "rgba(255,255,255,0.02)",
              }}
            >
              {st === "active" && (
                <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/8 to-transparent animate-[pipeline-shimmer_1.8s_ease-in-out_infinite]" />
                </div>
              )}
              <div
                className={clsx(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500",
                  st === "active" && "ring-1 ring-violet-500/40",
                  st === "done" && "ring-1 ring-emerald-500/30",
                )}
                style={{ background: `${node.color}14` }}
              >
                {st === "done"
                  ? <CheckCircle2 size={14} className="text-emerald-400" />
                  : st === "active"
                  ? <Loader2 size={14} className="animate-spin" style={{ color: node.color }} />
                  : <Icon size={14} style={{ color: node.color }} />
                }
              </div>
              <span className="text-[10px] font-medium text-center leading-tight" style={{ color: st === "idle" ? "rgba(255,255,255,0.3)" : st === "done" ? "#34d399" : node.color }}>
                {node.label}
              </span>
            </motion.div>
            {i < PIPELINE_NODES.length - 1 && (
              <div className="flex items-center gap-0 px-1">
                <div className={clsx("h-px w-5 transition-all duration-700", getNodeStatus(PIPELINE_NODES[i].label) === "done" ? "bg-emerald-500/40" : "bg-white/8")} />
                <ChevronRight size={10} className={clsx("transition-colors duration-700", getNodeStatus(PIPELINE_NODES[i].label) === "done" ? "text-emerald-500/50" : "text-white/15")} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────
// Agent Cards
// ──────────────────────────────────────────────────
function AgentGrid({ agents }: { agents: AgentState[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {agents.map((agent, i) => (
        <motion.div
          key={agent.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className={clsx(
            "relative p-4 rounded-2xl border transition-all duration-500 overflow-hidden",
            agent.status === "running" && "border-violet-500/40 shadow-[0_0_24px_rgba(139,92,246,0.12)]",
            agent.status === "completed" && "border-emerald-500/30",
            agent.status === "waiting" && "border-white/6",
          )}
          style={{
            background: agent.status === "running"
              ? "rgba(139,92,246,0.05)"
              : agent.status === "completed"
              ? "rgba(52,211,153,0.04)"
              : "rgba(255,255,255,0.02)",
          }}
        >
          {agent.status === "running" && (
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent animate-[border-scan_2s_ease-in-out_infinite]" />
          )}
          <div className="flex items-start justify-between mb-3">
            <span className="text-2xl">{agent.emoji}</span>
            <StatusBadge status={agent.status} />
          </div>
          <p className="text-sm font-semibold text-white/90 mb-0.5">{agent.name}</p>
          <p className="text-[11px] text-white/40 mb-3 leading-snug">{agent.tagline}</p>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-[10px] text-white/30 font-mono">Progress</span>
              <span className="text-[10px] text-white/50 font-mono">{agent.progress}%</span>
            </div>
            <div className="h-1 rounded-full bg-white/6 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${agent.progress}%` }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                style={{
                  background: agent.status === "completed"
                    ? "linear-gradient(90deg, #34d399, #10b981)"
                    : "linear-gradient(90deg, #8b5cf6, #06b6d4)",
                }}
              />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────
// Live Log Panel
// ──────────────────────────────────────────────────
function LivePanel({ logs, running }: { logs: LogEntry[]; running: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs]);

  const typeColor: Record<string, string> = {
    info: "text-white/50",
    success: "text-emerald-400",
    warn: "text-amber-400",
  };

  return (
    <GlassCard className="overflow-hidden" hover={false}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
          </div>
          <span className="text-[11px] font-mono text-white/30">agent.log</span>
        </div>
        {running && (
          <span className="flex items-center gap-1.5 text-[11px] text-violet-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            LIVE
          </span>
        )}
      </div>
      <div
        ref={ref}
        className="h-48 overflow-y-auto p-3 space-y-1.5 font-mono text-[11px]"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
      >
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-white/20">
            <BarChart2 size={24} />
            <span>Start a research session to see live agent activity</span>
          </div>
        ) : (
          logs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-2"
            >
              <span className="text-white/20 shrink-0 tabular-nums">{log.ts}</span>
              <span className="shrink-0">{log.emoji}</span>
              <span className="text-violet-400 shrink-0">[{log.agent}]</span>
              <span className={clsx("flex-1", typeColor[log.type])}>{log.message}</span>
            </motion.div>
          ))
        )}
      </div>
    </GlassCard>
  );
}

// ──────────────────────────────────────────────────
// Results Tabs
// ──────────────────────────────────────────────────
function ReportTab({ apiData, apiError, topic }: { apiData: ApiResult | null; apiError: string | null; topic: string }) {
  const [copying, setCopying] = useState(false);
  const reportText = apiData?.report || null;
  function copyReport() {
    setCopying(true);
    const text = reportText || REPORT_SECTIONS.map((s) => `## ${s.title}\n\n${s.body}`).join("\n\n");
    navigator.clipboard.writeText(text).catch(() => {});
    toast.success("Report copied to clipboard");
    setTimeout(() => setCopying(false), 1200);
  }
  if (apiError) {
    return (
      <GlassCard className="p-6 text-center" hover={false}>
        <AlertTriangle size={20} className="text-amber-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-white/80 mb-1">Couldn't reach the backend</p>
        <p className="text-xs text-white/40">{apiError}</p>
      </GlassCard>
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">{apiData?.topic || topic}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-white/40">{reportText ? "Generated just now" : "Generated Dec 18, 2024"}</span>
            {!reportText && <span className="flex items-center gap-1 text-xs text-amber-400"><Star size={10} fill="currentColor" /> 8.7 / 10</span>}
            {reportText && <span className="text-xs text-white/30">{reportText.split(/\s+/).length} words</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={copyReport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white hover:border-white/20 transition-all">
            {copying ? <CheckCircle2 size={11} className="text-emerald-400" /> : <Copy size={11} />} Copy
          </button>
          <button onClick={() => toast.success("Exporting Markdown...")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white hover:border-white/20 transition-all">
            <Download size={11} /> Markdown
          </button>
          <button onClick={() => toast.success("Exporting PDF...")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white hover:border-white/20 transition-all">
            <FileText size={11} /> PDF
          </button>
          <button onClick={() => toast.success("Share link copied!")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 transition-colors">
            <Share2 size={11} /> Share
          </button>
        </div>
      </div>
      {reportText ? (
        <GlassCard className="p-5" hover={false}>
          <p className="text-sm text-white/55 leading-relaxed whitespace-pre-wrap">{reportText}</p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {REPORT_SECTIONS.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <GlassCard className="p-5" hover={false}>
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-violet-500/15 flex items-center justify-center text-[10px] text-violet-400 font-bold">{i + 1}</span>
                  {s.title}
                </h3>
                <p className="text-sm text-white/55 leading-relaxed">{s.body}</p>
              </GlassCard>
            </motion.div>
          ))}
          <GlassCard className="p-5" hover={false}>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-violet-500/15 flex items-center justify-center text-[10px] text-violet-400 font-bold">4</span>
              References
            </h3>
            <ol className="space-y-1.5 list-decimal list-inside text-xs text-white/40 font-mono">
              <li>AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation (Microsoft Research, 2024)</li>
              <li>LangGraph: Building Stateful Multi-Actor Applications (LangChain, 2024)</li>
              <li>GAIA: A Benchmark for General AI Assistants (Hugging Face, 2024)</li>
            </ol>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

function SourcesTab({ apiData }: { apiData: ApiResult | null }) {
  const realSources = apiData ? parseSources(apiData.search_result) : [];
  const usingReal = realSources.length > 0;
  const sources = usingReal ? realSources : MOCK_SOURCES;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/40">{sources.length} sources retrieved</p>
        {!usingReal && <span className="text-xs font-mono text-white/30">avg credibility 8.6 / 10</span>}
      </div>
      {usingReal ? (
        realSources.map((src, i) => (
          <motion.div key={src.url || i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <GlassCard className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                  <Globe size={14} className="text-white/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[11px] font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{src.domain || "source"}</span>
                  </div>
                  <p className="text-sm font-semibold text-white/85 mb-1.5">{src.title}</p>
                  <p className="text-xs text-white/40 leading-relaxed">{src.snippet}</p>
                  {src.url && (
                    <div className="mt-3 flex items-center gap-2">
                      <a href={src.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition-colors">
                        <ExternalLink size={10} /> Open
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))
      ) : (
        MOCK_SOURCES.map((src, i) => (
        <motion.div key={src.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
          <GlassCard className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                <Globe size={14} className="text-white/30" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[11px] font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{src.domain}</span>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} size={8} className={j < Math.round(src.credibility / 2) ? "text-amber-400" : "text-white/10"} fill={j < Math.round(src.credibility / 2) ? "currentColor" : "none"} />
                    ))}
                    <span className="text-[10px] text-amber-400 ml-0.5">{src.credibility}</span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-white/85 mb-1.5">{src.title}</p>
                <p className="text-xs text-white/40 leading-relaxed">{src.summary}</p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-0.5 rounded-full bg-white/6">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${src.credibility * 10}%` }} />
                  </div>
                  <a href="#" onClick={(e) => { e.preventDefault(); toast.info("Opening source..."); }} className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition-colors">
                    <ExternalLink size={10} /> Open
                  </a>
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>
        ))
      )}
    </div>
  );
}

function CriticTab({ apiData }: { apiData: ApiResult | null }) {
  const feedbackText = apiData?.feedback || null;
  if (feedbackText) {
    const scoreMatch = feedbackText.match(/Score:\s*([\d.]+)\s*\/\s*10/i);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : null;
    return (
      <div className="space-y-5">
        {score !== null && (
          <GlassCard className="flex flex-col items-center justify-center p-6" hover={false}>
            <ScoreRing score={score} />
            <p className="text-sm font-semibold text-white/80 mt-3">Critic Score</p>
          </GlassCard>
        )}
        <GlassCard className="p-5" hover={false}>
          <p className="text-sm text-white/55 leading-relaxed whitespace-pre-wrap font-mono">{feedbackText}</p>
        </GlassCard>
      </div>
    );
  }
  const metrics = [
    { label: "Accuracy", score: 9.1, icon: "🎯" },
    { label: "Depth", score: 8.4, icon: "🔬" },
    { label: "Clarity", score: 8.8, icon: "✨" },
    { label: "Sources", score: 8.6, icon: "📚" },
  ];
  const strengths = ["Comprehensive coverage of major agentic frameworks", "Strong quantitative benchmarks (GAIA +34%)", "Balanced perspective on production challenges", "Clear actionable conclusions for enterprise teams"];
  const weaknesses = ["Limited coverage of open-source alternatives", "Could include more concrete implementation examples", "Missing SMB cost-benefit analysis"];
  const suggestions = ["Add a framework capability comparison table", "Include a risk assessment framework section", "Incorporate NeurIPS 2024 proceedings"];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="flex flex-col items-center justify-center p-6" hover={false}>
          <ScoreRing score={8.7} />
          <p className="text-sm font-semibold text-white/80 mt-3">Overall Quality</p>
          <p className="text-xs text-emerald-400 mt-0.5">Excellent</p>
        </GlassCard>
        <div className="sm:col-span-2 grid grid-cols-2 gap-3">
          {metrics.map((m) => (
            <GlassCard key={m.label} className="p-4" hover={false}>
              <div className="flex items-center justify-between mb-2">
                <span>{m.icon}</span>
                <span className="text-sm font-bold text-white">{m.score}</span>
              </div>
              <p className="text-xs font-medium text-white/40 mb-2">{m.label}</p>
              <div className="h-1 rounded-full bg-white/6 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-700" style={{ width: `${m.score * 10}%` }} />
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { title: "Strengths", items: strengths, color: "emerald", icon: <CheckCircle2 size={11} /> },
          { title: "Weaknesses", items: weaknesses, color: "amber", icon: <AlertTriangle size={11} /> },
          { title: "Suggestions", items: suggestions, color: "cyan", icon: <Zap size={11} /> },
        ].map(({ title, items, color, icon }) => (
          <div key={title} className={`p-4 rounded-2xl border border-${color}-500/15 bg-${color}-500/5`}>
            <p className={`text-xs font-semibold text-${color}-400 uppercase tracking-wider mb-3 flex items-center gap-1.5`}>
              {icon} {title}
            </p>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-xs text-white/60">
                  <span className={`text-${color}-400 shrink-0 mt-0.5`}>·</span> {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function RawTab({ apiData }: { apiData: ApiResult | null }) {
  const raw = apiData || {
    query: "Future of Agentic AI", timestamp: "2024-12-18T14:32:11Z",
    duration_seconds: 28.4,
    agents: {
      search: { status: "completed", urls_found: 24, time_ms: 2100 },
      reader: { status: "completed", urls_scraped: 18, tokens: 42800, time_ms: 8200 },
      writer: { status: "completed", draft_tokens: 1240, time_ms: 12400 },
      critic: { status: "completed", score: 8.7, revision_cycles: 2, time_ms: 5700 },
    },
    quality: { overall: 8.7, accuracy: 9.1, depth: 8.4, clarity: 8.8, sources: 8.6 },
    sources_count: 4, report_words: 420,
  };
  return (
    <GlassCard className="overflow-hidden" hover={false}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/6">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
        </div>
        <span className="text-[11px] font-mono text-white/30 ml-1">research_output.json</span>
        <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(raw, null, 2)).catch(() => {}); toast.success("JSON copied"); }} className="ml-auto text-[11px] text-white/30 hover:text-white/60 transition-colors flex items-center gap-1">
          <Copy size={10} /> copy
        </button>
      </div>
      <pre className="p-4 text-[11px] font-mono text-white/40 overflow-auto max-h-80 leading-relaxed" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
        <span className="text-violet-400">{"{"}</span>{"\n"}
        {Object.entries(raw).map(([k, v]) => (
          `  "${k}": ${JSON.stringify(v, null, 2).split("\n").join("\n  ")}`
        )).join(",\n")}
        {"\n"}<span className="text-violet-400">{"}"}</span>
      </pre>
    </GlassCard>
  );
}

// ──────────────────────────────────────────────────
// Dashboard Page
// ──────────────────────────────────────────────────
function DashboardPage({
  topic, setTopic, onStart, agents, logs, phase, tab, setTab, apiData, apiError,
}: {
  topic: string; setTopic: (v: string) => void; onStart: () => void;
  agents: AgentState[]; logs: LogEntry[]; phase: null | "running" | "completed";
  tab: ResearchTab; setTab: (t: ResearchTab) => void;
  apiData: ApiResult | null; apiError: string | null;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="space-y-6">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-white/8 p-7" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(6,182,212,0.03) 100%)" }}>
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)" }} />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 70%)" }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-violet-500/25 bg-violet-500/10 text-violet-300 text-[11px] font-medium">
              <Sparkles size={10} /> Multi-Agent System v2.4
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-2">
            Multi-Agent AI<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-300 to-cyan-400">Research System</span>
          </h1>
          <p className="text-sm text-white/40 mb-7 max-w-md leading-relaxed">
            Research, Analyze, Critique, and Generate Professional Reports using Autonomous AI Agents working in concert.
          </p>

          {/* Input */}
          <div className="flex flex-col sm:flex-row gap-2 max-w-2xl">
            <div className={clsx("flex-1 relative rounded-xl border transition-all duration-200", focused ? "border-violet-500/60 shadow-[0_0_0_3px_rgba(139,92,246,0.12)]" : "border-white/10")}>
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => e.key === "Enter" && topic.trim() && onStart()}
                placeholder="Enter research topic..."
                className="w-full pl-9 pr-4 py-2.5 bg-white/4 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none"
              />
            </div>
            <button
              onClick={onStart}
              disabled={!topic.trim() || phase === "running"}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)", boxShadow: "0 4px 24px rgba(124,58,237,0.3)" }}
            >
              {phase === "running" ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {phase === "running" ? "Researching..." : "Start Research"}
            </button>
          </div>

          {/* Quick topics */}
          <div className="flex flex-wrap gap-2 mt-4">
            {EXAMPLE_TOPICS.map((t) => (
              <button key={t} onClick={() => setTopic(t)} className="text-[11px] px-2.5 py-1 rounded-lg border border-white/8 text-white/30 hover:text-white/60 hover:border-white/16 transition-all">
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline graph */}
      <GlassCard className="p-5" hover={false}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">Agent Pipeline</p>
          {phase === "running" && <span className="text-xs text-violet-400 animate-pulse">Processing...</span>}
          {phase === "completed" && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 size={11} /> Complete</span>}
        </div>
        <PipelineGraph agents={agents} phase={phase} />
      </GlassCard>

      {/* Agent grid */}
      <div>
        <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">Agent Status</p>
        <AgentGrid agents={agents} />
      </div>

      {/* Live log */}
      <div>
        <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">Live Activity</p>
        <LivePanel logs={logs} running={phase === "running"} />
      </div>

      {/* Results */}
      {phase === "completed" && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 22 }} className="space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">Research Results</p>
            <div className="flex-1 h-px bg-white/6" />
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1"><CheckCircle2 size={11} /> Ready</span>
          </div>
          <div className="border-b border-white/6">
            <div className="flex gap-0 -mb-px">
              {(["report", "sources", "critic", "raw"] as ResearchTab[]).map((t) => {
                const labels: Record<ResearchTab, string> = { report: "Report", sources: "Sources", critic: "Critic Review", raw: "Raw Data" };
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={clsx(
                      "px-4 py-2.5 text-xs font-medium border-b-2 transition-all",
                      tab === t ? "border-violet-500 text-white" : "border-transparent text-white/30 hover:text-white/60",
                    )}
                  >
                    {labels[t]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="pt-1">
            {tab === "report" && <ReportTab apiData={apiData} apiError={apiError} topic={topic} />}
            {tab === "sources" && <SourcesTab apiData={apiData} />}
            {tab === "critic" && <CriticTab apiData={apiData} />}
            {tab === "raw" && <RawTab apiData={apiData} />}
          </div>
        </motion.div>
      )}

      {/* Empty state (no research yet) */}
      {phase === null && (
        <GlassCard className="py-14 flex flex-col items-center justify-center text-center" hover={false}>
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4 border border-violet-500/20">
            <Sparkles size={22} className="text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-white/60 mb-1">No research yet</p>
          <p className="text-xs text-white/25 max-w-xs">Enter a topic above and click Start Research to deploy your AI agent team.</p>
        </GlassCard>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────
// Analytics Page
// ──────────────────────────────────────────────────
function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Analytics</h2>
        <p className="text-xs text-white/30 mt-0.5">Research performance — last 6 months</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Sessions", value: "155", delta: "+12%", icon: Database, color: "#8b5cf6" },
          { label: "Avg Report Score", value: "8.6", delta: "+0.3", icon: Award, color: "#fbbf24" },
          { label: "Sources Analyzed", value: "2,840", delta: "+18%", icon: Globe, color: "#06b6d4" },
          { label: "Agent Success Rate", value: "94.8%", delta: "+1.2%", icon: Zap, color: "#34d399" },
        ].map((stat) => (
          <GlassCard key={stat.label} className="p-4" hover={false}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}14` }}>
                <stat.icon size={15} style={{ color: stat.color }} />
              </div>
              <span className="text-xs text-emerald-400 font-medium">{stat.delta}</span>
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-[11px] text-white/35 mt-0.5">{stat.label}</p>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard className="p-5" hover={false}>
          <p className="text-xs font-semibold text-white/50 mb-4">Monthly Research Sessions</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={ANALYTICS_DATA} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id="gSess" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="sessions" name="Sessions" stroke="#8b5cf6" strokeWidth={2} fill="url(#gSess)" />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-5" hover={false}>
          <p className="text-xs font-semibold text-white/50 mb-4">Average Quality Score</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={ANALYTICS_DATA} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} />
              <YAxis domain={[7, 10]} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="score" name="Score" stroke="#06b6d4" strokeWidth={2} dot={{ fill: "#06b6d4", r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-5" hover={false}>
          <p className="text-xs font-semibold text-white/50 mb-4">Agent Success Rates (%)</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={[
              { name: "Search", rate: 98 }, { name: "Reader", rate: 94 },
              { name: "Writer", rate: 91 }, { name: "Critic", rate: 96 },
            ]} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} />
              <YAxis domain={[85, 100]} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="rate" name="Success %" radius={[4, 4, 0, 0]}>
                {[0, 1, 2, 3].map((i) => <Cell key={i} fill={["#8b5cf6", "#6366f1", "#60a5fa", "#34d399"][i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-5" hover={false}>
          <p className="text-xs font-semibold text-white/50 mb-4">Topics by Category</p>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="value" strokeWidth={0}>
                  {PIE_DATA.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {PIE_DATA.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-[11px]">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-white/40 flex-1">{d.name}</span>
                  <span className="text-white/70 font-medium">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────
// History Page
// ──────────────────────────────────────────────────
function HistoryPage({ onNew }: { onNew: () => void }) {
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "score">("date");
  const filtered = HISTORY_DATA
    .filter((h) => h.topic.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sortBy === "score" ? b.score - a.score : b.id - a.id);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Research History</h2>
          <p className="text-xs text-white/30 mt-0.5">{HISTORY_DATA.length} sessions total</p>
        </div>
        <button onClick={onNew} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all" style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}>
          <Plus size={13} /> New Research
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reports..." className="w-full pl-9 pr-4 py-2 rounded-lg border border-white/8 bg-white/4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/40 transition-all" />
        </div>
        <div className="relative">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "date" | "score")} className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-white/8 bg-white/4 text-xs text-white/50 focus:outline-none cursor-pointer">
            <option value="date">Sort: Date</option>
            <option value="score">Sort: Score</option>
          </select>
          <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <GlassCard className="py-12 flex flex-col items-center gap-3" hover={false}>
            <Search size={28} className="text-white/15" />
            <p className="text-sm text-white/30">No matching research found</p>
          </GlassCard>
        ) : filtered.map((item, i) => (
          <motion.div key={item.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <GlassCard className="flex items-center gap-4 p-4 group">
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center shrink-0">
                <FileText size={14} className="text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white/85 truncate">{item.topic}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[11px] text-white/30">{item.date}</span>
                  <span className="text-[11px] text-white/25">·</span>
                  <span className="text-[11px] text-white/30">{item.words.toLocaleString()} words</span>
                  {item.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Star size={11} fill="currentColor" className="text-amber-400" />
                <span className="text-sm font-bold text-white">{item.score}</span>
              </div>
              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => toast.success("Opening report...")} className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-violet-300 border border-violet-500/25 hover:bg-violet-500/10 transition-colors">
                  View
                </button>
                <button onClick={() => toast.success("Exporting PDF...")} className="px-2.5 py-1.5 rounded-lg border border-white/8 text-white/30 hover:text-white/60 transition-colors">
                  <Download size={11} />
                </button>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────
// Saved Page
// ──────────────────────────────────────────────────
function SavedPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Saved Reports</h2>
        <p className="text-xs text-white/30 mt-0.5">Bookmarked for reference</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {HISTORY_DATA.slice(0, 4).map((item) => (
          <GlassCard key={item.id} className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/15">
                <Bookmark size={13} className="text-violet-400" fill="currentColor" />
              </div>
              <div className="flex items-center gap-1">
                <Star size={10} fill="currentColor" className="text-amber-400" />
                <span className="text-sm font-bold text-white">{item.score}</span>
              </div>
            </div>
            <p className="text-sm font-semibold text-white/85 mb-1 leading-snug">{item.topic}</p>
            <p className="text-[11px] text-white/30 mb-4">{item.date} · {item.words.toLocaleString()} words</p>
            <div className="flex gap-2">
              <button onClick={() => toast.success("Opening...")} className="flex-1 py-1.5 rounded-lg text-[11px] font-medium text-center bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors border border-violet-500/15">
                View Report
              </button>
              <button onClick={() => toast.success("Exporting PDF...")} className="px-3 py-1.5 rounded-lg border border-white/8 text-white/30 hover:text-white/60 transition-colors">
                <Download size={11} />
              </button>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────
// Settings Page
// ──────────────────────────────────────────────────
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`relative w-9 rounded-full transition-colors duration-200 ${on ? "bg-violet-600" : "bg-white/10"}`} style={{ height: 20 }}>
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

function SettingsPage() {
  const [notifs, setNotifs] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [streaming, setStreaming] = useState(true);
  const [model, setModel] = useState("claude-sonnet-4-6");

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h2 className="text-xl font-bold text-white">Settings</h2>
        <p className="text-xs text-white/30 mt-0.5">Configure your research preferences</p>
      </div>

      {[
        {
          title: "AI Model",
          rows: [
            {
              label: "Language Model", desc: "Used for writing and critique agents",
              ctrl: (
                <div className="relative">
                  <select value={model} onChange={(e) => setModel(e.target.value)} className="appearance-none pl-3 pr-7 py-1.5 rounded-lg border border-white/8 bg-white/4 text-xs text-white/60 focus:outline-none cursor-pointer">
                    <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                    <option value="claude-opus-4-8">Claude Opus 4.8</option>
                    <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
                  </select>
                  <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                </div>
              ),
            },
          ],
        },
        {
          title: "Behavior",
          rows: [
            { label: "Email Notifications", desc: "Notify when research completes", ctrl: <Toggle on={notifs} onToggle={() => setNotifs(!notifs)} /> },
            { label: "Auto-Save Reports", desc: "Automatically save to history", ctrl: <Toggle on={autoSave} onToggle={() => setAutoSave(!autoSave)} /> },
            { label: "Live Log Streaming", desc: "Stream agent logs in real time", ctrl: <Toggle on={streaming} onToggle={() => setStreaming(!streaming)} /> },
          ],
        },
      ].map((section) => (
        <GlassCard key={section.title} className="overflow-hidden" hover={false}>
          <div className="px-5 py-3 border-b border-white/6">
            <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest">{section.title}</p>
          </div>
          <div className="divide-y divide-white/5">
            {section.rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-white/75">{row.label}</p>
                  <p className="text-[11px] text-white/30 mt-0.5">{row.desc}</p>
                </div>
                {row.ctrl}
              </div>
            ))}
          </div>
        </GlassCard>
      ))}

      <button onClick={() => toast.success("Settings saved")} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all" style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}>
        Save Changes
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────
// font-bold shrink-0">P
// ──────────────────────────────────────────────────
function Sidebar({ page, setPage, collapsed, setCollapsed, mobile, onClose }: {
  page: Page; setPage: (p: Page) => void;
  collapsed: boolean; setCollapsed: (v: boolean) => void;
  mobile?: boolean; onClose?: () => void;
}) {
  function nav(p: Page) { setPage(p); onClose?.(); }
  return (
    <aside
      className={clsx(
        "flex flex-col h-full border-r border-white/6 transition-all duration-300",
        !mobile && (collapsed ? "w-14" : "w-52"),
        mobile && "w-64",
      )}
      style={{ background: "rgba(8,8,20,0.97)" }}
    >
      {/* Logo */}
      <div className={clsx("flex items-center h-14 px-3 border-b border-white/6 gap-2.5 shrink-0", !mobile && collapsed && "justify-center")}>
        <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)" }}>
          <Sparkles size={13} className="text-white" />
        </div>
        {(mobile || !collapsed) && <span className="text-sm font-bold text-white tracking-tight">ResearchAI</span>}
        {mobile && onClose && (
          <button onClick={onClose} className="ml-auto text-white/30 hover:text-white/60 transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      {/* New Research */}
      <div className="px-2 py-3 border-b border-white/6 shrink-0">
        <button
          onClick={() => nav("dashboard")}
          className={clsx("flex items-center gap-2 w-full rounded-xl py-2 text-sm font-medium text-violet-300 border border-violet-500/20 bg-violet-500/8 hover:bg-violet-500/15 transition-all", !mobile && collapsed ? "justify-center px-0" : "px-3")}
        >
          <Plus size={14} />
          {(mobile || !collapsed) && "New Research"}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {NAV_ITEMS.map((item) => {
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => nav(item.id)}
              className={clsx(
                "flex items-center gap-2.5 w-full rounded-xl text-sm transition-all py-2 group",
                !mobile && collapsed ? "justify-center px-0" : "px-3",
                active ? "bg-white/8 text-white" : "text-white/35 hover:text-white/65 hover:bg-white/4",
              )}
            >
              <item.icon size={14} className={active ? "text-violet-400" : ""} />
              {(mobile || !collapsed) && item.label}
            </button>
          );
        })}
      </nav>

      {/* User */}
      {(mobile || !collapsed) && (
        <div className="px-3 py-3 border-t border-white/6 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-cyan-400 flex items-center justify-center text-white text-xs font-bold shrink-0">P</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white/70 truncate">Prateek</p>
              <p className="text-[10px] text-white/25 truncate">Free plan</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapse */}
      {!mobile && (
        <div className="px-2 pb-3 shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={clsx("flex items-center gap-2 w-full rounded-xl py-2 text-white/25 hover:text-white/50 hover:bg-white/4 transition-all", collapsed ? "justify-center px-0" : "px-3")}
          >
            {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span className="text-xs">Collapse</span></>}
          </button>
        </div>
      )}
    </aside>
  );
}

// ──────────────────────────────────────────────────
// TopNav
// ──────────────────────────────────────────────────
function TopNav({ darkMode, setDarkMode, onMenuOpen }: { darkMode: boolean; setDarkMode: (v: boolean) => void; onMenuOpen: () => void }) {
  return (
    <header className="fixed top-0 inset-x-0 z-20 h-14 flex items-center gap-3 border-b border-white/6 px-4" style={{ background: "rgba(8,8,20,0.85)", backdropFilter: "blur(16px)" }}>
      <button onClick={onMenuOpen} className="lg:hidden text-white/30 hover:text-white/60 transition-colors mr-1">
        <Menu size={18} />
      </button>
      <div className="flex-1">
        <div className="relative max-w-xs hidden sm:block">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
          <input
            placeholder="Search research..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-white/8 bg-white/4 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/30 transition-all"
            onFocus={() => toast.info("Search: ⌘K to open command palette")}
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/20 font-mono">⌘K</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => toast.info("No new notifications")} className="relative w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all">
          <Bell size={14} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-violet-500" />
        </button>
        <button onClick={() => setDarkMode(!darkMode)} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all">
          {darkMode ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-cyan-400 flex items-center justify-center text-white text-xs font-bold cursor-pointer ml-1">P</div>
      </div>
    </header>
  );
}

// ──────────────────────────────────────────────────
// Root App
// ──────────────────────────────────────────────────
export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [page, setPage] = useState<Page>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [topic, setTopic] = useState("Future of Agentic AI");
  const [phase, setPhase] = useState<null | "running" | "completed">(null);
  const [agents, setAgents] = useState<AgentState[]>(INITIAL_AGENTS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tab, setTab] = useState<ResearchTab>("report");
  const [apiData, setApiData] = useState<ApiResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const logIdRef = useRef(0);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toast.info("Command palette coming soon", { description: "⌘K shortcut detected" });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const pushLog = useCallback((emoji: string, agent: string, message: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { id: logIdRef.current++, emoji, agent, message, ts: nowTime(), type }]);
  }, []);

  const runAgent = useCallback((idx: number, onDone: () => void) => {
    const agentDefs = INITIAL_AGENTS;
    const agent = agentDefs[idx];
    const logLines = AGENT_LOGS[agent.id] || [];
    let lineIdx = 0;

    setAgents((prev) => prev.map((a, i) => i === idx ? { ...a, status: "running", progress: 0 } : a));
    pushLog(agent.emoji, agent.name, logLines[0]?.msg || "Starting...", logLines[0]?.type || "info");
    lineIdx = 1;

    const iv = setInterval(() => {
      setAgents((prev) => prev.map((a, i) => {
        if (i !== idx) return a;
        return { ...a, progress: Math.min(a.progress + Math.floor(Math.random() * 18 + 10), 92) };
      }));
      if (lineIdx < logLines.length) {
        pushLog(agent.emoji, agent.name, logLines[lineIdx].msg, logLines[lineIdx].type);
        lineIdx++;
      }
    }, 520);

    setTimeout(() => {
      clearInterval(iv);
      setAgents((prev) => prev.map((a, i) => i === idx ? { ...a, status: "completed", progress: 100 } : a));
      onDone();
    }, 3200);
  }, [pushLog]);

  const startResearch = useCallback(() => {
    if (!topic.trim() || phase === "running") return;
    setPhase("running");
    setAgents(INITIAL_AGENTS.map((a) => ({ ...a, status: "waiting", progress: 0 })));
    setLogs([]);
    setTab("report");
    setApiData(null);
    setApiError(null);
    toast.success("Research started", { description: `"${topic}" — deploying agent team` });

    // Kick off the real backend call right away. The visual agent
    // animation below is purely cosmetic — it plays out at a fixed pace
    // for UX, but the dashboard won't flip to "completed" until this
    // real request actually finishes, however long that takes.
    const fetchPromise = fetch(`${API_BASE_URL}/api/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Backend returned status ${res.status}`);
      }
      return res.json() as Promise<ApiResult>;
    });

    function chain(idx: number) {
      if (idx >= INITIAL_AGENTS.length) {
        fetchPromise
          .then((data) => {
            setApiData(data);
            setPhase("completed");
            toast.success("Research complete!", { description: "Your report is ready to view." });
          })
          .catch((err: Error) => {
            setApiError(err.message || "Could not reach the backend. Is it running on localhost:8000?");
            setPhase("completed");
            toast.error("Research failed", { description: err.message || "Backend request failed." });
          });
        return;
      }
      runAgent(idx, () => setTimeout(() => chain(idx + 1), 300));
    }
    setTimeout(() => chain(0), 500);
  }, [topic, phase, runAgent]);

  const sidebarW = collapsed ? 56 : 208;

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "Inter, sans-serif" }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#111127",
            color: "#e4e2f0",
            border: "1px solid rgba(255,255,255,0.08)",
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
            borderRadius: "12px",
          },
        }}
      />

      {/* Desktop sidebar */}
      <div className={`fixed left-0 top-0 h-full z-30 hidden lg:flex transition-all duration-300`} style={{ width: sidebarW }}>
        <Sidebar page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full z-50">
            <Sidebar page={page} setPage={setPage} collapsed={false} setCollapsed={() => {}} mobile onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-col min-h-screen transition-all duration-300" style={{ paddingLeft: typeof window !== "undefined" && window.innerWidth >= 1024 ? sidebarW : 0 }}>
        <div className="lg:hidden" style={{ height: 0 }} />
        <div className="hidden lg:block" style={{ height: 0 }} />

        <TopNav darkMode={darkMode} setDarkMode={setDarkMode} onMenuOpen={() => setMobileOpen(true)} />

        <main className="flex-1 pt-14 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
            {page === "dashboard" && (
              <DashboardPage
                topic={topic} setTopic={setTopic} onStart={startResearch}
                agents={agents} logs={logs} phase={phase} tab={tab} setTab={setTab}
                apiData={apiData} apiError={apiError}
              />
            )}
            {page === "history" && <HistoryPage onNew={() => setPage("dashboard")} />}
            {page === "saved" && <SavedPage />}
            {page === "analytics" && <AnalyticsPage />}
            {page === "settings" && <SettingsPage />}
          </div>
        </main>
      </div>

      {/* Dynamic sidebar padding for desktop */}
      <style>{`
        @media (min-width: 1024px) {
          main { padding-left: 0; }
        }
        @keyframes pipeline-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes border-scan {
          0%, 100% { opacity: 0; transform: translateX(-100%); }
          50% { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}