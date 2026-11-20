"""Replay the menu, progress boards, checkpoints and both fiend indexes at Thor sizes."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

argspec = argparse.ArgumentParser(description=__doc__)
argspec.add_argument("--assets", type=Path, default=Path(__file__).resolve().parents[1] / "app/assets")
argspec.add_argument("--ffx-frame", type=Path, required=True)
argspec.add_argument("--x2-frame", type=Path, required=True)
argspec.add_argument("--guide", type=Path)
argspec.add_argument("--screenshots", type=Path)
args = argspec.parse_args()
x, x2 = [json.loads(p.read_text(encoding="utf-8-sig")) for p in (args.ffx_frame, args.x2_frame)]
guide = args.guide.read_bytes() if args.guide else b'<main id="contents"><a href="#page-001">Besaid Island</a><article id="page-001"><h1>Besaid Island</h1></article></main>'
guide += (args.assets/"guide-reader.html").read_bytes()
with sync_playwright() as pw:
    browser = pw.chromium.launch(channel="chrome")
    for width,height in [(350,420),(620,465),(900,675)]:
        page = browser.new_page(viewport={"width":width,"height":height}, has_touch=True)
        errors = []
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.route("https://guide.spira.invalid/walkthrough.html",lambda r:r.fulfill(content_type="text/html",body=guide))
        page.goto((args.assets.resolve()/"index.html").as_uri())
        main = page.locator("main")
        dialog = page.locator("#shell-dialog")

        def feed(frame):
            page.evaluate("(f)=>Spira.update({...f,timestamp:Date.now()},false)",frame)

        def visit(key):
            if page.locator("#glance-exit").is_visible():
                page.locator("#glance-exit").click()
            page.locator("#tool-library").click()
            dialog.locator(f'[data-shell-key="open-{key}"]').click()

        def layout(scope=main):
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth+1"), (width,"viewport")
            if scope.is_visible():
                assert scope.evaluate("n=>n.scrollWidth <= n.clientWidth+1"), (width,scope.inner_text()[:65])

        def shot(name,locator):
            layout()
            if args.screenshots and width==620:
                args.screenshots.mkdir(parents=True,exist_ok=True)
                locator.evaluate("el=>el.scrollIntoView({block:'start'})")
                page.screenshot(path=args.screenshots/(name+".png"))

        def all_sections(frame,large=False):
            feed(frame)
            keys=page.evaluate("availableShellTools(shellCurrent).map(r=>r.tab)")
            assert len(keys)>=24
            for key in keys:
                visit(key)
                if key=="glance":
                    page.locator("#glance-index").click()
                else:
                    page.locator("#section-index").click()
                expect(dialog.locator("#field-index-results button:visible").first).to_be_visible()
                layout(dialog)
                dialog.get_by_role("button",name="Close",exact=True).click()
                layout()
            return keys

        feed(x)
        visit("arena")
        page.locator("#section-index").click()
        dialog.locator(".index-shortcuts").get_by_role("button",name="Capture atlas",exact=True).tap()
        expect(main.locator(".atlas-regions button")).to_have_count(13)
        main.get_by_label("Atlas capture goal").select_option("5")
        shot("capture-atlas",main.locator(".atlas-regions"))
        main.locator(".atlas-regions button").filter(has_text="Besaid").click()
        expect(main.locator(".atlas-species")).to_have_count(3)
        main.locator(".atlas-species").first.get_by_role("button").first.click()
        expect(main.locator(".capture-dossier").first).to_be_visible()
        main.locator(".capture-dossier").first.locator("summary").click()
        main.get_by_role("button",name="Find hunting spots",exact=True).first.click()
        page.locator("#section-back").click()
        expect(main.locator(".capture-dossier").first).to_have_attribute("open","")
        page.locator("#section-back").click()
        expect(main.locator(".capture-atlas h3")).to_have_text("Besaid")
        visit("journal")
        main.get_by_label("Next time I play").fill("Hunt Tonberry, then return to Bevelle.")
        main.get_by_role("button",name="Save checkpoint").click()
        feed(dict(x,room=18,battles=x["battles"]+3,gil=x["gil"]+60))
        expect(main.locator(".journal-checkpoint")).to_contain_text("3 battles")
        shot("journal",main.locator(".journey-recap"))
        page.reload()
        visit("journal")
        expect(main.locator(".journal-checkpoint")).to_contain_text("Hunt Tonberry")
        feed(dict(x,story=x["story"]-1,battles=x["battles"]+10))
        expect(main.locator(".journal-checkpoint")).to_contain_text("different saves")
        feed(dict(x,battles=max(0,x["battles"]-1)))
        expect(main.locator(".journal-checkpoint")).to_contain_text("different saves")
        feed(x2)
        expect(main.locator(".journal-checkpoint")).not_to_contain_text("Hunt Tonberry")
        visit("equip")
        main.get_by_text("Party dressphere mastery",exact=True).click()
        shot("mastery",main.locator(".mastery-list"))
        cell=main.locator(".mastery-characters button:enabled").nth(1)
        job=cell.get_attribute("aria-label").split(" · ")[1]
        cell.click()
        expect(main.get_by_label("AP dressphere").locator("option:checked")).to_have_text(job)
        expect(main.locator(".loadout-roster [aria-pressed=true]")).to_contain_text("Rikku")
        for f,key,label in [(x,"bestiary","Search fiend or item"),(x2,"x2-bestiary","Search Bestiary")]:
            feed(f)
            visit(key)
            sheet=main.locator(".fiend-pager").locator("..")
            before=sheet.locator(".entry > strong").first.text_content()
            assert sheet.locator(":scope > .entry").count()==12
            main.get_by_role("button",name="Next fiends").click()
            assert sheet.locator(".entry > strong").first.text_content()!=before
            main.get_by_label(label).fill(before)
            expect(main.locator(".sheet .entry > strong").first).to_have_text(before)
        feed(x)
        visit("blitzball")
        main.get_by_role("button",name="Team Builder",exact=True).click()
        main.get_by_label("Player pool").select_option("all")
        main.get_by_label("Levels",exact=True).select_option("20")
        main.get_by_role("button",name="Compare options at goalkeeper").click()
        sub=main.get_by_label("Try a substitute").locator("option:checked").text_content()
        shot("substitute",main.locator(".position-workbench"))
        main.get_by_role("button",name="Try "+sub+" here",exact=True).click()
        expect(main.locator('.blitz-lineup [data-slot="5"] strong')).to_have_text(sub)
        main.get_by_role("button",name="Let planner choose").click()
        visit("guide")
        page.evaluate("SpiraGuide.fileChanged(true)")
        expect(page.get_by_role("button",name="Pause follow")).to_be_enabled(timeout=30000)
        assert page.evaluate("walkthroughHeadings.length")>0
        page.locator("#section-index").click()
        dialog.get_by_label("Find on this page").fill("Besaid")
        dialog.locator(".section-links button").first.click()
        expect(page.locator(".guide-status")).to_have_text("Browsing walkthrough")
        if width==620 and args.guide:
            print("Indexed",page.evaluate("walkthroughHeadings.length"),"walkthrough destinations")
        # A fresh context has independent profile preferences. Exercise every available tool at both sizes.
        for size in ("100","200"):
            page.locator("#display-settings").click()
            dialog.get_by_label("Text size").select_option(size)
            dialog.get_by_role("button",name="Close",exact=True).click()
            keys=all_sections(x)
            keys2=all_sections(x2)
        feed(x)
        assert not page.evaluate("availableShellTools(shellCurrent).some(r=>r.tab==='cheats')")
        page.evaluate("SpiraCheats.initialize('browser-replay',true)")
        visit("cheats")
        gil = main.get_by_role("spinbutton").input_value()
        page.locator("#section-index").click()
        dialog.get_by_label("Find on this page").fill("100,000 gil")
        dialog.locator(".section-links button").first.click()
        assert main.get_by_role("spinbutton").input_value() == gil
        expect(main.get_by_role("button",name="Add 100,000 gil")).to_be_focused()
        page.evaluate("SpiraCheats.visibility(false)")
        assert not errors,errors
        print(width, "px ·",len(keys),"FFX and",len(keys2),"FFX-2 sections at 100% and 200%")
        page.close()
    browser.close()
