# Research Log (Mis à Jour)

> Documentation des recherches utilisateur et insights

---

## Index des Sessions

| Date | Type | Participant(s) | Résumé | Lien |
|------|------|----------------|--------|------|
| 2026-01 | Interview | Propriétaire pharmacie | Validation hypothèses + découvertes majeures | [#session-001](#session-001) |

---

## Session 001

## Session 001 — Interview Propriétaire Pharmacie

**Date:** Janvier 2026  
**Durée:** ~30 minutes  
**Participant:** Propriétaire de pharmacie, Guinée  
**Interviewer:** [Product Owner]  
**Méthode:** Appel / Discussion  

### Contexte
- **Objectif:** Valider les hypothèses et comprendre le quotidien
- **Hypothèses testées:** H1, H3, H5, H13, pricing

### Notes Brutes

#### Concurrence et Pricing
- Solutions existantes coûtent **3-5 millions GNF** à l'achat
- Maintenance: **1 million GNF/mois**
- Perception: **"trop cher"** pour les petites pharmacies
- Opportunité claire de disruption par le prix

#### Routine Quotidienne

**Le matin:**
- Arrive et vérifie combien d'argent il y a en caisse
- Vérifie quelques médicaments clés
- Ouvre le cahier de transactions

**Pendant la journée (vente client):**
- Client arrive et demande un médicament
- Cherche le produit
- Encaisse (Cash OU Orange Money)
- Ouvre le cahier et écrit la transaction

**Le soir:**
- Reprend le cahier
- Calcule le total des ventes du jour
- Fait un résumé de la journée

#### Pain Points Majeurs

**Péremption:**
> "Ils ont du mal à garder la visibilité sur les produits qui vont expirer"
- Pas de système d'alerte
- Découvrent souvent trop tard
- Perte financière récurrente

**Ruptures de stock:**
> "Ils ont du mal à savoir quels produits vont bientôt manquer"
- Pas de notification
- Perdent des clients

**Citation clé:**
> "Being able to know what products are gonna expire soon and which ones are running out of stock — that's definitely gonna change their life."

#### Système Fournisseurs (DÉCOUVERTE MAJEURE)

**Commandes:**
- Commande régulière (ex: 50 unités/mois)
- Livraison en **1-2 semaines**
- **Paiement différé jusqu'à 1 mois**
- = Besoin de tracker les dettes fournisseurs

**Retours:**
- Peuvent retourner les produits **proches de péremption**
- Le fournisseur accepte le retour
- Montant **déduit du prochain paiement**
- = Besoin de lier retours aux paiements

#### Contraintes Techniques
- **Internet très faible**
- Confirmation: offline-first = obligatoire

#### Dépenses
- Salaires
- Dépenses diverses/random
- Besoin de tracker ces sorties d'argent

### Insights Clés

| # | Insight | Impact | Action |
|---|---------|--------|--------|
| 1 | Les alertes péremption sont la priorité #1 | Élevé | **Déplacer au MVP** |
| 2 | Système de crédit fournisseur non prévu | Élevé | **Ajouter module fournisseurs** |
| 3 | Retours déductibles des paiements | Moyen | **Lier retours aux dettes** |
| 4 | Concurrent à 1M GNF/mois = trop cher | Élevé | **Pricing < 500k GNF** |
| 5 | Offline confirmé critique | Élevé | Architecture validée |
| 6 | Orange Money utilisé | Moyen | Intégration confirmée |

### Hypothèses Impactées

| ID | Hypothèse | Statut | Notes |
|----|-----------|--------|-------|
| H1 | Offline-first obligatoire | ✅ **Validée** | "Internet très faible" |
| H3 | Architecture offline fonctionne | ✅ **Validée** | Besoin confirmé |
| H5 | Temps économisé = valeur | ✅ **Validée** | Comptage manuel quotidien |
| H13 | Alertes stock prioritaires | ✅ **Validée** | Pain point confirmé |
| H2 | Prêt à payer | ⏳ À préciser | Concurrent trop cher, notre prix? |

### Nouvelles Hypothèses

| ID | Hypothèse | À Valider |
|----|-----------|-----------|
| H14 | Suivi paiements fournisseurs = critique | ✅ Déjà validé |
| H15 | Retours impactent trésorerie | À observer |
| H16 | Prix < 500k GNF acceptable | À tester |

### Actions Suivantes

- [x] Documenter les findings
- [x] Mettre à jour le Story Map
- [x] Créer positionnement concurrentiel
- [ ] Valider pricing exact (300k? 350k?)
- [ ] 2ème interview pour module fournisseurs
- [ ] Prototyper flux alertes péremption

---

## Synthèse des Insights (Cumulée)

### Par Thème

#### 💰 Business / Coûts
| Insight | Source | Confiance | Action |
|---------|--------|-----------|--------|
| Concurrent trop cher (1M/mois) | Session 001 | Haute | Pricing agressif |
| Pertes sur périmés = récurrent | Session 001 | Haute | Alertes MVP |
| Crédit fournisseur = trésorerie | Session 001 | Haute | Module fournisseurs |

#### ⚡ Workflow / Processus
| Insight | Source | Confiance | Action |
|---------|--------|-----------|--------|
| Cahier pour tout | Session 001 | Haute | Interface "registre" |
| Comptage matin/soir | Session 001 | Haute | Dashboard caisse |
| Retours déduits des paiements | Session 001 | Haute | Lien retours-dettes |

#### 📱 Technologie / Outils
| Insight | Source | Confiance | Action |
|---------|--------|-----------|--------|
| Internet très faible | Session 001 | Haute | Offline-first |
| Cash + Orange Money | Session 001 | Haute | 2 modes paiement |

#### 😊 Émotions / Motivations
| Insight | Source | Confiance | Action |
|---------|--------|-----------|--------|
| Alertes = "change their life" | Session 001 | Haute | Priorité #1 |
| Frustration pas de visibilité | Session 001 | Haute | Dashboard clair |

---

## Tendances Émergentes

| Tendance | Occurrences | Implications |
|----------|-------------|--------------|
| Offline = non négociable | 1 | Architecture confirmée |
| Prix = barrière principale | 1 | Disruption par le prix |
| Crédit fournisseur = norme | 1 | Nouveau module requis |
| Alertes = valeur #1 | 1 | Péremption au MVP |

---

## Backlog de Recherche

### Complété
- [x] Valider le besoin offline
- [x] Comprendre la routine quotidienne
- [x] Identifier les pain points principaux
- [x] Découvrir le système fournisseurs

### À Faire
- [ ] **Valider le pricing exact** — Quel prix accepterait-il?
- [ ] **Observer une journée complète** — Voir les flux en action
- [ ] **Interviewer un employé** — Perspective différente
- [ ] **Tester le prototype** — Flux alertes péremption
- [ ] **Comprendre les retours** — Processus exact avec fournisseur
- [ ] **Quantifier les pertes** — Combien en GNF/mois?

---

## Prochaine Session Recommandée

### Session 002 — Focus Fournisseurs & Pricing

**Objectif:** Approfondir le module fournisseurs et valider le pricing

**Questions suggérées:**

1. **Fournisseurs:**
   - "Tu travailles avec combien de fournisseurs différents?"
   - "Comment tu choisis à qui commander?"
   - "Tu as déjà oublié de payer un fournisseur? Qu'est-ce qui s'est passé?"

2. **Retours:**
   - "La dernière fois que tu as retourné un produit, c'était quand? Montre-moi comment ça se passe."
   - "Le fournisseur accepte toujours les retours?"
   - "Comment tu traces le crédit qu'il te doit?"

3. **Pricing:**
   - "Si je te fais économiser 500 000 GNF par mois en évitant les périmés, tu serais prêt à payer combien?"
   - "300 000 GNF par mois, c'est acceptable? Ou c'est encore trop?"
   - "Tu préfères payer chaque mois ou une fois par an avec une réduction?"

4. **Quantification:**
   - "Le mois dernier, tu as jeté combien de médicaments périmés? Ça représentait combien?"
   - "Combien de clients tu as perdus parce que tu n'avais pas le produit?"

---

*Document mis à jour avec les résultats de l'interview terrain — PharmGest Discovery*
