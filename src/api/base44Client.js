// ============================================================================
// This file used to create a @base44/sdk client. BallotOS is now fully
// independent of Base44 — this is a drop-in replacement backed by Supabase.
//
// It intentionally keeps the same shape (`base44.entities.X.list()`,
// `base44.auth.me()`, `base44.integrations.Core.UploadFile()`, ...) as the
// original SDK so the rest of the app (pages/components) did not need to be
// rewritten — only this file and the auth pages changed.
// ============================================================================
import { supabase } from '@/lib/supabaseClient';

// ---------------------------------------------------------------------------
// entities.X — generic Supabase-backed CRUD matching base44's entity API
// ---------------------------------------------------------------------------

function parseSort(sort) {
  if (!sort) return null;
  const desc = sort.startsWith('-');
  const column = desc ? sort.slice(1) : sort;
  return { column, ascending: !desc };
}

function stripUndefined(obj) {
  const out = {};
  Object.keys(obj || {}).forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

// Supabase/PostgREST caps any single response at a server-configured "max
// rows" (commonly 1000), no matter what limit the client asks for. To
// support elections with thousands of students/votes, we page through
// results with .range() until an empty page comes back, honoring an
// optional overall `limit` along the way.
const PAGE_SIZE = 500;

async function fetchPaged(buildQuery, limit) {
  let offset = 0;
  let all = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const upper = offset + PAGE_SIZE - 1;
    const { data, error } = await buildQuery().range(offset, upper);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (limit && all.length >= limit) {
      all = all.slice(0, limit);
      break;
    }
    if (data.length < PAGE_SIZE) break; // last page
    offset += PAGE_SIZE;
  }
  return all;
}

function makeEntity(table) {
  return {
    // list(sort, limit)
    async list(sort, limit) {
      const s = parseSort(sort);
      const build = () => {
        let q = supabase.from(table).select('*');
        if (s) q = q.order(s.column, { ascending: s.ascending });
        return q;
      };
      return fetchPaged(build, limit);
    },

    // filter({ field: value, ... }, sort, limit)
    async filter(query = {}, sort, limit) {
      const clean = stripUndefined(query);
      const s = parseSort(sort);
      const build = () => {
        let q = supabase.from(table).select('*');
        Object.entries(clean).forEach(([key, value]) => {
          q = q.eq(key, value);
        });
        if (s) q = q.order(s.column, { ascending: s.ascending });
        return q;
      };
      return fetchPaged(build, limit);
    },

    async get(id) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async create(payload) {
      const { data, error } = await supabase
        .from(table)
        .insert(stripUndefined(payload))
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async bulkCreate(rows) {
      const clean = (rows || []).map(stripUndefined);
      if (!clean.length) return [];
      const { data, error } = await supabase.from(table).insert(clean).select();
      if (error) throw error;
      return data;
    },

    async update(id, patch) {
      const { data, error } = await supabase
        .from(table)
        .update(stripUndefined(patch))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    // bulkUpdate([{ id, ...patch }, ...]) — each row updated individually
    // (Postgres has no multi-row "different values per row" update in one call).
    async bulkUpdate(rows) {
      const results = await Promise.all(
        (rows || []).map(({ id, ...patch }) =>
          supabase.from(table).update(stripUndefined(patch)).eq('id', id).select().single()
        )
      );
      const err = results.find((r) => r.error);
      if (err) throw err.error;
      return results.map((r) => r.data);
    },

    // updateMany(matchFilter, updateOp) — updateOp may be { $set: {...} } or a plain object
    async updateMany(match = {}, updateOp = {}) {
      const patch = updateOp && updateOp.$set ? updateOp.$set : updateOp;
      let q = supabase.from(table).update(stripUndefined(patch));
      Object.entries(stripUndefined(match)).forEach(([key, value]) => {
        q = q.eq(key, value);
      });
      const { data, error } = await q.select();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    async deleteMany(ids) {
      if (!ids || !ids.length) return true;
      const { error } = await supabase.from(table).delete().in('id', ids);
      if (error) throw error;
      return true;
    },

    // subscribe(callback) — realtime; returns an unsubscribe function
    subscribe(callback) {
      const channel = supabase
        .channel(`${table}-changes-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => callback())
        .subscribe();
      return () => supabase.removeChannel(channel);
    },
  };
}

const entities = {
  Election: makeEntity('elections'),
  Position: makeEntity('positions'),
  Candidate: makeEntity('candidates'),
  Student: makeEntity('students'),
  VotingStation: makeEntity('voting_stations'),
  Vote: makeEntity('votes'),
  User: makeEntity('users'),
  AuditLog: makeEntity('audit_logs'),
};

// ---------------------------------------------------------------------------
// auth.* — Supabase Auth (email/password)
// ---------------------------------------------------------------------------

async function me() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw error || new Error('Not authenticated');
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();
  if (profileError) throw profileError;
  return { id: user.id, email: user.email, ...profile };
}

const auth = {
  me,

  async isAuthenticated() {
    const { data } = await supabase.auth.getSession();
    return !!data?.session;
  },

  async loginViaEmailPassword(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async register({ email, password, full_name }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: full_name ? { data: { full_name } } : undefined,
    });
    if (error) throw error;
    return data;
  },

  async logout(redirectTo = '/login') {
    await supabase.auth.signOut();
    if (redirectTo) window.location.href = redirectTo;
  },

  redirectToLogin(returnTo) {
    window.location.href = returnTo
      ? `/login?returnTo=${encodeURIComponent(returnTo)}`
      : '/login';
  },

  async resetPasswordRequest(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
    return true;
  },

  // Called on the reset-password page once Supabase has established a
  // recovery session from the emailed link.
  async resetPassword({ newPassword }) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return true;
  },
};

// ---------------------------------------------------------------------------
// integrations.Core.UploadFile — Supabase Storage
// ---------------------------------------------------------------------------

const integrations = {
  Core: {
    async UploadFile({ file }) {
      const ext = file.name.split('.').pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('ballotos-media').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('ballotos-media').getPublicUrl(path);
      return { file_url: data.publicUrl };
    },
  },
};

// ---------------------------------------------------------------------------
// users.inviteUser — admin invites a new user by email
// Requires the /api/invite-user serverless function (uses the Supabase
// service role key, which must never be exposed to the browser).
// ---------------------------------------------------------------------------

const users = {
  async inviteUser(email, platformRole = 'user') {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/invite-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({ email, platformRole }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to invite user');
    }
    return res.json();
  },
};

export const base44 = { entities, auth, integrations, users };