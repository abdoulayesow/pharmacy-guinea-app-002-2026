'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAuthStore } from '@/stores/auth';
import { db } from '@/lib/client/db';
import { queueTransaction } from '@/lib/client/sync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Building2, Phone, Calendar, Save } from 'lucide-react';
import { generateId } from '@/lib/shared/utils';

export default function NewSupplierPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { isAuthenticated } = useAuthStore();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('30');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if not authenticated (check both OAuth session and Zustand store)
  useEffect(() => {
    if (status === 'loading') return;
    const hasOAuthSession = status === 'authenticated' && !!session?.user;
    if (!isAuthenticated && !hasOAuthSession) {
      router.push(`/login?callbackUrl=${encodeURIComponent('/fournisseurs/nouveau')}`);
    }
  }, [isAuthenticated, session, status, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const supplierData = {
        id: generateId(),
        name,
        phone: phone.trim() || undefined,
        paymentTermsDays: parseInt(paymentTermsDays),
        createdAt: new Date(),
        updatedAt: new Date(),
        synced: false,
      };
      await db.suppliers.add(supplierData);
      await queueTransaction('SUPPLIER', 'CREATE', supplierData);

      // Navigate back to supplier list
      router.push('/fournisseurs');
    } catch (error) {
      console.error('Error adding supplier:', error);
      alert('Erreur lors de l\'ajout du fournisseur');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show nothing while checking auth or if not authenticated
  const hasOAuthSession = status === 'authenticated' && !!session?.user;
  if (status === 'loading' || (!isAuthenticated && !hasOAuthSession)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="flex items-center gap-3 p-4 max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Nouveau fournisseur</h1>
            <p className="text-sm text-slate-400">Ajoutez un nouveau partenaire</p>
          </div>
        </div>
      </div>

      <main className="p-4 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Supplier Icon Display */}
          <div className="flex justify-center pt-4 pb-2">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center border-2 border-emerald-500/30">
              <Building2 className="w-12 h-12 text-emerald-400" />
            </div>
          </div>

          {/* Basic Information */}
          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
              Informations de base
            </h3>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Nom du fournisseur *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Building2 className="w-5 h-5" />
                </div>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Sopharma Guinée"
                  className="h-14 pl-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl text-base"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Téléphone
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Phone className="w-5 h-5" />
                </div>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+224 622 12 34 56"
                  className="h-14 pl-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl text-base"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">Optionnel - pour contact rapide</p>
            </div>
          </div>

          {/* Payment Terms */}
          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
              Conditions de paiement
            </h3>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Délai de crédit (jours) *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Calendar className="w-5 h-5" />
                </div>
                <Input
                  type="number"
                  value={paymentTermsDays}
                  onChange={(e) => setPaymentTermsDays(e.target.value)}
                  placeholder="30"
                  min="0"
                  max="365"
                  className="h-14 pl-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl text-base"
                  required
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Nombre de jours après commande pour payer (standard: 30j)
              </p>
            </div>

            {/* Quick Select Buttons */}
            <div className="grid grid-cols-4 gap-2 pt-2">
              {[15, 30, 45, 60].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setPaymentTermsDays(days.toString())}
                  className={`h-12 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                    paymentTermsDays === days.toString()
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {days}j
                </button>
              ))}
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
            <p className="text-sm text-emerald-400/90 leading-relaxed">
              💡 <span className="font-semibold">Astuce:</span> Le délai de crédit définit
              automatiquement la date d'échéance pour chaque commande. Vous pourrez
              l'ajuster individuellement si nécessaire.
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="flex-1 h-14 text-base bg-slate-800 border-slate-700 text-white hover:bg-slate-700 rounded-xl"
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 h-14 text-base bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Enregistrement...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-5 h-5" />
                  Enregistrer
                </span>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
