/**
 * Supabase Data Persistence Service
 */

const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

const StorageService = {
    init() {
        console.log("Supabase Service Initialized");
    },

    async getDefects() {
        const { data, error } = await supabaseClient
            .from('defects')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching defects:", error);
            return [];
        }
        return data;
    },

    async saveDefect(payload, id = null) {
        if (id) {
            const { error } = await supabaseClient
                .from('defects')
                .update({ ...payload, updated_at: new Date().toISOString() })
                .eq('defect_id', id);

            if (error) {
                console.error("Error updating defect:", error);
                return false;
            }
            return true;
        } else {
            const { error } = await supabaseClient
                .from('defects')
                .insert([{
                    ...payload,
                    status: payload.status || 'New',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }]);

            if (error) {
                console.error("Error inserting defect:", error);
                return false;
            }
            return true;
        }
    },

    async deleteDefect(id) {
        const { error } = await supabaseClient
            .from('defects')
            .delete()
            .eq('defect_id', id);

        if (error) {
            console.error("Error deleting defect:", error);
            return false;
        }
        return true;
    },

    async getUsers() {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error("Error fetching users:", error);
            return [];
        }
        return data;
    },

    async saveUser(payload, id = null) {
        if (id) {
            const { error } = await supabaseClient
                .from('users')
                .update({ ...payload, updated_at: new Date().toISOString() })
                .eq('user_id', id);

            return !error;
        } else {
            const { error } = await supabaseClient
                .from('users')
                .insert([{
                    ...payload,
                    status: payload.status || '사용',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }]);

            return !error;
        }
    },

    async deleteUser(id) {
        const { error } = await supabaseClient
            .from('users')
            .delete()
            .eq('user_id', id);

        return !error;
    }
};
