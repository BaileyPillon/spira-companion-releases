"""Exercise the 1.39 critic fixes through the real browser UI with synthetic frames."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
output = root / "build/review-fixes-1.39"
output.mkdir(parents=True, exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel="chrome", headless=True)
    page = browser.new_page(viewport={"width": 620, "height": 700})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto((root / "app/assets/index.html").as_uri())
    base = dict(schema=1, status="live", gil=1000, battles=30, items=[])
    actor = dict(id=0, active=True, hp=100, maxHp=1000, mp=50, maxMp=100,
                 attributes=[20] * 8, battleAttributes=[20] * 8, gear=[], commands=[], boosts=[0] * 6)
    worn = dict(type=0, equipped=True, power=16, abilities=[32786], name=0)
    upgrade = dict(type=0, equipped=False, power=16, abilities=[32787], name=0)
    ffx = dict(base, game="x", disc="SLPS-25088", crc="658597E2", room=140, story=3000,
               battle=False, progress=dict(keyItems="00" * 16, challenges=dict(
                   lightning=dict(best=0, bolts=0, dodges=0))),
               party=[dict(actor, gear=[worn, upgrade])], enemies=[])
    ffx["grid"] = page.evaluate("ffxData.standard.nodes.map(node=>node[2].toString(16).padStart(2,'0')+'00').join('')")

    def feed(value):
        page.evaluate("value => Spira.update({...value, timestamp:Date.now()}, false)", value)

    def choose(tab):
        page.evaluate("tab => choose(tab)", tab)

    # Compare owned equipment through its regular Equipment subview.
    feed(ffx)
    page.evaluate('equipmentView="optimize";choose("equip")')
    page.get_by_label("Optimize for", exact=True).select_option("ap")
    assert "Triple AP" in page.locator("main").inner_text()
    page.get_by_label("Optimize for", exact=True).select_option("capture")
    assert page.get_by_text("No owned match", exact=True).count() == 2

    # No Encounters remains active when its wearer is in reserve.
    reserve = dict(actor, id=5, active=False, gear=[dict(type=1, equipped=True, abilities=[0x801D])])
    feed({**ffx, "party": [actor, reserve]})
    page.evaluate('openChallenges("lightning")')
    assert page.get_by_text("No Encounters equipped", exact=True).count() == 1

    # Battle comparisons reject a Nul-blocked strike and an incapacitated actor.
    fire = page.evaluate('Number(Object.keys(ffxData.abilities).find(id=>ffxData.abilities[id]==="Firestrike"))')
    attacker = dict(actor, gear=[dict(worn, abilities=[fire])])
    ally = dict(actor, id=1, statusTimed=1 << 7)
    fight = {**ffx, "battle": True, "party": [attacker, ally],
             "enemies": [dict(id=119, slot=0, battleId=20, hp=32000, maxHp=32000, battleAttributes=[20] * 8)]}
    feed(fight)
    choose("battle-lab")
    page.get_by_label("Comparison target", exact=True).select_option("ally:1")
    assert page.get_by_text("A Nul effect can block this action.", exact=True).count() == 1
    feed({**fight, "party": [dict(attacker, statusTimed=1), dict(ally, statusTimed=0)]})
    assert page.get_by_text("This character cannot act while Sleep is active.", exact=True).count() == 1

    # Route progress belongs to one course attempt.
    first = page.evaluate("butterflyRouteData.central.path[0]")
    course = {**ffx, "room": 241, "fieldPlayer": dict(x=first[0], y=first[1]),
              "butterfly": dict(active=True, caught=2, actors=[])}
    feed(course)
    page.evaluate('openChallenges("butterflies")')
    page.get_by_role("button", name="Start route guidance", exact=True).click()
    assert page.evaluate("butterflyRouteRun!==null")
    feed({**course, "butterfly": dict(active=False, caught=2, actors=[])})
    assert page.evaluate("butterflyRouteRun===null")

    # Break selections cannot carry into an unobserved match phase.
    match = dict(elapsed=100, period=300, score=[0, 0], half=1, carrier=0, controlled=0, players=[])
    for index, slot in enumerate([0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13]):
        match["players"].append(dict(id=index, slot=slot, hp=800, x=index * 30, y=0,
                                    stats=dict(EN=20, PA=20, SH=20, AT=10, BL=10, CA=10, SP=60)))
    pool = {**ffx, "room": 62, "blitzMatch": match}
    feed(pool)
    page.evaluate('openBlitzView("live")')
    page.get_by_text("Compare a break attempt", exact=True).click()
    page.locator(".goal-choice input").first.check()
    assert page.evaluate("blitzBreakSlots.size") == 1
    choose("party")
    feed({**pool, "blitzMatch": {**match, "carrier": 1}})
    feed(pool)
    page.evaluate('openBlitzView("live")')
    assert page.evaluate("blitzBreakSlots.size") == 0
    page.get_by_text("Compare a break attempt", exact=True).click()
    page.locator(".goal-choice input").first.check()
    feed({**pool, "blitzMatch": None})
    assert page.evaluate("blitzBreakSlots.size") == 0
    feed(pool)
    page.get_by_text("Compare a break attempt", exact=True).click()
    page.locator(".goal-choice input").first.check()
    feed(dict(schema=1, status="waiting"))
    assert page.evaluate("blitzBreakSlots.size") == 0

    # A live inventory refresh retains the X-2 comparison controls and allows stacking.
    stats = lambda strength, magic: [0, 0, strength, 0, magic, 0, 0, 0, 0, 0]
    member = dict(id=0, dressphere=0x5001, grid=0, accessories=[0, 1], stats=[20] * 8)
    loadout = dict(party=[member], grids=[], dresspheres=[], accessories=[[1, 1]],
                   accessoryInfo=[["Old Ring", "", stats(1, 0)], ["Power Ring", "", stats(25, 0)]])
    x2 = dict(base, game="x2", disc="SLUS-20672", crc="48FE0C71", room=110, chapter=5,
              battle=False, party=[dict(actor, job=0x5001)], enemies=[], loadout=loadout)
    feed(x2)
    choose("equip")
    page.get_by_text("Compare accessories", exact=True).click()
    assert page.get_by_text("Old Ring → Power Ring", exact=True).count() == 1
    page.get_by_label("Optimize for", exact=True).select_option("magic")
    updated = {**x2, "loadout": {**loadout, "accessories": [[1, 2]]}}
    feed(updated)
    assert page.get_by_label("Optimize for", exact=True).input_value() == "magic"
    assert page.locator("details").filter(has=page.get_by_text("Compare accessories", exact=True)).evaluate("node=>node.open")

    # A Bestiary result stops claiming to match a live target as soon as it dies.
    reference = page.evaluate('x2FiendReference.find(row=>row[0]==="Yellow Elemental")[3]')
    foe = dict(slot=2, id=216, name="Yellow Elemental", hp=reference[0], maxHp=reference[0],
               maxMp=reference[1], level=reference[2])
    x2fight = {**updated, "battle": True, "enemies": [foe]}
    feed(x2fight)
    page.evaluate('openX2Bestiary(frame.enemies[0].name,frame.enemies[0])')
    assert page.get_by_text("Matches current target", exact=False).count() == 1
    feed({**x2fight, "enemies": [{**foe, "hp": 0}]})
    assert page.get_by_text("Matches current target", exact=False).count() == 0

    # One screenshot batch across the changed views and three bottom-screen widths.
    for width in [350, 620, 900]:
        page.set_viewport_size({"width": width, "height": 700})
        feed(updated)
        choose("equip")
        page.screenshot(path=str(output / f"accessories-{width}.png"))
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
        feed({**fight, "party": [dict(attacker, statusTimed=1), dict(ally, statusTimed=0)]})
        choose("battle-lab")
        page.screenshot(path=str(output / f"battle-{width}.png"))
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
        feed(pool)
        page.evaluate('openBlitzView("live")')
        page.screenshot(path=str(output / f"blitz-{width}.png"))
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    assert not errors, errors
    browser.close()

print("Browser checks passed for equipment, No Encounters, battle restrictions, course resets, Blitzball transitions and live Bestiary targets at 350/620/900 px.")
