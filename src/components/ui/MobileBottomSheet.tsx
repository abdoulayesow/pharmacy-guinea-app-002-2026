'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/client/utils';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  fullScreen?: boolean;
}

export function MobileBottomSheet({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className,
  fullScreen = false,
}: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const isDragging = useRef(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!sheetRef.current) return;
    const touch = e.touches[0];
    startY.current = touch.clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || !sheetRef.current) return;
    const touch = e.touches[0];
    currentY.current = touch.clientY - startY.current;
    
    if (currentY.current > 0) {
      sheetRef.current.style.transform = `translateY(${currentY.current}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current || !sheetRef.current) return;
    isDragging.current = false;

    // If dragged down more than 100px, close the sheet
    if (currentY.current > 100) {
      onClose();
    } else {
      // Snap back
      sheetRef.current.style.transform = 'translateY(0)';
    }
    currentY.current = 0;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'absolute bottom-0 left-0 right-0 bg-gradient-to-br from-slate-900 to-slate-950 rounded-t-2xl border-t border-slate-700 shadow-2xl',
          fullScreen ? 'top-0 rounded-none' : 'max-h-[90vh]',
          className
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        {!fullScreen && (
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 bg-slate-600 rounded-full" />
          </div>
        )}

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors active:scale-95"
              aria-label="Fermer"
            >
              <X className="w-5 h-5 text-slate-300" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: fullScreen ? 'calc(100vh - 120px)' : 'calc(90vh - 120px)' }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="sticky bottom-0 px-6 py-4 border-t border-slate-700 bg-slate-900/95 backdrop-blur-sm">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

