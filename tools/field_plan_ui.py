"""Browser regressions for live planning tools. Frames come from the parent UI test."""
import base64


def check_field_plans(page, ffx, x2, feed, choose, screenshots=None):
    button = lambda name: page.get_by_role('button', name=name, exact=True)
    label = page.get_by_label
    main = page.locator('main')

    # Controlled overrides keep these assertions independent of the supplied player's inventory.
    x = {**ffx, 'battle': False, 'items': [[8192, 8]], 'arena': '00' * 640}
    feed(x)
    choose('arena')
    page.get_by_role('button', name='Captures', exact=True).click()
    page.get_by_role('button', name='Closest unfinished region', exact=False).click()
    assert label('Capture region').input_value() == page.evaluate('closestCaptureRegion(frame, arenaTarget).region')
    button('Capture circuit').click()
    assert main.get_by_text('Outside these stops', exact=True).is_visible()
    label('Captures per species').select_option('1')
    button('Inspect hunting area').first.click()
    assert page.locator('.hunt-spot[open]').count() > 0

    choose('equip')
    button('Customization shopping list').click()
    label('Auto-ability').select_option(label='Auto-Haste')
    label('Equipment pieces').fill('3')
    button('Set quantity').click()
    assert main.get_by_text('240 short', exact=True).is_visible()
    button('Price the next batch').click()
    assert label('Target inventory').input_value() == '99'
    assert label('Bribe item').input_value() == 'Chocobo Wing'
    choose('plan-workshop')
    button('Find Chocobo Wing').click()
    assert page.evaluate('bestiaryMode') == 'items'

    button('Bribe shopping comparison').click()
    label('Bribe item').select_option(label='Chocobo Wing')
    label('Target inventory').fill('80')
    assert main.get_by_text('Machea', exact=True).count() > 0

    choose('mix')
    button('Mix ingredient reserves').click()
    label('Ingredient to keep').select_option(label='Potion')
    label('Keep in inventory').fill('7')
    button('Set reserve').click()
    assert button('Release Potion').is_visible()

    choose('supplies')
    button('Farming ledger').click()
    feed(x)
    button('Start comparison here').click()
    feed({**x, 'items': [[8192, 5]], 'gil': x['gil'] + 120})
    assert main.get_by_text('8 → 5', exact=True).is_visible()
    assert main.get_by_text('+120 gil', exact=True).is_visible()
    choose('workspace')
    search = page.get_by_role('searchbox', name='Search companion')
    search.fill('')
    label('Search category').select_option('Item')
    assert button('Show more results').is_visible()
    button('Show more results').click()
    label('Search category').select_option('')
    search.fill('Trio of 9999')
    button('Open Trio of 9999').first.click()
    assert page.evaluate('tab') == 'mix'

    flags = bytearray(0x2868)
    ap = bytearray(0x6a0)
    ap[102] = 19
    y = {**x2, 'battle': False, 'chapter': 2, 'storyFlags': base64.b64encode(flags).decode(),
         'oversoul': '00' * 64, 'blueBullets': [1, 0, 1],
         'dressphereAp': [base64.b64encode(ap).decode()] * 3}
    choose('workspace')
    feed(y)
    choose('chapter-checklist')
    audit = page.locator('.scene-audit')
    if not audit.evaluate('(node) => node.open'):
        audit.locator('summary').first.click()
    label('Find an interaction or location').fill('no such interaction here')
    assert 'checks and 0 unrecorded flags' in audit.inner_text()
    label('Find an interaction or location').fill('')
    button('Chapter itinerary').click()
    label('Story branch').select_option('league')
    assert main.get_by_text('Deliver the sphere to the Youth League', exact=True).count() == 1
    assert main.get_by_text('Deliver the sphere to New Yevon', exact=True).count() == 0
    choose('chapter-checklist')
    button('Compare chapter saves').click()
    feed(y)
    button('Bookmark this save').click()
    offset, mask = page.evaluate('x2StoryEvents[0].slice(1,3)')
    flags[offset] |= mask
    feed({**y, 'storyFlags': base64.b64encode(flags).decode()})
    assert main.get_by_text('1 flag added · 0 absent relative to bookmark', exact=True).is_visible()
    choose('field-guide')
    page.evaluate('openX2FieldGuide("oversoul")')
    label('Manual entries only').check()
    assert '36 manual entries in this selection' in main.inner_text()
    button('Gun Mage party board').click()
    assert main.get_by_text('Needs it: Rikku', exact=True).is_visible()
    choose('field-guide')
    button('Via Infinito floor sweep').click()
    label('Starting floor').fill('99')
    label('Ending floor').fill('100')
    assert main.get_by_text('Floor 100', exact=True).count() > 0
    choose('workspace')
    search.fill('next ap abilities')
    button('Open Next AP abilities').click()
    # Show the shortlist even in the small fixture, which has no equipment records.
    jobs = {**y.get('loadout', {}), 'dresspheres': [[0x5001, 1]]}
    feed({**y, 'loadout': jobs})
    assert main.get_by_text('1 AP to go', exact=True).count() == 3
    label('Training shortlist').select_option('1')
    assert main.get_by_text('1 AP to go', exact=True).count() == 1

    if screenshots:
        for width in (350, 620, 900):
            page.set_viewport_size({'width': width, 'height': 620})
            for name, snapshot in [('plan-errands', y), ('plan-workshop', x)]:
                choose('journal')
                feed(snapshot)
                choose(name)
                page.screenshot(path=str(screenshots / f'{name}-{width}.png'))
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (name, width)
