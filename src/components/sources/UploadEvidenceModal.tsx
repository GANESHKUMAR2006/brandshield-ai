"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { ingestEvidenceDocument } from "@/lib/api-client";
import {
  X,
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Layers,
  ShieldCheck,
} from "lucide-react";

interface UploadEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DOCUMENT_TYPES = [
  { value: "clinical_dossier", label: "Clinical Trial Dossier (FDA / ISO)" },
  { value: "scientific_study", label: "Peer-Reviewed Scientific Study" },
  { value: "lab_test_report", label: "Certificate of Analysis / Laboratory Assay" },
  { value: "regulatory_guideline", label: "Regulatory Standard & Compliance Dossier" },
  { value: "brand_guideline", label: "Brand Claim Substantiation Guideline" },
] as const;

export function UploadEvidenceModal({
  isOpen,
  onClose,
  onSuccess,
}: UploadEvidenceModalProps) {
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState<string>(DOCUMENT_TYPES[0].value);
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    title: string;
    chunksCount: number;
    characters: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isUploading) onClose();
    };
    if (isOpen && typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeyDown);
      window.document.body.style.overflow = "hidden";
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", handleKeyDown);
        window.document.body.style.overflow = "";
      }
    };
  }, [isOpen, isUploading, onClose]);

  if (!isOpen) return null;

  const handleFileSelection = async (file: File) => {
    setError(null);
    setSuccessInfo(null);

    const ext = file.name.split(".").pop()?.toLowerCase();
    const validExts = ["pdf", "docx", "txt", "md", "markdown"];
    if (!ext || !validExts.includes(ext)) {
      setError(`Unsupported file format ".${ext}". Supported formats: PDF, DOCX, TXT, MD.`);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError("File exceeds maximum allowed size of 15MB.");
      return;
    }

    setSelectedFile(file);
    if (!title) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }

    // Read content based on format
    try {
      if (ext === "txt" || ext === "md" || ext === "markdown") {
        const text = await file.text();
        setFileContent(text);
      } else {
        // Binary format (PDF or DOCX) -> read as binary string/data
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binaryStr = "";
        for (let i = 0; i < bytes.length; i++) {
          binaryStr += String.fromCharCode(bytes[i]);
        }
        setFileContent(binaryStr);
      }
    } catch {
      setError("Failed to read file from disk. Please try selecting the file again.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please provide a title for the evidence dossier.");
      return;
    }
    if (!fileContent) {
      setError("Please select or drop an evidence document file.");
      return;
    }

    setIsUploading(true);
    setUploadStep("Reading and validating document structure...");

    try {
      const ext = selectedFile?.name.split(".").pop()?.toLowerCase();

      setTimeout(() => {
        setUploadStep("Extracting sections, chunks & provenance tokens...");
      }, 500);

      setTimeout(() => {
        setUploadStep("Generating vector embeddings & persisting to pgvector...");
      }, 1200);

      const res = await ingestEvidenceDocument({
        title: title.trim(),
        documentType,
        description: description.trim() || undefined,
        content: fileContent,
        filename: selectedFile?.name,
        format: ext,
      });

      setSuccessInfo({
        title: res.title,
        chunksCount: res.chunksPersisted || res.chunksGenerated,
        characters: res.totalCharacters,
      });

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ingest evidence document");
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div
        className="fixed inset-0 bg-[#090D16]/80 backdrop-blur-md transition-opacity"
        onClick={!isUploading ? onClose : undefined}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg bg-[#0B0F19] rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col z-10 animate-in fade-in-0 zoom-in-95 duration-150 text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-violet-950/80 border border-violet-800/60 rounded-xl text-violet-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Upload Evidence Dossier
              </h3>
              <p className="text-xs text-slate-400">
                Index clinical trials, lab reports, or regulatory guidelines for claim substantiation
              </p>
            </div>
          </div>
          {!isUploading && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl flex items-center gap-2 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successInfo && (
          <div className="mx-5 mt-4 p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl flex items-start gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <span className="font-semibold block text-emerald-200">
                Evidence Ingested Successfully!
              </span>
              <span className="text-[11px] text-emerald-300/90 block mt-0.5">
                Indexed &ldquo;{successInfo.title}&rdquo; with {successInfo.chunksCount} semantic chunks ({successInfo.characters.toLocaleString()} characters) into the vector store.
              </span>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* File Upload Drop Zone */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Source Document File <span className="text-rose-400">*</span>
            </label>

            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelection(e.target.files[0]);
                }
              }}
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-violet-500 bg-violet-950/20"
                  : selectedFile
                  ? "border-emerald-700/80 bg-emerald-950/10"
                  : "border-slate-700/80 hover:border-slate-600 bg-slate-900/40 hover:bg-slate-900/70"
              }`}
            >
              {selectedFile ? (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="p-2.5 bg-emerald-950/80 rounded-xl border border-emerald-800/80 text-emerald-400">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-white mt-1">
                    {selectedFile.name}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB • Click or drop to replace
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="p-2.5 bg-slate-800/80 rounded-xl text-slate-400">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-slate-200 mt-1">
                    Drop document here or click to browse
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Supports PDF, DOCX, TXT, and Markdown (up to 15MB)
                  </span>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Document Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              disabled={isUploading}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Clinical Study DG-2026: Barrier Hydration & Transepidermal Loss"
              className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all shadow-inner disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Document Classification
            </label>
            <select
              disabled={isUploading}
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all shadow-inner disabled:opacity-60"
            >
              {DOCUMENT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Description & Protocol Notes
            </label>
            <textarea
              rows={2}
              disabled={isUploading}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Study design, sample size (n=45), double-blind control notes, and ethics approval ID..."
              className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all shadow-inner resize-none disabled:opacity-60"
            />
          </div>

          {/* Progress State */}
          {isUploading && (
            <div className="p-3 bg-violet-950/40 border border-violet-800/60 rounded-xl flex items-center gap-2.5 text-xs text-violet-300 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-violet-400 shrink-0" />
              <span>{uploadStep || "Processing evidence document..."}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isUploading || !fileContent}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Ingesting...
                </>
              ) : (
                "Ingest & Generate Embeddings"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
