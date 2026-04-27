"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, FileImage, File, Upload, Trash2, Download, Loader2, Eye } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Doc = {
  id:        string;
  name:      string;
  fileName:  string;
  mimeType:  string;
  size:      number;
  createdAt: string;
};

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType === "application/pdf")  return FileText;
  return File;
}

function formatBytes(bytes: number) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TenantDocumentsPanel({ tenantId }: { tenantId: string }) {
  const [docs,      setDocs]      = useState<Doc[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState("");
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const res = await fetch(`/api/tenants/${tenantId}/documents`);
    if (res.ok) setDocs(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const handleUpload = async (file: File) => {
    setError("");
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res  = await fetch(`/api/tenants/${tenantId}/documents`, { method: "POST", body: form });
    const data = await res.json() as Doc & { error?: string };
    if (!res.ok) { setError(data.error ?? "Upload failed"); setUploading(false); return; }
    setDocs(prev => [data, ...prev]);
    setUploading(false);
  };

  const handleDelete = (docId: string) => setDeleteId(docId);

  const confirmDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/tenants/${tenantId}/documents/${deleteId}`, { method: "DELETE" });
    if (res.ok) setDocs(prev => prev.filter(d => d.id !== deleteId));
    setDeleteId(null);
  };

  return (
    <>
    <ConfirmDialog
      open={!!deleteId}
      onOpenChange={open => { if (!open) setDeleteId(null); }}
      title="Delete document?"
      description="This will permanently delete the document. This cannot be undone."
      confirmLabel="Delete"
      variant="destructive"
      onConfirm={confirmDelete}
    />
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
      <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <FileText size={15} className="text-slate-400" /> Documents
        </h2>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 border border-indigo-200 dark:border-indigo-500/30 hover:border-indigo-300 px-2.5 py-1.5 rounded-lg transition-all bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-50">
          {uploading
            ? <><Loader2 size={12} className="animate-spin" /> Uploading…</>
            : <><Upload size={12} /> Upload</>}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
          onChange={e => { const f = e.target.files?.[0]; if (f) { handleUpload(f); e.target.value = ""; } }}
        />
      </div>

      {error && (
        <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-500/10 border-b border-rose-100 dark:border-rose-500/20">
          <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-slate-400 text-sm">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="py-10 text-center">
          <FileText size={28} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-400">No documents uploaded yet.</p>
          <p className="text-xs text-slate-300 mt-0.5">PDF, images, Word & Excel — up to 10 MB each.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-slate-800">
          {docs.map(doc => {
            const Icon = fileIcon(doc.mimeType);
            const isImage = doc.mimeType.startsWith("image/");
            const isViewable = isImage || doc.mimeType === "application/pdf";
            const viewUrl = `/api/tenants/${tenantId}/documents/${doc.id}?view=1`;
            return (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3.5">
                {isImage ? (
                  <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={viewUrl}
                      alt={doc.name}
                      className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 hover:opacity-80 transition-opacity"
                    />
                  </a>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-slate-500 dark:text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{doc.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatBytes(doc.size)} · {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isViewable && (
                    <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-teal-600 transition-colors"
                      title="View">
                      <Eye size={14} />
                    </a>
                  )}
                  <a href={`/api/tenants/${tenantId}/documents/${doc.id}`} download={doc.name}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600 transition-colors"
                    title="Download">
                    <Download size={14} />
                  </a>
                  <button onClick={() => handleDelete(doc.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors"
                    title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}
