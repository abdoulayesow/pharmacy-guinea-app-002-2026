# Hypothèses et Risques

> Ce sur quoi nous parions et ce qui pourrait mal tourner

Ce document liste les hypothèses critiques qui sous-tendent le projet et les risques identifiés avec leurs stratégies de mitigation.

---

## Hypothèses Critiques

Les hypothèses sont classées par niveau de risque si elles s'avèrent fausses.

### 🔴 Hypothèses à Haut Risque

Ces hypothèses, si invalidées, pourraient faire échouer le projet.

| ID | Hypothèse | Impact si Fausse | Comment Valider | Statut |
|----|-----------|------------------|-----------------|--------|
| H1 | **Les utilisateurs ont des smartphones Android capables de faire tourner une PWA** | Pas de plateforme de déploiement | Enquête terrain, test sur appareils courants | ⏳ À valider |
| H2 | **Le propriétaire est prêt à payer pour une solution digitale** | Pas de business model | Interview pricing, test de prix | ⏳ À valider |
| H3 | **L'architecture offline-first fonctionne de manière fiable** | Perte de données = perte de confiance | POC technique, tests terrain | ⏳ À valider |
| H4 | **Les employés adopteront l'outil même si le propriétaire l'impose** | Usage nul = échec | Observer l'adoption, interviews employés | ⏳ À valider |
| H5 | **Le temps économisé justifie l'effort d'apprentissage** | Abandon après quelques jours | Mesurer temps avant/après, feedback | ⏳ À valider |

### 🟡 Hypothèses à Risque Moyen

Ces hypothèses pourraient nécessiter des ajustements significatifs.

| ID | Hypothèse | Impact si Fausse | Comment Valider | Statut |
|----|-----------|------------------|-----------------|--------|
| H6 | Les utilisateurs préfèrent une interface "registre papier" à une interface moderne | UX à revoir | A/B test, interviews | ⏳ À valider |
| H7 | Le PIN à 4 chiffres est suffisant pour la sécurité | Renforcer authentification | Feedback utilisateurs, best practices | ⏳ À valider |
| H8 | Les catégories de dépenses prédéfinies couvrent 90% des cas | Ajouter catégories custom | Usage réel, feedback | ⏳ À valider |
| H9 | 500 produits est un catalogue suffisant pour une petite pharmacie | Augmenter capacité | Inventaire réel | ⏳ À valider |
| H10 | Orange Money est le seul mode de paiement mobile nécessaire | Ajouter autres (MTN, etc.) | Étude marché paiements | ⏳ À valider |

### 🟢 Hypothèses à Faible Risque

Ces hypothèses sont probablement vraies mais méritent validation.

| ID | Hypothèse | Impact si Fausse | Comment Valider | Statut |
|----|-----------|------------------|-----------------|--------|
| H11 | Le français est la seule langue nécessaire | Ajouter langues locales | Enquête terrain | ⏳ À valider |
| H12 | Le format GNF avec espaces est le plus lisible | Ajuster formatage | Test utilisateurs | ⏳ À valider |
| H13 | Les alertes stock bas sont plus prioritaires que les alertes péremption | Inverser priorité MVP/V2 | Interviews | ⏳ À valider |

---

## Plan de Validation des Hypothèses

### Phase 1: Avant Développement (Semaine 1-2)

| Hypothèse | Méthode de Validation | Critère de Succès | Responsable |
|-----------|----------------------|-------------------|-------------|
| H1 | Inventaire des smartphones de l'équipe | 100% compatible PWA | PO |
| H2 | Interview pricing avec Oumar | Accord de principe sur prix | PO |
| H9 | Comptage du catalogue actuel | < 500 produits | PO |
| H11 | Discussion avec équipe | Français confirmé | PO |

### Phase 2: Pendant POC (Semaine 3-4)

| Hypothèse | Méthode de Validation | Critère de Succès | Responsable |
|-----------|----------------------|-------------------|-------------|
| H3 | Test offline avec 50 ventes fictives | 0 perte de données | Dev |
| H6 | Prototype papier vs digital | Préférence claire | UX |
| H7 | Consultation sécurité | PIN acceptable | Dev |

### Phase 3: Pendant Pilote (Semaine 5-12)

| Hypothèse | Méthode de Validation | Critère de Succès | Responsable |
|-----------|----------------------|-------------------|-------------|
| H4 | Observation adoption employés | > 80% utilisation | PO |
| H5 | Mesure temps avant/après | > 50% réduction | PO |
| H8 | Analyse dépenses catégorie "Autres" | < 10% | PO |
| H10 | Analyse répartition paiements | OM > 20% | PO |

---

## Registre des Risques

### 🔴 Risques Critiques

| ID | Risque | Probabilité | Impact | Score | Mitigation |
|----|--------|-------------|--------|-------|------------|
| R1 | **Perte de données en mode offline** | Moyenne | Critique | 🔴 | Tests exhaustifs sync, backup local redondant, logs détaillés |
| R2 | **Rejet de l'outil par les employés** | Moyenne | Élevé | 🔴 | Impliquer Abdoulaye dans le design, formation hands-on, support réactif |
| R3 | **Performances insuffisantes sur 3G** | Moyenne | Élevé | 🔴 | Optimisation bundle, lazy loading, cache agressif |
| R4 | **Coût de développement dépasse budget** | Moyenne | Élevé | 🔴 | MVP strict, pas de feature creep, sprints courts |

### 🟡 Risques Modérés

| ID | Risque | Probabilité | Impact | Score | Mitigation |
|----|--------|-------------|--------|-------|------------|
| R5 | Concurrence lance produit similaire | Faible | Élevé | 🟡 | Time to market rapide, différenciation locale |
| R6 | Changement réglementation DNPM | Faible | Élevé | 🟡 | Veille réglementaire, architecture flexible |
| R7 | Oumar perd intérêt pendant développement | Moyenne | Moyen | 🟡 | Communication régulière, démos fréquentes |
| R8 | Problèmes d'intégration Orange Money | Moyenne | Moyen | 🟡 | Valider API OM early, fallback manuel |
| R9 | Smartphones des utilisateurs trop anciens | Faible | Moyen | 🟡 | Test sur appareils low-end, PWA légère |

### 🟢 Risques Faibles

| ID | Risque | Probabilité | Impact | Score | Mitigation |
|----|--------|-------------|--------|-------|------------|
| R10 | Bugs mineurs à la livraison | Élevée | Faible | 🟢 | Tests, période de stabilisation prévue |
| R11 | Demandes de features non prévues | Élevée | Faible | 🟢 | Backlog V2, communication claire sur scope |
| R12 | Turnover dans l'équipe de dev | Faible | Moyen | 🟢 | Documentation, code propre |

---

## Matrice des Risques

```
                         IMPACT
              Faible    Moyen     Élevé    Critique
         ┌─────────┬─────────┬─────────┬─────────┐
Élevée   │   R10   │   R11   │         │         │
         ├─────────┼─────────┼─────────┼─────────┤
PROBABILITÉ        │         │  R7,R8  │  R2,R3  │   R1    │
Moyenne  │         │         │   R4    │         │
         ├─────────┼─────────┼─────────┼─────────┤
Faible   │         │  R9,R12 │  R5,R6  │         │
         └─────────┴─────────┴─────────┴─────────┘
                   
Légende: 🟢 Acceptable  🟡 À surveiller  🔴 Action requise
```

---

## Plans de Contingence

### Si R1 se réalise (Perte de données)

```
DÉCLENCHEUR: Rapport utilisateur de données manquantes

ACTIONS IMMÉDIATES (< 24h):
1. Identifier l'étendue de la perte
2. Restaurer depuis backup local si possible
3. Restaurer depuis serveur si sync avait eu lieu
4. Communiquer transparentement avec l'utilisateur

ACTIONS CORRECTIVES (< 1 semaine):
1. Analyser root cause
2. Renforcer les mécanismes de backup
3. Ajouter validation de l'intégrité des données
4. Tester scénario de récupération
```

### Si R2 se réalise (Rejet employés)

```
DÉCLENCHEUR: Utilisation < 30% après 2 semaines

ACTIONS IMMÉDIATES:
1. Interview employés pour comprendre les blocages
2. Observer une session d'utilisation réelle
3. Identifier les 3 plus gros pain points

ACTIONS CORRECTIVES:
1. Sprint dédié aux quick wins identifiés
2. Session de formation personnalisée
3. Buddy system avec utilisateur power user
4. Gamification légère si approprié
```

### Si R4 se réalise (Dépassement budget)

```
DÉCLENCHEUR: Burn rate > 120% du prévu à mi-projet

ACTIONS IMMÉDIATES:
1. Audit du scope réellement nécessaire pour MVP
2. Identifier features dé-priorisables
3. Revoir estimation avec équipe

OPTIONS:
A. Réduire scope MVP (couper features)
B. Rallonger timeline (si acceptable business)
C. Augmenter ressources (si budget disponible)
D. Pivoter vers solution plus simple
```

---

## Dépendances Externes

| Dépendance | Type | Impact si Indisponible | Plan B |
|------------|------|------------------------|--------|
| API Orange Money | Technique | Pas de paiement mobile | Mode manuel (enregistrement sans vérification) |
| Connexion internet | Infrastructure | Sync impossible | Architecture offline-first (géré) |
| Google Play / PWA | Distribution | Pas d'installation | APK direct ou web app |
| Grossistes (V2) | Business | Pas de commandes auto | Commandes manuelles (status quo) |

---

## Suivi des Risques

### Template de Revue Hebdomadaire

```
REVUE DES RISQUES - Semaine N

RISQUES ACTIFS:
┌────┬─────────────────────────┬──────────┬─────────────────────┐
│ ID │ Risque                  │ Statut   │ Action cette semaine│
├────┼─────────────────────────┼──────────┼─────────────────────┤
│ R1 │ Perte données offline   │ 🟡 Ouvert│ Tests sync en cours │
│ R2 │ Rejet employés          │ 🟡 Ouvert│ RAS - à suivre      │
│ R3 │ Perf sur 3G             │ ✅ Fermé │ Tests OK            │
└────┴─────────────────────────┴──────────┴─────────────────────┘

NOUVEAUX RISQUES IDENTIFIÉS:
- [Aucun] ou [Description + évaluation]

HYPOTHÈSES VALIDÉES/INVALIDÉES:
- H1: ✅ Validée - Smartphones compatibles
- H2: ⏳ En cours - RDV pricing semaine prochaine

DÉCISIONS REQUISES:
- [Aucune] ou [Description]
```

---

## Checklist Pré-Lancement

Avant de lancer le pilote, valider:

### Hypothèses
- [ ] H1 validée (smartphones compatibles)
- [ ] H2 validée (accord sur pricing)
- [ ] H3 validée (offline fonctionne)

### Risques
- [ ] R1 mitigé (tests sync réussis)
- [ ] R3 mitigé (perf acceptable sur 3G)
- [ ] Plans de contingence documentés

### Dépendances
- [ ] Orange Money testé (ou plan B prêt)
- [ ] Hébergement backend opérationnel
- [ ] Support utilisateur en place

---

*Document créé dans le cadre du Product Discovery — PharmGest*
