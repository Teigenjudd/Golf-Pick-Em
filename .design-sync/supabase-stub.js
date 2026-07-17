// Stub for src/lib/supabase.js — used ONLY by the design-sync preview bundle,
// swapped in via tsconfig paths (.design-sync/tsconfig.ds.json).
//
// The real module runs `createClient(undefined, undefined)` at import time
// (the preview bundle has no VITE_SUPABASE_* env), which throws
// "supabaseUrl is required." and would poison EVERY preview — BottomNav pulls
// this chain in through ../context/AuthContext. This no-op keeps the
// AuthProvider render path alive with a permanently signed-out session so the
// nav renders instead of crashing the bundle.
const resolved = (data) => Promise.resolve({ data, error: null });

const query = {
  select() { return this; },
  eq() { return this; },
  maybeSingle() { return resolved(null); },
};

export const supabase = {
  auth: {
    getSession: () => resolved({ session: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithOtp: () => resolved(null),
    signOut: () => resolved(null),
  },
  from: () => query,
};
