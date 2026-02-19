const { test, expect } = require('@playwright/test');

test.describe('DefectFlow MVP E2E Tests', () => {
    test('Dashboard should load correctly', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/DefectFlow/);
        await expect(page.locator('h1')).toContainText('결함 통계 리포트');
    });

    test('Should open register modal from Test Bench', async ({ page, context }) => {
        // Navigate to Test Bench
        await page.goto('/test_view/test_view.html');

        // Click register button and wait for popup
        const [popup] = await Promise.all([
            context.waitForEvent('page'),
            page.click('text=신규 결함 등록')
        ]);

        await popup.waitForLoadState();

        // Verify popup content
        await expect(popup.locator('h1')).toContainText('신규 결함 등록');

        // Check if auto-filled data exists (partially)
        const menuInput = await popup.locator('input[name="menu_name"]');
        await expect(menuInput).toHaveValue('ZeroStore Online');
    });
});
