const { test, expect } = require('@playwright/test');

test('ZeroMart test bench should load', async ({ page }) => {
    await page.goto('/test_view/test_view.html');
    await expect(page.locator('.store-name')).toContainText('ZeroStore Online');
    console.log('ZeroMart page loaded successfully.');
});
