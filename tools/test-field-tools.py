"""Replay chapter review, the primer shelf, Sphere Break practice, guide bookmarks and Focus."""
import argparse
import json
import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--assets", type=Path, default=Path(__file__).resolve().parents[1]/"app/assets")
parser.add_argument("--ffx-frame", type=Path, required=True)
parser.add_argument("--x2-frame", type=Path, required=True)
parser.add_argument("--guide", type=Path)
parser.add_argument("--screenshots", type=Path)
parser.add_argument("--section-audit", type=Path, help="Check a saved shortcut in each available tool and write its label as JSON")
args = parser.parse_args()
x, x2 = (json.loads(f.read_text(encoding="utf-8-sig")) for f in [args.ffx_frame,args.x2_frame])
guide = (args.guide.read_bytes() if args.guide else b"""
<main><nav id="contents"><a href="#page-001">Introduction</a><a href="#page-005--besaid-temple">Besaid Temple</a></nav>
<div style="height:900px"></div><h2 id="page-001">Introduction</h2><div style="height:900px"></div>
<h2 id="page-005--besaid-temple">Besaid Temple</h2><div style="height:1000px"></div></main>""")
guide += (args.assets/"guide-reader.html").read_bytes()
with sync_playwright() as pw:
    browser=pw.chromium.launch(channel="chrome")
    audit=[]
    for width,height in ((350,420),(620,465),(900,675)):
        page=browser.new_page(viewport={"width":width,"height":height},has_touch=True)
        page.set_default_timeout(6000)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        deferred=[]
        hold_guide=False
        def serve_guide(route):
            if hold_guide:
                deferred.append(route)
            else:
                route.fulfill(content_type="text/html",body=guide)
        page.route("https://guide.spira.invalid/walkthrough.html",serve_guide)
        page.goto((args.assets.resolve()/"index.html").as_uri())
        main=page.locator("#panel")
        dialog=page.locator("#shell-dialog")

        def feed(frame):
            page.evaluate("(f)=>Spira.update({...f,timestamp:Date.now()},false)",frame)

        def visit(key):
            if page.locator("#focus-index").is_visible() or page.locator("#glance-index").is_visible():
                page.locator("#focus-index:visible, #glance-index:visible").click()
                dialog.get_by_role("button",name="All tools",exact=True).click()
            else:
                page.locator("#tool-library").click()
            dialog.locator('[data-shell-key="open-'+key+'"]').click()

        def fits(node):
            assert node.evaluate("e=>e.scrollWidth<=e.clientWidth+1"),(width,node.get_attribute("class"))
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),width

        def shot(name,node):
            if width==620 and args.screenshots:
                args.screenshots.mkdir(exist_ok=True,parents=True)
                node.evaluate("el=>el.scrollIntoView({block:'start'})")
                page.screenshot(path=args.screenshots/(name+".png"))

        feed(x)
        visit("collections")
        # Show how the shelf handles a few missing volumes in the recorded field session.
        feed(dict(x,progress={**x["progress"],"primers":x["progress"]["primers"] & ~((1<<18)|(1<<19)|(1<<21))}))
        expect(main.locator(".primer-shelf button")).to_have_count(26)
        main.locator(".primer-shelf button").nth(18).tap()
        expect(main.locator(".primer-detail")).to_contain_text("Primer XIX")
        shot("primers",main.locator(".primer-deadlines"))
        main.get_by_text("Read an Al Bhed phrase",exact=True).click()
        main.get_by_label("Al Bhed text").fill("Rammu!")
        main.get_by_label("Use the full alphabet").check()
        expect(main.locator(".primer-translation")).to_have_text("Hello!")
        feed(dict(x,progress={**x["progress"],"primers":0}))
        main.get_by_label("Use the full alphabet").uncheck()
        expect(main.locator(".primer-translation")).to_have_text("·····!")
        feed(dict(x,progress={**x["progress"],"primers":(1<<26)-1}))
        main.get_by_role("button",name="Missing only").click()
        expect(main).to_contain_text("All 26 primers collected")
        feed(x2)
        visit("chapter-checklist")
        review=main.locator(".chapter-review")
        expect(review.locator("button")).to_have_count(5)
        review.get_by_label("Count conditional scenes").check()
        shot("chapters",review)
        review.get_by_role("button",name="Review Chapter 2",exact=False).click()
        board=main.locator(".chapter-board")
        expect(board).to_have_attribute("open","")
        expect(board.get_by_label("Destination board chapter")).to_have_value("2")
        expect(board.get_by_label("Only unfinished destinations")).to_be_checked()
        expect(board.get_by_label("Include conditional routes")).to_be_checked()
        visit("challenges")
        main.get_by_role("button",name="Sphere Break",exact=True).click()
        practice=main.locator(".sphere-practice")
        practice.locator("summary").click()
        practice.locator("[data-coin='4']").tap()
        expect(practice.get_by_role("status")).to_contain_text("Start with")
        practice.locator("[data-coin='0']").tap()
        practice.get_by_role("button",name="Show next coin").tap()
        expect(practice.locator("[data-hint]")).to_have_count(1)
        shot("practice",practice.locator("h3"))
        practice.locator("[data-coin='2']").tap()
        expect(practice.locator(".practice-tally")).to_have_text("Break at 4 · 1× core")
        practice.get_by_role("button",name="Undo coin").tap()
        expect(practice.locator(".practice-tally")).to_contain_text("Sum 1")
        main.get_by_label("Core",exact=True).fill("7")
        main.get_by_label("Border coins",exact=True).fill("123123123123")
        practice.get_by_role("button",name="Practice calculator board").tap()
        expect(practice.locator("h3")).to_have_text("Calculator board · Core 7")
        expect(main.get_by_label("Core",exact=True)).to_have_value("7")
        feed(x)
        visit("guide")
        page.evaluate("SpiraGuide.fileChanged(true)")
        expect(page.get_by_role("button",name="Pause follow")).to_be_enabled(timeout=30000)
        page.locator("#section-index").click()
        dialog.get_by_label("Find on this page").fill("Besaid Temple")
        dialog.locator(".section-links button").first.click()
        page.get_by_role("button",name="Full screen",exact=True).click()
        expect(page.locator("body")).to_have_class(re.compile("guide-fullscreen"))
        page.get_by_role("button",name="Bookmarks",exact=True).click()
        dialog.get_by_role("button",name="Save current section").click()
        expect(dialog.locator("#bookmark-result")).to_contain_text("Saved ")
        mark=dialog.locator(".guide-marks .library-line button").first.inner_text()
        if width==620: print("Indexed destinations",page.evaluate("walkthroughHeadings.length"))
        assert "Besaid" in mark,mark
        dialog.get_by_role("button",name="Save current section").click()
        expect(dialog.locator(".guide-marks .library-line")).to_have_count(1)
        dialog.get_by_role("button",name="Close",exact=True).click()
        # Scroll the reader itself. Saving must use what is in view, even after opening a different indexed section.
        reader=next(frame for frame in page.frames if "guide.spira.invalid" in frame.url)
        reader.evaluate("""() => {
            window.dispatchEvent(new WheelEvent('wheel'));
            const node=document.getElementById('page-001');
            (node.closest('article')?.querySelector('h1') || node).scrollIntoView({block:'start',behavior:'instant'});
        }""")
        page.get_by_role("button",name="Bookmarks",exact=True).click()
        dialog.get_by_role("button",name="Save current section").click()
        expect(dialog.locator(".guide-marks .library-line")).to_have_count(2)
        second=dialog.locator(".guide-marks .library-line button").first.inner_text()
        assert "Introduction" in second,second
        page.reload()
        feed(x)
        visit("guide")
        hold_guide=True
        page.evaluate("SpiraGuide.fileChanged(true)")
        page.get_by_role("button",name="Bookmarks",exact=True).click()
        expect(dialog.get_by_role("button",name="Save current section")).to_be_disabled()
        assert deferred
        hold_guide=False
        deferred.pop().fulfill(content_type="text/html",body=guide)
        expect(dialog.get_by_role("button",name="Save current section")).to_be_enabled(timeout=30000)
        dialog.get_by_role("button",name=mark,exact=True).click()
        expect(page.locator(".guide-status")).to_have_text("Browsing walkthrough")
        page.get_by_role("button",name="Bookmarks",exact=True).click()
        dialog.get_by_role("button",name="Remove bookmark for "+mark,exact=True).click()
        expect(dialog.locator(".guide-marks .library-line")).to_have_count(1)
        expect(dialog.get_by_role("button",name=second,exact=True)).to_be_visible()
        dialog.get_by_role("button",name="Close",exact=True).click()
        visit("party")
        before=main.bounding_box()["width"]
        page.locator("#focus-view").click()
        after=main.bounding_box()["width"]
        if width>475: assert after>before+40,(before,after)
        if width==620: print("Panel width in Party:",before,"to",after)
        page.locator("#focus-index").click()
        dialog.get_by_role("button",name="Set a shortcut").click()
        dialog.get_by_label("Find on this page").fill("Formation")
        dialog.locator(".section-links button").first.click()
        dialog.get_by_role("button",name="My shortcut · Formation",exact=True).click()
        expect(dialog).not_to_be_visible()
        page.reload()
        feed(x)
        visit("party")
        page.locator("#section-index").click()
        expect(dialog.get_by_role("button",name="My shortcut · Formation",exact=True)).to_be_visible()
        shot("index",dialog.locator(".dialog-heading"))
        dialog.get_by_role("button",name="Close",exact=True).click()
        page.locator("#display-settings").click()
        dialog.get_by_label("When opening a tool").select_option("true")
        dialog.get_by_role("button",name="Close",exact=True).click()
        for size in ("100","200"):
            page.locator("#display-settings").click()
            dialog.get_by_label("Text size").select_option(size)
            dialog.get_by_role("button",name="Close",exact=True).click()
            for frame in (x,x2):
                feed(frame)
                keys=page.evaluate("availableShellTools(shellCurrent).map(r=>r.tab)")
                for key in keys:
                    visit(key)
                    if key in ("guide","glance"):
                        expect(page.locator("#focus-index")).to_be_hidden()
                    else:
                        expect(page.locator("#focus-index")).to_be_visible()
                        expect(page.locator("nav[aria-label='Companion views']")).to_be_hidden()
                        fits(main)
                    if args.section_audit and width==620 and size=="100" and key!="guide":
                        available=page.evaluate("""() => {
                            const rows=pageLandmarks();
                            return (preferredLandmarks[tab] || []).map(name=>rows.find(r=>r.label===name))
                              .find(Boolean)?.label || rows.find(r=>r.major)?.label || rows[0]?.label || null;
                        }""")
                        audit.append({"game":frame["game"],"tool":key,"shortcut":available})
                        if available:
                            page.locator("#focus-index:visible, #glance-index:visible").click()
                            dialog.get_by_role("button",name=re.compile("^(Set a shortcut|Change shortcut)$")).click()
                            dialog.get_by_label("Find on this page").fill(available)
                            dialog.locator(".section-links").get_by_role("button",name=available,exact=True).first.click()
                            dialog.get_by_role("button",name="My shortcut · "+available,exact=True).click()
                            expect(dialog).not_to_be_visible()
                    if key=="chapter-checklist":
                        fits(main.locator(".chapter-timeline"))
        assert not errors,errors
        print(width,"px: primer shelf, chapter drill-down, practice, reader bookmarks and both full-width tool sets passed")
        page.close()
    browser.close()
    if args.section_audit:
        args.section_audit.write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding="utf8")
