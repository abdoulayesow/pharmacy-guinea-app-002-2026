'use client';

import { useEffect, useState } from 'react';
import { useNotificationStore } from '@/stores/notification';
import { toast } from 'sonner';
import { cn } from '@/lib/client/utils';
import { AlertTriangle, Bell, BellOff, Loader2 } from 'lucide-react';

interface NotificationToggleProps {
  className?: string;
}

export function NotificationToggle({ className }: NotificationToggleProps) {
  const {
    permissionStatus,
    expirationAlertsEnabled,
    checkPermission,
    requestPermission,
    setExpirationAlertsEnabled,
  } = useNotificationStore();

  const [isRequesting, setIsRequesting] = useState(false);

  // Check permission status on mount
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  const handleToggle = async () => {
    // If currently enabled, just disable
    if (expirationAlertsEnabled) {
      setExpirationAlertsEnabled(false);
      toast.success('Alertes d\'expiration desactivees');
      return;
    }

    // If permission not yet granted, request it
    if (permissionStatus === 'default') {
      setIsRequesting(true);
      const granted = await requestPermission();
      setIsRequesting(false);

      if (granted) {
        setExpirationAlertsEnabled(true);
        toast.success('Alertes d\'expiration activees');
      } else {
        toast.error('Permission refusee. Activez les notifications dans les parametres de votre navigateur.');
      }
      return;
    }

    // If permission already granted, just enable
    if (permissionStatus === 'granted') {
      setExpirationAlertsEnabled(true);
      toast.success('Alertes d\'expiration activees');
      return;
    }

    // If permission denied, show instructions
    if (permissionStatus === 'denied') {
      toast.error('Notifications bloquees. Activez-les dans les parametres de votre navigateur.');
      return;
    }

    // If unsupported
    if (permissionStatus === 'unsupported') {
      toast.error('Les notifications ne sont pas supportees sur cet appareil.');
      return;
    }
  };

  // Determine if toggle should be disabled
  const isDisabled = permissionStatus === 'denied' || permissionStatus === 'unsupported';

  return (
    <label
      className={cn(
        'flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors',
        isDisabled && 'opacity-60 cursor-not-allowed',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div>
          <span className="text-white font-medium block flex items-center gap-2">
            Expiration produits
            {permissionStatus === 'denied' && (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            )}
          </span>
          <span className="text-xs text-slate-400">
            {permissionStatus === 'denied'
              ? 'Notifications bloquees'
              : permissionStatus === 'unsupported'
              ? 'Non supporte'
              : 'Alertes pour produits expirant'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isRequesting ? (
          <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
        ) : (
          <input
            type="checkbox"
            checked={expirationAlertsEnabled}
            onChange={handleToggle}
            disabled={isDisabled}
            className="w-5 h-5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500/50 bg-slate-700 disabled:opacity-50"
          />
        )}
      </div>
    </label>
  );
}

/**
 * Standalone notification permission prompt component
 * Can be used as a banner on the dashboard
 */
interface NotificationPromptBannerProps {
  onDismiss?: () => void;
  className?: string;
}

export function NotificationPromptBanner({ onDismiss, className }: NotificationPromptBannerProps) {
  const { permissionStatus, requestPermission, expirationAlertsEnabled } = useNotificationStore();
  const [isRequesting, setIsRequesting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if we should show the banner
  useEffect(() => {
    // Check if user dismissed the banner previously
    const dismissed = localStorage.getItem('seri-notification-banner-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  // Don't show if:
  // - Already enabled
  // - Permission denied (can't do anything)
  // - Unsupported
  // - User dismissed
  if (
    expirationAlertsEnabled ||
    permissionStatus === 'denied' ||
    permissionStatus === 'unsupported' ||
    isDismissed
  ) {
    return null;
  }

  const handleEnable = async () => {
    setIsRequesting(true);
    const granted = await requestPermission();
    setIsRequesting(false);

    if (granted) {
      toast.success('Alertes d\'expiration activees');
    } else {
      toast.error('Permission refusee');
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('seri-notification-banner-dismissed', 'true');
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={cn(
        'bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3',
        className
      )}
    >
      <div className="p-2 bg-amber-500/20 rounded-lg">
        <Bell className="w-5 h-5 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">Activer les alertes d'expiration ?</p>
        <p className="text-xs text-slate-400 mt-0.5">
          Recevez des notifications quand vos produits expirent bientot.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleEnable}
            disabled={isRequesting}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isRequesting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Bell className="w-3 h-3" />
            )}
            Activer
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
          >
            Plus tard
          </button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="p-1 hover:bg-slate-700 rounded transition-colors"
      >
        <BellOff className="w-4 h-4 text-slate-500" />
      </button>
    </div>
  );
}
