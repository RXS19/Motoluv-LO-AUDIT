import axios from 'axios';
import { resolveSafeImageUrl } from '../utils/imageFallback';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const BACKEND_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) || '';
export const API = `${BACKEND_URL}/api`;

// Helper: resolve relative image URLs with safe fallbacks
export const resolveImageUrl = (url, fallbackType = 'moto') => resolveSafeImageUrl(url, fallbackType);

const api = axios.create({ baseURL: API, timeout: 8000 });

api.interceptors.request.use(async (config) => {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch {
      // ignore
    }
  }
  return config;
});

const formatMotoRecord = (m) => {
  if (!m) return null;
  const imgs = Array.isArray(m.images) && m.images.length > 0 
    ? m.images 
    : (m.image ? [m.image] : []);
  
  const isApartada = m.apartado_status === 'APARTADA' || Boolean(m.is_apartada);

  return {
    id: String(m.id),
    title: m.title || `${m.brand || ''} ${m.model || ''} ${m.year || ''}`.trim(),
    brand: m.brand || '',
    model: m.model || '',
    year: Number(m.year) || 0,
    price: Number(m.price) || 0,
    km: Number(m.km) || 0,
    engine: m.engine || '',
    color: m.color || '',
    category: m.category || 'Naked',
    city: m.city || m.location || 'Ciudad de México',
    location: m.location || m.city || 'Ciudad de México',
    description: m.description || '',
    images: imgs,
    image: imgs[0] || m.image || null,
    score: m.score !== undefined && m.score !== null ? Number(m.score) : null,
    score_details: m.score_details || m.scoreDetails || {},
    scoreDetails: m.scoreDetails || m.score_details || {},
    rating: m.rating !== undefined && m.rating !== null ? Number(m.rating) : null,
    views: Number(m.views) || 0,
    featured: Boolean(m.featured),
    status: m.status || 'PUBLICADA',
    apartado_status: m.apartado_status || (isApartada ? 'APARTADA' : 'DISPONIBLE'),
    is_apartada: isApartada,
    owner_id: m.owner_id || null,
    owner_name: m.owner_name || null,
    owner_rating: m.owner_rating !== undefined && m.owner_rating !== null ? Number(m.owner_rating) : null,
    owner_operations: m.owner_operations !== undefined && m.owner_operations !== null ? Number(m.owner_operations) : 0,
    seller_identity_verification_status: m.seller_identity_verification_status || m.identity_verification_status || null,
    identity_verification_status: m.identity_verification_status || m.seller_identity_verification_status || null,
    created_at: m.created_at || new Date().toISOString(),
    updated_at: m.updated_at || new Date().toISOString(),
  };
};

export const authApi = {
  register: (data) => api.post('/auth/register', data).then((r) => r.data),
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  oauth: (data) => api.post('/auth/oauth', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  updateRole: (role) => api.patch('/auth/role', { role }).then((r) => r.data),
  updateBank: (data) => api.patch('/auth/bank', data).then((r) => r.data),
};

export const motoApi = {
  list: async (params = {}) => {
    // 1. Prioridad: Consultar directamente en Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('motos').select('*');

        if (params.status) {
          query = query.eq('status', params.status);
        } else {
          query = query.eq('status', 'PUBLICADA');
        }
        if (params.featured === true || params.featured === 'true') {
          query = query.eq('featured', true);
        }
        if (params.brand && params.brand !== 'all') {
          query = query.eq('brand', params.brand);
        }
        if (params.category && params.category !== 'all') {
          query = query.eq('category', params.category);
        }
        if (params.city && params.city !== 'all') {
          query = query.or(`city.eq.${params.city},location.eq.${params.city}`);
        }
        if (params.limit) {
          query = query.limit(parseInt(String(params.limit), 10));
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          let list = data
            .map(formatMotoRecord)
            .filter((m) => m && (params.status ? m.status === params.status : m.status === 'PUBLICADA'));

          if (params.q) {
            const qStr = String(params.q).toLowerCase();
            list = list.filter((m) => `${m.brand} ${m.model}`.toLowerCase().includes(qStr));
          }
          return list;
        }
      } catch (err) {
        console.warn('Error querying Supabase motos:', err);
      }
    }

    // 2. Intentar backend /api/motos si está disponible
    try {
      const res = await api.get('/motos', { params });
      if (Array.isArray(res.data)) {
        return res.data
          .map(formatMotoRecord)
          .filter((m) => m && (params.status ? m.status === params.status : m.status === 'PUBLICADA'));
      }
    } catch (err) {
      console.warn('Backend /motos request failed:', err?.message);
    }

    // 3. Si no hay datos en BD o backend, retornar arreglo vacío (NUNCA datos mock)
    return [];
  },

  get: async (id) => {
    if (!id) return null;

    // 1. Prioridad: Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('motos')
          .select('*')
          .eq('id', String(id))
          .maybeSingle();

        if (!error && data) {
          const record = formatMotoRecord(data);
          if (data.owner_id) {
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('identity_verification_status, rating, operations, full_name')
                .eq('id', String(data.owner_id))
                .maybeSingle();

              if (profileData) {
                record.seller_identity_verification_status = profileData.identity_verification_status || 'unverified';
                record.identity_verification_status = profileData.identity_verification_status || 'unverified';
                if (profileData.rating !== undefined && profileData.rating !== null) {
                  record.owner_rating = Number(profileData.rating);
                }
                if (profileData.operations !== undefined && profileData.operations !== null) {
                  record.owner_operations = Number(profileData.operations);
                }
                if (profileData.full_name && !record.owner_name) {
                  record.owner_name = profileData.full_name;
                }
              }
            } catch (pErr) {
              console.warn('Error fetching seller profile from Supabase:', pErr);
            }
          }
          return record;
        }
      } catch (err) {
        console.warn('Error fetching moto from Supabase:', err);
      }
    }

    // 2. Intentar backend
    try {
      const res = await api.get(`/motos/${id}`);
      if (res.data && res.data.id) {
        return formatMotoRecord(res.data);
      }
    } catch (err) {
      console.warn('Backend /motos/:id request failed:', err?.message);
    }

    // 3. No encontrado: devolver null (NUNCA fallback)
    return null;
  },

  getById: async (id) => motoApi.get(id),

  create: async (data) => {
    let sessionUser = null;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionUser = session?.user || null;
      } catch {}
    }

    const defaultImg = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800';
    const imgs = Array.isArray(data.images) && data.images.length > 0 
      ? data.images 
      : (data.image ? [data.image] : [defaultImg]);

    const motoId = `moto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const motoRecord = {
      id: motoId,
      title: `${data.brand || ''} ${data.model || ''} ${data.year || ''}`.trim(),
      brand: data.brand || 'Motocicleta',
      model: data.model || '',
      year: Number(data.year) || new Date().getFullYear(),
      price: Number(data.price) || 0,
      km: Number(data.km) || 0,
      engine: data.engine || '',
      color: data.color || '',
      category: data.category || 'Naked',
      city: data.city || 'Ciudad de México',
      location: data.city || 'Ciudad de México',
      description: data.description || '',
      images: imgs,
      image: imgs[0] || defaultImg,
      owner_id: sessionUser?.id || data.owner_id || null,
      owner_name: sessionUser?.user_metadata?.full_name || sessionUser?.email?.split('@')[0] || 'Vendedor',
      views: 0,
      featured: false,
      status: 'EN REVISIÓN',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Guardar en Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: insertedData, error: supaErr } = await supabase
          .from('motos')
          .insert([motoRecord])
          .select('*')
          .single();

        if (!supaErr && insertedData) {
          return formatMotoRecord(insertedData);
        }
      } catch (supaErr) {
        console.warn('Supabase direct insert error:', supaErr);
      }
    }

    // 2. Intentar backend
    try {
      const res = await api.post('/motos', data);
      if (res.data) {
        return formatMotoRecord(res.data);
      }
    } catch (backendErr) {
      console.warn('Backend /motos failed:', backendErr?.message);
    }

    return motoRecord;
  },

  update: async (id, data) => {
    // 1. Bloqueo de edición si la moto ya está en estado PUBLICADA
    const isEditingDetails = data && Object.keys(data).some(k => 
      ['brand', 'model', 'year', 'km', 'price', 'color', 'engine', 'category', 'city', 'location', 'description', 'images', 'image'].includes(k)
    );

    if (isEditingDetails) {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: currentMoto } = await supabase
            .from('motos')
            .select('status')
            .eq('id', String(id))
            .single();

          const currentStatus = currentMoto?.status;
          if (currentStatus === 'PUBLICADA') {
            const err = new Error('Esta motocicleta ya se encuentra PUBLICADA. La edición directa está bloqueada por seguridad. Por favor, contacta a Soporte Motoluv.');
            err.code = 'MOTO_PUBLISHED_EDIT_LOCKED';
            throw err;
          }
        } catch (statusErr) {
          if (statusErr?.code === 'MOTO_PUBLISHED_EDIT_LOCKED') {
            throw statusErr;
          }
          console.warn('Advertencia al validar estatus de moto:', statusErr?.message);
        }
      }
    }

    if (isSupabaseConfigured && supabase) {
      try {
        if (data.status === 'Rechazada' || data.status === 'rejected') {
          await supabase.from('motos').delete().eq('id', String(id));
          return { deleted: true, status: 'Rechazada' };
        } else {
          const { data: updatedData, error } = await supabase
            .from('motos')
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq('id', String(id))
            .select('*')
            .single();

          if (!error && updatedData) {
            return formatMotoRecord(updatedData);
          }
        }
      } catch (err) {
        if (err?.code === 'MOTO_PUBLISHED_EDIT_LOCKED') throw err;
        console.warn('Error updating moto in Supabase:', err);
      }
    }

    try {
      const res = await api.patch(`/motos/${id}`, data);
      return res.data;
    } catch (err) {
      if (err?.code === 'MOTO_PUBLISHED_EDIT_LOCKED') throw err;
      if (data.status === 'Rechazada' || data.status === 'rejected') {
        return { deleted: true, status: 'Rechazada' };
      }
      throw err;
    }
  },

  remove: async (id) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('motos').delete().eq('id', String(id));
      if (error) {
        console.warn('Error deleting moto from Supabase:', error);
        const fullErrStr = `${error.message || ''} ${error.details || ''} ${error.hint || ''} ${error.code || ''}`.toLowerCase();
        if (
          fullErrStr.includes('apartad') ||
          fullErrStr.includes('vigente') ||
          fullErrStr.includes('foreign key') ||
          fullErrStr.includes('23503') ||
          fullErrStr.includes('violates foreign key') ||
          error.code === '23503' ||
          error.code === 'P0001'
        ) {
          throw new Error('No se puede eliminar esta publicación. Esta motocicleta tiene un apartado vigente y no puede eliminarse mientras esté activo.');
        }
        throw new Error(error.message || 'No se puede eliminar esta publicación.');
      }
      return { ok: true };
    }

    try {
      const res = await api.delete(`/motos/${id}`);
      return res.data;
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.message || err?.message || '';
      const detailLower = detail.toLowerCase();
      if (
        detailLower.includes('apartad') ||
        detailLower.includes('vigente') ||
        detailLower.includes('foreign key') ||
        detailLower.includes('23503')
      ) {
        throw new Error('No se puede eliminar esta publicación. Esta motocicleta tiene un apartado vigente y no puede eliminarse mientras esté activo.');
      }
      if (err?.response?.status === 400 || err?.response?.data?.detail) {
        throw new Error(err.response?.data?.detail || 'No se puede eliminar la publicación');
      }
      throw err;
    }
  },

  mine: async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data, error } = await supabase
            .from('motos')
            .select('*')
            .eq('owner_id', session.user.id)
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data)) {
            return data.map(formatMotoRecord);
          }
        }
      } catch (err) {
        console.warn('Error querying user motos in Supabase:', err);
      }
    }

    try {
      const res = await api.get('/my/motos');
      return Array.isArray(res.data) ? res.data.map(formatMotoRecord) : [];
    } catch {
      return [];
    }
  },

  incrementViews: async (id) => {
    if (!id) return null;
    const motoId = String(id);

    // 1. Supabase RPC incremento atómico (views = COALESCE(views, 0) + 2)
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.rpc('increment_moto_views', {
          p_moto_id: motoId,
        });

        if (!error && typeof data === 'number') {
          return data;
        }
        if (error) {
          console.warn('Error en llamada Supabase RPC increment_moto_views:', error);
        }
      } catch (err) {
        console.warn('Error en llamada Supabase RPC increment_moto_views:', err);
      }
    }

    // 2. Endpoint backend /api/motos/:id/views
    try {
      const res = await api.post(`/motos/${motoId}/views`);
      if (res?.data && typeof res.data.views === 'number') {
        return res.data.views;
      }
    } catch (backendErr) {
      console.warn('Backend views increment failed:', backendErr?.message);
    }

    return null;
  },
};

export const apartadoApi = {
  create: async ({ moto_id }) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) throw new Error('Debes iniciar sesión para realizar un apartado.');

        const generatedNod = `NOD-${Math.floor(100000 + Math.random() * 900000)}`;

        // Insert into public.apartados with buyer_id, moto_id, status and nod
        let data = null;
        let error = null;

        try {
          const res = await supabase
            .from('apartados')
            .insert([
              {
                buyer_id: session.user.id,
                moto_id: String(moto_id),
                status: 'REALIZADO',
                nod: generatedNod,
              },
            ])
            .select('*, moto:motos(*)')
            .single();
          data = res.data;
          error = res.error;
        } catch (insertErr) {
          // If inserting with nod fails (e.g. column not in schema), retry without nod
          const fallbackRes = await supabase
            .from('apartados')
            .insert([
              {
                buyer_id: session.user.id,
                moto_id: String(moto_id),
                status: 'REALIZADO',
              },
            ])
            .select('*, moto:motos(*)')
            .single();
          data = fallbackRes.data;
          error = fallbackRes.error;
        }

        if (error && error.message?.includes('nod')) {
          const fallbackRes = await supabase
            .from('apartados')
            .insert([
              {
                buyer_id: session.user.id,
                moto_id: String(moto_id),
                status: 'REALIZADO',
              },
            ])
            .select('*, moto:motos(*)')
            .single();
          data = fallbackRes.data;
          error = fallbackRes.error;
        }

        if (error) {
          console.error('Error creating apartado in Supabase:', error);
          throw error;
        }

        if (data && !data.nod) {
          data.nod = generatedNod;
        }

        // Automatic notification to seller
        try {
          const sellerId = data?.moto?.owner_id;
          if (sellerId) {
            const motoTitle = `${data.moto?.brand || ''} ${data.moto?.model || ''}`.trim() || 'tu motocicleta';
            await supabase
              .from('notifications')
              .insert([
                {
                  recipient_id: sellerId,
                  type: 'APARTADO_RECIBIDO',
                  title: '¡Apartado recibido!',
                  body: `Se ha registrado un apartado para ${motoTitle}. Es momento de agendar la inspección técnica en un taller certificado.`,
                  moto_id: String(moto_id),
                  apartado_id: String(data.id),
                },
              ]);
          }
        } catch (notifErr) {
          console.warn('Could not insert notification into Supabase:', notifErr);
        }

        return data;
      } catch (err) {
        console.warn('Supabase apartado create error:', err);
        throw err;
      }
    }

    return api.post('/apartados', { moto_id }).then((r) => r.data);
  },

  mine: async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data, error } = await supabase
            .from('apartados')
            .select('*, moto:motos(*)')
            .eq('buyer_id', session.user.id)
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data)) {
            const sellerIds = [...new Set(data.map((a) => a.moto?.owner_id).filter(Boolean))];
            const profilesMap = {};
            if (sellerIds.length > 0) {
              try {
                const { data: profs } = await supabase
                  .from('profiles')
                  .select('id, name, full_name, email, identity_verification_status')
                  .in('id', sellerIds);
                if (Array.isArray(profs)) {
                  profs.forEach((p) => {
                    profilesMap[p.id] = {
                      name: p.full_name || p.name || (p.email ? p.email.split('@')[0] : null),
                      is_verified: p.identity_verification_status === 'verified',
                    };
                  });
                }
              } catch (e) {
                console.warn('Error fetching seller profiles:', e);
              }
            }

            return data.map((a) => {
              const profileInfo = profilesMap[a.moto?.owner_id];
              const isVerified = Boolean(
                profileInfo?.is_verified ||
                a.moto?.seller_identity_verification_status === 'verified' ||
                a.moto?.identity_verification_status === 'verified' ||
                a.moto?.is_verified
              );

              return {
                ...a,
                nod: a.nod || (a.id ? `NOD-${String(a.id).replace(/\D/g, '').slice(0, 6).padStart(6, '0')}` : 'NOD-000100'),
                moto_brand: a.moto?.brand,
                moto_model: a.moto?.model,
                moto_year: a.moto?.year,
                moto_price: a.moto?.price,
                moto_image: a.moto?.images?.[0] || a.moto?.image,
                seller_name: profileInfo?.name || a.moto?.owner_name || 'Vendedor Motoluv',
                seller_is_verified: isVerified,
                buyer_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Comprador',
              };
            });
          }
        }
      } catch (err) {
        console.warn('Error querying apartados from Supabase:', err);
      }
    }

    try {
      const res = await api.get('/my/apartados');
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  },

  getByMotoForBuyer: async (motoId) => {
    if (!motoId) return null;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data, error } = await supabase
            .from('apartados')
            .select('*')
            .eq('buyer_id', session.user.id)
            .eq('moto_id', String(motoId))
            .order('created_at', { ascending: false })
            .limit(1);

          if (!error && Array.isArray(data) && data.length > 0) {
            return data[0];
          }
        }
      } catch (err) {
        console.warn('Error querying apartado by moto:', err);
      }
    }
    return null;
  },

  received: async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data, error } = await supabase
            .from('apartados')
            .select('*, moto:motos(*)')
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data)) {
            const filtered = data.filter((a) => a.moto?.owner_id === session.user.id);
            const buyerIds = [...new Set(filtered.map((a) => a.buyer_id).filter(Boolean))];
            const profilesMap = {};
            if (buyerIds.length > 0) {
              try {
                const { data: profs } = await supabase
                  .from('profiles')
                  .select('id, name, full_name, email')
                  .in('id', buyerIds);
                if (Array.isArray(profs)) {
                  profs.forEach((p) => {
                    profilesMap[p.id] = p.full_name || p.name || (p.email ? p.email.split('@')[0] : null);
                  });
                }
              } catch (e) {
                console.warn('Error fetching buyer profiles:', e);
              }
            }

            return filtered.map((a) => ({
              ...a,
              nod: a.nod || (a.id ? `NOD-${String(a.id).replace(/\D/g, '').slice(0, 6).padStart(6, '0')}` : 'NOD-000100'),
              moto_brand: a.moto?.brand,
              moto_model: a.moto?.model,
              moto_year: a.moto?.year,
              moto_price: a.moto?.price,
              moto_city: a.moto?.city,
              moto_image: a.moto?.images?.[0] || a.moto?.image,
              seller_name: a.moto?.owner_name || session.user.user_metadata?.full_name || 'Vendedor',
              buyer_name: profilesMap[a.buyer_id] || a.buyer_name || 'Comprador Motoluv',
            }));
          }
        }
      } catch (err) {
        console.warn('Error querying received apartados from Supabase:', err);
      }
    }

    try {
      const res = await api.get('/my/received-apartados');
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  },

  scheduleAppointment: async ({ apartado_id, appointment_at, workshop_name, workshop_id }) => {
    if (!apartado_id || !appointment_at) {
      throw new Error('ID de apartado y fecha son obligatorios para agendar la cita.');
    }

    const appointmentIso = new Date(appointment_at).toISOString();

    if (isSupabaseConfigured && supabase) {
      try {
        const updatePayload = {
          certification_appointment_at: appointmentIso,
          certification_appointment_status: 'PROGRAMADA',
          certification_workshop: workshop_name || null,
          certification_workshop_id: workshop_id || null,
        };

        const { data, error } = await supabase
          .from('apartados')
          .update(updatePayload)
          .eq('id', apartado_id)
          .select('*, moto:motos(*)')
          .single();

        if (error) {
          console.error('Error updating appointment in Supabase:', error);
          throw error;
        }

        // Auto mark related notification as attended/read
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            await supabase
              .from('notifications')
              .update({ read_at: new Date().toISOString() })
              .eq('recipient_id', session.user.id)
              .eq('apartado_id', String(apartado_id));
          }
        } catch {
          // ignore notification mark error
        }

        return data;
      } catch (err) {
        console.warn('Supabase schedule appointment error:', err);
        throw err;
      }
    }

    return api
      .put(`/apartados/${apartado_id}/appointment`, {
        appointment_at: appointmentIso,
        workshop_name,
        workshop_id,
        status: 'PROGRAMADA',
      })
      .then((r) => r.data);
  },
};

export const offerApi = {
  create: async (data) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) throw new Error('Usuario no autenticado');

        const offerRecord = {
          moto_id: String(data.moto_id),
          buyer_id: session.user.id,
          amount: Number(data.amount) || 0,
          status: 'ENVIADA',
          ...(data.package ? { package: data.package } : { package: null }),
        };

        const { data: inserted, error } = await supabase
          .from('offers')
          .insert([offerRecord])
          .select('*')
          .single();

        if (error) {
          console.error('Supabase offer insert error:', error);
          const errMsg = (error.message || '').toLowerCase();
          if (
            errMsg.includes('monto') ||
            errMsg.includes('amount') ||
            errMsg.includes('constraint') ||
            errMsg.includes('check') ||
            errMsg.includes('invalid') ||
            error.code === '23514'
          ) {
            throw new Error('El monto ingresado no puede procesarse. Revisa tu oferta e inténtalo nuevamente.');
          }
          throw error;
        }

        if (inserted) {
          return inserted;
        }
      } catch (err) {
        const errMsg = (err?.message || '').toLowerCase();
        if (
          errMsg.includes('monto') ||
          errMsg.includes('amount') ||
          errMsg.includes('constraint') ||
          errMsg.includes('check') ||
          errMsg.includes('invalid') ||
          err?.code === '23514'
        ) {
          throw new Error('El monto ingresado no puede procesarse. Revisa tu oferta e inténtalo nuevamente.');
        }
        throw err;
      }
    }
    const payload = {
      moto_id: data.moto_id,
      amount: Number(data.amount) || 0,
      ...(data.package ? { package: data.package } : { package: null }),
    };
    return api.post('/offers', payload).then((r) => r.data);
  },

  mine: async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data, error } = await supabase
            .from('offers')
            .select('*, moto:motos(*)')
            .eq('buyer_id', session.user.id)
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data)) {
            return data.map((o) => ({
              ...o,
              status: o.status || 'ENVIADA',
              moto_brand: o.moto?.brand,
              moto_model: o.moto?.model,
              moto_year: o.moto?.year,
              moto_image: o.moto?.images?.[0] || o.moto?.image,
              seller_name: o.moto?.owner_name || 'Vendedor Verificado',
            }));
          }
        }
      } catch (err) {
        console.warn('Error querying user offers from Supabase:', err);
      }
    }

    try {
      const res = await api.get('/my/offers');
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  },

  received: async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data, error } = await supabase
            .from('offers')
            .select('*, moto:motos(*)')
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data)) {
            return data
              .filter((o) => o.moto?.owner_id === session.user.id || o.seller_id === session.user.id)
              .map((o) => ({
                ...o,
                status: o.status || 'ENVIADA',
                motoBrand: o.moto?.brand,
                motoModel: o.moto?.model,
                originalPrice: o.moto?.price,
                offeredAmount: o.amount,
                buyerName: o.buyer_name || 'Comprador',
              }));
          }
        }
      } catch (err) {
        console.warn('Error querying received offers from Supabase:', err);
      }
    }

    try {
      const res = await api.get('/my/received-offers');
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  },

  respond: async (id, status, rejectionReason = null, rejectionConfirmed = false) => {
    // Map to strictly allowed states: ENVIADA, PENDIENTE, ACEPTADA, RECHAZADA, EXPIRADA
    let finalStatus = status;
    if (status === 'accepted' || status === 'Aceptada') finalStatus = 'ACEPTADA';
    else if (status === 'rejected' || status === 'Rechazada') finalStatus = 'RECHAZADA';
    else if (status === 'pending' || status === 'Pendiente') finalStatus = 'PENDIENTE';
    else if (status === 'expired' || status === 'Expirada') finalStatus = 'EXPIRADA';

    const updatePayload = {
      status: finalStatus,
    };

    if (finalStatus === 'RECHAZADA') {
      if (rejectionReason) {
        updatePayload.message = String(rejectionReason).trim();
      }
      if (rejectionConfirmed === true) {
        updatePayload.rejection_confirmed = true;
      }
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('offers')
        .update(updatePayload)
        .eq('id', String(id))
        .select('*')
        .single();

      if (error) {
        console.error('Error updating offer in Supabase:', error);
        throw error;
      }

      if (data) {
        return data;
      }
    }
    return api.patch(`/offers/${id}`, updatePayload).then((r) => r.data);
  },

  updateStatus: async (id, status, rejectionReason = null, rejectionConfirmed = false) => {
    let finalStatus = status;
    if (status === 'accepted' || status === 'Aceptada') finalStatus = 'ACEPTADA';
    else if (status === 'rejected' || status === 'Rechazada') finalStatus = 'RECHAZADA';
    else if (status === 'pending' || status === 'Pendiente') finalStatus = 'PENDIENTE';
    else if (status === 'expired' || status === 'Expirada') finalStatus = 'EXPIRADA';

    const updatePayload = {
      status: finalStatus,
    };

    if (finalStatus === 'RECHAZADA') {
      if (rejectionReason) {
        updatePayload.message = String(rejectionReason).trim();
      }
      if (rejectionConfirmed === true) {
        updatePayload.rejection_confirmed = true;
      }
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('offers')
        .update(updatePayload)
        .eq('id', String(id))
        .select('*')
        .single();

      if (error) {
        console.error('Error updating offer in Supabase:', error);
        throw error;
      }

      if (data) {
        return data;
      }
    }
    return api.patch(`/offers/${id}`, updatePayload).then((r) => r.data);
  },
};

export const uploadApi = {
  image: async (file) => {
    // 1. Direct upload to Supabase Storage if configured on client
    if (isSupabaseConfigured && supabase) {
      const candidateBuckets = ['motos', 'Motos', 'images', 'uploads', 'vehicles', 'public', 'motoluv'];
      const fileExt = file.name ? file.name.split('.').pop() || 'jpg' : 'jpg';
      const cleanFileName = `moto_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

      for (const bucket of candidateBuckets) {
        try {
          const { data, error } = await supabase.storage
            .from(bucket)
            .upload(cleanFileName, file, {
              cacheControl: '3600',
              upsert: true,
              contentType: file.type || 'image/jpeg',
            });

          if (!error && data) {
            const { data: publicUrlData } = supabase.storage
              .from(bucket)
              .getPublicUrl(cleanFileName);

            if (publicUrlData && publicUrlData.publicUrl) {
              return {
                url: publicUrlData.publicUrl,
                filename: cleanFileName,
                provider: 'supabase',
                bucket,
              };
            }
          }
        } catch {
          // try next bucket
        }
      }
    }

    // 2. Fallback to backend /api/upload endpoint
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res?.data?.url) {
        return res.data;
      }
    } catch (backendErr) {
      console.warn('Backend upload fallback failed, using local preview:', backendErr);
    }

    // 3. Fallback to client-side Data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          url: reader.result,
          filename: file.name || `photo_${Date.now()}.jpg`,
          provider: 'client_base64',
        });
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  },
};

export const partnerApi = {
  apply: (data) => api.post('/partners', data).then((r) => r.data),
};

export const notificationApi = {
  getUnread: async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id;
        if (currentUserId) {
          const { data, error } = await supabase
            .from('notifications')
            .select('id, recipient_id, type, title, body, moto_id, apartado_id, offer_id, created_at, read_at')
            .eq('recipient_id', currentUserId)
            .is('read_at', null)
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data)) {
            return data.map((n) => ({
              id: String(n.id),
              recipient_id: String(n.recipient_id),
              type: n.type,
              title: n.title || 'Notificación',
              body: n.body || '',
              moto_id: n.moto_id,
              apartado_id: n.apartado_id,
              offer_id: n.offer_id,
              created_at: n.created_at,
              read_at: n.read_at,
            }));
          }
        }
      } catch (err) {
        console.warn('Error querying notifications from Supabase:', err);
      }
    }
    return [];
  },

  markAsRead: async (notificationId) => {
    if (!notificationId) return false;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id;
        if (currentUserId) {
          const now = new Date().toISOString();
          const { error } = await supabase
            .from('notifications')
            .update({ read_at: now })
            .eq('id', notificationId)
            .eq('recipient_id', currentUserId);

          if (!error) {
            return true;
          }
        }
      } catch (err) {
        console.warn('Error marking notification as read in Supabase:', err);
      }
    }
    return false;
  },

  markAllAsRead: async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id;
        if (currentUserId) {
          const now = new Date().toISOString();
          const { error } = await supabase
            .from('notifications')
            .update({ read_at: now })
            .eq('recipient_id', currentUserId)
            .is('read_at', null);

          if (!error) {
            return true;
          }
        }
      } catch (err) {
        console.warn('Error marking all notifications as read in Supabase:', err);
      }
    }
    return false;
  },
};

export const chatApi = {
  send: (message, history = []) => api.post('/chat', { message, history }).then((r) => r.data),
};

export const stripeApi = {
  getConfig: () => api.get('/stripe/config').then((r) => r.data),
  createPaymentIntent: (data) => api.post('/stripe/create-payment-intent', data).then((r) => r.data),
  createCheckoutSession: (data) => api.post('/stripe/create-checkout-session', data).then((r) => r.data),
  processOrder: (data) => api.post('/stripe/process-order', data).then((r) => r.data),
};

export const clipApi = {
  getConfig: () => api.get('/clip/config').then((r) => r.data),
  createPaymentRequest: (data) => api.post('/clip/create-payment-request', data).then((r) => r.data),
  processCheckout: (data) => api.post('/clip/process-checkout', data).then((r) => r.data),
};

export const hubspotApi = {
  syncUserRegistration: (userData) => api.post('/webhooks/hubspot/user-register', userData).then((r) => r.data),
  syncStatusCard: (cardData) => api.post('/webhooks/hubspot/status-card', cardData).then((r) => r.data),
};

export default api;
