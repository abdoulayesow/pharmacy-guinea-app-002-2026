export function Logo({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dimensions = {
    sm: { width: 40, height: 40, fontSize: '20px' },
    md: { width: 60, height: 60, fontSize: '30px' },
    lg: { width: 100, height: 100, fontSize: '50px' }
  };

  const { width, height, fontSize } = dimensions[size];

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Gradient Definitions */}
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#10b981', stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: '#14b8a6', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#06b6d4', stopOpacity: 1 }} />
          </linearGradient>
          <linearGradient id="logoGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#f0fdfa', stopOpacity: 1 }} />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Main Circle Background */}
        <circle
          cx="40"
          cy="40"
          r="38"
          fill="url(#logoGradient)"
          style={{ filter: 'drop-shadow(0px 4px 12px rgba(16, 185, 129, 0.3))' }}
        />

        {/* Medical Cross/Plus Symbol with Modern Twist */}
        <g filter="url(#glow)">
          {/* Vertical Bar */}
          <rect
            x="34"
            y="20"
            width="12"
            height="40"
            rx="6"
            fill="url(#logoGradient2)"
          />
          {/* Horizontal Bar */}
          <rect
            x="20"
            y="34"
            width="40"
            height="12"
            rx="6"
            fill="url(#logoGradient2)"
          />
          
          {/* Center Circle Accent */}
          <circle
            cx="40"
            cy="40"
            r="8"
            fill="#10b981"
            opacity="0.3"
          />
        </g>

        {/* Subtle Pills/Capsules around the cross */}
        <g opacity="0.15">
          <ellipse cx="26" cy="26" rx="3" ry="6" fill="white" transform="rotate(-45 26 26)" />
          <ellipse cx="54" cy="26" rx="3" ry="6" fill="white" transform="rotate(45 54 26)" />
          <ellipse cx="26" cy="54" rx="3" ry="6" fill="white" transform="rotate(45 26 54)" />
          <ellipse cx="54" cy="54" rx="3" ry="6" fill="white" transform="rotate(-45 54 54)" />
        </g>
      </svg>
    </div>
  );
}

export function LogoWithText({ size = 'md', showSubtitle = false }: { size?: 'sm' | 'md' | 'lg'; showSubtitle?: boolean }) {
  const textSizes = {
    sm: { title: 'text-lg', subtitle: 'text-xs' },
    md: { title: 'text-2xl', subtitle: 'text-sm' },
    lg: { title: 'text-4xl', subtitle: 'text-lg' }
  };

  return (
    <div className="flex items-center gap-3">
      <Logo size={size} />
      <div>
        <h1 className={`${textSizes[size].title} font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent tracking-tight`}>
          Seri
        </h1>
        {showSubtitle && (
          <p className={`${textSizes[size].subtitle} text-emerald-600 font-medium`}>
            Gestion de pharmacie
          </p>
        )}
      </div>
    </div>
  );
}