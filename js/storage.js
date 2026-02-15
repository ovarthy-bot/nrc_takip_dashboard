import { db } from './firebase-config.js';
import { collection, doc, getDoc, setDoc, getDocs, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

            console.log(`Starting batch save for ${dataRows.length} rows...`);

            // Batch writes (Limit 500 per batch)
            const CHUNK_SIZE = 500;
            for (let i = 0; i < dataRows.length; i += CHUNK_SIZE) {
                const chunk = dataRows.slice(i, i + CHUNK_SIZE);
                const batch = writeBatch(db);

                chunk.forEach(row => {
                    // ID Generation: WO (index 1) + TaskCard (index 2)
                    // Sanitize ID to remove slashes or special chars that might break paths
                    const wo = String(row[1] || "").replace(/\//g, '-');
                    const task = String(row[2] || "").replace(/\//g, '-');
                    const id = `${wo}_${task}`;

                    if (wo && task) {
                        const rowRef = doc(db, 'records', id);
                        batch.set(rowRef, { data: row });
                    }
                });

                await batch.commit();
                console.log(`Saved batch ${i} to ${i + chunk.length}`);
            }

            return true;
        } catch (e) {
            console.error("Error saving data:", e);
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
