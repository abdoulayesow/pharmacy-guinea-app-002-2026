# Métriques de Succès

> Comment savoir si le MVP fonctionne

Ce document définit les indicateurs clés de performance (KPIs) qui nous permettront d'évaluer le succès du MVP PharmGest.

---

## Framework de Mesure

Nous utilisons le framework **HEART** de Google adapté à notre contexte:

| Dimension | Question | Métrique Clé |
|-----------|----------|--------------|
| **H**appiness | Les utilisateurs sont-ils satisfaits? | NPS, satisfaction |
| **E**ngagement | Utilisent-ils l'app régulièrement? | Sessions/semaine, ventes/jour |
| **A**doption | Combien adoptent l'app? | Activation, onboarding complet |
| **R**etention | Reviennent-ils? | Rétention J7, J30 |
| **T**ask Success | Accomplissent-ils leurs tâches? | Taux de complétion, temps |

---

## Métriques MVP — Objectifs à 90 Jours

### 1. Adoption

| Métrique | Définition | Objectif MVP | Mesure |
|----------|------------|--------------|--------|
| **Onboarding complet** | % utilisateurs qui font leur 1ère vente dans les 3 min | > 80% | Analytics |
| **Catalogue configuré** | % avec > 50 produits ajoutés | > 90% | Base de données |
| **Profils créés** | Propriétaire + au moins 1 employé | 100% | Base de données |

### 2. Engagement

| Métrique | Définition | Objectif MVP | Mesure |
|----------|------------|--------------|--------|
| **Ventes/jour** | Nombre moyen de ventes enregistrées par jour | > 15 | Analytics |
| **Sessions/semaine** | Nombre de sessions par utilisateur/semaine | > 30 | Analytics |
| **Taux d'utilisation** | Jours actifs / jours ouvrés | > 90% | Analytics |
| **Ajustements stock** | Nombre d'ajustements par semaine | > 3 | Analytics |

### 3. Rétention

| Métrique | Définition | Objectif MVP | Mesure |
|----------|------------|--------------|--------|
| **Rétention J7** | % utilisateurs actifs après 7 jours | > 85% | Analytics |
| **Rétention J30** | % utilisateurs actifs après 30 jours | > 70% | Analytics |
| **Rétention J90** | % utilisateurs actifs après 90 jours | > 60% | Analytics |

### 4. Task Success

| Métrique | Définition | Objectif MVP | Mesure |
|----------|------------|--------------|--------|
| **Temps moyen vente** | Du premier tap à confirmation | < 30 sec | Analytics |
| **Recherche → Ajout** | Temps entre recherche et ajout panier | < 3 sec | Analytics |
| **Ventes abandonnées** | % de paniers non finalisés | < 5% | Analytics |
| **Sync réussie** | % de syncs sans erreur | > 99% | Logs |

### 5. Satisfaction (Qualitative)

| Métrique | Définition | Objectif MVP | Mesure |
|----------|------------|--------------|--------|
| **NPS** | Net Promoter Score | > 40 | Enquête mensuelle |
| **Satisfaction globale** | Note sur 5 | > 4.0 | Enquête mensuelle |
| **Bugs critiques** | Nombre de bugs bloquants/semaine | 0 | Support + logs |

---

## Métriques Business — Impact Attendu

Ces métriques mesurent l'impact réel sur l'activité de la pharmacie.

### Gains Financiers

| Métrique | Baseline (Avant) | Objectif (Après 90j) | Méthode de Calcul |
|----------|------------------|----------------------|-------------------|
| **Pertes périmés/mois** | ~500 000 GNF | < 200 000 GNF | Comparaison périodes |
| **Ruptures de stock** | ~10 produits/semaine | < 3 produits/semaine | Alertes non traitées |
| **Écarts de caisse** | ~50 000 GNF/semaine | < 10 000 GNF/semaine | Relevé comptable |

### Gains de Temps

| Métrique | Baseline (Avant) | Objectif (Après 90j) | Méthode de Calcul |
|----------|------------------|----------------------|-------------------|
| **Comptage caisse** | 30-45 min/jour | < 10 min/jour | Observation |
| **Vérification stock** | 2h/semaine | < 15 min/semaine | Observation |
| **Temps par vente** | ~2 min | < 30 sec | Chronométrage |

### ROI Attendu

```
┌─────────────────────────────────────────────────────────────────┐
│                    CALCUL ROI SIMPLIFIÉ                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ÉCONOMIES MENSUELLES ESTIMÉES                                  │
│  ─────────────────────────────                                  │
│  Réduction pertes périmés:        300 000 GNF                   │
│  Réduction ruptures (ventes sauvées): 400 000 GNF               │
│  Temps économisé (valorisé):      200 000 GNF                   │
│  ──────────────────────────────────────────────                 │
│  TOTAL:                           900 000 GNF/mois              │
│                                                                 │
│  COÛT SOLUTION (estimation)                                     │
│  ─────────────────────────                                      │
│  Abonnement mensuel:              150 000 GNF                   │
│                                                                 │
│  ROI MENSUEL:                     +750 000 GNF                  │
│  PAYBACK:                         < 1 mois                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tableau de Bord de Suivi

### Vue Hebdomadaire (Semaine N)

```
┌─────────────────────────────────────────────────────────────────┐
│                    DASHBOARD PILOTAGE MVP                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 ENGAGEMENT                          🎯 OBJECTIF    📈 RÉEL  │
│  ───────────────────────────────────────────────────────────── │
│  Ventes enregistrées (semaine)          105            [___]   │
│  Sessions moyennes/jour                 6              [___]   │
│  Utilisateurs actifs                    3              [___]   │
│                                                                 │
│  ⚡ PERFORMANCE                                                 │
│  ───────────────────────────────────────────────────────────── │
│  Temps moyen par vente                  < 30s          [___]   │
│  Taux de sync réussie                   > 99%          [___]   │
│  Paniers abandonnés                     < 5%           [___]   │
│                                                                 │
│  💚 SANTÉ PRODUIT                                               │
│  ───────────────────────────────────────────────────────────── │
│  Bugs critiques                         0              [___]   │
│  Demandes support                       < 5/sem        [___]   │
│  Satisfaction (1-5)                     > 4.0          [___]   │
│                                                                 │
│  💰 IMPACT BUSINESS                                             │
│  ───────────────────────────────────────────────────────────── │
│  Alertes stock traitées                 > 80%          [___]   │
│  Écarts caisse                          < 10k GNF      [___]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Critères Go/No-Go

### Après 2 Semaines — Point de Décision #1

| Critère | Seuil Minimum | Action si Non Atteint |
|---------|---------------|----------------------|
| Onboarding complet | > 50% | Réviser le flux d'onboarding |
| Ventes/jour | > 5 | Interview utilisateurs, identifier blocages |
| Bugs critiques | 0 | Fix urgent avant de continuer |
| Rétention J7 | > 60% | Analyse des points de friction |

### Après 4 Semaines — Point de Décision #2

| Critère | Seuil Minimum | Action si Non Atteint |
|---------|---------------|----------------------|
| Rétention J30 | > 50% | Pivot ou kill |
| NPS | > 20 | Interviews approfondies |
| ROI positif | > 0 | Revoir le pricing/value prop |
| Demandes support | < 10/sem | Améliorer UX ou documentation |

### Après 90 Jours — Décision Scale

| Critère | Seuil pour Scale | Action |
|---------|------------------|--------|
| Tous objectifs MVP atteints | > 80% | Scale à 5 pharmacies |
| NPS | > 40 | Continuer tel quel |
| ROI | > 500k GNF/mois | Valider pricing |
| Demandes fonctionnalités V2 | > 3 | Prioriser backlog V2 |

---

## Plan de Collecte de Données

### Données Automatiques (Analytics)

| Donnée | Outil | Fréquence |
|--------|-------|-----------|
| Sessions, écrans, durées | Mixpanel/Amplitude | Temps réel |
| Temps par action | Analytics custom | Temps réel |
| Erreurs, crashes | Sentry | Temps réel |
| Sync status | Logs backend | Temps réel |

### Données Manuelles

| Donnée | Méthode | Fréquence |
|--------|---------|-----------|
| Satisfaction, NPS | Enquête in-app | Mensuelle |
| Feedback qualitatif | Interview | Bi-mensuelle |
| Pertes périmés | Relevé pharmacie | Mensuelle |
| Écarts caisse | Relevé pharmacie | Hebdomadaire |

### Outils Recommandés

| Besoin | Outil | Coût |
|--------|-------|------|
| Analytics produit | Mixpanel (Free tier) | Gratuit |
| Error tracking | Sentry (Free tier) | Gratuit |
| Enquêtes | Typeform / Google Forms | Gratuit |
| Dashboard | Notion / Google Sheets | Gratuit |

---

## Rituels de Suivi

| Rituel | Fréquence | Participants | Output |
|--------|-----------|--------------|--------|
| **Daily standup** | Quotidien | Équipe dev | Blocages résolus |
| **Weekly metrics** | Hebdomadaire | Équipe + PO | Dashboard mis à jour |
| **User interview** | Bi-mensuel | PO + utilisateur | Insights documentés |
| **Monthly review** | Mensuel | Équipe + stakeholders | Décision Go/No-Go |

---

## Success Criteria Summary

### Le MVP est un succès si après 90 jours:

✅ **Adoption:** 100% des utilisateurs ont complété l'onboarding  
✅ **Engagement:** > 15 ventes/jour enregistrées  
✅ **Rétention:** > 60% des utilisateurs actifs après 90 jours  
✅ **Performance:** Temps moyen par vente < 30 secondes  
✅ **Satisfaction:** NPS > 40  
✅ **Business:** ROI positif démontré  
✅ **Qualité:** 0 bug critique en production  

---

*Document créé dans le cadre du Product Discovery — PharmGest*
