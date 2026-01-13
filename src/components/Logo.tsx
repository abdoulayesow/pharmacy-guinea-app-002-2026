import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'icon' | 'icon-simple' | 'horizontal' | 'full';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Logo({ variant = 'icon', size = 'md', className = '' }: LogoProps) {
  // Icon variant dimensions (square medical cross)
  const iconDimensions = {
    sm: { width: 40, height: 40 },
    md: { width: 60, height: 60 },
    lg: { width: 100, height: 100 },
  };

  // Icon simple variant dimensions (simple medical cross)
  const iconSimpleDimensions = {
    sm: { width: 36, height: 36 },
    md: { width: 56, height: 56 },
    lg: { width: 90, height: 90 },
  };

  // Horizontal variant dimensions (logo + text + location)
  const horizontalDimensions = {
    sm: { width: 120, height: 36 },
    md: { width: 180, height: 54 },
    lg: { width: 250, height: 75 },
  };

  // Full variant dimensions (complete branding with logo + pharmacy name + location)
  // SVG viewBox is 400x500, so aspect ratio is 0.8 (width/height)
  const fullDimensions = {
    sm: { width: 120, height: 150 },
    md: { width: 160, height: 200 },
    lg: { width: 200, height: 250 },
  };

  // Select dimensions based on variant
  let dimensions;
  switch (variant) {
    case 'icon-simple':
      dimensions = iconSimpleDimensions[size];
      break;
    case 'horizontal':
      dimensions = horizontalDimensions[size];
      break;
    case 'full':
      dimensions = fullDimensions[size];
      break;
    default:
      dimensions = iconDimensions[size];
  }

  // Select image source based on variant
  const imageMap = {
    'icon': '/images/pharmacie-thierno-mamadou-icon.svg',
    'icon-simple': '/images/pharmacie-thierno-mamadou-icon-simple.svg',
    'horizontal': '/images/pharmacie-thierno-mamadou-horizontal.svg',
    'full': '/images/pharmacie-thierno-mamadou-full.svg',
  };
  const imageSrc = imageMap[variant];

  return (
    <div
      className={cn('relative flex-shrink-0', className)}
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      <img
        src={imageSrc}
        alt="Pharmacie Thierno Mamadou"
        className="w-full h-full object-contain"
      />
    </div>
  );
}

interface LogoWithTextProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export function LogoWithText({ size = 'md', showSubtitle = false }: LogoWithTextProps) {
  const textSizes = {
    sm: { title: 'text-lg', subtitle: 'text-xs' },
    md: { title: 'text-2xl', subtitle: 'text-sm' },
    lg: { title: 'text-4xl', subtitle: 'text-lg' },
  };

  return (
    <div className="flex items-center gap-3">
      <Logo variant="icon" size={size} />
      <div>
        <h1
          className={cn(
            textSizes[size].title,
            'font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent tracking-tight'
          )}
        >
          Seri
        </h1>
        {showSubtitle && (
          <p className={cn(textSizes[size].subtitle, 'text-emerald-600 font-medium')}>
            Gestion de pharmacie
          </p>
        )}
      </div>
    </div>
  );
}
