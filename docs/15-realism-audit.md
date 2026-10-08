# 15 — Geographic Realism Audit

The audit has two parts. The first answers the brief's seventeen questions with evidence from the generated world. The second is the automated test suite that runs on every build (`node tools/build.mjs`) and fails loudly if any register entry, river, road, runway or harbour contradicts the terrain. At the end is a list of contradictions found during the build and how each was fixed, and the compromises that remain.

## The seventeen questions

**Do rivers flow downhill?** Yes. Each of the 38 named rivers is carved with a monotonically falling bed and tested: no rises, no blocked samples above 6% of the channel, and every mouth reaches the sea or a lake. Highland rivers fall 37–316 m per km; coastal-plain rivers 1–5 m per km; Lowcountry rivers are tidal throughout.

**Do watersheds make sense?** Yes. Divides follow the crests: the Balsam Crest splits Halcomb into short north-flowing streams and long south-flowing ones; the Coldwater runs along the limestone strike between crest and tableland; Graystone's highland streams wander until they reach the escarpment, then plunge. A depression-filling drainage analysis on a 200 m grid finds closed basins deeper than 1.5 m only on Ossahatchee (swamp) and Wickham (karst sinks) — where closed basins are real.

**Are wetlands located logically?** Yes. Salt marsh below 1.7 m in sheltered water; freshwater marsh and cypress in flat, poorly drained basins; pocosin on peat around the Carolina bays; bottomland forest on floodplains; mangrove only on the southern coast near the keys, at its freeze limit; a mountain bog only in a saddle on impermeable rock.

**Are mountains influencing weather?** Yes. Southerly moist flow is lifted by the Blue Wall and the Balsam Crest's south slopes (2,500 mm a year on the Blue Wall, cove forest and rainforest there); the Coldwater Valley lies in the crest's lee and is drier (pasture, oak–cedar woodlots). Spruce–fir appears only above about 1,850 m, northern hardwoods above about 1,400 m, rime and snow on the high ground in winter, valley fog where cold air drains.

**Are roads following practical terrain?** Yes. Every road was laid out by a grade-constrained search on the terrain and given a vertical alignment within its class limit (interstate 5%, state 8.5%, county 13%, railway 2.2%). I-21 uses the one low saddle through the crest's western spurs (Shady Gap) and needs no tunnel. Mountain roads switchback; the Gate Road and Gap Road need structures because no lower line exists, and those structures are listed with their lengths.

**Are bridges actually necessary?** Yes. Every bridge in the register crosses water or a gorge that the road must cross to reach a settlement or another island; high-rise spans stand only on navigable channels (Ketch Sound, Ambrose Inlet, the Narrows, the ship channel); low trestles and causeways on shallow water. Movable spans (bascule, swing, vertical lift) stand where low bridges cross working waterways.

**Do cities have logical transportation access?** Yes. Calder has two interstates, a passenger railway, three bridges to three islands, ferries and a heliport, with the international airport 15 minutes away on the nearest dry, flat ground. Every town over 2,000 people is on a state highway; every island is bridged or ferried.

**Do industrial areas have freight access?** Yes. Corliss has 15.5 m berths, its own freight railway, an interstate spur and an on-island power station. The Coldwater quarry has a rail spur; the Cutstone granite quarry ships from its own wharf; Bellamy's gins, shellers and elevators sit on the railway.

**Do farms occupy appropriate land?** Yes. Cropland and pasture are assigned only to gentle slopes (under about 9%) on well-drained ground: the Coldwater Valley floor, cove bottoms, the Graystone Piedmont, Bellamy's uplands and Ambrose Main. Wet flats carry pine plantations; floodplains carry bottomland forest.

**Are suburbs expanding logically?** Yes. Calder's suburbs spill across the bridges onto the nearest dry, high ground: Halcomb Heights and Riverside to the north, the Bellamy Bluffs to the south beside the interstate and airport. Smaller towns have no suburbs.

**Are railroads following reasonable grades?** Yes. Active lines are held to 2.2%; the main line follows the Coldwater Valley and Shady Gap. Abandoned lines include a logging tram, a turpentine tram and an excursion line at gentle grades on flat ground, and the Big Laurel cable incline, which is steep by design.

**Do ports have navigable water?** Yes. All 14 harbours were tested against measured depth at the berth: container berths 15.5 m, bulk 14 m, the shipyard 11 m, the city wharves 25 m (scoured river mouth), the Cutstone stone wharf 6 m, fishing harbours 2–6 m, the lake marina 30 m. The ship channel follows the natural trough of Cassena Sound.

**Do airports have appropriate flat land?** Yes. All eight runways sit on flat ground (graded to at most 1% longitudinal slope, with cut and fill recorded), and every 50:1 approach surface is clear of terrain and trees for 4 km, with runway protection zones cleared to grass. The Hickory Tableland runway was moved and re-oriented (06/24) when the first site failed.

**Are power lines connecting logical infrastructure?** Yes. Every line connects a plant or substation at each end (tested). The 500 kV backbone runs from the mainland across The Narrows on 150 m towers, down the Coldwater Valley to the Tennalee Falls Substation; generation feeds in from Calloway (hydro), Corliss (gas), Ocosta (nuclear), Bellamy (solar) and Merrin Shoals (wind, by submarine cable). Water crossings over about 2 km on the 115–230 kV lines run as submarine cables between shore terminals; the Hollow Reach Power Span crosses the mouth of the gorge overhead between headland towers.

**Are flood zones believable?** Yes. Floodplains are where rivers spread out (the Ocosta bottoms, the Coldwater floodplain), storm-surge zones are the land below 3 m (66% of Saint Ambrose, 100% of the Sabal Keys, the filled edges of Calder and most of Corliss), and the towns sit on the highest local ground — Haversham on its bluff, Calder on its granite, Ossahatchee on Long Ridge.

**Are forests distributed according to environment?** Yes. Forest types are assigned by elevation, aspect, curvature, slope, wetness and soil proxies (see the biome tables in each island profile), and the 50 named forests are painted only onto ground that the rules already classify as compatible.

**Are beaches and barrier islands geographically plausible?** Yes. Sandy barriers face open water with enough fetch to build them (the Gulf for Mirabel, the Atlantic for the Gannet Banks and Ambrose Beach), lie in front of lagoons, and break at inlets; low-energy or sand-starved coasts (Wickham, the Sound) have marsh, shell and oyster instead. All 50 beaches are snapped to real shoreline cells (median adjustment 150 m).

## Contradictions found and fixed during the build

| Contradiction | Fix |
|---|---|
| Reservoir pools at Calloway, Hominy and Whitlock stood above adjacent land outside their basins (up to 250 m) — the lakes would have drained. | Reservoirs now flood upstream from a dam barrier and lower their pool until the basin holds; dams moved to sites where the valley actually closes (Calloway: 1.6 km × 63 m at the mouth of the cove, pool 420 m). A final containment pass keeps every lake shore at or above its pool. |
| The Halcomb Gate Shelf sat inside a cliff rim and filled to 360 m, forcing a 392 m-high bridge deck. | The shelf now drains to the gorge; deck height 249 m. |
| The Narrows Road crossed a bay on a 3 km bridge 130 m above the water to reach Big Laurel. | The road ends at Callahan Landing where the North Face cliffs begin; Big Laurel is reached by boat or footpath. |
| An abandoned logging railroad climbed the North Face on 1.7–1.9 km viaducts. | It is a straight cable incline, the realistic way to log a 20% slope. |
| The Hickory Tableland runway's approach was blocked by 112 m of terrain. | Runway moved to level tableland and re-oriented 06/24; all approaches now clear. |
| Trees penetrated approach surfaces at five airports. | Runway protection zones cleared to grass; obstruction clearing in the approaches out to 4 km. |
| The Whitlock Grade was signed at 10% but engineered at 8.5%, producing viaducts. | The road's design grade now follows its signed grade. |
| Bare rock covered 10% of Halcomb. | Rock is now limited to slopes steeper than about 50° and cliff zones (about 3–4%), as in the real southern Appalachians. |
| Land-cover boundaries followed straight lines of latitude in the swamp, and named forests were painted as smooth ellipses. | Boundaries now follow noise and terrain. |
| Several landmarks and viewpoints stood in water or on the wrong island; some "in water" features stood on land. | Positions corrected; the placement test now checks both directions. |
| Some road ends did not meet the network, giving false drive times. | Road ends join the nearest road within 500 m. |
| Register text described Calloway Lake as many-fingered and the Gate Bridge deck at 190 m. | Text matched to the generated terrain. |
| Register text contained historical narrative and invented explanations. | Rewritten as physical description and geographic reasons only. |
| Rivers were cut through summits; reservoirs were rectangular; coastlines were boxy (earlier builds). | Summit restoration after river carving; flood-fill reservoirs; signed-distance coastlines with process-specific noise. |

## Remaining compromises

- **Long viaducts on mountain roads.** The Gap Road has a 3.1 km viaduct on the Pigeonroost side and the Gate Road a 1.6 km curving viaduct below the Bearpen Tunnel, because those valleys fall faster than a state road can descend. Viaducts of this length exist on American mountain highways, but a real designer might choose more switchbacks instead.
- **The Highlands Road on Graystone** is 68 km long to cover 22 km, because it crosses three 400 m gorges at a county-road grade. It is the most winding road in the islands by design, but on the edge of plausibility.
- **Cuts at tunnel portals.** The Gate Road's deepest cut is 83 m at the Bearpen Tunnel approach, deeper than most highway cuts; it reads as a portal cutting in rock.
- **Fault-straight coasts.** At archipelago scale, the southern coasts of Halcomb and Graystone are straight. This is deliberate — they are fault scarps on the edge of the Cassena rift — but it is the least "natural-looking" outline in the islands.
- **Climate values** (rainfall, temperature) are design figures consistent with latitude, elevation and exposure, not outputs of a weather model.
- **Depth shading on the 2D map** shows faint straight edges where water bodies with different depth recipes meet.

<!-- BEGIN GENERATED -->
## Automated checks

| Check | Result |
|---|---|
| Settlements on dry land of the right island | 51 / 51 |
| Districts placed on their island | 50 / 50 |
| Viewpoints placed (bridge and pier decks allowed) | 50 / 50 |
| Landmarks placed (lighthouses, wrecks, bridges allowed in water) | 112 / 112 |
| Beaches snapped to a real shoreline | 50 / 50; median move 0.15 km |
| Summits within 15 m of survey height and a local maximum | 50 / 50 |
| Lakes holding water | 50 / 50 |
| Rivers falling continuously to the sea or a lake | 38 / 38 |
| Roads and rails within class grade limits | 57 / 57 |
| Runway approach surfaces (50:1) clear of terrain and trees | 8 / 8 |
| Harbour berths at design depth | 14 / 14 |
| Open issues | 0 |

### Closed drainage

After drainage enforcement, the only closed depressions deeper than 1.5 m are on islands where they are real wetlands (karst sinks, cypress domes, dune swales):

| Island | Area (km²) | Deepest (m) |
|---|---|---|
| Ossahatchee Island | 1.5 | 11.0 |
| Wickham Island | 1.5 | 8.8 |

### Landmark visibility

Share of all land from which each primary landmark can be seen by a standing person (1 km sample grid, curvature, refraction and canopy):

| Primary landmark | Height (m) | Visible from |
|---|---|---|
| WCDR-TV Mast | 518 | 41% |
| Ledford Dome Tower | 14 | 35% |
| Calder Heights Tower | 210 | 19% |
| Lantern Mountain Radar Dome | 40 | 18% |
| Ocosta Cooling Towers | 165 | 17% |
| Calder Tower | 268 | 16% |
| Grayback Mountain | natural | 13% |
| Corliss Stacks | 180 | 13% |
| Corliss Gantry Cranes | 75 | 6% |
| Long Bridge | 45 | 6% |
| Calloway Dam | 63 | 5% |
| Mirabel Sands | 95 | 4% |
| Kestrel Hill Dune | natural | 4% |
| Tennalee River Bridge | 30 | 3% |
| Merrin Shoals Wind Farm | 230 | 3% |
| Narrows Crossing Towers | 150 | 2% |
| Cape Merrin Lighthouse | 60 | 2% |
| Narrows Bridge | 60 | 2% |
| Gate Bridge | 120 | 1% |
| Callahan North Face | natural | 1% |
| The Blue Wall | natural | 0% |
| Fallon Cliffs | natural | 0% |

### Landmark chains

What each primary landmark sees of the other primaries and the high summits — the network a traveller can steer by:

- **Ledford Dome Tower** → Callahan North Face, Calder Tower, Grayback Mountain, Corliss Stacks, Ocosta Cooling Towers, WCDR-TV Mast, Calloway Dam, Long Bridge, Narrows Bridge, Corliss Gantry Cranes, Calder Heights Tower, Mirabel Sands, Narrows Crossing Towers, Tennalee River Bridge, Ledford Dome, Mount Sawyer, Mount Callahan, Coldspring Knob, Hemlock Knob, Painted Bald, Stormhead Mountain, Blackstrap Knob, Thunderstone Mountain, Huckleberry Knob, Bearpen Knob, Sheepback Bald, Cove Mountain, Rich Mountain, Sugartree Knob, Dogwood Mountain, Whitlock Mountain, Pale Wall Mountain, Anvil Rock, Glassface Dome, Wolfpen Mountain, Grayback Mountain, Iron Mountain
- **Callahan North Face** → Ledford Dome Tower, Narrows Bridge, Narrows Crossing Towers, Ledford Dome, Blackstrap Knob, Thunderstone Mountain
- **Calder Tower** → Ledford Dome Tower, Grayback Mountain, Lantern Mountain Radar Dome, Corliss Stacks, Ocosta Cooling Towers, WCDR-TV Mast, Long Bridge, Corliss Gantry Cranes, Calder Heights Tower, Mirabel Sands, Tennalee River Bridge, Kestrel Hill Dune, Ledford Dome, Mount Sawyer, Coldspring Knob, Hemlock Knob, Painted Bald, Stormhead Mountain, The Steeples, Gooseberry Bald, Huckleberry Knob, Bearpen Knob, Cove Mountain, Brushy Mountain, Sugartree Knob, Dogwood Mountain, Whitlock Mountain, Lantern Mountain, Frostcap, Sassafras Knob, Pale Wall Mountain, Hawkbill Knob, Glassface Dome, Wolfpen Mountain, Grayback Mountain, Kestrel Hill
- **Gate Bridge** → Sassafras Knob, Hawkbill Knob
- **Grayback Mountain** → Ledford Dome Tower, Calder Tower, Lantern Mountain Radar Dome, Corliss Stacks, WCDR-TV Mast, Long Bridge, Corliss Gantry Cranes, Calder Heights Tower, Kestrel Hill Dune, Ledford Dome, Coldspring Knob, Painted Bald, Huckleberry Knob, Dogwood Mountain, Whitlock Mountain, Lantern Mountain, Frostcap, Pale Wall Mountain, Ravenrock, Bald Rock, Hornet Spire, Fallon Knob, Anvil Rock, Glassface Dome, Grayback Mountain, Kestrel Hill
- **Lantern Mountain Radar Dome** → Calder Tower, Grayback Mountain, Corliss Stacks, Long Bridge, Narrows Bridge, Corliss Gantry Cranes, Calder Heights Tower, Narrows Crossing Towers, Mount Sawyer, Hemlock Knob, Big Laurel Top, Dogwood Mountain, Lantern Mountain, Frostcap, Sassafras Knob, Pale Wall Mountain, Ravenrock, Hawkbill Knob, Bald Rock, Hornet Spire, Anvil Rock, Glassface Dome, Grayback Mountain
- **Corliss Stacks** → Ledford Dome Tower, Calder Tower, Grayback Mountain, Lantern Mountain Radar Dome, Ocosta Cooling Towers, WCDR-TV Mast, Cape Merrin Lighthouse, Merrin Shoals Wind Farm, Long Bridge, Corliss Gantry Cranes, Calder Heights Tower, Tennalee River Bridge, Kestrel Hill Dune, Ledford Dome, Mount Sawyer, Coldspring Knob, Hemlock Knob, Painted Bald, Stormhead Mountain, The Steeples, Gooseberry Bald, Huckleberry Knob, Bearpen Knob, Cove Mountain, Brushy Mountain, Sugartree Knob, Dogwood Mountain, Whitlock Mountain, Lantern Mountain, Frostcap, Sassafras Knob, Pale Wall Mountain, Ravenrock, Bald Rock, Hornet Spire, Fallon Knob, Anvil Rock, Glassface Dome, Wolfpen Mountain, Grayback Mountain, Kestrel Hill
- **Ocosta Cooling Towers** → Ledford Dome Tower, Calder Tower, Corliss Stacks, WCDR-TV Mast, Calloway Dam, Long Bridge, Corliss Gantry Cranes, Calder Heights Tower, Mirabel Sands, Ledford Dome, Mount Sawyer, Coldspring Knob, Hemlock Knob, Painted Bald, Stormhead Mountain, The Steeples, Gooseberry Bald, Huckleberry Knob, Bearpen Knob, Cove Mountain, Brushy Mountain, Sugartree Knob, Dogwood Mountain, Glassface Dome, Wolfpen Mountain, Iron Mountain
- **WCDR-TV Mast** → Ledford Dome Tower, Calder Tower, Grayback Mountain, Corliss Stacks, Ocosta Cooling Towers, Calloway Dam, Long Bridge, Corliss Gantry Cranes, Calder Heights Tower, Mirabel Sands, Tennalee River Bridge, Kestrel Hill Dune, Ledford Dome, Mount Sawyer, Coldspring Knob, Hemlock Knob, Painted Bald, Stormhead Mountain, The Steeples, Gooseberry Bald, Huckleberry Knob, Bearpen Knob, Cove Mountain, Brushy Mountain, Sugartree Knob, Dogwood Mountain, Whitlock Mountain, Sassafras Knob, Pale Wall Mountain, Hawkbill Knob, Bald Rock, Anvil Rock, Glassface Dome, Wolfpen Mountain, Grayback Mountain, Iron Mountain, Kestrel Hill
- **Cape Merrin Lighthouse** → Corliss Stacks, Merrin Shoals Wind Farm, Kestrel Hill Dune, Kestrel Hill
- **Merrin Shoals Wind Farm** → Corliss Stacks, Cape Merrin Lighthouse, Kestrel Hill Dune, Kestrel Hill
- **Calloway Dam** → Ledford Dome Tower, Mirabel Sands, Huckleberry Knob, Dogwood Mountain
- **Long Bridge** → Ledford Dome Tower, Calder Tower, Grayback Mountain, Lantern Mountain Radar Dome, Corliss Stacks, Ocosta Cooling Towers, WCDR-TV Mast, Corliss Gantry Cranes, Calder Heights Tower, Ledford Dome, Mount Sawyer, Coldspring Knob, Hemlock Knob, Painted Bald, Stormhead Mountain, The Steeples, Gooseberry Bald, Huckleberry Knob, Bearpen Knob, Cove Mountain, Brushy Mountain, Sugartree Knob, Dogwood Mountain, Whitlock Mountain, Lantern Mountain, Frostcap, Sassafras Knob, Pale Wall Mountain, Ravenrock, Hawkbill Knob, Bald Rock, Hornet Spire, Anvil Rock, Glassface Dome, Wolfpen Mountain, Grayback Mountain
- **Narrows Bridge** → Ledford Dome Tower, Callahan North Face, Lantern Mountain Radar Dome, Narrows Crossing Towers, Ledford Dome, Mount Sawyer, Mount Callahan, Coldspring Knob, Painted Bald, Stormhead Mountain, Blackstrap Knob, Thunderstone Mountain, Sheepback Bald, Rich Mountain, Whitlock Mountain, Lantern Mountain, Hawkbill Knob
- **The Blue Wall** → Anvil Rock
- **Fallon Cliffs** → Hornet Spire, Anvil Rock
- **Corliss Gantry Cranes** → Ledford Dome Tower, Calder Tower, Grayback Mountain, Lantern Mountain Radar Dome, Corliss Stacks, Ocosta Cooling Towers, WCDR-TV Mast, Long Bridge, Calder Heights Tower, Tennalee River Bridge, Ledford Dome, Mount Sawyer, Coldspring Knob, Hemlock Knob, Painted Bald, Stormhead Mountain, The Steeples, Gooseberry Bald, Huckleberry Knob, Bearpen Knob, Cove Mountain, Brushy Mountain, Sugartree Knob, Dogwood Mountain, Whitlock Mountain, Lantern Mountain, Frostcap, Sassafras Knob, Pale Wall Mountain, Ravenrock, Hornet Spire, Fallon Knob, Anvil Rock, Glassface Dome, Wolfpen Mountain, Grayback Mountain
- **Calder Heights Tower** → Ledford Dome Tower, Calder Tower, Grayback Mountain, Lantern Mountain Radar Dome, Corliss Stacks, Ocosta Cooling Towers, WCDR-TV Mast, Long Bridge, Corliss Gantry Cranes, Mirabel Sands, Tennalee River Bridge, Kestrel Hill Dune, Ledford Dome, Mount Sawyer, Coldspring Knob, Hemlock Knob, Painted Bald, Stormhead Mountain, The Steeples, Gooseberry Bald, Huckleberry Knob, Bearpen Knob, Cove Mountain, Brushy Mountain, Sugartree Knob, Dogwood Mountain, Whitlock Mountain, Lantern Mountain, Frostcap, Sassafras Knob, Pale Wall Mountain, Hawkbill Knob, Bald Rock, Hornet Spire, Glassface Dome, Wolfpen Mountain, Grayback Mountain, Kestrel Hill
- **Mirabel Sands** → Ledford Dome Tower, Calder Tower, Ocosta Cooling Towers, WCDR-TV Mast, Calloway Dam, Calder Heights Tower, Ledford Dome, Mount Sawyer, Coldspring Knob, Hemlock Knob, Painted Bald, Stormhead Mountain, The Steeples, Gooseberry Bald, Huckleberry Knob, Bearpen Knob, Sheepback Bald, Cove Mountain, Brushy Mountain, Sugartree Knob, Dogwood Mountain, Wolfpen Mountain
- **Narrows Crossing Towers** → Ledford Dome Tower, Callahan North Face, Lantern Mountain Radar Dome, Narrows Bridge, Mount Sawyer, Mount Callahan, Coldspring Knob, Painted Bald, Stormhead Mountain, Blackstrap Knob, Thunderstone Mountain, Sheepback Bald, Rich Mountain, Whitlock Mountain, Lantern Mountain, Hawkbill Knob
- **Tennalee River Bridge** → Ledford Dome Tower, Calder Tower, Corliss Stacks, WCDR-TV Mast, Corliss Gantry Cranes, Calder Heights Tower, Ledford Dome, Coldspring Knob, Painted Bald, Stormhead Mountain, The Steeples, Gooseberry Bald, Huckleberry Knob, Cove Mountain, Brushy Mountain, Sugartree Knob, Glassface Dome
- **Kestrel Hill Dune** → Calder Tower, Grayback Mountain, Corliss Stacks, WCDR-TV Mast, Cape Merrin Lighthouse, Merrin Shoals Wind Farm, Calder Heights Tower, Dogwood Mountain, Pale Wall Mountain, Hornet Spire, Anvil Rock, Glassface Dome, Wolfpen Mountain, Grayback Mountain, Kestrel Hill

### Road engineering

| Route | Class | Steepest grade | Deepest cut (m) | Highest fill (m) | Structures |
|---|---|---|---|---|---|
| I-21 Interstate 21 | interstate | 5.0% | 16 | 16 | bridge 1,250 m, bridge 2,100 m, bridge 3,475 m |
| I-121 Interstate 121 (Port Spur) | interstate | 3.9% | 0 | 0 | bridge 1,850 m |
| Bay Ave Bay Avenue | arterial | 10.0% | 3 | 3 | — |
| Harbor Blvd Harbor Boulevard | arterial | 1.0% | 0 | 0 | — |
| Heights Ave Heights Avenue | arterial | 5.5% | 0 | 0 | — |
| S Shore Dr South Shore Drive | arterial | 3.0% | 0 | 0 | — |
| W Shore Dr West Shore Drive | arterial | 5.2% | 0 | 0 | — |
| SR 73 Gap Road | state | 8.5% | 32 | 56 | viaduct 925 m, viaduct 300 m, viaduct 850 m, viaduct 3,100 m |
| SR 2 Narrows Road | state | 8.5% | 2 | 2 | — |
| Parkway Balsam Crest Parkway | parkway | 8.0% | 19 | 47 | viaduct 100 m, viaduct 500 m, viaduct 350 m, viaduct 100 m, viaduct 125 m, viaduct 175 m, viaduct 175 m, viaduct 100 m, viaduct 775 m |
| Spur Ledford Dome Road | parkway | 8.0% | 11 | 11 | — |
| SR 28 Cove Road | state | 8.5% | 16 | 39 | bridge 1,500 m, bridge 175 m, viaduct 100 m, bridge 375 m, bridge 1,850 m |
| SR 26 Gate Road | state | 8.5% | 83 | 85 | tunnel 1,650 m, viaduct 1,575 m, bridge 900 m |
| SR 30 Tableland Road | state | 8.5% | 8 | 8 | — |
| CR 21 Old Valley Road | county | 13.0% | 0 | 0 | — |
| CR 8 Hominy Road | county | 13.0% | 1 | 1 | — |
| SR 8 South Shore Road | state | 8.5% | 1 | 1 | — |
| CR 12 Dogwood Point Road | county | 13.0% | 1 | 1 | — |
| CR 28 Calloway Dam Road | county | 13.0% | 14 | 14 | — |
| SR 64 Graystone Coast Road | state | 8.5% | 11 | 11 | — |
| SR 11 Blue Wall Road | state | 8.5% | 11 | 11 | — |
| SR 107 Whitlock Grade | state | 10.0% | 16 | 35 | viaduct 350 m, viaduct 175 m, viaduct 450 m, viaduct 125 m, viaduct 700 m, bridge 1,000 m |
| CR 107 Highlands Road | county | 13.0% | 10 | 10 | — |
| CR 64 Bright Water Road | county | 13.0% | 2 | 2 | — |
| CR 2 Stillhouse Road | county | 13.0% | 15 | 48 | viaduct 625 m |
| SR 17 Coastal Highway | highway | 4.2% | 0 | 0 | bridge 3,000 m, bridge 175 m, bridge 200 m, bridge 175 m, bridge 100 m |
| SR 17 Coastal Highway (Long Ridge) | state | 3.2% | 0 | 0 | — |
| SR 1 Keys Highway | state | 1.8% | 0 | 0 | bridge 2,750 m, bridge 1,775 m, bridge 1,825 m |
| SR 29 The Trail | state | 2.1% | 0 | 0 | bridge 1,450 m |
| CR 31 Tarrow Landing Road | county | 2.3% | 0 | 0 | — |
| SR 40 Cross-Island Highway | state | 8.5% | 3 | 3 | bridge 2,125 m, bridge 550 m, bridge 550 m |
| SR 9 Bellamy Highway | highway | 2.9% | 0 | 0 | — |
| SR 30 Beach Road | state | 4.0% | 0 | 0 | — |
| CR 30 Serena Causeway | county | 6.3% | 0 | 0 | bridge 1,875 m |
| CR 9 Ocosta River Road | county | 3.6% | 0 | 0 | — |
| CR 14 Red Hills Road | county | 4.9% | 0 | 0 | — |
| CR 41 Airport Road (Mirabel) | county | 2.4% | 0 | 0 | — |
| SR 14 Banks Highway | state | 8.5% | 0 | 0 | bridge 1,100 m, bridge 800 m, bridge 700 m, bridge 250 m, bridge 200 m, bridge 1,575 m, bridge 2,300 m, bridge 725 m, bridge 175 m, bridge 1,250 m |
| SR 14 Pennick Road | county | 0.9% | 0 | 0 | — |
| Corliss Ave Corliss Avenue | arterial | 0.2% | 0 | 0 | — |
| CR 19 Sweetwater Road | county | 1.1% | 0 | 0 | — |
| CR 33 Cedar Point Road | county | 0.7% | 0 | 0 | — |
| CR 35 Ferry Landing Road | county | 1.0% | 0 | 0 | — |
| CR 17 Oyster Point Road | county | 3.8% | 0 | 0 | — |
| CR 40 Rice Hope Road | county | 2.7% | 0 | 0 | — |
| Mainland Main Line | active | 2.2% | 11 | 11 | bridge 2,025 m, bridge 325 m, bridge 1,575 m, bridge 100 m, bridge 100 m, bridge 125 m, bridge 100 m |
| Corliss Freight Line | active | 2.2% | 12 | 12 | bridge 5,225 m |
| Calder Passenger Branch | active | 2.2% | 8 | 25 | bridge 1,400 m |
| Bellamy & Southern Railway | active | 2.2% | 0 | 0 | bridge 2,850 m, bridge 1,100 m, bridge 200 m |
| Haversham Branch | active | 2.2% | 0 | 0 | — |
| Coldwater Quarry Spur | active | 2.2% | 2 | 2 | bridge 300 m |
| Ocosta Station Spur | active | 2.2% | 0 | 0 | — |
| Big Laurel Incline | abandoned | 45.0% | 0 | 0 | bridge 100 m, bridge 100 m |
| Blue Wall Incline (unfinished) | abandoned | 6.0% | 49 | 53 | viaduct 300 m, bridge 100 m, viaduct 100 m, viaduct 875 m, tunnel 400 m, tunnel 450 m, viaduct 200 m, tunnel 225 m, viaduct 175 m, viaduct 225 m |
| Ossahatchee Cypress Tram | abandoned | 3.1% | 0 | 0 | — |
| Wickham Turpentine Tram | abandoned | 2.2% | 0 | 0 | — |
| Ambrose Beach Line | abandoned | 3.8% | 0 | 0 | bridge 3,175 m, bridge 3,175 m |
<!-- END GENERATED -->
