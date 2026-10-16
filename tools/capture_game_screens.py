from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app" / "src" / "main" / "assets"
OUT = ROOT / "play-games-assets"
OUT.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        args=["--allow-file-access-from-files", "--no-sandbox"],
    )
    page = browser.new_page(viewport={"width": 430, "height": 932}, device_scale_factor=2, locale="en-US")
    page.goto((ASSETS / "index.html").as_uri(), wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(3500)
    page.evaluate("document.querySelectorAll('.modal-backdrop').forEach(e => e.classList.add('hidden'))")
    page.locator("#btn-home-new").click(timeout=10000)
    page.wait_for_timeout(500)
    page.locator('.diff-card-btn[data-diff="medium"]').click(timeout=10000)
    page.locator("#btn-diff-start").click(timeout=10000)
    page.wait_for_timeout(18000)
    if "active" not in (page.locator("#view-game").get_attribute("class") or ""):
        raise RuntimeError("Game view did not open")
    page.screenshot(path=str(OUT / "sumdoku-gameplay-full.png"), full_page=True)
    page.locator("#board-frame").screenshot(path=str(OUT / "sumdoku-gameplay-board.png"))
    print("Captured real app gameplay screenshots:")
    print(OUT / "sumdoku-gameplay-full.png")
    print(OUT / "sumdoku-gameplay-board.png")
    browser.close()
