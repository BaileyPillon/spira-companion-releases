"""Exercise the real companion UI with synthetic frames or a supplied pair of captures."""
import argparse
import base64
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--screenshots',action='store_true')
parser.add_argument('--ffx-frame', type=Path, help='FFX International battle frame')
parser.add_argument('--x2-frame', type=Path, help='FFX-2 USA Chapter 5 frame')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
out=root/'build/expansion-ui'
if args.screenshots:
    out.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    errors=[]
    page=browser.new_page(viewport={'width':620,'height':700},device_scale_factor=1)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto((root/'app/assets/index.html').as_uri())
    actor = dict(id=0, active=True, hp=1500, maxHp=1500, mp=50, maxMp=50)
    common = dict(schema=1, status='live', gil=1000, battles=25, items=[[8193, 2]])
    ffx = dict(common, game='x', disc='SLPS-25088', crc='658597E2', room=255, story=2000, battle=True,
               grid=page.evaluate("ffxData.standard.nodes.map(n=>n[2].toString(16).padStart(2,'0')+'00').join('')"),
               gridPositions=[0]*7, gridLinks='00'*881, arena='00'*640,
               progress=dict(trials=0, keyItems='00'*16),
               party=[dict(actor, attributes=[25]*8, battleAttributes=[25]*8, sphereLevel=5,
                           commands=[12304], gear=[], boosts=[0]*8)],
               enemies=[dict(id=foe, slot=i, hp=1000, maxHp=1000, battleAttributes=[15]*8)
                        for i, foe in enumerate([119,149,255])])
    x2 = dict(common, game='x2', disc='SLUS-20672', crc='48FE0C71', chapter=5, room=110,
              battle=False, party=[dict(actor, job=20480)], crimsonSpheres=0,
              storyFlags=base64.b64encode(bytes(0x2868)).decode('ascii'))
    if args.ffx_frame:
        ffx = json.loads(args.ffx_frame.read_text(encoding='utf8'))
    if args.x2_frame:
        x2 = json.loads(args.x2_frame.read_text(encoding='utf8'))
    def feed(value):page.evaluate('(f)=>Spira.update({...f,timestamp:Date.now()},false)',value)
    def choose(name):page.evaluate('(t)=>choose(t)',name)
    feed(ffx)
    for tab in ['workspace','planner','profiles','battle-lab','trials']:
        choose(tab);assert page.locator('main h1').count(),tab
    choose('battle-lab')
    assert 'Cid' not in page.locator('[aria-label="Comparison target"]').inner_text()
    assert 'Dummy' not in page.locator('[aria-label="Comparison target"]').inner_text()
    assert page.locator('main .sheet .entry strong').first.inner_text()=='Attack'
    page.evaluate('reconnecting=true;render()')
    assert page.get_by_text('Waiting for a fresh battle frame',exact=True).count()==1
    page.evaluate('reconnecting=false;render()')
    choose('grid-lab');page.get_by_role('button',name='Copy current grid',exact=True).click()
    assert page.get_by_role('button',name='Focus selected node').count()
    page.get_by_role('button',name='Focus selected node').click()
    page.get_by_role('button',name='Add route destination').click()
    page.get_by_role('button',name='Save build',exact=True).click()
    saved=page.evaluate('JSON.stringify(activeGridBuild)')
    page.evaluate('(saved)=>SpiraDocuments.imported("grid",JSON.stringify({format:"spira-grid-build",build:JSON.parse(saved)}))',saved)
    page.get_by_role('button',name='Save build',exact=True).click()
    assert page.evaluate('gridBuilds.length')==2,'Import must not overwrite its source build'
    choose('workspace');page.get_by_role('searchbox',name='Search companion').fill('Auto-Haste')
    page.get_by_role('button',name='Open Auto-Haste',exact=True).click()
    assert page.get_by_role('searchbox',name='Search ability or material').input_value()=='Auto-Haste'
    choose('workspace');page.get_by_role('searchbox',name='Search companion').fill('Wedge')
    page.get_by_role('button',name='Open Wedge',exact=True).click()
    assert page.evaluate('blitzView')=='compare'
    choose('workspace');page.get_by_role('searchbox',name='Search companion').fill('Potion')
    page.locator('main button').filter(has_text='Pin').first.click()
    page.get_by_label('Playthrough notes').fill('Keep this route')
    choose('profiles');page.get_by_label('Profile name',exact=True).fill('Second run')
    page.get_by_role('button',name='Create empty profile').click()
    page.get_by_label('Playthrough profile',exact=True).select_option(label='Second run')
    assert page.get_by_label('Profile name',exact=True).input_value()=='Second run'
    page.get_by_role('button',name='Switch profile').click();page.wait_for_load_state()
    choose('workspace');assert page.get_by_label('Playthrough notes').input_value()==''
    page.get_by_label('Playthrough notes').fill('Second route')
    choose('profiles');page.get_by_label('Playthrough profile',exact=True).select_option(label='My playthrough')
    page.get_by_role('button',name='Switch profile').click();page.wait_for_load_state()
    feed(ffx);choose('workspace');assert page.get_by_label('Playthrough notes').input_value()=='Keep this route'
    note = page.get_by_label('Playthrough notes')
    note.focus()
    note.evaluate('(el)=>el.setSelectionRange(2, 5)')
    feed({**ffx, 'items': [[8193, 4]]})
    assert note.evaluate('(el)=>el===document.activeElement && el.selectionStart===2 && el.selectionEnd===5')
    # Existing installations saved tool pins without a game field.
    page.evaluate("""() => {
      workspacePins = [{key:'tool:trials',kind:'Tool',name:'Cloister guide',tab:'trials'}];
      choose('trials');
    }""")
    feed(x2)
    assert page.evaluate('tab') == 'status'
    choose('workspace')
    assert page.get_by_role('button', name='Open Cloister guide').is_disabled()
    feed(ffx)
    assert page.get_by_role('button', name='Open Cloister guide').first.is_enabled()
    feed(x2);choose('workspace');page.get_by_role('searchbox',name='Search companion').fill('Hi-Potion')
    page.get_by_role('button',name='Open Hi-Potion',exact=True).click()
    assert page.get_by_role('searchbox',name='Find a recovery item').input_value()=='Hi-Potion'
    assert page.locator('main .item').count()==1
    choose('chapter-checklist');page.locator('.scene-audit summary').first.click()
    assert page.locator('.scene-audit[open]').count()==1
    scene=page.locator('.scene-audit')
    scene.get_by_role('checkbox',name='Unrecorded only').uncheck()
    scene.get_by_role('searchbox',name='Find an interaction or location').fill('Alternate Farplane farewell')
    assert scene.get_by_text('Alternate Farplane farewell',exact=True).count()==1
    scene.get_by_role('checkbox',name='Include conditional routes').uncheck()
    assert scene.get_by_text('No scenes match this filter',exact=True).count()==1
    scene.get_by_role('searchbox',name='Find an interaction or location').fill('')
    detail = scene.locator('details').first
    detail.locator('summary').click()
    open_text = detail.inner_text()
    feed({**x2, 'crimsonSpheres': x2.get('crimsonSpheres', 0) ^ 1})
    assert not scene.get_by_role('checkbox',name='Include conditional routes').is_checked()
    assert scene.locator('details[open]').count() == 1
    assert scene.locator('details[open]').inner_text() == open_text
    cloak={**ffx,'battle':False,'enemies':[],'progress':{**ffx['progress'],'trials':0}}
    def trial(name,room,held,sockets,puzzle=None,phases=None):
        state={'temple':name,'held':held,'sockets':[{'id':k,'value':v} for k,v in sockets.items()]}
        if puzzle is not None:state['puzzle']=puzzle
        if phases is not None:state['phases']=phases
        feed({**cloak,'cloister':state,'room':room});choose('trials')
        return state
    trial('Besaid',122,2,{39:0},phases=[0,0,0,0,0])
    assert page.get_by_text('Put the Glyph Sphere in the door recess',exact=True).count()==1
    trial('Kilika',108,6,{33:0,34:3},dict(doors=3,dropped=True))
    assert page.get_by_text('Put the Destruction Sphere in the lower recess',exact=True).count()==1
    trial('Djose',214,0,{43:1,44:1,49:1,50:1},dict(door=True,pit=True))
    assert page.get_by_text('Cross the electrified pit and press the far pedestal',exact=True).count()==1
    trial('Macalania',239,11,{34:0,37:0},dict(pedestal=3))
    assert page.get_by_text('Use the lower Glyph recess',exact=True).count()==1
    trial('Bevelle',306,3,{7:0,11:2},dict(firstBridge=True,exitBridge=False))
    assert page.get_by_text('Carry the Destruction Sphere to the former Glyph recess',exact=True).count()==1
    zanarkand=trial('Zanarkand',320,0,{10:0},dict(phase=5,white=3,solved=6,small=0,large=0))
    assert page.locator('.trial-required').count()==7
    assert page.get_by_text('Light the white squares · 3/7',exact=True).count()==1
    feed({**cloak,'room':320,'cloister':{**zanarkand,'held':3,'puzzle':{**zanarkand['puzzle'],'white':8}}})
    assert page.locator('.trial-required').count()==0
    assert page.get_by_text('Insert the Destruction Sphere at the large monitor',exact=True).count()==1
    match={'elapsed':185,'period':300,'score':[1,0],'half':1,'carrier':0,'controlled':0,'players':[]}
    for i,slot in enumerate([0,1,2,3,4,5,8,9,10,11,12,13]):
        match['players'].append({'id':i+6,'slot':slot,'hp':800,'x':(-350 if slot<8 else 150)+(i%3)*120,'y':(i%6-3)*120,
            'stats':{'AT':10,'EN':20,'PA':15,'SH':20,'BL':10,'CA':15,'SP':60}})
    pool={**ffx,'battle':False,'enemies':[],'room':62,'blitzMatch':match}
    feed(pool);page.evaluate('openBlitzView("live")')
    page.get_by_text('All players · current match stats',exact=True).click()
    match['elapsed']=186;feed(pool)
    assert page.locator('details[open] summary').filter(has_text='All players').count()==1,'Live updates must retain disclosures'
    feed({**pool,'blitzMatch':{**match,'carrier':-1,'ballInFlight':True}})
    assert page.get_by_text('Ball in transition',exact=True).count()==1
    page.route('https://guide.spira.invalid/**',lambda route:route.fulfill(content_type='text/html',body='''<!doctype html><html><body style="height:4000px;background:#fff">Offline guide fixture<script>parent.postMessage({kind:'ready'},'*');</script></body></html>'''))
    feed(ffx);page.evaluate('SpiraGuide.fileChanged(true);choose("guide")')
    page.wait_for_function('()=>guideReady')
    page.get_by_role('button',name='Full screen',exact=True).click()
    guide=page.frame_locator('iframe.guide-document')
    guide.locator('body').evaluate('()=>scrollTo(0,450)')
    page.locator('.guide-workspace').click()
    assert page.evaluate('tab')=='workspace'
    page.get_by_role('button',name='Back to full-screen guide',exact=True).click()
    assert page.evaluate('document.body.classList.contains("guide-fullscreen")')
    assert guide.locator('body').evaluate('()=>scrollY')==450
    page.get_by_role('button',name='Exit full screen',exact=True).click()
    if args.screenshots:
        for width,height in [(350,760),(620,620),(900,620)]:
            page.set_viewport_size({'width':width,'height':height});feed(ffx)
            for tab in ['workspace','planner','battle-lab','grid-lab']:
                choose(tab)
                if tab=='workspace':page.get_by_role('searchbox',name='Search companion').fill('')
                if tab=='grid-lab':
                    if not page.get_by_role('button',name='Fit grid').count():page.get_by_role('button',name='Open build',exact=True).first.click()
                    page.get_by_role('button',name='Fit grid').click();page.locator('canvas').scroll_into_view_if_needed()
                page.screenshot(path=str(out/f'{tab}-{width}.png'))
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(tab,width,'page overflow')
            feed(pool);page.evaluate('openBlitzView("live")');page.screenshot(path=str(out/f'blitz-{width}.png'))
            temple={**ffx,'battle':False,'room':122,'cloister':{'temple':'Besaid','held':2,'phases':[1,0,0,0,0],'sockets':[{'id':i,'value':0} for i in range(38,47)]}}
            feed(temple);choose('trials');page.screenshot(path=str(out/f'cloister-{width}.png'))
            feed({**cloak,'room':320,'cloister':zanarkand});choose('trials')
            page.screenshot(path=str(out/f'zanarkand-{width}.png'))
            feed(x2);choose('chapter-checklist')
            page.locator('.scene-audit summary').first.click();page.locator('.scene-audit summary').first.scroll_into_view_if_needed()
            page.screenshot(path=str(out/f'scene-audit-{width}.png'))
    assert not errors,errors
    browser.close()
print('Browser checks passed: tool navigation, battle targets, grid save/import, profile switching, search deep links, scene audit, Blitzball transitions and stable controls.')
