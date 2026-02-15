import { db } from './firebase-config.js';
import { collection, getDocs, doc, writeBatch, updateDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const COLLECTION_NAME = 'nrc_data';
const MAP_COLLECTION = 'nrc_aircraft_map';
const META_COLLECTION = 'nrc_metadata';

const Storage = {
    // Fetch all documents
    fetchAll: async function () {
        try {
            const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
            const data = [];
            querySnapshot.forEach((doc) => {
                data.push(doc.data().row);
            });
            console.log(`Fetched ${data.length} records from Firestore`);
            return data;
        } catch (e) {
            console.error("Error getting documents: ", e);
            return [];
        }
    },

    // Save batch of documents (Import)
    saveBatch: async function (rows) {
        if (!rows || rows.length === 0) return;

        const batchSize = 450;
        const chunks = [];

        for (let i = 0; i < rows.length; i += batchSize) {
            chunks.push(rows.slice(i, i + batchSize));
        }

        let totalSaved = 0;

        for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(row => {
                const key = `${row[0]}_${row[1]}`;
                const docRef = doc(db, COLLECTION_NAME, key);
                batch.set(docRef, { row: row }, { merge: true });
            });

            try {
                await batch.commit();
                totalSaved += chunk.length;
                console.log(`Saved batch of ${chunk.length} items.`);
            } catch (e) {
                console.error("Error executing batch: ", e);
            }
        }
        return totalSaved;
    },

    // Update Single Row (Notes)
    updateRow: async function (row) {
        try {
            const key = `${row[0]}_${row[1]}`;
            const docRef = doc(db, COLLECTION_NAME, key);
            await updateDoc(docRef, { row: row });
            return true;
        } catch (e) {
            console.error("Error updating document: ", e);
            return false;
        }
    },

    // Aircraft Map
    fetchAircraftMap: async function () {
        try {
            const querySnapshot = await getDocs(collection(db, MAP_COLLECTION));
            const map = {};
            querySnapshot.forEach((doc) => {
                map[doc.id] = doc.data().plane;
            });
            return map;
        } catch (e) {
            console.error("Error getting aircraft map: ", e);
            return {};
        }
    },

    saveAircraftMap: async function (wo, plane) {
        try {
            const docRef = doc(db, MAP_COLLECTION, String(wo));
            await setDoc(docRef, { plane: plane });
            return true;
        } catch (e) {
            console.error("Error saving aircraft map: ", e);
            return false;
        }
    },

    // Metadata (Import Time)
    saveMetadata: async function (info) {
        try {
            const docRef = doc(db, META_COLLECTION, 'import_info');
            await setDoc(docRef, info);
        } catch (e) {
            console.error("Error saving metadata: ", e);
        }
    },

    getMetadata: async function () {
        try {
            const docRef = doc(db, META_COLLECTION, 'import_info');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data();
            }
            return null;
        } catch (e) {
            console.error("Error getting metadata: ", e);
            return null;
        }
    },

    clear: async function () {
        console.warn("Clear not implemented for Firestore");
    }
};

export default Storage;
