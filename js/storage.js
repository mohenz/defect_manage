/**
 * Supabase Data Persistence Service
 */

console.log("[Storage] Initializing Supabase Client with URL:", CONFIG.SUPABASE_URL);
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
const DEFECT_SUMMARY_COLUMNS = 'defect_id, title, status, severity, defect_identification, test_type, creator, assignee';
const DEFECT_LIST_COLUMNS = 'defect_id, title, defect_identification, severity, priority, status, test_type, menu_name, screen_name, screen_url, steps_to_repro, env_info, creator, assignee, created_at, updated_at, action_comment, action_due_date, action_start, action_end';
const DEFECT_FIELD_LENGTH_HINTS = {
    title: 200,
    test_type: 50,
    severity: 20,
    priority: 10,
    status: 20,
    menu_name: 100,
    screen_name: 100,
    screen_url: 255,
    defect_identification: 50,
    creator: 50,
    assignee: 50,
    env_info: 255
};
const ACTION_RECHECK_STATUS_VALUES = ['closed', 'resolved', 'staging'];
const ACTION_RECHECK_QUERY_STATUS_VALUES = ['Closed', 'Resolved', 'Staging', 'closed', 'resolved', 'staging'];

function normalizeDefectIdFilter(defectId) {
    const normalized = String(defectId || '').trim();
    if (!normalized) return null;
    if (!/^\d+$/.test(normalized)) return null;

    const parsed = Number.parseInt(normalized, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function isBlankTextValue(value) {
    return String(value || '').trim() === '';
}

function normalizeScreenPathValue(screenPath = '') {
    return String(screenPath || '')
        .split('>')
        .map(part => part.replace(/\u3000/g, ' ').trim())
        .filter(Boolean)
        .join(' > ');
}

function parseScreenPathFilter(screenPath = '') {
    const normalized = normalizeScreenPathValue(screenPath);
    if (!normalized) {
        return {
            menuName: '',
            screenName: ''
        };
    }

    const parts = normalized.split(' > ').filter(Boolean);
    const screenName = parts.pop() || '';

    return {
        menuName: parts.join(' > '),
        screenName
    };
}

function collectOverflowCandidates(payload = {}, options = {}) {
    const exactLimit = Number.isFinite(options.exactLimit) ? Number(options.exactLimit) : null;

    return Object.entries(DEFECT_FIELD_LENGTH_HINTS)
        .map(([field, assumedLimit]) => {
            const rawValue = payload[field];
            const value = typeof rawValue === 'string' ? rawValue : String(rawValue || '');

            return {
                field,
                length: value.length,
                assumed_limit: assumedLimit
            };
        })
        .filter(candidate => candidate.length > 0)
        .filter(candidate => exactLimit
            ? candidate.assumed_limit === exactLimit && candidate.length > exactLimit
            : candidate.length > candidate.assumed_limit)
        .sort((a, b) => b.length - a.length);
}

function enrichLengthOverflowError(error = {}, payload = {}) {
    const message = error?.message || '';
    const limitMatch = message.match(/character varying\((\d+)\)/i);
    const exactLimit = limitMatch ? Number(limitMatch[1]) : null;
    const candidates = collectOverflowCandidates(payload, { exactLimit });
    const fallbackCandidates = candidates.length > 0 ? candidates : collectOverflowCandidates(payload);

    if (!exactLimit && fallbackCandidates.length === 0) {
        return error;
    }

    return {
        ...error,
        varchar_limit: exactLimit,
        overflow_candidates: fallbackCandidates
    };
}

const StorageService = {
    lastDefectSaveError: null,

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

    async saveCommonCode(payload, originalKey = null) {
        console.log('[Storage] Saving common code...', payload, originalKey);

        const normalized = {
            group_code: payload.group_code,
            code_value: payload.code_value,
            code_name: payload.code_name,
            color: payload.color || null,
            sort_order: Number(payload.sort_order || 0)
        };

        try {
            if (originalKey) {
                const { data: existingRows, error: existingError } = await supabaseClient
                    .from('common_codes')
                    .select('id')
                    .eq('group_code', originalKey.group_code)
                    .eq('code_value', originalKey.code_value);

                if (existingError) throw existingError;

                if (!existingRows || existingRows.length === 0) {
                    const { error: insertError } = await supabaseClient
                        .from('common_codes')
                        .insert([{ ...normalized, is_active: true }]);

                    if (insertError) throw insertError;
                    return true;
                }

                const { error: updateError } = await supabaseClient
                    .from('common_codes')
                    .update(normalized)
                    .eq('group_code', originalKey.group_code)
                    .eq('code_value', originalKey.code_value);

                if (updateError) throw updateError;
                return true;
            }

            const { data: duplicateRows, error: duplicateError } = await supabaseClient
                .from('common_codes')
                .select('id')
                .eq('group_code', normalized.group_code)
                .eq('code_value', normalized.code_value);

            if (duplicateError) throw duplicateError;

            if (duplicateRows && duplicateRows.length > 0) {
                const { error: updateDuplicateError } = await supabaseClient
                    .from('common_codes')
                    .update(normalized)
                    .eq('group_code', normalized.group_code)
                    .eq('code_value', normalized.code_value);

                if (updateDuplicateError) throw updateDuplicateError;
                return true;
            }

            const { error } = await supabaseClient
                .from('common_codes')
                .insert([{ ...normalized, is_active: true }]);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('[Storage] Error saving common code:', err.message);
            return false;
        }
    },

    async deleteCommonCode(groupCode, codeValue) {
        console.log(`[Storage] Deleting common code ${groupCode}/${codeValue}...`);
        try {
            const { error } = await supabaseClient
                .from('common_codes')
                .delete()
                .eq('group_code', groupCode)
                .eq('code_value', codeValue);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('[Storage] Error deleting common code:', err.message);
            return false;
        }
    },

    async getDefectsSummaryForStats() {
        console.log("[Storage] Fetching stats summary with timeout...");
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Supabase Stats Timeout")), 4000); // 좀 더 넉넉하게 4초
        });

        const queryPromise = (async () => {
            try {
                const { data, error } = await supabaseClient
                    .from('defects')
                    .select(DEFECT_SUMMARY_COLUMNS)
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
        const defectIdFilter = normalizeDefectIdFilter(filters.defectId);

        let query = supabaseClient
            .from('defects')
            .select(DEFECT_LIST_COLUMNS, { count: 'exact' })
            .eq('is_deleted', 'N');

        if (defectIdFilter !== null) query = query.eq('defect_id', defectIdFilter);
        if (filters.severity) query = query.eq('severity', filters.severity);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.title) query = query.ilike('title', `%${filters.title}%`);
        if (filters.stepsToRepro) query = query.ilike('steps_to_repro', `%${filters.stepsToRepro}%`);
        if (filters.testType) query = query.eq('test_type', filters.testType);
        if (Array.isArray(filters.enabledTestTypes) && filters.enabledTestTypes.length > 0) {
            query = query.in('test_type', filters.enabledTestTypes);
        }
        if (filters.identificationUnassigned) {
            query = query.or('defect_identification.is.null,defect_identification.eq.');
        } else if (filters.identification) {
            query = query.eq('defect_identification', filters.identification);
        }
        if (filters.screenPath) {
            const parsedScreenPath = parseScreenPathFilter(filters.screenPath);
            if (parsedScreenPath.menuName) query = query.eq('menu_name', parsedScreenPath.menuName);
            if (parsedScreenPath.screenName) query = query.eq('screen_name', parsedScreenPath.screenName);
        }
        if (filters.creator) query = query.ilike('creator', `%${filters.creator}%`);
        if (filters.assigneeUnassigned) {
            query = query.or('assignee.is.null,assignee.eq.');
        } else if (filters.assignee) {
            query = query.ilike('assignee', `%${filters.assignee}%`);
        }
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

    async getAllDefectsForExport(filters = {}) {
        console.log('[Storage] Fetching all defects for export...', filters);
        const defectIdFilter = normalizeDefectIdFilter(filters.defectId);
        let query = supabaseClient
            .from('defects')
            .select('defect_id, title, defect_identification, severity, priority, status, test_type, menu_name, screen_name, steps_to_repro, env_info, creator, assignee, created_at, updated_at, action_comment, action_due_date, action_start, action_end')
            .eq('is_deleted', 'N');

        if (defectIdFilter !== null) query = query.eq('defect_id', defectIdFilter);
        if (filters.severity) query = query.eq('severity', filters.severity);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.title) query = query.ilike('title', `%${filters.title}%`);
        if (filters.stepsToRepro) query = query.ilike('steps_to_repro', `%${filters.stepsToRepro}%`);
        if (filters.testType) query = query.eq('test_type', filters.testType);
        if (Array.isArray(filters.enabledTestTypes) && filters.enabledTestTypes.length > 0) {
            query = query.in('test_type', filters.enabledTestTypes);
        }
        if (filters.identificationUnassigned) {
            query = query.or('defect_identification.is.null,defect_identification.eq.');
        } else if (filters.identification) {
            query = query.eq('defect_identification', filters.identification);
        }
        if (filters.screenPath) {
            const parsedScreenPath = parseScreenPathFilter(filters.screenPath);
            if (parsedScreenPath.menuName) query = query.eq('menu_name', parsedScreenPath.menuName);
            if (parsedScreenPath.screenName) query = query.eq('screen_name', parsedScreenPath.screenName);
        }
        if (filters.creator) query = query.ilike('creator', `%${filters.creator}%`);
        if (filters.assigneeUnassigned) {
            query = query.or('assignee.is.null,assignee.eq.');
        } else if (filters.assignee) {
            query = query.ilike('assignee', `%${filters.assignee}%`);
        }
        if (filters.dateStart) query = query.gte('created_at', filters.dateStart + 'T00:00:00');
        if (filters.dateEnd) query = query.lte('created_at', filters.dateEnd + 'T23:59:59');

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('[Storage] Error fetching defects for export:', error.message);
            throw error;
        }

        return data || [];
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

    async saveDefect(payload, id = null) {
        console.log(`[Storage] Saving defect (${id ? 'Update' : 'New'})...`, payload);
        const now = this.getISO();
        this.lastDefectSaveError = null;

        try {
            if (payload.screenshot && payload.screenshot.startsWith('data:image')) {
                console.log("[Storage] New image detected, saving inline screenshot payload.");
            }

            if (id) {
                const { error } = await supabaseClient
                    .from('defects')
                    .update({ ...payload, updated_at: now })
                    .eq('defect_id', id);

                if (error) {
                    console.error("[Storage] Error updating defect:", error.message);
                    this.lastDefectSaveError = enrichLengthOverflowError({
                        operation: 'update',
                        stage: 'supabase.update',
                        type: 'supabase',
                        message: error.message || '결함 수정 중 오류가 발생했습니다.',
                        code: error.code || '',
                        details: error.details || '',
                        hint: error.hint || ''
                    }, payload);
                    return { ok: false, error: this.lastDefectSaveError };
                }
                console.log("[Storage] Defect updated successfully.");
                return { ok: true };
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
                    this.lastDefectSaveError = enrichLengthOverflowError({
                        operation: 'insert',
                        stage: 'supabase.insert',
                        type: 'supabase',
                        message: error.message || '결함 등록 중 오류가 발생했습니다.',
                        code: error.code || '',
                        details: error.details || '',
                        hint: error.hint || ''
                    }, payload);
                    return { ok: false, error: this.lastDefectSaveError };
                }
                console.log("[Storage] Defect inserted successfully.");
                return { ok: true };
            }
        } catch (err) {
            console.error("[Storage] Exception in saveDefect:", err);
            this.lastDefectSaveError = {
                operation: id ? 'update' : 'insert',
                stage: 'exception',
                type: 'exception',
                message: err?.message || '저장 중 예외가 발생했습니다.',
                name: err?.name || 'Error',
                stack: err?.stack || ''
            };
            return { ok: false, error: this.lastDefectSaveError };
        }
    },

    getLastDefectSaveError() {
        return this.lastDefectSaveError ? { ...this.lastDefectSaveError } : null;
    },

    normalizeDefectSaveErrorLogRow(row = {}) {
        const extra = row.extra || {};
        const payloadSummary = row.payload_summary || {};
        const creatorName = extra.creator_name || payloadSummary.creator || row.reported_by || '';
        const reporterName = extra.reporter_name || row.runtime_context?.current_user || '';

        return {
            log_id: row.client_log_id || (row.id ? `DB-${row.id}` : ''),
            central_log_id: row.id || null,
            created_at: row.created_at || '',
            operation: row.operation || '',
            defect_id: row.defect_id ?? null,
            pending_source: row.pending_source || '',
            stage: row.stage || '',
            error_type: row.error_type || '',
            message: row.message || '',
            runtime: row.runtime_context || {},
            payload_summary: payloadSummary,
            storage_error: {
                stage: row.stage || '',
                type: row.error_type || '',
                message: row.message || '',
                code: row.error_code || '',
                details: row.error_details || '',
                hint: row.error_hint || ''
            },
            extra,
            creator_name: creatorName,
            reporter_name: reporterName,
            reported_by: row.reported_by || creatorName || ''
        };
    },

    async saveDefectSaveErrorLog(logEntry = {}) {
        try {
            const creatorName = logEntry.creator_name || logEntry.payload_summary?.creator || logEntry.runtime?.current_user || '';
            const reporterName = logEntry.reporter_name || logEntry.runtime?.current_user || '';
            const payload = {
                client_log_id: logEntry.log_id || null,
                operation: logEntry.operation || 'create',
                defect_id: logEntry.defect_id ?? null,
                pending_source: logEntry.pending_source || 'manual',
                stage: logEntry.stage || logEntry.storage_error?.stage || 'submit',
                error_type: logEntry.error_type || logEntry.storage_error?.type || 'unknown',
                message: logEntry.message || logEntry.storage_error?.message || '알 수 없는 저장 오류',
                error_code: logEntry.storage_error?.code || '',
                error_details: logEntry.storage_error?.details || '',
                error_hint: logEntry.storage_error?.hint || '',
                runtime_context: logEntry.runtime || {},
                payload_summary: logEntry.payload_summary || {},
                extra: {
                    ...(logEntry.extra || {}),
                    creator_name: creatorName,
                    reporter_name: reporterName
                },
                reported_by: creatorName
            };

            const { error } = await supabaseClient
                .from('defect_save_error_logs')
                .insert([payload]);

            if (error) {
                console.error('[Storage] Error inserting defect save error log:', error.message);
                return {
                    ok: false,
                    error: {
                        message: error.message || '중앙 오류 로그 저장에 실패했습니다.',
                        code: error.code || '',
                        details: error.details || '',
                        hint: error.hint || ''
                    }
                };
            }

            return {
                ok: true,
                data: this.normalizeDefectSaveErrorLogRow({
                    ...payload,
                    created_at: this.getISO()
                })
            };
        } catch (err) {
            console.error('[Storage] Exception in saveDefectSaveErrorLog:', err);
            return {
                ok: false,
                error: {
                    message: err?.message || '중앙 오류 로그 저장 중 예외가 발생했습니다.',
                    name: err?.name || 'Error'
                }
            };
        }
    },

    async getDefectSaveErrorLogs(limit = 100) {
        const { data, error } = await supabaseClient
            .from('defect_save_error_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[Storage] Error fetching defect save error logs:', error.message);
            throw error;
        }

        return (data || []).map(row => this.normalizeDefectSaveErrorLogRow(row));
    },

    async getDefectsNeedingActionRecheck() {
        const { data, error } = await supabaseClient
            .from('defects')
            .select('defect_id, assignee, status, defect_identification, action_comment')
            .eq('is_deleted', 'N')
            .in('status', ACTION_RECHECK_QUERY_STATUS_VALUES)
            .order('defect_id', { ascending: false });

        if (error) {
            console.error('[Storage] Error fetching defects needing action recheck:', error.message);
            throw error;
        }

        return (data || []).filter(item => {
            const normalizedStatus = String(item.status || '').trim().toLowerCase();
            return ACTION_RECHECK_STATUS_VALUES.includes(normalizedStatus)
                && isBlankTextValue(item.defect_identification)
                && isBlankTextValue(item.action_comment);
        }).map(item => ({
            defect_id: item.defect_id,
            assignee: item.assignee || '',
            status: item.status || ''
        }));
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
