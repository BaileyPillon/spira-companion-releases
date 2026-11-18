"""Build the Arena encounter tables from the MIT-licensed FFX RNG Tracker."""
import argparse
import json
from pathlib import Path
import sys


# Source zone, Monster Arena region index, matching field room IDs, display name.
# Room IDs scope the view to candidate spots. Multiple encounter tables can share a room.
SPOTS = [
    ("besaid_road", 0, [20, 21, 22, 41, 67], "Besaid road"),
    ("kilika_woods", 1, [18], "Kilika Woods"),
    ("miihen_screen_1", 2, [95], "Highroad south entrance"),
    ("miihen_screen_1_ledge", 2, [95], "Highroad south entrance · ledge"),
    ("miihen_screen_2_3", 2, [120, 127], "Highroad south and central paths"),
    ("miihen_screen_2_3_ledge", 2, [120, 127], "Highroad south and central · ledges"),
    ("miihen_newroad", 2, [116], "Newroad"),
    ("old_road", 2, [115], "Oldroad"),
    ("clasko_skip_screen", 2, [59], "Highroad north end"),
    ("mrr_valley", 3, [92], "Mushroom Rock · Valley"),
    ("mrr_precipice", 3, [128], "Mushroom Rock · Precipice"),
    ("mrr_aftermath", 3, [131], "Mushroom Rock · Aftermath"),
    ("djose_highroad_front_half", 4, [93], "Djose Highroad · Mushroom Rock end"),
    ("djose_highroad_back_half", 4, [93], "Djose Highroad · temple and Moonflow fork"),
    ("moonflow_south", 4, [75], "Moonflow · South Bank Road"),
    ("moonflow_north", 4, [97], "Moonflow · North Bank Road"),
    ("thunder_plains_south", 5, [140], "Thunder Plains south"),
    ("thunder_plains_south_1_stone", 5, [140], "Thunder Plains south · Qactuars released"),
    ("thunder_plains_north", 5, [162, 332], "Thunder Plains north"),
    ("thunder_plains_north_1_stone", 5, [162, 332], "Thunder Plains north · Qactuars released"),
    ("macalania_woods", 6, [110, 221, 241, 242, 329], "Macalania Woods"),
    ("lake_macalania", 6, [102, 153], "Lake Macalania road"),
    ("crevasse", 6, [192], "Lake Macalania · Crevasse"),
    ("sanubia_desert_east", 7, [136], "Sanubia Desert east"),
    ("sanubia_desert_central", 7, [137], "Sanubia Desert central"),
    ("sanubia_desert_ruins", 7, [137], "Sanubia Desert central · ruins"),
    ("sanubia_desert_west", 7, [138], "Sanubia Desert west"),
    ("calm_lands_south_before_defender_x", 8, [223], "Calm Lands south · before Defender X"),
    ("calm_lands_south", 8, [223], "Calm Lands south · after Defender X"),
    ("calm_lands_central_north_east", 8, [223], "Calm Lands central and northeast"),
    ("calm_lands_north_west", 8, [223], "Calm Lands northwest"),
    ("calm_lands_gorge", 9, [266], "Calm Lands · Gorge Bottom"),
    ("cave_white_zone", 9, [56], "Stolen Fayth Cavern · white-lit passages"),
    ("cave_green_zone", 9, [56], "Stolen Fayth Cavern · green-lit sections"),
    ("gagazet_mountain", 10, [244, 383], "Gagazet · Mountain Trail"),
    ("gagazet_cave", 10, [272], "Gagazet · Mountain Cave"),
    ("gagazet_underwater", 10, [310], "Gagazet · Submerged Passage"),
    ("zanarkand_overpass", 10, [225, 376], "Zanarkand · Overpass"),
    ("zanarkand_dome", 10, [222, 315, 316], "Zanarkand · Dome"),
    ("inside_sin_front", 11, [203], "Inside Sin · Sea of Sorrow"),
    ("inside_sin_back", 11, [204], "Inside Sin · City of Dying Dreams"),
    ("omega_ruins_lower", 12, [258], "Omega Ruins · lower caverns"),
    ("omega_ruins_upper", 12, [271], "Omega Ruins · upper platforms"),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tracker", type=Path, help="Path to the FFX-RNG-tracker checkout")
    args = parser.parse_args()
    tracker = args.tracker.resolve()
    sys.path.insert(0, str(tracker))
    from ffx_rng_tracker.data.monsters import MONSTERS

    zones_file = tracker / "ffx_rng_tracker/data/data_files/formations.json"
    zones = json.loads(zones_file.read_text(encoding="utf-8"))["zones"]
    lines = []
    for key, region, rooms, label in SPOTS:
        formations = [
            [MONSTERS[name].index for name in row["monsters"]]
            for row in zones[key]["encounters"]
        ]
        lines.append("  " + json.dumps([key, region, rooms, label, formations], separators=(",", ":")))
    output = Path(__file__).resolve().parent / "app/assets/ffx-encounter-data.js"
    header = "// FFX RNG Tracker encounter slots (MIT, see LICENSE-FFX-RNG-tracker.txt).\n"
    output.write_text(header + "const ffxHuntSpots = [\n" + ",\n".join(lines) + "\n];\n", encoding="utf-8")


if __name__ == "__main__":
    main()
