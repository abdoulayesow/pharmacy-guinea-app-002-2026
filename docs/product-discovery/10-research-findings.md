# Résultats de Recherche Utilisateur

> Synthèse de l'interview terrain — Janvier 2026

---

## Informations de l'Interview

| Élément | Détail |
|---------|--------|
| **Date** | Janvier 2026 |
| **Participant** | Propriétaire de pharmacie (Guinée) |
| **Méthode** | Interview qualitative |
| **Durée** | ~30 minutes |

---

## Résumé Exécutif

L'interview a validé plusieurs hypothèses clés du projet et révélé de **nouvelles opportunités business** non anticipées, notamment autour de la gestion des paiements fournisseurs et des retours de produits.

### Découvertes Principales

1. **Le mode offline est critique** — Connexion internet très faible
2. **Les alertes stock/péremption sont la priorité #1** — "Ça changerait leur vie"
3. **Système de crédit fournisseur** — Paiement différé jusqu'à 1 mois (non prévu initialement)
4. **Politique de retours** — Les produits proches de péremption peuvent être retournés
5. **Concurrence trop chère** — Solutions actuelles à 3-5M GNF + 1M/mois = inaccessible

---

## Validation des Hypothèses

### ✅ Hypothèses Validées

| ID | Hypothèse | Statut | Verbatim / Evidence |
|----|-----------|--------|---------------------|
| H1 | Offline-first obligatoire | ✅ **Validé** | "Internet is very low" |
| H3 | Architecture offline fonctionne | ✅ **Validé** | Besoin confirmé |
| H5 | Temps économisé = valeur | ✅ **Validé** | Comptage manuel quotidien |
| H13 | Alertes stock prioritaires | ✅ **Validé** | Pain point majeur |
| — | Alertes péremption | ✅ **Validé** | "Definitely gonna change their life" |

### 🔄 Hypothèses à Réviser

| ID | Hypothèse Originale | Révision Nécessaire |
|----|---------------------|---------------------|
| H8 | Catégories dépenses suffisantes | Ajouter "Paiements fournisseurs" |
| — | MVP sans péremption | **Déplacer alertes péremption au MVP** |

### 🆕 Nouvelles Hypothèses à Valider

| ID | Nouvelle Hypothèse | Priorité | Comment Valider |
|----|-------------------|----------|-----------------|
| H14 | Le suivi des paiements fournisseurs est critique | Haute | Déjà validé par interview |
| H15 | La gestion des retours impacte la trésorerie | Moyenne | Observer le processus |
| H16 | Un prix < 500k GNF/mois serait acceptable | Haute | Test de pricing |

---

## Flux de Travail Découverts

### 🌅 Routine du Matin

```
┌─────────────────────────────────────────────────────────────┐
│  1. Ouvrir la pharmacie                                     │
│  2. Vérifier l'argent en caisse (comptage)                 │
│  3. Vérifier quelques médicaments clés                      │
│  4. Ouvrir le cahier de transactions                        │
└─────────────────────────────────────────────────────────────┘
```

### 💊 Vente Client

```
┌─────────────────────────────────────────────────────────────┐
│  1. Client demande un médicament                            │
│  2. Chercher le produit (mémoire + étagères)               │
│  3. Annoncer le prix                                        │
│  4. Encaisser (Cash OU Orange Money)                        │
│  5. Ouvrir le cahier                                        │
│  6. Écrire la transaction (produit, quantité, montant)     │
└─────────────────────────────────────────────────────────────┘
```

### 🌙 Routine du Soir

```
┌─────────────────────────────────────────────────────────────┐
│  1. Reprendre le cahier                                     │
│  2. Calculer le total des ventes du jour                   │
│  3. Compter la caisse                                       │
│  4. Vérifier la cohérence                                   │
│  5. Noter le résumé journalier                              │
└─────────────────────────────────────────────────────────────┘
```

### 📦 Approvisionnement (NOUVEAU)

```
┌─────────────────────────────────────────────────────────────┐
│  COMMANDE                                                   │
│  1. Identifier les produits à commander (mémoire/cahier)   │
│  2. Contacter le fournisseur                                │
│  3. Passer commande (ex: 50 unités)                        │
│  4. PAS DE PAIEMENT IMMÉDIAT                               │
│                                                             │
│  LIVRAISON (1-2 semaines plus tard)                        │
│  5. Réceptionner la commande                                │
│  6. Vérifier les produits                                   │
│  7. Ranger en stock                                         │
│                                                             │
│  PAIEMENT (jusqu'à 1 mois plus tard)                       │
│  8. Payer le fournisseur                                    │
│  9. Déduire les éventuels retours                          │
└─────────────────────────────────────────────────────────────┘
```

### 🔄 Retours Fournisseur (NOUVEAU)

```
┌─────────────────────────────────────────────────────────────┐
│  1. Identifier produit proche péremption (pas vendu)       │
│  2. Retourner au fournisseur                                │
│  3. Obtenir un avoir / crédit                               │
│  4. Déduire du prochain paiement                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Pain Points Identifiés

### 🔴 Critiques (Changent leur vie)

| Pain Point | Impact | Fréquence | Solution |
|------------|--------|-----------|----------|
| Pas de visibilité sur stocks bas | Ruptures, clients perdus | Quotidien | Alertes automatiques |
| Pas de visibilité sur péremptions | Pertes financières | Hebdomadaire | Alertes FEFO |
| Comptage manuel caisse | Temps perdu, erreurs | Quotidien | Calcul automatique |

### 🟡 Importants

| Pain Point | Impact | Fréquence | Solution |
|------------|--------|-----------|----------|
| Suivi paiements fournisseurs | Oublis, mauvaise trésorerie | Mensuel | Module fournisseurs |
| Suivi des retours | Perte de crédits | Mensuel | Lien retours-paiements |
| Pas de vue d'ensemble | Décisions à l'aveugle | Permanent | Dashboard |

---

## Opportunité Concurrentielle

### Paysage Actuel

| Concurrent | Prix Initial | Maintenance/Mois | Perception |
|------------|--------------|------------------|------------|
| Solutions existantes | 3-5 M GNF | 1 M GNF | **Trop cher** |
| Excel/Cahier | 0 | 0 | Insuffisant |
| **PharmGest** | ? | ? | **Opportunité** |

### Recommandation Pricing

```
┌─────────────────────────────────────────────────────────────┐
│  POSITIONNEMENT PRIX SUGGÉRÉ                                │
│                                                             │
│  Concurrent:     1 000 000 GNF/mois                        │
│                         ↓                                   │
│  PharmGest:        300-500 000 GNF/mois                    │
│                         ↓                                   │
│  Perception:    "Abordable + Plus de valeur"               │
│                                                             │
│  OU Modèle Freemium:                                        │
│  • Gratuit: Ventes + Stocks de base                        │
│  • Payant: Alertes + Dashboard + Fournisseurs              │
└─────────────────────────────────────────────────────────────┘
```

---

## Impact sur le Produit

### Fonctionnalités à Ajouter au MVP

| Fonctionnalité | Priorité | Justification |
|----------------|----------|---------------|
| **Alertes péremption** | P0 | "Change their life" — déplacer de V2 à MVP |
| **Module fournisseurs** | P1 | Crédit + paiements différés = critique |
| **Suivi des retours** | P1 | Lié aux paiements fournisseurs |

### Architecture Données Révisée

```
NOUVEAU: Tables Fournisseurs
──────────────────────────────

Suppliers
├── id
├── name
├── phone
├── payment_terms (ex: 30 jours)
└── created_at

SupplierOrders
├── id
├── supplier_id (FK)
├── order_date
├── delivery_date
├── total_amount
├── status (ORDERED, DELIVERED, PAID)
├── due_date
└── amount_paid

SupplierReturns
├── id
├── supplier_order_id (FK)
├── product_id (FK)
├── quantity
├── reason (EXPIRING, DAMAGED, OTHER)
├── credit_amount
└── applied_to_order_id (FK) — déduction
```

---

## Prochaines Étapes

### Immédiat (Cette Semaine)

- [ ] Mettre à jour le Story Map avec module fournisseurs
- [ ] Réviser les personas avec les nouveaux workflows
- [ ] Définir le pricing strategy
- [ ] Planifier une 2ème interview pour valider les ajustements

### Court Terme (2 Semaines)

- [ ] Prototyper le flux alertes péremption
- [ ] Prototyper le module fournisseurs (simplifié)
- [ ] Tester le pricing avec 2-3 pharmaciens

### Moyen Terme (1 Mois)

- [ ] MVP ajusté prêt pour test
- [ ] Pilote avec la pharmacie interviewée

---

## Citation Clé

> **"Being able to know what products are gonna expire soon and which ones are running out of stock — that's definitely gonna change their life."**

---

## Annexes

### A. Données Brutes de l'Interview

**Routine quotidienne:**
- Matin: check caisse + check médicaments
- Cahier pour toutes les transactions
- Soir: résumé de la journée

**Paiements:**
- Cash et Orange Money acceptés

**Douleurs:**
- Produits qui expirent sans visibilité
- Ruptures de stock non anticipées
- Pas de digitalisation = pas de notifications

**Fournisseurs:**
- Commande ~50 unités/mois
- Livraison en 1-2 semaines
- Paiement jusqu'à 1 mois après
- Retours possibles si proche péremption
- Retours déduits du prochain paiement

**Concurrence:**
- Prix: 3-5M GNF
- Maintenance: 1M GNF/mois
- Perception: trop cher

**Technique:**
- Internet très faible
- Offline = obligatoire

---

*Document créé suite à l'interview terrain — PharmGest Discovery*
