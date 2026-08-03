// Shared, cross-visitor storage for community-reported sightings, backed by
// Supabase (hosted Postgres + auto-generated REST API). The anon key below
// is meant to be exposed in client code — Supabase's security model is
// enforced by Row Level Security policies on the table (public can SELECT
// and INSERT only), not by keeping this key secret.
const SUPABASE_URL = "https://rhmtifjbnqpikzdwgrre.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJobXRpZmpibnFwaWt6ZHdncnJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTE1MDUsImV4cCI6MjEwMDk4NzUwNX0._vnbEOYNu_9q9djS8iqxED-QMAIu1QKCvzWY3GGqCsI";

const SUPABASE_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

function rowToSighting(row) {
  return {
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    date: row.date,
    type: row.type,
    count: row.count,
    description: row.description || "",
    reporter: row.reporter || "",
    photoUrl: row.photo_url || "",
    createdAt: row.created_at,
    // Defaults to "community" for both existing rows and any table that
    // doesn't have this column yet (select * just omits it, so row.source
    // is undefined) — every row in the table today came through the
    // report form, so that default is accurate, not a guess. Only rows
    // hand-imported from official monitoring data (see README's
    // "Historical/official data" section) would ever carry "silava" or
    // "dap" instead.
    source: row.source || "community",
  };
}

async function loadSightings() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/sightings?select=*&order=date.desc`, {
      headers: SUPABASE_HEADERS,
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.map(rowToSighting);
  } catch {
    return [];
  }
}

async function addSighting(sighting) {
  const payload = {
    lat: sighting.lat,
    lng: sighting.lng,
    date: sighting.date,
    type: sighting.type,
    count: sighting.count,
    description: sighting.description || null,
    reporter: sighting.reporter || null,
    photo_url: sighting.photoUrl || null,
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sightings`, {
    method: "POST",
    headers: {
      ...SUPABASE_HEADERS,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Insert failed: HTTP ${res.status}`);
  const [row] = await res.json();
  return row ? rowToSighting(row) : null;
}

// --- Confirm/dispute voting ---
// One vote per browser per sighting, enforced by a unique constraint in the
// database (sighting_id + device_id) — not just hidden client-side, so
// clearing localStorage doesn't let the same visitor re-vote.
const DEVICE_ID_KEY = "lacupedas.deviceId";
const MY_VOTES_KEY = "lacupedas.myVotes";

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id =
      window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function getMyVotes() {
  try {
    return JSON.parse(localStorage.getItem(MY_VOTES_KEY)) || {};
  } catch {
    return {};
  }
}

function rememberMyVote(sightingId, voteType) {
  const votes = getMyVotes();
  votes[sightingId] = voteType;
  localStorage.setItem(MY_VOTES_KEY, JSON.stringify(votes));
}

async function loadVoteCounts() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/sighting_vote_counts?select=*`, {
      headers: SUPABASE_HEADERS,
    });
    if (!res.ok) return {};
    const rows = await res.json();
    const byId = {};
    rows.forEach((r) => {
      byId[r.sighting_id] = { confirm: r.confirm_count, dispute: r.dispute_count };
    });
    return byId;
  } catch {
    return {};
  }
}

// --- "Report an issue" (fake/duplicate/wrong entry) ---
// Write-only from the client's perspective: the anon key can INSERT but not
// SELECT reports (see the RLS policy in README), so flagged items go into a
// private moderation queue only the site owner can see via the Supabase
// dashboard — visitors can't see who reported what, or how many reports an
// entry has, which would otherwise invite abuse (mass-flagging a real
// sighting to get it removed).
async function submitReport(targetType, targetId, reason) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
      method: "POST",
      headers: {
        ...SUPABASE_HEADERS,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ target_type: targetType, target_id: String(targetId), reason: reason || null }),
    });
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

// Returns "ok", "already-voted", or "error".
async function submitVote(sightingId, voteType) {
  const deviceId = getDeviceId();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/sighting_votes`, {
      method: "POST",
      headers: {
        ...SUPABASE_HEADERS,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ sighting_id: sightingId, device_id: deviceId, vote_type: voteType }),
    });
    if (res.status === 409) {
      rememberMyVote(sightingId, voteType);
      return "already-voted";
    }
    if (!res.ok) return "error";
    rememberMyVote(sightingId, voteType);
    return "ok";
  } catch {
    return "error";
  }
}
