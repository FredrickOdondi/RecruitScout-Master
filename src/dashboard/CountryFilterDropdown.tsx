import React, { useState, useRef, useEffect, useMemo } from 'react';
import { searchCountries, CountryItem } from '../shared/countries';
import { ChevronDown, X, Globe } from 'lucide-react';

interface CountryFilterDropdownProps {
  value: string;
  onChange: (country: string) => void;
  existingCountries?: string[];
  placeholder?: string;
  className?: string;
}

export const CountryFilterDropdown: React.FC<CountryFilterDropdownProps> = ({
  value,
  onChange,
  existingCountries = [],
  placeholder = 'Filter Country...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Filter countries matching current input value
  const filteredCountries = useMemo(() => {
    return searchCountries(value, existingCountries);
  }, [value, existingCountries]);

  // Reset highlighted index when list changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredCountries.length]);

  // Click-outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({
        block: 'nearest',
      });
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (countryName: string) => {
    onChange(countryName);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredCountries.length === 0) return;
      setHighlightedIndex((prev) => (prev + 1) % filteredCountries.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredCountries.length === 0) return;
      setHighlightedIndex((prev) => (prev <= 0 ? filteredCountries.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && filteredCountries[highlightedIndex]) {
        e.preventDefault();
        handleSelect(filteredCountries[highlightedIndex].name);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  // Helper to render text with matching characters highlighted
  const renderHighlightedText = (text: string, query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return <span>{text}</span>;

    const idx = text.toLowerCase().indexOf(trimmedQuery.toLowerCase());
    if (idx === -1) return <span>{text}</span>;

    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + trimmedQuery.length);
    const after = text.slice(idx + trimmedQuery.length);

    return (
      <span className="truncate">
        {before}
        <span className="font-bold text-cyan-600 dark:text-cyan-400 underline decoration-cyan-500/50 decoration-2 underline-offset-2">
          {match}
        </span>
        {after}
      </span>
    );
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-md pl-3 pr-14 py-1.5 text-[11px] text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all placeholder-gray-400 dark:placeholder-zinc-500 shadow-sm"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 rounded transition-colors"
              title="Clear country filter"
              aria-label="Clear filter"
            >
              <X size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsOpen((prev) => !prev);
              inputRef.current?.focus();
            }}
            tabIndex={-1}
            className="p-0.5 text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-transform duration-200"
            aria-label="Toggle country list"
          >
            <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 text-xs backdrop-blur-md transition-all animate-in fade-in zoom-in-95 duration-100"
        >
          {filteredCountries.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-gray-500 dark:text-zinc-400 italic text-center">
              No matching countries
            </div>
          ) : (
            <>
              <div className="px-2.5 py-1 text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider flex justify-between items-center border-b border-gray-100 dark:border-zinc-800 mb-1">
                <span>{value ? 'Suggestions' : 'All Countries'}</span>
                <span className="font-normal text-[9px] text-gray-400 dark:text-zinc-500">
                  {filteredCountries.length} {filteredCountries.length === 1 ? 'country' : 'countries'}
                </span>
              </div>
              {filteredCountries.slice(0, 100).map((country, index) => {
                const isSelected = value.trim().toLowerCase() === country.name.toLowerCase();
                const isHighlighted = highlightedIndex === index;

                return (
                  <button
                    key={`${country.code}-${country.name}`}
                    ref={(el) => (itemRefs.current[index] = el)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(country.name)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between text-[11px] transition-colors ${
                      isHighlighted
                        ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300'
                        : isSelected
                        ? 'bg-gray-100 dark:bg-zinc-800 font-medium text-gray-900 dark:text-zinc-100'
                        : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-sm select-none" role="img" aria-label={country.name}>
                        {country.flag}
                      </span>
                      <span className="truncate">
                        {renderHighlightedText(country.name, value)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      {country.code && (
                        <span className="text-[9px] px-1 py-0.2 rounded font-mono font-medium text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 border border-gray-200/50 dark:border-zinc-700/50">
                          {country.code}
                        </span>
                      )}
                      {isSelected && (
                        <span className="text-primary-600 dark:text-primary-400 text-xs">✓</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CountryFilterDropdown;
