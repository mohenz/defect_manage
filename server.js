const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'defects.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const IMAGES_DIR = path.join(__dirname, 'images');

app.use(express.json());
app.use(express.static('public'));
app.use('/images', express.static(IMAGES_DIR));

// SECURITY: Minimal middleware to prevent basic header sniffing
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Helper: Read DB
const readDB = (file = DATA_FILE) => {
    try {
        const data = fs.readFileSync(file, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};

// Helper: Write DB
const writeDB = (data, file = DATA_FILE) => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
};

// Helper: Ensure images directory exists
const ensureImagesDir = () => {
    if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
};

// Helper: Save data URL image to file and return public path
const saveImageDataUrl = (dataUrl, baseName) => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
        return dataUrl;
    }

    const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/);
    if (!match) return dataUrl;

    let ext = match[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    if (ext === 'svg+xml') ext = 'svg';

    const base64 = dataUrl.split(',')[1];
    if (!base64) return dataUrl;

    const safeBase = String(baseName).replace(/[^\w-]/g, '_');
    ensureImagesDir();

    let filename = `${safeBase}.${ext}`;
    let counter = 1;
    while (fs.existsSync(path.join(IMAGES_DIR, filename))) {
        filename = `${safeBase}_${counter}.${ext}`;
        counter += 1;
    }

    fs.writeFileSync(path.join(IMAGES_DIR, filename), Buffer.from(base64, 'base64'));
    return `/images/${filename}`;
};

/**
 * SECURITY: Server-side data sanitization
 */
const sanitizeData = (obj) => {
    const sanitized = {};
    for (let key in obj) {
        if (typeof obj[key] === 'string') {
            // Remove potential script tags and problematic chars
            sanitized[key] = obj[key].replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
                .trim();
        } else {
            sanitized[key] = obj[key];
        }
    }
    return sanitized;
};

// API: Get all defects
app.get('/api/defects', (req, res) => {
    res.json(readDB(DATA_FILE));
});

// API: Create defect
app.post('/api/defects', (req, res) => {
    const db = readDB(DATA_FILE);
    const newData = sanitizeData(req.body);

    const newDefect = {
        defect_id: Date.now(),
        ...newData,
        status: newData.status || 'Open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    if (newDefect.screenshot && newDefect.screenshot.startsWith('data:image')) {
        newDefect.screenshot = saveImageDataUrl(newDefect.screenshot, newDefect.defect_id);
    }

    db.unshift(newDefect);
    writeDB(db, DATA_FILE);
    res.status(201).json(newDefect);
});

// API: Update defect
app.put('/api/defects/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const db = readDB(DATA_FILE);
    const index = db.findIndex(x => x.defect_id === id);

    if (index !== -1) {
        const updateData = sanitizeData(req.body);
        if (updateData.screenshot && updateData.screenshot.startsWith('data:image')) {
            updateData.screenshot = saveImageDataUrl(updateData.screenshot, id);
        }
        db[index] = {
            ...db[index],
            ...updateData,
            updated_at: new Date().toISOString()
        };
        writeDB(db, DATA_FILE);
        res.json(db[index]);
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

// API: Delete defect
app.delete('/api/defects/:id', (req, res) => {
    const id = parseInt(req.params.id);
    let db = readDB(DATA_FILE);
    db = db.filter(x => x.defect_id !== id);
    writeDB(db, DATA_FILE);
    res.status(204).end();
});

/**
 * API: User Management
 */
app.get('/api/users', (req, res) => {
    res.json(readDB(USERS_FILE));
});

app.post('/api/users', (req, res) => {
    const db = readDB(USERS_FILE);
    const newData = sanitizeData(req.body);

    const newUser = {
        user_id: Date.now(),
        ...newData,
        status: newData.status || '사용',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    db.push(newUser);
    writeDB(db, USERS_FILE);
    res.status(201).json(newUser);
});

app.put('/api/users/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const db = readDB(USERS_FILE);
    const index = db.findIndex(x => x.user_id === id);

    if (index !== -1) {
        const updateData = sanitizeData(req.body);
        db[index] = {
            ...db[index],
            ...updateData,
            updated_at: new Date().toISOString()
        };
        writeDB(db, USERS_FILE);
        res.json(db[index]);
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

app.delete('/api/users/:id', (req, res) => {
    const id = parseInt(req.params.id);
    let db = readDB(USERS_FILE);
    db = db.filter(x => x.user_id !== id);
    writeDB(db, USERS_FILE);
    res.status(204).end();
});

app.listen(PORT, () => {
    console.log(`DefectFlow MVP Server running at http://localhost:${PORT}`);
    console.log(`Working Directory: ${__dirname}`);
});
