"""Generate numerical battle reference data from Grayfox96/FFX-RNG-tracker (MIT).

Usage: python tools/build-battle-model.py <local RNG tracker checkout>
No game scripts or dialogue are included. See app/assets/LICENSE-FFX-RNG-tracker.txt.
"""
import json
from pathlib import Path
import sys

sys.path.insert(0, sys.argv[1])
from ffx_rng_tracker.data.actions import ACTIONS
from ffx_rng_tracker.data.monsters import MONSTERS_HD
from ffx_rng_tracker.data import autoabilities as aa

root = Path(__file__).resolve().parents[1]
raw = (root / 'app/assets/ffx-data.js').read_text(encoding='utf-8')
data = json.loads(raw[raw.index('{'):raw.rindex('}')+1])
names = {}
for k,v in data['commands'].items():
    names[v.lower()] = min(names.get(v.lower(), int(k)), int(k))
names.update({v.lower(): int(k) for k,v in data['items'].items()})
actions = {}
selected = ['attack','quick_hit_hd','power_break','magic_break','armor_break','mental_break',
            'fire','fira','firaga','blizzard','blizzara','blizzaga','thunder','thundara','thundaga',
            'water','watera','waterga','cure','cura','curaga','haste','slow','protect','shell',
            'dark_attack','sleep_attack','silence_attack','potion','hi-potion','x-potion','mega-potion',
            'antidote','soft','remedy','holy','flare','ultima','drain','osmose','cheer','focus']
for key in selected:
    if key not in ACTIONS:
        continue
    action = ACTIONS[key]
    # International uses the revised rank-2 Quick Hit, as does HD.
    label = 'Quick Hit' if key == 'quick_hit_hd' else action.name
    id_ = names.get(label.lower())
    if id_ is None:
        continue
    actions[id_] = dict(name=label,rank=action.rank or 3,mp=action.mp_cost,
        formula=action.damage_formula.value,power=action.base_damage,type=action.damage_type.value,
        heals=action.heals,weapon=action.uses_weapon_properties,armored=not action.ignores_armored,
        elements=[e.value for e in action.elements],statuses={s.value:a.chance for s,a in action.statuses.items()},
        removes=action.removes_statuses,crit=action.can_crit,hits=action.n_of_hits,
        magic=action.affected_by_silence,reflect=action.affected_by_reflect,alchemy=action.affected_by_alchemy,
        drains=action.drains,hitFormula=action.hit_chance_formula.value,hitTable=action.uses_hit_chance_table,
        accuracy=action.accuracy,dark=action.affected_by_dark,
        hp=action.damages_hp,mpDamage=action.damages_mp,ctbDamage=action.damages_ctb,
        buffs={b.value:n for b,n in action.buffs.items()},
        neverLimit=action.never_break_damage_limit,alwaysLimit=action.always_break_damage_limit)
monsters = {}
for m in MONSTERS_HD.values():
    monsters[m.index] = dict(stats=[m.stats[s] for s in m.stats],
        resists={s.value:v for s,v in m.status_resistances.items()},
        immune=m.immune_to_damage,physicalImmune=m.immune_to_physical_damage,
        magicImmune=m.immune_to_magical_damage,percentImmune=m.immune_to_percentage_damage)
abilities = {name:int(id_) for id_,name in data['abilities'].items()}
bonuses = {}
for key in ['STRENGTH_BONUSES','MAGIC_BONUSES','DEFENSE_BONUSES','MAGIC_DEF_BONUSES']:
    bonuses[key] = {abilities[a.value]:v for a,v in getattr(aa,key).items() if a.value in abilities}
output = dict(actions=actions,monsters=monsters,bonuses=bonuses)
(root / 'app/assets/battle-model-data.js').write_text('const battleModelData = '+json.dumps(output,separators=(',',':'))+';\n',encoding='utf-8')
print(f'{len(actions)} command/item models; {len(monsters)} enemy reference records')
