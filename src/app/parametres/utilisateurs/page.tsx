'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldX,
  Key,
  Trash2,
  Lock,
  Unlock,
  Mail,
  Calendar,
  MoreVertical,
  X,
  Check,
  Loader2,
  AlertTriangle,
  Crown,
  User as UserIcon,
} from 'lucide-react';
import { db } from '@/lib/client/db';
import { useAuthStore } from '@/stores/auth';
import { queueTransaction } from '@/lib/client/sync';
import { generateId, formatDate } from '@/lib/shared/utils';
import { cn } from '@/lib/client/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Navigation } from '@/components/Navigation';
import type { User } from '@/lib/shared/types';

// Default PIN for new users and resets
const DEFAULT_PIN = '1234';

export default function UserManagementPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { currentUser, isAuthenticated, isInactive, lastActivityAt } = useAuthStore();

  // Auth check
  const hasGoogleSession = sessionStatus === 'authenticated' && !!session?.user;
  const isRecentlyActive = hasGoogleSession && lastActivityAt && !isInactive();
  const isFullyAuthenticated = isAuthenticated || isRecentlyActive;
  const isOwner = currentUser?.role === 'OWNER' || session?.user?.role === 'OWNER';

  // State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResetPinDialog, setShowResetPinDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Form state
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get users from IndexedDB
  const users = useLiveQuery(() => db.users.toArray()) ?? [];

  // Redirect if not authenticated or not owner
  useEffect(() => {
    if (sessionStatus === 'loading') return;

    if (!isFullyAuthenticated) {
      router.push(`/login?callbackUrl=${encodeURIComponent('/parametres/utilisateurs')}`);
      return;
    }

    if (!isOwner) {
      toast.error('Accès refusé', {
        description: 'Seul le propriétaire peut gérer les utilisateurs',
      });
      router.push('/parametres');
    }
  }, [isFullyAuthenticated, isOwner, sessionStatus, router]);

  // Sort users: owner first, then by name
  const sortedUsers = [...users].sort((a, b) => {
    if (a.role === 'OWNER' && b.role !== 'OWNER') return -1;
    if (a.role !== 'OWNER' && b.role === 'OWNER') return 1;
    return a.name.localeCompare(b.name);
  });

  // Handle add new user
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) {
      toast.error('Veuillez entrer un nom');
      return;
    }

    setIsSubmitting(true);
    try {
      const newUser: User = {
        id: generateId(),
        name: newUserName.trim(),
        email: newUserEmail.trim() || null,
        role: 'EMPLOYEE',
        pinHash: null, // Will be set on first login
        mustChangePin: true,
        createdAt: new Date(),
      };

      await db.users.add(newUser);
      await queueTransaction('USER', 'CREATE', newUser);

      toast.success('Employé ajouté', {
        description: `${newUser.name} peut maintenant se connecter avec le PIN ${DEFAULT_PIN}`,
      });

      setNewUserName('');
      setNewUserEmail('');
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding user:', error);
      toast.error('Erreur lors de l\'ajout');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle reset PIN
  const handleResetPin = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      await db.users.update(selectedUser.id, {
        pinHash: null,
        mustChangePin: true,
      });

      await queueTransaction('USER', 'UPDATE_PIN', {
        id: selectedUser.id,
        pinHash: null,
        mustChangePin: true,
      });

      toast.success('PIN réinitialisé', {
        description: `${selectedUser.name} doit maintenant utiliser le PIN ${DEFAULT_PIN}`,
      });

      setShowResetPinDialog(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error resetting PIN:', error);
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete user
  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    if (selectedUser.role === 'OWNER') {
      toast.error('Impossible de supprimer le propriétaire');
      return;
    }

    setIsSubmitting(true);
    try {
      await db.users.delete(selectedUser.id);
      await queueTransaction('USER', 'DELETE', { id: selectedUser.id });

      toast.success('Utilisateur supprimé', {
        description: `${selectedUser.name} a été supprimé`,
      });

      setShowDeleteDialog(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (sessionStatus === 'loading' || !isFullyAuthenticated) {
    return null;
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-slate-950 pb-24">
        <div className="sticky top-0 z-20 bg-gradient-to-b from-slate-900 to-slate-900/95 backdrop-blur-xl border-b border-slate-800/50 px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2.5 hover:bg-slate-800/80 rounded-xl transition-all ring-1 ring-slate-700/50"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-xl font-bold text-white">Gestion des utilisateurs</h1>
          </div>
        </div>
        <main className="max-w-md mx-auto px-4 py-8">
          <div className="bg-slate-900 rounded-xl p-8 text-center border border-slate-700">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <ShieldX className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Accès restreint</h2>
            <p className="text-slate-400">
              Seuls les propriétaires peuvent gérer les utilisateurs.
            </p>
          </div>
        </main>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-900/95 backdrop-blur-xl border-b border-slate-800/50">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2.5 hover:bg-slate-800/80 rounded-xl transition-all duration-200 active:scale-95 ring-1 ring-slate-700/50"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Gestion des utilisateurs</h1>
                <p className="text-sm text-slate-400 mt-0.5">{users.length} utilisateur{users.length > 1 ? 's' : ''}</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-3 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-xl transition-all duration-200 ring-1 ring-emerald-500/30 active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span className="text-sm font-medium">Ajouter</span>
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div className="px-4 pb-4">
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <Key className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300/80">
              Le PIN par défaut pour les nouveaux employés est <span className="font-mono font-bold text-amber-300">{DEFAULT_PIN}</span>.
              Ils devront le changer à leur première connexion.
            </p>
          </div>
        </div>
      </div>

      {/* User List */}
      <div className="px-4 py-4 space-y-3">
        {sortedUsers.map((user, index) => {
          const isCurrentUser = user.id === currentUser?.id;
          const isUserOwner = user.role === 'OWNER';

          return (
            <div
              key={user.id}
              className={cn(
                'relative overflow-hidden rounded-xl border transition-all duration-200',
                'bg-gradient-to-r from-slate-800/80 to-slate-800/40',
                isUserOwner
                  ? 'border-emerald-500/30 ring-1 ring-emerald-500/10'
                  : 'border-slate-700/50',
                'hover:border-slate-600/50'
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold shrink-0',
                    isUserOwner
                      ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 text-emerald-400 ring-1 ring-emerald-500/30'
                      : 'bg-gradient-to-br from-slate-700 to-slate-800 text-slate-300 ring-1 ring-slate-600/50'
                  )}>
                    {user.image ? (
                      <img
                        src={user.image}
                        alt={user.name}
                        className="w-full h-full rounded-xl object-cover"
                      />
                    ) : (
                      getInitials(user.name)
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white truncate">{user.name}</h3>
                      {isCurrentUser && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-300 rounded">
                          Vous
                        </span>
                      )}
                    </div>

                    {/* Role badge */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium',
                        isUserOwner
                          ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
                          : 'bg-slate-700/50 text-slate-400 ring-1 ring-slate-600/50'
                      )}>
                        {isUserOwner ? (
                          <>
                            <Crown className="w-3 h-3" />
                            Propriétaire
                          </>
                        ) : (
                          <>
                            <UserIcon className="w-3 h-3" />
                            Employé
                          </>
                        )}
                      </span>
                    </div>

                    {/* Email */}
                    {user.email && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{user.email}</span>
                      </div>
                    )}

                    {/* Created date */}
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />
                      <span>Créé le {formatDate(new Date(user.createdAt))}</span>
                    </div>

                    {/* PIN status */}
                    {user.mustChangePin && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
                          <Key className="w-3 h-3" />
                          Doit changer son PIN
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions Menu */}
                  {!isUserOwner && (
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)}
                        className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-slate-400" />
                      </button>

                      {/* Dropdown menu */}
                      {activeMenu === user.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setActiveMenu(null)}
                          />
                          <div className="absolute right-0 top-10 z-20 w-48 bg-slate-800 rounded-xl border border-slate-700 shadow-2xl overflow-hidden">
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setShowResetPinDialog(true);
                                setActiveMenu(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
                            >
                              <Key className="w-4 h-4 text-amber-400" />
                              Réinitialiser PIN
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setShowDeleteDialog(true);
                                setActiveMenu(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              Supprimer
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {users.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800/60 flex items-center justify-center ring-1 ring-slate-700/50">
              <Users className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-400 mb-1">Aucun utilisateur</h3>
            <p className="text-sm text-slate-500">
              Ajoutez des employés pour leur donner accès à l&apos;application
            </p>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative w-full max-w-md bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center ring-1 ring-emerald-500/30">
                  <UserPlus className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Nouvel employé</h3>
                  <p className="text-xs text-slate-400">Ajouter un membre de l&apos;équipe</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAddUser} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nom complet *
                </label>
                <Input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Abdoulaye Diallo"
                  className="h-12 bg-slate-800 border-slate-700 focus:border-emerald-500 rounded-xl text-white placeholder:text-slate-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email (optionnel)
                </label>
                <Input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="abdoulaye@pharmacie.gn"
                  className="h-12 bg-slate-800 border-slate-700 focus:border-emerald-500 rounded-xl text-white placeholder:text-slate-500"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Pour la connexion via Google (optionnel)
                </p>
              </div>

              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-300">Rôle: <span className="font-medium">Employé</span></p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Accès aux ventes et au stock uniquement
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 h-12 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !newUserName.trim()}
                  className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Ajouter
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset PIN Dialog */}
      {showResetPinDialog && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowResetPinDialog(false);
              setSelectedUser(null);
            }}
          />
          <div className="relative w-full max-w-sm bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl p-6">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-500/15 flex items-center justify-center ring-1 ring-amber-500/30">
                <Key className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Réinitialiser le PIN ?</h3>
              <p className="text-sm text-slate-400 mb-6">
                Le PIN de <span className="font-medium text-white">{selectedUser.name}</span> sera
                réinitialisé à <span className="font-mono font-bold text-amber-400">{DEFAULT_PIN}</span>.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowResetPinDialog(false);
                  setSelectedUser(null);
                }}
                className="flex-1 h-11 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700"
              >
                Annuler
              </Button>
              <Button
                onClick={handleResetPin}
                disabled={isSubmitting}
                className="flex-1 h-11 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Réinitialiser'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Dialog */}
      {showDeleteDialog && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowDeleteDialog(false);
              setSelectedUser(null);
            }}
          />
          <div className="relative w-full max-w-sm bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl p-6">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/15 flex items-center justify-center ring-1 ring-red-500/30">
                <AlertTriangle className="w-7 h-7 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Supprimer cet utilisateur ?</h3>
              <p className="text-sm text-slate-400 mb-6">
                <span className="font-medium text-white">{selectedUser.name}</span> ne pourra
                plus accéder à l&apos;application. Cette action est irréversible.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setSelectedUser(null);
                }}
                className="flex-1 h-11 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700"
              >
                Annuler
              </Button>
              <Button
                onClick={handleDeleteUser}
                disabled={isSubmitting}
                className="flex-1 h-11 bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Supprimer'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  );
}
