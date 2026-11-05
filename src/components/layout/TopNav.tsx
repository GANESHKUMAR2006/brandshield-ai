"use client";

import React, { useState } from "react";
import { SITE_CONFIG, DEMO_WORKSPACE, CURRENT_USER } from "@/config/site";
import { BrandShieldLogo, BellIcon, MenuIcon, BuildingIcon } from "@/components/ui/Icons";

interface TopNavProps {
  onOpenMobileMenu: () => void;
}

export function TopNav({ onOpenMobileMenu }: TopNavProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white/95 backdrop-blur-xs border-b border-slate-200/90 text-slate-900">
      {/* Left side: Mobile Toggle & Mobile Logo */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          aria-label="Open sidebar navigation"
        >
          <MenuIcon className="w-5 h-5" />
        </button>

        {/* Mobile Logo Brand */}
        <div className="flex lg:hidden items-center gap-2">
          <BrandShieldLogo className="w-6 h-6" />
          <span className="font-semibold text-slate-900 text-sm tracking-tight">
            {SITE_CONFIG.shortName}
          </span>
        </div>

        {/* Desktop Breadcrumb / Workspace Badge */}
        <div className="hidden lg:flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100/80 border border-slate-200/70 rounded-md text-slate-700 font-medium">
            <BuildingIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>Workspace:</span>
            <strong className="text-slate-900 font-semibold">{DEMO_WORKSPACE.name}</strong>
          </span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-500 font-medium">Evidence-Linked Governance</span>
        </div>
      </div>

      {/* Right side: Workspace, Notifications, User Profile */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Organization pill (tablet/mobile visible) */}
        <div className="flex lg:hidden items-center text-xs px-2 py-0.5 bg-slate-100 rounded border border-slate-200 text-slate-700 font-medium">
          {DEMO_WORKSPACE.name}
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            aria-label="Notifications"
          >
            <BellIcon className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600" />
            </span>
          </button>

          {/* Simple Dropdown Popover */}
          {showNotifications && (
            <div
              className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-50 text-xs"
              role="dialog"
              aria-label="Notifications popover"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 font-semibold text-slate-900">
                <span>Recent System Alerts</span>
                <span className="text-[10px] text-indigo-600 font-medium">3 unread</span>
              </div>
              <div className="space-y-2 text-slate-600">
                <div className="p-2 rounded-md bg-amber-50/60 border border-amber-100">
                  <p className="font-medium text-amber-900 text-[11px]">
                    Claim flagged in Q3 Radiance Serum
                  </p>
                  <p className="text-[10px] text-amber-700 mt-0.5">
                    Requires clinical dossier re-check.
                  </p>
                </div>
                <div className="p-2 rounded-md bg-slate-50 border border-slate-100">
                  <p className="font-medium text-slate-800 text-[11px]">
                    Source Document Index Updated
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    DG-CT-2026-08 available for claims matching.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Placeholder */}
        <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-semibold tracking-wider shadow-2xs">
            {CURRENT_USER.initials}
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-900 leading-tight">
              {CURRENT_USER.name}
            </span>
            <span className="text-[10px] text-slate-500 truncate max-w-[140px]">
              {CURRENT_USER.role}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
