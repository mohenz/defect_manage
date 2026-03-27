const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT_DIR, 'js', 'config.js');
const MENU_LIST_PATH = path.join(ROOT_DIR, 'eclub_memuList.txt');
const SCREEN_PATH_GROUP = 'SCREEN_PATH';

function readConfig() {
    const configSource = fs.readFileSync(CONFIG_PATH, 'utf8');
    const urlMatch = configSource.match(/SUPABASE_URL:\s*"([^"]+)"/);
    const keyMatch = configSource.match(/SUPABASE_KEY:\s*"([^"]+)"/);

    if (!urlMatch || !keyMatch) {
        throw new Error('js/config.js 에서 Supabase 연결 정보를 찾지 못했습니다.');
    }

    return {
        url: urlMatch[1],
        key: keyMatch[1]
    };
}

function normalizeSegment(segment = '') {
    return String(segment || '').replace(/\u3000/g, ' ').trim();
}

function normalizeScreenPath(line = '') {
    return String(line || '')
        .split('>')
        .map(normalizeSegment)
        .filter(Boolean)
        .join(' > ');
}

function buildScreenPathRecords(lines = []) {
    const records = [];
    const seen = new Set();

    lines.forEach((line) => {
        const normalized = normalizeScreenPath(line);
        if (!normalized || seen.has(normalized)) {
            return;
        }

        seen.add(normalized);
        records.push({
            group_code: SCREEN_PATH_GROUP,
            code_value: normalized,
            code_name: normalized,
            color: '#64748b',
            sort_order: records.length + 1,
            is_active: true
        });
    });

    return records;
}

async function syncScreenPathCodes() {
    const { url, key } = readConfig();
    const supabase = createClient(url, key);
    const lines = fs.readFileSync(MENU_LIST_PATH, 'utf8').split(/\r?\n/);
    const records = buildScreenPathRecords(lines);

    if (records.length === 0) {
        console.log('[seed:screen-paths] 등록할 화면 경로가 없습니다.');
        return;
    }

    const { data: existingRows, error: existingError } = await supabase
        .from('common_codes')
        .select('id, code_value, code_name, sort_order')
        .eq('group_code', SCREEN_PATH_GROUP);

    if (existingError) {
        throw existingError;
    }

    const existingMap = new Map((existingRows || []).map((row) => [row.code_value, row]));

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const record of records) {
        const existing = existingMap.get(record.code_value);

        if (!existing) {
            const { error } = await supabase.from('common_codes').insert([record]);
            if (error) throw error;
            inserted += 1;
            continue;
        }

        const needsUpdate = existing.code_name !== record.code_name || Number(existing.sort_order || 0) !== record.sort_order;
        if (!needsUpdate) {
            skipped += 1;
            continue;
        }

        const { error } = await supabase
            .from('common_codes')
            .update({
                code_name: record.code_name,
                sort_order: record.sort_order,
                color: record.color
            })
            .eq('group_code', SCREEN_PATH_GROUP)
            .eq('code_value', record.code_value);

        if (error) throw error;
        updated += 1;
    }

    console.log(`[seed:screen-paths] 완료: 총 ${records.length}건, 신규 ${inserted}건, 갱신 ${updated}건, 유지 ${skipped}건`);
}

syncScreenPathCodes().catch((error) => {
    console.error('[seed:screen-paths] 실패:', error.message);
    process.exitCode = 1;
});
