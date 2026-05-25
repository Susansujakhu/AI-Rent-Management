import Link from "next/link";

export const metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 via-indigo-500 to-indigo-600 shadow-lg">
          <svg width="44" height="44" viewBox="0 0 20 20" fill="none">
            <path d="M2 9.5L10 3L18 9.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="3" y="9" width="14" height="9.5" rx="1.5" fill="white" fillOpacity="0.95" />
            <rect x="7.5" y="13.5" width="5" height="5" rx="0.8" fill="#6366f1" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
          You&apos;re offline
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          EasyRent needs an internet connection to load. Check your network and try again.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
