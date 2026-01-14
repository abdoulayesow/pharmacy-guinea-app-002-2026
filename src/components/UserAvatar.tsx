'use client';

import { useState } from 'react';
import { User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  name?: string | null;
  image?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showRing?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

const textSizes = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

/**
 * User avatar component with Google profile picture support
 * Falls back to initials, then to a generic user icon
 */
export function UserAvatar({
  name,
  image,
  size = 'md',
  className,
  showRing = true,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Get initials from name (max 2 characters)
  const getInitials = (name: string | null | undefined): string => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const initials = getInitials(name);
  const hasValidImage = image && !imageError;

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden flex items-center justify-center',
        'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10',
        showRing && 'ring-2 ring-emerald-500/30',
        sizeClasses[size],
        className
      )}
    >
      {hasValidImage ? (
        <img
          src={image}
          alt={name || 'User avatar'}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
          referrerPolicy="no-referrer"
        />
      ) : initials ? (
        <span
          className={cn(
            'font-semibold text-emerald-400',
            textSizes[size]
          )}
        >
          {initials}
        </span>
      ) : (
        <UserIcon
          className={cn('text-emerald-400', iconSizes[size])}
        />
      )}
    </div>
  );
}
