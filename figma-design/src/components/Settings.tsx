import { useApp } from '../lib/context';
import { Card } from './ui/card';
import { ArrowLeft, User, Shield, Database, Info, Bell, Globe, Download, Upload } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export function Settings({ onBack }: { onBack?: () => void }) {
  const { currentUser, isOnline, pendingSyncCount } = useApp();

  return (
    <div className="space-y-4">
      {/* Header */}
      {onBack && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack} 
              className="w-11 h-11 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-emerald-500 dark:hover:border-emerald-400 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all active:scale-90"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-gray-900 dark:text-white text-xl font-semibold">Paramètres</h2>
          </div>
        </div>
      )}

      {/* User Profile */}
      <Card className="p-5 rounded-lg shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-gray-900 dark:text-white font-semibold text-lg">Profil utilisateur</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Informations du compte</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">Nom</span>
            <span className="text-gray-900 dark:text-white font-semibold">{currentUser?.name}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">Rôle</span>
            <span className="text-gray-900 dark:text-white font-semibold capitalize">
              {currentUser?.role === 'owner' ? 'Propriétaire' : 'Employé(e)'}
            </span>
          </div>
        </div>
      </Card>

      {/* Appearance */}
      <Card className="p-5 rounded-lg shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-gray-900 dark:text-white font-semibold text-lg">Apparence</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Personnaliser l'affichage</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <span className="text-gray-900 dark:text-white font-medium block">Thème</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Clair ou sombre</span>
            </div>
            <ThemeToggle />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <span className="text-gray-900 dark:text-white font-medium block">Devise</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Monnaie d'affichage</span>
            </div>
            <span className="text-gray-700 dark:text-gray-300 font-semibold">GNF</span>
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-5 rounded-lg shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
            <Bell className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-gray-900 dark:text-white font-semibold text-lg">Notifications</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Alertes et rappels</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer">
            <div>
              <span className="text-gray-900 dark:text-white font-medium block">Stock faible</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Alertes de réapprovisionnement</span>
            </div>
            <input 
              type="checkbox" 
              defaultChecked 
              className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer">
            <div>
              <span className="text-gray-900 dark:text-white font-medium block">Synchronisation</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">État de la connexion</span>
            </div>
            <input 
              type="checkbox" 
              defaultChecked 
              className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
          </label>
        </div>
      </Card>

      {/* Data & Sync */}
      <Card className="p-5 rounded-lg shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-gray-900 dark:text-white font-semibold text-lg">Données</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Synchronisation et sauvegarde</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {isOnline ? 'Connecté' : 'Hors ligne'}
              </span>
            </div>
            {pendingSyncCount > 0 && (
              <p className="text-sm text-emerald-600 dark:text-emerald-300">
                {pendingSyncCount} opération{pendingSyncCount > 1 ? 's' : ''} en attente de synchronisation
              </p>
            )}
            {pendingSyncCount === 0 && isOnline && (
              <p className="text-sm text-emerald-600 dark:text-emerald-300">
                Toutes les données sont synchronisées
              </p>
            )}
          </div>

          <button className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
            <div className="flex items-center gap-3">
              <Upload className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div className="text-left">
                <span className="text-gray-900 dark:text-white font-medium block">Forcer la synchronisation</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Synchroniser maintenant</span>
              </div>
            </div>
          </button>

          <button className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div className="text-left">
                <span className="text-gray-900 dark:text-white font-medium block">Exporter les données</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Sauvegarde locale</span>
              </div>
            </div>
          </button>
        </div>
      </Card>

      {/* Security */}
      {currentUser?.role === 'owner' && (
        <Card className="p-5 rounded-lg shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-gray-900 dark:text-white font-semibold text-lg">Sécurité</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Gestion des accès</p>
            </div>
          </div>

          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <div className="text-left">
                <span className="text-gray-900 dark:text-white font-medium block">Modifier le code PIN</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Changer votre code d'accès</span>
              </div>
            </button>

            <button className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <div className="text-left">
                <span className="text-gray-900 dark:text-white font-medium block">Gérer les utilisateurs</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Ajouter ou modifier des comptes</span>
              </div>
            </button>
          </div>
        </Card>
      )}

      {/* About */}
      <Card className="p-5 rounded-lg shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
            <Info className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-gray-900 dark:text-white font-semibold text-lg">À propos</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Informations sur l'application</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">Version</span>
            <span className="text-gray-900 dark:text-white font-semibold">1.0.0</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">Pharmacie</span>
            <span className="text-gray-900 dark:text-white font-semibold">Thierno Mamadou</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">Localisation</span>
            <span className="text-gray-900 dark:text-white font-semibold">Conakry, Guinée</span>
          </div>
        </div>
      </Card>

      {/* Footer Info */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          Seri - Gestion de pharmacie<br />
          Conçu pour la Pharmacie Thierno Mamadou
        </p>
      </div>
    </div>
  );
}