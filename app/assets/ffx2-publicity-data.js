"use strict";

// Chapter windows and response positions from the PS2 campaign guides.
// Tuples hold chapters, NPC landmark, publicity answer, matrimony answer, and timing.
const x2CampaignContacts = {
  "Besaid": [
    ["125","Woman beside the first tent at the village entrance",2,3],
    ["3","Woman inside the first tent at the village entrance",2,3],
    ["1235","Man inside the first tent on the right",1],
    ["1235","Item seller in the front-left tent",5,3],
    ["1235","Woman walking a dog through the village",4,4],
    ["123","Keepa in the back-left tent",1],
    ["5","Keepa on the beach",1],
    ["1235","Boy playing with a girl at the temple",3]
  ],
  "Kilika": [
    ["1","Man beside a woman near the port save point",5],
    ["35","Woman on the east side of the port with a man",5,1],
    ["35","Man beside her near the upper docks",5],
    ["135","Man in blue and yellow standing with a group in east port",4],
    ["135","Man in green by the southwest entrance of the second port screen",4],
    ["135","Blue-and-yellow shirt walking the docks",5],
    ["13","Shirtless man by the huts near Dona’s house",5],
    ["13","Woman beside a man at the foot of the port stairs",2,3],
    ["5","Woman dressed in blue on the bridge",2,3]
  ],
  "Luca": [
    ["125","Woman on the bench closest to the Highroad stairs",3,2],
    ["125","Woman seated with a man on the next bench east",5,3],
    ["12","Boy beside the balloon stand in the square",4],
    ["125","Brown-robed man on the west bench in the square",5],
    ["123","Man in yellow and green circling the ticket gate",3],
    ["123","Woman on the upper bench by the locker rooms",2,2],
    ["125","Woman in yellow walking across the docks",4,2],
    ["125","Man in white at the back of those docks",1],
    ["3","Left woman from the pair chatting near the bridge",3,2],
    ["3","Right woman in pink and green from the bridge pair",5,3],
    ["3","White-hatted man facing away on the bridge past the square",1],
    ["3","Child running with arms in the air on the bridge",4],
    ["3","Red-haired woman talking to the crowd",4,2],
    ["3","Pale-yellow shirt and green trousers on the bridge",5],
    ["5","Boy holding a blitzball near the tickets",4],
    ["5","Woman in white between the dock crates",2,2],
    ["5","Al Bhed man chatting behind the dock cargo stacks",3]
  ],
  "Mi’ihen Highroad": [
    ["1235","Blue-clad woman at the south-road statue",1,1,"Chapter 2 · After the chocobo mission"],
    ["1235","Yellow-clad woman at the same statue",2,5,"Chapter 2 · After the chocobo mission"],
    ["1235","Man in the alcove farther north from the statue",3,0,"Chapter 2 · After the chocobo mission"],
    ["1235","Al Bhed woman beside a hover on Oldroad Central",4,2,"Chapter 2 · After the chocobo mission"],
    ["1235","Man leaning on ruins at the roadside",2,0,"Chapter 2 · After the chocobo mission"],
    ["1235","Man up the slope across from the agency",1,0,"Chapter 2 · After the chocobo mission"],
    ["1235","Seated woman inside the agency",2,4,"Chapter 2 · After the chocobo mission"],
    ["1235","Man seated beside her inside the agency",3,0,"Chapter 2 · After the chocobo mission"],
    ["1235","Woman on the Newroad bridge",4,1],
    ["1235","Boy beneath the ruins on the way to Mushroom Rock",5,0,"Chapter 3 · Before the local mission"],
    ["1235","Man in purple on Newroad",2],
    ["1235","Purple-clad woman south on Newroad by the machina",4,1],
    ["1235","Higher of the two men seated on the ground",1],
    ["1235","Lower of the two men seated on the ground",3]
  ],
  "Djose": [
    ["12","Woman in yellow beside the save point",3,4],
    ["5","Woman in pale yellow by the reception tent",3,4],
    ["125","Al Bhed woman outside reception",1,5],
    ["12","Man speaking to an older woman by the temple entrance",2],
    ["5","Man seated near the reception tent",2],
    ["12","Al Bhed woman walking the Pilgrimage Road",3,5],
    ["12","Green-shirted man on the bridge",5],
    ["5","Man walking circles along the bridge",5],
    ["125","Man in orange with green sleeves on the bridge",1],
    ["125","Man in a yellow shirt on the bridge",4],
    ["125","Purple-clad woman at the south end of the bridge",3,5]
  ],
  "Moonflow": [
    ["1345","Al Bhed woman by the south approach to the Moonflow",3,1],
    ["12345","Boy dressed like Shinra beside the save point",5],
    ["12345","Boy jumping in red beside the stairs",5],
    ["12345","Woman with a red bandana on the north bank",5,4]
  ],
  "Guadosalam": [
    ["12345","Older woman just outside the entrance",1,5],
    ["13","Boy on the bench outside the inn",1],
    ["135","Man at the inn counter",2],
    ["135","Hypello beside an upstairs door",3],
    ["135","Man inside the item shop",4],
    ["135","Shopkeeper at the counter in the center of town",2]
  ],
  "Macalania Woods": [
    ["123","Guado in yellow to the right of the save point",1],
    ["123","Guado in green in the clearing where you catch O’aka",4]
  ]
};
