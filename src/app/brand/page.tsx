'use client';

import { useState } from 'react';
import { Moon, Sun, Check, Pill, Plus, Heart, Shield, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// Color scheme definitions
const colorSchemes = {
  emerald: {
    name: 'Émeraude',
    description: 'Actuel - Professionnel et naturel',
    primary: '#059669',
    primaryLight: '#10b981',
    primaryDark: '#047857',
    secondary: '#0d9488',
    accent: '#f59e0b',
    surface: '#f0fdf4',
    surfaceDark: '#022c22',
  },
  teal: {
    name: 'Turquoise',
    description: 'Moderne et apaisant',
    primary: '#0891b2',
    primaryLight: '#22d3ee',
    primaryDark: '#0e7490',
    secondary: '#06b6d4',
    accent: '#8b5cf6',
    surface: '#ecfeff',
    surfaceDark: '#083344',
  },
  forest: {
    name: 'Forêt',
    description: 'Luxueux et fiable',
    primary: '#166534',
    primaryLight: '#22c55e',
    primaryDark: '#14532d',
    secondary: '#15803d',
    accent: '#eab308',
    surface: '#f0fdf4',
    surfaceDark: '#052e16',
  },
  sage: {
    name: 'Sauge',
    description: 'Frais et innovant',
    primary: '#4ade80',
    primaryLight: '#86efac',
    primaryDark: '#22c55e',
    secondary: '#2dd4bf',
    accent: '#f472b6',
    surface: '#f0fdfa',
    surfaceDark: '#042f2e',
  },
};

type SchemeKey = keyof typeof colorSchemes;

// Logo component variations
function LogoVariant1({ scheme, size = 80 }: { scheme: typeof colorSchemes.emerald; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Rounded square background */}
      <rect width="80" height="80" rx="16" fill={scheme.primary} />
      {/* PTM Letters stacked elegantly */}
      <text x="40" y="32" fontFamily="system-ui" fontSize="18" fontWeight="700" fill="white" textAnchor="middle">PTM</text>
      {/* Medical cross below */}
      <rect x="36" y="40" width="8" height="24" rx="2" fill="white" opacity="0.9" />
      <rect x="28" y="48" width="24" height="8" rx="2" fill="white" opacity="0.9" />
    </svg>
  );
}

function LogoVariant2({ scheme, size = 80 }: { scheme: typeof colorSchemes.emerald; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Pill-shaped container */}
      <rect width="80" height="80" rx="40" fill={scheme.primary} />
      {/* Split design */}
      <rect x="40" width="40" height="80" rx="0" fill={scheme.primaryDark} style={{ clipPath: 'inset(0 0 0 0 round 0 40px 40px 0)' }} />
      <path d="M40 0 L80 0 L80 80 L40 80 Z" fill={scheme.primaryDark} clipPath="url(#pillClip)" />
      {/* PTM text */}
      <text x="40" y="46" fontFamily="system-ui" fontSize="20" fontWeight="800" fill="white" textAnchor="middle" letterSpacing="2">PTM</text>
    </svg>
  );
}

function LogoVariant3({ scheme, size = 80 }: { scheme: typeof colorSchemes.emerald; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Hexagonal pharmacy shape */}
      <path d="M40 4 L72 20 L72 60 L40 76 L8 60 L8 20 Z" fill={scheme.primary} />
      {/* Inner glow */}
      <path d="M40 12 L64 24 L64 56 L40 68 L16 56 L16 24 Z" fill={scheme.primaryLight} opacity="0.3" />
      {/* PTM monogram */}
      <text x="40" y="38" fontFamily="system-ui" fontSize="14" fontWeight="700" fill="white" textAnchor="middle">PTM</text>
      {/* Seri below */}
      <text x="40" y="54" fontFamily="system-ui" fontSize="12" fontWeight="500" fill="white" textAnchor="middle" opacity="0.9">SERI</text>
    </svg>
  );
}

function LogoVariant4({ scheme, size = 80 }: { scheme: typeof colorSchemes.emerald; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Circle with gradient feel */}
      <circle cx="40" cy="40" r="38" fill={scheme.primary} />
      <circle cx="40" cy="40" r="32" fill={scheme.primaryDark} opacity="0.3" />
      {/* Stylized P with T and M incorporated */}
      <path d="M24 22 L24 58 L32 58 L32 46 L44 46 C52 46 56 40 56 34 C56 28 52 22 44 22 Z M32 30 L42 30 C46 30 48 32 48 34 C48 36 46 38 42 38 L32 38 Z" fill="white" />
      {/* Small cross accent */}
      <rect x="52" y="50" width="4" height="12" rx="1" fill={scheme.accent} />
      <rect x="48" y="54" width="12" height="4" rx="1" fill={scheme.accent} />
    </svg>
  );
}

// Sample component previews
function ButtonPreview({ scheme, isDark }: { scheme: typeof colorSchemes.emerald; isDark: boolean }) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:scale-105 active:scale-95 shadow-lg"
        style={{ backgroundColor: scheme.primary, boxShadow: `0 8px 24px ${scheme.primary}40` }}
      >
        Primaire
      </button>
      <button
        className="px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 border-2"
        style={{
          borderColor: scheme.primary,
          color: isDark ? 'white' : scheme.primary,
          backgroundColor: 'transparent'
        }}
      >
        Secondaire
      </button>
      <button
        className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:scale-105 active:scale-95"
        style={{ backgroundColor: scheme.accent }}
      >
        Accent
      </button>
    </div>
  );
}

function CardPreview({ scheme, isDark }: { scheme: typeof colorSchemes.emerald; isDark: boolean }) {
  return (
    <div
      className="p-5 rounded-2xl border shadow-sm max-w-xs"
      style={{
        backgroundColor: isDark ? scheme.surfaceDark : 'white',
        borderColor: isDark ? `${scheme.primary}30` : '#e5e7eb'
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${scheme.primary}20` }}
        >
          <Pill className="w-5 h-5" style={{ color: scheme.primary }} />
        </div>
        <div>
          <h4 className={cn("font-semibold", isDark ? "text-white" : "text-gray-900")}>Paracetamol 500mg</h4>
          <p className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-500")}>Antidouleur</p>
        </div>
      </div>
      <div className="flex justify-between items-center">
        <span className="font-bold text-lg" style={{ color: scheme.primary }}>15 000 GNF</span>
        <span
          className="px-2 py-1 rounded-full text-xs font-medium"
          style={{ backgroundColor: '#22c55e20', color: '#22c55e' }}
        >
          En stock: 45
        </span>
      </div>
    </div>
  );
}

function BadgePreview({ scheme }: { scheme: typeof colorSchemes.emerald }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span
        className="px-3 py-1 rounded-full text-sm font-medium text-white"
        style={{ backgroundColor: scheme.primary }}
      >
        Nouveau
      </span>
      <span
        className="px-3 py-1 rounded-full text-sm font-medium"
        style={{ backgroundColor: `${scheme.primary}20`, color: scheme.primary }}
      >
        Antibiotique
      </span>
      <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700">
        Stock bas
      </span>
      <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
        Rupture
      </span>
    </div>
  );
}

function MiniDashboard({ scheme, isDark }: { scheme: typeof colorSchemes.emerald; isDark: boolean }) {
  return (
    <div
      className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border"
      style={{
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        borderColor: isDark ? '#1e293b' : '#e2e8f0'
      }}
    >
      {/* Header */}
      <div
        className="p-4 text-white"
        style={{ background: `linear-gradient(135deg, ${scheme.primary}, ${scheme.primaryDark})` }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <LogoVariant1 scheme={scheme} size={32} />
            <span className="font-bold">Seri</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-sm font-bold">M</span>
          </div>
        </div>
        <p className="text-white/80 text-sm">Bienvenue, Mamadou</p>
        <p className="text-2xl font-bold mt-1">245 000 GNF</p>
        <p className="text-white/70 text-xs">Ventes aujourd&apos;hui</p>
      </div>

      {/* Quick stats */}
      <div className="p-4 grid grid-cols-3 gap-2">
        {[
          { label: 'Ventes', value: '12', color: scheme.primary },
          { label: 'Alertes', value: '3', color: '#f59e0b' },
          { label: 'Sync', value: '✓', color: '#22c55e' },
        ].map((stat) => (
          <div
            key={stat.label}
            className={cn(
              "p-3 rounded-xl text-center",
              isDark ? "bg-slate-800" : "bg-white"
            )}
          >
            <p className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</p>
            <p className={cn("text-xs", isDark ? "text-gray-400" : "text-gray-500")}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Action button */}
      <div className="px-4 pb-4">
        <button
          className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
          style={{ backgroundColor: scheme.primary }}
        >
          <Plus className="w-5 h-5" />
          Nouvelle vente
        </button>
      </div>
    </div>
  );
}

export default function BrandPage() {
  const [isDark, setIsDark] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState<SchemeKey>('emerald');
  const [selectedLogo, setSelectedLogo] = useState(1);

  const scheme = colorSchemes[selectedScheme];

  return (
    <div
      className={cn(
        "min-h-screen transition-colors duration-500",
        isDark ? "bg-slate-950" : "bg-gradient-to-br from-slate-50 via-white to-slate-100"
      )}
    >
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: scheme.primary }}
        />
        <div
          className="absolute -bottom-1/2 -left-1/2 w-full h-full rounded-full blur-3xl opacity-10"
          style={{ backgroundColor: scheme.secondary }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-opacity-10" style={{ borderColor: isDark ? '#ffffff20' : '#00000010' }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoVariant1 scheme={scheme} size={48} />
            <div>
              <h1 className={cn("font-bold text-xl", isDark ? "text-white" : "text-gray-900")}>
                Seri <span className="font-normal text-sm opacity-60">Brand Guide</span>
              </h1>
              <p className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-500")}>
                Pharmacie Thierno Mamadou
              </p>
            </div>
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            className={cn(
              "p-3 rounded-xl transition-all hover:scale-105",
              isDark
                ? "bg-slate-800 text-yellow-400 hover:bg-slate-700"
                : "bg-white text-slate-700 hover:bg-gray-50 shadow-md"
            )}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-12 space-y-16">

        {/* Hero Section */}
        <section className="text-center space-y-4">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
            style={{
              backgroundColor: `${scheme.primary}15`,
              color: scheme.primary
            }}
          >
            <Sparkles className="w-4 h-4" />
            Guide de marque 2026
          </div>
          <h2 className={cn(
            "text-4xl md:text-5xl font-bold tracking-tight",
            isDark ? "text-white" : "text-gray-900"
          )}>
            Identité visuelle
          </h2>
          <p className={cn(
            "text-lg max-w-2xl mx-auto",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            Une expérience moderne, professionnelle et digne de confiance pour la gestion de pharmacie en Guinée.
          </p>
        </section>

        {/* Logo Section */}
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${scheme.primary}15` }}
            >
              <Shield className="w-5 h-5" style={{ color: scheme.primary }} />
            </div>
            <div>
              <h3 className={cn("text-2xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                Logos PTM
              </h3>
              <p className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-500")}>
                Variations du logo Pharmacie Thierno Mamadou
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { id: 1, name: 'Classique', desc: 'Croix médicale intégrée', Logo: LogoVariant1 },
              { id: 2, name: 'Capsule', desc: 'Forme de pilule moderne', Logo: LogoVariant2 },
              { id: 3, name: 'Hexagone', desc: 'Géométrique et stable', Logo: LogoVariant3 },
              { id: 4, name: 'Monogramme', desc: 'P stylisé avec accent', Logo: LogoVariant4 },
            ].map(({ id, name, desc, Logo }) => (
              <button
                key={id}
                onClick={() => setSelectedLogo(id)}
                className={cn(
                  "p-6 rounded-2xl border-2 transition-all hover:scale-105 flex flex-col items-center gap-4",
                  selectedLogo === id
                    ? "shadow-xl"
                    : isDark
                      ? "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                      : "bg-white border-gray-200 hover:border-gray-300"
                )}
                style={{
                  borderColor: selectedLogo === id ? scheme.primary : undefined,
                  backgroundColor: selectedLogo === id
                    ? (isDark ? `${scheme.primary}10` : `${scheme.primary}05`)
                    : undefined
                }}
              >
                <Logo scheme={scheme} size={80} />
                <div className="text-center">
                  <p className={cn("font-semibold", isDark ? "text-white" : "text-gray-900")}>{name}</p>
                  <p className={cn("text-xs", isDark ? "text-gray-500" : "text-gray-500")}>{desc}</p>
                </div>
                {selectedLogo === id && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: scheme.primary }}
                  >
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Color Palette Section */}
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${scheme.primary}15` }}
            >
              <Heart className="w-5 h-5" style={{ color: scheme.primary }} />
            </div>
            <div>
              <h3 className={cn("text-2xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                Palettes de couleurs
              </h3>
              <p className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-500")}>
                Choisissez une direction chromatique
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.keys(colorSchemes) as SchemeKey[]).map((key) => {
              const s = colorSchemes[key];
              const isSelected = selectedScheme === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedScheme(key)}
                  className={cn(
                    "p-4 rounded-2xl border-2 transition-all hover:scale-102 text-left",
                    isSelected
                      ? "shadow-xl"
                      : isDark
                        ? "bg-slate-900/50 border-slate-800"
                        : "bg-white border-gray-200"
                  )}
                  style={{
                    borderColor: isSelected ? s.primary : undefined,
                  }}
                >
                  {/* Color swatches */}
                  <div className="flex gap-1 mb-3">
                    <div className="w-10 h-10 rounded-l-lg" style={{ backgroundColor: s.primary }} />
                    <div className="w-10 h-10" style={{ backgroundColor: s.primaryLight }} />
                    <div className="w-10 h-10" style={{ backgroundColor: s.secondary }} />
                    <div className="w-10 h-10 rounded-r-lg" style={{ backgroundColor: s.accent }} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn("font-semibold", isDark ? "text-white" : "text-gray-900")}>
                        {s.name}
                      </p>
                      <p className={cn("text-xs", isDark ? "text-gray-500" : "text-gray-500")}>
                        {s.description}
                      </p>
                    </div>
                    {isSelected && (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: s.primary }}
                      >
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detailed color breakdown */}
          <div
            className={cn(
              "p-6 rounded-2xl border",
              isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-gray-200"
            )}
          >
            <h4 className={cn("font-semibold mb-4", isDark ? "text-white" : "text-gray-900")}>
              Détail de la palette: {scheme.name}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {[
                { name: 'Primaire', color: scheme.primary },
                { name: 'Primaire clair', color: scheme.primaryLight },
                { name: 'Primaire foncé', color: scheme.primaryDark },
                { name: 'Secondaire', color: scheme.secondary },
                { name: 'Accent', color: scheme.accent },
                { name: 'Succès', color: '#22c55e' },
                { name: 'Erreur', color: '#ef4444' },
              ].map((c) => (
                <div key={c.name} className="space-y-2">
                  <div
                    className="w-full aspect-square rounded-xl shadow-inner"
                    style={{ backgroundColor: c.color }}
                  />
                  <p className={cn("text-xs font-medium", isDark ? "text-gray-400" : "text-gray-600")}>
                    {c.name}
                  </p>
                  <p className={cn("text-xs font-mono", isDark ? "text-gray-500" : "text-gray-400")}>
                    {c.color}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Typography Section */}
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
              style={{ backgroundColor: `${scheme.primary}15`, color: scheme.primary }}
            >
              Aa
            </div>
            <div>
              <h3 className={cn("text-2xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                Typographie
              </h3>
              <p className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-500")}>
                Police système pour performance optimale
              </p>
            </div>
          </div>

          <div
            className={cn(
              "p-6 rounded-2xl border space-y-6",
              isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-gray-200"
            )}
          >
            <div className="space-y-2">
              <p className={cn("text-xs font-medium uppercase tracking-wider", isDark ? "text-gray-500" : "text-gray-400")}>
                Font Stack
              </p>
              <code className={cn("text-sm font-mono", isDark ? "text-gray-300" : "text-gray-700")}>
                system-ui, -apple-system, BlinkMacSystemFont, &apos;Segoe UI&apos;, sans-serif
              </code>
            </div>

            <div className="space-y-4">
              <div>
                <p className={cn("text-xs mb-1", isDark ? "text-gray-500" : "text-gray-400")}>
                  Display / 48px / Bold
                </p>
                <p className={cn("text-5xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                  Pharmacie Thierno Mamadou
                </p>
              </div>
              <div>
                <p className={cn("text-xs mb-1", isDark ? "text-gray-500" : "text-gray-400")}>
                  Heading / 32px / Semibold
                </p>
                <p className={cn("text-3xl font-semibold", isDark ? "text-white" : "text-gray-900")}>
                  Gestion moderne de pharmacie
                </p>
              </div>
              <div>
                <p className={cn("text-xs mb-1", isDark ? "text-gray-500" : "text-gray-400")}>
                  Subheading / 20px / Medium
                </p>
                <p className={cn("text-xl font-medium", isDark ? "text-gray-300" : "text-gray-700")}>
                  Solution offline-first pour la Guinée
                </p>
              </div>
              <div>
                <p className={cn("text-xs mb-1", isDark ? "text-gray-500" : "text-gray-400")}>
                  Body / 16px / Regular
                </p>
                <p className={cn("text-base", isDark ? "text-gray-400" : "text-gray-600")}>
                  Seri permet aux pharmacies indépendantes de gérer leurs ventes, stocks et dépenses même sans connexion internet. Une application pensée pour les réalités du terrain.
                </p>
              </div>
              <div>
                <p className={cn("text-xs mb-1", isDark ? "text-gray-500" : "text-gray-400")}>
                  Small / 14px / Regular
                </p>
                <p className={cn("text-sm", isDark ? "text-gray-500" : "text-gray-500")}>
                  Dernière synchronisation: 15/01/2026 à 14:32
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Components Section */}
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${scheme.primary}15` }}
            >
              <Plus className="w-5 h-5" style={{ color: scheme.primary }} />
            </div>
            <div>
              <h3 className={cn("text-2xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                Composants UI
              </h3>
              <p className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-500")}>
                Aperçu des éléments d&apos;interface
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Buttons */}
            <div
              className={cn(
                "p-6 rounded-2xl border space-y-4",
                isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-gray-200"
              )}
            >
              <h4 className={cn("font-semibold", isDark ? "text-white" : "text-gray-900")}>
                Boutons
              </h4>
              <ButtonPreview scheme={scheme} isDark={isDark} />
            </div>

            {/* Badges */}
            <div
              className={cn(
                "p-6 rounded-2xl border space-y-4",
                isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-gray-200"
              )}
            >
              <h4 className={cn("font-semibold", isDark ? "text-white" : "text-gray-900")}>
                Badges
              </h4>
              <BadgePreview scheme={scheme} />
            </div>

            {/* Card */}
            <div
              className={cn(
                "p-6 rounded-2xl border space-y-4 md:col-span-2",
                isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-gray-200"
              )}
            >
              <h4 className={cn("font-semibold", isDark ? "text-white" : "text-gray-900")}>
                Carte produit
              </h4>
              <CardPreview scheme={scheme} isDark={isDark} />
            </div>
          </div>
        </section>

        {/* App Preview Section */}
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${scheme.primary}15` }}
            >
              <Pill className="w-5 h-5" style={{ color: scheme.primary }} />
            </div>
            <div>
              <h3 className={cn("text-2xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                Aperçu de l&apos;application
              </h3>
              <p className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-500")}>
                Dashboard avec le thème sélectionné
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <MiniDashboard scheme={scheme} isDark={isDark} />
          </div>
        </section>

        {/* Footer */}
        <footer className={cn(
          "text-center py-8 border-t",
          isDark ? "border-slate-800 text-gray-500" : "border-gray-200 text-gray-400"
        )}>
          <p className="text-sm">
            © 2026 Seri - Pharmacie Thierno Mamadou • Conakry, Guinée
          </p>
        </footer>
      </main>
    </div>
  );
}
