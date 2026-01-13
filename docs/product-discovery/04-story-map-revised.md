# Story Map (Révisé)

> Version mise à jour suite à l'interview terrain — Janvier 2026

---

## Changements par rapport à la Version Initiale

| Élément | Avant | Après | Raison |
|---------|-------|-------|--------|
| Alertes péremption | V2 | **MVP** | Pain point #1 validé |
| Module fournisseurs | Non prévu | **MVP** | Crédit + paiements différés = critique |
| Suivi des retours | Non prévu | **MVP** | Lié aux paiements fournisseurs |
| Priorité alertes stock | P0 | **P0** | Confirmé "change their life" |

---

## Vue d'Ensemble Révisée

```
ACTIVITÉS    🔐 CONNEXION    💰 VENTES       📦 STOCKS        💸 DÉPENSES     📊 DASHBOARD    🏭 FOURNISSEURS
             ────────────    ──────────      ──────────       ───────────     ────────────    ───────────────
TÂCHES       → S'authentifier → Chercher     → Voir           → Enregistrer   → Voir résumé   → Commander
             → Choisir rôle    → Créer vente   inventaire     → Catégoriser   → Analyser      → Réceptionner
                              → Paiement     → Alertes        → Consulter                     → Payer
                                             → Ajuster                                        → Retourner
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MVP          • PIN 4 chiffres • Recherche    • Liste          • Saisie        • Total jour    • Liste 
             • Profils        • Panier         produits       • Catégories    • Alertes         fournisseurs
             • Session        • Cash/OM      • Stock bas        (+ Fournisseur)• Cash vs OM   • Paiements
                             • Reçu         • PÉREMPTION 🆕  • Historique    • Dettes 🆕       en attente
                                           • Ajustement                                      • Retours 🆕
                                           • Ajout produit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
V2           • Reset PIN      • Remises      • Import/Export  • Photo reçu    • Tendances     • Commandes
             • Multi-users    • Retours      • Analyse ABC    • Récurrentes   • Marge brute     automatiques
                             • Historique   • Lots/Batch                     • Exports       • Historique
                               client                                                          complet
```

---

## 🆕 Module Fournisseurs (NOUVEAU)

### Contexte Business

> Les pharmacies fonctionnent en **crédit fournisseur**: elles commandent, reçoivent sous 1-2 semaines, et paient jusqu'à 1 mois plus tard. Elles peuvent aussi **retourner les produits** proches de péremption et déduire le montant du prochain paiement.

### MVP Stories — Fournisseurs

#### FOU-01: Liste des Fournisseurs
**En tant que** propriétaire  
**Je veux** voir la liste de mes fournisseurs  
**Afin de** savoir à qui je dois de l'argent

**Critères d'acceptation:**
- [ ] Liste avec nom, téléphone, montant dû
- [ ] Indicateur visuel si paiement proche/en retard
- [ ] Tap pour voir le détail

**Taille:** S | **Priorité:** P1

---

#### FOU-02: Enregistrer un Paiement en Attente
**En tant que** propriétaire  
**Je veux** enregistrer une commande reçue avec paiement différé  
**Afin de** suivre ce que je dois

**Critères d'acceptation:**
- [ ] Sélection du fournisseur
- [ ] Montant de la commande
- [ ] Date de livraison
- [ ] Date d'échéance de paiement (défaut: +30 jours)
- [ ] Statut: EN ATTENTE

**Taille:** M | **Priorité:** P0

---

#### FOU-03: Marquer un Paiement Effectué
**En tant que** propriétaire  
**Je veux** marquer une dette comme payée  
**Afin de** mettre à jour mes obligations

**Critères d'acceptation:**
- [ ] Bouton "Marquer comme payé"
- [ ] Date de paiement (défaut: aujourd'hui)
- [ ] Montant payé (peut être partiel)
- [ ] Mise à jour du solde dû
- [ ] Option: lier à une dépense

**Taille:** M | **Priorité:** P0

---

#### FOU-04: Enregistrer un Retour Fournisseur
**En tant que** propriétaire  
**Je veux** enregistrer un retour de produit au fournisseur  
**Afin de** déduire le montant de ma prochaine facture

**Critères d'acceptation:**
- [ ] Sélection du fournisseur
- [ ] Produit retourné
- [ ] Quantité
- [ ] Motif: Proche péremption / Endommagé / Autre
- [ ] Montant du crédit
- [ ] Lier au paiement en attente (déduction automatique)

**Taille:** M | **Priorité:** P1

---

#### FOU-05: Vue des Dettes Totales
**En tant que** propriétaire  
**Je veux** voir le total de mes dettes fournisseurs  
**Afin de** gérer ma trésorerie

**Critères d'acceptation:**
- [ ] Total des paiements en attente
- [ ] Total des retours (crédits)
- [ ] Solde net à payer
- [ ] Liste des échéances à venir
- [ ] Alerte si échéance proche (< 7 jours)

**Taille:** S | **Priorité:** P1

---

## 📦 Module Stocks (Révisé)

### Stories Modifiées

#### STO-05: Alertes Péremption (DÉPLACÉ AU MVP)
**En tant que** gestionnaire  
**Je veux** être alerté quand un produit approche de sa date de péremption  
**Afin de** le vendre en priorité ou le retourner au fournisseur

**Critères d'acceptation:**
- [ ] Date de péremption par lot/produit
- [ ] Alerte 30 jours avant péremption (configurable)
- [ ] Liste "Produits à surveiller" accessible en 1 tap
- [ ] Indicateur couleur: 🟡 < 60 jours, 🔴 < 30 jours
- [ ] Badge compteur sur Dashboard
- [ ] Option: "Retourner au fournisseur" (lien FOU-04)

**Taille:** L | **Priorité:** P0 🆕

---

#### STO-04: Ajout Produit (Révisé)
**En tant que** gestionnaire  
**Je veux** ajouter un nouveau produit avec sa date de péremption  
**Afin d'** avoir un suivi complet

**Critères d'acceptation:**
- [ ] Champs: nom, prix vente, prix achat, seuil alerte, stock initial
- [ ] **🆕 Date de péremption (optionnel mais recommandé)**
- [ ] **🆕 Numéro de lot (optionnel)**
- [ ] Validation format prix
- [ ] Détection doublons

**Taille:** M | **Priorité:** P1

---

## 💸 Module Dépenses (Révisé)

### Stories Modifiées

#### DEP-02: Catégories Dépenses (Révisé)
**En tant que** propriétaire  
**Je veux** catégoriser les dépenses  
**Afin d'** analyser où part mon argent

**Critères d'acceptation:**
- [ ] Catégories prédéfinies:
  - Achats stock
  - **🆕 Paiement fournisseur** (lien avec module fournisseurs)
  - Loyer
  - Salaires
  - Électricité
  - Transport
  - Autres
- [ ] Sélection par dropdown
- [ ] Icône par catégorie

**Taille:** S | **Priorité:** P1

---

## 📊 Module Dashboard (Révisé)

### Stories Modifiées

#### DAS-04: Alertes Péremption sur Dashboard (NOUVEAU)
**En tant que** propriétaire  
**Je veux** voir combien de produits approchent de la péremption  
**Afin d'** agir avant qu'ils expirent

**Critères d'acceptation:**
- [ ] Compteur "X produits expirent bientôt"
- [ ] Couleur: vert (0), jaune (1-5), rouge (6+)
- [ ] Tap pour voir la liste détaillée
- [ ] Distinct des alertes stock bas

**Taille:** S | **Priorité:** P0 🆕

---

#### DAS-05: Dettes Fournisseurs sur Dashboard (NOUVEAU)
**En tant que** propriétaire  
**Je veux** voir mes dettes fournisseurs en un coup d'œil  
**Afin de** ne pas oublier de payer

**Critères d'acceptation:**
- [ ] Montant total dû
- [ ] Prochain paiement: montant + date + fournisseur
- [ ] Alerte si échéance < 7 jours
- [ ] Tap pour accéder au module fournisseurs

**Taille:** S | **Priorité:** P1 🆕

---

## Story Map Visuelle Révisée

### MVP — Vue Complète

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    MVP PHARMGEST                                         │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬──────────────────┤
│  CONNEXION  │   VENTES    │   STOCKS    │  DÉPENSES   │  DASHBOARD  │  FOURNISSEURS 🆕 │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┼──────────────────┤
│             │             │             │             │             │                  │
│ • PIN 4     │ • Recherche │ • Liste     │ • Saisie    │ • Ventes    │ • Liste          │
│   chiffres  │   produit   │   produits  │   dépense   │   du jour   │   fournisseurs   │
│             │             │             │             │             │                  │
│ • Profils   │ • Panier    │ • Alertes   │ • Catégories│ • Alertes   │ • Paiements      │
│   (proprio/ │             │   STOCK BAS │   (avec     │   stock     │   en attente     │
│   employé)  │             │             │   fourniss.)│             │                  │
│             │ • Paiement  │ • Alertes   │             │ • Alertes   │ • Marquer        │
│ • Session   │   Cash/OM   │   PÉREMPT.  │ • Historique│   pérempt.  │   payé           │
│   mémorisée │             │   🆕        │   filtrable │   🆕        │                  │
│             │ • Reçu      │             │             │             │ • Retours        │
│             │   digital   │ • Ajustement│             │ • Cash vs   │   🆕             │
│             │             │   manuel    │             │   OM        │                  │
│             │ • Offline   │             │             │             │ • Dettes         │
│             │             │ • Ajout     │             │ • Dettes    │   totales        │
│             │             │   produit   │             │   fourniss. │                  │
│             │             │   (+ date   │             │   🆕        │                  │
│             │             │   pérempt.) │             │             │                  │
│             │             │             │             │             │                  │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴──────────────────┘
```

---

## Backlog Réorganisé

### MVP (Sprint 1-4)

| Module | Story | Priorité | Effort |
|--------|-------|----------|--------|
| Connexion | PIN + Profils + Session | P0 | M |
| Ventes | Recherche + Panier + Paiement + Offline | P0 | L |
| Stocks | Liste + Alertes stock bas | P0 | M |
| **Stocks** | **Alertes péremption** 🆕 | **P0** | **L** |
| Dashboard | Ventes jour + Alertes + Cash/OM | P0 | M |
| Dépenses | Saisie + Catégories + Historique | P1 | M |
| **Fournisseurs** | **Paiements en attente** 🆕 | **P1** | **M** |
| **Fournisseurs** | **Retours** 🆕 | **P1** | **M** |
| **Dashboard** | **Dettes fournisseurs** 🆕 | **P1** | **S** |

### V2 (Post-MVP)

| Module | Story | Priorité |
|--------|-------|----------|
| Connexion | Reset PIN, Multi-users | P2 |
| Ventes | Remises, Retours client, Historique | P2 |
| Stocks | Import/Export, Analyse ABC, Lots | P2 |
| Dépenses | Photo reçu, Récurrentes | P2 |
| Dashboard | Tendances, Marge brute, Exports | P2 |
| Fournisseurs | Commandes auto, Historique complet | P2 |

---

## Critères d'Acceptation Globaux (Mis à jour)

### Nouveaux Critères

| Critère | Définition | Cible |
|---------|------------|-------|
| **Alertes péremption** | Produits < 30 jours visibles | 100% |
| **Dettes visibles** | Propriétaire voit ses obligations | Dashboard |
| **Retours traçables** | Lien retour → déduction paiement | Automatique |

### Critères Inchangés

| Critère | Définition | Cible |
|---------|------------|-------|
| Offline-first | Toutes fonctionnalités MVP offline | 100% |
| Performance | Chargement < 3s, recherche < 500ms | 3G |
| Onboarding | Première vente < 3 minutes | Testé |

---

## Estimation Effort Révisée

### Avant vs Après

| Module | Effort Initial | Effort Révisé | Delta |
|--------|----------------|---------------|-------|
| Connexion | S | S | — |
| Ventes | L | L | — |
| Stocks | M | **XL** | +L (péremption) |
| Dépenses | M | M | — |
| Dashboard | M | L | +S (dettes) |
| **Fournisseurs** | — | **L** | +L (nouveau) |
| **TOTAL** | ~6 semaines | ~9 semaines | +3 semaines |

### Recommandation

Deux options:

**Option A: MVP Complet (9 semaines)**
- Inclut tout: stocks, péremption, fournisseurs
- Plus de valeur immédiate
- ROI démontrable dès le départ

**Option B: MVP Phased (6 + 3 semaines)**
- Phase 1: Ventes, Stocks (avec péremption), Dashboard
- Phase 2: Fournisseurs, Dépenses avancées
- Time to market plus rapide

---

*Document révisé suite à l'interview terrain — PharmGest Discovery*
