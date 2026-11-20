"""Exercise the three 1.41 tools through navigation, with fixtures or recorded PS2 frames."""
import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--assets", type=Path, default=root / "app/assets")
parser.add_argument("--ffx-frame", type=Path)
parser.add_argument("--x2-frame", type=Path)
parser.add_argument("--screenshots", type=Path)
args = parser.parse_args()
base = dict(schema=1, status="live", gil=3000, battles=89, items=[], room=125, battle=False)
party = [dict(id=0, active=True, hp=800, maxHp=800, mp=15, maxMp=20, gear=[], attributes=[20]*8)]
ffx = dict(base, game="x", disc="SLPS-25088", crc="658597E2", story=2000, grid=["0000"*900]*7,
           gridPositions=[0]*7, party=party, arena="00"*640, progress={})
x2 = dict(base, game="x2", disc="SLUS-20672", crc="48FE0C71", chapter=5, party=party)
if args.ffx_frame:
    ffx = json.loads(args.ffx_frame.read_text(encoding="utf-8-sig"))
if args.x2_frame:
    x2 = json.loads(args.x2_frame.read_text(encoding="utf-8-sig"))
with sync_playwright() as pw:
    browser = pw.chromium.launch(channel="chrome")
    for width in (350, 620, 900):
        page = browser.new_page(viewport={"width": width, "height": 680})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto((args.assets.resolve() / "index.html").as_uri())
        main = page.locator("main")
        button = lambda name: main.get_by_role("button", name=name, exact=True)
        label = main.get_by_label
        def feed(frame):
            page.evaluate("(f) => Spira.update({...f,timestamp:Date.now()},false)", frame)
        def nav(tab):
            shortcut = page.locator(f'nav [data-tab="{tab}"]')
            if shortcut.is_visible():
                shortcut.click()
            else:
                page.get_by_role("button", name="All tools", exact=True).click()
                page.locator(f'[data-shell-key="open-{tab}"]').click()
        def snapshot(name):
            main.evaluate("el => el.scrollTop = 0")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            assert main.evaluate("el => el.scrollWidth <= el.clientWidth + 1"), (name,width)
            if args.screenshots:
                args.screenshots.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=args.screenshots / f"{name}-{width}.png")
        def open_section(text):
            summary = main.locator("summary").filter(has_text=text).first
            if not summary.locator("..").evaluate("el => el.open"):
                summary.click()

        feed(ffx)
        nav("prep")
        button("Story boss coach").click()
        assert "Fight preview" in main.inner_text()
        foe = dict(id=130, hp=2000, maxHp=48000, slot=0, battleId=20)
        members = [{**m,"statusBits":2 if m.get("active") else 0} for m in ffx["party"]]
        battle = {**ffx,"party":members,"battle":True,"enemies":[foe],"turnOrder":[0,20]}
        feed(battle)
        assert "Second form on screen" in main.inner_text()
        feed({**battle, "enemies":[{**foe,"maxHp":60000}]})
        assert "Third form on screen" in main.inner_text()
        snapshot("yunalesca")
        feed({**battle, "enemies":[{**foe,"id":142,"maxHp":70000}],"items":[[8206,1]]})
        assert "Use Holy Water before Full-Life" in main.inner_text()
        feed({**battle, "enemies":[{**foe,"id":129,"maxHp":52000}]})
        assert "Fight preview" in main.inner_text()

        race = {**ffx,"battle":False,"room":290}
        feed(race)
        nav("status")
        button("Remiem race navigator").click()
        label("Race prize").select_option("4")
        assert main.locator(".race-route li").count() == 5
        for _ in range(4):
            button("Next landmark").click()
        assert "Landmark 5 of 5" in main.inner_text()
        button("Mark Pendulum ×30 collected").click()
        assert "Prize marked collected" in main.inner_text()
        label("Race prize").select_option("5")
        snapshot("remiem")
        page.reload()
        feed(race)
        nav("challenges")
        button("Remiem race navigator").click()
        assert label("Race prize").input_value() == "5"
        label("Race prize").select_option("4")
        assert "Prize marked collected" in main.inner_text()

        cave = {**x2,"chapter":5,"room":249,"battle":False}
        feed(cave)
        nav("status")
        button("Thunder Plains wall solver").click()
        assert "Inside the New Cave" in main.inner_text()
        prev,here = label("Previous screen · lower right"),label("Current wall · upper left")
        prev.fill("0")
        here.fill("4")
        label("Carry clue to wall 10").fill("7")
        open_section("Record checkpoint")
        label("Battles since entry").fill("3")
        label("Gil earned since entry").fill("80")
        button("Wall opened · save code").click()
        assert label("Wall",exact=True).input_value() == "10"
        assert prev.input_value() == "7"
        prev.fill("")
        here.fill("2")
        open_section("Insert an earlier")
        button("Insert in clue").click()
        assert main.locator("output").inner_text() == "4 + 2 = 6"
        label("Clue type").select_option("G")
        label("From checkpoint").select_option("3")
        button("Insert in clue").click()
        assert "Enter cumulative gil at wall 10" in main.locator("output").inner_text()
        open_section("Record checkpoint")
        label("Gil earned since entry").fill("95")
        assert main.locator("output").inner_text() == "19 + 2 = 21"
        snapshot("new-cave")
        page.reload()
        feed(cave)
        nav("challenges")
        button("Thunder Plains wall solver").click()
        assert prev.input_value() == "W3 + G(3,10)"
        button("Wall opened · save code").click()
        assert label("Wall",exact=True).input_value() == "11"
        label("Cave clear").select_option("2")
        assert "0/16 walls opened" in main.inner_text()
        open_section("Record checkpoint")
        label("Known wall code").fill("0")
        button("Record known code").click()
        assert "1/16 walls opened" in main.inner_text()
        label("Cave clear").select_option("1")
        assert "2/16 walls opened" in main.inner_text()
        open_section("When to start each clear")
        button("Start this clear over").click()
        button("Keep notes").click()
        assert "2/16 walls opened" in main.inner_text()
        # Reproduce a full PS2 clear from Kouli's worked example (linked in the research).
        # Its No Encounters run makes every encounter-dependent term zero.
        button("Start this clear over").click()
        button("Erase notes for this clear").click()
        puzzles = [
            (3,"3","1",4), (10,"4","68",72), (11,"53","897",950), (5,"W10","912",984),
            (1,"0","W5",984), (8,"547","W11 + 0",1497), (12,"W10 + W10","376",520),
            (13,"3570","8788",12358), (9,"0","W13",12358), (6,"W11 + W5","W11 + 6442",9326),
            (7,"W9 + 0","0",12358), (14,"W11 + W9","W1",14292), (2,"32752","0",32752),
            (15,"W6 + 0 + 0","17348 + 32567 + 0",59241), (16,"801","631",1432), (4,"1","0",1),
        ]
        for wall, first, second, code in puzzles:
            assert label("Wall",exact=True).input_value() == str(wall)
            prev.fill(first)
            here.fill(second)
            assert main.locator("output").inner_text().endswith(" = " + str(code))
            button("Wall opened · save code").click()
        assert "16/16 walls opened" in main.inner_text()
        label("Cave clear").select_option("2")
        assert "1/16 walls opened" in main.inner_text()
        assert not errors, errors
        page.close()
    browser.close()
print("Boss transitions, all race controls, cave arithmetic, corrections and resume passed at 350, 620 and 900 px.")
