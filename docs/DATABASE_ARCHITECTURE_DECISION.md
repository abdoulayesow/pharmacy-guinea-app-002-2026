# Database Architecture Decision: IndexedDB vs PostgreSQL as Primary

**Date**: 2026-01-16
**Status**: Decision Required
**Priority**: High (Architectural)
**Impact**: Entire sync architecture

---

## Current State Summary

### Phase 2 Completion Status

**✅ Completed Features:**
- Phase 1: MVP (all features)
- Phase 2: Multi-user sync & security
  - Bidirectional sync (push/pull)
  - Background sync (every 5 min)
  - Data integrity audit
  - Force refresh
  - App locking & biometric auth
  - JWT security & CSRF protection

**📋 Remaining Work:**
- Phase 3: Consolidation
  - Expiration alerts (FEFO)
  - Advanced reports
  - 10 pharmacies rollout
- Phase 4: Expansion
  - Wholesaler integration
  - Predictive analytics
  - West Africa expansion (100+ pharmacies)

**🔧 Optional P3 Enhancements (from P2 summary):**
- Add audit for SaleItems, SupplierOrders
- Add "Auto-fix" button to resolve mismatches
- Add selective refresh (e.g., "Refresh products only")
- Add audit history/log

---

## Current Architecture

### Dual-Database System

```
┌─────────────────────────────────────────────────────────────┐
│                    Current Architecture                      │
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  IndexedDB       │ ←sync→  │  PostgreSQL      │          │
│  │  (PRIMARY)       │         │  (BACKUP)        │          │
│  │                  │         │                  │          │
│  │  • Immediate     │  push   │  • Multi-user    │          │
│  │  • Offline-first │  ────→  │  • Source of     │          │
│  │  • User actions  │         │    truth         │          │
│  │    write here    │  ←────  │  • Conflict      │          │
│  │                  │  pull   │    resolution    │          │
│  └──────────────────┘         └──────────────────┘          │
│         Client                        Server                 │
└─────────────────────────────────────────────────────────────┘

Data Flow:
1. User creates sale → IndexedDB (instant)
2. UI updates immediately (optimistic)
3. Background: Push to PostgreSQL
4. Background: Pull changes from other users
5. Merge remote changes into IndexedDB
```

### Key Characteristics

| Aspect | IndexedDB | PostgreSQL |
|--------|-----------|------------|
| **Role** | Primary store | Backup + multi-user sync |
| **Write Path** | Immediate | Queued via sync |
| **Read Path** | Direct | Via sync pull |
| **Offline** | 100% functional | Not accessible |
| **Multi-User** | Via pull sync | Native |
| **Conflict Resolution** | Last-write-wins (server) | Last-write-wins (updatedAt) |
| **Data Loss Risk** | Device failure/cache clear | Very low |

---

## Alternative Architecture: PostgreSQL as Primary

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Proposed Architecture                     │
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  IndexedDB       │ ←sync→  │  PostgreSQL      │          │
│  │  (CACHE)         │         │  (PRIMARY)       │          │
│  │                  │         │                  │          │
│  │  • Read cache    │  pull   │  • All writes    │          │
│  │  • Offline queue │  ────→  │  • Source of     │          │
│  │  • Optimistic UI │         │    truth         │          │
│  │                  │  ←────  │  • Multi-user    │          │
│  │  • When offline: │  push   │  • ACID          │          │
│  │    queue writes  │         │                  │          │
│  └──────────────────┘         └──────────────────┘          │
│         Client                        Server                 │
└─────────────────────────────────────────────────────────────┘

Data Flow (ONLINE):
1. User creates sale → PostgreSQL API call
2. On success: Update IndexedDB cache
3. UI updates with confirmed data

Data Flow (OFFLINE):
1. User creates sale → IndexedDB + sync queue
2. UI updates optimistically
3. When online: Push queued changes to PostgreSQL
4. On conflict: Server wins (or merge strategy)
```

---

## Pros & Cons Analysis

### Current Architecture (IndexedDB Primary)

#### ✅ Pros

1. **Offline-First Performance**
   - Zero latency for all operations (instant writes)
   - No network dependency for core functionality
   - Optimistic UI updates (feels faster)

2. **Resilience**
   - App works perfectly offline (critical for Guinea's power issues)
   - No "waiting for server" states
   - Graceful degradation

3. **Implementation Simplicity**
   - Already implemented and working
   - No complex API error handling in UI
   - Sync is background concern

4. **User Experience**
   - Instant feedback on all actions
   - No "loading" states for CRUD operations
   - Works during server downtime

5. **Cost**
   - Minimal API calls (only sync operations)
   - Less database load (reads from local)
   - Lower Vercel/Neon costs

#### ❌ Cons

1. **Data Integrity Risks**
   - IndexedDB can be cleared by browser (user action, storage pressure)
   - No ACID guarantees
   - Potential data loss if device fails before sync
   - Schema migrations are manual and error-prone

2. **Multi-User Complexity**
   - Conflict resolution is "best effort" (last-write-wins)
   - No transactional guarantees across users
   - Pull sync can overwrite local unsaved changes
   - Race conditions possible

3. **Debugging Difficulty**
   - Can't inspect IndexedDB easily (need DevTools on user device)
   - Hard to reproduce bugs (local state varies)
   - No central audit trail

4. **Schema Divergence**
   - Two schemas to maintain (IndexedDB + PostgreSQL)
   - Risk of drift between client and server
   - Migration complexity (need to version both)

5. **Data Recovery**
   - If IndexedDB corrupted, need "force refresh" (nuclear option)
   - No point-in-time recovery for local data
   - User loses unsaved changes on device failure

6. **Reporting & Analytics**
   - Can't query IndexedDB from server
   - Need to sync all data to server for reports
   - No real-time analytics

---

### Alternative Architecture (PostgreSQL Primary)

#### ✅ Pros

1. **Data Integrity**
   - ACID transactions (atomicity, consistency, isolation, durability)
   - No data loss (PostgreSQL is durable)
   - Single source of truth (no sync conflicts)
   - Transactional guarantees

2. **Multi-User Support**
   - Native concurrency control
   - Proper locking and isolation
   - Conflict resolution at database level
   - Real-time updates possible (via webhooks/websockets)

3. **Debugging & Observability**
   - Central audit trail (all operations logged)
   - Easy to inspect data (SQL queries)
   - Can reproduce bugs from server logs
   - Monitoring and alerting

4. **Schema Management**
   - Single schema to maintain (Prisma)
   - Migrations managed by Prisma
   - No drift between client/server
   - Easier to evolve data model

5. **Reporting & Analytics**
   - Direct SQL queries on production data
   - Real-time dashboards
   - Advanced analytics possible
   - No sync delay for reports

6. **Data Recovery**
   - Point-in-time recovery (PITR)
   - Database backups (Neon automated)
   - No user data loss on device failure

#### ❌ Cons

1. **Network Dependency**
   - CRITICAL: Requires internet for all operations
   - No offline writes (only queued, not confirmed)
   - Fails during power outages (common in Guinea)
   - Latency on every operation (3G is slow)

2. **Performance**
   - Network latency on every write (100-500ms on 3G)
   - Loading states needed for all operations
   - Slower user experience
   - More API calls = higher costs

3. **User Experience**
   - "Saving..." spinners everywhere
   - Error handling needed for every action
   - No instant feedback
   - Frustrating on slow/unreliable networks

4. **Implementation Complexity**
   - Need to rewrite all CRUD operations to API calls
   - Complex offline queue management
   - Optimistic updates still needed (for UX)
   - API error handling in every component

5. **Cost**
   - More API calls (every write, not batched)
   - Higher database load (read + write traffic)
   - Higher Vercel costs (more serverless invocations)
   - Higher Neon costs (more queries)

6. **Offline Capability**
   - Requires complex offline queue (like current sync queue)
   - Conflict resolution still needed (offline → online)
   - No better than current architecture for offline scenario

---

## Critical Constraint Analysis

### Guinea Context

| Constraint | Impact on Architecture Choice |
|------------|------------------------------|
| **Electricity: < 12h/day** | **FAVOR IndexedDB**: Need offline-first |
| **Connectivity: Intermittent 3G** | **FAVOR IndexedDB**: Avoid network dependency |
| **Data Cost: Expensive** | **FAVOR IndexedDB**: Minimize API calls |
| **Devices: Low-end Android** | **FAVOR IndexedDB**: Instant local operations |
| **Users: Non-technical** | **FAVOR IndexedDB**: No "loading" frustration |
| **Multi-user: 1 owner + 2 employees** | **NEUTRAL**: 3 users, not 100+ (conflicts rare) |

### Risk Assessment

| Risk | IndexedDB Primary | PostgreSQL Primary |
|------|-------------------|-------------------|
| **Data loss (device failure)** | Medium (before sync) | None (instant server write) |
| **Data loss (browser clear)** | High (user action) | None (only cache cleared) |
| **Offline operation failure** | None (100% works) | **CRITICAL** (no writes possible) |
| **Sync conflict** | Low (3 users, infrequent) | Low (handled by DB) |
| **Network failure** | None (transparent) | **CRITICAL** (app unusable) |
| **Schema migration bug** | Medium (dual schema) | Low (single schema) |
| **Cost overrun** | Low (minimal API calls) | Medium (every write = API call) |

---

## Recommendation

### **Keep IndexedDB as Primary** ✅

**Rationale:**

1. **Non-Negotiable Offline Requirement**
   - < 12h electricity/day in Guinea
   - Intermittent 3G connectivity
   - App MUST work offline (stated in CLAUDE.md: "OFFLINE-FIRST mandatory")
   - PostgreSQL-primary architecture fundamentally incompatible with this constraint

2. **Current Architecture is Correct for Context**
   - Already implemented and working
   - Matches offline-first requirement perfectly
   - Proven pattern (used by Gmail, Google Docs, etc.)

3. **Multi-User Conflicts Are Rare**
   - Only 3 users (1 owner + 2 employees)
   - Different shift times (unlikely to edit same record simultaneously)
   - Last-write-wins is acceptable for this scale

4. **Migration Cost > Benefit**
   - Massive rewrite (every CRUD operation → API call)
   - Introduces network latency to every action
   - No benefit for 3-user pharmacy
   - Better to invest in P3 features

5. **Data Integrity Risks Are Manageable**
   - Already implemented: Data integrity audit (detect issues)
   - Already implemented: Force refresh (recover from corruption)
   - Can add: Auto-backup to PostgreSQL (periodic snapshots)
   - Can add: IndexedDB export/import for manual backup

---

## Mitigation Strategies for IndexedDB Risks

### 1. Data Loss Prevention

**Problem**: IndexedDB cleared by browser or device failure
**Solutions**:
- ✅ **Already implemented**: Background sync every 5 min (minimizes data loss window)
- ✅ **Already implemented**: Force refresh to restore from server
- 🔧 **P3 enhancement**: Periodic full IndexedDB backup to localStorage (redundancy)
- 🔧 **P3 enhancement**: "Export data" button (manual backup to JSON file)
- 🔧 **P3 enhancement**: Aggressive sync on every transaction (opt-in for paranoid mode)

### 2. Schema Divergence

**Problem**: IndexedDB and PostgreSQL schemas drift
**Solutions**:
- ✅ **Already implemented**: Shared types in `src/lib/shared/types.ts`
- ✅ **Already implemented**: Data integrity audit (detects mismatches)
- 🔧 **P3 enhancement**: Automated schema validation on app load
- 🔧 **P3 enhancement**: Migration tests (ensure both schemas migrate together)
- 🔧 **P3 enhancement**: Schema documentation generator (auto-sync docs)

### 3. Conflict Resolution

**Problem**: Last-write-wins can overwrite changes
**Solutions**:
- ✅ **Already implemented**: Conflict resolution based on `updatedAt`
- 🔧 **P3 enhancement**: "Edit lock" (optimistic locking with version numbers)
- 🔧 **P3 enhancement**: Conflict detection UI ("Another user edited this")
- 🔧 **P3 enhancement**: Audit log of overwrites (for debugging)

### 4. Debugging Difficulty

**Problem**: Can't inspect IndexedDB remotely
**Solutions**:
- ✅ **Already implemented**: Data integrity audit (remote inspection via API)
- 🔧 **P3 enhancement**: "Share debug snapshot" button (export IndexedDB → server)
- 🔧 **P3 enhancement**: Remote debugging endpoint (send IndexedDB state via API)
- 🔧 **P3 enhancement**: Sentry integration (capture IndexedDB state on errors)

### 5. Reporting & Analytics

**Problem**: Can't query IndexedDB from server
**Solutions**:
- ✅ **Already implemented**: Sync to PostgreSQL (delayed but complete)
- 🔧 **P3 enhancement**: Real-time analytics sync (push metrics on transactions)
- 🔧 **P3 enhancement**: Aggregate queries via API (fetch stats from client)
- 🔧 **P3 enhancement**: Export to CSV/Excel (client-side reporting)

---

## Alternative: Hybrid Architecture (Future Consideration)

For Phase 4 (100+ pharmacies), consider a **hybrid approach**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Hybrid Architecture                       │
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  IndexedDB       │         │  PostgreSQL      │          │
│  │                  │         │                  │          │
│  │  • When ONLINE:  │  sync   │  • Primary for   │          │
│  │    Write to both │ ═════→  │    critical data │          │
│  │    (optimistic + │         │    (sales, $$$)  │          │
│  │     confirmed)   │         │                  │          │
│  │                  │  ←═════  │  • Secondary for │          │
│  │  • When OFFLINE: │  sync   │    non-critical  │          │
│  │    Queue writes  │         │    (inventory)   │          │
│  └──────────────────┘         └──────────────────┘          │
└─────────────────────────────────────────────────────────────┘

Critical transactions (sales, money) → PostgreSQL PRIMARY
Non-critical (inventory adjustments) → IndexedDB PRIMARY
```

**When to consider this**:
- 100+ pharmacies (more conflict potential)
- Financial auditing requirements
- Real-time inventory across locations
- Advanced analytics needs

**Not now because**:
- 3 users don't need this complexity
- Offline-first is paramount
- Implementation cost too high for Phase 2/3

---

## Decision Matrix

| Criteria | Weight | IndexedDB Primary | PostgreSQL Primary | Winner |
|----------|--------|-------------------|-------------------|--------|
| Offline capability | 🔴 CRITICAL | ✅ Perfect | ❌ Fails | **IndexedDB** |
| Data integrity | 🟡 High | ⚠️ Manageable | ✅ Perfect | PostgreSQL |
| Multi-user support | 🟢 Medium | ⚠️ Good enough | ✅ Perfect | PostgreSQL |
| Performance (UX) | 🟡 High | ✅ Instant | ❌ Slow (3G) | **IndexedDB** |
| Implementation cost | 🟢 Medium | ✅ Done | ❌ Massive rewrite | **IndexedDB** |
| Cost (Vercel/Neon) | 🟢 Medium | ✅ Low | ❌ High | **IndexedDB** |
| Debugging/Observability | 🟢 Medium | ⚠️ Harder | ✅ Easier | PostgreSQL |
| Reporting/Analytics | 🟢 Low | ⚠️ Delayed | ✅ Real-time | PostgreSQL |
| **TOTAL** | | **✅ IndexedDB** | ❌ PostgreSQL | **IndexedDB** |

**Legend**: 🔴 Critical = Deal-breaker | 🟡 High = Very important | 🟢 Medium/Low = Nice to have

**Critical constraint**: Offline capability is non-negotiable for Guinea context → IndexedDB wins

---

## Action Items

### Immediate (Keep Current Architecture)
1. ✅ **No change needed** - current architecture is correct
2. ✅ **Document decision** - this file serves as record
3. 📋 **Continue with Phase 3** - build on current foundation

### P3 Enhancements (Mitigate IndexedDB Risks)
1. **Data Loss Prevention**:
   - [ ] Periodic IndexedDB backup to localStorage (P3)
   - [ ] "Export data" button for manual backup (P3)
   - [ ] Aggressive sync mode (opt-in, sync every transaction) (P3)

2. **Schema Management**:
   - [ ] Automated schema validation on app load (P3)
   - [ ] Migration tests (CI/CD) (P3)
   - [ ] Schema documentation generator (P3)

3. **Debugging Tools**:
   - [ ] "Share debug snapshot" button (P3)
   - [ ] Remote debugging endpoint (P3)
   - [ ] Sentry integration for IndexedDB errors (P3)

4. **Conflict Resolution**:
   - [ ] Edit lock (optimistic locking) (P3)
   - [ ] Conflict detection UI (P3)
   - [ ] Audit log of overwrites (P3)

### Phase 4 Considerations (100+ Pharmacies)
- [ ] Reevaluate architecture for scale (P4)
- [ ] Consider hybrid architecture for critical transactions (P4)
- [ ] Real-time sync via WebSockets/SSE (P4)
- [ ] Distributed conflict resolution (CRDTs?) (P4)

---

## Conclusion

**Decision: KEEP INDEXEDDB AS PRIMARY** ✅

**Reasoning**:
1. Offline-first is non-negotiable for Guinea context
2. Current architecture is correct for 3-user pharmacy
3. Migration cost massively outweighs benefits
4. Data integrity risks are manageable with P3 enhancements
5. Focus development time on Phase 3 features, not rearchitecture

**Next Steps**:
1. Continue with Phase 3 feature development
2. Implement P3 enhancements to mitigate IndexedDB risks
3. Reevaluate at Phase 4 (100+ pharmacies)

**Confidence Level**: 95% (very high confidence this is the right decision)

---

*This decision is based on the specific constraints of the Seri project (Guinea context, 3 users, offline-first mandate). For different contexts (always-online, 1000+ users, financial critical), PostgreSQL-primary might be correct.*
