/**
 * Supabase Data Persistence Service
 */

console.log("[Storage] Initializing Supabase Client with URL:", CONFIG.SUPABASE_URL);
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

const StorageService = {
    /**
     * Helper: Get KST ISO string with offset (+09:00)
     */
    /**
     * Helper: Get standard UTC ISO string
     */
    getISO() {
        return new Date().toISOString();
    },

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

    /**
     * Helper: Convert DataURL (Base64) to Blob
     */
    dataURLtoBlob(dataurl) {
        var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    },

    /**
     * Upload Image to Supabase Storage
     */
    async uploadImage(dataUrl, fileName) {
        try {
            const blob = this.dataURLtoBlob(dataUrl);
            const ext = blob.type.split('/')[1] || 'png';
            const path = `defect_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

            const { data, error } = await supabaseClient.storage
                .from('defect-images')
                .upload(path, blob, {
                    contentType: blob.type,
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            const { data: urlData } = supabaseClient.storage
                .from('defect-images')
                .getPublicUrl(data.path);

            return urlData.publicUrl;
        } catch (err) {
            console.error("[Storage] Image upload failed:", err);
            return null;
        }
    },

    async saveDefect(payload, id = null) {
        console.log(`[Storage] Saving defect (${id ? 'Update' : 'New'})...`, payload);
        const now = this.getISO();

        try {
            // If screenshot is a new DataURL (Base64), upload it to Storage first
            if (payload.screenshot && payload.screenshot.startsWith('data:image')) {
                console.log("[Storage] New image detected, uploading to Supabase Storage...");
                const publicUrl = await this.uploadImage(payload.screenshot, `defect_${id || 'new'}`);
                if (publicUrl) {
                    payload.screenshot = publicUrl;
                    console.log("[Storage] Image uploaded. URL:", publicUrl);
                } else {
                    console.warn("[Storage] Image upload failed, falling back to original payload (Base64 might be stored or image lost)");
                }
            }

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
                // Ensure unique numeric ID
                const numericId = parseInt(payload.defect_id) || Date.now();

                const { error } = await supabaseClient
                    .from('defects')
                    .insert([{
                        ...payload,
                        defect_id: numericId,
                        status: payload.status || 'New',
                        created_at: now,
                        updated_at: null
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
        const now = this.getISO();

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
                    updated_at: null
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
