'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Camera,
  X,
  Upload,
  Trash2,
  Loader2,
  FileImage,
  ZoomIn,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface CapturedPrescription {
  id: string;
  imageData: string; // Base64
  imageType: 'image/jpeg' | 'image/png';
  capturedAt: Date;
}

interface PrescriptionCaptureProps {
  prescriptions: CapturedPrescription[];
  onCapture: (prescription: CapturedPrescription) => void;
  onRemove: (id: string) => void;
  maxPrescriptions?: number; // Default: 3
  className?: string;
}

/**
 * Compress image to target size (default 400KB for mobile storage)
 */
async function compressImage(
  file: File,
  maxSizeKB: number = 400,
  maxWidth: number = 1200
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Scale down if too large
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Start with high quality and reduce until under target size
        let quality = 0.9;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        while (dataUrl.length > maxSizeKB * 1024 * 1.37 && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Generate unique ID for prescriptions
 */
function generatePrescriptionId(): string {
  return `rx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function PrescriptionCapture({
  prescriptions,
  onCapture,
  onRemove,
  maxPrescriptions = 3,
  className,
}: PrescriptionCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const canAddMore = prescriptions.length < maxPrescriptions;

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Veuillez sélectionner une image');
        return;
      }

      // Validate file size (max 10MB raw)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image trop volumineuse (max 10 MB)');
        return;
      }

      setIsProcessing(true);

      try {
        // Compress the image
        const compressedData = await compressImage(file);

        const prescription: CapturedPrescription = {
          id: generatePrescriptionId(),
          imageData: compressedData,
          imageType: 'image/jpeg',
          capturedAt: new Date(),
        };

        onCapture(prescription);
        toast.success('Ordonnance ajoutée');
      } catch (error) {
        console.error('Error processing image:', error);
        toast.error("Erreur lors du traitement de l'image");
      } finally {
        setIsProcessing(false);
        // Reset inputs
        if (cameraInputRef.current) {
          cameraInputRef.current.value = '';
        }
        if (galleryInputRef.current) {
          galleryInputRef.current.value = '';
        }
      }
    },
    [onCapture]
  );

  const handleCameraClick = () => {
    if (!canAddMore) {
      toast.error(`Maximum ${maxPrescriptions} ordonnances`);
      return;
    }
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    if (!canAddMore) {
      toast.error(`Maximum ${maxPrescriptions} ordonnances`);
      return;
    }
    galleryInputRef.current?.click();
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Main Container - Medical Document Scanner Theme */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl",
          "bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900",
          "border border-blue-500/30",
          !canAddMore && "opacity-60"
        )}
        style={{
          boxShadow: canAddMore
            ? '0 4px 24px rgba(59, 130, 246, 0.15), inset 0 1px 0 rgba(255,255,255,0.05)'
            : undefined,
        }}
      >
        {/* Subtle scan line effect */}
        {isProcessing && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-60"
              style={{
                animation: 'scan 1.5s ease-in-out infinite',
                top: '0%',
              }}
            />
            <style jsx>{`
              @keyframes scan {
                0%, 100% { top: 0%; opacity: 0; }
                50% { top: 100%; opacity: 0.6; }
              }
            `}</style>
          </div>
        )}

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-blue-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <FileImage className="w-5 h-5 text-white" />
                </div>
                {prescriptions.length > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-white border-2 border-slate-900">
                    {prescriptions.length}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">
                  Ordonnance médicale
                </h3>
                <p className="text-blue-400/80 text-xs">
                  {prescriptions.length}/{maxPrescriptions} document{prescriptions.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {isProcessing && (
              <div className="flex items-center gap-2 text-blue-400 text-xs font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                Traitement...
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons - Side by Side */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Camera Button */}
            <button
              onClick={handleCameraClick}
              disabled={isProcessing || !canAddMore}
              className={cn(
                "group relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl",
                "min-h-[100px] transition-all duration-200",
                "bg-gradient-to-br from-blue-600/20 to-blue-700/10",
                "border-2 border-dashed border-blue-500/40",
                "hover:border-blue-400 hover:bg-blue-600/30",
                "active:scale-[0.97]",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600/20"
              )}
            >
              {/* Icon container */}
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                "bg-gradient-to-br from-blue-500 to-blue-600",
                "shadow-lg shadow-blue-500/30",
                "group-hover:scale-110 group-hover:shadow-blue-500/40",
                "transition-all duration-200"
              )}>
                <Camera className="w-6 h-6 text-white" />
              </div>

              {/* Label */}
              <div className="text-center">
                <span className="block text-white font-semibold text-sm">
                  Prendre photo
                </span>
                <span className="block text-blue-400/70 text-[11px] mt-0.5">
                  Appareil photo
                </span>
              </div>

              {/* Subtle corner accents */}
              <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-blue-400/40 rounded-tl" />
              <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-blue-400/40 rounded-tr" />
              <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-blue-400/40 rounded-bl" />
              <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-blue-400/40 rounded-br" />
            </button>

            {/* Gallery/Upload Button */}
            <button
              onClick={handleGalleryClick}
              disabled={isProcessing || !canAddMore}
              className={cn(
                "group relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl",
                "min-h-[100px] transition-all duration-200",
                "bg-gradient-to-br from-emerald-600/20 to-emerald-700/10",
                "border-2 border-dashed border-emerald-500/40",
                "hover:border-emerald-400 hover:bg-emerald-600/30",
                "active:scale-[0.97]",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-600/20"
              )}
            >
              {/* Icon container */}
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                "bg-gradient-to-br from-emerald-500 to-emerald-600",
                "shadow-lg shadow-emerald-500/30",
                "group-hover:scale-110 group-hover:shadow-emerald-500/40",
                "transition-all duration-200"
              )}>
                <Upload className="w-6 h-6 text-white" />
              </div>

              {/* Label */}
              <div className="text-center">
                <span className="block text-white font-semibold text-sm">
                  Importer
                </span>
                <span className="block text-emerald-400/70 text-[11px] mt-0.5">
                  Depuis galerie
                </span>
              </div>

              {/* Subtle corner accents */}
              <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-emerald-400/40 rounded-tl" />
              <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-emerald-400/40 rounded-tr" />
              <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-emerald-400/40 rounded-bl" />
              <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-emerald-400/40 rounded-br" />
            </button>
          </div>
        </div>

        {/* Prescription Thumbnails */}
        {prescriptions.length > 0 && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-3 gap-2">
              {prescriptions.map((rx, index) => (
                <div
                  key={rx.id}
                  className="relative group aspect-[3/4] rounded-xl overflow-hidden bg-slate-800 ring-2 ring-blue-500/30 hover:ring-blue-400/50 transition-all"
                >
                  {/* Thumbnail Image */}
                  <img
                    src={rx.imageData}
                    alt={`Ordonnance ${index + 1}`}
                    className="w-full h-full object-cover cursor-pointer transition-transform duration-200 group-hover:scale-105"
                    onClick={() => setPreviewImage(rx.imageData)}
                  />

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                  {/* Document number badge */}
                  <div className="absolute top-1.5 left-1.5">
                    <div className="bg-blue-600/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      {index + 1}
                    </div>
                  </div>

                  {/* Actions - Always visible on mobile, hover on desktop */}
                  <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage(rx.imageData);
                      }}
                      className="w-8 h-8 rounded-lg bg-blue-600/90 hover:bg-blue-500 flex items-center justify-center transition-colors backdrop-blur-sm"
                      aria-label="Agrandir"
                    >
                      <ZoomIn className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(rx.id);
                        toast.info('Ordonnance supprimée');
                      }}
                      className="w-8 h-8 rounded-lg bg-red-600/90 hover:bg-red-500 flex items-center justify-center transition-colors backdrop-blur-sm"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  </div>

                  {/* Time stamp */}
                  <div className="absolute bottom-1.5 left-1.5 sm:group-hover:opacity-0 transition-opacity">
                    <span className="text-[10px] text-white/80 font-medium bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded">
                      {rx.capturedAt.toLocaleTimeString('fr-GN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Full-screen Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          {/* Close button */}
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10 backdrop-blur-sm"
            aria-label="Fermer"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Image */}
          <div className="max-w-full max-h-full p-4">
            <img
              src={previewImage}
              alt="Ordonnance (aperçu)"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl ring-1 ring-white/10"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Caption */}
          <div className="absolute bottom-6 left-0 right-0 text-center">
            <div className="inline-flex items-center gap-2 bg-blue-600/90 backdrop-blur-sm text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg">
              <FileImage className="w-4 h-4" />
              Ordonnance médicale
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact prescription indicator for cart header
 */
export function PrescriptionIndicator({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-1.5 px-3 py-2 bg-blue-600/20 border border-blue-500/50 rounded-xl hover:bg-blue-600/30 hover:border-blue-400/60 transition-all active:scale-95"
    >
      <FileImage className="w-4 h-4 text-blue-400" />
      <span className="text-xs font-bold text-blue-300">{count}</span>
      <span className="text-xs text-blue-400/80 hidden sm:inline">
        ordonnance{count > 1 ? 's' : ''}
      </span>
    </button>
  );
}
