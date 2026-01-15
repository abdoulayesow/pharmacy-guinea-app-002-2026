# Authentication & Locking Mechanism Analysis

**Date:** 2026-01-15
**Scope:** Complete auth flow from Google OAuth → PIN → Session management → Auto-lock → App locking

---

## Executive Summary

The app uses a **dual-store authentication system** (NextAuth session + Zustand auth store) with **dual inactivity tracking** (auth store + lock store), creating complexity and potential race conditions. While the architecture is functional, several inconsistencies exist between redirect logic, state synchronization, and timeout handling.

### Critical Issues Found
1. **Dual inactivity tracking** with different timeout sources
2. **Redirect loops** when `lastActivityAt` is null but Google session exists
3. **Race condition** between AuthGuard and AppLockGuard redirects
4. **Inconsistent timeout configuration** between auth and lock stores
5. **Complex state synchronization** between NextAuth and Zustand

---

## Architecture Overview

### Authentication Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Authentication                       │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
          ┌─────────▼─────────┐    ┌─────────▼─────────┐
          │  NextAuth Session │    │  Zustand Auth     │
          │  (Server-side)    │    │  (Client-side)    │
          └─────────┬─────────┘    └─────────┬─────────┘
                    │                         │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    Activity Tracking     │
                    │   (useActivityMonitor)   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
          ┌─────────▼─────────┐    ┌─────────▼─────────┐
          │  Auth Store       │    │  Lock Store       │
          │  Inactivity (5m)  │    │  Auto-lock (5m)   │
          └─────────┬─────────┘    └─────────┬─────────┘
                    │                         │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      AppLockGuard       │
                    │   (Redirect to login)   │
                    └─────────────────────────┘
```

### Data Flow

```
1. Google OAuth Login
   ↓
2. NextAuth creates session (httpOnly cookie)
   ↓
3. NextAuth creates user in DB with default PIN (1234)
   ↓
4. User redirected to /auth/setup-pin (mustChangePin flag)
   ↓
5. User sets new PIN
   ↓
6. User can now login via PIN when session expires (>5min inactivity)
```

---

## State Stores Analysis

### NextAuth Session (Server-side via JWT)

**Location:** `src/auth.ts`

**Properties:**
- `id` - User ID
- `role` - OWNER | EMPLOYEE
- `hasPin` - Boolean (PIN configured?)
- `mustChangePin` - Boolean (default PIN needs change?)
- `name`, `email`, `image` - Profile data

**Storage:** httpOnly cookie (encrypted JWT)
**Lifetime:** 7 days (SESSION_MAX_AGE_DAYS)
**Updates:** On sign-in, manual session.update() calls

**Callbacks:**
- `jwt()` - Syncs user data from Prisma to JWT token
- `session()` - Exposes JWT data to client via session object
- `signIn()` - Syncs Google profile changes to Prisma

---

### Zustand Auth Store (Client-side)

**Location:** `src/stores/auth.ts`

**Properties:**
```typescript
{
  currentUser: User | null,
  isAuthenticated: boolean,
  failedAttempts: number,
  lockedUntil: Date | null,
  lastActivityAt: number | null,  // ← Inactivity tracking
  _hasHydrated: boolean
}
```

**Storage:** localStorage (`seri-auth`)
**Persistence:** Survives page refresh
**Timeout:** 5 minutes (INACTIVITY_TIMEOUT_MS)

**Key Methods:**
- `login(user)` - Sets isAuthenticated, lastActivityAt = now
- `logout()` - Clears auth state, lastActivityAt = null
- `updateActivity()` - Sets lastActivityAt = now
- `isInactive()` - Returns `true` if (now - lastActivityAt) > 5 min
- `syncFromSession()` - Copies NextAuth session → Zustand

---

### Zustand Lock Store (Client-side)

**Location:** `src/stores/lock.ts`

**Properties:**
```typescript
{
  isLocked: boolean,
  lockReason: 'manual' | 'inactivity' | null,
  lastActivityAt: number | null,  // ← DUPLICATE tracking
  _hasHydrated: boolean
}
```

**Storage:** sessionStorage (`seri-app-locked`)
**Persistence:** Clears on page refresh (intentional)
**Timeout:** 5 minutes (LOCK_TIMEOUT_MS)

**Key Methods:**
- `lock(reason)` - Sets isLocked, stores in sessionStorage
- `unlock()` - Clears isLocked, removes from sessionStorage
- `updateActivity()` - Sets lastActivityAt = now
- `checkAutoLock()` - Triggers lock if (now - lastActivityAt) > 5 min

**Design:** Page refresh clears lock to prevent locked state after browser restart.

---

## Guard Components

### AuthGuard

**Location:** `src/components/AuthGuard.tsx`
**Wraps:** Individual page content
**Purpose:** Ensure user is authenticated

**Logic Flow:**
```typescript
1. Monitor activity via useActivityMonitor()
2. Sync NextAuth session → Zustand on session change
3. If mustChangePin, redirect to /auth/setup-pin
4. If not authenticated AND no OAuth session, redirect to /login
5. Show loading while checking auth states
```

**Responsibilities:**
- Session sync (NextAuth → Zustand)
- Redirect to login if no auth
- Redirect to PIN setup if mustChangePin
- Activity monitoring

**Issue:** Does NOT redirect on inactivity (relies on AppLockGuard).

---

### AppLockGuard

**Location:** `src/components/AppLockGuard.tsx`
**Wraps:** Entire app (in layout.tsx)
**Purpose:** Handle app locking (manual + inactivity)

**Logic Flow:**
```typescript
1. If locked && lockReason === 'inactivity':
   - Clear lock state
   - Logout from auth store
   - Redirect to /login with callbackUrl

2. If auth store isInactive() && hasGoogleSession:
   - Redirect to /login with callbackUrl

3. If locked && lockReason === 'manual':
   - Show LockScreen overlay (no redirect)
```

**Responsibilities:**
- Redirect on inactivity lock
- Show lock screen overlay on manual lock
- Prevent body scroll when manually locked
- Check auth store inactivity and redirect

**Issue:** Redundant inactivity check (both lock store and auth store).

---

## Activity Monitoring

### useActivityMonitor Hook

**Location:** `src/hooks/useActivityMonitor.ts`

**Events Tracked:** `mousedown`, `keydown`, `touchstart`, `scroll`

**Updates:**
- `authStore.updateActivity()` - Every 30 seconds (throttled)
- `lockStore.updateActivity()` - Every 30 seconds (throttled)

**Checks:**
- Every 60 seconds (CHECK_INTERVAL_MS)
- Only when tab is visible (battery optimization)
- Compares `lastActivityAt` vs `LOCK_TIMEOUT_MS` (5 minutes)

**Action on Inactivity:**
- Calls `lock('inactivity')` → triggers AppLockGuard redirect

**Optimizations:**
- 60s interval (vs 30s) for battery life
- Pauses when tab hidden (visibilitychange API)
- Throttled updates (max 1 per 30s)

---

## Configuration

**Location:** `src/lib/shared/config.ts`

```typescript
AUTH_CONFIG = {
  DEFAULT_PIN: '1234',                      // New user default PIN
  SESSION_MAX_AGE_DAYS: 7,                  // NextAuth session lifetime
  INACTIVITY_TIMEOUT_MINUTES: 5,            // Auth store timeout
  MAX_FAILED_ATTEMPTS: 5,                   // PIN lockout threshold
  LOCKOUT_DURATION_MINUTES: 30,             // Lockout duration
}

AUTH_COMPUTED = {
  SESSION_MAX_AGE_SECONDS: 604800,          // 7 days in seconds
  INACTIVITY_TIMEOUT_MS: 300000,            // 5 minutes in ms
  LOCKOUT_DURATION_MS: 1800000,             // 30 minutes in ms
}
```

**Environment Variables:**
- `NEXT_PUBLIC_INACTIVITY_TIMEOUT_MINUTES` (default: 5)
- `NEXT_PUBLIC_LOCK_TIMEOUT_MINUTES` (default: 5)
- `SESSION_MAX_AGE_DAYS` (default: 7)

**Issue:** Lock store uses separate env var (`NEXT_PUBLIC_LOCK_TIMEOUT_MINUTES`) but falls back to `INACTIVITY_TIMEOUT_MINUTES` if not set. This creates configuration complexity.

---

## Login Flow Analysis

**Location:** `src/app/login/page.tsx`

### Login Modes

```typescript
type LoginMode = 'loading' | 'google-only' | 'pin-only';
```

**Mode Logic:**
```typescript
if (sessionStatus === 'loading') → 'loading'
if (no Google session) → 'google-only'
if (Google session && lastActivityAt === null) → 'loading' (redirect)
if (Google session && isInactive()) → 'pin-only'
if (Google session && active) → 'loading' (redirect)
```

### Redirect Logic

**Case 1: PIN authenticated via Zustand**
```typescript
if (isAuthenticated) → router.push(callbackUrl)
```

**Case 2: Google session + mustChangePin**
```typescript
if (session.user.mustChangePin) → router.push('/auth/setup-pin?force=true')
```

**Case 3: Google session + no PIN setup**
```typescript
if (!session.user.hasPin) → router.push('/auth/setup-pin')
```

**Case 4: Google session + first login**
```typescript
if (hasGoogleSession && !lastActivityAt) → {
  updateActivity()
  router.push(callbackUrl)
}
```

**Case 5: Google session + active**
```typescript
if (hasGoogleSession && !isInactive()) → {
  updateActivity()
  router.push(callbackUrl)
}
```

**Case 6: Google session + inactive**
```typescript
// Stay on login page, show PIN entry
```

### Redirect Protection

Uses `hasRedirectedRef` to prevent infinite loops:
```typescript
const hasRedirectedRef = useRef(false);
if (hasRedirectedRef.current) return;
// ... do redirect ...
hasRedirectedRef.current = true;
```

Resets when `callbackUrl` changes to allow client-side navigation reuse.

---

## Critical Issues

### 1. Dual Inactivity Tracking

**Problem:** Both auth store and lock store track `lastActivityAt` independently.

**Code Evidence:**
- `authStore.lastActivityAt` (persisted in localStorage)
- `lockStore.lastActivityAt` (session-only, clears on refresh)
- Both updated by `useActivityMonitor` every 30 seconds

**Why it's bad:**
- Two sources of truth for same concept
- Can drift out of sync
- Causes redundant checks in AppLockGuard
- Configuration complexity (two env vars)

**Recommendation:** Use single source of truth (auth store) for activity tracking.

---

### 2. Redirect Loop Risk: Null lastActivityAt

**Problem:** When user has Google session but `lastActivityAt` is null, multiple redirect paths can trigger.

**Scenario:**
1. User logs in via Google (first time)
2. `lastActivityAt` is null (not set yet)
3. Login page checks: `if (!lastActivityAt)` → redirect to dashboard
4. Dashboard loads AuthGuard
5. AuthGuard checks: `if (hasOAuthSession)` → stays on page
6. User is inactive for 5+ minutes
7. AppLockGuard checks: `if (isInactive())` → BUT `lastActivityAt` is null!
8. `isInactive()` returns `true` when `lastActivityAt` is null
9. Redirects to login with callbackUrl=/dashboard
10. Login page: `if (!lastActivityAt)` → redirects to dashboard
11. **Loop!**

**Code Evidence:**
```typescript
// auth.ts line 66-69
isInactive: () => {
  const { lastActivityAt } = get();
  if (!lastActivityAt) return true;  // ← Returns true when null!
  return Date.now() - lastActivityAt > INACTIVITY_TIMEOUT_MS;
}
```

**Recommendation:** Initialize `lastActivityAt` on first Google login before any redirects.

---

### 3. Race Condition: AuthGuard vs AppLockGuard

**Problem:** Both guards run redirect logic simultaneously.

**Code Evidence:**
- AuthGuard (line 71-79): Redirects to /login if not authenticated
- AppLockGuard (line 52-57): Redirects to /login if inactive
- Both use `useEffect` with different dependencies

**Scenario:**
1. User inactive for 5+ minutes
2. AppLockGuard: `if (isInactive())` → redirect to /login?callbackUrl=/dashboard
3. AuthGuard: `if (!isAuthenticated)` → redirect to /login
4. Depends on which effect fires first
5. URL may or may not preserve `callbackUrl`

**Recommendation:** Consolidate redirect logic in one place (preferably AppLockGuard since it wraps everything).

---

### 4. Inconsistent Timeout Configuration

**Problem:** Multiple timeout sources can diverge.

**Code Evidence:**
```typescript
// auth.ts (line 9-10)
const INACTIVITY_MINUTES = parseInt(process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MINUTES || '5', 10);
export const INACTIVITY_TIMEOUT_MS = INACTIVITY_MINUTES * 60 * 1000;

// lock.ts (line 8-14)
const LOCK_TIMEOUT_MINUTES = parseInt(
  process.env.NEXT_PUBLIC_LOCK_TIMEOUT_MINUTES ||
  process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MINUTES ||
  '5',
  10
);
export const LOCK_TIMEOUT_MS = LOCK_TIMEOUT_MINUTES * 60 * 1000;
```

**Issue:** Two separate timeout values that should always be the same. If someone sets `NEXT_PUBLIC_LOCK_TIMEOUT_MINUTES=3` but leaves `NEXT_PUBLIC_INACTIVITY_TIMEOUT_MINUTES=5`, behavior becomes unpredictable.

**Recommendation:** Use single config value from `AUTH_CONFIG.INACTIVITY_TIMEOUT_MINUTES`.

---

### 5. Complex State Synchronization

**Problem:** NextAuth session and Zustand auth store must stay synchronized, but sync happens in multiple places.

**Sync Points:**
1. **AuthGuard (line 46-56):** `syncFromSession()` on session change
2. **Login page (line 138-172):** Syncs Google user to IndexedDB
3. **Login page (line 402):** `login(user)` after PIN verification

**Sync Logic:**
```typescript
// AuthGuard
syncFromSession({
  id: session.user.id,
  name: session.user.name,
  role: session.user.role,
  image: session.user.image,
});

// auth.ts syncFromSession
if (!isAuthenticated || currentUser?.id !== sessionUser.id) {
  set({
    currentUser: { ...sessionUser },
    isAuthenticated: true,
    lastActivityAt: Date.now(),
  });
}
```

**Issue:** `syncFromSession` sets `isAuthenticated=true` and `lastActivityAt=now`, but this is NOT a full login. It's just syncing profile data. However, it marks the user as "authenticated" even if they haven't entered a PIN.

**Consequence:** User with Google session but who hasn't entered PIN gets marked as authenticated in Zustand. This works because AuthGuard checks `hasOAuthSession` OR `isAuthenticated`, but it's confusing.

**Recommendation:** Separate profile sync from authentication state. Use `syncFromSession` only for profile updates, not auth state.

---

## Redirect Logic Paths

### Path 1: Fresh User (First Google Login)

```
1. User visits /dashboard
2. AuthGuard: no session → redirect /login
3. User clicks "Google Sign In"
4. Google OAuth flow → NextAuth session created
5. NextAuth createUser event → set default PIN (1234), mustChangePin=true
6. Redirect to /auth/setup-pin?force=true (via login page line 221)
7. User sets new PIN
8. Redirect to /dashboard
9. AuthGuard: session exists → syncFromSession → allow access
```

**Status:** ✅ Works correctly

---

### Path 2: Returning User (Active Session)

```
1. User visits /dashboard (has Google session, last activity < 5 min)
2. Login page: if (!isInactive()) → redirect /dashboard
3. AuthGuard: session exists → syncFromSession → allow access
```

**Status:** ✅ Works correctly

---

### Path 3: Returning User (Inactive Session)

```
1. User visits /dashboard (has Google session, last activity > 5 min OR null)
2. Login page mode: 'pin-only'
3. Show PIN entry screen
4. User enters PIN
5. PIN verification → login(user) → set lastActivityAt
6. Redirect to callbackUrl (/dashboard)
7. AuthGuard: isAuthenticated → allow access
```

**Status:** ⚠️ Works, but null lastActivityAt can cause loop (see Issue #2)

---

### Path 4: Auto-Lock After Inactivity

```
1. User on /dashboard, has been inactive 5+ minutes
2. useActivityMonitor: checkInactivity() → (now - lastActivityAt) > 5min
3. lock('inactivity') → set isLocked=true, lockReason='inactivity'
4. AppLockGuard (line 45-48): if (lockReason === 'inactivity')
5. unlock() → clear lock state
6. logout() → clear auth store, lastActivityAt = null
7. router.push(/login?callbackUrl=/dashboard)
8. Login page mode: 'pin-only' (still has Google session)
9. User enters PIN → login(user) → redirect /dashboard
```

**Status:** ✅ Works correctly (elegant design: lock → logout → redirect)

---

### Path 5: Manual Lock

```
1. User clicks lock button in header
2. lock('manual') → set isLocked=true, lockReason='manual'
3. AppLockGuard (line 74): showLockScreen = true
4. LockScreen overlay appears (no redirect)
5. User enters PIN → unlock() → overlay disappears
6. updateActivity() → set lastActivityAt = now
```

**Status:** ✅ Works correctly

---

### Path 6: Page Refresh While Locked (Manual)

```
1. User manually locked
2. User refreshes page (F5)
3. Lock store: sessionStorage cleared → isLocked=false
4. Lock screen disappears
5. App remains accessible (Google session still valid)
```

**Status:** ✅ Intentional design (lock clears on refresh)

---

## Anti-Patterns Identified

### 1. Magic Null Handling

```typescript
// auth.ts line 66-69
isInactive: () => {
  const { lastActivityAt } = get();
  if (!lastActivityAt) return true;  // ← "No activity = inactive"
  return Date.now() - lastActivityAt > INACTIVITY_TIMEOUT_MS;
}
```

**Issue:** `null` is treated as "inactive forever", but semantically it should mean "no activity recorded yet" (neutral state).

**Better:**
```typescript
isInactive: () => {
  const { lastActivityAt } = get();
  if (!lastActivityAt) return false; // No activity recorded = assume active
  return Date.now() - lastActivityAt > INACTIVITY_TIMEOUT_MS;
}
```

Or initialize `lastActivityAt` immediately on Google login.

---

### 2. Dual Responsibility in syncFromSession

```typescript
// auth.ts line 107-124
syncFromSession: (sessionUser) => {
  // Syncs profile AND sets isAuthenticated=true
  set({
    currentUser: { ...sessionUser },
    isAuthenticated: true,  // ← Auth state change!
    lastActivityAt: Date.now(),
  });
}
```

**Issue:** Function name implies "sync profile data" but also changes authentication state. This creates confusion.

**Better:** Split into two functions:
```typescript
syncProfile: (sessionUser) => {
  set({ currentUser: { ...sessionUser } });
}

markAuthenticated: () => {
  set({
    isAuthenticated: true,
    lastActivityAt: Date.now()
  });
}
```

---

### 3. Lock Store Clearing on Refresh

**Code:**
```typescript
// lock.ts line 34-41
function getInitialLockState(): boolean {
  // Always start unlocked on page load/refresh
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('seri-app-locked');
  }
  return false;
}
```

**Issue:** While intentional (documented in CLAUDE.md), this creates inconsistent behavior:
- Manual lock: Clears on refresh
- Inactivity lock: Redirects to login (no lock state left)

Users might expect manual lock to persist across refresh (like a phone lock screen).

**Alternative:** Use localStorage for manual lock, sessionStorage for inactivity lock.

---

### 4. Redirect Guard with Ref

**Code:**
```typescript
// login/page.tsx line 107, 206-252
const hasRedirectedRef = useRef(false);

useEffect(() => {
  if (hasRedirectedRef.current) return; // Prevent duplicate redirects
  // ... redirect logic ...
  hasRedirectedRef.current = true;
}, [dependencies]);
```

**Issue:** While effective, this pattern suggests the dependencies might be too broad or the effect is firing multiple times. Better to fix the root cause than add a guard.

**Better:** Refactor effect to have precise dependencies or split into multiple effects.

---

## Recommendations

### Priority 1: Critical Fixes

1. **Fix null lastActivityAt handling**
   - Initialize `lastActivityAt` on Google login BEFORE any redirects
   - Change `isInactive()` to return `false` when `lastActivityAt` is null
   - OR: Always set `lastActivityAt` in syncFromSession

2. **Consolidate activity tracking**
   - Remove `lastActivityAt` from lock store
   - Use auth store as single source of truth
   - Simplify `useActivityMonitor` to update only auth store

3. **Fix timeout configuration**
   - Use single env var: `NEXT_PUBLIC_INACTIVITY_TIMEOUT_MINUTES`
   - Remove `NEXT_PUBLIC_LOCK_TIMEOUT_MINUTES`
   - Import from `AUTH_CONFIG` in both stores

---

### Priority 2: Refactoring

4. **Simplify syncFromSession**
   - Rename to `syncProfileFromSession` (only syncs profile)
   - Don't set `isAuthenticated` or `lastActivityAt`
   - Create separate `authenticate()` method for PIN login

5. **Consolidate redirect logic**
   - Move all inactivity redirects to AppLockGuard
   - Remove inactivity check from AuthGuard
   - Single responsibility: AuthGuard checks auth, AppLockGuard handles locks

6. **Improve redirect protection**
   - Remove `hasRedirectedRef` pattern
   - Fix effect dependencies to prevent multi-firing
   - Use router.replace instead of router.push where appropriate

---

### Priority 3: Enhancements

7. **Add state transition logging**
   - Log all authentication state changes
   - Log all lock state changes
   - Add debug mode toggle via env var

8. **Persist manual lock (optional)**
   - Use localStorage for manual lock state
   - Requires PIN to unlock even after refresh
   - More secure, matches user expectations

9. **Add state diagram visualization**
   - Create visual diagram of all states and transitions
   - Document in CURRENT_STATE_DIAGRAMS.md
   - Include in Storybook (if added)

---

## Testing Checklist

### Scenario Tests

- [ ] **Fresh user flow**
  - [ ] Google login → Setup PIN → Dashboard
  - [ ] Default PIN rejected on login
  - [ ] Forced to change PIN before dashboard access

- [ ] **Returning user (active)**
  - [ ] Google session < 5 min → Direct to dashboard
  - [ ] No PIN required
  - [ ] Activity tracked correctly

- [ ] **Returning user (inactive)**
  - [ ] Google session > 5 min → Show PIN entry
  - [ ] PIN correct → Dashboard
  - [ ] PIN incorrect → Error + retry

- [ ] **Inactivity auto-lock**
  - [ ] Inactive 5+ min → Lock triggered
  - [ ] Redirect to login with callbackUrl
  - [ ] PIN entry → Return to original page

- [ ] **Manual lock**
  - [ ] Click lock button → Overlay appears
  - [ ] PIN unlock → Overlay disappears
  - [ ] Refresh → Lock clears (by design)

- [ ] **Edge cases**
  - [ ] Page refresh during PIN entry
  - [ ] Browser back button during login
  - [ ] Multiple tabs with different lock states
  - [ ] Network loss during Google OAuth
  - [ ] Network loss during PIN verification

---

## Performance Considerations

### Current Metrics

- **Activity monitor interval:** 60 seconds
- **Activity update throttle:** 30 seconds
- **Visibility API:** Used (battery optimization)
- **Effect re-runs:** Minimal (good dependency arrays)

### Potential Improvements

1. **Debounce activity updates** instead of throttle (more responsive)
2. **Use requestIdleCallback** for non-critical checks
3. **Reduce localStorage writes** (persist only on significant changes)

---

## Security Audit

### Strengths

✅ **httpOnly cookies** for JWT (XSS protection)
✅ **CSRF verification** in API routes
✅ **bcrypt hashing** for PINs
✅ **Session timeout** after inactivity
✅ **Account lockout** after failed attempts
✅ **Biometric unlock** support (WebAuthn)

### Concerns

⚠️ **PIN in localStorage** (via Zustand persist in auth store)
- While not critical (PIN hash stored, not plaintext), consider using sessionStorage or memory-only for sensitive flags

⚠️ **No rate limiting** on /api/auth/login
- Multiple PIN attempts possible without server-side rate limit
- Client-side lockout can be bypassed by clearing localStorage

⚠️ **Session replay risk** if JWT token stolen
- httpOnly cookie helps, but consider:
  - Adding IP address check
  - Adding user-agent check
  - Short-lived tokens with refresh mechanism

---

## Documentation Gaps

The following areas lack documentation:

1. **State transition diagram** (all auth/lock states)
2. **Redirect decision tree** (when to go where)
3. **Activity tracking sequence diagram** (monitor → store → guard)
4. **Troubleshooting guide** (common issues + fixes)
5. **API authentication** (how API routes verify auth)

---

## Fixes Applied (2026-01-15)

### ✅ Fix 1: Null `lastActivityAt` Handling
**File:** [src/stores/auth.ts:66-72](../src/stores/auth.ts#L66-L72)

Changed `isInactive()` to return `false` when `lastActivityAt` is null (instead of `true`). This prevents redirect loops when a user has a fresh Google session but no activity recorded yet.

### ✅ Fix 2: Consolidated Activity Tracking
**Files:**
- [src/stores/lock.ts](../src/stores/lock.ts) - Removed `lastActivityAt`, `updateActivity()`, and `checkAutoLock()`
- [src/hooks/useActivityMonitor.ts](../src/hooks/useActivityMonitor.ts) - Now only updates auth store
- [src/components/LockScreen.tsx](../src/components/LockScreen.tsx) - Uses `updateActivity` from auth store

Activity is now tracked in a single place (auth store), eliminating the dual-tracking issue.

### ✅ Fix 3: Unified Timeout Configuration
**File:** [src/stores/lock.ts:4-7](../src/stores/lock.ts#L4-L7)

Lock store now imports `LOCK_TIMEOUT_MS` from `AUTH_COMPUTED` instead of parsing its own env var. Single source of truth for timeout values.

### ✅ Fix 4: Separated Profile Sync from Authentication
**File:** [src/stores/auth.ts:111-135](../src/stores/auth.ts#L111-L135)

Renamed `syncFromSession` → `syncProfileFromSession` and removed the side effect of setting `isAuthenticated`. Added separate `initializeActivity()` function. This makes the code more predictable - profile sync no longer changes auth state.

### ✅ Fix 5: Consolidated Redirect Logic
**File:** [src/components/AppLockGuard.tsx](../src/components/AppLockGuard.tsx)

Removed the redundant inactivity check from AppLockGuard (it was duplicating what useActivityMonitor does). AppLockGuard now only handles lock-triggered redirects, not direct inactivity checks.

---

## Conclusion

The authentication and locking mechanism has been **significantly simplified**. The previous dual-tracking system has been consolidated into a single source of truth.

**Improvements Made:**
- ✅ Single activity tracking (auth store only)
- ✅ No more redirect loops from null `lastActivityAt`
- ✅ Unified timeout configuration
- ✅ Clear separation between profile sync and authentication
- ✅ Simplified redirect logic

**Key Strengths:**
- Secure (httpOnly cookies, bcrypt, CSRF)
- Offline-capable (IndexedDB + client-side PIN verification)
- User-friendly (manual lock + auto-lock + biometric)
- **Single source of truth for activity tracking**

**Remaining Considerations:**
- Complex sync logic between NextAuth and Zustand (architectural decision, not easily changed)
- `hasRedirectedRef` pattern still used (works, but could be refactored)

**Recommended Future Enhancements:**
1. Add state transition logging/debug mode (Priority 3)
2. Create visual state diagram documentation (Priority 3)
3. Consider persisting manual lock across refresh (Priority 3)

Overall assessment: **8.5/10** - Cleaner architecture with single source of truth for activity tracking. Remaining complexity is inherent to the NextAuth + Zustand dual-store approach.
