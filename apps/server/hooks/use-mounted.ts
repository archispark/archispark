"use client"

import { useSyncExternalStore } from "react"

const subscribeToMount = () => () => {}

/**
 * True only after the first client render — always false during SSR and
 * the initial client render, so hydration matches even when the deferred
 * value (a React Query cache restored before hydration, localStorage,
 * etc.) would otherwise differ between server and client on that first
 * paint. Read the guarded value only once this returns true.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeToMount,
    () => true,
    () => false
  )
}
