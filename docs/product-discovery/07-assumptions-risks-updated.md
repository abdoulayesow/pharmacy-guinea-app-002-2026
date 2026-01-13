# Hypothèses et Risques (Mis à Jour)

> Version révisée suite à l'interview terrain — Janvier 2026

---

## Résumé des Changements

| Type | Avant | Après |
|------|-------|-------|
| Hypothèses validées | 0 | 5 |
| Nouvelles hypothèses | 13 | 16 |
| Risques révisés | 12 | 14 |

---

## Hypothèses Critiques

### ✅ Hypothèses Validées

| ID | Hypothèse | Evidence | Date |
|----|-----------|----------|------|
| H1 | **Les utilisateurs ont des smartphones Android capables de faire tourner une PWA** | "Internet très faible" mais smartphones OK | Janv. 2026 |
| H3 | **L'architecture offline-first fonctionne de manière fiable** | Besoin confirmé critique | Janv. 2026 |
| H5 | **Le temps économisé justifie l'effort d'apprentissage** | Comptage manuel quotidien = douleur | Janv. 2026 |
| H11 | **Le français est la seule langue nécessaire** | Confirmé | Janv. 2026 |
| H13 | **Les alertes stock bas sont prioritaires** | "Change their life" | Janv. 2026 |

### 🔴 Hypothèses à Haut Risque (Restantes)

| ID | Hypothèse | Impact si Fausse | Statut | Prochaine Action |
|----|-----------|------------------|--------|------------------|
| H2 | **Le propriétaire est prêt à payer pour une solution digitale** | Pas de business model | ⏳ Partiellement validé | Tester prix exact |
| H4 | **Les employés adopteront l'outil même si le propriétaire l'impose** | Usage nul = échec | ⏳ À valider | Interview employé |

### 🆕 Nouvelles Hypothèses (Post-Interview)

| ID | Hypothèse | Impact si Fausse | Comment Valider | Statut |
|----|-----------|------------------|-----------------|--------|
| H14 | **Le suivi des paiements fournisseurs est critique** | Module inutile | Interview | ✅ Validé |
| H15 | **La gestion des retours impacte la trésorerie** | Feature non prioritaire | Observer le processus | ⏳ À valider |
| H16 | **Un prix < 500k GNF/mois serait acceptable** | Pricing à revoir | Test pricing direct | ⏳ À valider |

### 🟡 Hypothèses Révisées

| ID | Hypothèse Originale | Révision | Raison |
|----|---------------------|----------|--------|
| H8 | Les catégories de dépenses prédéfinies couvrent 90% des cas | **Ajouter "Paiement fournisseur"** | Crédit = usage majeur |
| — | Alertes péremption = V2 | **Alertes péremption = MVP** | Pain point #1 validé |

---

## Matrice de Validation des Hypothèses

```
                         VALIDÉ
                           ✓
                           │
         H1  H3  H5  H11   │   
          ●   ●   ●   ●    │   H13  H14
                           │    ●    ●
    ─────────────────────────┼────────────────────────
    FAIBLE                   │              FORT
    IMPACT                   │             IMPACT
                           │
              H6  H7       │   H2  H4  H16
               ○   ○       │    ○   ○   ○
                           │
                           │
                         À VALIDER

    Légende: ● Validé  ○ À valider
```

---

## Plan de Validation Révisé

### ✅ Complété

| Hypothèse | Méthode | Résultat |
|-----------|---------|----------|
| H1 | Interview | Smartphones OK, internet faible |
| H3 | Interview | Offline = critique |
| H5 | Interview | Comptage manuel = douleur |
| H13 | Interview | Alertes = "change their life" |
| H14 | Interview | Crédit fournisseur = norme |

### 🔜 Prochaine Phase

| Hypothèse | Méthode | Critère de Succès | Timing |
|-----------|---------|-------------------|--------|
| H2/H16 | Test pricing direct | Accord sur 300k GNF/mois | Semaine prochaine |
| H4 | Interview employé | Intérêt pour l'outil | Semaine prochaine |
| H15 | Observation terrain | Comprendre flux retours | 2 semaines |

---

## Registre des Risques (Révisé)

### 🆕 Nouveaux Risques Identifiés

| ID | Risque | Probabilité | Impact | Score | Mitigation |
|----|--------|-------------|--------|-------|------------|
| R13 | **Complexité module fournisseurs** | Moyenne | Moyen | 🟡 | MVP simplifié (paiements only) |
| R14 | **Pricing trop bas = pas de marge** | Faible | Élevé | 🟡 | Calcul coûts précis, volume requis |

### Risques Révisés

| ID | Risque | Ancien Score | Nouveau Score | Raison |
|----|--------|--------------|---------------|--------|
| R1 | Perte de données offline | 🔴 | 🔴 | Inchangé — toujours critique |
| R2 | Rejet par employés | 🔴 | 🟡 | Propriétaire convaincu, employés à valider |
| R3 | Performances sur 3G | 🔴 | 🟡 | Internet faible confirmé, mais PWA adaptée |
| R5 | Concurrence lance produit similaire | 🟡 | 🟢 | Concurrent cher, opportunité claire |

### Matrice des Risques Révisée

```
                         IMPACT
              Faible    Moyen     Élevé    Critique
         ┌─────────┬─────────┬─────────┬─────────┐
Élevée   │   R10   │   R11   │         │         │
         ├─────────┼─────────┼─────────┼─────────┤
PROBA    │         │  R7,R13 │  R2,R3  │   R1    │
Moyenne  │         │         │   R4    │         │
         ├─────────┼─────────┼─────────┼─────────┤
Faible   │         │  R9,R12 │  R5,R14 │         │
         └─────────┴─────────┴─────────┴─────────┘
                   
Légende: 🟢 Acceptable  🟡 À surveiller  🔴 Action requise
```

---

## Risques par Catégorie

### Risques Techniques

| ID | Risque | Score | Mitigation |
|----|--------|-------|------------|
| R1 | Perte de données offline | 🔴 | Tests exhaustifs, backup redondant |
| R3 | Performances sur 3G | 🟡 | Bundle < 5MB, lazy loading |
| R13 | Complexité module fournisseurs | 🟡 | MVP simplifié |

### Risques Business

| ID | Risque | Score | Mitigation |
|----|--------|-------|------------|
| R4 | Dépassement budget dev | 🟡 | Scope MVP strict |
| R5 | Concurrence | 🟢 | Pricing agressif, différenciation |
| R14 | Marge trop faible | 🟡 | Calcul break-even |

### Risques Adoption

| ID | Risque | Score | Mitigation |
|----|--------|-------|------------|
| R2 | Rejet employés | 🟡 | Interview, formation hands-on |
| R7 | Perte d'intérêt propriétaire | 🟡 | Communication régulière, démos |

---

## Nouvelles Dépendances Identifiées

| Dépendance | Type | Impact si Indisponible | Plan B |
|------------|------|------------------------|--------|
| Grossiste accepte les retours | Business | Module retours inutile | Tracker sans déduction auto |
| Propriétaire accepte le prix | Business | Pas de client | Ajuster pricing |
| Employé adopte l'outil | Humain | Utilisation partielle | Formation + simplification |

---

## Actions Post-Interview

### ✅ Complétées

- [x] Documenter les findings
- [x] Mettre à jour les hypothèses
- [x] Réviser les risques
- [x] Mettre à jour le Story Map
- [x] Créer positionnement concurrentiel

### 🔜 À Faire

| Action | Priorité | Owner | Deadline |
|--------|----------|-------|----------|
| Valider pricing (300k GNF) | P0 | PO | 1 semaine |
| Interview employé | P1 | PO | 1 semaine |
| Observer flux retours | P1 | PO | 2 semaines |
| POC offline avec sync | P0 | Dev | 2 semaines |
| Prototype alertes péremption | P0 | UX | 2 semaines |

---

## Checklist Pré-Développement (Révisée)

### Hypothèses ✅

- [x] H1 validée (smartphones compatibles)
- [x] H3 validée (offline obligatoire)
- [x] H13 validée (alertes = priorité)
- [x] H14 validée (fournisseurs = critique)
- [ ] H2/H16 à valider (pricing)
- [ ] H4 à valider (adoption employés)

### Risques ⚠️

- [x] R1 identifié (offline data loss)
- [x] R3 atténué (3G confirmé, PWA adaptée)
- [ ] R2 à atténuer (interview employé)
- [x] R13 identifié (complexité fournisseurs)

### Décisions Requises

| Décision | Options | Recommandation | Statut |
|----------|---------|----------------|--------|
| Alertes péremption MVP? | Oui / Non | **Oui** (validé) | ✅ Décidé |
| Module fournisseurs MVP? | Complet / Simplifié / V2 | **Simplifié** | ✅ Décidé |
| Pricing | 300k / 350k / 500k | **300k** (à valider) | ⏳ En cours |

---

## Synthèse

### Ce qui a Changé

| Avant Interview | Après Interview |
|-----------------|-----------------|
| Alertes péremption = V2 | **Alertes péremption = MVP** |
| Pas de module fournisseurs | **Module fournisseurs simplifié** |
| Pricing inconnu | **Cible: 300k GNF/mois** |
| 5 hypothèses à valider | **5 validées, 3 restantes** |

### Confiance Projet

```
AVANT:  ████████░░░░░░░░  50% — Beaucoup d'inconnus

APRÈS:  ████████████░░░░  75% — Validation terrain solide
```

### Prochaine Milestone

**Validation pricing + prototype alertes** → Si OK → Lancer développement MVP

---

*Document mis à jour suite à l'interview terrain — PharmGest Discovery*
