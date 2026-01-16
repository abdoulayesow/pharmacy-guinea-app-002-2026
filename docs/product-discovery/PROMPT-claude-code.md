# Prompt Claude Code

> Prompt de démarrage pour le développement avec Claude Code

Ce prompt est conçu pour être copié-collé dans Claude Code (VS Code) pour démarrer le développement du projet PharmGest.

---

## Instructions d'Utilisation

1. **Créer un nouveau dossier** pour le projet (`pharmgest-app`)
2. **Ouvrir VS Code** dans ce dossier
3. **Lancer Claude Code** (extension VS Code)
4. **Copier le prompt ci-dessous** et le coller dans Claude Code
5. **Valider chaque étape** avant de passer à la suivante

---

## Prompt de Démarrage

```
Je démarre un projet d'application de gestion pour une petite pharmacie
à Conakry, Guinée. Voici le contexte complet:

## CONTEXTE CLIENT
- Nom: Pharmacie Thierno Oumar
- Lieu: Conakry, Guinée
- Équipe: 1 propriétaire (Oumar, 52 ans) + 2 employés (dont Abdoulaye, 27 ans)
- Système actuel: Excel + cahiers physiques
- Devices: Smartphones Android (low-end, 2GB RAM, Android 8+)
- Langue: Français uniquement
- Paiements: Cash + Orange Money
- Monnaie: Franc Guinéen (GNF)

## CONTRAINTES TECHNIQUES CRITIQUES
- OFFLINE-FIRST obligatoire (coupures fréquentes, <12h électricité/jour)
- Connectivité intermittente (3G, données mobiles coûteuses)
- Bundle size < 5MB (PWA recommandé)
- Performance: chargement initial <3s sur 3G, recherche <500ms
- Format monétaire: GNF avec espace milliers (15 000 GNF)
- Dates: DD/MM/YYYY, heure 24h
- Pas de fonts custom (system-ui uniquement)

## FONCTIONNALITÉS MVP
1. CONNEXION: PIN 4 chiffres, profils (propriétaire/employé), session mémorisée
2. VENTES: Recherche produit (<500ms), panier, paiement cash/Orange Money, reçu digital
3. STOCKS: Liste produits avec quantités, alertes stock bas (seuil configurable), ajustements manuels
4. DÉPENSES: Saisie avec catégorie (Stock, Loyer, Salaires, Électricité, Transport, Autres), historique filtrable
5. DASHBOARD: Ventes du jour, nombre d'alertes stock, répartition Cash vs Orange Money

## STACK TECHNIQUE
- Frontend: React 18 + Next.js 14 (PWA avec next-pwa)
- State management: Zustand (léger, persiste bien)
- Offline storage: Dexie.js (IndexedDB wrapper)
- Service Worker: Workbox (via next-pwa)
- UI: Tailwind CSS (purged pour taille minimale)
- Backend: Node.js + Express OU Supabase (BaaS)
- Database: PostgreSQL
- Sync: Background sync avec queue et retry

## ARCHITECTURE OFFLINE-FIRST
- Toutes les données d'abord en IndexedDB
- Queue de synchronisation pour les transactions
- Indicateur de sync visible ("3 transactions en attente")
- Sync automatique au retour de connexion
- Stratégie de conflit: last-write-wins avec log

## UX GUIDELINES
- Interface inspirée des registres papier (familiarité)
- Touch-friendly: boutons minimum 48x48dp
- Feedback visuel + sonore à chaque action
- Indicateurs feu tricolore (vert/jaune/rouge) pour les statuts
- Maximum 5 écrans principaux
- Flux de vente en 3 étapes max
- Prévoir expansion texte français (+30% vs anglais)
- Pas d'emojis dans l'UI (sauf indicateurs de statut)

## PERSONAS CLÉS
1. Oumar (52 ans, propriétaire): 
   - Tech faible (WhatsApp + Excel basique)
   - Veut simplicité et ROI visible
   - Utilise: Dashboard, Dépenses, Paramètres
   
2. Abdoulaye (27 ans, employée): 
   - Tech moyenne (smartphone, apps, réseaux sociaux)
   - Veut rapidité et fiabilité
   - Utilise: Ventes, Stocks (consultation)

## MODÈLE DE DONNÉES PRINCIPAL
- Users: id, name, pin_hash, role (OWNER/EMPLOYEE)
- Products: id, name, price_sell, price_buy, stock_quantity, stock_min, synced
- Sales: id, created_at, total, payment_method, payment_ref, user_id, synced
- SaleItems: id, sale_id, product_id, quantity, unit_price, subtotal
- Expenses: id, amount, category, description, date, user_id, synced
- StockMovements: id, product_id, type, quantity_change, reason, user_id, synced
- SyncQueue: id, type, payload, status, created_at, retry_count

## DEMANDE INITIALE
Commence par:
1. Proposer la structure de projet optimale pour ce contexte
2. Créer le setup initial (package.json avec dépendances, config Next.js, Tailwind, PWA)
3. Implémenter le modèle de données avec Dexie.js (schéma IndexedDB)
4. Créer l'architecture offline-first avec la queue de sync
5. Développer l'écran de connexion (PIN + sélection profil)

À chaque étape, explique tes choix et attends ma validation avant de continuer.
```

---

## Prompts de Suivi

### Après le Setup Initial

```
Setup validé. Continuons avec les écrans principaux.

Développe maintenant le DASHBOARD avec:
- Affichage du total des ventes du jour (en GNF, formaté avec espaces)
- Compteur d'alertes stock (avec couleur: vert=0, jaune=1-5, rouge=6+)
- Répartition Cash vs Orange Money (barre de progression simple)
- Bouton "Nouvelle vente" bien visible
- Indicateur de statut de sync en haut

Le dashboard doit être le premier écran après connexion pour le propriétaire.
```

### Module Ventes

```
Dashboard validé. Passons au module VENTES.

Développe le flux de vente complet:
1. Écran recherche produit:
   - Champ de recherche avec autocomplete
   - Résultats: nom, prix (GNF), stock disponible
   - Indicateur couleur si stock bas
   - Tap pour ajouter au panier

2. Écran panier:
   - Liste des produits ajoutés
   - Modification quantité (+/-)
   - Suppression produit
   - Total mis à jour en temps réel
   - Bouton "Paiement"

3. Écran paiement:
   - Choix Cash ou Orange Money
   - Pour Cash: saisie montant reçu, calcul rendu automatique
   - Pour OM: champ référence (optionnel)
   - Bouton "Confirmer"

4. Confirmation:
   - Message succès
   - Option partage reçu WhatsApp
   - Retour au dashboard ou nouvelle vente

La vente doit fonctionner 100% offline et être ajoutée à la queue de sync.
```

### Module Stocks

```
Module ventes validé. Passons aux STOCKS.

Développe:
1. Liste des produits:
   - Affichage: nom, quantité actuelle, seuil min
   - Indicateur couleur (vert=OK, jaune=proche seuil, rouge=sous seuil)
   - Filtres: Tous, En alerte, OK
   - Recherche dans la liste
   - Tri par nom ou quantité

2. Fiche produit (tap sur un produit):
   - Détails complets
   - Historique des mouvements récents
   - Bouton "Ajuster stock"

3. Ajustement stock:
   - Type: Inventaire, Réception, Casse, Périmé, Autre
   - Nouvelle quantité OU différence
   - Motif (obligatoire)
   - Confirmation

4. Ajout nouveau produit:
   - Nom (obligatoire)
   - Prix de vente
   - Prix d'achat (optionnel)
   - Seuil d'alerte
   - Stock initial
```

### Module Dépenses

```
Module stocks validé. Passons aux DÉPENSES.

Développe:
1. Liste des dépenses:
   - Affichage chronologique (récent en premier)
   - Filtre par période (Aujourd'hui, Cette semaine, Ce mois)
   - Filtre par catégorie
   - Total de la période affiché

2. Ajout dépense:
   - Montant (clavier numérique, format GNF)
   - Catégorie (dropdown): Achats stock, Loyer, Salaires, Électricité, Transport, Autres
   - Description (optionnel)
   - Date (défaut: aujourd'hui)

3. Détail dépense (tap):
   - Toutes les infos
   - Option modifier (propriétaire seulement)
   - Option supprimer (avec confirmation)

Ce module n'est accessible qu'au profil propriétaire.
```

### Finalisation

```
Tous les modules sont développés. Finalisons le projet.

1. Vérifie que toutes les fonctionnalités marchent offline:
   - Connexion
   - Création de vente
   - Consultation stocks
   - Ajout dépense
   - Dashboard

2. Optimise les performances:
   - Bundle size < 5MB
   - Lighthouse score > 90
   - Temps de recherche < 500ms

3. Ajoute les éléments finaux:
   - Écran de paramètres (changer PIN, déconnexion)
   - Message de bienvenue au premier lancement
   - Gestion des erreurs gracieuse

4. Prépare le déploiement:
   - Configuration Vercel
   - Variables d'environnement
   - Instructions de déploiement
```

---

## Notes pour le Développeur

### Conventions de Code

```javascript
// Nommage en français pour les données métier
const produit = { nom: "Paracétamol", prix_vente: 15000 };

// Nommage en anglais pour le code technique
const [isLoading, setIsLoading] = useState(false);

// Formatage monétaire
const formatGNF = (amount) => {
  return new Intl.NumberFormat('fr-GN', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount) + ' GNF';
};
// Résultat: "15 000 GNF"

// Formatage date
const formatDate = (date) => {
  return new Intl.DateTimeFormat('fr-GN', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric'
  }).format(date);
};
// Résultat: "15/01/2026"
```

### Structure de Fichiers Recommandée

```
pharmgest-app/
├── public/
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Redirect to /login or /dashboard
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── ventes/
│   │   ├── stocks/
│   │   ├── depenses/
│   │   └── parametres/
│   ├── components/
│   │   ├── ui/                 # Composants réutilisables
│   │   └── features/           # Composants spécifiques
│   ├── lib/
│   │   ├── db.ts               # Dexie.js setup
│   │   ├── sync.ts             # Sync queue logic
│   │   └── utils.ts            # Helpers (formatage, etc.)
│   ├── stores/
│   │   └── auth.ts             # Zustand store
│   └── types/
│       └── index.ts            # TypeScript types
├── tailwind.config.js
├── next.config.js
└── package.json
```

### Checklist Avant Chaque Commit

- [ ] Fonctionne offline
- [ ] Pas d'erreurs TypeScript
- [ ] UI responsive (testé sur 360px width)
- [ ] Textes en français
- [ ] Montants formatés en GNF

---

## Ressources

- [Documentation Discovery complète](./README.md)
- [Personas](./02-personas.md)
- [User Stories](./04-story-map.md)
- [Architecture Technique](./08-technical-architecture.md)

---

*Document créé dans le cadre du Product Discovery — PharmGest*
