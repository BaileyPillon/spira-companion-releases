# Spira 1.39 research and ranked changes

For an Arena hunt, the useful question is where to go *next* given the species already captured. For an FFX-2 completion run, it is which conversation or branch changed between saves. Those two problems lead this release. Open **Arena → Capture circuit** or **Chapter Checklist → Compare chapter saves** to try them.

## How the list was ranked

I compared independent player questions, follow-up comments on existing companion apps, publicly documented game mechanics, and what Spira 1.38.3 already did. Repeated problems ranked ahead of isolated suggestions. Within a problem, I favored things the PS2 feed can answer while playing. For defects I ranked the likelihood of giving the player the wrong action or wasting a rare resource before presentation errors. These are editorial rankings from a targeted English-language sample. Thread scores, duplicate posts and search-result order were not used as vote totals.

| Player evidence | What it supports |
| --- | --- |
| [Tracking monsters on paper](https://www.reddit.com/r/finalfantasyx/comments/1k2xfcn/) · [Arena checklist and reverse-lookup feedback](https://www.reddit.com/r/finalfantasyx/comments/1us3xqz/) · [Android tracker discussion](https://www.reddit.com/r/finalfantasyx/comments/1x8aaw0/) | Players repeatedly describe losing count, overlapping encounter areas and needing a quick lookup. Spira already counts captures and ranks individual spots. A circuit should cover different missing species at each stop. |
| [FFX-2 save viewer request](https://www.reddit.com/r/finalfantasyx/comments/1qh3sbu/) · [Failed 100% run](https://www.reddit.com/r/finalfantasyx/comments/1urdvdn/) | A percentage by itself cannot explain a missed interaction. Players want to identify it before advancing or when comparing runs. |
| [Endgame farming and favorites](https://www.reddit.com/r/finalfantasyx/comments/1wmlol8/) · [Armor material farming](https://www.reddit.com/r/finalfantasyx/comments/16vteb6/) · [Bribe confusion](https://www.reddit.com/r/finalfantasyx/comments/1uol06x/) | Players work backward from a piece of equipment and worry about overspending. A single recipe or bribe quote answers only part of that question. |
| [Searchable Mix chart feedback](https://www.reddit.com/r/finalfantasyx/comments/1xkkxmr/) · [Mix and item-source tool](https://www.reddit.com/r/finalfantasyx/comments/1p2mh12/) · [Practical uses for Rikku](https://www.reddit.com/r/finalfantasyx/comments/1rhos81/) | Effect search and ingredient lookup matter. Keeping ingredients in reserve is our extension of that evidence. |
| [Gun Mage learning](https://www.reddit.com/r/FinalFantasy/comments/11fd2zd/) · [Oversoul cleanup](https://www.reddit.com/r/finalfantasyx/comments/1ceovbz/) · [Learning FFX-2 skills](https://www.reddit.com/r/FinalFantasy/comments/qyc6xu/) | Shared enemy names hide character-specific learning, unregistered Oversouls and AP still needed. |
| [Triple AP and Overdrive setup](https://www.reddit.com/r/finalfantasyx/comments/1s24jn2/) | Players invest rare gear and materials in AP setups. A recommendation that ranks the wrong weapon has a real cost. |

**Technical cross-checks.** RNG Tracker provides the encounter and loot data behind Spira’s existing tables. Jegged’s bribe guide explains variable payouts. The percentage-flag research distinguishes individual FFX-2 events, branches and replay locations. Farplane and FFX2SaveEditor provide context on the remaster formats. The FFXII companion and FFXTracker illustrate second-screen and session tracking. Spira calculates these plans locally using its existing PS2 readers. [RNG Tracker](https://github.com/Grayfox96/FFX-RNG-tracker) · [Bribe guide](https://jegged.com/Games/Final-Fantasy-X/Tips-and-Tricks/Bribe-List.html) · [FFX-2 percentage flags](https://github.com/Sonicshadowsilver2/Final-Fantasy-X-2-Coding/wiki/Percentage-Flags) · [FFX2SaveEditor](https://github.com/Meth962/FFX2SaveEditor) · [Farplane](https://github.com/topher-au/Farplane) · [FFXII Thor Companion](https://github.com/Cybranfox/ffxii-thor-companion) · [FFXTracker](https://github.com/shenef/FFXTracker)

## Ten defects

The [ranked defect report](review-fixes-1.39.md) gives the reproduced behavior, correction and regression coverage for each issue. Defects were found against the application and its model fixtures. The threads above establish the player problems and their impact.

1. The battle comparison offered actions to incapacitated characters and commands unavailable under Berserk.
2. Elemental-strike weapon forecasts ignored a target’s matching Nul protection.
3. The FFX-2 Bestiary kept identifying a defeated, replaced or departed enemy as the current target.
4. FFX AP gear scoring tied Double AP with Triple AP and mishandled redundant multipliers.
5. The Capture optimizer recommended keeping an ordinary weapon when the character owned no Capture weapon.
6. The FFX-2 accessory optimizer excluded a spare second copy that could legally fill the other slot.
7. Blitzball break selections followed the wrong play after a possession change, gap or match reset.
8. Butterfly guidance carried progress into a new attempt.
9. The FFX-2 accessory comparison lost the selected goal and open section on a live refresh.
10. The No Encounters check overlooked an equipped piece on a reserve party member.

## Ten improvements to existing tools

| Rank | Change | How to use it |
| ---: | --- | --- |
| 1 | Find the closest unfinished Arena region | In Arena’s capture list, set your 1/5/10 target. The shortcut names the region requiring the fewest additional catches to meet it and opens that region. |
| 2 | Open an FFX acquisition route from the bag | In Items, tap an item in either the unfiltered inventory or the search results to see its sources. FFX-2 recovery counts stay in that game’s inventory. |
| 3 | Find a Mix by effect and prioritize feasible recipes | Search an effect such as Auto-Life in Workspace. Open the Mix to see usable pairs first, then pairs missing one ingredient unit before those missing two. A double-item recipe needs two copies. |
| 4 | Count the chapter checks actually on screen | The scene audit shows both chapter-wide totals and the number of checks and unrecorded flags left after applying your search and conditional-route filters. |
| 5 | Isolate manually tracked Oversouls | Fiend Guide’s Manual entries only filter shows the entries without mapped bits. Combine it with Missing only or a Via Infinito floor to work through the remaining manual checks. |
| 6 | Find FFX-2 field-guide entries by teacher, fiend or ability | Search for a teacher or place in Workspace. A Blue Bullet opens for the first character missing it. An Oversoul opens its matching record. |
| 7 | Find existing tools by name and game | Workspace indexes Arena, Map, Items, Bestiary, Sphere Grid and the other main game tools. Game-specific tools are indexed for their game. |
| 8 | Find names using player abbreviations and punctuation | BHPL, BDL and OD expand to their full terms. Typing “auto haste” finds Auto-Haste. Exact names and name prefixes take priority over description-only matches. |
| 9 | Browse a whole search category | Choose Item, Tool, Location or another available type, even with a blank search. Show more results reaches the end of the list and reports how many entries are visible. |
| 10 | Organize favorites for the current run | Move to first changes pin priority. Current game pins only hides unavailable entries. The active playthrough profile retains both choices. |

These interaction choices are design responses to reported lookup and favorites problems. Reddit did not vote on the page size, sorting rule or wording.

## Ten new features

| Rank | Feature | What it does and where to find it |
| ---: | --- | --- |
| 1 | Capture circuit | **FFX → Arena.** Select 1, 5 or 10 captures per species. Each of up to three proposed stops adds different missing species. Remaining targets are listed separately. The route maximizes species coverage greedily, with encounter density as a tiebreaker. |
| 2 | Compare chapter saves | **FFX-2 → Chapter Checklist.** Bookmark the current live USA save, then play or load another save. See named interactions with newly recorded or absent flags, even if the two saves have the same total. |
| 3 | Chapter itinerary | **FFX-2 → Chapter Checklist.** Group unfinished interactions by destination and choose either faction, both branches or unconditional checks. CommSphere and Treasure Sphere playbacks direct you to the Celsius. |
| 4 | Customization shopping list | **FFX → Equip.** Set quantities for several auto-abilities. Shared materials are counted once against actual stock. Jump from the combined shortage to item sources. |
| 5 | Bribe shopping comparison | **FFX → Bestiary.** Choose an item and target quantity. Compare the estimated gil range across fiends after accounting for owned items, variable yields and whole encounters. |
| 6 | Mix ingredient reserves | **FFX → Mix.** Set how many of an ingredient to keep. See recipe pairs and use counts for a chosen result using only the remaining stock. Each pair is an alternative. |
| 7 | Gun Mage party board | **FFX-2 → Fiend Guide.** See all three characters’ missing Blue Bullets together, their teachers and special learning conditions. Manual checks are identified when a character’s save data is unavailable. |
| 8 | Via Infinito floor sweep | **FFX-2 → Fiend Guide.** Enter a start and end floor. See outstanding fiends in floor order, including overlapping ranges, any-floor entries and the floor 100 boss. |
| 9 | Farming ledger | **Both games → Items.** Mark the start of a session and compare net item and gil changes after fights, shopping or a reload. The baseline is stored in the active profile for the current game edition. |
| 10 | Next AP abilities | **FFX-2 → Equip.** Compare partially learned abilities across owned dresspheres. Sort by AP remaining for all three characters or one, then open the matching character and job. |

All ten tools also open from Workspace. Plans and bookmarks use companion storage. A bookmark stores mapped event flags, and the ledger stores inventory counts and gil. Neither stores a playable game save.
