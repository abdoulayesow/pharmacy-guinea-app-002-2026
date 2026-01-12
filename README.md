# PharmGest Discovery

> Application de gestion pour pharmacies indépendantes en Afrique francophone

## 📋 Vue d'ensemble

**Client:** Pharmacie Thierno Mamadou  
**Lieu:** Conakry, Guinée  
**Phase:** Product Discovery  
**Date:** Janvier 2026

---

## 🎯 Le Problème

Les petites pharmacies indépendantes à Conakry font face à:
- Une concurrence déloyale des vendeurs illicites (marché Madina)
- Des pertes financières sur les médicaments périmés
- Une gestion manuelle chronophage (Excel + cahiers)
- Des ruptures de stock qui font perdre des clients
- Un manque d'outils adaptés à leur réalité (coupures de courant, connectivité limitée)

## 💡 La Solution

**PharmGest** — Une application mobile-first (PWA) conçue pour la réalité guinéenne:
- Architecture offline-first (fonctionne sans internet)
- Gestion des stocks avec alertes intelligentes
- Enregistrement des ventes rapide (Cash + Orange Money)
- Interface simple inspirée des registres papier
- 100% en français

---

## 📁 Documentation

| Document | Description |
|----------|-------------|
| [01-empathy-maps.md](./01-empathy-maps.md) | Cartes d'empathie — Ce que pensent, disent, font et ressentent nos utilisateurs |
| [02-personas.md](./02-personas.md) | Profils détaillés des utilisateurs cibles |
| [03-product-vision.md](./03-product-vision.md) | Vision produit, elevator pitch, différenciateurs |
| [04-story-map.md](./04-story-map.md) | User stories organisées par activité et release |
| [05-user-journeys.md](./05-user-journeys.md) | Parcours utilisateurs détaillés pour les flux clés |
| [06-success-metrics.md](./06-success-metrics.md) | KPIs et critères de succès du MVP |
| [07-assumptions-risks.md](./07-assumptions-risks.md) | Hypothèses à valider et risques identifiés |
| [08-technical-architecture.md](./08-technical-architecture.md) | Architecture technique et contraintes |
| [09-research-log.md](./09-research-log.md) | Template pour le suivi des recherches utilisateur |
| [PROMPT-claude-code.md](./PROMPT-claude-code.md) | Prompt de démarrage pour Claude Code |

---

## 👥 Équipe & Contexte

### Client
- **Propriétaire:** Mamadou Diallo (52 ans, 18 ans d'expérience)
- **Employés:** 2 personnes dont Fatoumata Camara
- **Système actuel:** Excel + cahiers physiques

### Contraintes Clés
| Contrainte | Impact |
|------------|--------|
| Électricité < 12h/jour | Architecture offline-first obligatoire |
| Données mobiles coûteuses | Bundle < 5MB, sync optimisé |
| Compétence tech variable | Interface ultra-simple |
| Langue française uniquement | Pas de termes anglais dans l'UI |

---

## 🚀 MVP Scope

Le MVP couvre 5 modules essentiels:

```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│  CONNEXION  │   VENTES    │   STOCKS    │  DÉPENSES   │  DASHBOARD  │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ PIN 4 chif. │ Recherche   │ Liste       │ Saisie      │ Ventes jour │
│ Profils     │ Panier      │ Alertes     │ Catégories  │ Alertes     │
│ Session     │ Paiement    │ Ajustement  │ Historique  │ Cash/Mobile │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

---

## 📅 Prochaines Étapes

1. [ ] Valider les personas avec le client
2. [ ] Prioriser les user stories MVP
3. [ ] Créer les wireframes des écrans clés
4. [ ] Setup technique (voir [PROMPT-claude-code.md](./PROMPT-claude-code.md))
5. [ ] Sprint 1: Connexion + Structure offline

---

## 🔗 Ressources

- **Stack technique:** React PWA + IndexedDB + Node.js + PostgreSQL
- **Outils design:** Figma (wireframes)
- **Gestion projet:** Notion

---

*Pharmacie Thierno Mamadou • Conakry, Guinée • 2026*
