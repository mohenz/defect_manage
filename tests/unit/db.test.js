import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Database Integrity Test', () => {
    const usersPath = path.resolve(__dirname, '../../data/users.json');
    const defectsPath = path.resolve(__dirname, '../../data/defects.json');

    it('should have valid users.json with virtual users', () => {
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        expect(Array.isArray(users)).toBe(true);
        expect(users.length).toBeGreaterThan(0);

        const userNames = users.map(u => u.name);
        expect(userNames).toContain('김철수');
        expect(userNames).toContain('이영희');
        expect(userNames).toContain('박지성');
        expect(userNames).toContain('손흥민');
        expect(userNames).toContain('홍길동');
    });

    it('should have updated creators and assignees in defects.json', () => {
        const defects = JSON.parse(fs.readFileSync(defectsPath, 'utf8'));
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const userNames = users.map(u => u.name);

        defects.forEach(defect => {
            // Check if creator is in the valid user list (some might be old data, but new ones should match)
            if (['김철수', '이영희'].includes(defect.creator)) {
                expect(userNames).toContain(defect.creator);
            }
            if (['박지성', '손흥민'].includes(defect.assignee)) {
                expect(userNames).toContain(defect.assignee);
            }
        });

        // At least some defects should have the new virtual users
        const creators = defects.map(d => d.creator);
        const assignees = defects.map(d => d.assignee);

        expect(creators.some(name => ['김철수', '이영희'].includes(name))).toBe(true);
        expect(assignees.some(name => ['박지성', '손흥민'].includes(name))).toBe(true);
    });
});
