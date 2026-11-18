"""Build compact gear-drop tables from the FFX RNG Tracker PS2 INT model."""
import argparse
import json
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tracker", type=Path, help="Path to the FFX-RNG-tracker checkout")
    args = parser.parse_args()
    sys.path.insert(0, str(args.tracker.resolve()))
    from ffx_rng_tracker.data.autoabilities import AUTOABILITIES
    from ffx_rng_tracker.data.constants import Character, EquipmentType
    from ffx_rng_tracker.data.monsters import MONSTERS_HD

    ability_ids = {ability: 0x8000 + i for i, ability in enumerate(AUTOABILITIES)}
    pools = {}
    profiles = {}
    enemies = {}
    for monster in MONSTERS_HD.values():
        gear = monster.equipment
        if not gear.drop_chance or not gear.added_to_inventory:
            continue
        owners = []
        for equipment_type in EquipmentType:
            owner_pools = []
            for owner in list(Character)[:7]:
                pool = tuple(ability_ids.get(a, 0) for a in gear.ability_lists[equipment_type][owner])
                owner_pools.append(pools.setdefault(pool, len(pools)))
            owners.append(tuple(owner_pools))
        profile = (gear.drop_chance, tuple(gear.slots_range), tuple(gear.max_ability_rolls_range), *owners)
        enemies[monster.index] = profiles.setdefault(profile, len(profiles))
    data = {"pools": list(pools), "profiles": list(profiles), "enemies": enemies}
    output = Path(__file__).resolve().parent / "app/assets/ffx-gear-drop-data.js"
    output.write_text(
        "// FFX RNG Tracker equipment data (MIT, see LICENSE-FFX-RNG-tracker.txt).\n"
        + "const ffxGearDropData = " + json.dumps(data, separators=(",", ":")) + ";\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
