"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVIGATION_ITEMS, SITE_CONFIG, DEMO_WORKSPACE } from "@/config/site";
import {
  BrandShieldLogo,
  LayoutDashboardIcon,
  FolderGit2Icon,
  FileCheckIcon,
  ShieldAlertIcon,
  ClipboardCheckIcon,
  HistoryIcon,
  SettingsIcon,
  BuildingIcon,
} from "@/components/ui/Icons";
import { cn } from "@/lib/utils/cn";

interface SidebarProps {
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({ onNavigate, className }: SidebarProps) {
  const pathname = usePathname();

  const renderIcon = (name: string) => {
    switch (name) {
      case "LayoutDashboard":
        return <LayoutDashboardIcon className="w-5 h-5" />;
      case "FolderGit2":
        return <FolderGit2Icon className="w-5 h-5" />;
      case "FileCheck":
        return <FileCheckIcon className="w-5 h-5" />;
      case "ShieldAlert":
        return <ShieldAlertIcon className="w-5 h-5" />;
      case "ClipboardCheck":
        return <ClipboardCheckIcon className="w-5 h-5" />;
      case "History":
        return <HistoryIcon className="w-5 h-5" />;
      case "Settings":
        return <SettingsIcon className="w-5 h-5" />;
      default:
        return <FileCheckIcon className="w-5 h-5" />;
    }
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full w-64 bg-white border-r border-slate-200/90 text-slate-900 select-none",
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-4.5 border-b border-slate-100">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 shrink-0">
          <BrandShieldLogo className="w-6 h-6" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-slate-900 text-sm tracking-tight truncate">
            {SITE_CONFIG.name}
          </span>
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider truncate">
            Claim Governance
          </span>
        </div>
      </div>

      {/* Workspace Indicator */}
      <div className="px-4 py-3 mx-3 my-3 bg-slate-50 border border-slate-200/70 rounded-lg">
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
          <span className="uppercase text-[10px] tracking-wider text-slate-400 font-semibold">
            Active Workspace
          </span>
          <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 font-medium px-1.5 py-0.2 rounded">
            Demo
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-indigo-100/70 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
            <BuildingIcon className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 truncate">
              {DEMO_WORKSPACE.name}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {DEMO_WORKSPACE.complianceTier}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1">
        <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
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
                  "group flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-indigo-50/80 text-indigo-900 font-semibold border border-indigo-100/70 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent"
                )}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span
                    className={cn(
                      "transition-colors",
                      isActive
                        ? "text-indigo-600"
                        : "text-slate-400 group-hover:text-slate-600"
                    )}
                  >
                    {renderIcon(item.icon)}
                  </span>
                  <span className="truncate">{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                      isActive
                        ? "bg-indigo-100 text-indigo-800"
                        : "bg-slate-100 text-slate-600 group-hover:bg-slate-200/80"
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

      {/* Bottom Footer Section */}
      <div className="p-3.5 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-slate-600">v{SITE_CONFIG.version} · Online</span>
          </span>
          <span className="text-slate-400">Phase 1</span>
        </div>
      </div>
    </aside>
  );
}
