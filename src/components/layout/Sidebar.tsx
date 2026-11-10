"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVIGATION_ITEMS, SITE_CONFIG, DEMO_WORKSPACE } from "@/config/site";
import {
  LayoutDashboard,
  FolderGit2,
  FileCheck2,
  ShieldCheck,
  ClipboardList,
  History,
  ShieldAlert,
  Settings,
  Building2,
  Sparkles,
  Package,
  Compass,
} from "lucide-react";
import { BrandShieldLogo } from "@/components/ui/Icons";
import { cn } from "@/lib/utils/cn";

interface SidebarProps {
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({ onNavigate, className }: SidebarProps) {
  const pathname = usePathname();

  const renderIcon = (name: string, isActive: boolean) => {
    const iconClass = cn(
      "w-4.5 h-4.5 transition-colors",
      isActive ? "text-violet-400" : "text-slate-400 group-hover:text-slate-200"
    );

    switch (name) {
      case "LayoutDashboard":
        return <LayoutDashboard className={iconClass} />;
      case "FolderGit2":
        return <FolderGit2 className={iconClass} />;
      case "FileCheck":
        return <FileCheck2 className={iconClass} />;
      case "ShieldAlert":
        return <ShieldAlert className={iconClass} />;
      case "ClipboardCheck":
        return <ClipboardList className={iconClass} />;
      case "History":
        return <History className={iconClass} />;
      case "Package":
        return <Package className={iconClass} />;
      case "Compass":
        return <Compass className={iconClass} />;
      case "Settings":
        return <Settings className={iconClass} />;
      default:
        return <ShieldCheck className={iconClass} />;
    }
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full w-64 bg-[#0B0F19]/90 backdrop-blur-xl border-r border-slate-800/80 text-slate-100 select-none",
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-4.5 border-b border-slate-800/80">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/30 via-indigo-600/20 to-cyan-500/10 border border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.3)] shrink-0">
          <BrandShieldLogo className="w-6 h-6" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-white text-sm tracking-tight truncate flex items-center gap-1.5">
            {SITE_CONFIG.name}
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
          </span>
          <span className="text-[10px] font-semibold text-violet-400/90 uppercase tracking-wider truncate">
            Claim Governance
          </span>
        </div>
      </div>

      {/* Workspace Indicator Card */}
      <div className="px-3.5 py-3 mx-3 my-3 bg-slate-900/60 border border-slate-800/80 rounded-xl shadow-inner">
        <div className="flex items-center justify-between text-xs font-medium mb-1.5">
          <span className="uppercase text-[9px] tracking-wider text-slate-400 font-bold">
            Active Workspace
          </span>
          <span className="text-[9px] text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 font-semibold px-1.5 py-0.5 rounded-full">
            Tier 1 Enterprise
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-950/70 border border-violet-800/50 flex items-center justify-center text-violet-400 shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-100 truncate">
              {DEMO_WORKSPACE.name}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {DEMO_WORKSPACE.complianceTier}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1">
        <p className="px-2.5 pt-2 pb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Platform Menu
        </p>

        <nav aria-label="Main navigation" className="space-y-0.5">
          {NAVIGATION_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href)) ||
              (item.href === "/dashboard" && (pathname === "/" || pathname === "/dashboard"));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group relative flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-all",
                  isActive
                    ? "bg-gradient-to-r from-violet-600/25 to-indigo-600/10 text-white font-semibold border-l-2 border-violet-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border-l-2 border-transparent"
                )}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span>{renderIcon(item.icon, isActive)}</span>
                  <span className="truncate">{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 border",
                      isActive
                        ? "bg-violet-950/80 text-violet-300 border-violet-800/60"
                        : "bg-slate-800/60 text-slate-400 border-slate-700/60 group-hover:bg-slate-800 group-hover:text-slate-300"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Engine Health Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span className="font-semibold text-slate-200">v{SITE_CONFIG.version}</span>
            <span className="text-slate-500">·</span>
            <span className="text-emerald-400 font-medium">Deterministic</span>
          </span>
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium bg-emerald-950/50 border border-emerald-800/40 px-1.5 py-0.5 rounded">
            <Sparkles className="w-2.5 h-2.5" />
            Active
          </span>
        </div>
      </div>
    </aside>
  );
}
