"""Generate the FFX reference tables used by the companion."""
import argparse
import csv
import json
from pathlib import Path
import re
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('references', type=Path, help='directory containing the rng and grid source checkouts')
parser.add_argument('assets', type=Path, help='output directory for ffx-data.js')
parser.add_argument('tables', type=Path, help='JSON file containing commands and equipment_name_groups')
args = parser.parse_args()
refs = args.references.resolve()
sys.path[:0] = [str(refs / 'rng'), str(refs / 'grid')]

from ffx_rng_tracker.data.constants import KillType, Rarity
from ffx_rng_tracker.data.monsters import MONSTERS_HD
from ffx_sphere_grid_viewer.data.layout import LAYOUT_EXPERT, LAYOUT_STANDARD
from ffx_sphere_grid_viewer.data.node_types import NODE_TYPES

rng = refs / 'rng/ffx_rng_tracker/data/data_files'
formations = json.loads((rng / 'formations.json').read_text(encoding='utf8'))
types = {id(node): i for i, node in enumerate(NODE_TYPES)}

def graph(layout):
    ids = {id(node): i for i, node in enumerate(layout.nodes)}
    return {
        'nodes': [[node.x, node.y, types.get(id(node.content), 1)] for node in layout.nodes],
        'links': [[ids[id(link.node_1)], ids[id(link.node_2)],
                   ids.get(id(link.centre_node), -1)] for link in layout.links],
    }

def hex_names(data):
    return {int(key, 16): value for key, value in data.items()}

tables = json.loads(args.tables.read_text(encoding='utf8'))
commands = hex_names(tables['commands'])
commands.update({0x3058:'Pilfer Gil', 0x3059:'Full Break', 0x305a:'Extract Power', 0x305b:'Extract Mana',
                 0x305c:'Extract Speed', 0x305d:'Extract Ability', 0x305e:'Nab Gil', 0x305f:'Quick Pockets'})
with (rng / 'autoabilities.csv').open(encoding='cp1252', newline='') as f:
    auto = {0x8000+i: row['Ability Name'] for i,row in enumerate(csv.DictReader(f))}
with (rng / 'items.csv').open(encoding='cp1252', newline='') as f:
    items = {0x2000+i: row['Name'] for i,row in enumerate(csv.DictReader(f))}
zones = {}
for zone in formations['zones'].values():
    ids = sorted({MONSTERS_HD[key].index for encounter in zone['encounters']
                  for key in encounter['monsters'] if key in MONSTERS_HD})
    if ids:
        zones.setdefault(zone['name'], set()).update(ids)
enemies = {}
def drops(items):
    return [[str(drop.item), drop.quantity] for drop in items if drop is not None]

for monster in MONSTERS_HD.values():
    stats = {key.value: value for key,value in monster.stats.items()}
    if monster.index == 183:  # Placeholder between the two Gemini battle records.
        continue
    name = {182:'Gemini (Sword)',184:'Gemini (Club)'}.get(monster.index, monster.name)
    loot = [source.items[KillType.NORMAL, rarity] for source in (monster.item_1, monster.item_2)
            for rarity in Rarity if source.drop_chance]
    bribe = monster.bribe.item
    enemies[monster.index] = {'name':name,'hp':stats['HP'],'mp':stats['MP'],
        'armored':monster.armored, 'overkill':monster.overkill_threshold,
        'steal':drops(monster.steal.items.values()) if monster.steal.base_chance else [],
        'drops':drops(loot),
        'bribe':[str(bribe.item), bribe.quantity, monster.bribe.max_cost] if bribe and not monster.immune_to_bribe else None,
        'affinities':{key.value: value.value for key,value in monster.elemental_affinities.items() if value.value!='Neutral'}}
equipment = hex_names({key: value['names'] for key,value in tables['equipment_name_groups'].items()})
data = {
    'commands': commands, 'abilities': auto, 'items': items, 'equipment': equipment, 'enemies': enemies,
    'zones': {key: sorted(value) for key,value in zones.items()},
    'types': [[node.name, int(re.search(r'(\d)',node.name)[1]) if 'LOCK' in node.appearance_type.name else 0,
               bool(node.learned_move)] for node in NODE_TYPES],
    'standard': graph(LAYOUT_STANDARD), 'expert': graph(LAYOUT_EXPERT),
}
args.assets.mkdir(parents=True, exist_ok=True)
(args.assets/'ffx-data.js').write_text('const ffxData = '+json.dumps(data, ensure_ascii=True,separators=(',',':'))+';\n',encoding='utf8')
