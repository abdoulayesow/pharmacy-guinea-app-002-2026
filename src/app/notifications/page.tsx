'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/client/db';
import { formatCurrency, formatDate } from '@/lib/shared/utils';
import { ArrowLeft, Bell, Phone, MessageCircle, Check, Flag, Clock, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import type { Sale } from '@/lib/shared/types';

type ReminderPriority = 'CRITICAL' | 'URGENT' | 'UPCOMING' | 'SCHEDULED';

interface PaymentReminder {
  sale: Sale;
  priority: ReminderPriority;
  daysUntilDue: number;
  message: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [selectedReminder, setSelectedReminder] = useState<PaymentReminder | null>(null);
  const [showMessageComposer, setShowMessageComposer] = useState(false);

  // Fetch credit sales with pending payments
  const creditSales = useLiveQuery(() =>
    db.sales.where('payment_method').equals('CREDIT').and(s => s.payment_status !== 'PAID').toArray()
  ) ?? [];

  // Calculate payment reminders with priority levels
  const reminders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return creditSales
      .map(sale => {
        if (!sale.due_date) return null;

        const dueDate = new Date(sale.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let priority: ReminderPriority;
        let message: string;

        if (daysUntilDue < 0) {
          priority = 'CRITICAL';
          message = `EN RETARD de ${Math.abs(daysUntilDue)} jour${Math.abs(daysUntilDue) > 1 ? 's' : ''}`;
        } else if (daysUntilDue === 0) {
          priority = 'URGENT';
          message = "ÉCHÉANCE AUJOURD'HUI";
        } else if (daysUntilDue <= 3) {
          priority = 'URGENT';
          message = `Échéance dans ${daysUntilDue} jour${daysUntilDue > 1 ? 's' : ''}`;
        } else if (daysUntilDue <= 7) {
          priority = 'UPCOMING';
          message = `Échéance dans ${daysUntilDue} jours`;
        } else {
          priority = 'SCHEDULED';
          message = `Échéance le ${formatDate(dueDate)}`;
        }

        return {
          sale,
          priority,
          daysUntilDue,
          message,
        } as PaymentReminder;
      })
      .filter((r): r is PaymentReminder => r !== null)
      .sort((a, b) => {
        // Sort by priority: CRITICAL > URGENT > UPCOMING > SCHEDULED
        const priorityOrder = { CRITICAL: 0, URGENT: 1, UPCOMING: 2, SCHEDULED: 3 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        // Then by days until due (ascending)
        return a.daysUntilDue - b.daysUntilDue;
      });
  }, [creditSales]);

  // Count by priority
  const counts = useMemo(() => {
    return {
      critical: reminders.filter(r => r.priority === 'CRITICAL').length,
      urgent: reminders.filter(r => r.priority === 'URGENT').length,
      upcoming: reminders.filter(r => r.priority === 'UPCOMING').length,
      scheduled: reminders.filter(r => r.priority === 'SCHEDULED').length,
    };
  }, [reminders]);

  const totalDue = reminders.reduce((sum, r) => sum + r.sale.amount_due, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gradient-to-br from-slate-900 to-slate-950 text-white shadow-lg border-b-4 border-slate-700">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-800/50 rounded-lg transition-colors active:scale-95"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-serif font-bold tracking-wide">Bureau des rappels</h1>
              <p className="text-sm text-slate-400 font-serif italic">Gestion des paiements en attente</p>
            </div>
            <div className="relative">
              <Bell className="w-6 h-6" />
              {(counts.critical + counts.urgent) > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{counts.critical + counts.urgent}</span>
                </div>
              )}
            </div>
          </div>

          {/* Summary - Dispatch log style */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <div className="text-xs text-slate-400 font-serif mb-1">Total à encaisser</div>
              <div className="text-lg font-bold font-serif tabular-nums">{formatCurrency(totalDue)}</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <div className="text-xs text-slate-400 font-serif mb-1">Rappels actifs</div>
              <div className="text-lg font-bold font-serif tabular-nums">{reminders.length}</div>
            </div>
          </div>

          {/* Priority counters - Postal flags */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {counts.critical > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg border-2 border-red-800 flex-shrink-0">
                <Flag className="w-4 h-4" fill="currentColor" />
                <span className="text-xs font-bold uppercase tracking-wide">Critique: {counts.critical}</span>
              </div>
            )}
            {counts.urgent > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg border-2 border-amber-800 flex-shrink-0">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wide">Urgent: {counts.urgent}</span>
              </div>
            )}
            {counts.upcoming > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg border-2 border-blue-800 flex-shrink-0">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wide">Proche: {counts.upcoming}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reminders list - Dispatch queue */}
      <div className="px-4 py-6 space-y-4 pb-24">
        {reminders.length === 0 ? (
          <div className="text-center py-12">
            <Check className="w-16 h-16 mx-auto text-emerald-600 mb-4" />
            <p className="text-slate-300 font-serif text-lg">Aucun rappel en attente</p>
            <p className="text-slate-400 font-serif text-sm mt-2">Tous les paiements sont à jour</p>
          </div>
        ) : (
          reminders.map((reminder, index) => (
            <ReminderCard
              key={reminder.sale.id}
              reminder={reminder}
              index={index}
              onMessage={() => {
                setSelectedReminder(reminder);
                setShowMessageComposer(true);
              }}
            />
          ))
        )}
      </div>

      {/* Message composer modal */}
      {showMessageComposer && selectedReminder && (
        <MessageComposerModal
          reminder={selectedReminder}
          onClose={() => {
            setShowMessageComposer(false);
            setSelectedReminder(null);
          }}
        />
      )}
    </div>
  );
}

// Reminder card with dispatch aesthetic
function ReminderCard({
  reminder,
  index,
  onMessage,
}: {
  reminder: PaymentReminder;
  index: number;
  onMessage: () => void;
}) {
  const router = useRouter();
  const [contacted, setContacted] = useState(false);

  const getPriorityStyle = () => {
    switch (reminder.priority) {
      case 'CRITICAL':
        return {
          bg: 'bg-gradient-to-br from-slate-900 to-slate-800 border-red-500/30',
          flag: 'bg-red-600',
          flagBorder: 'border-red-800',
          text: 'text-red-400',
          icon: Flag,
        };
      case 'URGENT':
        return {
          bg: 'bg-gradient-to-br from-slate-900 to-slate-800 border-amber-500/30',
          flag: 'bg-amber-600',
          flagBorder: 'border-amber-800',
          text: 'text-amber-400',
          icon: AlertTriangle,
        };
      case 'UPCOMING':
        return {
          bg: 'bg-gradient-to-br from-slate-900 to-slate-800 border-blue-500/30',
          flag: 'bg-blue-600',
          flagBorder: 'border-blue-800',
          text: 'text-blue-400',
          icon: Clock,
        };
      case 'SCHEDULED':
        return {
          bg: 'bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700',
          flag: 'bg-slate-600',
          flagBorder: 'border-slate-800',
          text: 'text-slate-400',
          icon: Clock,
        };
    }
  };

  const style = getPriorityStyle();
  const Icon = style.icon;

  return (
    <div
      className={`${style.bg} border-2 rounded-lg shadow-md overflow-hidden relative
        ${contacted ? 'opacity-60' : ''}`}
      style={{
        animation: `slideInRight 0.3s ease-out ${index * 0.05}s both`,
      }}
    >
      {/* Priority flag - like postal priority label */}
      <div className={`${style.flag} ${style.flagBorder} border-2 absolute top-0 right-0 px-3 py-1 rounded-bl-lg flex items-center gap-1.5 shadow-lg`}
        style={{ transform: 'rotate(0deg)' }}
      >
        <Icon className="w-4 h-4 text-white" fill={reminder.priority === 'CRITICAL' ? 'currentColor' : 'none'} />
        <span className="text-xs font-bold text-white uppercase tracking-wider font-serif">
          {reminder.priority === 'CRITICAL' && 'CRITIQUE'}
          {reminder.priority === 'URGENT' && 'URGENT'}
          {reminder.priority === 'UPCOMING' && 'PROCHE'}
          {reminder.priority === 'SCHEDULED' && 'PLANIFIÉ'}
        </span>
      </div>

      <div className="p-4 pt-12">
        {/* Customer info */}
        <div className="mb-3">
          <div className="text-lg font-bold font-serif text-white mb-1">
            {reminder.sale.customer_name || 'Client inconnu'}
          </div>
          {reminder.sale.customer_phone && (
            <div className="text-sm text-slate-300 font-mono">{reminder.sale.customer_phone}</div>
          )}
        </div>

        {/* Amount due */}
        <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-lg p-3 mb-3">
          <div className="text-xs text-slate-400 font-serif mb-1">Montant dû</div>
          <div className="text-2xl font-bold font-serif tabular-nums text-white">
            {formatCurrency(reminder.sale.amount_due)}
          </div>
        </div>

        {/* Timeline - Dispatch tracking */}
        <div className="mb-4">
          <div className={`text-sm font-bold ${style.text} mb-2 font-serif uppercase tracking-wide`}>
            {reminder.message}
          </div>
          {reminder.sale.due_date && (
            <div className="text-xs text-slate-300 font-serif">
              Échéance: {formatDate(new Date(reminder.sale.due_date))}
            </div>
          )}
        </div>

        {/* Quick actions - Dispatch buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onMessage}
            className="flex flex-col items-center gap-1 p-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95
              text-white rounded-lg transition-all shadow-md"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs font-bold">WhatsApp</span>
          </button>

          <a
            href={`tel:${reminder.sale.customer_phone}`}
            className="flex flex-col items-center gap-1 p-3 bg-blue-600 hover:bg-blue-700 active:scale-95
              text-white rounded-lg transition-all shadow-md"
          >
            <Phone className="w-5 h-5" />
            <span className="text-xs font-bold">Appeler</span>
          </a>

          <button
            onClick={() => setContacted(!contacted)}
            className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-all shadow-md ${
              contacted
                ? 'bg-gray-400 text-gray-700'
                : 'bg-gray-600 hover:bg-gray-700 text-white active:scale-95'
            }`}
          >
            <Check className="w-5 h-5" />
            <span className="text-xs font-bold">{contacted ? 'Contacté' : 'Marquer'}</span>
          </button>
        </div>

        {/* View details link */}
        <button
          onClick={() => router.push(`/ventes/detail/${reminder.sale.id}`)}
          className="w-full mt-3 py-2 text-sm font-medium text-slate-300 hover:text-white underline"
        >
          Voir les détails de la vente →
        </button>
      </div>
    </div>
  );
}

// Message composer modal - Postal form style
function MessageComposerModal({
  reminder,
  onClose,
}: {
  reminder: PaymentReminder;
  onClose: () => void;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<'polite' | 'reminder' | 'urgent'>('polite');
  const [customMessage, setCustomMessage] = useState('');

  const templates = {
    polite: `Bonjour ${reminder.sale.customer_name},\n\nNous vous rappelons gentiment que votre paiement de ${formatCurrency(reminder.sale.amount_due)} arrive à échéance le ${formatDate(new Date(reminder.sale.due_date!))}.\n\nMerci de votre compréhension.\nPharmacie Thierno Mamadou`,

    reminder: `Bonjour ${reminder.sale.customer_name},\n\nCeci est un rappel concernant votre paiement de ${formatCurrency(reminder.sale.amount_due)}, échéance: ${formatDate(new Date(reminder.sale.due_date!))}.\n\nMerci de régulariser votre situation.\nPharmacie Thierno Mamadou`,

    urgent: `Bonjour ${reminder.sale.customer_name},\n\nVotre paiement de ${formatCurrency(reminder.sale.amount_due)} est maintenant EN RETARD (échéance: ${formatDate(new Date(reminder.sale.due_date!))}).\n\nMerci de nous contacter de toute urgence.\nPharmacie Thierno Mamadou`,
  };

  const handleSend = () => {
    const message = customMessage || templates[selectedTemplate];
    const phone = reminder.sale.customer_phone?.replace(/\s/g, '');
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-slate-950 rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl animate-slideUp border-4 border-slate-700">
        {/* Header - Postal form style */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white p-4 rounded-t-xl sm:rounded-t-2xl">
          <h2 className="text-xl font-serif font-bold mb-1">Message de rappel</h2>
          <p className="text-sm text-slate-400 font-serif">À: {reminder.sale.customer_name}</p>
        </div>

        <div className="p-6">
          {/* Template selection - Postal priority stamps */}
          <div className="mb-4">
            <label className="block text-sm font-serif text-slate-300 mb-3 font-bold uppercase tracking-wide">
              Modèle de message
            </label>
            <div className="space-y-2">
              {(['polite', 'reminder', 'urgent'] as const).map((template) => (
                <button
                  key={template}
                  onClick={() => setSelectedTemplate(template)}
                  className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                    selectedTemplate === template
                      ? 'bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-700 shadow-lg'
                      : 'bg-slate-800/30 text-slate-300 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="font-bold text-sm mb-1">
                    {template === 'polite' && '📨 Rappel courtois'}
                    {template === 'reminder' && '⏰ Rappel standard'}
                    {template === 'urgent' && '🚨 Rappel urgent'}
                  </div>
                  <div className={`text-xs ${selectedTemplate === template ? 'text-slate-400' : 'text-slate-300'}`}>
                    {template === 'polite' && 'Ton amical et respectueux'}
                    {template === 'reminder' && 'Ton professionnel'}
                    {template === 'urgent' && 'Ton ferme pour retard'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Message preview - Telegram style */}
          <div className="mb-4">
            <label className="block text-sm font-serif text-slate-300 mb-2 font-bold uppercase tracking-wide">
              Aperçu du message
            </label>
            <textarea
              value={customMessage || templates[selectedTemplate]}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 border-2 border-slate-700 rounded-lg focus:border-slate-600 focus:outline-none
                bg-slate-800/50 text-white font-serif resize-none"
            />
            <div className="text-xs text-slate-300 mt-2">
              Vous pouvez modifier le message avant l'envoi
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-slate-700 rounded-lg font-medium text-slate-300
                hover:bg-slate-800 active:scale-95 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleSend}
              className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-lg
                transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              Envoyer via WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Keyframe animations
const styles = `
  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(30px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}
