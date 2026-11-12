"use client";

import { useState, useEffect } from "react";

/**
 * useDebounce hook
 * Delays updating the debounced value until after the specified delay has elapsed
 * since the last time the value changed.
 *
 * @param value The value to debounce (e.g. search string)
 * @param delayMs Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

