// ============================================================================
// Factoría Central de Repositorios de Persistencia
// Selecciona Supabase si existen credenciales, o almacenamiento Local si no
// ============================================================================

import type { DataRepository } from './types.ts';
import { LocalStorageRepository } from './local.ts';
import { SupabaseRepository } from './supabase.ts';

let activeRepository: DataRepository | null = null;

export function getRepository(): DataRepository {
  if (activeRepository) return activeRepository;

  const hasSupabase =
    typeof process !== 'undefined' &&
    process.env?.NEXT_PUBLIC_SUPABASE_URL &&
    process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (hasSupabase) {
    activeRepository = new SupabaseRepository();
  } else {
    activeRepository = new LocalStorageRepository();
  }

  return activeRepository;
}

export function setRepository(repo: DataRepository): void {
  activeRepository = repo;
}

export function isSupabaseMode(): boolean {
  return Boolean(
    typeof process !== 'undefined' &&
    process.env?.NEXT_PUBLIC_SUPABASE_URL &&
    process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
