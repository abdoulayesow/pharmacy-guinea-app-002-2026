# Personas Utilisateurs

> Deux personas principaux guident nos décisions de conception

Les personas représentent nos utilisateurs cibles. Ils nous aident à prendre des décisions centrées sur les vrais besoins plutôt que sur des suppositions.

---

## Persona 1: Mamadou Diallo

### "Le Propriétaire Jongleur"

> *"Je suis devenu pharmacien pour aider les gens, pas pour me battre avec les ordinateurs tous les jours."*

---

### Profil

| Attribut | Détail |
|----------|--------|
| **Âge** | 52 ans |
| **Rôle** | Propriétaire-pharmacien |
| **Expérience** | 18 ans (pharmacie familiale héritée) |
| **Équipe** | 2 employés |
| **Horaires** | 12h/jour, 6 jours/semaine |
| **Localisation** | Conakry, Guinée |

### Compétence Technique

```
Faible ━━━━━━━━●━━━━━━━━━━ Élevée
              ↑
         Mamadou
```

| Outil | Niveau |
|-------|--------|
| WhatsApp | ✅ Utilise quotidiennement |
| Excel | ⚠️ Basique (saisie, pas de formules) |
| Applications mobiles | ⚠️ Limité (appels, SMS, WhatsApp) |
| Ordinateur | ❌ Évite quand possible |

### Outils Actuels

- **Gestion stocks:** Fichier Excel (mise à jour hebdomadaire)
- **Suivi ventes:** Cahier physique journalier
- **Comptabilité:** Cahier séparé + comptable externe mensuel
- **Commandes:** Téléphone aux grossistes

### Contexte Concurrentiel

| Concurrent | Menace |
|------------|--------|
| **Chaînes de pharmacies** | Meilleurs prix, systèmes modernes, stocks larges |
| **Vendeurs illicites (Madina)** | Prix très bas, pas de réglementation, proximité |
| **Autres indépendants** | Même combat, certains se modernisent |

### Objectifs

1. **Réduire la charge administrative** sans ajouter de complexité
2. **Maintenir la conformité** réglementaire (DNPM)
3. **Améliorer les marges** par meilleur contrôle des stocks
4. **Passer moins de temps** sur l'administration, plus avec les patients
5. **Pérenniser** l'entreprise familiale

### Frustrations

- 😤 Perd de l'argent chaque mois sur les médicaments périmés
- 😤 Ne sait jamais exactement combien il a en caisse
- 😤 Les ruptures de stock font partir les clients chez les concurrents
- 😤 Forme les employés pendant des semaines, certains partent ensuite
- 😤 Pas le temps d'apprendre un nouveau système compliqué

### Questions d'Évaluation

Quand Mamadou évalue une nouvelle solution, il se demande:

> "Est-ce que ça va me faire économiser de l'argent en 6 mois?"

> "Mes employés peuvent l'apprendre rapidement?"

> "Y a-t-il du support quand j'ai des problèmes?"

> "Ça marche quand il n'y a pas d'électricité?"

> "Combien ça coûte par mois?"

### Scénario Type

**Lundi, 7h30** — Mamadou arrive à la pharmacie. Il compte la caisse restante de samedi. Il ouvre Excel pour vérifier les stocks mais le fichier met 2 minutes à charger. Un client arrive, il ferme Excel.

**11h** — Heure de pointe. Fatoumata lui demande le prix du Coartem. Il ne se souvient plus, cherche dans son cahier. Le client attend.

**14h** — Le représentant du grossiste appelle. Mamadou commande de mémoire, espérant ne rien oublier.

**19h** — Fermeture. Il compte la caisse (30 min). Note les totaux dans son cahier. Rentre épuisé.

### Ce dont Mamadou a besoin

| Besoin | Traduction Produit |
|--------|-------------------|
| Savoir ce qu'il a en stock | Liste produits temps réel |
| Éviter les périmés | Alertes automatiques |
| Suivre l'argent | Dashboard ventes + dépenses |
| Former vite les employés | Interface intuitive |
| Ça marche toujours | Offline-first |

---

## Persona 2: Fatoumata Camara

### "L'Employée Efficace"

> *"Quand le système est lent, les clients pensent que c'est moi qui suis lente."*

---

### Profil

| Attribut | Détail |
|----------|--------|
| **Âge** | 27 ans |
| **Rôle** | Vendeuse et gestionnaire de stock |
| **Expérience** | 3 ans chez Thierno Mamadou |
| **Expérience précédente** | Pharmacie avec système POS basique |
| **Horaires** | 8h-18h, parfois plus |
| **Localisation** | Conakry, Guinée |

### Compétence Technique

```
Faible ━━━━━━━━━━━━━━●━━━━ Élevée
                    ↑
               Fatoumata
```

| Outil | Niveau |
|-------|--------|
| Smartphone | ✅ Expert (apps, réseaux sociaux) |
| Applications mobiles | ✅ À l'aise |
| Excel | ⚠️ Basique |
| Systèmes POS | ⚠️ Expérience limitée mais positive |

### Workarounds Actuels

Fatoumata a développé ses propres systèmes pour compenser les lacunes:

| Problème | Sa Solution |
|----------|-------------|
| Prix non mémorisables | Notes personnelles sur téléphone |
| Stocks incertains | SMS aux collègues |
| Excel lent | Calculatrice du téléphone |
| Oublis | Cahier personnel |

### Objectifs

1. **Traiter les ventes rapidement** pendant les heures de pointe
2. **Éviter les plaintes clients** pour ruptures de stock
3. **Minimiser les erreurs** de caisse (stress du comptage)
4. **Finir le travail à l'heure** prévue
5. **Être reconnue** pour son bon travail

### Frustrations

- 😤 Le système (Excel) plante ou est lent
- 😤 Doit interrompre Mamadou pour les prix
- 😤 Comptage manuel répétitif et stressant
- 😤 Les clients s'impatientent quand elle cherche
- 😤 Heures supplémentaires non prévues

### Motivations

- 💪 Aime aider les clients à trouver ce qu'ils cherchent
- 💪 Satisfaite quand la journée se passe bien
- 💪 Veut progresser et peut-être gérer sa propre pharmacie un jour
- 💪 Apprécie la technologie quand elle fonctionne

### Scénario Type

**8h** — Fatoumata ouvre la pharmacie. Elle vérifie ses notes personnelles pour se rappeler ce qui manquait hier.

**11h30** — File d'attente de 5 personnes. Un client demande du Paracétamol 500mg. Elle tape dans Excel, attend 30 secondes. "Stock: 2 boîtes". Elle doute, vérifie physiquement. Il en reste 8. Excel n'est pas à jour.

**13h** — Elle envoie un SMS à son collègue: "On a encore du Ventoline?"

**17h** — Heure de pointe. Elle utilise sa calculatrice pour aller plus vite qu'Excel.

**18h30** — Elle devait finir à 18h. Le comptage de caisse prend 20 minutes. Erreur de 5000 GNF. Recompte. Trouve l'erreur. Part à 19h.

### Ce dont Fatoumata a besoin

| Besoin | Traduction Produit |
|--------|-------------------|
| Trouver les produits vite | Recherche < 500ms |
| Connaître le stock réel | Mise à jour temps réel |
| Encaisser rapidement | Interface 1-2 taps |
| Éviter les erreurs | Calculs automatiques |
| Pas de bugs | App stable, offline |

---

## Comparaison des Personas

| Dimension | Mamadou | Fatoumata |
|-----------|---------|-----------|
| **Priorité #1** | Rentabilité | Rapidité |
| **Rapport à la tech** | Méfiant | Enthousiaste (si ça marche) |
| **Décision d'achat** | Oui | Non |
| **Utilisation quotidienne** | Dashboard, rapports | Ventes, stocks |
| **Tolérance aux bugs** | Très faible | Faible |
| **Temps de formation accepté** | < 1 heure | < 15 minutes |

---

## Implications Design par Persona

### Pour Mamadou

| Besoin | Solution Design |
|--------|-----------------|
| Simplicité | Pas plus de 5 écrans principaux |
| Visibilité business | Dashboard avec KPIs clés en premier |
| Confiance | Indicateur de sync visible |
| Coût visible | ROI clair (économies périmés) |

### Pour Fatoumata

| Besoin | Solution Design |
|--------|-----------------|
| Rapidité | Recherche autocomplete, gros boutons |
| Fiabilité | Offline-first, pas de temps de chargement |
| Simplicité | Flux vente en 3 étapes max |
| Feedback | Confirmation visuelle + sonore |

---

## Anti-Personas

> Qui n'est PAS notre cible (pour le MVP)

| Profil | Pourquoi Pas |
|--------|--------------|
| **Grandes chaînes** | Ont déjà des systèmes, besoins différents |
| **Pharmacies hospitalières** | Réglementation et flux différents |
| **Grossistes** | B2B, pas de vente au détail |
| **Pharmacies sans smartphone** | Prérequis technique minimal |

---

*Document créé dans le cadre du Product Discovery — PharmGest*
