"""Exercise the handheld menu, presets, guide reflow and full-screen Glance."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--assets",type=Path,default=root / "app/assets")
parser.add_argument("--ffx-frame",type=Path)
parser.add_argument("--x2-frame",type=Path)
parser.add_argument("--guide",type=Path)
parser.add_argument("--screenshots",type=Path)
args = parser.parse_args()
base = dict(schema=1,status="live",room=255,battles=32,gil=2345,items=[],story=2000,battle=True)
hero = dict(id=0,active=True,hp=108,maxHp=500,mp=12,maxMp=90,gear=[],attributes=[20]*8,statusBits=0)
x = dict(base,game="x",disc="SLPS-25088",crc="658597E2",party=[hero],grid=["0000"*900]*7,
         gridPositions=[0]*7,arena="00"*640,progress={},enemies=[dict(id=119,battleId=20,hp=50,maxHp=32000)],turnOrder=[0,20])
x2 = dict(base,game="x2",disc="SLUS-20672",crc="48FE0C71",battle=False,chapter=5,room=221,party=[dict(hero,job=20481)])
if args.ffx_frame:
    x = json.loads(args.ffx_frame.read_text(encoding="utf-8-sig"))
if args.x2_frame:
    x2 = json.loads(args.x2_frame.read_text(encoding="utf-8-sig"))
if args.guide:
    guide = args.guide.read_bytes()
else:
    guide = b"<style>main {max-width:45rem;margin:auto}p {font:16px sans-serif}</style><main id='contents'>" + b"<p>Chapter and location</p>"*100 + b"</main>"
guide += (args.assets / "guide-reader.html").read_bytes()

with sync_playwright() as pw:
    browser = pw.chromium.launch(channel="chrome")
    for w,h in [(350,420),(620,465),(900,675)]:
        page = browser.new_page(viewport={"width":w,"height":h})
        errors = []
        page.on("pageerror",lambda e: errors.append(str(e)))
        page.route("https://guide.spira.invalid/walkthrough.html",lambda route: route.fulfill(content_type="text/html",body=guide))
        page.goto((args.assets.resolve() / "index.html").as_uri())
        main = page.locator("main")
        dialog = page.locator("#shell-dialog")
        nav = page.locator("nav")
        def feed(f):
            page.evaluate("(f)=>Spira.update({...f,timestamp:Date.now()},false)",f)
        def check_fit(name,scope):
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),(w,name,"window")
            assert scope.evaluate("el => el.scrollWidth <= el.clientWidth + 1"),(w,name,"panel")
        def shot(name):
            check_fit(name,main)
            if args.screenshots:
                args.screenshots.mkdir(parents=True,exist_ok=True)
                page.screenshot(path=args.screenshots / f"{name}-{w}.png")
        def open_settings():
            page.locator("#display-settings").click()
        def close():
            dialog.get_by_role("button",name="Close",exact=True).click()
        def tools():
            nav.get_by_role("button",name="All tools",exact=True).click()

        feed(x)
        assert page.locator("html").get_attribute("data-palette") == "x"
        assert nav.locator("[data-tab]:visible").count() == 4
        open_settings()
        dialog.get_by_label("Text size").select_option("200")
        dialog.get_by_label("Menu palette").select_option("black")
        check_fit("200% display controls",dialog)
        close()
        assert page.locator("html").evaluate("e=>getComputedStyle(e).backgroundColor") in ("rgba(0, 0, 0, 0)","rgb(0, 0, 0)")
        assert page.locator("body").evaluate("e=>getComputedStyle(e).backgroundColor") == "rgb(0, 0, 0)"
        assert main.locator("h1").evaluate("e=>parseFloat(getComputedStyle(e).fontSize)") >= 50
        nav.locator("[data-tab='glance']").click()
        feed({**x,"battle":True,"enemies":[dict(id=130,hp=60000,maxHp=60000,targeted=True,battleId=20)]})
        enemy = main.locator(".glance-enemy")
        assert enemy.locator("strong").first.evaluate("e=>e.scrollWidth <= e.clientWidth+1")
        page.locator("#glance-exit").click()
        feed(x)
        tools()
        dialog.get_by_role("searchbox").fill("Story boss coach")
        dialog.get_by_role("button",name="Pin Story boss coach",exact=True).click()
        dialog.get_by_role("button",name="Story boss coach",exact=True).click()
        assert main.get_by_role("heading",name="Story boss coach").is_visible()
        assert nav.locator("[data-extra-tool='plan-phase']").is_visible()
        page.reload()
        feed(x)
        assert nav.locator("[data-extra-tool='plan-phase']").is_visible()
        open_settings()
        assert dialog.get_by_label("Text size").input_value() == "200"
        dialog.get_by_label("Text size").select_option("100")
        dialog.get_by_label("Menu palette").select_option("auto")
        dialog.get_by_label("Shade Glance after").select_option("30")
        close()
        scroll = main.evaluate("e=>{ e.scrollTop = 246; return e.scrollTop }")
        nav.locator("[data-tab='glance']").click()
        page.locator("#glance-exit").click()
        assert abs(main.evaluate("e=>e.scrollTop") - scroll) < 2
        nav.locator("[data-tab='glance']").click()
        assert main.get_by_role("heading",name="Front line").is_visible()
        assert not nav.is_visible()
        shot("ffx-glance")
        page.locator("#glance-dim").click()
        assert page.locator("#glance-shade").is_visible()
        page.locator("#glance-shade").click()
        assert not page.locator("#glance-shade").is_visible()
        page.clock.install()
        page.get_by_role("button",name="Shade screen").focus()
        page.keyboard.press("ArrowRight")
        page.clock.fast_forward(31000)
        assert page.locator("#glance-shade").is_visible()
        page.keyboard.press("Enter")
        assert not page.locator("#glance-shade").is_visible()
        feed({**x,"paused":True})
        assert page.locator("#glance-connection").inner_text() == "Paused"
        feed(x2)
        assert page.locator("html").get_attribute("data-palette") == "x2"
        shot("ffx2-glance")
        feed({**x2,"battle":True,"enemies":[dict(id=54,name="Test fiend",targeted=True,hp=400,maxHp=700)]})
        assert main.get_by_text("Test fiend",exact=True).is_visible()
        assert "Turn order" not in main.inner_text()
        page.locator("#glance-exit").click()
        tools()
        dialog.get_by_role("searchbox").fill("story boss coach")
        assert dialog.get_by_text("No matching tool for this game.").is_visible()
        dialog.get_by_role("searchbox").fill("wall solver")
        assert dialog.get_by_role("button",name="Thunder Plains wall solver",exact=True).is_visible()
        dialog.get_by_role("button",name="Thunder Plains wall solver",exact=True).click()
        tools()
        assert dialog.get_by_role("heading",name="Recently opened").is_visible()
        close()
        feed(x)
        tools()
        dialog.get_by_role("searchbox").fill("map")
        dialog.locator("[data-shell-key='open-map']").click()
        page.locator("#focus-view").click()
        assert not nav.is_visible()
        page.keyboard.press("Escape")
        assert nav.is_visible()
        # Verify the same sandbox and message bridge used by the real imported guide.
        page.evaluate("SpiraGuide.fileChanged(true)")
        nav.locator("[data-tab='guide']").click()
        iframe = page.frame_locator("iframe.guide-document")
        expect(iframe.locator("html")).to_have_attribute("data-reading-size","100",timeout=20000)
        page.get_by_role("button",name="Pause follow",exact=True).click()
        reader = iframe.locator("html")
        reader.evaluate("""() => {
          const paragraphs = document.querySelectorAll("main p");
          paragraphs[Math.floor(paragraphs.length / 3)].scrollIntoView({behavior:"instant"});
        }""")
        open_settings()
        reader.evaluate("""() => {
          const hit = document.elementFromPoint(innerWidth/2,Math.min(42,innerHeight/2));
          const element = hit.closest("p,h1,h2,h3,h4,li,td,figure,img,article,main");
          window.readingProbe = {element, top:element.getBoundingClientRect().top};
        }""")
        dialog.get_by_label("Text size").select_option("140")
        close()
        expect(iframe.locator("html")).to_have_attribute("data-reading-size","140")
        assert reader.evaluate("e=>getComputedStyle(e).zoom") == "1.4"
        assert reader.evaluate("()=>Math.abs(readingProbe.element.getBoundingClientRect().top-readingProbe.top)<100")
        page.get_by_role("button",name="Full screen",exact=True).click()
        page.locator(".guide-library").click()
        dialog.get_by_role("button",name="Display",exact=True).click()
        dialog.get_by_label("Menu palette").select_option("black")
        close()
        expect(iframe.locator("body")).to_have_css("background-color","rgb(0, 0, 0)")
        page.locator(".guide-library").click()
        dialog.get_by_role("button",name="Glance",exact=True).click()
        page.locator("#glance-exit").click()
        assert page.locator("body").evaluate("e=>e.classList.contains('guide-fullscreen')")
        page.get_by_role("button",name="Exit full screen",exact=True).click()
        assert not errors,errors
        page.close()
    browser.close()
print("Two palettes, OLED black, reading size, pins, game filters, focus, Glance, wake and guide return passed at three display sizes.")
