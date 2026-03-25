/**
 * Supabase Data Persistence Service
 */

console.log("[Storage] Initializing Supabase Client with URL:", CONFIG.SUPABASE_URL);
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

const StorageService = {
    /**
     * Internal: Log changes to defect_history table
     */
    async logHistory(defectId, action, changedBy, details = {}, before = null, after = null) {
        try {
            const entry = {
                defect_id: defectId,
                action: action, // 'CREATE', 'UPDATE'
                status_before: before,
                status_after: after,
                changed_data: details,
                changed_by: changedBy,
                created_at: this.getISO()
            };
            await supabaseClient.from('defect_history').insert(entry);
        } catch (err) {
            console.error('[StorageService] History logging failed:', err);
        }
    },

    /**
     * Helper: Get local ISO-like string for database storage (matching Asia/Seoul DB)
     */
    getISO() {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().slice(0, -1);
    },

    init() {
        console.log("[Storage] StorageService ready.");
    },
    /**
     * Fetch all active common codes from the database
     */
    
    async fetchCommonCodes() {
        console.log("[Storage] Fetching common codes with timeout...");
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Supabase Query Timeout")), 3000);
        });

        const queryPromise = (async () => {
            try {
                const { data, error } = await supabaseClient
                    .from('common_codes')
                    .select('group_code, code_value, code_name, color, sort_order')
                    .order('group_code', { ascending: true })
                    .order('sort_order', { ascending: true });

                if (error) throw error;
                return data;
            } catch (err) {
                console.error('[Storage] Supabase error in fetchCommonCodes:', err.message);
                throw err;
            }
        })();

        try {
            return await Promise.race([queryPromise, timeoutPromise]);
        } catch (err) {
            console.warn('[Storage] fetchCommonCodes failed or timed out. Falling back to empty array.');
            return [];
        }
    },
\n
    async getDefectsSummaryForStats() {
        console.log("[Storage] Fetching stats summary with timeout...");
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Supabase Stats Timeout")), 4000); // 좀 더 넉넉하게 4초
        });

        const queryPromise = (async () => {
            try {
                const { data, error } = await supabaseClient
                    .from('defects')
                    .select('defect_id, title, status, severity, test_type, creator, created_at')
                    .eq('is_deleted', 'N');

                if (error) throw error;
                return data;
            } catch (err) {
                console.error('[Storage] Supabase stats error:', err.message);
                throw err;
            }
        })();

        try {
            return await Promise.race([queryPromise, timeoutPromise]);
        } catch (err) {
            console.warn('[Storage] getDefectsSummaryForStats failed or timed out. Falling back to empty array.');
            return [];
        }
    },
    async getDefects(page = 1, pageSize = 20, filters = {}) {
        console.log(`[Storage] Fetching defects (Page ${page})...`, filters);
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabaseClient
            .from('defects')
            .select('*', { count: 'exact' })
            .eq('is_deleted', 'N');

        if (filters.severity) query = query.eq('severity', filters.severity);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.testType) query = query.eq('test_type', filters.testType);
        if (filters.identification) query = query.eq('defect_identification', filters.identification);
        if (filters.creator) query = query.ilike('creator', `%${filters.creator}%`);
        if (filters.assignee) query = query.ilike('assignee', `%${filters.assignee}%`);
        if (filters.dateStart) query = query.gte('created_at', filters.dateStart + 'T00:00:00');
        if (filters.dateEnd) query = query.lte('created_at', filters.dateEnd + 'T23:59:59');

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error("[Storage] Error fetching defects:", error.message);
            throw error;
        }

        return { data: data || [], totalCount: count || 0 };
    },

    async getDefectById(id) {
        console.log(`[Storage] Requesting defect detail #${id}...`);
        const { data, error } = await supabaseClient
            .from('defects')
            .select('*')
            .eq('defect_id', id)
            .single();

        if (error) {
            console.error("[Storage] Error fetching defect detail:", error.message);
            throw error;
        }

        return data;
    },

    async getUsers() {
        console.log("[Storage] Fetching user list...");
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error("[Storage] Error fetching users:", error.message);
            throw error;
        }
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
                    alert("수정 실패: " + error.message);
                    return false;
                }
                console.log("[Storage] Defect updated successfully.");
                return true;
            } else {
                // Ensure unique numeric ID - REMOVED for AUTOINCREMENT
                // const numericId = parseInt(payload.defect_id) || Date.now();

                const { error } = await supabaseClient
                    .from('defects')
                    .insert([{
                        ...payload,
                        ...payload,
                        // defect_id will be auto-generated by DB
                        status: payload.status || 'Open',
                        created_at: now
                        // updated_at default is now() or null in schema? Schema says default CURRENT_TIMESTAMP
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
            alert("저장 중 오류가 발생했습니다. 콘솔 로그를 확인해 주세요.");
            return false;
        }
    },

    async deleteDefect(id) {
        console.log(`[Storage] Deleting defect #${id}...`);
        const { error } = await supabaseClient
            .from('defects')
            .update({ is_deleted: 'Y', updated_at: this.getISO() })
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

    async findUserByEmail(email) {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
            console.error("[Storage] Error finding user:", error.message);
        }
        return data;
    },

    async resetPassword(email, hashedPassword) {
        console.log(`[Storage] Resetting password for ${email}...`);
        const { error } = await supabaseClient
            .from('users')
            .update({ 
                password: hashedPassword, 
                updated_at: this.getISO(),
                needs_password_reset: false 
            })
            .eq('email', email);

        if (error) {
            console.error("[Storage] Error resetting password:", error.message);
            return false;
        }
        console.log("[Storage] Password reset successfully.");
        return true;
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
    },

    /**
     * App Settings Management (Global Persistence)
     */
    async getAppSettings() {
        console.log("[Storage] Fetching global app settings...");
        try {
            const { data, error } = await supabaseClient
                .from('app_settings')
                .select('*')
                .eq('key', 'global_config')
                .single();

            if (error) {
                if (error.code === 'PGRST116') { // Not found
                    console.log("[Storage] No settings found, using defaults.");
                    return null;
                }
                throw error;
            }
            return data.value;
        } catch (err) {
            console.error("[Storage] Error fetching app settings:", err);
            return null;
        }
    },

    async saveAppSettings(settings) {
        console.log("[Storage] Saving global app settings...", settings);
        try {
            const { data, error } = await supabaseClient
                .from('app_settings')
                .upsert({ 
                    key: 'global_config', 
                    value: settings,
                    updated_at: this.getISO()
                }, { onConflict: 'key' });

            if (error) throw error;
            console.log("[Storage] App settings saved successfully.");
            return true;
        } catch (err) {
            console.error("[Storage] Error saving app settings:", err);
            return false;
        }
    }
};
