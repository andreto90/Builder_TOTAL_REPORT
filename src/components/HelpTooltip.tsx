import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, Info, X, Lock } from 'lucide-react';

export interface HelpTooltipProps {
  title: string;
  description: string;
  example?: string;
  consequence?: string;
  disabledReason?: string;
  enableRequirement?: string;
  align?: 'left' | 'right' | 'center';
  variant?: 'icon' | 'badge' | 'disabled-reason';
  label?: string;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  title,
  description,
  example,
  consequence,
  disabledReason,
  enableRequirement,
  align = 'left',
  variant = 'icon',
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsPinned(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsPinned(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPinned) {
      setIsPinned(false);
      setIsOpen(false);
    } else {
      setIsPinned(true);
      setIsOpen(true);
    }
  };

  const alignClass =
    align === 'right'
      ? 'right-0'
      : align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : 'left-0';

  return (
    <span
      ref={containerRef}
      className="relative inline-flex items-center align-middle"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => {
        if (!isPinned) setIsOpen(false);
      }}
    >
      <button
        type="button"
        onClick={handleToggleClick}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          if (!isPinned) setIsOpen(false);
        }}
        aria-expanded={isOpen}
        aria-label={`Ayuda: ${title}`}
        className={
          variant === 'disabled-reason'
            ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-medium hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-[#1E4E8C] cursor-pointer transition-colors'
            : variant === 'badge'
            ? 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-700 text-[10px] font-semibold hover:bg-blue-50 hover:text-[#1E4E8C] hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-[#1E4E8C] cursor-pointer transition-colors'
            : 'inline-flex items-center justify-center w-4 h-4 rounded-full text-slate-400 hover:text-[#1E4E8C] hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-[#1E4E8C] cursor-pointer transition-colors ml-1'
        }
      >
        {variant === 'disabled-reason' ? (
          <>
            <Lock className="w-3 h-3 text-amber-700 shrink-0" />
            <span>{label || '¿Por qué está bloqueado?'}</span>
          </>
        ) : variant === 'badge' ? (
          <>
            <Info className="w-3 h-3 text-[#1E4E8C] shrink-0" />
            <span>{label || 'Ayuda'}</span>
          </>
        ) : (
          <HelpCircle className="w-3.5 h-3.5 shrink-0" />
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={title}
          className={`absolute z-50 top-full mt-1.5 w-72 sm:w-80 bg-slate-900 text-white rounded-md shadow-xl border border-slate-700 p-3 text-left text-[11px] leading-relaxed font-normal ${alignClass}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2 border-b border-slate-700 pb-1.5 mb-2">
            <span className="font-bold text-white text-xs flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              {title}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsPinned(false);
              }}
              aria-label="Cerrar ayuda (Escape)"
              className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-slate-200">{description}</p>

          {example && (
            <div className="mt-2 p-1.5 rounded bg-slate-800 border border-slate-700 text-sky-200 font-mono text-[10px]">
              <strong className="font-sans text-slate-300">Ejemplo: </strong>
              {example}
            </div>
          )}

          {consequence && (
            <div className="mt-1.5 text-amber-300 text-[10px]">
              <strong>Efecto o consecuencia: </strong>
              {consequence}
            </div>
          )}

          {disabledReason && (
            <div className="mt-2 p-2 rounded bg-amber-950/80 border border-amber-700/70 text-amber-200 space-y-1">
              <div>
                <strong>Motivo de deshabilitación: </strong>
                {disabledReason}
              </div>
              {enableRequirement && (
                <div className="text-emerald-300">
                  <strong>Requisito para habilitar: </strong>
                  {enableRequirement}
                </div>
              )}
            </div>
          )}

          <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <span>{isPinned ? 'Fijado (clic o Esc para cerrar)' : 'Clic para fijar · Esc para cerrar'}</span>
          </div>
        </div>
      )}
    </span>
  );
};
