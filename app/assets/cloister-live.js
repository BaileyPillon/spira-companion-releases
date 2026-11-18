"use strict";

const cloisterTemples=[
  {name:"Besaid",room:122,bit:0,anchor:"page-043"},
  {name:"Kilika",room:108,bit:1,anchor:"page-046"},
  {name:"Djose",room:214,bit:2,anchor:"page-045"},
  {name:"Macalania",room:239,bit:3,anchor:"page-047"},
  {name:"Bevelle",room:306,bit:4,anchor:"page-044"},
  {name:"Zanarkand",room:320,bit:5,anchor:"page-048"}
];
let selectedCloister="";
const cloisterSockets={
  Besaid:{38:"Stairway Glyph Sphere",39:"Glyph door",40:"Hidden chamber wall",41:"Destruction Sphere chamber",42:"Besaid Sphere recess",45:"Pedestal"},
  Kilika:{24:"Entrance pedestal",25:"First burning door",26:"Moving pedestal",28:"Left side recess",29:"Center glyph recess",30:"Right side recess",31:"Fire-room upper wall",32:"Destruction Sphere alcove",33:"Lower recess by the stairs",34:"Exit door"},
  Djose:{41:"Entry right wall",42:"Entry left wall",43:"First door right socket",44:"First door left socket",45:"Charging wall · first socket",46:"Charging wall · second socket",47:"Large door right recess",48:"Large door left recess",49:"Pedestal · first socket",50:"Pedestal · second socket",51:"Secret Destruction alcove",52:"Upper Destruction pedestal"},
  Macalania:{32:"Right wall · ice stop",33:"North wall · lower ramp",34:"Sliding pedestal",35:"Central pillar",36:"Lower Destruction recess",37:"Lower Glyph recess",38:"Lifted floor recess",39:"Lower bridge pillar"},
  Bevelle:{2:"Pedestal · first slot",3:"Pedestal · second slot",4:"Starting branch source",5:"Upper track bridge recess",6:"Lower dead-end source",7:"Original Glyph Sphere recess",8:"Walkway power recess",9:"Destruction Sphere source",10:"Stairway recess",11:"Purple corridor recess"},
  Zanarkand:{10:"Right of the monitor",11:"Left of the monitor",12:"Small-room Destruction Sphere source",13:"Middle-left pedestal",14:"Middle-right pedestal"},
};
function cloisterSphere(temple,value){
  if(value===0)return "Empty";
  if(temple==="Kilika")return value===4?"Glyph Sphere":value===6?"Destruction Sphere":"Kilika Sphere";
  if(temple==="Djose"&&value===3)return "Charged Djose Sphere";
  if(["Besaid","Bevelle"].includes(temple))return ["Empty",temple+" Sphere","Glyph Sphere","Destruction Sphere"][value]||"Puzzle glyph state";
  if(temple==="Zanarkand")return ["Empty","Besaid Sphere","Kilika Sphere","Destruction Sphere"][value]||"Unknown";
  if(value===10)return "Destruction Sphere";
  if(value===11&&temple==="Macalania")return "Glyph Sphere";
  return temple+" Sphere";
}
const zanarkandA=[[-25,45],[-95,85],[-105,-65]],zanarkandB=[[-15,-45],[-25,-75],[-55,65]];
const zanarkandPatterns=[
  {count:5,tiles:[[105,-45],[125,-15],[135,5],[85,25]],choices:[[[135,-35],[75,15]]],take:[1]},
  {count:6,tiles:[[-25,-25],[-105,65],[-125,5],[-155,45]],choices:[zanarkandA,zanarkandB],take:[1,1]},
  {count:7,tiles:[[-5,75],[-85,-75],[-105,35],[-155,-55]],choices:[zanarkandA,zanarkandB],take:[2,1]},
  {count:9,tiles:[[-5,75],[-15,-45],[-25,45],[-25,-75],[-55,65],[-95,85],[-105,65],[-105,-65],[-125,5]],choices:[],take:[]},
  {count:7,tiles:[[-5,75],[-85,-75],[-155,45]],choices:[zanarkandA,zanarkandB],take:[2,2]},
  {count:7,tiles:[[75,-15],[105,5],[125,35],[-15,5],[-25,55],[-95,45],[-135,-15]],choices:[],take:[]}
];
function drawTrialTiles(pattern,position){
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  const sets=[pattern.tiles,...pattern.choices],all=sets.flat(),xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);
  const minX=Math.min(...xs)-13,minY=Math.min(...ys)-13,w=Math.max(...xs)-minX+13,h=Math.max(...ys)-minY+13;
  svg.setAttribute("viewBox",`${minX} ${minY} ${w} ${h}`);svg.setAttribute("role","img");
  svg.setAttribute("aria-label","Zanarkand tile locations. Solid tiles are required. Lettered tiles are choices as described below.");
  svg.classList.add("trial-tiles");
  for(const [group,tiles] of sets.entries())for(const [x,z] of tiles){
    const tile=document.createElementNS(svg.namespaceURI,"rect");
    tile.setAttribute("x",x-4);tile.setAttribute("y",z-4);tile.setAttribute("width","8");tile.setAttribute("height","8");
    tile.setAttribute("rx","1");tile.setAttribute("class",group?"trial-choice":"trial-required");svg.append(tile);
    if(group){const label=document.createElementNS(svg.namespaceURI,"text");label.setAttribute("x",x);label.setAttribute("y",z+2);label.textContent=group===1?"A":"B";svg.append(label);}
  }
  const marker=document.createElementNS(svg.namespaceURI,"circle");
  marker.setAttribute("r","2.7");marker.setAttribute("class","trial-player");svg.append(marker);
  function move(point){
    const shown=point&&point.x>=minX&&point.x<=minX+w&&point.y>=minY&&point.y<=minY+h;
    marker.setAttribute("visibility",shown?"visible":"hidden");
    if(shown){marker.setAttribute("cx",point.x);marker.setAttribute("cy",point.y);}
  }
  move(position);
  return {svg,move};
}
function cloisterNext(state,treasureDone,story){
  if(!state)return null;
  const held=state.heldType?state.heldType==="Empty"?"Empty":state.heldType+" Sphere":cloisterSphere(state.temple,state.held);
  const socket=id=>state.sockets?.find(s=>s.id===id)?.value;
  const step=(title,detail,target,pattern)=>({title,detail,held,target,pattern});
  const p=state.puzzle;
  if(state.temple==="Besaid"&&state.phases&&state.sockets){
    if(!state.phases[0]&&state.held===2&&socket(39)===0)return step("Put the Glyph Sphere in the door recess","This opens the door. Retrieve the Glyph Sphere afterward if you’re opening the hidden chamber.",39);
    if(!state.phases[0]&&!state.held)return socket(38)===2?step("Open the stairway and take the Glyph Sphere","Touch the glyph ahead and the one on the east wall. Descend and take the sphere before opening the door at the bottom.",38):
      step("Open the hidden stairway","Touch the glyph on the wall ahead, then touch the new glyph on the east wall. Follow the stairs down to the Glyph Sphere.");
    if(treasureDone){
      if(socket(45)===1)return step("Push the pedestal onto the floor mark","The Rod of Wisdom is recorded. Push the pedestal into the center of the open room to finish the trial.",45);
      if(state.held===1)return step("Load the pedestal with the Besaid Sphere","Then push it to the floor mark in the open room.",45);
      if(state.held===2&&socket(40)===0)return step("Set the Glyph Sphere aside in the hall","Use the first wall recess beyond the door so you can carry the Besaid Sphere to its pedestal.",40);
      if(!state.held&&socket(42)===1)return step("Take the Besaid Sphere to the pedestal","Touch the wall symbols opposite the pedestal and move the blue sphere into it to open the final room.",42);
      return step("Destruction treasure recorded","Follow the open trial route to the final room and move the Besaid Sphere pedestal onto the floor mark.");
    }
    if(state.held===2&&state.phases[0]&&!state.phases[1]&&socket(40)===0)return {title:"Use the Glyph Sphere to reveal the hidden chamber",detail:"Insert it into the wall recess beyond the opened door.",held,target:40};
    if(state.held===3&&!state.phases[4]&&socket(42)===0)return {title:"Put the Destruction Sphere where the Besaid Sphere was",detail:"This opens the treasure passage. Open the Rod of Wisdom chest before leaving.",held,target:42};
    if(state.held===1&&socket(45)===0)return {title:"Place the Besaid Sphere in the pedestal",detail:"Keep the original Besaid recess empty for the Destruction Sphere.",held,target:45};
    if(!treasureDone&&!state.held&&state.phases[4])return {title:"Open the Rod of Wisdom chest",detail:"The destruction passage is open, but the chest flag is not yet recorded.",held};
    if(!state.held&&state.phases[1]&&socket(42)===1)return step("Take the Besaid Sphere across from the pedestal","Touch the wall symbols opposite the pedestal, then remove the Besaid Sphere and place it in the pedestal.",42);
    if(!treasureDone&&!state.held&&state.phases[1]&&socket(41)===3&&socket(42)===0)return {title:"Take the Destruction Sphere from the hidden chamber",detail:"Carry it to the recess that originally held the Besaid Sphere.",held,target:41};
    if(!state.held&&state.phases[0]&&!state.phases[1]&&socket(39)===2)return {title:"Retrieve the Glyph Sphere from the opened door",detail:"It can now reveal the hidden Destruction Sphere chamber.",held,target:39};
  }
  if(state.temple==="Kilika"&&p&&state.sockets){
    const regular=v=>v>=1&&v<=3,side=[28,30].find(id=>socket(id)===0),parkedGlyph=[28,30].find(id=>socket(id)===4);
    if(!p.doors)return regular(state.held)?step("Put the Kilika Sphere into the first door","Wait for the door to burn, then remove the sphere.",25):
      step("Take the Kilika Sphere at the entrance","Carry it to the first door and insert it.",24);
    if(regular(socket(25)))return step("Remove the sphere from the burning entrance door","The way into the next room opens when the recess is empty.",25);
    if(treasureDone&&regular(socket(34)))return step("Remove the Kilika Sphere from the exit door","This clears the last obstruction. Head up the stairs.",34);
    if(treasureDone&&p.doors===3)return step("Head up the exit stairs","The Red Armlet is recorded and the exit barrier is burned away.");
    if(state.held===6)return step("Put the Destruction Sphere in the lower recess","Use the wall recess beside the stairs after the floor drops. Then open the Red Armlet chest.",33);
    if(socket(33)===6&&!treasureDone)return step("Open the Red Armlet chest","The lower destruction passage is open. Collect the chest before removing the exit sphere.",33);
    if(state.held===4)return step("Place the Glyph Sphere in the fire-room wall","Use the recess above the drop, where the second Kilika Sphere started. It puts out the fire and reveals the secret alcove.",31);
    if(p.dropped){
      if(regular(state.held))return step("Burn the exit door with the Kilika Sphere","Leave it in the recess while you finish the treasure, then remove it to leave.",34);
      if(regular(socket(33))&&!regular(socket(34)))return step("Take the sphere from the new lower recess","Carry it straight up to the exit door.",33);
      if(!treasureDone&&socket(31)===4&&socket(32)===6)return step("Take the Destruction Sphere from its alcove","Carry it to the now-empty lower recess by the stairs.",32);
    }
    if(socket(31)===4){
      if(regular(socket(26)))return step("Push the pedestal onto the fire-room floor switch","The sphere-powered pedestal will drop and expose the lower route.",26);
      if(regular(state.held))return step("Load the movable pedestal with the Kilika Sphere","After that, push it onto the floor switch.",26);
      const source=regular(socket(28))?28:30;
      if(regular(socket(source)))return step("Retrieve a Kilika Sphere from a side recess","Bring it to the movable pedestal in the former fire room.",source);
    }
    if(regular(socket(29)))return step("Remove the Kilika Sphere to expose the center glyph","Store it in a side recess, then touch the exposed glyph.",29);
    if(regular(state.held)&&socket(26)===0&&!regular(socket(31)))return step("Load the movable pedestal with the Kilika Sphere","With the upper fire-room recess free, move the Glyph Sphere there to extinguish the flames before dropping the pedestal.",26);
    if(regular(state.held))return !regular(socket(28))&&!regular(socket(30))&&state.held===1?
      step("Reveal or open the center glyph door","If the center wall has no glyph, insert the sphere to burn one into the wall. If it is already visible, store the sphere in a side recess and touch the glyph.",29):
      side?step("Store the Kilika Sphere in an empty side recess","The center recess must be clear so you can use the glyph.",side):
        step("Clear a place for the Kilika Sphere","Use the empty moving pedestal or take the side-socket route one sphere at a time. Both side recesses are occupied.");
    if(regular(socket(31)))return step("Open the glyph door and empty the fire-room recess",parkedGlyph&&socket(26)===0?
      "Take the Kilika Sphere from the upper right wall, then load it into the empty moving pedestal.":
      "Touch the center-wall glyph if the door is closed. Take the Kilika Sphere from the upper right wall and store it in the other side recess.",31);
    if(parkedGlyph)return step("Take the Glyph Sphere from the side recess","Move it to the empty upper fire-room wall recess to put out the flames.",parkedGlyph);
    if(socket(26)===4)return step("Recall the pedestal and remove its Glyph Sphere","Step on the fire-room floor switch to pull the pedestal into the room first.",26);
  }
  if(state.temple==="Djose"&&p&&state.sockets){
    if(p.elevator){
      if(p.stage===0){const missing=["near right","far right","center","far left","near left"].filter((_,i)=>!(p.upper&(1<<i)));
        return step(`Push the upper pedestals · ${5-missing.length}/5`,missing.length?`Ride up and push the remaining pedestals back into their walls: ${missing.join(", ")}.`:"Wait for the upper stairway to open.");}
      if(treasureDone)return step("Ride the elevator up and climb the stairs","The Magic Sphere is recorded. Exit by the stairway past the upper pedestals.");
      if(p.stage===2||socket(52)===10)return step("Open the Magic Sphere chest","The upper chamber’s secret wall is open. Collect the chest before heading upstairs.");
      if(state.held===10)return step("Carry the Destruction Sphere to the upper pedestal","Ride the elevator and insert it into the central upper pedestal.",52);
      if(p.glyph<2)return step("Open the secret glyph on the lower floor","Ride the elevator down and touch the glowing wall glyph beside the reset switch.",51);
      if(socket(51)===10)return step("Take the Destruction Sphere from the alcove","Bring it up on the elevator to the upper pedestal.",51);
    }
    if(socket(43)===0||socket(44)===0){
      const dest=socket(43)===0?43:44;
      if(state.held===1)return step("Fill the first double door","Insert the Djose Sphere in an empty socket beside the door.",dest);
      return step("Pick up a sphere from an entry wall","Use it in a socket in the double door. Both sides must be filled.",socket(41)===1?41:42);
    }
    if(p.farPedestal){
      if(state.held===3)return step("Set the charged sphere in the left recess by the large door","It lights the final piece of the floor emblem.",48);
      if(state.held===1)return step("Return this sphere to an entry-room wall socket","Fill the original wall recesses in the first chamber.",socket(41)===0?41:42);
      if(socket(41)===0||socket(42)===0)return step("Recall the pedestal and restore both entry walls","Step on the reset switch beside the floor emblem. Move both regular spheres from the returned pedestal to the first room’s wall sockets.",socket(49)===1?49:50);
      return step("Move the charged sphere from right to left","Take the glowing sphere from the right side of the large door and put it in the left recess. Then step onto the central elevator.",47);
    }
    if(p.pit)return step("Cross the electrified pit and press the far pedestal","Use the floating pedestal as a stepping stone, then push the far pedestal into the wall.");
    if(!p.door){
      if(state.held===3)return step("Open the large door with the charged sphere","Place the glowing sphere in the right recess beside the door.",47);
      if(socket(49)===3||socket(50)===3)return step("Take the charged sphere from the pedestal","Carry it to the right recess beside the large door.",socket(49)===3?49:50);
      if(socket(45)===0||socket(46)===0){
        if(state.held===1)return step("Fill the two charging sockets on the east wall","Fill both sockets under the charging pillar.",socket(45)===0?45:46);
        return step("Collect a sphere from beside the large door","Bring it to the east-wall charging sockets.",socket(47)===1?47:48);
      }
      return step("Push the pedestal under the charging pillar","Keep a sphere in the pedestal and place it directly below the powered pillar on the east side.",49);
    }
    if(socket(49)===1&&socket(50)===1)return step("Push the loaded pedestal into the electrified pit","Continue through the open large door. Once it floats, jump across and press the far pedestal.");
    if(state.held===1)return step("Load the pedestal with a regular Djose Sphere","Both pedestal sockets need a regular sphere for the pit crossing.",socket(49)===0?49:50);
    return step("Take the regular spheres back out of the charging wall","Move them to the pedestal’s two sockets before pushing it into the pit.",socket(45)===1?45:46);
  }
  if(state.temple==="Macalania"&&p&&state.sockets){
    const bridge=socket(35)===4&&socket(34)===4&&socket(39)===4&&p.pedestal===4;
    if(bridge)return treasureDone?step("Cross the ice bridge and climb the stairs","Avoid the recall glyph on the finished bridge."):
      step("Use the recall glyph on the finished bridge","Recall the pedestal onto the upper side ledge. Push it downhill to exchange its sphere for the Destruction Sphere.");
    if(state.held===10)return treasureDone||socket(33)!==4?step("Return the Destruction Sphere to the pedestal",treasureDone?"Recall it from the upper ledge and send it down again to restore a Macalania Sphere.":"Free your hands so you can restore the north-wall ramp before carrying it downstairs.",34):
      step("Set the Destruction Sphere in the lower recess","Use the empty socket nearest the foot of the ramp. The Luck Sphere chest opens beyond it.",36);
    if(state.held===11)return p.pedestal===3||p.pedestal===4?step("Use the lower Glyph recess","Take the Glyph Sphere to the wall recess farther from the ramp. It lifts the floor socket above.",37):
      step("Put the Glyph Sphere in the sliding pedestal","Leave the right-wall Macalania Sphere in place so its icicle stops the pedestal.",34);
    if(state.held===4){
      if(socket(34)===10&&socket(33)===0)return step("Restore the ramp at the north wall","Use the north-wall recess to regain access to the lower floor.",33);
      if(socket(34)===10&&socket(32)===0)return step("Restore the ice stop at the right wall","Put this Macalania Sphere into the right-wall socket before rebuilding the bridge.",32);
      if(socket(39)===0&&p.lifted)return step("Place the Macalania Sphere in the lower pillar","Take the ramp down and use the stationary pillar, leaving the sliding pedestal free.",39);
      if(socket(34)===0&&(p.pedestal===3||p.pedestal===4))return step("Load the lower sliding pedestal","Put the Macalania Sphere into the pedestal, then push it toward the lower bridge pillar.",34);
      return step("Complete the central pillar","Place the Macalania Sphere in the central pillar when the lower bridge sections are in place.",35);
    }
    if(!treasureDone&&socket(36)===10)return step("Open the Luck Sphere chest","Then retrieve the same sphere and load it in the pedestal before rebuilding the bridge.",36);
    if(treasureDone&&socket(36)===10)return step("Retrieve the Destruction Sphere from the lower recess","Return it to the pedestal. Send the pedestal down from the upper recall ledge to swap back to a Macalania Sphere.",36);
    if(p.pedestal===5)return step("Send the recalled pedestal down the side ledge","The exchange swaps its sphere with the one kept in reserve.",34);
    if(p.pedestal===6)return step("Recall the pedestal to the main floor","Step on the main-floor glyph; the pedestal returns carrying the exchanged sphere.",34);
    if(socket(34)===10){
      if(treasureDone)return step("Recall and exchange the pedestal sphere","Use the glyph on the upper bridge approach. Send the recalled pedestal down the side ledge to get a Macalania Sphere back.",34);
      if(socket(33)===0&&socket(35)===4)return step("Take the sphere out of the central pillar","Use it on the north wall to restore the lower ramp before taking the Destruction Sphere.",35);
      if(socket(32)===0&&socket(39)===4)return step("Retrieve the sphere from the lower pillar","Use it on the right wall to restore the ice stop for the later bridge rebuild.",39);
      return step("Take the Destruction Sphere from the pedestal","Carry it down the ramp to the unused recess nearest the ramp.",34);
    }
    if(socket(35)===11)return step("Take the Glyph Sphere from the central pillar","Place it in the sliding pedestal.",35);
    if(p.pedestal===0&&socket(34)>0)return step("Push the pedestal into the right-hand ice stop","Keep the right wall powered. The icicle stops the slide before you push it north.",34);
    if(p.pedestal===1||p.pedestal===2)return step("Send the pedestal down to the lower floor","Push it toward the ramp on the far side with the north-wall ramp sphere still installed.",34);
    if(socket(34)===11)return step("Take the Glyph Sphere from the lower pedestal","Use the lower wall recess farther from the ramp to lift the floor.",34);
    if(p.lifted&&socket(39)===0&&socket(38)===4)return step("Take the sphere from the raised floor","Bring it down to the stationary lower pillar.",38);
    if(socket(34)===0&&socket(32)===4)return step("Take the right-wall Macalania Sphere","The ice stop can be removed once the pedestal has reached the lower floor.",32);
    if(socket(34)===4&&p.pedestal!==4)return step("Push the lower pedestal toward the bridge pillar","Slide it right beneath the pillar to rebuild that section of the ice bridge.",34);
    if(socket(39)===0&&socket(32)===4)return step("Move the right-wall sphere to the lower pillar","Use the ramp while it is still available.",32);
    if(socket(35)===0&&socket(33)===4)return step("Move the north-wall sphere to the central pillar","Do this last: taking it from the north wall removes the lower ramp.",33);
  }
  if(state.temple==="Bevelle"&&p&&state.sockets){
    const aboard=value=>[2,3].find(id=>socket(id)===value);
    if(p.exitBridge&&p.knightLance)return treasureDone?step("Leave through the exit on the right","The HP Sphere and Knight Lance chests are both recorded."):
      step("Open the HP Sphere chest before leaving","The Knight Lance is recorded. Open the chest on the right at the stair landing to satisfy Anima’s requirement.");
    if(state.held===1&&socket(2)===0&&socket(3)===0)return step("Put a Bevelle Sphere back on the pedestal","The platform needs a sphere to move. Keep one in the pedestal and take a spare for the next recess.",2);
    if(p.exitBridge){
      if(state.held===1&&socket(10)===0)return step("Use the Bevelle Sphere at the top of the stairs","This enables the optional Knight Lance path. Open the HP Sphere chest on the right before leaving.",10);
      if(treasureDone&&socket(10)===1)return step("Ride the side path for Knight Lance, or exit right","The HP Sphere satisfies Anima’s requirement. For the optional chest, recall the pedestal at the stair landing and ride it left.",10);
      if(!state.held&&socket(8)===1&&socket(10)===0)return step("Take back the walkway’s Bevelle Sphere","You no longer need the walkway. Carry this sphere to the stairs for the optional Knight Lance path.",8);
      if(!state.held&&socket(2)===1&&socket(3)===1&&socket(10)===0)return step("Take the spare sphere off the pedestal at the stairs","Leave a sphere in the other pedestal slot. Use the spare in the stairway recess to power the Knight Lance path.",3);
      return step(treasureDone?"Exit to the right of the stair landing":"Ride to the exit and open the HP Sphere chest","Take the final lower junction, push the pedestal onto the continuation and climb the stairs.");
    }
    if(state.held===3)return step("Carry the Destruction Sphere to the former Glyph recess","Ride back to the separate Glyph branch and insert it where you picked up the Glyph Sphere. This activates the exit.",7);
    if(state.held===2)return step("Open the purple corridor with the Glyph Sphere","Ride back to the powered walkway and cross it. The Glyph Sphere goes in the corridor recess at the end.",11);
    if(state.held===1)return !p.firstBridge?step("Power the missing upper track","Ride to the opposite upper branch and put the Bevelle Sphere in the wall recess.",5):
      step("Power the walkway on the lower branch","Take the repaired track to the lower junction and insert the Bevelle Sphere in the walkway-power recess.",8);
    if(!p.firstBridge)return socket(4)===1?step("Take a Bevelle Sphere from the starting branch","Push the pedestal onto the track. Confirm straight at the starting glyph, then turn toward the lit recess at the first junction. Keep the pedestal’s own sphere installed.",4):
      step("Bring a spare Bevelle Sphere to the upper track recess","Use the sphere you put in the second pedestal slot. Leave the other sphere in the pedestal for the ride.",5);
    if(socket(8)!==1)return step("Collect a Bevelle Sphere for the walkway","Use a spare on the pedestal, or take the first arrow right to descend and go straight at the middle junction to reach the lower dead end.",socket(2)===1&&socket(3)===1?3:6);
    if(aboard(3))return step("Retrieve the Destruction Sphere from the pedestal","Ride to the original Glyph Sphere branch. Take the stored purple sphere out and insert it into the wall recess there.",aboard(3));
    if(aboard(2)&&socket(11)!==2)return step("Retrieve the Glyph Sphere at the powered walkway","Take it from your pedestal, cross the walkway and use the purple corridor recess.",aboard(2));
    if(socket(11)===2&&socket(9)===3)return step("Take the revealed Destruction Sphere","Cross the powered walkway to the corridor you opened with the Glyph Sphere.",9);
    if(socket(7)===2)return step("Take the Glyph Sphere from its branch","Ride to the separate lower branch, take the green sphere, then return to the powered walkway.",7);
  }
  if(state.temple==="Zanarkand"&&p&&state.sockets){
    if(treasureDone)return step("Magistral Rod recorded","The white-square puzzle is complete. You can leave the Dome.");
    if(p.phase===5){
      if(state.held===3)return step("Insert the Destruction Sphere at the large monitor","Use the recess on the right side of the screen, then open the Magistral Rod chest.",10);
      if(socket(10)===3)return step("Open the Magistral Rod chest","The shattered screen exposes the chest at the large monitor.",10);
      if(p.white>=7&&socket(12)===3)return step("Take the revealed Destruction Sphere","Go back to the small room and collect it from the opened alcove.",12);
      return step(`Light the white squares · ${Math.min(p.white,7)}/7`,"Three tiles are in the small room, four in the large room. Use the diagram; a colored tile resets the set.",null,zanarkandPatterns[5]);
    }
    if(story>=2795)return step("Continue through the Dome","The story puzzle is complete. Return after getting free airship travel for the white-square treasure.");
    if(story>=2775||p.phase===6||p.solved>=6)return step("Save and enter the large chamber","Prepare for Spectral Keeper on the story visit. Return after getting free airship travel for the white-square treasure.");
    if(state.held===1)return step("Insert the Besaid Sphere in the middle-right pedestal","Return to the first room and use the middle pedestal on the right.",14);
    if(state.held===2)return step("Insert the Kilika Sphere in the middle-left pedestal","Return to the first room and use the middle pedestal on the left.",13);
    if(p.solved>=4)return socket(13)!==2?step("Take the Kilika Sphere beside the big monitor","Carry it to the middle-left pedestal in the first room."):
      step("Take the Besaid Sphere beside the big monitor","Carry it to the middle-right pedestal in the first room.");
    const pattern=zanarkandPatterns[p.phase];
    if(pattern){
      const count=p.phase===0?p.small:p.large;
      if(count>=pattern.count)return step("Activate the next unused corner pedestal","Return to the first room, push an unused outer pedestal into the wall, then follow the new monitor pattern.");
      return step(`${p.phase===0?"Open the first room":"Match the monitor pattern"} · ${count}/${pattern.count}`,
        p.phase===0&&count===0?"Start on the activation tile just inside the room. Then match the colored shapes on the monitor.":"Step on the solid tiles and use the lettered choices to match the monitor.",null,pattern);
    }
  }
  return {title:held==="Empty"?"Puzzle position needs a check":"Carrying: "+held,
    detail:"The live state does not match a recognized step. Check the recesses below and open the temple walkthrough to get back on route.",held};
}
function showCloister(current){
  const here=cloisterTemples.find(t=>t.room===current?.room||t.name==="Zanarkand"&&current?.room===319);
  const temple=cloisterTemples.find(t=>t.name===selectedCloister)||here||cloisterTemples[0];
  heading(temple.name+" Cloister");
  const known=Number.isInteger(current?.progress?.trials),done=known&&!!(current.progress.trials&(1<<temple.bit));
  const state=current?.cloister?.temple===temple.name&&!current.paused&&!reconnecting?current.cloister:null;
  const next=cloisterNext(state,done,current?.story);
  if(next){
    const lead=entry(next.title,next.pattern?"":"Holding: "+next.held,next.detail);
    lead.classList.add("journey-next");panel.append(lead);
    if(next.pattern){
      if(next.pattern.take.length)panel.append(element("p","field-note",next.pattern.take.map((n,i)=>`Choose ${n} from group ${i===0?"A":"B"}`).join(" · ")));
      const tiles=drawTrialTiles(next.pattern,current.cloisterPlayer);panel.append(tiles.svg);
      updateFieldMarker=tiles.move;
      const legend=next.pattern===zanarkandPatterns[5]?"Small room on the right. Large room on the left.":"The gold dot marks Tidus when he’s in view.";
      panel.append(element("p","field-note",legend));
    }
  }else{
    panel.append(entry("Live puzzle state unavailable","",current?.paused?"Resume the game to see the current puzzle state.":"Enter this temple’s puzzle room for live guidance."));
  }
  const select=options("Temple",cloisterTemples.map(t=>[t.name,t.name]),temple.name,name=>{selectedCloister=name;signature="";render();});
  const controls=element("div","trial-controls");
  controls.append(select,action("Open walkthrough",()=>openGuideSection(temple.anchor),true));
  if(selectedCloister)controls.append(action("Follow current temple",()=>{selectedCloister="";signature="";render();}));
  panel.append(controls);
  panel.append(entry("Destruction treasure",known?done?"Chest opened":"Chest not yet recorded":"Waiting for a save read",
    temple.name==="Zanarkand"&&!done?"Return after gaining free airship travel for the white-square puzzle and destruction treasure.":temple.name==="Bevelle"?"Bevelle’s HP Sphere chest satisfies Anima’s requirement. The extra Knight Lance chest is separate.":"Open the chest itself; merely placing the Destruction Sphere does not record the reward."));
  if(!next)return;
  if(state.sockets){const names=cloisterSockets[state.temple]||{};
    const sheet=element("div","sheet");for(const [index,socket]of state.sockets.entries()){
      if(state.temple==="Kilika"&&socket.id===32&&state.sockets.find(s=>s.id===31)?.value!==4)continue;
      if(state.temple==="Djose"&&socket.id===51&&state.puzzle?.glyph!==2&&next.target!==51)continue;
      const row=entry(names[socket.id]||"Recess "+(index+1),cloisterSphere(temple.name,socket.value));
      if(socket.id===next.target){row.classList.add("journey-next");row.append(element("span","","Next destination"));}sheet.append(row);}
    panel.append(element("h2","","Live recess contents"),sheet);
  }
  if(state.attachments){const sheet=element("div","sheet");for(const [i,sphere]of state.attachments.entries())sheet.append(entry(sphere.name+" Sphere",sphere.owner==="held"?"Carried by Tidus":sphere.owner==="pedestal"?"In the moving pedestal":"Elsewhere in the puzzle"));panel.append(sheet);}
}
