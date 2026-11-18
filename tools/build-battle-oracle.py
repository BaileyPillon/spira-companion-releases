"""Create regression vectors with the independent MIT RNG tracker implementation."""
import json
from pathlib import Path
import sys
from types import SimpleNamespace
sys.path.insert(0,sys.argv[1])
from ffx_rng_tracker.events.character_action import get_damage
from ffx_rng_tracker.data.actions import ACTIONS
from ffx_rng_tracker.data.constants import Stat,Buff,Status,Element,ElementalAffinity,Autoability

root=Path(__file__).resolve().parents[1]
raw=(root/'app/assets/ffx-data.js').read_text(encoding='utf8')
data=json.loads(raw[raw.index('{'):raw.rindex('}')+1])
ids={name:int(id) for id,name in data['abilities'].items()}
stats=[Stat.STRENGTH,Stat.DEFENSE,Stat.MAGIC,Stat.MAGIC_DEFENSE,Stat.AGILITY,Stat.LUCK,Stat.EVASION,Stat.ACCURACY]
vectors=[]
for key,ust,tst,ua,ta,boosts in [
    ('attack',[],[],[],[],0),('attack',[Status.POWER_BREAK],[Status.PROTECT],[],[],5),
    ('attack',[],[Status.ARMOR_BREAK],[Autoability.STRENGTH_20],[],0),
    ('quick_hit_hd',[],[],[],[],0),('firaga',[],[],[],[],0),
    ('firaga',[Status.MAGIC_BREAK],[Status.SHELL],[Autoability.MAGIC_BOOSTER],[],3),
    ('firaga',[],[],[],[Autoability.FIRE_EATER],0),('curaga',[],[],[],[],0),
    ('curaga',[],[Status.ZOMBIE],[],[],0),('potion',[],[],[Autoability.ALCHEMY],[],0),
    ('x-potion',[],[],[],[],0),('osmose',[],[],[],[],0)]:
    def actor(statuses,abilities):
        return SimpleNamespace(immune_to_damage=False,immune_to_physical_damage=False,immune_to_magical_damage=False,
            immune_to_percentage_damage=False,base_weapon_damage=16,stats=dict(zip(stats,[30,20,25,30,20,20,15,20])),
            buffs={b:boosts for b in Buff},statuses=set(statuses),autoabilities=set(abilities),weapon_elements=set(),
            elemental_affinities={e:ElementalAffinity.ABSORBS if e==Element.FIRE and Autoability.FIRE_EATER in abilities else ElementalAffinity.NEUTRAL for e in Element},
            max_hp=1000,current_hp=500,max_mp=100,current_mp=50,ctb=20,armored=False)
    user,target=actor(ust,ua),actor(tst,ta)
    def encode(a,abilities,weapon):
        permanent=['Death','Zombie','Petrify','Poison','Power Break','Magic Break','Armor Break','Mental Break','Confuse','Berserk','Provoke','Threaten']
        timed=['Sleep','Silence','Darkness','Shell','Protect','Reflect','NulTide','NulBlaze','NulShock','NulFrost','Regen','Haste','Slow']
        return dict(battleAttributes=list(a.stats.values()),boosts=list(a.buffs.values()),hp=a.current_hp,maxHp=a.max_hp,mp=a.current_mp,maxMp=a.max_mp,
            statusBits=sum(1<<i for i,name in enumerate(permanent) if name in a.statuses),statusTimed=sum(1<<i for i,name in enumerate(timed) if name in a.statuses),
            gear=[dict(type=0 if weapon else 1,equipped=True,power=16,abilities=[ids[b.value] for b in abilities])])
    action=ACTIONS[key]
    vectors.append(dict(name='Quick Hit' if key=='quick_hit_hd' else action.name,user=encode(user,ua,True),target=encode(target,ta,False),
        rolls=[get_damage(user,action,target,n,pool='mp' if action.damages_mp else 'hp') for n in range(32)]))
path=root/'tests/fixtures/battle-oracle.json';path.parent.mkdir(exist_ok=True)
path.write_text(json.dumps(vectors,separators=(',',':'))+'\n',encoding='utf8')
print(f'{len(vectors)} independently calculated battle cases')
