"use client";

import React from "react";
import { Shield } from "lucide-react";

export function AuthFooter() {
  const handleLegalClick = (name: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    alert(`BrandShield AI ${name}: All marketing claim verifications and audit logs are governed by tenant-isolated PostgreSQL policies.`);
  };

  return (
    <footer className="w-full border-t border-slate-800/60 bg-[#060913]/40 backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 relative z-20">
      <div className="flex items-center gap-2 text-slate-500">
        <Shield className="w-3.5 h-3.5 text-slate-600" />
        <span>© 2025 BrandShield AI. Enterprise Claim Governance.</span>
      </div>

      <nav aria-label="Legal and Compliance Links" className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-slate-400">
        <a
          href="#privacy"
          onClick={handleLegalClick("Privacy Policy")}
          className="hover:text-slate-200 transition-colors"
        >
          Privacy Policy
        </a>
        <a
          href="#terms"
          onClick={handleLegalClick("Terms of Service")}
          className="hover:text-slate-200 transition-colors"
        >
          Terms of Service
        </a>
        <a
          href="#compliance"
          onClick={handleLegalClick("Compliance Baseline")}
          className="hover:text-slate-200 transition-colors"
        >
          Compliance Baseline
        </a>
        <a
          href="#security"
          onClick={handleLegalClick("Security Overview")}
          className="hover:text-slate-200 transition-colors"
        >
          Security Overview
        </a>
      </nav>
    </footer>
  );
}
