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

        # Restore session from file
        with open(os.path.expanduser("~/.cache/lovable-auth/session.json")) as f:
            minted = json.load(f)
        storage_key = minted["storage_key"]
        session_json = json.dumps(minted["session"])
        cookies_json = json.dumps(minted["cookies"])

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
        await page.wait_for_timeout(3000)
        await page.screenshot(path=str(SCREENSHOTS / "1_list.png"))
        
        # Check for evaluate buttons
        # In the image provided by user, the button text is "Avaliar"
        evaluate_buttons = page.locator("button:has-text('Avaliar')")
        count = await evaluate_buttons.count()
        print(f"Found {count} evaluate buttons")
        
        if count > 0:
            await evaluate_buttons.first.click()
            await page.wait_for_timeout(3000)
            await page.screenshot(path=str(SCREENSHOTS / "2_modal.png"))
            
            # Check for error message or missing image
            error_msg = page.get_by_text("Arquivo não disponível")
            if await error_msg.count() > 0 and await error_msg.first.is_visible():
                print("Error message visible")
            else:
                print("Error message not visible")
                
            img = page.locator("img[alt='Contracheque']")
            if await img.count() > 0 and await img.first.is_visible():
                print("Image is visible")
            else:
                print("Image not visible")
        else:
            # Maybe it's in the union page
            await page.goto("http://localhost:8080/union/contracheques", wait_until="networkidle")
            await page.wait_for_timeout(3000)
            await page.screenshot(path=str(SCREENSHOTS / "3_union_list.png"))
            
            # Check for "Revisar" button (seen in src/pages/union/UnionPayslipApprovalsPage.tsx)
            revisar_buttons = page.locator("button:has-text('Revisar')")
            count = await revisar_buttons.count()
            print(f"Found {count} revisar buttons on union page")
            
            if count > 0:
                await revisar_buttons.first.click()
                await page.wait_for_timeout(3000)
                await page.screenshot(path=str(SCREENSHOTS / "4_union_modal.png"))
                
                # Check for image
                img = page.locator("img[alt='Contracheque']")
                if await img.count() > 0 and await img.first.is_visible():
                    print("Image is visible in union modal")
                else:
                    print("Image not visible in union modal")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
