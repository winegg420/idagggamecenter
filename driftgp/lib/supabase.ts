// DriftGP, IDA GG Game Center kabuğunun İÇİNDE çalışır ve Bildim'in TEK
// paylaşılan Supabase client'ını kullanır. Kendi client'ını YARATMAZ —
// aynı domain/storage'da iki GoTrue client oturum kilidi için çakışır.
// (Orijinal bağımsız DidaGP kendi client'ını kuruyordu; hub'a taşınırken
//  paylaşılan client'a bağlandı. Realtime hızı Bildim client'ında ayarlı.)
import { supabase as sharedClient } from '../../src/lib/supabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

export const supabase: SupabaseClient | null = sharedClient as SupabaseClient | null;

export const isOnline = () => supabase !== null;
