// One-time data migration: Firestore (dashboard_data collection) -> Supabase (nrc_dashboard_data table).
//
// Requires Node.js 18+ (uses the built-in fetch). Run schema.sql in the Supabase SQL Editor first.
//
// Usage (PowerShell):
//   $env:SUPABASE_URL = "https://xxxx.supabase.co"
//   $env:SUPABASE_ANON_KEY = "xxxxx"
//   node supabase/migrate-from-firestore.mjs
//
// The Firestore project ID and API key below are the ones already committed in
// js/firebase-config.js (public client config, not a secret). Firestore rules for
// this project allow unauthenticated reads, matching how the web app itself reads them.

const FIRESTORE_PROJECT_ID = 'nrc-takip-3bd3c';
const FIRESTORE_API_KEY = 'AIzaSyBMPqA7rqm_OpfTkDYYN2_8sbt8mP8BFXo';
const FIRESTORE_COLLECTION = 'dashboard_data';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('SUPABASE_URL ve SUPABASE_ANON_KEY ortam değişkenlerini ayarlayıp tekrar çalıştırın.');
    process.exit(1);
}

function decodeValue(v) {
    if (!v || v.nullValue !== undefined) return null;
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return Number(v.integerValue);
    if (v.doubleValue !== undefined) return v.doubleValue;
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.timestampValue !== undefined) return v.timestampValue;
    if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(decodeValue);
    if (v.mapValue !== undefined) return decodeFields(v.mapValue.fields || {});
    return null;
}

function decodeFields(fields) {
    const out = {};
    for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
    return out;
}

async function fetchFirestoreDoc(docId) {
    const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${FIRESTORE_COLLECTION}/${docId}?key=${FIRESTORE_API_KEY}`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Firestore fetch failed for ${docId}: ${res.status} ${await res.text()}`);
    const json = await res.json();
    return decodeFields(json.fields || {});
}

async function upsertSupabaseRow(key, payload) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/nrc_dashboard_data`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify([{ key, payload, updated_at: new Date().toISOString() }]),
    });
    if (!res.ok) throw new Error(`Supabase upsert failed for ${key}: ${res.status} ${await res.text()}`);
}

async function migrateMain() {
    const raw = await fetchFirestoreDoc('main_data');
    if (!raw) { console.log('main_data: Firestore\'da bulunamadı, atlandı.'); return; }
    const data = raw.dataJson ? JSON.parse(raw.dataJson) : (raw.data || []);
    await upsertSupabaseRow('main_data', { headers: raw.headers || [], data });
    console.log(`main_data: ${data.length} satır taşındı.`);
}

async function migrateMapping() {
    const raw = await fetchFirestoreDoc('aircraft_mapping');
    if (!raw) { console.log('aircraft_mapping: Firestore\'da bulunamadı, atlandı.'); return; }
    await upsertSupabaseRow('aircraft_mapping', { mapping: raw.mapping || {}, excludedWOs: raw.excludedWOs || [] });
    console.log('aircraft_mapping: taşındı.');
}

async function migrateTaskCardMapping() {
    const raw = await fetchFirestoreDoc('taskcard_mapping');
    if (!raw) { console.log('taskcard_mapping: Firestore\'da bulunamadı, atlandı.'); return; }
    await upsertSupabaseRow('taskcard_mapping', { mapping: raw.mapping || {} });
    console.log('taskcard_mapping: taşındı.');
}

async function migrateMetadata() {
    const raw = await fetchFirestoreDoc('metadata');
    if (!raw) { console.log('metadata: Firestore\'da bulunamadı, atlandı.'); return; }
    await upsertSupabaseRow('metadata', { ...raw });
    console.log('metadata: taşındı.');
}

async function main() {
    await migrateMain();
    await migrateMapping();
    await migrateTaskCardMapping();
    await migrateMetadata();
    console.log('Taşıma tamamlandı.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
