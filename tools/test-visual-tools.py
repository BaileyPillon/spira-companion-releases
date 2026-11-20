"""Exercise the four visual tools through the companion menu using captured PS2 frames."""
import argparse
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--assets", type=Path, default=Path(__file__).resolve().parents[1] / "app/assets")
parser.add_argument("--ffx-frame", type=Path, required=True)
parser.add_argument("--x2-frame", type=Path, required=True)
parser.add_argument("--screenshots", type=Path)
args = parser.parse_args()
ffx, x2 = [json.loads(path.read_text(encoding="utf-8-sig")) for path in (args.ffx_frame, args.x2_frame)]

with sync_playwright() as pw:
    browser = pw.chromium.launch(channel="chrome")
    for width, height in [(350, 420), (620, 465), (900, 675)]:
        page = browser.new_page(viewport={"width": width, "height": height})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto((args.assets.resolve() / "index.html").as_uri())
        main = page.locator("main")

        def feed(frame):
            page.evaluate("(f) => Spira.update({...f,timestamp:Date.now()},false)", frame)

        def visit(tool):
            page.get_by_role("button", name="All tools", exact=True).click()
            page.locator(f'[data-shell-key="open-{tool}"]').click()

        def fit():
            assert main.evaluate("el => el.scrollWidth <= el.clientWidth + 1"), (width, "content overflow")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), (width, "window overflow")

        def shot(view, start):
            fit()
            if args.screenshots and width == 620:
                args.screenshots.mkdir(parents=True, exist_ok=True)
                start.evaluate("el => el.scrollIntoView({block:'start'})")
                page.screenshot(path=args.screenshots / f"{view}.png")

        feed(ffx)
        visit("grid")
        node = page.get_by_label("Grid node", exact=True)
        # Compare the reference contents with an edited live node and two party activation bits.
        for layout in ("standard", "expert"):
            grid = page.evaluate("(key)=>ffxData[key].nodes.map(n=>n[2].toString(16).padStart(2,'0')+'00').join('')", layout)
            frame = dict(ffx, grid="0d06" + grid[4:])
            feed(frame)
            node.select_option("0")
            name = main.locator(".node-inspector")
            expect(name).to_contain_text("Original layout")
            expect(name).to_contain_text("Magic +4")
            expect(name).to_contain_text("Yuna, Auron")
            if not name.locator(".node-remotes").evaluate("el => el.open"):
                name.get_by_text("Activate from anywhere").click()
            expect(name.get_by_role("button", name="Find Attribute Sphere")).to_be_visible()
            if layout == "standard":
                main.get_by_text("Read the symbols", exact=True).click()
                expect(main.locator(".node-symbols li")).to_have_count(7)
            before = page.evaluate("JSON.stringify([...gridViews.values()].at(-1))")
            feed(dict(frame, items=frame["items"] + [[8267, 1]]))
            assert page.evaluate("JSON.stringify([...gridViews.values()].at(-1))") == before
            expect(node).to_have_value("0")
            name.get_by_role("button", name="Find Attribute Sphere").click()
            main.get_by_role("button", name="Back to Sphere Grid").click()
            expect(node).to_have_value("0")
        feed(ffx)
        origin = ffx["gridPositions"][0]
        node.select_option(str(origin))
        shot("sphere-grid", main.locator(".grid-canvas"))
        visit("mix")
        main.get_by_text("Explore Mix by effect", exact=True).click()
        work = main.locator(".mix-explorer-body")
        work.get_by_role("button", name="Recovery", exact=True).click()
        work.get_by_label("Mix result").select_option("33")
        feed(dict(ffx, items=[[8192, 1]]))
        expect(work.locator(".mix-stock-line")).to_contain_text("Missing")
        feed(dict(ffx, items=[[8192, 2]]))
        expect(work.locator(".mix-stock-line")).to_contain_text("Enough for 1 Mix")
        expect(work.locator(".mix-equation button").first).to_contain_text("Potion")
        work.locator(".mix-equation button").first.click()
        expect(work.locator("h2")).to_have_text("Potion")
        work.get_by_role("button", name="Find Potion", exact=True).click()
        main.get_by_role("button", name="Back to Mix").click()
        expect(work.locator("h2")).to_have_text("Potion")
        work.locator(".mix-crosslinks button").first.click()
        expect(work).to_contain_text("Using Potion")
        work.get_by_role("button", name="Back one step").click()
        expect(work.locator("h2")).to_have_text("Potion")
        work.get_by_role("button", name="Back one step").click()
        expect(work.locator("h2")).to_have_text("Ultra Potion")
        work.get_by_role("button", name="Next", exact=True).click()
        expect(work.locator(".recipe-pager")).to_contain_text("Pair 2")
        feed(ffx)
        shot("mix-explorer", work)
        feed(x2)
        visit("equip")
        main.locator(".garment-grid-guide > summary").click()
        main.get_by_role("button", name="Rehearse spherechanges").click()
        practice = main.locator(".garment-practice")
        # Choose an occupied outer slot so a single step crosses a gate in the recorded grid.
        main.get_by_label("Starting slot").select_option("0")
        expect(practice).to_contain_text("Practice")
        available = main.locator(".garment-pins button:enabled")
        available.first.click()
        expect(practice.get_by_role("button", name="Undo step")).to_be_enabled()
        practice.get_by_role("button", name="Undo step").click()
        expect(practice.get_by_role("button", name="Undo step")).to_be_disabled()
        gate = practice.locator(".practice-moves button").filter(has_text="gate").first
        gate.click()
        expect(practice.locator(".practice-bonus")).to_be_visible()
        shot("garment-grid", main.locator(".garment-stage"))
        practice.get_by_role("button", name="Start over").click()
        expect(practice.get_by_role("button", name="Undo step")).to_be_disabled()
        main.get_by_role("button", name="Return to route").click()
        expect(main.get_by_label("Ending slot")).to_be_visible()
        visit("chapter-checklist")
        main.locator(".chapter-board > summary").click()
        board = main.locator(".chapter-board")
        for chapter in range(1, 6):
            board.get_by_label("Destination board chapter").select_option(str(chapter))
            assert board.locator(".destination-list button").count() >= 1
            board.locator(".destination-list button").filter(has_text="Celsius").click()
            board.locator(".destination-check > summary").first.click()
            expect(board.locator(".destination-check[open] p").first).to_be_visible()
            board.get_by_role("button", name="All destinations").click()
        shot("destination-board", board.locator(".destination-list"))
        board.get_by_label("Include conditional routes").uncheck()
        expect(board.locator(".destination-list button").first).to_be_visible()
        page.locator("#display-settings").click()
        page.get_by_label("Text size").select_option("200")
        page.locator("#shell-dialog").get_by_role("button", name="Close", exact=True).click()
        fit()
        visit("equip")
        guide = main.locator(".garment-grid-guide")
        if not guide.evaluate("el => el.open"):
            guide.locator("summary").first.click()
        main.get_by_role("button", name="Rehearse spherechanges").click()
        fit()
        pin = main.locator(".garment-pins button:enabled").first
        assert pin.bounding_box()["width"] >= 44
        pin.click()
        expect(main.get_by_role("button", name="Undo step")).to_be_enabled()
        feed(ffx)
        visit("grid")
        node.select_option(str(origin))
        fit()
        visit("mix")
        if not main.locator(".mix-explorer").evaluate("el => el.open"):
            main.get_by_text("Explore Mix by effect", exact=True).click()
        fit()
        main.locator(".mix-equation button").first.click()
        fit()
        assert not errors, errors
        page.close()
    browser.close()
print("Visual tools passed at 350, 620 and 900 px using recorded FFX and FFX-2 data and controlled node/inventory changes.")
