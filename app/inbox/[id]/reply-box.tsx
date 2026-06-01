"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";

export function ReplyBox({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [text, setText]   = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const res = await fetch("/api/inbox/reply", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tenantId, body }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null) as { error?: string } | null;
        toast.error(d?.error || "Failed to send");
        return;
      }
      setText("");
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="shrink-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 px-3 py-2 flex items-end gap-2">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          // Cmd/Ctrl+Enter sends; plain Enter inserts a newline (matches most chat apps).
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
        }}
        placeholder="Type a reply…"
        rows={1}
        className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none max-h-32"
        style={{ fieldSizing: "content" } as React.CSSProperties}
      />
      <button
        onClick={send}
        disabled={sending || !text.trim()}
        aria-label="Send"
        className="shrink-0 w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-[transform,background-color,opacity] duration-150"
      >
        {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
      </button>
    </div>
  );
}
