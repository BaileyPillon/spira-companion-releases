"use strict";

// FFX International auto-ability, material, and count. Weapon recipes precede armor.
// Costs cross-checked against Jegged’s Weapon and Armor Auto-Abilities tables.
const ffxCustomization = [
  [
    [0x8000, 0x2049, 2], // Sensor: Ability Sphere
    [0x8001, 0x2060, 1], // First Strike: Return Sphere
    [0x8002, 0x2036, 6], // Initiative: Chocobo Feather
    [0x8003, 0x2061, 1], // Counterattack: Friend Sphere
    [0x8004, 0x2062, 1], // Evade & Counter: Teleport Sphere
    [0x8005, 0x202a, 16], // Magic Counter: Shining Gem
    [0x8006, 0x2005, 30], // Magic Booster: Turbo Ether
    [0x8007, 0x2015, 4], // Alchemy: Healing Water
    [0x800b, 0x2052, 1], // Piercing: Lv. 2 Key Sphere
    [0x800c, 0x2042, 20], // Half MP Cost: Twin Stars
    [0x800d, 0x2045, 20], // One MP Cost: Three Stars
    [0x800e, 0x206e, 30], // Double Overdrive: Underdog's Secret
    [0x800f, 0x206f, 30], // Triple Overdrive: Winning Formula
    [0x8010, 0x206d, 20], // SOS Overdrive: Gambler's Spirit
    [0x8011, 0x206b, 10], // Overdrive -> AP: Door to Tomorrow
    [0x8012, 0x2009, 20], // Double AP: Megalixir
    [0x8013, 0x206c, 50], // Triple AP: Wings to Discovery
    [0x8019, 0x2035, 60], // Break Damage Limit: Dark Matter
    [0x801a, 0x2034, 30], // Gillionaire: Designer Wallet
    [0x801e, 0x201a, 4], // Firestrike: Bomb Fragment
    [0x8022, 0x2017, 4], // Icestrike: Antarctic Wind
    [0x8026, 0x201d, 4], // Lightningstrike: Electro Marble
    [0x802a, 0x2020, 4], // Waterstrike: Fish Scale
    [0x802e, 0x2033, 60], // Deathstrike: Farplane Wind
    [0x802f, 0x2032, 30], // Deathtouch: Farplane Shadow
    [0x8032, 0x2030, 30], // Zombiestrike: Candle of Life
    [0x8033, 0x200e, 70], // Zombietouch: Holy Water
    [0x8036, 0x2031, 60], // Stonestrike: Petrify Grenade
    [0x8037, 0x2031, 10], // Stonetouch: Petrify Grenade
    [0x803a, 0x202d, 24], // Poisonstrike: Poison Fang
    [0x803b, 0x200a, 99], // Poisontouch: Antidote
    [0x803e, 0x2026, 16], // Sleepstrike: Dream Powder
    [0x803f, 0x2025, 10], // Sleeptouch: Sleeping Powder
    [0x8042, 0x2027, 20], // Silencestrike: Silence Grenade
    [0x8043, 0x200d, 60], // Silencetouch: Echo Screen
    [0x8046, 0x2028, 20], // Darkstrike: Smoke Bomb
    [0x8047, 0x200c, 60], // Darktouch: Eye Drops
    [0x804a, 0x202f, 30], // Slowstrike: Gold Hourglass
    [0x804b, 0x202e, 16], // Slowtouch: Silver Hourglass
    [0x8062, 0x2046, 3], // Strength +3%: Power Sphere
    [0x8063, 0x203d, 2], // Strength +5%: Stamina Spring
    [0x8064, 0x204d, 1], // Strength +10%: Skill Sphere
    [0x8065, 0x202c, 4], // Strength +20%: Supreme Gem
    [0x8066, 0x2047, 3], // Magic +3%: Mana Sphere
    [0x8067, 0x203c, 2], // Magic +5%: Mana Spring
    [0x8068, 0x204f, 1], // Magic +10%: Blk Magic Sphere
    [0x8069, 0x202c, 4], // Magic +20%: Supreme Gem
    [0x807c, 0x2046, 2], // Distill Power: Power Sphere
    [0x807d, 0x2047, 2], // Distill Mana: Mana Sphere
    [0x807e, 0x2048, 2], // Distill Speed: Speed Sphere
    [0x807f, 0x2049, 2], // Distill Ability: Ability Sphere
  ], [
    [0x8008, 0x2040, 4], // Auto-Potion: Stamina Tablet
    [0x8009, 0x200f, 20], // Auto-Med: Remedy
    [0x800a, 0x2007, 20], // Auto-Phoenix: Mega Phoenix
    [0x8015, 0x206a, 30], // Pickpocket: Amulet
    [0x8016, 0x2069, 30], // Master Thief: Pendulum
    [0x8017, 0x206c, 30], // Break HP Limit: Wings to Discovery
    [0x8018, 0x2045, 30], // Break MP Limit: Three Stars
    [0x801b, 0x2040, 2], // HP Stroll: Stamina Tablet
    [0x801c, 0x2041, 2], // MP Stroll: Mana Tablet
    [0x801d, 0x203f, 30], // No Encounters: Purifying Salt
    [0x801f, 0x201a, 4], // Fire Ward: Bomb Fragment
    [0x8020, 0x201b, 8], // Fireproof: Bomb Core
    [0x8021, 0x201c, 20], // Fire Eater: Fire Gem
    [0x8023, 0x2017, 4], // Ice Ward: Antarctic Wind
    [0x8024, 0x2018, 8], // Iceproof: Arctic Wind
    [0x8025, 0x2019, 20], // Ice Eater: Ice Gem
    [0x8027, 0x201d, 4], // Lightning Ward: Electro Marble
    [0x8028, 0x201e, 8], // Lightningproof: Lightning Marble
    [0x8029, 0x201f, 20], // Lightning Eater: Lightning Gem
    [0x802b, 0x2020, 4], // Water Ward: Fish Scale
    [0x802c, 0x2021, 8], // Waterproof: Dragon Scale
    [0x802d, 0x2022, 20], // Water Eater: Water Gem
    [0x8030, 0x2033, 60], // Deathproof: Farplane Wind
    [0x8031, 0x2032, 15], // Death Ward: Farplane Shadow
    [0x8034, 0x2030, 10], // Zombieproof: Candle of Life
    [0x8035, 0x200e, 30], // Zombie Ward: Holy Water
    [0x8038, 0x2031, 20], // Stoneproof: Petrify Grenade
    [0x8039, 0x200b, 30], // Stone Ward: Soft
    [0x803c, 0x202d, 12], // Poisonproof: Poison Fang
    [0x803d, 0x200a, 40], // Poison Ward: Antidote
    [0x8040, 0x2026, 8], // Sleepproof: Dream Powder
    [0x8041, 0x2025, 6], // Sleep Ward: Sleeping Powder
    [0x8044, 0x2027, 10], // Silenceproof: Silence Grenade
    [0x8045, 0x200d, 30], // Silence Ward: Echo Screen
    [0x8048, 0x2028, 10], // Darkproof: Smoke Bomb
    [0x8049, 0x200c, 40], // Dark Ward: Eye Drops
    [0x804c, 0x202f, 20], // Slowproof: Gold Hourglass
    [0x804d, 0x202e, 10], // Slow Ward: Silver Hourglass
    [0x804e, 0x2066, 48], // Confuseproof: Musk
    [0x804f, 0x2066, 16], // Confuse Ward: Musk
    [0x8050, 0x2067, 32], // Berserkproof: Hypello Potion
    [0x8051, 0x2067, 8], // Berserk Ward: Hypello Potion
    [0x8052, 0x2016, 12], // Curseproof: Tetra Element
    [0x8054, 0x2038, 80], // Auto-Shell: Lunar Curtain
    [0x8055, 0x2039, 70], // Auto-Protect: Light Curtain
    [0x8056, 0x2037, 80], // Auto-Haste: Chocobo Wing
    [0x8057, 0x203b, 80], // Auto-Regen: Healing Spring
    [0x8058, 0x203a, 40], // Auto-Reflect: Star Curtain
    [0x8059, 0x2038, 8], // SOS Shell: Lunar Curtain
    [0x805a, 0x2039, 8], // SOS Protect: Light Curtain
    [0x805b, 0x2036, 20], // SOS Haste: Chocobo Feather
    [0x805c, 0x203b, 12], // SOS Regen: Healing Spring
    [0x805d, 0x203a, 8], // SOS Reflect: Star Curtain
    [0x805e, 0x2021, 1], // SOS NulTide: Dragon Scale
    [0x805f, 0x2018, 1], // SOS NulFrost: Arctic Wind
    [0x8060, 0x201e, 1], // SOS NulShock: Lightning Marble
    [0x8061, 0x201b, 1], // SOS NulBlaze: Bomb Core
    [0x806a, 0x2046, 3], // Defense +3%: Power Sphere
    [0x806b, 0x203d, 2], // Defense +5%: Stamina Spring
    [0x806c, 0x204c, 1], // Defense +10%: Special Sphere
    [0x806d, 0x202b, 4], // Defense +20%: Blessed Gem
    [0x806e, 0x2047, 3], // Magic Def +3%: Mana Sphere
    [0x806f, 0x203c, 2], // Magic Def +5%: Mana Spring
    [0x8070, 0x204e, 1], // Magic Def +10%: Wht Magic Sphere
    [0x8071, 0x202b, 4], // Magic Def +20%: Blessed Gem
    [0x8072, 0x2002, 1], // HP +5%: X-Potion
    [0x8073, 0x203e, 3], // HP +10%: Soul Spring
    [0x8074, 0x2008, 5], // HP +20%: Elixir
    [0x8075, 0x2043, 1], // HP +30%: Stamina Tonic
    [0x8076, 0x2004, 1], // MP +5%: Ether
    [0x8077, 0x203e, 3], // MP +10%: Soul Spring
    [0x8078, 0x2008, 5], // MP +20%: Elixir
    [0x8079, 0x2044, 1], // MP +30%: Mana Tonic
    [0x8080, 0x2035, 99], // Ribbon: Dark Matter
  ]
];
