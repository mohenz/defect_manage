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
        const now = new Date().toISOString();

        try {
            if (id) {
                const { error } = await supabaseClient
                    .from('defects')
                    .update({ ...payload, updated_at: now })
                    .eq('defect_id', id);

                if (error) {
                    console.error("[Storage] Error updating defect:", error.message);
                    return false;
                }
                console.log("[Storage] Defect updated successfully.");
                return true;
            } else {
                // Ensure unique numeric ID if DB doesn't handle auto-increment
                const numericId = parseInt(payload.defect_id) || Date.now();

                const { error } = await supabaseClient
                    .from('defects')
                    .insert([{
                        ...payload,
                        defect_id: numericId,
                        status: payload.status || 'New',
                        created_at: now,
                        updated_at: now
                    }]);

                if (error) {
                    console.error("[Storage] Error inserting defect:", error.message);
                    alert("등록 실패: " + error.message);
                    return false;
                }
                console.log("[Storage] Defect inserted successfully.");
                return true;
            }
        } catch (err) {
            console.error("[Storage] Exception in saveDefect:", err);
            return false;
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
        const now = new Date().toISOString();

        if (id) {
            const { error } = await supabaseClient
                .from('users')
                .update({ ...payload, updated_at: now })
                .eq('user_id', id);

            if (error) console.error("[Storage] Error updating user:", error.message);
            else console.log("[Storage] User updated successfully.");
            return !error;
        } else {
            const numericId = parseInt(payload.user_id) || Date.now();
            const { error } = await supabaseClient
                .from('users')
                .insert([{
                    ...payload,
                    user_id: numericId,
                    status: payload.status || '사용',
                    created_at: now,
                    updated_at: now
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
