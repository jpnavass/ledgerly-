'use client';

import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { type ThemeMode, type UiPreferences, DEFAULT_UI_PREFERENCES } from '@/lib/theme/types';
import { parseUiCookie, serializeUiCookie, UI_COOKIE_NAME } from '@/lib/theme/cookie';

const MODES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'dark', label: 'Oscuro', icon: Moon },
  { id: 'system', label: 'Sistema', icon: Laptop },
];

export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [currentMode, setCurrentMode] = useState<ThemeMode>('system');
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Leer estado inicial desde cookie o documento
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const cookiePrefs = parseUiCookie(document.cookie);
    const docTheme = document.documentElement.dataset.theme as ThemeMode | undefined;
    setCurrentMode(cookiePrefs.mode || docTheme || 'system');
  }, []);

  // Manejador de selección de tema
  const handleSelectMode = (mode: ThemeMode) => {
    setCurrentMode(mode);
    setOpen(false);
    buttonRef.current?.focus();

    if (typeof document === 'undefined') return;

    // 1. Activar clase de transición temporal (150ms)
    document.documentElement.classList.add('theme-transition');
    window.setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 160);

    // 2. Modificar atributo data-theme en el documento
    if (mode === 'system') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = mode;
    }

    // 3. Persistir en la cookie pe_ui
    const currentPrefs = parseUiCookie(document.cookie);
    const updatedPrefs: UiPreferences = {
      ...currentPrefs,
      mode,
    };
    const serialized = serializeUiCookie(updatedPrefs);
    document.cookie = `${UI_COOKIE_NAME}=${serialized}; path=/; max-age=31536000; SameSite=Lax`;
  };

  // Manejar teclado (Escape, flechas arriba/abajo)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
        if (!items || items.length === 0) return;
        const activeIdx = Array.from(items).indexOf(document.activeElement as HTMLButtonElement);
        let nextIdx = 0;
        if (e.key === 'ArrowDown') {
          nextIdx = activeIdx < items.length - 1 ? activeIdx + 1 : 0;
        } else {
          nextIdx = activeIdx > 0 ? activeIdx - 1 : items.length - 1;
        }
        items[nextIdx]?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const ActiveIcon = currentMode === 'light' ? Sun : currentMode === 'dark' ? Moon : Laptop;

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Cambiar tema de apariencia"
        className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-fg)]"
        title="Cambiar tema de apariencia"
      >
        <ActiveIcon size={18} />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Opciones de tema"
          className="dropdown-menu absolute right-0 mt-2 w-40 animate-fade-in"
        >
          {MODES.map((m) => {
            const Icon = m.icon;
            const isSelected = currentMode === m.id;
            return (
              <button
                key={m.id}
                role="menuitemradio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => handleSelectMode(m.id)}
                className={`dropdown-item justify-between text-xs ${
                  isSelected
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent-fg)] font-semibold'
                    : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon size={14} />
                  <span>{m.label}</span>
                </div>
                {isSelected && <Check size={14} className="text-[var(--accent-fg)]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
