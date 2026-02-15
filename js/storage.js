import { db } from './firebase-config.js';
import { collection, getDocs, doc, writeBatch, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const COLLECTION_NAME = 'nrc_data';

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

    // Save batch of documents (Used during import)
    // We treat WO_TaskCard as the unique ID: row[0] + "_" + row[1]
    saveBatch: async function (rows) {
        if (!rows || rows.length === 0) return;

        const batchSize = 450; // Firestore limit is 500, keeping safety margin
        const chunks = [];

        for (let i = 0; i < rows.length; i += batchSize) {
            chunks.push(rows.slice(i, i + batchSize));
        }

        let totalSaved = 0;

        for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(row => {
                const key = `${row[0]}_${row[1]}`;
                // We wrap the array in an object because Firestore stores documents as objects
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

    // Update Single Row (Used for Notes)
    updateRow: async function (row) {
        try {
            const key = `${row[0]}_${row[1]}`;
            const docRef = doc(db, COLLECTION_NAME, key);
            await updateDoc(docRef, { row: row });
            console.log("Document updated with note");
            return true;
        } catch (e) {
            console.error("Error updating document: ", e);
            return false;
        }
    },

    // Clear Collection (Optional, currently not used in UI but good to have)
    clear: async function () {
        // Deleting entire collection from client is expensive/complex (requires recursive delete or listing all IDs).
        // skipping for now or implementing if needed.
        console.warn("Clear not implemented for Firestore");
    }
};

export default Storage;
