# Vision Produit

> Permettre aux pharmacies indépendantes d'Afrique francophone de prospérer

---

## Product Vision Board

### 🎯 Vision

**Permettre aux pharmacies indépendantes d'Afrique francophone de prospérer grâce à une technologie simple et fiable, adaptée à leur réalité.**

---

### 👥 Groupe Cible

**Propriétaires et employés de petites pharmacies indépendantes** à Conakry et marchés similaires en Afrique de l'Ouest francophone, qui:

- Passent d'Excel/papier vers le numérique
- Ont 1-5 employés
- Font face à la concurrence des vendeurs illicites et des chaînes
- Subissent des coupures de courant et une connectivité intermittente
- Cherchent une solution simple, pas une usine à gaz

### Caractéristiques du Marché Cible

| Caractéristique | Détail |
|-----------------|--------|
| **Géographie initiale** | Conakry, Guinée |
| **Expansion future** | Afrique de l'Ouest francophone (Sénégal, Côte d'Ivoire, Mali) |
| **Taille pharmacie** | 1-5 employés |
| **CA estimé** | 10-50 millions GNF/mois |
| **Niveau tech** | Smartphones Android, connectivité 3G/4G intermittente |

---

### 🎯 Besoins Fondamentaux

| Besoin | Importance | Couvert MVP |
|--------|------------|-------------|
| Savoir exactement ce qu'ils ont en stock à tout moment | 🔴 Critique | ✅ |
| Être alertés avant les ruptures de stock | 🔴 Critique | ✅ |
| Être alertés avant les péremptions | 🟠 Important | V2 |
| Enregistrer les ventes rapidement (cash + Orange Money) | 🔴 Critique | ✅ |
| Suivre les dépenses | 🟠 Important | ✅ |
| Comprendre leur rentabilité | 🟠 Important | Partiel |
| Fonctionner même sans connexion internet | 🔴 Critique | ✅ |
| Conformité réglementaire (FEFO, traçabilité) | 🟠 Important | V2 |

---

### 📱 Le Produit

**PharmGest** — Application mobile-first (PWA) de gestion de pharmacie

#### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    APPLICATION PWA                       │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┐   │
│  │ Connexion│ Ventes  │ Stocks  │Dépenses │Dashboard│   │
│  └─────────┴─────────┴─────────┴─────────┴─────────┘   │
│                         │                               │
│              ┌──────────┴──────────┐                   │
│              │   IndexedDB Local   │                   │
│              │   (Offline-first)   │                   │
│              └──────────┬──────────┘                   │
│                         │                               │
│              ┌──────────┴──────────┐                   │
│              │   Background Sync   │                   │
│              │   (Quand connecté)  │                   │
│              └──────────┬──────────┘                   │
└─────────────────────────┼───────────────────────────────┘
                          │
                ┌─────────┴─────────┐
                │   Backend Cloud   │
                │   (PostgreSQL)    │
                └───────────────────┘
```

#### Fonctionnalités Clés

| Module | Fonctionnalité | Bénéfice |
|--------|----------------|----------|
| **Connexion** | PIN 4 chiffres, profils | Accès rapide, sécurisé |
| **Ventes** | Recherche produit, panier, paiement | Transaction en < 30 sec |
| **Stocks** | Liste temps réel, alertes automatiques | Zéro rupture surprise |
| **Dépenses** | Saisie catégorisée, historique | Visibilité financière |
| **Dashboard** | KPIs du jour, alertes | Décision en un coup d'œil |

---

### ⭐ Différenciateurs

**Contrairement aux logiciels POS génériques ou aux solutions legacy complexes:**

| Nous | Eux |
|------|-----|
| 🌍 Conçu pour les réalités guinéennes (coupures, connectivité) | ❌ Supposent connexion permanente |
| 📝 Interface inspirée des registres papier | ❌ Interfaces complexes, menus profonds |
| 💊 Conformité FEFO intégrée | ❌ Fonctionnalité en option ou absente |
| 💰 Prix adapté aux petites structures | ❌ Tarifs pour grandes pharmacies |
| 🇫🇷 100% français, adapté culturellement | ❌ Traductions approximatives |
| 📱 Mobile-first (pas d'ordinateur requis) | ❌ Nécessitent PC + imprimante |
| ⚡ Fonctionne offline | ❌ Inutilisables sans internet |

### Positionnement Concurrentiel

```
                    COMPLEXITÉ
                        ↑
          Solutions     │     ERP Pharma
          Legacy        │     (Sage, etc.)
                        │
        ────────────────┼────────────────→ PRIX
                        │
          Excel/        │     PharmGest
          Papier        │     ← NOUS
                        │
                    SIMPLICITÉ
```

---

## Elevator Pitch

> Version courte (30 secondes)

**POUR** les propriétaires et employés de petites pharmacies à Conakry

**QUI** luttent avec la gestion papier/Excel et la concurrence des vendeurs illicites,

**PharmGest** EST UNE application mobile de gestion

**QUI** simplifie les opérations quotidiennes avec un suivi des stocks offline, des alertes intelligentes, et l'intégration Orange Money.

**CONTRAIREMENT** aux logiciels POS génériques ou aux solutions legacy complexes,

**NOTRE PRODUIT** est conçu pour la réalité guinéenne: coupures de courant, connectivité intermittente, et petites équipes en transition du papier vers le numérique.

---

## Value Proposition Canvas

### Profil Client (Mamadou)

| Jobs to be Done | Douleurs | Gains Attendus |
|-----------------|----------|----------------|
| Gérer les stocks | Périmés = pertes | Moins de pertes |
| Enregistrer les ventes | Comptage manuel long | Temps économisé |
| Suivre la trésorerie | Incertitude | Visibilité claire |
| Former les employés | Semaines de formation | Formation rapide |
| Rester conforme | Stress réglementaire | Tranquillité |

### Notre Proposition

| Pain Relievers | Gain Creators |
|----------------|---------------|
| Alertes péremption automatiques | Dashboard rentabilité |
| Calculs automatiques | Interface intuitive (< 3 min onboarding) |
| Rapport journalier automatique | Indicateurs feu tricolore |
| Interface simple = formation rapide | Historique pour audits |
| FEFO intégré | Compétitivité face aux chaînes |

---

## Vision à Long Terme

### Phase 1: MVP (Ce projet)
- Gestion stocks + ventes + dépenses
- Offline-first
- 1 pharmacie pilote

### Phase 2: Consolidation
- Alertes péremption (FEFO)
- Multi-utilisateurs complet
- Rapports avancés
- 10 pharmacies

### Phase 3: Expansion
- Intégration grossistes (commandes automatiques)
- Analytics prédictifs
- Expansion Afrique de l'Ouest
- 100+ pharmacies

### Phase 4: Écosystème
- Marketplace inter-pharmacies
- Intégration assurances
- API ouverte
- Plateforme régionale

---

## Métriques de Succès Vision

| Horizon | Métrique | Cible |
|---------|----------|-------|
| **6 mois** | Pharmacies actives | 5 |
| **1 an** | Transactions/mois | 10 000 |
| **2 ans** | Pharmacies actives | 100 |
| **3 ans** | Pays couverts | 3 |

---

*Document créé dans le cadre du Product Discovery — PharmGest*
