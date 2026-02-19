/**
 * Supabase Data Persistence Service
 */

console.log("[Storage] Initializing Supabase Client with URL:", CONFIG.SUPABASE_URL);
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

const StorageService = {
    init() {
        console.log("[Storage] StorageService ready.");
    },

    async getDefects() {
        console.log("[Storage] Requesting defects list...");
        const { data, error } = await supabaseClient
            .from('defects')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("[Storage] Error fetching defects:", error.message, error.details);
            throw error;
        }
        console.log("[Storage] Defects fetched successfully.");
        return data;
    },

    async saveDefect(payload, id = null) {
        console.log(`[Storage] Saving defect (${id ? 'Update' : 'New'})...`, payload);
        if (id) {
            const { error } = await supabaseClient
                .from('defects')
                .update({ ...payload, updated_at: new Date().toISOString() })
                .eq('defect_id', id);

            if (error) {
                console.error("[Storage] Error updating defect:", error.message);
                return false;
            }
            console.log("[Storage] Defect updated successfully.");
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
                console.error("[Storage] Error inserting defect:", error.message);
                return false;
            }
            console.log("[Storage] Defect inserted successfully.");
            return true;
        }
    },

    async deleteDefect(id) {
        console.log(`[Storage] Deleting defect #${id}...`);
        const { error } = await supabaseClient
            .from('defects')
            .delete()
            .eq('defect_id', id);

        if (error) {
            console.error("[Storage] Error deleting defect:", error.message);
            return false;
        }
        console.log("[Storage] Defect deleted successfully.");
        return true;
    },

    async getUsers() {
        console.log("[Storage] Requesting users list...");
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error("[Storage] Error fetching users:", error.message);
            throw error;
        }
        console.log("[Storage] Users fetched successfully.");
        return data;
    },

    async saveUser(payload, id = null) {
        console.log(`[Storage] Saving user (${id ? 'Update' : 'New'})...`, payload);
        if (id) {
            const { error } = await supabaseClient
                .from('users')
                .update({ ...payload, updated_at: new Date().toISOString() })
                .eq('user_id', id);

            if (error) console.error("[Storage] Error updating user:", error.message);
            else console.log("[Storage] User updated successfully.");
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

            if (error) console.error("[Storage] Error inserting user:", error.message);
            else console.log("[Storage] User inserted successfully.");
            return !error;
        }
    },

    async deleteUser(id) {
        console.log(`[Storage] Deleting user #${id}...`);
        const { error } = await supabaseClient
            .from('users')
            .delete()
            .eq('user_id', id);

        if (error) console.error("[Storage] Error deleting user:", error.message);
        else console.log("[Storage] User deleted successfully.");
        return !error;
    }
};
