import { createClient } from '@supabase/supabase-js';

// Sanitize URL to avoid duplicate slashes or appended /rest/v1
const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-supabase-project') &&
  supabaseUrl.startsWith('http')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Traduce y formatea los errores habituales de Supabase Auth a mensajes claros en español.
 */
export function formatSupabaseAuthError(err) {
  if (!err) return 'Ocurrió un error inesperado.';
  const msg = (err.message || String(err)).toLowerCase();

  if (msg.includes('user already registered') || msg.includes('already exists') || msg.includes('user_already_exists')) {
    return 'Este correo electrónico ya está registrado. Por favor inicia sesión con tu contraseña.';
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials') || msg.includes('wrong password')) {
    return 'Correo o contraseña incorrectos. Verifica tus datos e intenta nuevamente.';
  }
  if (msg.includes('password should be at least') || msg.includes('weak_password') || msg.includes('password is too short')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (msg.includes('email not confirmed') || msg.includes('not verified')) {
    return 'Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('over_email_send_rate_limit')) {
    return 'Límite de solicitudes alcanzado. Por favor espera unos minutos antes de intentar de nuevo.';
  }
  if (msg.includes('database error') || msg.includes('error saving new user')) {
    return 'Ocurrió un error al procesar el registro de usuario. Por favor intenta más tarde.';
  }
  if (msg.includes('invalid path') || msg.includes('request url')) {
    return 'Error en la conexión con el servidor. Verifica tu red.';
  }
  if (msg.includes('unable to validate email') || msg.includes('invalid email') || msg.includes('email address')) {
    return 'El formato de correo electrónico no es válido.';
  }
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
    return 'No fue posible conectar con el servicio de autenticación. Revisa tu conexión a internet.';
  }

  return err.message || 'Error en la autenticación. Intenta nuevamente.';
}

/**
 * Iniciar sesión con proveedores OAuth (Google, Apple/iCloud, Facebook)
 */
export async function signInWithProvider(provider) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase no está configurado. Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tus variables de entorno.');
  }

  const providerKey = provider === 'icloud' ? 'apple' : provider;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: providerKey,
    options: {
      redirectTo: `${window.location.origin}/panel`,
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Diagnostic logger for Supabase user and profile lifecycle
 * Strict security: Never logs tokens, passwords or secrets
 */
export function logAuthDiagnostic(action, details = {}) {
  if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
    const safeDetails = { ...details };
    // Explicitly delete any sensitive key if passed accidentally
    delete safeDetails.access_token;
    delete safeDetails.refresh_token;
    delete safeDetails.password;
    delete safeDetails.anon_key;
    delete safeDetails.service_role;
    console.log(`[MOTOLUV AUTH DIAGNOSTIC: ${action}]`, safeDetails);
  }
}

/**
 * Obtener perfil de usuario desde `public.profiles` con fallback a `auth.user.user_metadata`.
 *
 * PRIORIDAD DE DATOS:
 * 1. public.profiles (id = user.id) - Fuente de verdad principal
 * 2. auth.user.user_metadata - Fallback si profiles no existe aún
 * 3. Valores predeterminados / seguros
 *
 * NOTA: No permite que datos incompletos de public.users sobrescriban public.profiles.
 */
export async function fetchUserProfile(userId, userMetadata = null) {
  if (!userId) return null;

  let profile = null;

  if (isSupabaseConfigured && supabase) {
    // 1. Consultar tabla profiles como única fuente de verdad del perfil
    try {
      const { data: pData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        logAuthDiagnostic('fetch_profile_error', {
          userId,
          errorCode: profileError.code,
          errorMessage: profileError.message,
          details: profileError.details,
        });
        console.warn('[Supabase Profiles Warning]', profileError.message);
      } else if (pData) {
        profile = pData;
      }
    } catch (err) {
      console.warn('[Supabase Profiles Exception]', err?.message || err);
    }
  }

  // 2. Cascada de datos según prioridad: profiles -> userMetadata -> defaults
  const meta = userMetadata || {};

  const fullName = profile?.full_name 
    || profile?.name 
    || meta.full_name 
    || meta.name 
    || '';

  const phone = profile?.phone 
    || meta.phone 
    || meta.phone_number 
    || meta.phoneNumber 
    || '';

  const phoneUpdatedOnce = Boolean(
    profile?.phone_updated_once 
    ?? meta.phone_updated_once 
    ?? ((profile?.phone_change_count && profile.phone_change_count >= 1) || false)
  );

  const phoneChangeCount = profile?.phone_change_count 
    ?? meta.phone_change_count 
    ?? (phoneUpdatedOnce ? 1 : 0);

  const city = profile?.city 
    || meta.city 
    || 'Ciudad de México';

  const role = profile?.role 
    || meta.role 
    || 'both';

  const avatarUrl = profile?.avatar_url 
    || meta.avatar_url 
    || meta.picture 
    || '';

  const bankClabe = profile?.bank_clabe !== null && profile?.bank_clabe !== undefined
    ? String(profile.bank_clabe)
    : (meta.bank_clabe ? String(meta.bank_clabe) : '');

  const bankName = profile?.bank_name 
    || meta.bank_name 
    || '';

  const bankHolder = profile?.bank_holder 
    || meta.bank_holder 
    || fullName;

  const bankUpdatedAt = profile?.bank_updated_at 
    || meta.bank_updated_at 
    || null;

  const identityVerificationStatus = profile?.identity_verification_status || 'unverified';
  const rating = profile?.rating !== undefined && profile?.rating !== null ? Number(profile.rating) : null;
  const operations = profile?.operations !== undefined && profile?.operations !== null ? Number(profile.operations) : 0;
  const createdAt = profile?.created_at || new Date().toISOString();
  const updatedAt = profile?.updated_at || new Date().toISOString();

  const merged = {
    id: userId,
    nid: profile?.nid ?? meta?.nid ?? null,
    full_name: fullName,
    name: fullName, // Compatibilidad total con vistas que usen user.name
    phone,
    phone_updated_once: phoneUpdatedOnce,
    phone_change_count: phoneChangeCount,
    city,
    role,
    avatar_url: avatarUrl,
    bank_clabe: bankClabe,
    bank_name: bankName,
    bank_holder: bankHolder,
    bank_updated_at: bankUpdatedAt,
    identity_verification_status: identityVerificationStatus,
    rating,
    operations,
    created_at: createdAt,
    updated_at: updatedAt,
  };

  logAuthDiagnostic('profile_cargado_exitoso', {
    userId: merged.id,
    hasFullName: Boolean(merged.full_name),
    hasPhone: Boolean(merged.phone),
    role: merged.role,
    source: profile ? 'profiles' : 'metadata/default',
  });

  return merged;
}

/**
 * Actualizar datos del usuario exclusivamente en `public.profiles`.
 *
 * REGLAS ARQUITECTÓNICAS CRÍTICAS:
 * 1. public.profiles es la ÚNICA fuente de verdad del perfil.
 * 2. NO actualizar public.users (no contiene full_name, city, role, bank_clabe, etc.).
 * 3. NO llamar a supabase.auth.updateUser() para evitar onAuthStateChange y segundas sincronizaciones.
 * 4. bank_clabe es NUMERIC: Si está vacío, enviar null (NUNCA "").
 * 5. NUNCA modificar public.register_users (inmutable).
 * 6. Devuelve el registro de perfil actualizado directamente desde public.profiles.
 */
export async function updateUserProfile(userId, updates) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    throw new Error('Supabase no está configurado para actualizar el perfil.');
  }

  // 1. Mapear y sanear campos para public.profiles
  const resolvedFullName = updates.full_name !== undefined
    ? String(updates.full_name).trim()
    : updates.name !== undefined
    ? String(updates.name).trim()
    : undefined;

  const cleanData = {};

  if (resolvedFullName !== undefined) {
    cleanData.full_name = resolvedFullName;
    const nameParts = resolvedFullName.split(' ').filter(Boolean);
    cleanData.first_name = nameParts[0] || null;
    cleanData.last_name = nameParts.slice(1).join(' ') || null;
  }

  if (updates.phone !== undefined) {
    cleanData.phone = updates.phone ? String(updates.phone).trim() : null;
  }
  if (updates.phone_updated_once !== undefined) {
    cleanData.phone_updated_once = Boolean(updates.phone_updated_once);
  }
  if (updates.phone_change_count !== undefined) {
    cleanData.phone_change_count = Number(updates.phone_change_count);
  }
  if (updates.city !== undefined) {
    cleanData.city = updates.city ? String(updates.city).trim() : null;
  }
  if (updates.role !== undefined) {
    cleanData.role = updates.role;
  }
  if (updates.avatar_url !== undefined) {
    cleanData.avatar_url = updates.avatar_url;
  }
  if (updates.bank_name !== undefined) {
    cleanData.bank_name = updates.bank_name ? String(updates.bank_name).trim() : null;
  }
  if (updates.bank_holder !== undefined) {
    cleanData.bank_holder = updates.bank_holder ? String(updates.bank_holder).trim() : null;
  }
  if (updates.bank_updated_at !== undefined) {
    cleanData.bank_updated_at = updates.bank_updated_at;
  }

  // Manejo estricto de bank_clabe como NUMERIC
  if (updates.bank_clabe !== undefined) {
    const clabeStr = String(updates.bank_clabe).replace(/\D/g, '').trim();
    if (clabeStr.length > 0) {
      cleanData.bank_clabe = clabeStr;
    } else {
      cleanData.bank_clabe = null; // NUMERIC en Postgres debe recibir null, nunca ""
    }
  }

  cleanData.updated_at = new Date().toISOString();

  // 2. Actualizar EXCLUSIVAMENTE public.profiles
  try {
    const { data: updatedProfile, error: pErr } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        ...cleanData,
      }, { onConflict: 'id' })
      .select('*')
      .single();

    if (pErr) {
      logAuthDiagnostic('update_profiles_table_error', {
        userId,
        message: pErr.message,
        code: pErr.code,
        details: pErr.details,
      });
      console.error('[Supabase Profiles Table Error]', pErr.message, pErr.details || '');
      throw new Error(pErr.message || 'Error al actualizar perfil en Supabase');
    }

    logAuthDiagnostic('profile_actualizado_exitoso', {
      userId: updatedProfile?.id || userId,
      full_name: updatedProfile?.full_name,
      phone: updatedProfile?.phone,
      role: updatedProfile?.role,
    });

    return updatedProfile;
  } catch (err) {
    logAuthDiagnostic('update_profiles_exception', {
      userId,
      message: err?.message || String(err),
    });
    console.error('[Supabase Profiles Update Exception]', err);
    throw err;
  }
}
