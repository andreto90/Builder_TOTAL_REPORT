import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { normalizeSearchText } from '../domain/jurisdictionsCatalog';

export interface SearchableSelectorOption {
  value: string;
  label: string;
  meta?: string;
  group?: string;
  keywords?: string;
}

interface SearchableSelectorProps {
  id: string;
  label: string;
  value: string;
  displayValue: string;
  displayMeta?: string;
  searchPlaceholder: string;
  searchAriaLabel: string;
  options: SearchableSelectorOption[];
  pinnedTopOptions?: SearchableSelectorOption[];
  pinnedBottomOptions?: SearchableSelectorOption[];
  filterTabs?: { value: string; label: string }[];
  activeFilterTab?: string;
  onFilterTabChange?: (tab: string) => void;
  onSelect: (value: string) => void;
  emptyText?: string;
  dropdownDirection?: 'down' | 'up';
}

export const SearchableSelector: React.FC<SearchableSelectorProps> = ({
  id,
  label,
  value,
  displayValue,
  displayMeta,
  searchPlaceholder,
  searchAriaLabel,
  options,
  pinnedTopOptions = [],
  pinnedBottomOptions = [],
  filterTabs,
  activeFilterTab,
  onFilterTabChange,
  onSelect,
  emptyText = 'No se encontraron coincidencias para la búsqueda.',
  dropdownDirection = 'down',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 10);

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const matchesQuery = (opt: SearchableSelectorOption, normalizedQuery: string) => {
    if (!normalizedQuery) return true;
    return (
      normalizeSearchText(opt.label).includes(normalizedQuery) ||
      normalizeSearchText(opt.meta || '').includes(normalizedQuery) ||
      normalizeSearchText(opt.keywords || '').includes(normalizedQuery) ||
      normalizeSearchText(opt.group || '').includes(normalizedQuery)
    );
  };

  const { filteredTop, filteredMainGroups, filteredBottom, totalMatches } = useMemo(() => {
    const q = normalizeSearchText(query);
    const top = pinnedTopOptions.filter((o) => matchesQuery(o, q));
    const main = options.filter((o) => matchesQuery(o, q));
    const bottom = pinnedBottomOptions.filter((o) => matchesQuery(o, q));

    const groups: { groupName: string; items: SearchableSelectorOption[] }[] = [];
    const groupMap = new Map<string, SearchableSelectorOption[]>();

    main.forEach((opt) => {
      const g = opt.group || 'Opciones';
      if (!groupMap.has(g)) {
        const arr: SearchableSelectorOption[] = [];
        groupMap.set(g, arr);
        groups.push({ groupName: g, items: arr });
      }
      groupMap.get(g)!.push(opt);
    });

    return {
      filteredTop: top,
      filteredMainGroups: groups,
      filteredBottom: bottom,
      totalMatches: top.length + main.length + bottom.length,
    };
  }, [query, options, pinnedTopOptions, pinnedBottomOptions]);

  const handleChoose = (nextValue: string) => {
    onSelect(nextValue);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        aria-label={`${label}: ${displayValue}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full border rounded-md px-3 py-2 bg-white text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
          open
            ? 'border-[#1E4E8C] ring-2 ring-[#1E4E8C]/15'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <div className="min-w-0 flex items-center gap-2">
          <span className="text-xs font-medium text-slate-900 truncate">{displayValue}</span>
          {displayMeta && (
            <span className="text-[11px] text-slate-500 truncate hidden sm:inline">
              · {displayMeta}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
            open ? 'rotate-180 text-[#1E4E8C]' : ''
          }`}
        />
      </button>

      {open && (
        <div
          className={`absolute left-0 right-0 z-40 bg-white border border-slate-300 rounded-md shadow-xl overflow-hidden ${
            dropdownDirection === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {/* Search Bar */}
          <div className="p-2 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                aria-label={searchAriaLabel}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full border border-slate-300 rounded pl-8 pr-7 py-1.5 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#1E4E8C]"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Limpiar búsqueda"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {filterTabs && filterTabs.length > 0 && onFilterTabChange && (
              <div className="flex flex-wrap items-center gap-1">
                {filterTabs.map((tab) => {
                  const isActive = activeFilterTab === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => onFilterTabChange(tab.value)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#1E4E8C] text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Options Listbox */}
          <div role="listbox" aria-label={label} className="max-h-60 overflow-y-auto divide-y divide-slate-100">
            {totalMatches === 0 ? (
              <div className="px-3 py-5 text-center text-xs text-slate-500">{emptyText}</div>
            ) : (
              <>
                {filteredTop.length > 0 && (
                  <div>
                    {filteredTop.map((opt) => {
                      const isSel = opt.value === value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="option"
                          aria-selected={isSel}
                          onClick={() => handleChoose(opt.value)}
                          className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                            isSel
                              ? 'bg-blue-50 text-[#0F1F38] font-semibold'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate">{opt.label}</div>
                            {opt.meta && (
                              <div className="text-[10px] text-slate-500 truncate">{opt.meta}</div>
                            )}
                          </div>
                          {isSel && <Check className="w-3.5 h-3.5 text-[#1E4E8C] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {filteredMainGroups.map((grp) => (
                  <div key={grp.groupName}>
                    <div className="px-3 py-1 bg-slate-50/90 text-[10px] font-bold uppercase tracking-wider text-slate-500 sticky top-0 border-b border-slate-100">
                      {grp.groupName}
                    </div>
                    {grp.items.map((opt) => {
                      const isSel = opt.value === value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="option"
                          aria-selected={isSel}
                          onClick={() => handleChoose(opt.value)}
                          className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                            isSel
                              ? 'bg-blue-50 text-[#0F1F38] font-semibold'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate">{opt.label}</div>
                            {opt.meta && (
                              <div className="text-[10px] text-slate-500 truncate">{opt.meta}</div>
                            )}
                          </div>
                          {isSel && <Check className="w-3.5 h-3.5 text-[#1E4E8C] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ))}

                {filteredBottom.length > 0 && (
                  <div>
                    <div className="px-3 py-1 bg-slate-50/90 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                      Opción personalizada
                    </div>
                    {filteredBottom.map((opt) => {
                      const isSel = opt.value === value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="option"
                          aria-selected={isSel}
                          onClick={() => handleChoose(opt.value)}
                          className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                            isSel
                              ? 'bg-blue-50 text-[#0F1F38] font-semibold'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate">{opt.label}</div>
                            {opt.meta && (
                              <div className="text-[10px] text-slate-500 truncate">{opt.meta}</div>
                            )}
                          </div>
                          {isSel && <Check className="w-3.5 h-3.5 text-[#1E4E8C] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
