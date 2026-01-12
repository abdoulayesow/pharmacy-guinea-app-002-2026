# Story Map

> User stories organisées par activité et priorité de release

La story map organise les fonctionnalités par activités utilisateur (horizontal) et par priorité de release (vertical).

---

## Vue d'Ensemble

```
ACTIVITÉS    🔐 CONNEXION    💰 VENTES       📦 STOCKS       💸 DÉPENSES     📊 TABLEAU
             ────────────    ──────────      ──────────      ───────────     ──────────
TÂCHES       → S'authentifier → Chercher     → Voir          → Enregistrer   → Voir résumé
             → Choisir rôle    → Créer vente   inventaire    → Catégoriser   → Analyser
                              → Paiement     → Ajuster       → Consulter
                                            → Alertes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MVP          • PIN 4 chiffres • Recherche    • Liste         • Saisie        • Total jour
             • Profils        • Panier         produits      • Catégories    • Alertes
             • Session        • Cash/OM      • Stock bas       base          • Cash vs OM
                             • Reçu         • Ajustement    • Historique
                                           • Ajout produit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
V2           • Reset PIN      • Remises      • Péremption    • Photo reçu    • Tendances
             • Multi-users    • Retours      • Import/Export • Récurrentes   • Marge brute
                             • Historique   • Analyse ABC   • Fournisseurs  • Exports
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
V3           • Biométrie      • Crédit       • Commandes     • Budget        • Prédictions
             • Audit log        client         auto          • Alertes       • Comparaisons
                             • Fidélité     • Multi-sites     budget        • BI avancée
```

---

## 🔐 Module Connexion

### MVP Stories

#### CON-01: Connexion PIN
**En tant qu'** utilisateur  
**Je veux** me connecter avec un PIN à 4 chiffres  
**Afin d'** accéder rapidement à l'application

**Critères d'acceptation:**
- [ ] Clavier numérique affiché
- [ ] 4 chiffres masqués par des points
- [ ] Feedback visuel à chaque chiffre entré
- [ ] Vérification en < 500ms
- [ ] Message d'erreur clair si PIN incorrect
- [ ] Blocage après 5 tentatives (30 min)

**Taille:** S | **Priorité:** P0

---

#### CON-02: Session Mémorisée
**En tant qu'** utilisateur  
**Je veux** que ma session soit mémorisée  
**Afin de** ne pas ressaisir le PIN à chaque utilisation

**Critères d'acceptation:**
- [ ] Session valide 24h après dernière activité
- [ ] Option "Rester connecté" sur l'écran de connexion
- [ ] Déconnexion automatique après 24h d'inactivité
- [ ] Bouton de déconnexion manuelle accessible

**Taille:** S | **Priorité:** P1

---

#### CON-03: Profils Utilisateur
**En tant que** propriétaire  
**Je veux** distinguer les profils (propriétaire/employé)  
**Afin de** voir des données adaptées à mon rôle

**Critères d'acceptation:**
- [ ] Sélection du profil après PIN validé
- [ ] Propriétaire: accès complet (dashboard, dépenses, paramètres)
- [ ] Employé: accès limité (ventes, stocks consultation)
- [ ] Indicateur visuel du profil actif

**Taille:** M | **Priorité:** P1

---

## 💰 Module Ventes

### MVP Stories

#### VEN-01: Recherche Produit
**En tant que** vendeur  
**Je veux** chercher un médicament par nom  
**Afin de** l'ajouter rapidement à une vente

**Critères d'acceptation:**
- [ ] Champ de recherche en haut de l'écran
- [ ] Recherche dès 2 caractères tapés
- [ ] Résultats en < 500ms
- [ ] Affichage: nom, prix, stock disponible
- [ ] Recherche insensible aux accents
- [ ] Gestion des noms génériques et commerciaux

**Taille:** M | **Priorité:** P0

---

#### VEN-02: Affichage Stock et Prix
**En tant que** vendeur  
**Je veux** voir le prix et le stock disponible  
**Afin de** confirmer la vente en connaissance de cause

**Critères d'acceptation:**
- [ ] Prix affiché en GNF avec séparateur milliers
- [ ] Stock affiché avec indicateur couleur (vert/jaune/rouge)
- [ ] Alerte visuelle si stock < seuil minimum
- [ ] Impossible d'ajouter plus que le stock disponible

**Taille:** S | **Priorité:** P0

---

#### VEN-03: Gestion Panier
**En tant que** vendeur  
**Je veux** ajouter plusieurs produits à une vente  
**Afin de** traiter des achats multiples

**Critères d'acceptation:**
- [ ] Ajout produit en 1 tap
- [ ] Modification quantité (+/-)
- [ ] Suppression produit du panier
- [ ] Total mis à jour en temps réel
- [ ] Résumé panier toujours visible
- [ ] Maximum 20 lignes par vente

**Taille:** M | **Priorité:** P0

---

#### VEN-04: Enregistrement Paiement
**En tant que** vendeur  
**Je veux** enregistrer un paiement en espèces ou Orange Money  
**Afin de** finaliser la transaction

**Critères d'acceptation:**
- [ ] Choix: Cash ou Orange Money
- [ ] Pour Cash: saisie montant reçu, calcul rendu
- [ ] Pour OM: champ référence transaction (optionnel)
- [ ] Confirmation avant validation finale
- [ ] Stock décrémenté automatiquement
- [ ] Vente enregistrée avec timestamp

**Taille:** M | **Priorité:** P0

---

#### VEN-05: Reçu Digital
**En tant que** vendeur  
**Je veux** générer un reçu digital  
**Afin de** fournir une preuve d'achat au client

**Critères d'acceptation:**
- [ ] Reçu généré automatiquement après paiement
- [ ] Contenu: date, produits, quantités, prix, total, mode paiement
- [ ] Option partage WhatsApp
- [ ] Numéro de reçu unique
- [ ] Nom pharmacie sur le reçu

**Taille:** S | **Priorité:** P1

---

#### VEN-06: Ventes Offline
**En tant que** vendeur  
**Je veux** que les ventes soient sauvegardées même hors ligne  
**Afin de** continuer à travailler sans internet

**Critères d'acceptation:**
- [ ] Vente enregistrée localement immédiatement
- [ ] Indicateur "hors ligne" visible
- [ ] Sync automatique au retour connexion
- [ ] Compteur "X ventes en attente de sync"
- [ ] Aucune perte de données

**Taille:** L | **Priorité:** P0

---

## 📦 Module Stocks

### MVP Stories

#### STO-01: Liste Produits
**En tant que** gestionnaire  
**Je veux** voir la liste de tous les produits avec leur quantité  
**Afin de** connaître l'état de mon inventaire

**Critères d'acceptation:**
- [ ] Liste scrollable de tous les produits
- [ ] Affichage: nom, quantité, seuil min, statut
- [ ] Tri par nom (défaut), quantité, statut
- [ ] Filtre par statut (tous, stock bas, ok)
- [ ] Recherche dans la liste
- [ ] Indicateur couleur par statut

**Taille:** M | **Priorité:** P0

---

#### STO-02: Alertes Stock Bas
**En tant que** gestionnaire  
**Je veux** être alerté quand un produit passe sous le seuil minimum  
**Afin d'** anticiper les ruptures de stock

**Critères d'acceptation:**
- [ ] Alerte visuelle dans la liste (icône + couleur rouge)
- [ ] Badge compteur sur l'icône navigation "Stocks"
- [ ] Notification au login si alertes actives
- [ ] Seuil configurable par produit
- [ ] Liste filtrée "Produits en alerte" en 1 tap

**Taille:** M | **Priorité:** P0

---

#### STO-03: Ajustement Manuel
**En tant que** gestionnaire  
**Je veux** pouvoir ajuster manuellement le stock  
**Afin de** corriger les écarts (inventaire, casse, etc.)

**Critères d'acceptation:**
- [ ] Accès depuis la fiche produit
- [ ] Types: Inventaire, Casse, Périmé, Autre
- [ ] Saisie nouvelle quantité OU différence (+/-)
- [ ] Motif obligatoire
- [ ] Historique des ajustements conservé
- [ ] Confirmation avant validation

**Taille:** M | **Priorité:** P1

---

#### STO-04: Ajout Produit
**En tant que** gestionnaire  
**Je veux** ajouter un nouveau produit  
**Afin d'** enrichir mon catalogue

**Critères d'acceptation:**
- [ ] Champs: nom (obligatoire), prix vente, prix achat, seuil alerte, stock initial
- [ ] Validation format prix (nombres uniquement)
- [ ] Détection doublons (nom similaire)
- [ ] Catégorie produit (optionnel MVP)
- [ ] Confirmation après ajout

**Taille:** M | **Priorité:** P1

---

## 💸 Module Dépenses

### MVP Stories

#### DEP-01: Saisie Dépense
**En tant que** propriétaire  
**Je veux** enregistrer une dépense  
**Afin de** suivre mes sorties d'argent

**Critères d'acceptation:**
- [ ] Champs: montant, catégorie, description, date
- [ ] Date par défaut: aujourd'hui
- [ ] Montant en GNF avec clavier numérique
- [ ] Description optionnelle (texte libre)
- [ ] Sauvegarde en 1 tap

**Taille:** S | **Priorité:** P1

---

#### DEP-02: Catégories Dépenses
**En tant que** propriétaire  
**Je veux** catégoriser les dépenses  
**Afin d'** analyser où part mon argent

**Critères d'acceptation:**
- [ ] Catégories prédéfinies: Achats stock, Loyer, Salaires, Électricité, Transport, Autres
- [ ] Sélection par dropdown
- [ ] Icône par catégorie
- [ ] Impossible de créer sans catégorie

**Taille:** S | **Priorité:** P1

---

#### DEP-03: Historique Dépenses
**En tant que** propriétaire  
**Je veux** voir l'historique des dépenses  
**Afin de** consulter les dépenses passées

**Critères d'acceptation:**
- [ ] Liste chronologique (récent en premier)
- [ ] Filtre par période (jour, semaine, mois)
- [ ] Filtre par catégorie
- [ ] Total par période affiché
- [ ] Détail accessible en 1 tap

**Taille:** M | **Priorité:** P1

---

## 📊 Module Dashboard

### MVP Stories

#### DAS-01: Total Ventes du Jour
**En tant que** propriétaire  
**Je veux** voir le total des ventes du jour  
**Afin de** suivre la performance quotidienne

**Critères d'acceptation:**
- [ ] Montant total en GNF, bien visible
- [ ] Nombre de transactions
- [ ] Comparaison avec hier (optionnel MVP)
- [ ] Mise à jour en temps réel
- [ ] Accessible dès le dashboard

**Taille:** S | **Priorité:** P0

---

#### DAS-02: Compteur Alertes Stock
**En tant que** propriétaire  
**Je veux** voir combien de produits sont en alerte stock  
**Afin d'** agir rapidement sur les ruptures

**Critères d'acceptation:**
- [ ] Nombre affiché avec indicateur couleur
- [ ] Vert: 0 alerte
- [ ] Jaune: 1-5 alertes
- [ ] Rouge: 6+ alertes
- [ ] Tap pour voir la liste détaillée

**Taille:** S | **Priorité:** P0

---

#### DAS-03: Répartition Paiements
**En tant que** propriétaire  
**Je veux** voir la répartition Cash vs Orange Money  
**Afin de** comprendre les habitudes de paiement

**Critères d'acceptation:**
- [ ] Pourcentage Cash / Orange Money
- [ ] Montants absolus pour chaque
- [ ] Représentation visuelle (barre ou camembert simple)
- [ ] Période: jour en cours

**Taille:** S | **Priorité:** P1

---

## Critères d'Acceptation Globaux MVP

### Performance

| Critère | Cible | Mesure |
|---------|-------|--------|
| Temps de chargement initial | < 3s | Sur 3G |
| Recherche produit | < 500ms | Avec 500 produits |
| Enregistrement vente | < 1s | Local |
| Taille application | < 5MB | PWA installée |

### Offline-First

| Critère | Cible |
|---------|-------|
| Fonctionnalités offline | 100% du MVP |
| Sync automatique | Au retour connexion |
| Indicateur sync | Toujours visible |
| Conflits | Last-write-wins avec log |

### Localisation

| Critère | Valeur |
|---------|--------|
| Langue interface | Français 100% |
| Format monétaire | GNF avec espace (15 000 GNF) |
| Format date | DD/MM/YYYY |
| Format heure | 24h |

### Onboarding

| Critère | Cible |
|---------|-------|
| Première vente | < 3 minutes après install |
| Documentation | Tooltips in-app |
| Aide | FAQ accessible |

---

## Backlog V2 (Post-MVP)

| Module | Story | Priorité |
|--------|-------|----------|
| Connexion | Réinitialisation PIN | P2 |
| Connexion | Multi-utilisateurs complet | P2 |
| Ventes | Gestion des remises | P2 |
| Ventes | Gestion des retours | P2 |
| Ventes | Historique client | P3 |
| Stocks | Alertes péremption (FEFO) | P1 |
| Stocks | Import/Export catalogue | P2 |
| Stocks | Analyse ABC | P3 |
| Dépenses | Photo reçu fournisseur | P2 |
| Dépenses | Dépenses récurrentes | P3 |
| Dashboard | Tendances semaine/mois | P2 |
| Dashboard | Calcul marge brute | P2 |
| Dashboard | Exports PDF/Excel | P2 |

---

*Document créé dans le cadre du Product Discovery — PharmGest*
