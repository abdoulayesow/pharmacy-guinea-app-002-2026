import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  const dimensions = {
    sm: { width: 40, height: 40 },
    md: { width: 60, height: 60 },
    lg: { width: 100, height: 100 },
  };

  const { width, height } = dimensions[size];

  // Font sizes relative to logo size
  const fontSizes = {
    sm: { ptm: 10, seri: 7 },
    md: { ptm: 14, seri: 10 },
    lg: { ptm: 22, seri: 16 },
  };

  const { ptm: ptmSize, seri: seriSize } = fontSizes[size];

  return (
    <div className={cn('relative', className)} style={{ width, height }}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="hexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>

        {/* Hexagonal pharmacy shape */}
        <path
          d="M40 4 L72 20 L72 60 L40 76 L8 60 L8 20 Z"
          fill="url(#hexGradient)"
        />

        {/* Inner glow/highlight */}
        <path
          d="M40 12 L64 24 L64 56 L40 68 L16 56 L16 24 Z"
          fill="#10b981"
          opacity="0.3"
        />

        {/* PTM text */}
        <text
          x="40"
          y="38"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={ptmSize}
          fontWeight="700"
          fill="white"
          textAnchor="middle"
        >
          PTM
        </text>

        {/* SERI text below */}
        <text
          x="40"
          y="54"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={seriSize}
          fontWeight="500"
          fill="white"
          textAnchor="middle"
          opacity="0.9"
        >
          SERI
        </text>
      </svg>
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
      <Logo size={size} />
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
