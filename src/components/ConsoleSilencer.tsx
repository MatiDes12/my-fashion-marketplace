"use client";

import { useEffect } from "react";

/**
 * Silences only console.log on the client in production to avoid leaking
 * sensitive information in the browser's developer console.
 *
 * - Does not affect console.warn or console.error
 * - No-ops only in production and only in the browser
 */
export default function ConsoleSilencer(): null {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;

    const originalConsoleLog = console.log;

    // Replace console.log with a no-op in production (client only)
    // Preserve function shape to avoid potential consumer checks
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    console.log = (..._args: unknown[]): void => {};

    // Restore on unmount (mainly useful during HMR in non-prod, but harmless)
    return () => {
      console.log = originalConsoleLog;
    };
  }, []);

  return null;
}

