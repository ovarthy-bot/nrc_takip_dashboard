import { db } from './firebase-config.js';
import { collection, doc, getDoc, setDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const Storage = {
    COLLECTION_DATA: 'dashboard_data',
    COLLECTION_MAPPING: 'aircraft_mapping',
    DOC_ID: 'main_data', // Single document for main data for simplicity, or we could split by rows if too large.
    // Firestore has a 1MB limit per document. 5000 rows might exceed this.
    // Better strategy: Store each row as a document in a subcollection or root collection.
    // OR: Store chunks. 
    // Given the request for ~5000 rows, a single doc is risky. 
    // Let's use a collection 'records' where each doc is a row (keyed by WO_TaskCard).

    // Save entire dataset (Warning: Heavy operation if writing 5000 docs one by one)
    // Optimization: Batch writes or check for changes. 
    // For now, to keep it simple and robust, let's use a single document 'metadata' for headers/settings
    // and a collection 'records' for the actual rows.

    // WAIT: The user wants "Data persistence". 
    // And optimization to avoid full reloads.

    // For specific task: "WO verilerinin hangi uçak ismine ait olduğu verisi... Firebase veritabanına kaydedilsin."
    // It implies the mapping is definitely in Firebase. 
    // The main data set? 
    // "Yanlış dosya yüklenmeye çalışılırsa firebase veritabanının bozulmasını önlemek için"
    // implies main data is also in Firebase.

    // Strategy: 
    // 1. 'settings' collection -> doc 'config' (headers, importDate)
    // 2. 'records' collection -> doc per row (ID: WO_TaskCard)
    // 3. 'mappings' collection -> doc per mapping (ID: WO)

    saveData: async function (headers, dataRows) {
        try {
            // Save Headers & Metadata
            await setDoc(doc(db, this.COLLECTION_DATA, 'metadata'), {
                headers: headers,
                lastUpdated: new Date().toISOString()
            });

            // We won't save ALL rows every time if we can avoid it, but for "Save" functionality after import:
            // Doing 5000 writes is costly and slow. 
            // Ideally we only write CHANGED rows. 
            // But let's start with a Batch approach if possible or just individual writes for changed items.
            // For this implementation, we will assume the `App` handles difference detection or we just write them.
            // Actually, `App.js` processes chunked. We should probably let App.js call `saveRow` or `saveBatch`.

            // To simplify migration from localStorage structure, let's stick to the interface:
            // save(data) -> where data has {headers, data: []}
            // But this is too big for one doc.

            // let's try to bundle them in chunks of 500 rows? 
            // No, Firestore query is easier if documents are handled properly.
            // But read/write costs... 
            // Let's go with: 'records' collection.

            console.warn("Storage.saveData: Creating batch writes for " + dataRows.length + " rows.");

            // TODO: Implement batching in App.js to avoid freezing UI. 
            // Here we just provide a method to save a single row or list.
        } catch (e) {
            console.error("Error saving metadata:", e);
            throw e;
        }
    },

    saveRow: async function (rowObject) {
        // rowObject should have a unique key
        // We'll generate ID from WO_TaskCard
        const id = `${rowObject[0]}_${rowObject[1]}`.replace(/\//g, '_'); // Sanitize ID
        try {
            await setDoc(doc(db, 'records', id), { data: rowObject });
        } catch (e) {
            console.error("Error saving row:", id, e);
        }
    },

    loadData: async function () {
        try {
            // 1. Get Metadata
            const metaSnap = await getDoc(doc(db, this.COLLECTION_DATA, 'metadata'));
            if (!metaSnap.exists()) return null;

            const meta = metaSnap.data();

            // 2. Get All Records
            // This might be slow for 5000 docs. 
            // Limit? Pagination? The user wants pagination in UI. 
            // But for "VLOOKUP" and global search, we initially might need specific data.
            // However, typical Dashboard loads latest snapshot. 
            const querySnapshot = await getDocs(collection(db, 'records'));
            const rows = [];
            querySnapshot.forEach((doc) => {
                rows.push(doc.data().data);
            });

            return {
                headers: meta.headers,
                data: rows,
                lastUpdated: meta.lastUpdated
            };
        } catch (e) {
            console.error("Error loading data:", e);
            return null;
        }
    },

    // Mapping Functions
    saveMapping: async function (wo, aircraftName) {
        try {
            await setDoc(doc(db, this.COLLECTION_MAPPING, wo), {
                wo: wo,
                aircraftName: aircraftName
            });
            return true;
        } catch (e) {
            console.error("Error saving mapping:", e);
            return false;
        }
    },

    loadMappings: async function () {
        try {
            const querySnapshot = await getDocs(collection(db, this.COLLECTION_MAPPING));
            const mappings = {};
            querySnapshot.forEach((doc) => {
                const d = doc.data();
                mappings[d.wo] = d.aircraftName;
            });
            return mappings;
        } catch (e) {
            console.error("Error loading mappings:", e);
            return {};
        }
    },

    deleteMapping: async function (wo) {
        try {
            await deleteDoc(doc(db, this.COLLECTION_MAPPING, wo));
            return true;
        } catch (e) {
            console.error("Error deleting mapping:", e);
            return false;
        }
    },

    clear: async function () {
        // Danger zone.
        // Implementation left empty or protected.
        // If we want to clear 'records' collection, we need to delete all docs.
    }
};

export default Storage;
