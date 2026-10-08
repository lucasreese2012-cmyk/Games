// Settlements of the Cassena Islands. `at` is the historic centre; `r` the
// approximate built-up radius (km); `form` drives land cover and the explorer.
// `why` records the geographic reason the place exists.

export const SETTLEMENTS = [
  // ---- Calder metropolitan area -----------------------------------------
  { id: 'calder', name: 'Calder', island: 'calder', at: [37.6, 61.6], r: 3.9, form: 'city', pop: 362000,
    why: 'Bedrock island at the mouth of the Tennalee, beside the deepest natural water in Cassena Sound; head of ocean navigation and the first high, dry ground below the falls.' },
  { id: 'tennalee-falls', name: 'Tennalee Falls', island: 'halcomb', at: [36.6, 66.4], r: 1.3, form: 'town', pop: 24000,
    why: 'Fall-line town where the Tennalee drops over granite ledges into tidewater: the head of navigation, a mill race, and the narrowest point for the river crossings.' },
  { id: 'riverside', name: 'Riverside', island: 'halcomb', at: [39.2, 65.6], r: 1.0, form: 'suburb', pop: 31000,
    why: 'Low terrace on the east bank of the Tennalee mouth facing downtown Calder; barge wharves, a rail junction and a ferry slip.' },
  { id: 'halcomb-heights', name: 'Halcomb Heights', island: 'halcomb', at: [32.8, 66.0], r: 1.3, form: 'suburb', pop: 28000,
    why: 'Dry, well-drained foothill ridges above the North Channel within a short drive of downtown across the Tennalee River Bridge.' },
  { id: 'corliss', name: 'Corliss', island: 'corliss', at: [46.2, 57.6], r: 1.1, form: 'town', pop: 14000,
    why: 'Worker town on the higher western end of a flat delta-and-spoil island whose east end holds the port, refinery and yards.' },
  { id: 'bellamy-bluffs', name: 'Bellamy Bluffs', island: 'bellamy', at: [30.6, 50.6], r: 1.4, form: 'suburb', pop: 38000,
    why: 'Sandy bluffs at the south end of the Long Bridge: the nearest high, dry ground to the city between the interstate landing and the airport.' },

  // ---- Halcomb Island ----------------------------------------------------
  { id: 'coldwater', name: 'Coldwater', island: 'halcomb', at: [12.4, 79.8], r: 1.1, form: 'town', pop: 9000,
    why: 'County seat in the middle of the limestone Coldwater Valley at the junction of the valley road, the railroad and the plateau road.' },
  { id: 'narrows-landing', name: 'Narrows Landing', island: 'halcomb', at: [12.0, 89.1], r: 0.7, form: 'town', pop: 2600,
    why: 'Bridgehead where the Narrows is narrowest and the Coldwater Valley meets the strait.' },
  { id: 'ledford', name: 'Ledford', island: 'halcomb', at: [26.9, 68.6], r: 1.0, form: 'resort', pop: 4200,
    why: 'Gateway town where the Gap Road leaves the coastal foothills and starts up the Ledford Prong toward the crest.' },
  { id: 'shady-gap', name: 'Shady Gap', island: 'halcomb', at: [14.4, 67.9], r: 0.5, form: 'village', pop: 1100,
    why: 'Low saddle between the Coldwater Valley and the south coast used by the interstate and railroad; truck stops and a rail siding.' },
  { id: 'hominy', name: 'Hominy', island: 'halcomb', at: [22.6, 67.6], r: 0.6, form: 'village', pop: 1500,
    why: 'Head of Hominy Bay, the only sheltered anchorage on the island\'s southwest coast.' },
  { id: 'hickory-flat', name: 'Hickory Flat', island: 'halcomb', at: [5.6, 79.2], r: 0.6, form: 'village', pop: 2400,
    why: 'Plateau-top crossroads on the Hickory Tableland, flat enough for an airport and dry enough for a town.' },
  { id: 'calloway', name: 'Calloway', island: 'halcomb', at: [36.9, 71.6], r: 0.5, form: 'village', pop: 900,
    why: 'Lake village on the gentle east shore of Calloway Lake, the only flat bench near the dam, with marinas in the sheltered coves.' },
  { id: 'upper-cove', name: 'Upper Cove', island: 'halcomb', at: [40.6, 76.6], r: 0.4, form: 'hamlet', pop: 250,
    why: 'Farm hamlet on the flat floor of the upper Tennalee Cove, above the reservoir\'s full-pool line.' },
  { id: 'big-laurel', name: 'Big Laurel', island: 'halcomb', at: [37.2, 87.3], r: 0.4, form: 'village', pop: 700,
    why: 'North-coast cove at the mouth of Big Laurel Creek; the only landing on the steep North Face.' },
  { id: 'pigeonroost', name: 'Pigeonroost', island: 'halcomb', at: [26.4, 88.4], r: 0.35, form: 'hamlet', pop: 300,
    why: 'Where the Gap Road reaches the Narrows at the mouth of Pigeonroost Creek.' },

  // ---- Graystone Island --------------------------------------------------
  { id: 'graystone', name: 'Graystone', island: 'graystone', at: [64.4, 68.2], r: 1.1, form: 'town', pop: 21000,
    why: 'Ferry and quarry town on the island\'s one sheltered south-facing harbor, between the Thunderhole mouth and Quarry Creek.' },
  { id: 'fallon', name: 'Fallon', island: 'graystone', at: [76.6, 88.1], r: 0.6, form: 'town', pop: 3500,
    why: 'Harbor in the only cove breaking the Fallon Cliffs; fishing boats and a rescue-boat station.' },
  { id: 'whitlock', name: 'Whitlock', island: 'graystone', at: [55.4, 83.6], r: 0.7, form: 'resort', pop: 1200,
    why: 'Summer village on the cool highland plateau beside Lake Whitlock, 1,050 m above the sound.' },
  { id: 'cutstone', name: 'Cutstone', island: 'graystone', at: [60.2, 71.6], r: 0.5, form: 'village', pop: 1400,
    why: 'Quarry village beside the granite pit on Cutstone Mountain.' },
  { id: 'bright-water', name: 'Bright Water', island: 'graystone', at: [70.0, 74.4], r: 0.4, form: 'village', pop: 600,
    why: 'Mill village where the Bright Water River leaves the foot of the Blue Wall and its fall can turn a wheel.' },
  { id: 'stillhouse', name: 'Stillhouse', island: 'graystone', at: [56.0, 90.3], r: 0.3, form: 'hamlet', pop: 200,
    why: 'Fishing hamlet at the mouth of Stillhouse Branch on the north shore.' },

  // ---- Bellamy Island ----------------------------------------------------
  { id: 'bellamy', name: 'Bellamy', island: 'bellamy', at: [18.4, 38.6], r: 1.2, form: 'town', pop: 14000,
    why: 'Courthouse town in the middle of the farm plain where the state highways and the shortline railroad cross the Ocosta.' },
  { id: 'harlow', name: 'Harlow', island: 'bellamy', at: [11.4, 44.0], r: 0.5, form: 'village', pop: 1600,
    why: 'Red Hills market village near the kaolin pits.' },
  { id: 'kinard', name: 'Kinard', island: 'bellamy', at: [26.8, 41.6], r: 0.45, form: 'village', pop: 900,
    why: 'Crossroads and grain elevator on the railroad between Bellamy and the Ashwood River bridge.' },
  { id: 'ocosta', name: 'Ocosta', island: 'bellamy', at: [20.4, 31.8], r: 0.5, form: 'village', pop: 2200,
    why: 'River landing at the head of the Ocosta estuary, the upper limit of tidewater barge navigation.' },
  { id: 'sweetwater', name: 'Sweetwater', island: 'bellamy', at: [12.6, 37.2], r: 0.35, form: 'hamlet', pop: 700,
    why: 'Farm hamlet on Sweetwater Creek.' },
  { id: 'dunmore', name: 'Dunmore', island: 'bellamy', at: [14.0, 29.6], r: 0.4, form: 'hamlet', pop: 600,
    why: 'Flatwoods hamlet on the road to the Wickham ferry.' },

  // ---- Mirabel Island ----------------------------------------------------
  { id: 'mirabel-beach', name: 'Mirabel Beach', island: 'mirabel', at: [4.9, 44.6], r: 2.6, form: 'resort', pop: 18000,
    why: 'Widest stretch of the barrier island, directly across Mirabel Sound from the causeway landing.' },
  { id: 'dunewood', name: 'Dunewood', island: 'mirabel', at: [4.6, 36.4], r: 0.6, form: 'resort', pop: 1200,
    why: 'Planned beach village on the high dune section south of Mirabel Beach.' },
  { id: 'port-serena', name: 'Port Serena', island: 'mirabel', at: [4.8, 28.6], r: 0.7, form: 'town', pop: 3000,
    why: 'Marina town on the sheltered lagoon side of the beach-ridge foreland, near the south bridge.' },
  { id: 'seaholly', name: 'Seaholly', island: 'mirabel', at: [5.0, 51.4], r: 0.4, form: 'village', pop: 500,
    why: 'North-end village by the pass into Cassena Sound.' },

  // ---- Saint Ambrose Island ----------------------------------------------
  { id: 'haversham', name: 'Haversham', island: 'saint-ambrose', at: [54.6, 48.4], r: 1.3, form: 'town', pop: 28000,
    why: 'The highest bluff on the island fronting the deepest tidal river: dry ground beside a natural deep-water landing, central to the island\'s farmland.' },
  { id: 'ambrose-beach', name: 'Ambrose Beach', island: 'saint-ambrose', at: [68.4, 46.6], r: 0.8, form: 'resort', pop: 3000,
    why: 'Holocene barrier beach reached by the causeway across the Bonnet River marsh.' },
  { id: 'oyster-point', name: 'Oyster Point', island: 'saint-ambrose', at: [41.4, 52.0], r: 0.4, form: 'village', pop: 800,
    why: 'Shrimping village on Oyster Hammock, the closest high ground to the Corliss fish market.' },
  { id: 'edgewater', name: 'Edgewater', island: 'saint-ambrose', at: [60.4, 49.4], r: 0.5, form: 'village', pop: 900,
    why: 'Village on the sea-island core across the Haversham River from town.' },
  { id: 'kettle', name: 'Kettle', island: 'saint-ambrose', at: [49.6, 32.6], r: 0.4, form: 'hamlet', pop: 600,
    why: 'Hamlet on Kettle Island, the southern sea-island core, where the coastal highway leaves for Ketch Sound.' },
  { id: 'rice-hope', name: 'Rice Hope', island: 'saint-ambrose', at: [45.6, 40.8], r: 0.3, form: 'hamlet', pop: 300,
    why: 'Farm hamlet on the edge of the old rice-field impoundments.' },

  // ---- Wickham Island ----------------------------------------------------
  { id: 'wickham', name: 'Wickham', island: 'wickham', at: [6.4, 16.6], r: 0.35, form: 'hamlet', pop: 280,
    why: 'A store and a few houses on the dry rise above Seacow Spring, where the island road ends.' },
  { id: 'cedar-shoals', name: 'Cedar Shoals', island: 'wickham', at: [10.4, 1.8], r: 0.25, form: 'hamlet', pop: 150,
    why: 'Fish houses on pilings at Cedar Point, the island\'s only harbor.' },
  { id: 'wickham-landing', name: 'Wickham Landing', island: 'wickham', at: [12.6, 20.6], r: 0.2, form: 'hamlet', pop: 60,
    why: 'Ferry slip on the north shore facing Bellamy.' },

  // ---- Ossahatchee Island ------------------------------------------------
  { id: 'ossahatchee', name: 'Ossahatchee', island: 'ossahatchee', at: [59.2, 23.0], r: 0.6, form: 'town', pop: 2600,
    why: 'Dry ground at the north end of Long Ridge where the coastal highway lands from Ketch Sound and the Trail turns west into the swamp.' },
  { id: 'tarrow-landing', name: 'Tarrow Landing', island: 'ossahatchee', at: [61.1, 13.6], r: 0.35, form: 'village', pop: 450,
    why: 'Ferry and seaplane landing where Long Ridge comes closest to Tarrow Sound.' },
  { id: 'tolar', name: 'Tolar', island: 'ossahatchee', at: [53.2, 18.8], r: 0.25, form: 'hamlet', pop: 120,
    why: 'Sawmill hamlet on a dry pine island along the Trail.' },
  { id: 'sabal-landing', name: 'Sabal Landing', island: 'ossahatchee', at: [44.2, 6.4], r: 0.3, form: 'hamlet', pop: 300,
    why: 'Mainland end of the Keys bridges on the marsh coast.' },

  // ---- Gannet Banks ------------------------------------------------------
  { id: 'kestrel', name: 'Kestrel', island: 'gannet', at: [73.4, 23.2], r: 0.7, form: 'resort', pop: 2000,
    why: 'Widest part of Kestrel Island, sheltered behind the big dunes.' },
  { id: 'merrin', name: 'Merrin', island: 'gannet', at: [82.8, 9.4], r: 0.55, form: 'village', pop: 900,
    why: 'Maritime-forest village at the elbow of Cape Merrin with a sound-side harbor.' },
  { id: 'pennick', name: 'Pennick', island: 'gannet', at: [71.0, 3.4], r: 0.4, form: 'village', pop: 400,
    why: 'Ferry-only village on the widest part of Pennick Island.' },
  { id: 'shellbank', name: 'Shellbank', island: 'gannet', at: [77.5, 15.9], r: 0.3, form: 'hamlet', pop: 300,
    why: 'Fishing hamlet beside Sheepshead Inlet.' },

  // ---- Sabal Keys --------------------------------------------------------
  { id: 'sabal', name: 'Sabal', island: 'sabal', at: [44.4, 1.0], r: 0.45, form: 'village', pop: 600,
    why: 'Fishing village on the largest key, at the end of the Keys bridges.' },
  { id: 'cayo-viento', name: 'Cayo Viento', island: 'sabal', at: [52.6, 0.6], r: 0.25, form: 'hamlet', pop: 150,
    why: 'Stilt-house hamlet on the windward key.' },
];
