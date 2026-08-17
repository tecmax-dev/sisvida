import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

SCREENSHOTS = Path("/tmp/browser/payslip_review")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Auth injection (if available)
        storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
        session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
        cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

        if cookies_json:
            cookies = json.loads(cookies_json)
            for c in cookies:
                c["url"] = "http://localhost:8080"
            await context.add_cookies(cookies)

        await page.goto("http://localhost:8080")
        if storage_key and session_json:
            await page.evaluate(
                f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
            )

        # Go to payslip approvals page
        await page.goto("http://localhost:8080/dashboard/contracheques", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        await page.screenshot(path=str(SCREENSHOTS / "1_list.png"))
        
        # Check if there are "Avaliar" buttons
        evaluate_buttons = page.get_by_role("button", name="Avaliar")
        count = await evaluate_buttons.count()
        print(f"Found {count} evaluate buttons")
        
        if count > 0:
            await evaluate_buttons.first.click()
            await page.wait_for_timeout(2000)
            await page.screenshot(path=str(SCREENSHOTS / "2_modal.png"))
            
            # Check for error message or missing image
            error_msg = page.get_by_text("Arquivo não disponível")
            if await error_msg.is_visible():
                print("Error message still visible")
            else:
                print("Error message not visible")
                
            img = page.locator("img[alt='Contracheque']")
            if await img.is_visible():
                print("Image is visible")
            else:
                print("Image not visible")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
