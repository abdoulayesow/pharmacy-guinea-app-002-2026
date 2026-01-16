# Architecture Technique

> Vue d'ensemble de l'architecture et des contraintes techniques

Ce document décrit l'architecture technique recommandée pour PharmGest, en tenant compte des contraintes spécifiques du contexte guinéen.

---

## Contraintes Techniques Critiques

### Environnement Cible

| Contrainte | Réalité | Implication Technique |
|------------|---------|----------------------|
| **Électricité** | < 12h/jour, coupures fréquentes | Offline-first obligatoire |
| **Connectivité** | 3G intermittente, données coûteuses | Bundle < 5MB, sync optimisé |
| **Appareils** | Android low-end (2GB RAM, Android 8+) | Performance critique |
| **Budget** | Limité | Solutions open-source privilégiées |

### Exigences Non-Fonctionnelles

| Exigence | Cible | Priorité |
|----------|-------|----------|
| Temps de chargement initial | < 3s sur 3G | P0 |
| Temps de recherche produit | < 500ms | P0 |
| Taille de l'application | < 5MB | P0 |
| Disponibilité offline | 100% des fonctions MVP | P0 |
| Sync après reconnexion | Automatique, < 30s | P0 |
| Perte de données | 0% | P0 |

---

## Architecture Globale

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              UTILISATEURS                                    │
│                    📱 Oumar        📱 Abdoulaye                            │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION PWA (Frontend)                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         React / Next.js                              │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ Connexion│ │  Ventes  │ │  Stocks  │ │ Dépenses │ │Dashboard │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┴─────────────────────────────────┐     │
│  │                      COUCHE DONNÉES LOCALE                         │     │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌───────────────┐  │     │
│  │  │   IndexedDB     │    │  Service Worker │    │  Sync Queue   │  │     │
│  │  │   (Dexie.js)    │    │   (Workbox)     │    │               │  │     │
│  │  └─────────────────┘    └─────────────────┘    └───────────────┘  │     │
│  └───────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ HTTPS (quand connecté)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Cloud)                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API REST (Node.js)                           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │   │
│  │  │   Auth   │ │   Sync   │ │  Backup  │ │ Analytics│               │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┴─────────────────────────────────┐     │
│  │                         PostgreSQL                                 │     │
│  │        (Supabase / Railway / DigitalOcean)                        │     │
│  └───────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Stack Technique Recommandée

### Frontend

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| **Framework** | React 18 + Next.js 14 | PWA support, SSG, performance |
| **State** | Zustand | Léger, simple, persiste bien |
| **UI** | Tailwind CSS | Bundle minimal, utility-first |
| **Offline DB** | Dexie.js (IndexedDB) | API simple, TypeScript support |
| **Service Worker** | Workbox | Caching robuste, background sync |
| **Forms** | React Hook Form | Performance, validation |
| **Icons** | Lucide React | Léger, tree-shakable |

### Backend

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| **Runtime** | Node.js 20 | Écosystème, performance |
| **Framework** | Express ou Fastify | Simple, éprouvé |
| **Database** | PostgreSQL | Robuste, gratuit |
| **ORM** | Prisma | Type-safe, migrations |
| **Auth** | JWT + PIN hash (bcrypt) | Simple, stateless |
| **Hosting** | Supabase / Railway | Gratuit tier, PostgreSQL inclus |

### Alternative: Backend-as-a-Service

Pour accélérer le développement, Supabase peut remplacer le backend custom:

```
┌─────────────────────────────────────────────────────┐
│                    SUPABASE                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐ │
│  │  Auth   │  │Database │  │ Storage │  │Realtime│ │
│  │(Row-level│  │PostgreSQL│  │ (files) │  │ (sync) │ │
│  │security)│  │         │  │         │  │        │ │
│  └─────────┘  └─────────┘  └─────────┘  └────────┘ │
└─────────────────────────────────────────────────────┘

Avantages: Moins de code backend, sync temps réel, gratuit jusqu'à 500MB
Inconvénients: Vendor lock-in, moins de contrôle
```

---

## Architecture Offline-First

### Principe de Base

```
RÈGLE D'OR: L'application doit fonctionner comme si elle était
            toujours offline. La connexion est un bonus.
```

### Flux de Données

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FLUX DE VENTE                                     │
└─────────────────────────────────────────────────────────────────────────────┘

1. UTILISATEUR CRÉE VENTE
   │
   ▼
2. SAUVEGARDE LOCALE IMMÉDIATE (IndexedDB)
   │
   ├── Stock local décrémenté
   ├── Vente ajoutée à la table locale
   └── Transaction ajoutée à la queue de sync
   │
   ▼
3. UI CONFIRME SUCCÈS (même si offline)
   │
   ▼
4. BACKGROUND SYNC (quand connecté)
   │
   ├── Service Worker détecte connexion
   ├── Envoie les transactions en queue
   ├── Serveur confirme réception
   └── Marque transactions comme sync'd
   │
   ▼
5. CONFLIT? (rare)
   │
   ├── Last-write-wins par défaut
   └── Log des conflits pour audit
```

### Structure de la Queue de Sync

```javascript
// Table: sync_queue (IndexedDB)
{
  id: "uuid-v4",
  type: "SALE" | "STOCK_ADJUSTMENT" | "EXPENSE",
  payload: { /* données de la transaction */ },
  created_at: "2026-01-15T10:30:00Z",
  status: "PENDING" | "SYNCING" | "SYNCED" | "FAILED",
  retry_count: 0,
  last_error: null
}
```

### Gestion des Conflits

| Scénario | Stratégie | Justification |
|----------|-----------|---------------|
| Même vente modifiée | Last-write-wins | Rare, timestamps précis |
| Stock négatif après sync | Alerte + ajustement | Évite blocage |
| Produit supprimé ailleurs | Soft delete + flag | Préserve l'historique |

---

## Modèle de Données

### Schéma Principal

```
┌─────────────────┐       ┌─────────────────┐
│    PRODUCTS     │       │     SALES       │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ name            │       │ created_at      │
│ price_sell      │◄──────│ total           │
│ price_buy       │       │ payment_method  │
│ stock_quantity  │       │ payment_ref     │
│ stock_min       │       │ synced          │
│ created_at      │       │ user_id (FK)    │
│ updated_at      │       └────────┬────────┘
│ synced          │                │
└─────────────────┘                │
                                   │
┌─────────────────┐       ┌────────┴────────┐
│    EXPENSES     │       │   SALE_ITEMS    │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ amount          │       │ sale_id (FK)    │
│ category        │       │ product_id (FK) │
│ description     │       │ quantity        │
│ date            │       │ unit_price      │
│ created_at      │       │ subtotal        │
│ synced          │       └─────────────────┘
│ user_id (FK)    │
└─────────────────┘       ┌─────────────────┐
                          │     USERS       │
┌─────────────────┐       ├─────────────────┤
│ STOCK_MOVEMENTS │       │ id (PK)         │
├─────────────────┤       │ name            │
│ id (PK)         │       │ pin_hash        │
│ product_id (FK) │       │ role            │
│ type            │       │ created_at      │
│ quantity_change │       └─────────────────┘
│ reason          │
│ created_at      │
│ user_id (FK)    │
│ synced          │
└─────────────────┘
```

### Types et Enums

```typescript
// Types TypeScript
type PaymentMethod = 'CASH' | 'ORANGE_MONEY';
type UserRole = 'OWNER' | 'EMPLOYEE';
type StockMovementType = 'SALE' | 'ADJUSTMENT' | 'INVENTORY' | 'DAMAGED' | 'EXPIRED';
type ExpenseCategory = 'STOCK_PURCHASE' | 'RENT' | 'SALARY' | 'ELECTRICITY' | 'TRANSPORT' | 'OTHER';
type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
```

---

## API Endpoints

### Authentication

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/verify-pin` | Vérifie le PIN, retourne JWT |
| POST | `/api/auth/refresh` | Rafraîchit le token |

### Sync

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/sync/push` | Envoie les transactions locales |
| GET | `/api/sync/pull` | Récupère les changements serveur |
| GET | `/api/sync/status` | Statut de synchronisation |

### Resources (CRUD standard)

| Resource | Endpoints |
|----------|-----------|
| Products | GET/POST/PUT/DELETE `/api/products` |
| Sales | GET/POST `/api/sales` |
| Expenses | GET/POST/PUT/DELETE `/api/expenses` |
| Stock Movements | GET/POST `/api/stock-movements` |

---

## Sécurité

### Authentification

```
┌─────────────────────────────────────────────────────────────────┐
│                      FLUX D'AUTHENTIFICATION                     │
└─────────────────────────────────────────────────────────────────┘

1. Utilisateur entre PIN (4 chiffres)
2. PIN hashé côté client (bcrypt)
3. Hash envoyé au serveur (si online) ou vérifié localement
4. JWT généré (expire 24h)
5. JWT stocké en mémoire (pas localStorage)
6. Refresh automatique avant expiration
```

### Mesures de Sécurité

| Mesure | Implementation |
|--------|----------------|
| PIN hashé | bcrypt avec salt |
| Blocage tentatives | 5 échecs = 30 min blocage |
| HTTPS | Obligatoire en production |
| JWT | Courte durée, refresh token |
| Données sensibles | Chiffrement au repos (optionnel V2) |

---

## Performance

### Budget de Taille

| Composant | Budget | Technique |
|-----------|--------|-----------|
| JavaScript | < 200KB gzipped | Code splitting, tree shaking |
| CSS | < 30KB gzipped | Tailwind purge |
| Images | < 50KB total | SVG, compression |
| Fonts | 0 (system fonts) | font-family: system-ui |
| **Total** | **< 300KB** | |

### Optimisations

```javascript
// Code splitting par route
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Sales = lazy(() => import('./pages/Sales'));
const Stocks = lazy(() => import('./pages/Stocks'));

// Préchargement des routes critiques
<link rel="prefetch" href="/sales" />

// Service Worker - Cache first pour assets
workbox.routing.registerRoute(
  /\.(?:js|css|png|svg)$/,
  new workbox.strategies.CacheFirst()
);

// IndexedDB - Index sur champs de recherche
db.products.createIndex('name', 'name');
db.products.createIndex('stock_quantity', 'stock_quantity');
```

### Métriques à Surveiller

| Métrique | Outil | Cible |
|----------|-------|-------|
| First Contentful Paint | Lighthouse | < 1.5s |
| Time to Interactive | Lighthouse | < 3s |
| Largest Contentful Paint | Lighthouse | < 2.5s |
| Bundle size | webpack-bundle-analyzer | < 300KB |

---

## Déploiement

### Environnements

| Env | URL | Usage |
|-----|-----|-------|
| Development | localhost:3000 | Dev local |
| Staging | staging.pharmgest.app | Tests |
| Production | app.pharmgest.app | Utilisateurs |

### CI/CD Pipeline

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Push   │───▶│  Build  │───▶│  Test   │───▶│ Deploy  │
│  (Git)  │    │         │    │         │    │         │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
                   │              │              │
                   ▼              ▼              ▼
              - npm install   - Unit tests   - Vercel/Netlify
              - npm build     - E2E tests    - Preview URL
              - Lint          - Lighthouse   - Prod (main)
```

### Hébergement Recommandé

| Composant | Service | Coût |
|-----------|---------|------|
| Frontend (PWA) | Vercel | Gratuit |
| Backend API | Railway / Render | Gratuit tier |
| Database | Supabase / Railway | Gratuit tier |
| Monitoring | Sentry | Gratuit tier |

---

## Checklist Technique MVP

### Avant Développement
- [ ] Setup repo Git
- [ ] Setup CI/CD (GitHub Actions)
- [ ] Setup environnements (dev, staging, prod)
- [ ] Créer schéma DB avec migrations

### Pendant Développement
- [ ] PWA manifest configuré
- [ ] Service Worker avec Workbox
- [ ] IndexedDB avec Dexie
- [ ] Sync queue implémentée
- [ ] Tests offline manuels

### Avant Lancement
- [ ] Lighthouse score > 90
- [ ] Tests E2E passent
- [ ] Backup DB automatique
- [ ] Monitoring en place
- [ ] Documentation API

---

*Document créé dans le cadre du Product Discovery — PharmGest*
