// Transportation geography of the Cassena Islands.
// Coordinates in world km. Bridges, tunnels, cut and fill are detected from
// the terrain by tools/audit.mjs; the names below label those detected spans.

// Zig-zag a mountain road between two points: `turns` hairpins, `amp` km of
// lateral swing. Real grades come from the audit.
function switchbacks(a, b, turns, amp) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const out = [a];
  for (let k = 1; k <= turns; k++) {
    const t = (k - 0.5) / turns;
    const side = k % 2 ? 1 : -1;
    out.push([a[0] + dx * t + nx * amp * side, a[1] + dy * t + ny * amp * side]);
  }
  out.push(b);
  return out;
}

export const ROADS = [
  // ---- Interstate ---------------------------------------------------------
  { id: 'i-21', name: 'Interstate 21', ref: 'I-21', cls: 'interstate', lanes: 4, box: 2.5, pts: [
    [12.0, 96.0], [12.0, 93.6, 'r'], [12.1, 91.6], [12.2, 90.4], [12.6, 88.6, 'r'], [13.3, 80.4, 'r'], [13.6, 73.0, 'r'],
    [14.3, 68.0, 'r'], [14.8, 66.4, 'r'], [18.4, 66.6, 'r'], [22.6, 68.2, 'r'], [26.4, 67.6, 'r'], [30.0, 66.8, 'r'],
    [32.8, 66.0, 'r'], [33.6, 64.9, 'r'], [33.8, 62.6], [33.9, 61.2], [34.0, 60.4], [34.2, 58.8], [34.3, 57.2],
    [34.4, 56.0], [34.4, 55.0], [33.9, 53.6], [33.3, 52.4], [32.8, 51.2], [32.4, 49.6], [32.0, 47.8], [31.6, 45.8], [30.8, 44.0],
  ] },
  { id: 'i-121', name: 'Interstate 121 (Port Spur)', ref: 'I-121', cls: 'interstate', lanes: 4, pts: [
    [34.0, 60.4], [35.4, 60.3], [37.0, 60.1], [38.6, 59.8], [40.2, 59.6], [41.4, 59.6], [43.8, 59.4], [45.6, 59.4],
    [47.6, 59.8], [49.6, 60.3], [51.6, 60.6], [53.2, 60.6],
  ] },

  // ---- Calder arterials ---------------------------------------------------------
  { id: 'bay-avenue', name: 'Bay Avenue', ref: 'Bay Ave', cls: 'arterial', pts: [[31.2, 61.0], [32.6, 61.9], [34.4, 62.3], [36.0, 62.5], [37.4, 62.4], [38.8, 62.5], [40.0, 62.2], [40.8, 61.4]] },
  { id: 'harbor-boulevard', name: 'Harbor Boulevard', ref: 'Harbor Blvd', cls: 'arterial', pts: [[40.8, 61.4], [41.1, 60.2], [41.0, 59.6], [40.8, 58.4], [40.8, 57.2], [40.0, 56.2]] },
  { id: 'heights-avenue', name: 'Heights Avenue', ref: 'Heights Ave', cls: 'arterial', pts: [[37.2, 62.4], [37.0, 61.2], [36.4, 60.0], [35.8, 59.0], [35.6, 57.8], [35.8, 56.6], [36.2, 55.8]] },
  { id: 'south-shore-drive', name: 'South Shore Drive', ref: 'S Shore Dr', cls: 'arterial', pts: [[31.4, 57.2], [32.6, 56.4], [34.4, 56.0], [36.2, 55.8], [38.2, 55.8], [40.0, 56.2]] },
  { id: 'west-shore-drive', name: 'West Shore Drive', ref: 'W Shore Dr', cls: 'arterial', pts: [[31.2, 61.0], [30.9, 59.6], [31.0, 58.2], [31.4, 57.2]] },

  // ---- Halcomb Island ---------------------------------------------------------
  { id: 'sr-73', name: 'Gap Road', ref: 'SR 73', cls: 'state', box: 4, pts: [
    [26.4, 67.6], [26.8, 68.6], [27.2, 72.0, 'r'], [27.4, 75.2, 'r'], [27.3, 79.7, 'r'], [26.4, 88.4, 'r'],
  ] },
  { id: 'sr-2', name: 'Narrows Road', ref: 'SR 2', cls: 'state', pts: [
    [12.6, 88.6], [15.8, 89.0, 'r'], [19.4, 89.2, 'r'], [22.8, 89.0, 'r'], [26.4, 88.4, 'r'], [29.8, 88.4, 'r'], [33.4, 88.4, 'r'], [37.2, 87.3, 'r'],
  ] },
  { id: 'parkway', name: 'Balsam Crest Parkway', ref: 'Parkway', cls: 'parkway', box: 3, pts: [
    [14.4, 67.8], [16.2, 71.0, 'r'], [17.6, 74.4, 'r'], [21.0, 76.9, 'r'], [24.4, 78.5, 'r'], [27.3, 79.7, 'r'], [30.4, 80.1, 'r'],
    [33.6, 80.3, 'r'], [37.0, 79.9, 'r'], [39.8, 79.2, 'r'], [41.5, 79.0, 'r'], [40.6, 76.6, 'r'],
  ] },
  { id: 'dome-road', name: 'Ledford Dome Road', ref: 'Spur', cls: 'parkway', pts: [[27.3, 79.7], [28.1, 80.15, 'r']] },
  { id: 'sr-28', name: 'Cove Road', ref: 'SR 28', cls: 'state', box: 3, pts: [
    [36.6, 66.4], [36.4, 69.4, 'r'], [36.9, 71.6, 'r'], [38.4, 73.8, 'r'], [40.6, 76.6, 'r'],
  ] },
  { id: 'sr-26', name: 'Gate Road', ref: 'SR 26', cls: 'state', box: 3, pts: [
    [44.4, 67.6], [44.8, 70.2, 'r'], [44.9, 73.6, 'r'], [45.25, 77.0, 'r'], [46.75, 77.1], [47.4, 77.2],
  ] },
  { id: 'sr-30', name: 'Tableland Road', ref: 'SR 30', cls: 'state', box: 2.5, pts: [
    [13.3, 79.8], [12.4, 79.8], [10.4, 79.4, 'r'], [7.0, 79.2, 'r'], [5.6, 79.2, 'r'], [4.4, 76.4, 'r'],
  ] },
  { id: 'old-valley-road', name: 'Old Valley Road', ref: 'CR 21', cls: 'county', pts: [
    [12.0, 89.1], [11.0, 85.0, 'r'], [12.4, 79.8, 'r'], [11.8, 75.4, 'r'], [12.6, 71.0, 'r'], [14.4, 67.9, 'r'],
  ] },
  { id: 'hominy-road', name: 'Hominy Road', ref: 'CR 8', cls: 'county', pts: [[21.0, 67.6], [22.6, 67.6, 'r'], [24.6, 66.8, 'r'], [26.9, 68.6, 'r']] },
  { id: 'south-shore-road', name: 'South Shore Road', ref: 'SR 8', cls: 'state', pts: [
    [26.9, 68.6], [30.2, 67.4, 'r'], [33.4, 66.4, 'r'], [36.6, 66.4, 'r'], [39.2, 65.6, 'r'], [42.0, 66.2, 'r'], [44.4, 67.6, 'r'],
  ] },
  { id: 'dogwood-road', name: 'Dogwood Point Road', ref: 'CR 12', cls: 'county', pts: [[44.4, 67.6], [45.0, 71.4, 'r']] },
  { id: 'hogback-road', name: 'Calloway Dam Road', ref: 'CR 28', cls: 'county', pts: [[36.4, 69.4], [35.7, 70.4, 'r'], [35.0, 70.35], [34.4, 70.6], [33.2, 72.6, 'r']] },

  // ---- Graystone Island -------------------------------------------------------
  { id: 'sr-64', name: 'Graystone Coast Road', ref: 'SR 64', cls: 'state', pts: [
    [64.4, 68.2], [68.0, 69.0, 'r'], [71.8, 69.8, 'r'], [73.6, 73.6, 'r'], [75.2, 77.2, 'r'], [76.4, 80.2, 'r'], [77.4, 83.0, 'r'], [77.8, 85.6, 'r'], [76.6, 88.1, 'r'],
  ] },
  { id: 'sr-11', name: 'Blue Wall Road', ref: 'SR 11', cls: 'state', pts: [
    [64.4, 68.2], [61.6, 68.4, 'r'], [60.2, 71.6, 'r'], [57.0, 73.4, 'r'], [53.4, 74.0, 'r'], [50.0, 75.6, 'r'], [47.4, 77.2, 'r'],
  ] },
  { id: 'sr-107', name: 'Whitlock Grade', ref: 'SR 107', cls: 'state', grade: 0.10, box: 3.5, pts: [
    [57.0, 73.4], [55.4, 83.6, 'r'],
  ] },
  { id: 'highlands-road', name: 'Highlands Road', ref: 'CR 107', cls: 'county', box: 2.5, pts: [
    [55.4, 83.6], [58.1, 83.4, 'r'], [62.0, 84.4, 'r'], [67.0, 85.0, 'r'], [71.6, 86.0, 'r'], [76.6, 88.1, 'r'],
  ] },
  { id: 'bright-water-road', name: 'Bright Water Road', ref: 'CR 64', cls: 'county', pts: [[71.8, 69.8], [70.0, 74.4, 'r'], [66.0, 77.0, 'r']] },
  { id: 'north-shore-gs', name: 'Stillhouse Road', ref: 'CR 2', cls: 'county', box: 3, pts: [[55.4, 83.6], [55.8, 86.6, 'r'], [56.0, 90.3, 'r']] },

  // ---- Coastal highway, Calder to the Keys ------------------------------------
  { id: 'sr-17', name: 'Coastal Highway', ref: 'SR 17', cls: 'highway', lanes: 4, pts: [
    [46.6, 59.55], [47.6, 57.8], [48.4, 56.6], [49.0, 55.6], [49.4, 53.8], [50.4, 52.0], [51.6, 50.4], [53.0, 49.2],
    [54.2, 48.6], [53.6, 46.8], [52.6, 45.0], [51.6, 43.0], [50.8, 41.0], [50.2, 39.0], [49.6, 37.0], [49.4, 35.0],
    [49.6, 32.6], [50.6, 29.6, 'r'], [54.0, 24.6, 'r'], [59.2, 23.0, 'r'],
  ] },
  { id: 'sr-17s', name: 'Coastal Highway (Long Ridge)', ref: 'SR 17', cls: 'state', pts: [
    [59.2, 23.0], [59.6, 18.6, 'r'], [60.0, 13.4, 'r'], [60.0, 8.6, 'r'], [56.8, 9.8, 'r'], [52.4, 9.0, 'r'], [48.6, 7.0, 'r'], [44.2, 6.4, 'r'],
  ] },
  { id: 'keys-highway', name: 'Keys Highway', ref: 'SR 1', cls: 'state', pts: [
    [44.2, 6.4], [44.2, 5.0], [44.0, 3.6], [43.9, 2.0], [44.4, 1.0], [46.2, 0.9], [48.2, 1.5], [50.4, 0.9], [52.6, 0.6],
  ] },
  { id: 'sr-29', name: 'The Trail', ref: 'SR 29', cls: 'state', pts: [
    [59.2, 23.0], [57.6, 21.6], [55.4, 20.0], [53.2, 18.8], [50.6, 18.4], [47.8, 18.0], [45.0, 17.8], [42.2, 17.6],
    [39.4, 17.4], [36.6, 17.2], [33.8, 17.0], [31.0, 16.8], [28.2, 16.8], [25.8, 17.2], [24.4, 17.4], [21.6, 17.6],
    [20.4, 17.4], [18.4, 17.0], [16.4, 16.6], [14.4, 16.4], [12.0, 16.4], [9.6, 16.6], [7.6, 16.6], [6.4, 16.6],
  ] },
  { id: 'tarrow-road', name: 'Tarrow Landing Road', ref: 'CR 31', cls: 'county', pts: [[60.0, 13.4], [61.1, 13.6]] },

  // ---- Bellamy and Mirabel ------------------------------------------------------
  { id: 'sr-40', name: 'Cross-Island Highway', ref: 'SR 40', cls: 'state', pts: [
    [4.9, 44.4], [6.0, 44.2], [7.9, 44.0], [9.4, 43.8], [11.4, 44.0], [13.4, 42.6], [15.6, 40.8], [17.6, 39.2],
    [18.4, 38.6], [20.6, 39.6], [23.0, 40.6], [25.0, 41.2], [26.8, 41.6], [29.0, 42.0], [31.4, 42.2], [37.4, 43.2, 'r'],
    [39.6, 44.0], [42.0, 44.8], [44.6, 45.6], [47.0, 46.4], [49.4, 47.0], [51.6, 47.6], [53.4, 48.2], [54.2, 48.6],
  ] },
  { id: 'sr-9', name: 'Bellamy Highway', ref: 'SR 9', cls: 'highway', lanes: 4, pts: [
    [30.8, 44.0], [28.6, 43.4], [26.4, 42.6], [24.0, 41.2], [21.4, 39.8], [19.0, 38.8], [18.6, 36.6], [18.2, 34.4],
    [17.6, 32.4], [16.6, 30.6], [15.0, 29.4], [13.8, 27.6], [13.0, 26.0],
  ] },
  { id: 'sr-30a', name: 'Beach Road', ref: 'SR 30', cls: 'state', pts: [
    [5.1, 52.6], [5.0, 50.0], [4.9, 47.0], [4.9, 44.4], [4.8, 41.0], [4.6, 38.0], [4.5, 35.0], [4.3, 32.6],
    [4.6, 30.4], [4.8, 28.6], [4.2, 26.8], [3.2, 25.4], [2.4, 24.8],
  ] },
  { id: 'mirabel-south', name: 'Serena Causeway', ref: 'CR 30', cls: 'county', pts: [[4.8, 28.6], [5.6, 29.2], [8.4, 29.6], [10.4, 30.0], [12.6, 30.4, 'r'], [16.6, 30.6, 'r']] },
  { id: 'ocosta-road', name: 'Ocosta River Road', ref: 'CR 9', cls: 'county', pts: [[18.4, 38.6], [19.6, 36.4], [20.2, 34.2], [20.4, 31.8], [23.4, 28.4, 'r'], [24.6, 27.8]] },
  { id: 'harlow-road', name: 'Red Hills Road', ref: 'CR 14', cls: 'county', pts: [[11.4, 44.0], [12.6, 46.4], [14.4, 48.4], [16.6, 49.6], [19.2, 49.4], [21.6, 48.4], [24.2, 47.4], [26.6, 47.6], [29.0, 48.6], [30.6, 50.6]] },
  { id: 'mirreg-road', name: 'Airport Road (Mirabel)', ref: 'CR 41', cls: 'county', pts: [[9.4, 43.8], [9.8, 42.0], [9.9, 40.6]] },

  // ---- Saint Ambrose and the Gannet Banks --------------------------------------
  { id: 'sr-14', name: 'Banks Highway', ref: 'SR 14', cls: 'state', pts: [
    [54.2, 48.6], [56.0, 47.6], [58.0, 47.4], [60.2, 48.6], [62.4, 47.4], [64.4, 46.6], [66.2, 46.4], [68.4, 46.6],
    [68.6, 44.0], [68.8, 42.6], [69.2, 41.5], [69.4, 40.4], [69.3, 37.0], [69.6, 33.5], [69.4, 31.0], [70.1, 29.9],
    [71.1, 28.3], [72.0, 26.4], [73.2, 23.9], [74.4, 21.2], [75.5, 18.8], [76.2, 17.9], [77.0, 16.9], [78.2, 14.8],
    [79.8, 12.6], [81.4, 10.6], [82.8, 9.4], [83.4, 8.4], [82.4, 6.6], [80.4, 5.9], [79.4, 5.7],
  ] },
  { id: 'pennick-road', name: 'Pennick Road', ref: 'SR 14', cls: 'county', pts: [[78.2, 5.3], [76.0, 4.6], [73.0, 3.8], [71.0, 3.4], [68.0, 2.8]] },
  { id: 'oyster-point-road', name: 'Oyster Point Road', ref: 'CR 17', cls: 'county', pts: [[50.4, 52.0], [41.4, 52.0, 'r']] },
  { id: 'kettle-road', name: 'Rice Hope Road', ref: 'CR 40', cls: 'county', pts: [[44.6, 45.6], [45.6, 40.8, 'r'], [49.4, 35.0, 'r']] },
];

export const RAILS = [
  { id: 'main-line', name: 'Mainland Main Line', status: 'active', use: 'freight + passenger', box: 3, pts: [
    [10.8, 96.0], [10.8, 93.0, 'r'], [10.9, 90.8], [11.4, 88.6, 'r'], [12.2, 79.6, 'r'], [13.4, 71.0, 'r'], [14.2, 67.6, 'r'], [14.8, 66.0, 'r'],
    [19.6, 66.0, 'r'], [24.0, 66.6, 'r'], [28.2, 66.0, 'r'], [32.0, 65.4, 'r'], [35.6, 65.9, 'r'], [37.6, 65.9, 'r'], [39.4, 65.9, 'r'],
  ] },
  { id: 'corliss-freight', name: 'Corliss Freight Line', status: 'active', use: 'freight', pts: [
    [39.4, 65.9], [41.2, 65.4, 'r'], [43.0, 63.0], [44.4, 61.0], [46.0, 60.0], [48.0, 59.0], [50.0, 58.6], [52.0, 59.2], [53.6, 60.4],
  ] },
  { id: 'calder-branch', name: 'Calder Passenger Branch', status: 'active', use: 'passenger', pts: [[36.9, 66.0], [37.1, 64.8], [37.3, 63.6], [37.4, 62.6], [37.2, 61.6]] },
  { id: 'bellamy-southern', name: 'Bellamy & Southern Railway', status: 'active', use: 'freight', pts: [
    [48.0, 59.0], [48.6, 57.2], [49.2, 55.6], [49.6, 53.8], [49.0, 51.4], [47.6, 49.4], [45.6, 47.8], [43.2, 46.4],
    [40.6, 45.0], [38.4, 44.0], [36.4, 43.0], [33.0, 42.8], [30.8, 42.2], [28.6, 41.8], [26.8, 41.4], [24.0, 40.6],
    [21.6, 39.6], [19.4, 38.8], [18.6, 36.0], [18.2, 33.4], [17.4, 31.2], [16.2, 29.4], [15.2, 27.6], [14.4, 26.6],
  ] },
  { id: 'haversham-branch', name: 'Haversham Branch', status: 'active', use: 'freight', pts: [[47.6, 49.4], [50.0, 49.0], [52.4, 48.6], [53.8, 48.2]] },
  { id: 'nuclear-spur', name: 'Ocosta Station Spur', status: 'active', use: 'freight', pts: [[17.4, 31.2], [19.4, 30.4], [23.0, 28.4, 'r'], [24.4, 27.8]] },
  { id: 'big-laurel-grade', name: 'Big Laurel Logging Grade', status: 'abandoned', use: 'logging', box: 2, pts: [[37.2, 87.3], [36.6, 84.6, 'r']] },
  { id: 'blue-wall-incline', name: 'Blue Wall Incline (unfinished)', status: 'abandoned', use: 'never completed', pts: [[62.0, 69.8], [62.6, 72.4], [63.4, 74.8], [64.2, 76.8], [64.6, 78.2]] },
  { id: 'swamp-tram', name: 'Ossahatchee Cypress Tram', status: 'abandoned', use: 'logging', pts: [[58.6, 17.0], [55.0, 16.0], [51.0, 14.8], [47.0, 14.6], [44.4, 14.8]] },
  { id: 'turpentine-tram', name: 'Wickham Turpentine Tram', status: 'abandoned', use: 'naval stores', pts: [[13.6, 11.6], [11.0, 11.0], [8.4, 10.6], [6.0, 10.4]] },
  { id: 'beach-line', name: 'Ambrose Beach Line', status: 'abandoned', use: 'excursion', pts: [[53.8, 48.2], [57.0, 45.0], [60.4, 43.0], [63.6, 42.2], [66.2, 41.8], [68.4, 41.8]] },
];

export const BRIDGE_NAMES = [
  { name: 'Narrows Bridge', road: 'i-21', near: [12.1, 91.5], type: 'steel cantilever truss', year: 1963, clearance: 41 },
  { name: 'Narrows Rail Bridge', rail: 'main-line', near: [10.85, 91.5], type: 'through truss with swing span', year: 1911, clearance: 6 },
  { name: 'Tennalee River Bridge', road: 'i-21', near: [33.75, 63.5], type: 'concrete segmental box girder', year: 1971, clearance: 24 },
  { name: 'Market Street Bridge', rail: 'calder-branch', near: [37.25, 63.6], type: 'double-deck vertical lift', year: 1928, clearance: 11 },
  { name: 'Harbor Bridge', road: 'i-121', near: [42.5, 59.5], type: 'steel girder with bascule span', year: 1966, clearance: 18 },
  { name: 'Corliss Lift Bridge', rail: 'corliss-freight', near: [42.6, 63.6], type: 'trestle with vertical lift span', year: 1958, clearance: 46 },
  { name: 'Long Bridge', road: 'i-21', near: [34.0, 53.8], type: 'low trestle with high-rise navigation hump', year: 1969, clearance: 38 },
  { name: 'South Sound Bridge', road: 'sr-17', near: [49.2, 54.7], type: 'twin concrete trestles', year: 1984, clearance: 20 },
  { name: 'South Sound Rail Bridge', rail: 'bellamy-southern', near: [49.4, 54.7], type: 'timber trestle with swing span', year: 1907, clearance: 4 },
  { name: 'Ashwood River Bridge', road: 'sr-40', near: [34.3, 42.5], type: 'concrete high-rise', year: 1994, clearance: 20 },
  { name: 'Ashwood Swing Bridge', rail: 'bellamy-southern', near: [34.4, 42.9], type: 'center-pier swing span', year: 1912, clearance: 3 },
  { name: 'Ketch Sound Bridge', road: 'sr-17', near: [51.9, 27.6], type: 'concrete high-rise', year: 1979, clearance: 20 },
  { name: 'Mirabel Causeway', road: 'sr-40', near: [6.9, 44.1], type: 'causeway with bascule span', year: 1952, clearance: 7 },
  { name: 'Serena Causeway Bridge', road: 'mirabel-south', near: [7.0, 29.4], type: 'causeway with high-rise span', year: 1988, clearance: 19 },
  { name: 'Sawpit Pass Bridge', road: 'sr-29', near: [22.9, 17.5], type: 'steel swing span on timber approaches', year: 1938, clearance: 3 },
  { name: 'Ambrose Inlet Bridge', road: 'sr-14', near: [70.6, 29.1], type: 'concrete high-rise', year: 1990, clearance: 20 },
  { name: 'Sheepshead Inlet Bridge', road: 'sr-14', near: [76.6, 17.4], type: 'concrete high-rise', year: 1975, clearance: 18 },
  { name: 'Bonnet Inlet Bridge', road: 'sr-14', near: [69.1, 41.5], type: 'concrete girder', year: 1966, clearance: 9 },
  { name: 'Haversham River Bridge', road: 'sr-14', near: [55.7, 47.8], type: 'steel bascule', year: 1934, clearance: 8 },
  { name: 'Gate Bridge', road: 'sr-26', near: [46.0, 77.05], type: 'suspension bridge, 1,020 m main span', year: 1979, clearance: 190 },
  { name: 'Sabal Bridges', road: 'keys-highway', near: [44.1, 3.8], type: 'low concrete trestles', year: 1961, clearance: 4 },
  { name: 'Ossahatchee Skyway', road: 'sr-29', near: [41.0, 17.6], type: 'wetland viaduct', year: 2011, clearance: 3 },
];

export const AIRPORTS = [
  { id: 'cdr', name: 'Calder International Airport', code: 'CDR', island: 'bellamy', kind: 'international', elev: 'graded',
    runways: [{ id: '05/23', a: [26.6, 44.6], b: [28.9, 47.1], w: 0.06 }, { id: '18/36', a: [30.4, 44.6], b: [30.4, 47.4], w: 0.046 }],
    terminal: [29.2, 45.4] },
  { id: 'hfy', name: 'Hickory Tableland Airport', code: 'HKT', island: 'halcomb', kind: 'regional',
    runways: [{ id: '06/24', a: [6.02, 74.35], b: [7.58, 75.25], w: 0.03 }], terminal: [6.55, 75.2] },
  { id: 'hvr', name: 'Haversham Regional Airport', code: 'HVR', island: 'saint-ambrose', kind: 'regional',
    runways: [{ id: '04/22', a: [42.4, 46.2], b: [44.0, 47.6], w: 0.03 }], terminal: [43.6, 46.6] },
  { id: 'msr', name: 'Mirabel–Bellamy Regional Airport', code: 'MBR', island: 'bellamy', kind: 'regional',
    runways: [{ id: '01/19', a: [9.5, 38.6], b: [9.9, 41.0], w: 0.046 }], terminal: [10.4, 39.8] },
  { id: 'mrn', name: 'Merrin Airstrip', code: 'MRN', island: 'gannet', kind: 'airfield',
    runways: [{ id: '13/31', a: [81.1, 10.9], b: [81.9, 10.0], w: 0.025 }] },
  { id: 'wkf', name: 'Wickham Forestry Strip', code: '—', island: 'wickham', kind: 'grass strip',
    runways: [{ id: '02/20', a: [8.8, 9.0], b: [9.3, 10.1], w: 0.025 }] },
  { id: 'bag', name: 'Ocosta Ag Strip', code: '—', island: 'bellamy', kind: 'grass strip',
    runways: [{ id: '09/27', a: [24.4, 34.6], b: [25.4, 34.6], w: 0.02 }] },
];

export const HELIPADS = [
  { name: 'Calder Downtown Heliport', at: [40.4, 62.6], note: 'pier heliport' },
  { name: 'Calder General Hospital', at: [36.4, 58.6], note: 'rooftop' },
  { name: 'Ledford Dome Ranger Pad', at: [28.4, 80.0], note: 'gravel pad beside the summit lot' },
  { name: 'Fallon Coast Guard Station', at: [77.0, 88.4], note: 'ground pad' },
  { name: 'Whitlock Fire Base', at: [56.2, 83.0], note: 'seasonal fire helibase' },
  { name: 'Tarrow Landing Seaplane Base', at: [61.4, 13.5], note: 'seaplane ramp' },
];

export const PORTS = [
  { id: 'corliss-container', name: 'Corliss Container Terminal', kind: 'container port', depth: 15.5, berth: [[48.6, 61.6], [54.4, 61.4]] },
  { id: 'corliss-bulk', name: 'Corliss Bulk & Tank Berths', kind: 'bulk and petroleum', depth: 14, berth: [[44.2, 60.9], [46.4, 61.5]] },
  { id: 'corliss-shipyard', name: 'Corliss Shipyard', kind: 'shipyard and drydocks', depth: 11, berth: [[55.4, 60.6], [56.1, 59.0]] },
  { id: 'calder-wharves', name: 'Calder Wharves and Cruise Terminal', kind: 'cruise and breakbulk', depth: 12, berth: [[38.2, 63.0], [40.6, 62.5]] },
  { id: 'riverside-barge', name: 'Riverside Barge Terminal', kind: 'river barges', depth: 4, berth: [[37.8, 64.6], [38.6, 64.4]] },
  { id: 'haversham-docks', name: 'Haversham Shrimp Docks', kind: 'fishing harbor', depth: 5, berth: [[55.1, 48.8], [55.2, 47.6]] },
  { id: 'fallon-harbor', name: 'Fallon Harbor', kind: 'fishing harbor', depth: 6, berth: [[76.8, 88.5], [77.3, 88.6]] },
  { id: 'merrin-harbor', name: 'Merrin Harbor', kind: 'fishing harbor', depth: 3, berth: [[82.2, 10.85], [82.5, 11.0]] },
  { id: 'sabal-fishhouse', name: 'Sabal Fish House', kind: 'fishing dock', depth: 2, berth: [[44.6, 1.6], [44.9, 1.7]] },
  { id: 'port-serena-marina', name: 'Port Serena Marina', kind: 'marina', depth: 3, berth: [[5.6, 28.4], [5.8, 29.0]] },
  { id: 'calder-yacht-basin', name: 'Calder Yacht Basin', kind: 'marina', depth: 4, berth: [[30.8, 58.0], [30.8, 58.8]] },
  { id: 'calloway-marina', name: 'Calloway Marina', kind: 'lake marina', depth: 8, berth: [[36.6, 71.8], [36.7, 72.2]] },
  { id: 'oyster-point-docks', name: 'Oyster Point Docks', kind: 'fishing harbor', depth: 3, berth: [[41.2, 52.6], [41.6, 52.7]] },
];

export const FERRIES = [
  { id: 'graystone-ferry', name: 'Graystone–Calder Ferry', kind: 'vehicle ferry', knots: 16, pts: [[64.2, 67.4], [60.0, 66.0], [54.0, 64.8], [48.0, 64.0], [43.0, 63.5], [40.4, 63.2]] },
  { id: 'wickham-ferry', name: 'Wickham Ferry', kind: 'cable ferry', knots: 6, pts: [[13.0, 25.6], [12.9, 23.4], [12.7, 21.2]] },
  { id: 'rockfish-ferry', name: 'Rockfish Inlet Ferry', kind: 'free vehicle ferry', knots: 9, pts: [[79.4, 5.9], [78.9, 5.4], [78.3, 5.2]] },
  { id: 'tarrow-ferry', name: 'Tarrow Sound Ferry', kind: 'vehicle ferry', knots: 12, pts: [[61.6, 13.4], [65.6, 10.4], [68.0, 6.8], [70.6, 3.8]] },
  { id: 'serena-ferry', name: 'Serena Bay Seasonal Ferry', kind: 'passenger fast ferry', knots: 26, pts: [[30.6, 58.6], [26.0, 57.0], [18.0, 55.4], [10.0, 55.0], [7.4, 53.6], [6.8, 49.0], [6.2, 45.4]] },
];

// Generation and transmission.
export const POWER = {
  plants: [
    { id: 'corliss-gs', name: 'Corliss Generating Station', at: [53.6, 57.4], kind: 'gas combined-cycle with two retired coal stacks', mw: 1850, stacks: 2, stackH: 180 },
    { id: 'calloway-hydro', name: 'Calloway Dam Powerhouse', at: [35.1, 70.0], kind: 'hydroelectric', mw: 300 },
    { id: 'ocosta-nuclear', name: 'Ocosta Nuclear Station', at: [24.6, 27.6], kind: 'two-unit pressurized-water reactor with hyperbolic cooling towers', mw: 2300, towers: 2, towerH: 165 },
    { id: 'bellamy-solar', name: 'Bellamy Solar Farm', at: [21.6, 44.2], kind: 'utility photovoltaic', mw: 150, area: [[20.6, 43.6], [22.6, 43.6], [22.6, 44.8], [20.6, 44.8]] },
    { id: 'merrin-wind', name: 'Merrin Shoals Offshore Wind', at: [93.0, 14.0], kind: 'offshore wind, 28 turbines', mw: 380 },
  ],
  substations: [
    { id: 'narrows-sub', name: 'Narrows Substation', at: [12.8, 88.2] },
    { id: 'falls-sub', name: 'Tennalee Falls Substation', at: [35.8, 66.8] },
    { id: 'calder-north-sub', name: 'Calder North Substation', at: [35.0, 61.6] },
    { id: 'corliss-sub', name: 'Corliss Substation', at: [52.4, 58.2] },
    { id: 'bellamy-sub', name: 'Bellamy Substation', at: [19.4, 40.2] },
    { id: 'airport-sub', name: 'Bluffs Substation', at: [31.6, 48.8] },
    { id: 'haversham-sub', name: 'Haversham Substation', at: [53.4, 46.8] },
    { id: 'graystone-sub', name: 'Graystone Substation', at: [63.2, 68.8] },
    { id: 'ossahatchee-sub', name: 'Long Ridge Substation', at: [59.4, 21.4] },
    { id: 'kestrel-sub', name: 'Kestrel Substation', at: [73.0, 24.4] },
  ],
  lines: [
    { kv: 500, from: 'mainland', to: 'narrows-sub', pts: [[13.6, 96.0], [13.6, 92.6], [13.4, 90.2], [12.8, 88.2]], note: '150 m crossing towers either side of the Narrows' },
    { kv: 500, from: 'narrows-sub', to: 'falls-sub', pts: [[12.8, 88.2], [13.8, 84.0], [14.2, 78.0], [14.6, 72.0], [14.8, 68.6], [17.0, 67.0], [22.0, 68.8], [27.0, 69.4], [31.0, 68.0], [35.8, 66.8]] },
    { kv: 230, from: 'calloway-hydro', to: 'falls-sub', pts: [[35.1, 70.0], [35.4, 68.4], [35.8, 66.8]] },
    { kv: 230, from: 'falls-sub', to: 'calder-north-sub', pts: [[35.8, 66.8], [35.4, 64.8], [35.2, 63.0], [35.0, 61.6]], note: 'tall towers across the North Channel' },
    { kv: 230, from: 'corliss-gs', to: 'corliss-sub', pts: [[53.6, 57.4], [52.4, 58.2]] },
    { kv: 230, from: 'corliss-sub', to: 'calder-north-sub', pts: [[52.4, 58.2], [47.0, 58.6], [42.6, 59.0], [39.0, 60.2], [35.0, 61.6]] },
    { kv: 500, from: 'ocosta-nuclear', to: 'bellamy-sub', pts: [[24.6, 27.6], [23.0, 31.0], [21.4, 35.0], [20.2, 38.0], [19.4, 40.2]] },
    { kv: 500, from: 'bellamy-sub', to: 'airport-sub', pts: [[19.4, 40.2], [23.0, 43.6], [27.0, 45.0], [31.6, 48.8]] },
    { kv: 230, from: 'airport-sub', to: 'calder-north-sub', pts: [[31.6, 48.8], [32.6, 51.4], [33.2, 55.2], [34.0, 58.4], [35.0, 61.6]], note: 'crossing towers on Sound Point and the Calder south shore' },
    { kv: 230, from: 'corliss-sub', to: 'haversham-sub', pts: [[52.4, 58.2], [50.6, 55.4], [50.6, 53.4], [52.0, 50.2], [53.4, 46.8]] },
    { kv: 115, from: 'haversham-sub', to: 'ossahatchee-sub', pts: [[53.4, 46.8], [51.2, 42.0], [50.0, 36.0], [50.6, 30.0], [52.6, 26.2], [56.0, 23.8], [59.4, 21.4]] },
    { kv: 115, from: 'haversham-sub', to: 'kestrel-sub', pts: [[53.4, 46.8], [58.0, 47.2], [64.0, 46.6], [68.6, 44.0], [69.4, 36.0], [70.2, 30.0], [72.0, 26.4], [73.0, 24.4]] },
    { kv: 115, from: 'falls-sub', to: 'graystone-sub', pts: [[35.8, 66.8], [40.0, 65.6], [44.4, 67.4], [48.4, 69.0], [53.0, 68.6], [58.0, 68.4], [63.2, 68.8]], note: 'Hollow Reach crossing span at the south mouth' },
    { kv: 230, from: 'merrin-wind', to: 'kestrel-sub', pts: [[93.0, 14.0], [80.0, 20.0], [74.6, 23.4], [73.0, 24.4]], note: 'buried export cable, landfall at Kestrel' },
  ],
};

// Water, waste and communications infrastructure.
export const UTILITIES = [
  { kind: 'water-treatment', name: 'Tennalee Water Works', at: [36.0, 67.0], note: 'river intake above the falls' },
  { kind: 'water-treatment', name: 'Ocosta Water Plant', at: [19.0, 43.0], note: 'draws from Lake Ocosta' },
  { kind: 'wastewater', name: 'Calder Southside Treatment Plant', at: [37.8, 55.6] },
  { kind: 'wastewater', name: 'Corliss Industrial Wastewater', at: [55.0, 57.6] },
  { kind: 'wastewater', name: 'Haversham Treatment Plant', at: [55.8, 46.4] },
  { kind: 'wastewater', name: 'Mirabel Beach Treatment Plant', at: [5.4, 41.6] },
  { kind: 'landfill', name: 'Corliss Landfill', at: [51.5, 57.3], note: 'capped mound, 48 m' },
  { kind: 'landfill', name: 'Bellamy County Landfill', at: [24.6, 37.6] },
  { kind: 'recycling', name: 'Corliss Scrap and Recycling', at: [44.8, 58.0] },
  { kind: 'quarry', name: 'Cutstone Granite Quarry', at: [59.6, 70.3] },
  { kind: 'quarry', name: 'Coldwater Limestone Quarry', at: [14.6, 84.0] },
  { kind: 'quarry', name: 'Harlow Kaolin Pits', at: [11.9, 46.6] },
  { kind: 'quarry', name: 'Wickham Phosphate Pits (abandoned)', at: [17.8, 7.8] },
  { kind: 'mast', name: 'WCDR-TV Mast', at: [22.6, 43.0], height: 518 },
  { kind: 'mast', name: 'Lantern Mountain Radar Dome', at: [63.5, 87.4], height: 40 },
  { kind: 'mast', name: 'Coldspring Knob Relay Towers', at: [25.5, 79.3], height: 60 },
  { kind: 'mast', name: 'Calder Heights Broadcast Tower', at: [35.5, 58.6], height: 210 },
  { kind: 'fire-tower', name: 'Scrub Hill Fire Tower', at: [13.5, 14.0], height: 30 },
  { kind: 'fire-tower', name: 'Highpine Fire Tower', at: [60.0, 14.0], height: 30 },
  { kind: 'fire-tower', name: 'Gooseberry Fire Tower', at: [17.0, 75.0], height: 18 },
  { kind: 'distribution', name: 'Bluffs Logistics Park', at: [31.0, 48.6], note: 'warehouses along I-21' },
  { kind: 'distribution', name: 'Shady Gap Truck Plaza', at: [14.6, 67.4] },
  { kind: 'industrial', name: 'Corliss Refinery', at: [45.4, 60.0] },
  { kind: 'industrial', name: 'Corliss Kraft Paper Mill', at: [49.6, 57.0] },
  { kind: 'industrial', name: 'Tennalee Falls Mill District', at: [36.9, 65.8] },
  { kind: 'industrial', name: 'Bellamy Peanut Shellers and Cotton Gin', at: [19.2, 37.8] },
];
