/**
 * Debug switches that last for the page session (not saved). Set from the DebugScene's menu (F2) or the
 * E2E hooks, read by the scenes.
 * - `encounters`: when false, wild encounters never roll (the safe-step count still runs down).
 */
export const debugFlags = {
  encounters: true,
};
