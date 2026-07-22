// PatiRun, IDA GG Game Center kabuğunun İÇİNDE çalışır ve Bildim'in TEK
// paylaşılan Supabase client'ını kullanır. Kendi client'ını YARATMAZ —
// aynı domain/storage'da iki GoTrue client oturum kilidi için çakışır.
// (Orijinal bağımsız PatiRun kendi client'ını kuruyordu; hub'a taşınırken
//  paylaşılan client'a bağlandı.)
import { supabase as sharedClient, supabaseHazir } from '../../src/lib/supabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

export const supabase: SupabaseClient | null = sharedClient as SupabaseClient | null;
export const supabaseConfigured = supabaseHazir;
