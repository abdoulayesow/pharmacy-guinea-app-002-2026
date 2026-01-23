'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Camera,
  X,
  Image as ImageIcon,
  Trash2,
  Check,
  Loader2,
  FileImage,
  ZoomIn,
  RotateCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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
        // Reset input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [onCapture]
  );

  const handleCaptureClick = () => {
    if (!canAddMore) {
      toast.error(`Maximum ${maxPrescriptions} ordonnances`);
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Capture Button - Pharmacy-themed design */}
      <button
        onClick={handleCaptureClick}
        disabled={isProcessing || !canAddMore}
        className={cn(
          "group relative w-full p-4 rounded-xl border-2 border-dashed transition-all active:scale-[0.98]",
          "bg-gradient-to-br from-blue-950/30 to-blue-900/10",
          canAddMore
            ? "border-blue-600/50 hover:border-blue-500 hover:bg-blue-900/20"
            : "border-slate-700 opacity-50 cursor-not-allowed",
          isProcessing && "animate-pulse"
        )}
      >
        <div className="flex items-center justify-center gap-3">
          {isProcessing ? (
            <>
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              <span className="text-blue-300 font-medium">Traitement...</span>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <div className="text-white font-semibold">
                  {prescriptions.length === 0
                    ? 'Photographier l\'ordonnance'
                    : 'Ajouter une ordonnance'}
                </div>
                <div className="text-xs text-blue-400">
                  {prescriptions.length}/{maxPrescriptions} ordonnances
                </div>
              </div>
            </>
          )}
        </div>

        {/* Decorative corner elements */}
        {canAddMore && !isProcessing && (
          <>
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-blue-500/50 rounded-tl-md" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-blue-500/50 rounded-tr-md" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-blue-500/50 rounded-bl-md" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-blue-500/50 rounded-br-md" />
          </>
        )}
      </button>

      {/* Prescription Thumbnails */}
      {prescriptions.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {prescriptions.map((rx) => (
            <div
              key={rx.id}
              className="relative group aspect-[3/4] rounded-lg overflow-hidden border-2 border-blue-700/50 bg-slate-900"
            >
              {/* Thumbnail Image */}
              <img
                src={rx.imageData}
                alt="Ordonnance"
                className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                onClick={() => setPreviewImage(rx.imageData)}
              />

              {/* Overlay with actions */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Prescription badge */}
                <div className="absolute top-1 left-1">
                  <div className="bg-blue-600 px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1">
                    <FileImage className="w-3 h-3" />
                    Rx
                  </div>
                </div>

                {/* Actions */}
                <div className="absolute bottom-1 right-1 flex gap-1">
                  <button
                    onClick={() => setPreviewImage(rx.imageData)}
                    className="w-7 h-7 rounded-md bg-blue-600 hover:bg-blue-500 flex items-center justify-center transition-colors"
                  >
                    <ZoomIn className="w-4 h-4 text-white" />
                  </button>
                  <button
                    onClick={() => {
                      onRemove(rx.id);
                      toast.info('Ordonnance supprimée');
                    }}
                    className="w-7 h-7 rounded-md bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Time stamp */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 group-hover:opacity-0 transition-opacity">
                <div className="text-[10px] text-slate-300 font-medium">
                  {rx.capturedAt.toLocaleTimeString('fr-GN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full-screen Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          <div className="max-w-full max-h-full p-4">
            <img
              src={previewImage}
              alt="Ordonnance (aperçu)"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Caption */}
          <div className="absolute bottom-4 left-0 right-0 text-center">
            <div className="inline-flex items-center gap-2 bg-blue-600/90 text-white text-sm font-medium px-4 py-2 rounded-full">
              <FileImage className="w-4 h-4" />
              Ordonnance
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
      className="relative flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600/20 border border-blue-500/50 rounded-lg hover:bg-blue-600/30 transition-colors"
    >
      <FileImage className="w-4 h-4 text-blue-400" />
      <span className="text-xs font-bold text-blue-300">{count}</span>
      <span className="text-xs text-blue-400 hidden sm:inline">
        ordonnance{count > 1 ? 's' : ''}
      </span>
    </button>
  );
}
