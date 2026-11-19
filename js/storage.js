// Supabase Storage Module
import { supabase } from './supabase-config.js';

const TABLE = 'nrc_dashboard_data';

async function readRow(key) {
    const { data, error } = await supabase.from(TABLE).select('payload').eq('key', key).maybeSingle();
    if (error) throw error;
    return data ? data.payload : null;
}

async function writeRow(key, payload) {
    const { error } = await supabase.from(TABLE).upsert({ key, payload, updated_at: new Date().toISOString() });
    if (error) throw error;
}

const Storage = {
    KEY_MAIN: 'main_data',
    KEY_MAPPING: 'aircraft_mapping',
    KEY_TC_MAPPING: 'taskcard_mapping',
    KEY_METADATA: 'metadata',

    // Save main dashboard data
    save: async function (data) {
        try {
            await writeRow(this.KEY_MAIN, { headers: data.headers, data: data.data });
            console.log('Data saved to Supabase');
            return true;
        } catch (e) {
            console.error('Error saving data to Supabase:', e);
            alert('Veri kaydedilirken hata oluştu: ' + e.message);
            return false;
        }
    },

    // Load main dashboard data
    load: async function () {
        try {
            const payload = await readRow(this.KEY_MAIN);
            if (payload) {
                console.log('Data loaded from Supabase');
                return { headers: payload.headers, data: payload.data };
            }
            console.log('No data found in Supabase');
            return null;
        } catch (e) {
            console.error('Error loading data from Supabase:', e);
            return null;
        }
    },

    // Save aircraft mapping (WO -> Aircraft Name)
    saveMapping: async function (mappingData, excludedWOs = []) {
        try {
            await writeRow(this.KEY_MAPPING, { mapping: mappingData, excludedWOs: excludedWOs });
            console.log('Mapping data saved to Supabase');
            return true;
        } catch (e) {
            console.error('Error saving mapping to Supabase:', e);
            this.lastError = e;
            return false;
        }
    },

    // Load aircraft mapping
    loadMapping: async function () {
        try {
            const payload = await readRow(this.KEY_MAPPING);
            if (payload) {
                console.log('Mapping data loaded from Supabase');
                return { mapping: payload.mapping || {}, excludedWOs: payload.excludedWOs || [] };
            }
            console.log('No mapping data found');
            return { mapping: {}, excludedWOs: [] };
        } catch (e) {
            console.error('Error loading mapping from Supabase:', e);
            this.lastError = e;
            return { mapping: {}, excludedWOs: [] };
        }
    },

    // Save task card mapping (TaskCard -> Department)
    saveTaskCardMapping: async function (mappingData) {
        try {
            await writeRow(this.KEY_TC_MAPPING, { mapping: mappingData });
            console.log('Task Card mapping data saved to Supabase');
            return true;
        } catch (e) {
            console.error('Error saving task card mapping to Supabase:', e);
            this.lastError = e;
            return false;
        }
    },

    // Load task card mapping
    loadTaskCardMapping: async function () {
        try {
            const payload = await readRow(this.KEY_TC_MAPPING);
            if (payload) {
                console.log('Task Card mapping data loaded from Supabase');
                return payload.mapping || {};
            }
            console.log('No task card mapping data found');
            return {};
        } catch (e) {
            console.error('Error loading task card mapping from Supabase:', e);
            this.lastError = e;
            return {};
        }
    },

    // Save metadata (import timestamp, stats)
    saveMetadata: async function (metadata) {
        try {
            await writeRow(this.KEY_METADATA, { ...metadata });
            console.log('Metadata saved to Supabase');
            return true;
        } catch (e) {
            console.error('Error saving metadata to Supabase:', e);
            return false;
        }
    },

    // Load metadata
    loadMetadata: async function () {
        try {
            const payload = await readRow(this.KEY_METADATA);
            if (payload) {
                console.log('Metadata loaded from Supabase');
                return payload;
            }
            return null;
        } catch (e) {
            console.error('Error loading metadata from Supabase:', e);
            return null;
        }
    },

    // Clear all data (for testing purposes)
    clear: async function () {
        try {
            const { error } = await supabase
                .from(TABLE)
                .delete()
                .in('key', [this.KEY_MAIN, this.KEY_MAPPING, this.KEY_TC_MAPPING, this.KEY_METADATA]);
            if (error) throw error;
            console.log('All data cleared from Supabase');
            return true;
        } catch (e) {
            console.error('Error clearing data from Supabase:', e);
            return false;
        }
    }
};

export default Storage;
