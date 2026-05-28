import { FileText } from "lucide-react";

// Three micro-product demos used on the welcome carousel. Pure CSS keyframes
// (declared in globals.css) so they run off the main thread and stay smooth
// on cheap phones. Each is sized for a ~280px-wide column on mobile.

const CARD = "w-full max-w-[280px] mx-auto bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-700/60 shadow-xl shadow-slate-200/40 dark:shadow-black/40 overflow-hidden welcome-pop";

/* ─── Slide 1: Mini ledger — rows flip from Pending → ✓ Paid ────────────── */

export function LedgerDemo() {
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Payment Ledger</span>
        <span className="text-[10px] text-slate-400">3 months</span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        <LedgerRow month="May/Jun 2026" amount="रू6,100" flipClass="demo1-row1" />
        <LedgerRow month="Apr/May 2026" amount="रू6,100" flipClass="demo1-row2" />
        <LedgerRow month="Mar/Apr 2026" amount="रू6,100" alreadyPaid />
      </div>
    </div>
  );
}

function LedgerRow({ month, amount, flipClass, alreadyPaid }: { month: string; amount: string; flipClass?: string; alreadyPaid?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 leading-tight">{month}</span>
        <span className="text-[10px] text-slate-400">{amount}</span>
      </div>
      {alreadyPaid ? (
        <PaidBadge />
      ) : (
        <div className="relative w-[58px] h-[18px]">
          <span className={`demo1-pending-out ${flipClass} absolute inset-0 flex items-center justify-center rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400`}>
            Pending
          </span>
          <span className={`demo1-paid-in ${flipClass} absolute inset-0 flex items-center justify-center rounded-full text-[9px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400`}>
            ✓ Paid
          </span>
        </div>
      )}
    </div>
  );
}

function PaidBadge() {
  return (
    <span className="flex items-center justify-center w-[58px] h-[18px] rounded-full text-[9px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
      ✓ Paid
    </span>
  );
}

/* ─── Slide 2: WhatsApp chat — typing dots → "Payment received" bubble ───── */

export function ChatDemo() {
  return (
    <div className={CARD}>
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-[10px] font-black shadow-sm">T</div>
        <div className="leading-tight">
          <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">Your tenant</p>
          <p className="text-[9px] text-emerald-500 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-emerald-500" /> online
          </p>
        </div>
      </div>
      <div className="px-3 py-4 min-h-[112px] flex items-end justify-end relative">
        {/* Typing bubble — visible early in the loop */}
        <div className="demo2-typing absolute right-3 bottom-4 rounded-2xl rounded-br-md bg-emerald-500 text-white px-3 py-2 flex items-center gap-1">
          <span className="demo2-dot block w-1.5 h-1.5 rounded-full bg-white/90" />
          <span className="demo2-dot demo2-dot-2 block w-1.5 h-1.5 rounded-full bg-white/90" />
          <span className="demo2-dot demo2-dot-3 block w-1.5 h-1.5 rounded-full bg-white/90" />
        </div>
        {/* Sent message — slides in after */}
        <div className="demo2-message rounded-2xl rounded-br-md bg-emerald-500 text-white px-3 py-2 text-[10.5px] leading-snug font-medium max-w-[200px] shadow-sm">
          ✓ Payment received: रू6,100 for <span className="font-bold">May/Jun 2026</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Slide 3: Receipt — tap pulse on button → receipt slides up ─────────── */

export function ReceiptDemo() {
  return (
    <div className={`${CARD} relative`}>
      <div className="px-4 pt-4 pb-2 flex justify-center">
        <div className="relative inline-flex items-center">
          {/* Ripple pulse behind the button */}
          <span className="demo3-tap absolute inset-0 rounded-lg bg-amber-400" />
          <span className="relative inline-flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm">
            <FileText size={11} /> Generate Receipt
          </span>
        </div>
      </div>
      <div className="demo3-receipt mx-3 my-3 rounded-lg border border-dashed border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5 px-3 py-2.5">
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-dashed border-amber-200 dark:border-amber-500/30">
          <span className="text-[10px] font-black tracking-widest text-amber-700 dark:text-amber-400">RECEIPT</span>
          <span className="text-[9px] text-amber-500">#001</span>
        </div>
        <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">Your tenant · Room 101</p>
        <p className="text-[9px] text-slate-400">May/Jun 2026</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[12px] font-black text-slate-900 dark:text-white">रू6,100</span>
          <span className="text-[9px] font-black tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-1.5 py-0.5 rounded">PAID</span>
        </div>
      </div>
    </div>
  );
}
