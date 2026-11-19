"""Drive both games' 1.40 tools through their normal entry points."""
import argparse
import base64
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--ffx-frame", type=Path)
parser.add_argument("--x2-frame", type=Path)
parser.add_argument("--screenshots", type=Path)
args = parser.parse_args()

with sync_playwright() as pw:
    browser = pw.chromium.launch(channel="chrome")
    for width in (350, 620, 900):
        page = browser.new_page(viewport={"width": width, "height": 680})
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.goto((root / "app/assets/index.html").as_uri())
        main = page.locator("main")

        def feed(data):
            page.evaluate("(f) => Spira.update({...f,timestamp:Date.now()},false)", data)

        def button(name):
            return main.get_by_role("button", name=name, exact=True)

        def nav(tab):
            page.locator(f'nav [data-tab="{tab}"]').click()

        def snapshot(name):
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            assert main.evaluate("el => el.scrollWidth <= el.clientWidth + 1"), (name, width, "panel overflow")
            if args.screenshots:
                args.screenshots.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=args.screenshots / f"{name}-{width}.png")

        common = dict(schema=1, status="live", gil=3000, battles=89, items=[], room=125, battle=False)
        member = dict(id=0, hp=400, maxHp=800, mp=10, maxMp=40, active=True, gear=[], attributes=[20]*8)
        ffx = dict(common, game="x", disc="SLPS-25088", crc="658597E2", grid=["0000"*900]*7,
                   gridPositions=[0]*7, arena="00"*640, party=[member], story=2000, progress={})
        x2 = dict(common, game="x2", disc="SLUS-20672", crc="48FE0C71", chapter=5,
                  storyFlags=base64.b64encode(bytes(0x2868)).decode(), party=[member])
        if args.ffx_frame:
            ffx = json.loads(args.ffx_frame.read_text(encoding="utf-8-sig"))
        if args.x2_frame:
            x2 = json.loads(args.x2_frame.read_text(encoding="utf-8-sig"))

        feed(ffx)
        nav("prep")
        button("Boss hit planner").click()
        main.get_by_label("Opponent").select_option("343")
        main.get_by_label("Aim stacks").select_option("5")
        assert main.get_by_text("Dark Mindy", exact=False).count()
        assert "/101 successful rolls" in main.inner_text()
        main.get_by_label("Opponent").select_option("340")
        main.get_by_label("Hit goal").select_option("95")
        assert "Dark Yojimbo · " in main.locator("[role=status]").inner_text()
        snapshot("boss-odds")
        # Keep identical enemy slots as one sister falls. Follow fight must advance.
        sisters = [dict(id=341, slot=0, hp=100, maxHp=100), dict(id=343, slot=1, hp=100, maxHp=100)]
        feed({**ffx, "battle":True, "enemies":sisters})
        main.get_by_label("Opponent").select_option("live")
        assert "Dark Cindy · " in main.locator("[role=status]").inner_text()
        feed({**ffx, "battle":True, "enemies":[{**sisters[0], "hp":0}, sisters[1]]})
        assert "Dark Mindy · " in main.locator("[role=status]").inner_text()
        feed(ffx)
        button("Back to Boss Prep").click()

        nav("equip")
        button("Celestial weapon power").click()
        main.get_by_label("Weapon owner").select_option("0")
        assert "Caladbolg" in main.inner_text()
        assert main.get_by_text("At current HP", exact=True).count()
        snapshot("celestial")
        for active in (True, False):
            swapped = [{**m, "active":active} if m["id"] == 0 else m for m in ffx["party"]]
            feed({**ffx, "party":swapped, "battle":True, "enemies":sisters})
            assert button("Compare this character’s attacks").count() == int(active)

        feed(x2)
        nav("chapter-checklist")
        button("Mascot episode board").click()
        main.get_by_label("Show regions").select_option("all")
        assert main.locator("details").count() == 15
        row = main.locator("details").filter(has=page.locator("summary", has_text="Besaid"))
        row.locator("summary").click()
        row.get_by_label("Besaid outcome").select_option("concluded")
        main.get_by_label("Show regions").select_option("concluded")
        assert main.locator("details").count() == 1
        assert "0/15 regions confirmed" in main.inner_text()
        row.get_by_label("Besaid outcome").select_option("complete")
        assert "1/15 regions confirmed" in main.inner_text()
        main.get_by_label("Show regions").select_option("all")
        snapshot("mascot")

        feed({**x2, "room": 125})
        nav("status")
        button("Besaid cipher notebook").click()
        main.get_by_label("Cipher door").select_option("entrance")
        assert "In your current area" in main.inner_text()
        for place, digit in enumerate("0708", start=1):
            main.get_by_label(f"Digit {place}", exact=True).select_option(digit)
        main.get_by_label("Recheck digit 2").check()
        assert "0 7 0 8" in main.inner_text() and "1 digit to recheck" in main.inner_text()
        main.get_by_label("Cipher door").select_option("inner")
        assert main.get_by_label("Digit 1", exact=True).input_value() == ""
        main.get_by_label("Digit 1", exact=True).select_option("9")
        snapshot("besaid")

        page.reload()
        feed(x2)
        nav("challenges")
        button("Besaid cipher notebook").click()
        main.get_by_label("Cipher door").select_option("entrance")
        assert "0 7 0 8" in main.inner_text() and main.get_by_label("Recheck digit 2").is_checked()
        main.get_by_label("Cipher door").select_option("inner")
        assert main.get_by_label("Digit 1", exact=True).input_value() == "9"
        nav("chapter-checklist")
        button("Mascot episode board").click()
        assert "1/15 regions confirmed" in main.inner_text()
        feed(ffx)
        assert main.get_by_role("heading", name="Mascot episode board").count() == 0
        assert not errors, errors
        page.close()
    browser.close()
print("Boss odds, Celestial power, all 15 episodes and both cipher doors passed at 350, 620 and 900 px.")
