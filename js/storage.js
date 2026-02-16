// Firebase Storage Module
import { db, doc, setDoc, getDoc, collection, getDocs, writeBatch } from './firebase-config.js';

const Storage = {
    COLLECTION: 'dashboard_data',
    DOC_MAIN: 'main_data',
    DOC_MAPPING: 'aircraft_mapping',
    DOC_METADATA: 'metadata',

    // Save main dashboard data
    save: async function (data) {
        try {
            const docRef = doc(db, this.COLLECTION, this.DOC_MAIN);
            await setDoc(docRef, {
                headers: data.headers,
                data: data.data,
                lastUpdated: new Date().toISOString()
            });
            console.log('Data saved to Firebase');
            return true;
        } catch (e) {
            console.error('Error saving data to Firebase:', e);
            alert('Veri kaydedilirken hata oluştu: ' + e.message);
            return false;
        }
    },

    // Load main dashboard data
    load: async function () {
        try {
            const docRef = doc(db, this.COLLECTION, this.DOC_MAIN);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log('Data loaded from Firebase');
                return {
                    headers: data.headers,
                    data: data.data
                };
            } else {
                console.log('No data found in Firebase');
                return null;
            }
        } catch (e) {
            console.error('Error loading data from Firebase:', e);
            return null;
        }
    },

    // Save aircraft mapping (WO -> Aircraft Name)
    saveMapping: async function (mappingData) {
        try {
            const docRef = doc(db, this.COLLECTION, this.DOC_MAPPING);
            await setDoc(docRef, {
                mapping: mappingData,
                lastUpdated: new Date().toISOString()
            });
            console.log('Mapping data saved to Firebase');
            return true;
        } catch (e) {
            console.error('Error saving mapping to Firebase:', e);
            alert('Eşleştirme verileri kaydedilirken hata oluştu: ' + e.message);
            return false;
        }
    },

    // Load aircraft mapping
    loadMapping: async function () {
        try {
            const docRef = doc(db, this.COLLECTION, this.DOC_MAPPING);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                console.log('Mapping data loaded from Firebase');
                return docSnap.data().mapping || {};
            } else {
                console.log('No mapping data found');
                return {};
            }
        } catch (e) {
            console.error('Error loading mapping from Firebase:', e);
            return {};
        }
    },

    // Save metadata (import timestamp, stats)
    saveMetadata: async function (metadata) {
        try {
            const docRef = doc(db, this.COLLECTION, this.DOC_METADATA);
            await setDoc(docRef, {
                ...metadata,
                lastUpdated: new Date().toISOString()
            });
            console.log('Metadata saved to Firebase');
            return true;
        } catch (e) {
            console.error('Error saving metadata to Firebase:', e);
            return false;
        }
    },

    // Load metadata
    loadMetadata: async function () {
        try {
            const docRef = doc(db, this.COLLECTION, this.DOC_METADATA);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                console.log('Metadata loaded from Firebase');
                return docSnap.data();
            } else {
                return null;
            }
        } catch (e) {
            console.error('Error loading metadata from Firebase:', e);
            return null;
        }
    },

    // Clear all data (for testing purposes)
    clear: async function () {
        try {
            const batch = writeBatch(db);

            const mainRef = doc(db, this.COLLECTION, this.DOC_MAIN);
            const mappingRef = doc(db, this.COLLECTION, this.DOC_MAPPING);
            const metadataRef = doc(db, this.COLLECTION, this.DOC_METADATA);

            batch.delete(mainRef);
            batch.delete(mappingRef);
            batch.delete(metadataRef);

            await batch.commit();
            console.log('All data cleared from Firebase');
            return true;
        } catch (e) {
            console.error('Error clearing data from Firebase:', e);
            return false;
        }
    }
};

export default Storage;
