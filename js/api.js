// API Helper Functions using Firebase Firestore
const API = {
    // Generic GET request
    async get(table, params = {}) {
        try {
            const collectionRef = db.collection(table);
            let query = collectionRef;

            // Apply limit if specified
            if (params.limit) {
                query = query.limit(parseInt(params.limit));
            }

            // Apply search filter if specified
            if (params.search && params.searchField) {
                query = query.where(params.searchField, '>=', params.search)
                             .where(params.searchField, '<=', params.search + '\uf8ff');
            }

            // Apply sorting if specified
            if (params.sort) {
                const direction = params.sortOrder === 'desc' ? 'desc' : 'asc';
                query = query.orderBy(params.sort, direction);
            }

            const snapshot = await query.get();
            const data = [];
            snapshot.forEach(doc => {
                data.push({ id: doc.id, ...doc.data() });
            });

            return {
                data: data,
                total: data.length,
                page: params.page || 1,
                limit: params.limit || 100
            };
        } catch (error) {
            console.error('API.get error:', error);
            throw error;
        }
    },

    // Get single record
    async getById(table, id) {
        try {
            if (!id) {
                throw new Error('ID is required for getById');
            }
            const doc = await db.collection(table).doc(id).get();
            if (!doc.exists) {
                throw new Error('Record not found');
            }
            return { id: doc.id, ...doc.data() };
        } catch (error) {
            console.error('API.getById error:', error);
            throw error;
        }
    },

    // Create new record
    async create(table, data) {
        try {
            const docRef = await db.collection(table).add({
                ...data,
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            const doc = await docRef.get();
            return { id: doc.id, ...doc.data() };
        } catch (error) {
            console.error('API.create error:', error);
            throw error;
        }
    },

    // Update record (full update)
    async update(table, id, data) {
        try {
            await db.collection(table).doc(id).set({
                ...data,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: false });
            return await this.getById(table, id);
        } catch (error) {
            console.error('API.update error:', error);
            throw error;
        }
    },

    // Partial update
    async patch(table, id, data) {
        try {
            await db.collection(table).doc(id).update({
                ...data,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            return await this.getById(table, id);
        } catch (error) {
            console.error('API.patch error:', error);
            throw error;
        }
    },

    // Delete record (soft delete)
    async delete(table, id) {
        try {
            await db.collection(table).doc(id).update({
                deleted: true,
                deleted_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            console.error('API.delete error:', error);
            throw error;
        }
    },

    // Query with custom filters
    async query(table, filters = []) {
        try {
            let query = db.collection(table);

            filters.forEach(filter => {
                query = query.where(filter.field, filter.operator, filter.value);
            });

            const snapshot = await query.get();
            const data = [];
            snapshot.forEach(doc => {
                data.push({ id: doc.id, ...doc.data() });
            });

            return data;
        } catch (error) {
            console.error('API.query error:', error);
            throw error;
        }
    }
};

    },

    // Get all records (alias for get with no limit)
    async getAll(table) {
        try {
            const snapshot = await db.collection(table).get();
            const data = [];
            snapshot.forEach(doc => {
                data.push({ id: doc.id, ...doc.data() });
            });
            return data;
        } catch (error) {
            console.error('API.getAll error:', error);
            throw error;
        }
    }
};

// API Helper Functions using Firebase Firestore
const API = {
    // Generic GET request
    async get(table, params = {}) {
        try {
            const collectionRef = db.collection(table);
            let query = collectionRef;

            // Apply limit if specified
            if (params.limit) {
                query = query.limit(parseInt(params.limit));
            }

            // Apply search filter if specified
            if (params.search && params.searchField) {
                query = query.where(params.searchField, '>=', params.search)
                             .where(params.searchField, '<=', params.search + '\uf8ff');
            }

            // Apply sorting if specified
            if (params.sort) {
                const direction = params.sortOrder === 'desc' ? 'desc' : 'asc';
                query = query.orderBy(params.sort, direction);
            }

            const snapshot = await query.get();
            const data = [];
            snapshot.forEach(doc => {
                data.push({ id: doc.id, ...doc.data() });
            });

            return {
                data: data,
                total: data.length,
                page: params.page || 1,
                limit: params.limit || 100
            };
        } catch (error) {
            console.error('API.get error:', error);
            throw error;
        }
    },

    // Get single record
    async getById(table, id) {
        try {
            if (!id) {
                throw new Error('ID is required for getById');
            }
            const doc = await db.collection(table).doc(id).get();
            if (!doc.exists) {
                throw new Error('Record not found');
            }
            return { id: doc.id, ...doc.data() };
        } catch (error) {
            console.error('API.getById error:', error);
            throw error;
        }
    },

    // Create new record
    async create(table, data) {
        try {
            const docRef = await db.collection(table).add({
                ...data,
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            const doc = await docRef.get();
            return { id: doc.id, ...doc.data() };
        } catch (error) {
            console.error('API.create error:', error);
            throw error;
        }
    },

    // Update record (full update)
    async update(table, id, data) {
        try {
            await db.collection(table).doc(id).set({
                ...data,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: false });
            return await this.getById(table, id);
        } catch (error) {
            console.error('API.update error:', error);
            throw error;
        }
    },

    // Partial update
    async patch(table, id, data) {
        try {
            await db.collection(table).doc(id).update({
                ...data,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            return await this.getById(table, id);
        } catch (error) {
            console.error('API.patch error:', error);
            throw error;
        }
    },

    // Delete record (soft delete)
    async delete(table, id) {
        try {
            await db.collection(table).doc(id).update({
                deleted: true,
                deleted_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            console.error('API.delete error:', error);
            throw error;
        }
    },

    // Query with custom filters
    async query(table, filters = []) {
        try {
            let query = db.collection(table);

            filters.forEach(filter => {
                query = query.where(filter.field, filter.operator, filter.value);
            });

            const snapshot = await query.get();
            const data = [];
            snapshot.forEach(doc => {
                data.push({ id: doc.id, ...doc.data() });
            });

            return data;
        } catch (error) {
            console.error('API.query error:', error);
            throw error;
        }
    },

    // Get all records (no limit)
    async getAll(table) {
        try {
            const snapshot = await db.collection(table).get();
            const data = [];
            snapshot.forEach(doc => {
                data.push({ id: doc.id, ...doc.data() });
            });
            return data;
        } catch (error) {
            console.error('API.getAll error:', error);
            throw error;
        }
    }
};

console.log('✅ Firebase API helper loaded');
