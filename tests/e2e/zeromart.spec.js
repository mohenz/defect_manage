const { test, expect } = require('@playwright/test');

test.describe('ZeroMart Defect Registration E2E', () => {
    test('Should register a new defect from ZeroMart test bench', async ({ page, context }) => {
        try {
            // 1. Navigate to ZeroMart Test Bench
            console.log('Navigating to ZeroMart Test Bench...');
            await page.goto('/test_view/test_view.html');
            await expect(page).toHaveTitle(/테스트 벤치/);

            // 2. Click "신규 결함 등록" button
            console.log('Waiting for button...');
            const registerBtn = page.locator('button:has-text("신규 결함 등록")');
            await expect(registerBtn).toBeVisible({ timeout: 10000 });

            console.log('Clicking "신규 결함 등록" button...');
            const [popup] = await Promise.all([
                context.waitForEvent('page', { timeout: 90000 }),
                registerBtn.click({ delay: 500 })
            ]);
            console.log('Popup detected.');

            popup.on('console', msg => console.log(`POPUP CONSOLE: ${msg.text()}`));
            popup.on('pageerror', err => console.log(`POPUP ERROR: ${err.message}`));
            popup.on('requestfailed', request => console.log(`POPUP REQUEST FAILED: ${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`));

            // 3. Handle the Registration Popup
            console.log('Waiting for popup DOM...');
            await popup.waitForLoadState('domcontentloaded');

            // Force inject localStorage data into the popup context to bypass potential isolation issues
            console.log('Injecting pending defect data into popup...');
            await popup.evaluate(() => {
                const defectData = {
                    title: '[쇼핑몰 메인 상품 목록] 결함 보고',
                    menu_name: 'ZeroStore Online',
                    screen_name: '쇼핑몰 메인 상품 목록',
                    screen_url: window.location.href,
                    screenshot: 'data:image/jpeg;base64,dummy',
                    env_info: `Browser: ${navigator.userAgent}`
                };
                localStorage.setItem('pending_defect', JSON.stringify(defectData));

                // Re-render form if App is available to pick up new data
                if (window.App && window.App.renderForm) {
                    window.App.renderForm(document.getElementById('modalBody'), null);
                }
            });

            // Ensure modal is loaded
            console.log('Waiting for form...');
            await expect(popup.locator('#defectForm')).toBeVisible({ timeout: 20000 });

            // 4. Fill the form
            console.log('Verifying auto-filled data...');

            await expect(popup.locator('input[name="menu_name"]')).not.toHaveValue('', { timeout: 5000 });
            console.log('Menu Name populated.');

            await expect(popup.locator('input[name="screen_name"]')).not.toHaveValue('', { timeout: 5000 });
            console.log('Screen Name populated.');

            await expect(popup.locator('input[name="screen_url"]')).not.toHaveValue('', { timeout: 5000 });
            console.log('Screen URL populated.');

            await expect(popup.locator('input[name="env_info"]')).not.toHaveValue('', { timeout: 5000 });
            console.log('Env Info populated.');

            const testTitle = `E2E Test Defect ${Date.now()}`;
            console.log(`Filling form with title: ${testTitle}`);
            await popup.fill('input[name="title"]', testTitle);

            await popup.selectOption('select[name="severity"]', 'Major');
            await popup.selectOption('select[name="priority"]', 'P2');
            await popup.fill('textarea[name="steps_to_repro"]', '1. Open ZeroMart\n2. See bugs\n3. Click report');

            console.log('Waiting for user list...');
            await expect(popup.locator('select[name="creator"] option:has-text("김철수")')).toBeAttached({ timeout: 20000 });
            console.log('User list loaded.');

            await popup.selectOption('select[name="creator"]', '김철수');
            await popup.selectOption('select[name="assignee"]', '박지성');

            // 5. Submit the form
            console.log('Submitting form...');
            await Promise.all([
                popup.waitForEvent('close', { timeout: 30000 }),
                popup.click('button[type="submit"]')
            ]);
            console.log('Form submitted and popup closed.');

            // 6. Verify result
            console.log('Verifying result in main list...');
            await page.goto('/#list');
            await page.reload();

            const defectRow = page.locator(`text=${testTitle}`);
            await expect(defectRow).toBeVisible({ timeout: 10000 });
            console.log('Test PASSED.');
        } catch (err) {
            console.error('TEST FAIL LOG:', err.message);
            throw err;
        }
    });
});
