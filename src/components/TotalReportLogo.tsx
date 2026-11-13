import React from 'react';

export const DRIVE_LOGO_FALLBACK_URL =
  'https://lh3.googleusercontent.com/d/1J9Vz7xITde6OJueH7t3h4GMC6Kii8GWm';

interface TotalReportLogoProps {
  className?: string;
  alt?: string;
}

export const TotalReportLogo: React.FC<TotalReportLogoProps> = ({
  className = 'w-10 h-10 object-contain shrink-0',
  alt = 'Logo TÓTAL REPORT®',
}) => {
  return (
    <img
      src="/logo-total-report.png"
      onError={(e) => {
        const target = e.currentTarget;
        if (target.src !== DRIVE_LOGO_FALLBACK_URL) {
          target.src = DRIVE_LOGO_FALLBACK_URL;
        }
      }}
      alt={alt}
      className={className}
    />
  );
};

interface TotaliaBrandLockupProps {
  title?: string;
  subtitle?: string;
  darkBg?: boolean;
  logoClassName?: string;
}

export const TotaliaBrandLockup: React.FC<TotaliaBrandLockupProps> = ({
  title = 'TOTALiA®',
  subtitle,
  darkBg = false,
  logoClassName = 'w-8 h-8 object-contain shrink-0',
}) => {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        className={`rounded-md p-1 flex items-center justify-center shrink-0 ${
          darkBg
            ? 'bg-white/10 border border-white/15'
            : 'bg-slate-100 border border-slate-200'
        }`}
      >
        <TotalReportLogo
          className={logoClassName}
          alt="Logo TOTALiA® · TÓTAL REPORT®"
        />
      </div>
      <div className="min-w-0">
        <div
          className={`text-sm font-bold tracking-tight flex items-center gap-1.5 ${
            darkBg ? 'text-white' : 'text-[#0F1F38]'
          }`}
        >
          <span>{title}</span>
        </div>
        {subtitle && (
          <p
            className={`text-[11px] truncate ${
              darkBg ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
