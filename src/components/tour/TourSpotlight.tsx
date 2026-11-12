"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useTour } from "./TourContext";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Compass,
  HelpCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

function getRouteLabel(route?: string): string {
  switch (route) {
    case "/dashboard":
      return "Dashboard";
    case "/submissions":
      return "Submissions";
    case "/products":
      return "Product Catalog";
    case "/sources":
      return "Evidence Library";
    case "/policies":
      return "Compliance Policies";
    case "/reviews":
      return "Review Queue";
    case "/audit":
      return "Audit Trail";
    case "/settings":
      return "Workspace Settings";
    default:
      return "Workspace";
  }
}

export function TourSpotlight() {
  const {
    isTourActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    activeTourTitle,
    isRouteTransitioning,
    nextStep,
    prevStep,
    skipTour,
    closeTour,
    executeInteractiveAction,
  } = useTour();

  const [targetRect, setTargetRect] = useState<ElementRect | null>(null);
  const [elementFound, setElementFound] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locateFailed, setLocateFailed] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);

  const measureElement = useCallback((el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
      right: rect.right,
    });
    setElementFound(true);
    setIsLocating(false);
    setLocateFailed(false);
  }, []);

  const locateTargetElement = useCallback(() => {
    if (!isTourActive || !currentStep) return () => {};

    if (isRouteTransitioning) {
      setTargetRect(null);
      setElementFound(false);
      setIsLocating(true);
      setLocateFailed(false);
      return () => {};
    }

    setIsLocating(true);
    setLocateFailed(false);

    let isDisposed = false;
    let pollInterval: NodeJS.Timeout | null = null;
    let scrollTimeout: NodeJS.Timeout | null = null;
    let observer: MutationObserver | null = null;
    let pollCount = 0;
    const maxPolls = 50; // 50 * 80ms = 4000ms max bounded search

    const stopWatching = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    };

    const tryFind = (): boolean => {
      if (isDisposed) return true;
      const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
      if (el) {
        const rect = el.getBoundingClientRect();
        // Element found and has layout dimensions
        if (rect.width > 0 && rect.height > 0) {
          stopWatching();
          measureElement(el);
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
          scrollTimeout = setTimeout(() => {
            if (!isDisposed) {
              const freshEl = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
              if (freshEl) measureElement(freshEl);
            }
          }, 150);
          return true;
        }
      }
      return false;
    };

    // 1. Initial immediate check
    if (tryFind()) {
      return () => {
        isDisposed = true;
        if (scrollTimeout) clearTimeout(scrollTimeout);
        stopWatching();
      };
    }

    // 2. Set up MutationObserver to react to dynamic DOM changes
    if (typeof window !== "undefined" && typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(() => {
        if (!isDisposed) {
          tryFind();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    // 3. Fallback polling loop (80ms interval, up to 4s)
    pollInterval = setInterval(() => {
      if (isDisposed) {
        stopWatching();
        return;
      }
      pollCount++;
      const found = tryFind();
      if (found) {
        stopWatching();
      } else if (pollCount >= maxPolls) {
        stopWatching();
        setIsLocating(false);
        setLocateFailed(true);
        setElementFound(false);
        setTargetRect(null);
      }
    }, 80);

    return () => {
      isDisposed = true;
      if (scrollTimeout) clearTimeout(scrollTimeout);
      stopWatching();
    };
  }, [isTourActive, currentStep, isRouteTransitioning, measureElement, retryTrigger]);

  // Run element locator whenever step, index, or route transition state changes
  useEffect(() => {
    const cleanup = locateTargetElement();
    return () => cleanup();
  }, [locateTargetElement]);

  // Handle resize and scroll
  useEffect(() => {
    if (!isTourActive || !currentStep || !elementFound) return;

    const handleScrollOrResize = () => {
      const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
      if (el) measureElement(el);
    };

    window.addEventListener("resize", handleScrollOrResize, { passive: true });
    window.addEventListener("scroll", handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize);
    };
  }, [isTourActive, currentStep, elementFound, measureElement]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    if (!isTourActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skipTour();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevStep();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTourActive, nextStep, prevStep, skipTour]);

  if (!isTourActive || !currentStep) return null;

  // Calculate intelligent popover placement
  const calculatePopoverStyle = (): React.CSSProperties => {
    const margin = 14;
    const popoverWidth = 400;
    const popoverHeight = 280;
    const placement = currentStep.placement || "bottom";

    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;

    // Centered placement fallback when element is off-screen, locating, or route is transitioning
    if (!targetRect || !elementFound || isRouteTransitioning) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: `${Math.min(popoverWidth, viewportWidth - 32)}px`,
        zIndex: 60,
      };
    }

    let top = 0;
    let left = 0;

    switch (placement) {
      case "top":
        top = targetRect.top - popoverHeight - margin;
        left = targetRect.left + targetRect.width / 2 - popoverWidth / 2;
        break;
      case "bottom":
        top = targetRect.bottom + margin;
        left = targetRect.left + targetRect.width / 2 - popoverWidth / 2;
        break;
      case "left":
        top = targetRect.top + targetRect.height / 2 - popoverHeight / 2;
        left = targetRect.left - popoverWidth - margin;
        break;
      case "right":
        top = targetRect.top + targetRect.height / 2 - popoverHeight / 2;
        left = targetRect.right + margin;
        break;
      case "center":
      default:
        top = viewportHeight / 2 - popoverHeight / 2;
        left = viewportWidth / 2 - popoverWidth / 2;
        break;
    }

    // Viewport edge boundary clamping
    if (left < 16) left = 16;
    if (left + popoverWidth > viewportWidth - 16) left = viewportWidth - popoverWidth - 16;
    if (top < 16) top = 16;
    if (top + popoverHeight > viewportHeight - 16) top = viewportHeight - popoverHeight - 16;

    return {
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      width: `${Math.min(popoverWidth, viewportWidth - 32)}px`,
      zIndex: 60,
    };
  };

  const pad = 6;
  const isLastStep = currentStepIndex === totalSteps - 1;
  const progressPercent = Math.round(((currentStepIndex + 1) / totalSteps) * 100);
  const currentRouteName = getRouteLabel(currentStep.pageRoute);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none select-none">
      {/* 1. Backdrop Overlay (SVG with Cutout) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" aria-hidden="true">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && elementFound && !isRouteTransitioning && (
              <rect
                x={targetRect.left - pad}
                y={targetRect.top - pad}
                width={targetRect.width + pad * 2}
                height={targetRect.height + pad * 2}
                rx="10"
                ry="10"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(6, 9, 16, 0.78)"
          mask="url(#spotlight-mask)"
          onClick={closeTour}
        />
      </svg>

      {/* 2. Spotlight Glowing Ring around Target Element */}
      {targetRect && elementFound && !isRouteTransitioning && (
        <div
          className="fixed pointer-events-none transition-all duration-300 ease-out border-2 border-violet-500 rounded-xl shadow-[0_0_24px_rgba(139,92,246,0.65)] ring-2 ring-cyan-400/40"
          style={{
            top: `${targetRect.top - pad}px`,
            left: `${targetRect.left - pad}px`,
            width: `${targetRect.width + pad * 2}px`,
            height: `${targetRect.height + pad * 2}px`,
            zIndex: 55,
          }}
        />
      )}

      {/* 3. Intelligent Tooltip Popover */}
      <div
        ref={popoverRef}
        style={calculatePopoverStyle()}
        className="pointer-events-auto bg-[#0B0F19]/95 border border-slate-700/90 rounded-2xl shadow-2xl p-4.5 sm:p-5 text-slate-100 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 flex flex-col justify-between"
      >
        <div>
          {/* Visual Progress Bar */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-violet-500 via-indigo-400 to-cyan-400 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Popover Top Bar */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_6px_#22d3ee]" />
              <span className="text-[11px] font-semibold text-violet-400 uppercase tracking-wider truncate">
                {activeTourTitle}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-950/80 text-violet-300 border border-violet-800/60 hidden sm:inline">
                {currentRouteName}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700">
                Step {currentStepIndex + 1} of {totalSteps}
              </span>
              <button
                type="button"
                onClick={skipTour}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-800/60 cursor-pointer"
                aria-label="Skip guided tour"
                title="Skip tour (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Step Title & Content */}
          <h3 className="font-bold text-white text-sm tracking-tight mb-1.5 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{currentStep.title}</span>
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed font-normal">
            {currentStep.content}
          </p>

          {/* Individual Control Guidance Box */}
          {currentStep.controlTip && (
            <div className="mt-2.5 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-cyan-300">
                <HelpCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>{currentStep.controlTip.actionName}</span>
              </div>
              <p className="text-slate-400 leading-snug">
                {currentStep.controlTip.description}
              </p>
              {currentStep.controlTip.consequence && (
                <p className="text-violet-300 font-medium text-[10px]">
                  <strong>Consequence:</strong> {currentStep.controlTip.consequence}
                </p>
              )}
            </div>
          )}

          {/* State 1: Route Transitioning */}
          {isRouteTransitioning && (
            <div className="mt-2.5 p-2.5 rounded-lg bg-violet-950/40 border border-violet-800/60 text-violet-300 text-xs flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400 shrink-0" />
              <span>Navigating to {currentRouteName}...</span>
            </div>
          )}

          {/* State 2: Locating Target Element */}
          {isLocating && !isRouteTransitioning && (
            <div className="mt-2.5 p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 text-xs flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin text-violet-400 shrink-0" />
              <span>Locating target control on page...</span>
            </div>
          )}

          {/* State 3: Missing Target Fallback */}
          {locateFailed && !isRouteTransitioning && (
            <div className="mt-2.5 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Target element not detected</span>
              </div>
              <p className="text-[11px] text-slate-400">
                The target control may still be loading or requires a different view filter. You can retry discovery or continue.
              </p>
              <button
                type="button"
                onClick={() => setRetryTrigger((prev) => prev + 1)}
                className="self-start text-[11px] font-semibold text-cyan-300 hover:text-white flex items-center gap-1 cursor-pointer pt-0.5"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Element Discovery</span>
              </button>
            </div>
          )}

          {/* Interactive Try-It Action */}
          {currentStep.interactiveActionText && currentStep.interactiveActionId && (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => executeInteractiveAction(currentStep.interactiveActionId!)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/60 text-cyan-300 text-xs font-semibold transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>{currentStep.interactiveActionText}</span>
              </button>
            </div>
          )}
        </div>

        {/* Popover Footer Controls */}
        <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between">
          <button
            type="button"
            onClick={skipTour}
            className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-1.5">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={prevStep}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-medium transition-colors cursor-pointer border border-slate-700"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={nextStep}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-violet-950/40 cursor-pointer"
            >
              <span>{isLastStep ? "Finish Tour" : "Next"}</span>
              {isLastStep ? <Sparkles className="w-3.5 h-3.5 text-cyan-300" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
