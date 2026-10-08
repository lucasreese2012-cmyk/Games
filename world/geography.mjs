// THE CASSENA ISLANDS — physical geography source data.
//
// Units: kilometres in world space, x east / y north, origin near the SW of
// Wickham Island. Elevations are metres above mean sea level.
// One world km ≈ 0.009° latitude; the frame spans roughly 29.55°N–30.45°N.
//
// Everything that shapes the terrain lives here. Prose about these places
// lives in world/registers/*.mjs and docs/.

import { strip, ellipse, smoothPoly } from '../tools/lib/geom.mjs';

export const WORLD = {
  name: 'The Cassena Islands',
  bounds: { x0: -10, y0: -4, x1: 100, y1: 96 },
  cell: 0.05, // 50 m terrain grid
  seed: 1907,
  latitude: { y0: 29.55, kmPerDeg: 111.0 },
};

// ---------------------------------------------------------------------------
// Named summits. Ridges below reference these ids so a peak's coordinates and
// elevation exist in exactly one place.
// ---------------------------------------------------------------------------
export const PEAKS = {
  // Halcomb Island — Balsam Crest and spurs
  'ledford-dome': { name: 'Ledford Dome', island: 'halcomb', at: [29.0, 80.3], z: 2047 },
  'mount-sawyer': { name: 'Mount Sawyer', island: 'halcomb', at: [32.5, 80.8], z: 1985 },
  'mount-callahan': { name: 'Mount Callahan', island: 'halcomb', at: [33.0, 84.0], z: 1955 },
  'coldspring-knob': { name: 'Coldspring Knob', island: 'halcomb', at: [25.5, 79.3], z: 1905 },
  'hemlock-knob': { name: 'Hemlock Knob', island: 'halcomb', at: [35.8, 80.5], z: 1872 },
  'painted-bald': { name: 'Painted Bald', island: 'halcomb', at: [22.5, 78.0], z: 1745 },
  'stormhead': { name: 'Stormhead Mountain', island: 'halcomb', at: [19.5, 76.6], z: 1640 },
  'the-steeples': { name: 'The Steeples', island: 'halcomb', at: [38.8, 79.8], z: 1620 },
  'blackstrap-knob': { name: 'Blackstrap Knob', island: 'halcomb', at: [29.9, 83.6], z: 1520 },
  'thunderstone': { name: 'Thunderstone Mountain', island: 'halcomb', at: [23.5, 83.5], z: 1450 },
  'gooseberry-bald': { name: 'Gooseberry Bald', island: 'halcomb', at: [17.0, 75.0], z: 1420 },
  'big-laurel-top': { name: 'Big Laurel Top', island: 'halcomb', at: [39.5, 84.0], z: 1380 },
  'huckleberry-knob': { name: 'Huckleberry Knob', island: 'halcomb', at: [35.0, 77.4], z: 1330 },
  'bearpen-knob': { name: 'Bearpen Knob', island: 'halcomb', at: [43.5, 78.0], z: 1320 },
  'sheepback-bald': { name: 'Sheepback Bald', island: 'halcomb', at: [16.2, 77.8], z: 1280 },
  'cove-mountain': { name: 'Cove Mountain', island: 'halcomb', at: [30.6, 75.6], z: 1240 },
  'brushy-mountain': { name: 'Brushy Mountain', island: 'halcomb', at: [25.2, 75.2], z: 1210 },
  'rich-mountain': { name: 'Rich Mountain', island: 'halcomb', at: [18.6, 81.6], z: 1180 },
  'sugartree-knob': { name: 'Sugartree Knob', island: 'halcomb', at: [20.3, 73.0], z: 1150 },
  'dogwood-mountain': { name: 'Dogwood Mountain', island: 'halcomb', at: [42.4, 74.2], z: 1050 },
  'pinnacle-knob': { name: 'Pinnacle Knob', island: 'halcomb', at: [16.4, 71.4], z: 820 },
  'chestnut-knob': { name: 'Chestnut Knob', island: 'halcomb', at: [24.6, 71.0], z: 780 },
  'copperhead-knob': { name: 'Copperhead Knob', island: 'halcomb', at: [15.5, 80.6], z: 690 },
  'hogback': { name: 'The Hogback', island: 'halcomb', at: [38.4, 69.4], z: 640 },
  'hickory-knob': { name: 'Hickory Knob', island: 'halcomb', at: [5.6, 85.0], z: 585 },
  'lookout-bluff': { name: 'Lookout Bluff', island: 'halcomb', at: [4.3, 76.0], z: 495 },

  // Graystone Island — highlands, Blue Wall, Piedmont strip
  'whitlock-mountain': { name: 'Whitlock Mountain', island: 'graystone', at: [58.0, 85.4], z: 1724 },
  'lantern-mountain': { name: 'Lantern Mountain', island: 'graystone', at: [63.5, 87.4], z: 1652 },
  'frostcap': { name: 'Frostcap', island: 'graystone', at: [68.2, 87.6], z: 1560 },
  'sassafras-knob': { name: 'Sassafras Knob', island: 'graystone', at: [53.6, 82.2], z: 1480 },
  'pale-wall': { name: 'Pale Wall Mountain', island: 'graystone', at: [56.0, 80.8], z: 1440 },
  'ravenrock': { name: 'Ravenrock', island: 'graystone', at: [71.5, 86.6], z: 1390 },
  'hawkbill-knob': { name: 'Hawkbill Knob', island: 'graystone', at: [52.4, 86.6], z: 1310 },
  'bald-rock': { name: 'Bald Rock', island: 'graystone', at: [61.0, 83.4], z: 1260 },
  'hornet-spire': { name: 'Hornet Spire', island: 'graystone', at: [69.6, 83.6], z: 1210 },
  'fallon-knob': { name: 'Fallon Knob', island: 'graystone', at: [74.4, 86.9], z: 1180 },
  'anvil-rock': { name: 'Anvil Rock', island: 'graystone', at: [64.2, 80.4], z: 1120 },
  'glassface-dome': { name: 'Glassface Dome', island: 'graystone', at: [57.6, 75.9], z: 1060 },
  'wolfpen-mountain': { name: 'Wolfpen Mountain', island: 'graystone', at: [51.0, 77.6], z: 1050 },
  'lookoff-mountain': { name: 'Lookoff Mountain', island: 'graystone', at: [50.8, 72.2], z: 640 },
  'grayback': { name: 'Grayback Mountain', island: 'graystone', at: [66.2, 73.6], z: 455 },
  'cutstone-mountain': { name: 'Cutstone Mountain', island: 'graystone', at: [58.8, 71.2], z: 360 },
  'graystone-head': { name: 'Graystone Head', island: 'graystone', at: [73.6, 70.7], z: 210 },

  // Lowland "mountains" — hills that carry the name locally
  'iron-mountain': { name: 'Iron Mountain', island: 'bellamy', at: [14.5, 47.5], z: 118 },
  'sugarloaf-hill': { name: 'Sugarloaf Hill', island: 'bellamy', at: [17.4, 49.7], z: 104 },
  'calder-heights': { name: 'Calder Heights', island: 'calder', at: [35.5, 58.6], z: 92 },
  'scrub-hill': { name: 'Scrub Hill', island: 'wickham', at: [13.5, 14.0], z: 76 },
  'firetower-hill': { name: 'Fire Tower Hill', island: 'wickham', at: [13.2, 7.5], z: 70 },
  'highpine-knoll': { name: 'Highpine Knoll', island: 'ossahatchee', at: [60.0, 14.0], z: 44 },
  'kestrel-hill': { name: 'Kestrel Hill', island: 'gannet', at: [73.3, 23.9], z: 28 },
};

// ---------------------------------------------------------------------------
// Land masses. `warp` roughens the coast (domain warp, km). `base` selects the
// elevation recipe in tools/terrain.mjs.
// ---------------------------------------------------------------------------
const mirabelStrip = strip([
  [5.3, 53.2, 0.9], [5.05, 50.5, 1.4], [4.9, 47.0, 1.9], [4.8, 43.0, 2.0],
  [4.7, 39.0, 1.8], [4.45, 35.0, 1.9], [4.0, 31.5, 2.4],
]);
const kestrelStrip = strip([
  [70.9, 28.5, 0.5], [72.0, 26.5, 0.8], [73.2, 24.0, 1.2], [74.4, 21.2, 0.9],
  [75.5, 18.8, 0.6], [76.15, 17.85, 0.45],
]);
const gannetStrip = strip([
  [76.95, 16.95, 0.45], [78.2, 14.8, 0.6], [79.8, 12.6, 0.8], [81.6, 10.5, 1.3],
  [83.2, 9.0, 2.0], [84.3, 8.4, 1.4], [83.8, 7.3, 0.9], [82.2, 6.4, 0.7],
  [80.4, 5.85, 0.5], [79.3, 5.6, 0.4],
]);
const pennickStrip = strip([
  [78.4, 5.35, 0.4], [76.0, 4.6, 0.6], [73.0, 3.8, 0.8], [70.0, 3.1, 0.6],
  [67.0, 2.6, 0.5], [65.3, 2.3, 0.35],
]);
const ambroseBeachN = strip([[67.0, 51.2, 0.9], [68.2, 48.0, 1.1], [68.9, 45.0, 1.0], [68.6, 42.6, 0.8]]);
const ambroseBeachS = strip([[69.4, 40.4, 0.8], [69.3, 37.0, 1.0], [69.6, 33.5, 1.0], [69.2, 30.6, 0.8]]);


// Drowned valleys that separate the southern islands. Each vertex is
// [x, y, widthKm]; the centrelines double as the shared island boundaries.
export const KETCH = [[-12, 21.0, 4.0], [-6, 21.4, 3.2], [-2, 22.4, 2.4], [1, 23.4, 1.8], [4, 23.0, 1.5], [7, 22.0, 1.6], [10, 22.6, 2.4], [13, 24.6, 2.8], [16, 25.4, 2.0], [19, 24.4, 1.6], [21.5, 23.0, 2.2], [23.5, 22.8, 1.8], [26, 24.0, 1.4], [28.5, 25.6, 1.8], [31, 25.0, 1.6], [33.6, 26.0, 1.9], [36, 27.6, 1.4], [38.5, 28.6, 1.2], [41, 28.0, 1.5], [43.5, 26.6, 1.4], [46, 25.8, 1.2], [48.5, 26.4, 1.1], [51, 27.8, 1.4], [53.5, 28.8, 1.8], [56, 28.4, 1.5], [58.5, 27.4, 1.4], [61, 27.4, 1.6], [63.5, 28.2, 2.4], [66, 27.6, 3.4], [68, 27.0, 4.0]];
export const ASHWOOD = [[34.6, 53.5, 2.0], [34.4, 52.6, 2.6], [35.2, 50.6, 2.4], [35.6, 48.4, 1.8], [34.6, 46.4, 1.3], [33.8, 44.4, 1.4], [34.2, 42.4, 1.1], [35.4, 40.6, 1.3], [35.8, 38.4, 1.7], [35.0, 36.4, 1.4], [34.0, 34.6, 1.1], [34.2, 32.6, 1.3], [35.2, 30.8, 1.7], [35.4, 28.8, 2.0], [33.6, 26.0, 1.9]];
export const SAWPIT = [[23.5, 22.8, 1.8], [21.6, 20.6, 1.4], [22.4, 18.0, 1.5], [24.0, 15.6, 1.2], [23.2, 13.0, 1.6], [21.8, 10.6, 1.3], [22.6, 8.0, 1.4], [23.6, 5.4, 1.8], [23.0, 2.4, 2.4], [22.4, -1.0, 3.0]];
export const MIRABEL_SOUND = [[7.2, 55.0, 1.8], [7.2, 52.0, 1.5], [7.2, 49.0, 1.3], [7.3, 46.0, 1.2], [7.2, 43.0, 1.4], [7.3, 40.0, 1.5], [7.2, 37.0, 1.4], [7.3, 34.0, 1.2], [7.3, 31.0, 1.0], [7.4, 28.5, 1.0], [7.5, 25.5, 1.3], [7.3, 22.6, 1.6]];
const xy = (pts) => pts.map((p) => [p[0], p[1]]);
const seg = (pts, x0, x1, key = 0) => pts.filter((p) => p[key] >= Math.min(x0, x1) && p[key] <= Math.max(x0, x1));
const shift = (pts, dx, dy) => pts.map((p) => [p[0] + dx, p[1] + dy]);

export const ISLANDS = [
  {
    id: 'mainland', name: 'Mainland (off-world)', type: 'mainland', offworld: true,
    polys: [[[-12, 92.6], [-4, 92.3], [0, 92.4], [4, 92.0], [7, 92.3], [9.5, 92.4], [11, 92.0], [12.0, 91.9], [13.2, 92.1], [15, 92.6], [17.5, 92.3], [20, 93.0], [23, 92.7], [26, 92.6], [29, 93.2], [31.5, 93.4], [34, 92.9], [37, 93.0], [40, 93.6], [42.5, 93.8], [44.5, 94.4], [46.2, 95.4], [47.2, 96.4], [47.6, 100], [-12, 100]]],
    coast: { a1: 0.6, s1: 8, a2: 0.3, s2: 2, a3: 0.1, s3: 0.5 },
    base: { kind: 'mainland' },
  },
  {
    id: 'halcomb', name: 'Halcomb Island', type: 'Appalachian highland',
    polys: [smoothPoly([[1.6,77.0],[2.0,80.4],[3.0,83.6],[4.6,86.4],[6.8,87.4],[8.6,87.6],[9.6,88.2],[10.2,88.7],[11.0,89.6],[12.2,90.5],[14.0,90.0],[16.5,90.4],[19.5,90.6],[22.5,90.2],[25.0,89.6],[26.3,88.9],[27.8,89.4],[30.4,89.6],[32.8,89.4],[35.0,88.6],[37.0,88.0],[39.0,87.6],[41.0,87.0],[42.8,86.8],[44.2,86.0],[45.0,84.6],[45.5,82.0],[45.4,79.0],[45.65,77.0],[45.5,74.5],[45.7,72.0],[45.6,69.5],[45.0,67.8],[43.8,66.8],[42.0,65.8],[40.4,65.0],[39.0,64.5],[37.4,64.4],[35.6,64.6],[33.8,64.4],[32.0,64.2],[30.4,64.8],[28.8,65.8],[27.4,66.4],[26.4,66.0],[25.0,66.2],[23.4,66.0],[22.2,66.8],[21.0,65.8],[19.4,64.8],[17.4,64.2],[15.0,63.8],[12.6,64.2],[10.4,65.0],[8.4,66.0],[6.4,67.4],[4.4,69.6],[2.8,72.4],[1.9,74.8]], 3)],
    coast: { a1: 1.0, s1: 10, a2: 0.45, s2: 3, a3: 0.1, s3: 0.5 },
    base: { kind: 'mountain', floor: 25, inland: 470, rise: 7, hills: 380 },
  },
  {
    id: 'graystone', name: 'Graystone Island', type: 'Mountainous escarpment',
    polys: [smoothPoly([[48.2,68.4],[48.8,70.6],[48.4,72.8],[47.6,74.6],[46.8,76.2],[46.5,77.3],[47.2,78.4],[48.2,79.8],[48.75,81.0],[48.8,82.8],[48.4,84.8],[48.6,86.8],[49.6,88.6],[51.2,90.0],[53.4,90.8],[55.8,91.5],[58.4,91.3],[61.0,91.9],[63.5,92.3],[66.2,92.0],[68.8,91.0],[71.4,90.2],[73.8,89.8],[75.8,89.9],[77.4,89.7],[77.6,89.0],[76.8,88.5],[77.4,87.8],[78.6,87.4],[79.6,86.4],[80.2,84.8],[79.6,83.4],[78.6,82.0],[77.4,80.6],[76.6,79.2],[75.2,77.8],[74.2,76.2],[73.6,74.6],[73.8,72.6],[74.6,71.0],[75.2,69.4],[74.4,68.2],[73.0,68.0],[72.0,68.4],[70.4,68.4],[68.6,68.0],[66.8,67.4],[65.2,67.0],[64.4,66.6],[63.2,66.8],[62.4,66.4],[61.2,66.8],[59.6,67.6],[58.0,68.6],[56.6,67.6],[55.0,66.6],[53.4,66.8],[51.8,67.4],[50.0,67.6]], 3)],
    coast: { a1: 0.8, s1: 9, a2: 0.35, s2: 2.6, a3: 0.08, s3: 0.5 },
    base: { kind: 'mountain', floor: 20, inland: 230, rise: 4.5, hills: 220 },
  },
  {
    id: 'calder', name: 'Calder Island', type: 'Dense urban',
    polys: [[[30.7,59.0],[30.9,60.4],[31.4,61.4],[32.4,62.0],[33.6,62.4],[34.8,62.6],[36.0,62.9],[37.2,63.0],[38.4,63.0],[39.4,62.8],[40.3,62.4],[41.0,61.7],[41.5,60.9],[41.8,60.0],[41.6,59.0],[41.3,58.2],[41.6,57.3],[41.4,56.5],[40.8,55.8],[39.8,55.3],[38.6,55.1],[37.4,55.3],[36.2,55.1],[35.0,54.9],[33.8,55.0],[32.8,55.4],[31.9,56.0],[31.2,56.9],[30.8,57.9]]],
    coast: { a1: 0.08, s1: 5, a2: 0.035, s2: 1.2, a3: 0.012, s3: 0.3 },
    base: { kind: 'urban' },
  },
  {
    id: 'corliss', name: 'Corliss Island', type: 'Industrial',
    polys: [[[43.5,58.4],[43.6,59.8],[44.2,60.8],[45.2,61.3],[46.6,61.6],[48.2,61.7],[49.8,61.5],[51.4,61.6],[53.0,61.7],[54.4,61.3],[55.4,60.6],[56.1,59.6],[56.3,58.6],[55.8,57.6],[55.0,57.0],[53.8,56.5],[52.4,56.1],[51.0,55.8],[49.6,55.7],[48.2,55.5],[46.8,55.4],[45.6,55.6],[44.5,56.1],[43.8,57.0]]],
    coast: { a1: 0.08, s1: 4, a2: 0.04, s2: 1, a3: 0.015, s3: 0.3 },
    base: { kind: 'delta' },
  },
  {
    id: 'bellamy', name: 'Bellamy Island', type: 'Agricultural',
    polys: [[[7.0, 53.0], [7.8, 53.4], [9.0, 53.8], [10.4, 54.0], [11.4, 53.2], [11.8, 52.0], [12.8, 51.2], [13.6, 50.4], [14.6, 50.2], [15.4, 50.9], [16.2, 52.0], [17.6, 52.4], [19.2, 52.0], [20.4, 52.6], [21.8, 53.0], [23.0, 52.8], [24.0, 52.2], [25.0, 52.5], [26.4, 53.0], [28.0, 52.9], [29.6, 52.4], [31.0, 52.2], [32.2, 51.8], [33.2, 51.8], ...shift(ASHWOOD.slice(1), 3, 0), ...shift(seg(KETCH, 7, 36), 0, -3).reverse(), ...shift(MIRABEL_SOUND, -0.8, 0).reverse()]],
    coast: { a1: 1.3, s1: 9, a2: 0.5, s2: 2.5, a3: 0.14, s3: 0.6 },
    base: { kind: 'plain' },
  },
  {
    id: 'mirabel', name: 'Mirabel Island', type: 'Tourist coast',
    polys: [mirabelStrip, [[1.8, 31.8], [3.2, 32.2], [5.0, 31.4], [6.0, 30.0], [6.0, 27.5], [5.4, 25.8], [4.2, 24.6], [2.2, 24.0], [0.4, 24.8], [-0.6, 27.0], [0.2, 30.0]]],
    coast: { a1: 0.04, s1: 3, a2: 0.02, s2: 1, a3: 0.01, s3: 0.3 },
    base: { kind: 'barrier', oceanSide: [-1, 0] },
  },
  {
    id: 'saint-ambrose', name: 'Saint Ambrose Island', type: 'Lowcountry',
    polys: [[[35.2, 53.4], [36.8, 53.0], [38.5, 53.6], [40.0, 53.2], [41.5, 53.4], [43.0, 53.8], [44.5, 53.6], [46.0, 53.2], [47.5, 53.5], [49.0, 53.9], [50.5, 53.6], [52.0, 53.2], [53.5, 53.4], [55.0, 53.8], [56.2, 54.0], [57.8, 53.8], [59.5, 53.2], [61.0, 53.5], [62.5, 53.3], [64.0, 52.6], [65.5, 52.0], [66.8, 51.4], [67.6, 50.2], [67.2, 48.0], [67.8, 45.0], [67.0, 42.0], [68.0, 39.0], [67.6, 36.0], [68.4, 33.0], [68.0, 30.0], [66.8, 28.4], ...shift(seg(KETCH, 33.6, 64), 0, -3).reverse(), ...shift(ASHWOOD.slice(2), -3, 0).reverse(), [33.4, 52.4]], ],
    coast: { a1: 1.1, s1: 7, a2: 0.55, s2: 2, a3: 0.22, s3: 0.5 },
    base: { kind: 'seaisland' },
  },
  {
    id: 'ambrose-banks', name: 'Ambrose Beach', type: 'Lowcountry barrier beach', partOf: 'saint-ambrose',
    polys: [ambroseBeachN, ambroseBeachS],
    coast: { a1: 0.03, s1: 3, a2: 0.015, s2: 1, a3: 0.008, s3: 0.3 },
    base: { kind: 'barrier' },
  },
  {
    id: 'wickham', name: 'Wickham Island', type: 'Wilderness',
    polys: [[...shift(seg(KETCH, -2, 23.5), 0, 1.6), ...shift(SAWPIT.slice(0, 6), 2.5, 0), [24.0, 6.0], [21.0, 4.2], [19.8, 3.4], [18.6, 2.8], [17.2, 2.2], [15.8, 1.6], [14.2, 2.0], [12.8, 1.8], [11.6, 1.0], [10.6, 0.4], [9.2, 1.0], [7.8, 1.8], [6.6, 2.6], [5.2, 2.2], [3.8, 3.0], [2.6, 3.6], [1.4, 4.8], [0.4, 6.0], [0.6, 7.4], [-0.4, 8.6], [-1.0, 10.0], [-0.2, 11.2], [0.2, 12.4], [-0.6, 13.6], [0.4, 14.8], [1.6, 15.4], [2.4, 16.6], [1.8, 17.6], [0.6, 18.2], [-0.4, 19.0], [-1.2, 20.5]]],
    coast: { a1: 1.1, s1: 8, a2: 0.65, s2: 2, a3: 0.28, s3: 0.45 },
    base: { kind: 'karst' },
  },
  {
    id: 'ossahatchee', name: 'Ossahatchee Island', type: 'Swamp and wetland',
    polys: [[...shift(seg(KETCH, 23.5, 62), 0, 3), [63.4, 26.6], [63.4, 24.2], [63.0, 22.0], [63.4, 19.6], [63.6, 17.2], [63.2, 15.0], [63.6, 12.6], [63.4, 10.2], [62.6, 8.0], [61.2, 6.4], [59.6, 5.6], [58.4, 5.8], [57.4, 7.0], [56.4, 8.2], [54.8, 8.8], [53.4, 8.4], [52.2, 7.2], [51.2, 5.6], [50.0, 4.8], [48.4, 4.6], [46.6, 4.0], [45.0, 4.4], [43.4, 4.0], [41.8, 4.4], [40.4, 3.8], [39.0, 4.2], [37.4, 4.8], [35.8, 4.4], [34.2, 4.8], [32.6, 5.4], [31.0, 5.0], [29.4, 5.6], [27.8, 6.2], [26.4, 6.0], [25.2, 6.8], [24.2, 7.8], ...shift(SAWPIT.slice(0, 7), -2.5, 0).reverse()]],
    coast: { a1: 1.3, s1: 10, a2: 0.55, s2: 2.5, a3: 0.22, s3: 0.5 },
    base: { kind: 'swamp' },
  },
  {
    id: 'gannet', name: 'The Gannet Banks', type: 'Barrier islands',
    polys: [kestrelStrip, gannetStrip, pennickStrip],
    coast: { a1: 0.03, s1: 3, a2: 0.015, s2: 1, a3: 0.008, s3: 0.3 },
    base: { kind: 'barrier', oceanSide: [0.8, -0.6] },
  },
  {
    id: 'sabal', name: 'The Sabal Keys', type: 'Mangrove keys',
    polys: [
      ellipse(29.5, 1.6, 1.4, 0.5, 15), ellipse(34.5, 1.0, 1.2, 0.6, -10), ellipse(38.6, 0.1, 0.95, 0.75, 30),
      ellipse(43.8, 0.9, 2.4, 1.1, 5), ellipse(48.5, 1.8, 1.3, 0.6, -20), ellipse(52.5, 0.6, 1.8, 0.8, 10),
      ellipse(56.5, 1.9, 0.8, 0.5, 0), ellipse(59.8, 0.4, 1.1, 0.5, -15), ellipse(33.0, -1.8, 0.6, 0.35, 0),
      ellipse(48.0, -2.6, 0.7, 0.3, 0),
    ],
    coast: { a1: 0.12, s1: 2, a2: 0.08, s2: 0.6, a3: 0.04, s3: 0.25 },
    base: { kind: 'keys' },
  },
];

// Corridors that must stay open water whatever the coastline noise does.
export const WATER_CORRIDORS = [
  { name: 'The Narrows', rough: 0.3, meander: 0.3, pts: [[-12, 91.2, 0.6], [5, 90.9, 0.5], [12, 91.25, 0.5], [20, 91.3, 0.5], [30, 91.0, 0.5], [40, 90.9, 0.5], [47, 91.6, 0.6], [50, 93.5, 0.8]] },
  { name: 'Hollow Reach', rough: 0.12, meander: 0.08, pts: [[45.8, 66.4, 2.6], [46.6, 69, 2.2], [46.7, 72, 1.8], [46.4, 74.5, 1.4], [46.05, 77, 0.8], [46.6, 79, 1.4], [47.0, 82, 2.0], [46.8, 85, 2.4], [46.6, 88, 2.8], [46.8, 90.5, 3.4]] },
  { name: 'Mirabel Sound', rough: 0.12, meander: 0.04, pts: MIRABEL_SOUND },
  { name: 'Ketch Sound', rough: 1, meander: 1, pts: KETCH },
  { name: 'Ashwood River', rough: 0.8, meander: 0.8, pts: ASHWOOD },
  { name: 'Sawpit Pass', rough: 0.8, meander: 0.8, pts: SAWPIT },
  { name: 'North Channel', rough: 0.2, meander: 0.2, pts: [[30, 63.6, 0.5], [33, 63.6, 0.5], [36, 63.7, 0.5], [39, 63.8, 0.5], [42, 63.9, 0.5]] },
  { name: 'Inner Harbor', rough: 0.2, meander: 0.2, pts: [[42.5, 62, 0.5], [42.6, 60, 0.5], [42.5, 58, 0.5], [42.6, 56, 0.5], [42.4, 54.5, 0.5]] },
  { name: 'Ambrose Inlet', rough: 0.1, meander: 0.1, pts: [[68.8, 28.0, 0.45], [70.4, 29.2, 0.45], [71.8, 30.0, 0.45]] },
  { name: 'Sheepshead Inlet', rough: 0.1, meander: 0.1, pts: [[75.8, 16.8, 0.35], [76.55, 17.4, 0.35], [77.3, 18.0, 0.35]] },
  { name: 'Rockfish Inlet', rough: 0.1, meander: 0.1, pts: [[78.7, 4.6, 0.3], [78.85, 5.45, 0.3], [79.0, 6.4, 0.3]] },
  { name: 'Bonnet Inlet', rough: 0.1, meander: 0.1, pts: [[67.5, 41.4, 0.3], [69.0, 41.5, 0.3], [70.5, 41.6, 0.3]] },
  { name: 'Sabal Channel', rough: 0.4, meander: 0.4, pts: [[24, 3.2, 0.4], [30, 3.0, 0.4], [36, 3.3, 0.4], [42, 3.4, 0.4], [48, 3.6, 0.4], [54, 3.6, 0.4], [60, 3.8, 0.4], [63, 4.0, 0.4]] },
];

// Named bodies of water (labels, docs, bathymetry recipes). `poly` limits the
// region a recipe applies to; first match wins, so order matters.
export const WATERS = [
  { id: 'hollow-reach', name: 'Hollow Reach', kind: 'drowned gorge', label: [46.9, 83], maxDepth: 48, slope: 45, poly: [[45.0, 68.0], [48.4, 68.2], [48.2, 74.0], [47.0, 77.0], [48.6, 80.5], [48.9, 88.0], [44.9, 88.0], [45.2, 80.0], [45.3, 74.0]] },
  { id: 'mirabel-sound', name: 'Mirabel Sound', kind: 'lagoon', label: [6.6, 40], maxDepth: 4, slope: 3, poly: [[5.5, 54.5], [8.8, 54.5], [8.8, 23.5], [5.5, 23.5]] },
  { id: 'tarrow-sound', name: 'Tarrow Sound', kind: 'lagoon', label: [68.5, 15], maxDepth: 5.5, slope: 1.4, poly: [[62.5, 26.5], [66.5, 27.5], [70.5, 28.6], [73.5, 24.5], [76.5, 17.5], [80, 12.5], [84, 8.6], [83.5, 6.5], [79, 5.4], [73, 3.6], [67, 2.6], [63.5, 3.6], [63.5, 8], [63.9, 14], [63.6, 20]] },
  { id: 'ashwood-river', name: 'Ashwood River', kind: 'tidal river', label: [34.6, 36], maxDepth: 9, slope: 5, poly: [[32.4, 53.2], [36.8, 53.2], [36.8, 26.2], [32.4, 26.2]] },
  { id: 'ketch-sound', name: 'Ketch Sound', kind: 'tidal strait', label: [28, 24.7], maxDepth: 7, slope: 3, poly: [[-2, 24.2], [10, 25.7], [22, 26.0], [33, 26.8], [45, 28.2], [60, 28.8], [66, 28.4], [66, 24.8], [60, 26.0], [45, 25.2], [33, 23.9], [22, 22.0], [10, 20.9], [-2, 20.4]] },
  { id: 'sawpit-pass', name: 'Sawpit Pass', kind: 'tidal strait', label: [22.4, 12], maxDepth: 6, slope: 3, poly: [[20.8, 22.5], [24.4, 22.5], [24.4, 1.0], [20.8, 1.0]] },
  { id: 'sabal-flats', name: 'Sabal Flats', kind: 'shallow flats', label: [40, -1.2], maxDepth: 3, slope: 0.9, poly: [[20, 6], [64, 6], [66, -1.6], [20, -1.6]] },
  { id: 'the-narrows', name: 'The Narrows', kind: 'strait', label: [24, 91.0], maxDepth: 24, slope: 7, poly: [[-12, 88.4], [44.5, 86.8], [49.6, 89], [49.6, 97], [-12, 97]] },
  { id: 'cassena-sound', name: 'Cassena Sound', kind: 'sound (rift trough)', label: [20, 58.5], maxDepth: 14, slope: 2.4, poly: [[-4, 67.5], [46, 68.6], [78, 70.5], [84, 68], [82, 51.5], [60, 52.6], [36, 51.4], [8, 50.2], [-4, 50.5]] },
  { id: 'serena-bay', name: 'Serena Bay', kind: 'bay (Gulf side)', label: [-5, 40], maxDepth: 15, slope: 0.9, poly: [[-12, -4], [1.5, -4], [1.5, 2.5], [-1.5, 20], [-1.2, 32], [2.5, 52], [3.6, 67], [2.4, 88.5], [-12, 88.5]] },
  { id: 'gulf', name: 'The Gulf', kind: 'open sea', label: [10, -2.5], maxDepth: 22, slope: 1.1, poly: [[-12, -6], [66, -6], [66, -1.6], [20, -1.6], [1.5, 2.5], [-12, 2.5]] },
  { id: 'atlantic', name: 'Atlantic Ocean', kind: 'open ocean', label: [92, 45], maxDepth: 62, slope: 2.6, poly: null },
];

// Bathymetric overrides: natural troughs, dredged channels, shoals.
export const BATHY = [
  { kind: 'trough', name: 'Cassena Trough', w: 3.2, pts: [[-4, 59, 18], [8, 59.2, 20], [20, 59.0, 22], [28.5, 59.6, 24], [30.2, 61.8, 26], [33, 63.6, 27], [38, 63.8, 28], [43, 64.0, 29], [48, 64.4, 31], [55, 64.8, 33], [62, 65.0, 35], [70, 64.6, 38], [78, 63.5, 42], [88, 62.5, 48], [100, 62, 55]] },
  { kind: 'channel', name: 'Calder Ship Channel', w: 0.35, pts: [[100, 62.3, 15.5], [88, 62.6, 15.5], [78, 63.4, 15.5], [70, 64.2, 15.5], [62, 64.2, 15.5], [56, 63.0, 15.5], [53, 62.3, 15.5], [48, 62.3, 15.5], [44, 63.2, 15.5], [40, 63.4, 14], [37.2, 63.4, 12]] },
  { kind: 'channel', name: 'Corliss Turning Basin', w: 1.2, pts: [[51.5, 62.4, 15.5], [53.0, 62.4, 15.5]] },
  { kind: 'channel', name: 'Inland Waterway (Mirabel Sound)', w: 0.08, pts: [[6.6, 54, 4], [6.5, 45, 4], [6.6, 35, 4], [7.0, 29.5, 4], [7.4, 24.5, 4]] },
  { kind: 'channel', name: 'Inland Waterway (Tarrow Sound)', w: 0.08, pts: [[64.5, 27.3, 4], [66.5, 20, 4], [67, 12, 4], [68, 5, 4], [65.5, 3.2, 4]] },
  { kind: 'shoal', name: 'Merrin Shoals', w: 1.2, pts: [[84.6, 8.0, 2.5], [87, 6, 3], [90, 3.5, 3.5], [93, 1, 4], [97, -2, 5]] },
  { kind: 'shoal', name: 'Ambrose Ebb Delta', w: 1.4, pts: [[71.8, 30.2, 2.5], [73.5, 31.2, 3.5]] },
  { kind: 'shoal', name: 'Serena Pass Bar', w: 1.0, pts: [[1.0, 22.4, 1.5], [-1.0, 22.0, 2.5]] },
];

// ---------------------------------------------------------------------------
// Mountain structure. Ridges: crest polylines [x, y, z] or a peak id. `w` is
// the half-width (km) over which the crest falls to the island base.
// ---------------------------------------------------------------------------
export const RIDGES = [
  // Halcomb — Balsam Crest, the island's spine
  { id: 'balsam-crest', island: 'halcomb', w: 8.5, pow: 1.35, pts: [[13.6, 71.6, 560], [15.2, 73.4, 980], 'gooseberry-bald', [18.2, 75.8, 1290], 'stormhead', [21.0, 77.3, 1480], 'painted-bald', [24.0, 78.8, 1640], 'coldspring-knob', [27.3, 79.7, 1590], 'ledford-dome', [30.8, 80.6, 1860], 'mount-sawyer', [34.2, 80.7, 1760], 'hemlock-knob', [37.3, 80.2, 1660], 'the-steeples', [40.2, 79.4, 1400], [41.5, 79.0, 1185], 'bearpen-knob', [44.2, 77.9, 880]] },
  // North spurs to the Narrows (the North Face)
  { id: 'rich-spur', island: 'halcomb', w: 4.2, pow: 1.3, pts: ['stormhead', [19.0, 79.4, 1300], 'rich-mountain', [18.7, 84.5, 760], [19.0, 87.8, 160]] },
  { id: 'thunderstone-spur', island: 'halcomb', w: 4.0, pow: 1.3, pts: [[24.4, 79.0, 1700], 'thunderstone', [23.3, 86.4, 560], [23.2, 88.4, 120]] },
  { id: 'blackstrap-spur', island: 'halcomb', w: 4.0, pow: 1.3, pts: [[29.6, 80.5, 1900], 'blackstrap-knob', [29.6, 86.3, 640], [29.7, 88.2, 120]] },
  { id: 'callahan-spur', island: 'halcomb', w: 4.4, pow: 1.3, pts: ['mount-sawyer', [32.8, 82.4, 1830], 'mount-callahan', [33.3, 86.4, 880], [33.5, 88.0, 150]] },
  { id: 'big-laurel-spur', island: 'halcomb', w: 4.0, pow: 1.3, pts: [[38.2, 80.1, 1600], 'big-laurel-top', [40.0, 86.5, 520], [40.2, 87.6, 120]] },
  { id: 'sheepback-spur', island: 'halcomb', w: 4.0, pow: 1.3, pts: ['gooseberry-bald', 'sheepback-bald', 'copperhead-knob', [15.0, 83.4, 320]] },
  // South spurs toward Cassena Sound
  { id: 'sugartree-spur', island: 'halcomb', w: 4.0, pow: 1.3, pts: ['painted-bald', [21.4, 75.6, 1300], 'sugartree-knob', [19.8, 70.2, 520], [19.6, 67.5, 160]] },
  { id: 'brushy-spur', island: 'halcomb', w: 3.8, pow: 1.3, pts: ['coldspring-knob', 'brushy-mountain', 'chestnut-knob', [24.4, 68.6, 260]] },
  { id: 'cove-spur', island: 'halcomb', w: 4.2, pow: 1.3, pts: [[29.6, 80.0, 1850], [30.2, 78.0, 1450], 'cove-mountain', [31.4, 72.6, 760], [32.4, 69.0, 380], [33.0, 66.6, 120]] },
  { id: 'huckleberry-spur', island: 'halcomb', w: 3.4, pow: 1.3, pts: ['hemlock-knob', 'huckleberry-knob', [34.2, 75.6, 760]] },
  { id: 'dogwood-spur', island: 'halcomb', w: 4.2, pow: 1.3, pts: [[41.5, 79.0, 1185], [42.2, 76.6, 1100], 'dogwood-mountain', [41.6, 71.4, 760], 'hogback', [38.6, 67.2, 260]] },
  { id: 'pinnacle-spur', island: 'halcomb', w: 3.4, pow: 1.3, pts: [[15.2, 73.4, 980], 'pinnacle-knob', [17.0, 69.2, 420]] },

  // Graystone — ranges standing on the highland plateau
  { id: 'whitlock-range', island: 'graystone', w: 5.0, pow: 1.15, pts: [[50.8, 86.0, 1120], 'hawkbill-knob', [55.2, 86.0, 1380], 'whitlock-mountain', [60.8, 86.4, 1450], 'lantern-mountain', [66.0, 87.8, 1430], 'frostcap', [70.0, 87.2, 1340], 'ravenrock', 'fallon-knob', [76.4, 87.0, 760]] },
  { id: 'pale-wall-ridge', island: 'graystone', w: 3.2, pow: 1.15, pts: [[52.0, 82.6, 1200], 'sassafras-knob', [55.0, 81.6, 1350], 'pale-wall', [57.0, 80.0, 1150]] },
  { id: 'bald-rock-ridge', island: 'graystone', w: 2.8, pow: 1.15, pts: [[60.4, 85.0, 1300], 'bald-rock', [62.6, 81.6, 1120], 'anvil-rock'] },
  { id: 'hornet-ridge', island: 'graystone', w: 2.4, pow: 1.15, pts: [[69.8, 86.0, 1300], 'hornet-spire', [69.6, 82.6, 1050]] },
  { id: 'wolfpen-ridge', island: 'graystone', w: 3.0, pow: 1.15, pts: [[52.6, 80.4, 1120], 'wolfpen-mountain', [49.8, 75.4, 760], 'lookoff-mountain', [50.6, 69.6, 220]] },
  { id: 'graystone-head-ridge', island: 'graystone', w: 1.5, pow: 1.2, pts: [[71.2, 71.0, 120], 'graystone-head', [74.6, 70.2, 120]] },

  // Lowland ridges
  { id: 'calder-heights', island: 'calder', w: 2.0, pow: 1.4, pts: [[32.4, 56.6, 45], [34.4, 58.0, 82], 'calder-heights', [37.0, 59.6, 66], [38.6, 61.0, 34]] },
  { id: 'red-hills', island: 'bellamy', w: 3.2, pow: 1.2, pts: [[10.0, 44.2, 80], 'iron-mountain', [16.0, 48.6, 92], 'sugarloaf-hill', [20.2, 49.0, 84], [23.0, 47.0, 62]] },
  { id: 'chalybeate-hills', island: 'bellamy', w: 2.2, pow: 1.2, pts: [[9.6, 46.8, 70], [11.2, 45.2, 96], [12.4, 43.0, 74]] },
  { id: 'sandhill-ridge', island: 'wickham', w: 3.2, pow: 1.1, pts: [[13.4, 3.2, 26], [13.2, 5.4, 52], 'firetower-hill', [13.6, 11.0, 58], 'scrub-hill', [14.2, 17.0, 54], [14.8, 20.0, 28]] },
  { id: 'long-ridge', island: 'ossahatchee', w: 2.0, pow: 1.1, pts: [[60.8, 6.8, 26], [60.2, 10.5, 38], 'highpine-knoll', [59.6, 18.0, 40], [59.3, 21.5, 36], [58.6, 25.0, 28]] },
];

// Flat-topped uplands bounded by escarpments. `top` interpolates along y.
export const PLATEAUS = [
  {
    id: 'hickory-tableland', name: 'Hickory Tableland', island: 'halcomb', edge: 0.75, roughness: 14,
    top: { y0: 68, z0: 420, y1: 87, z1: 540 },
    poly: [[3.2, 68.5], [5.5, 67.9], [8.0, 69.6], [8.9, 73.5], [8.5, 77.5], [9.1, 81.5], [8.6, 85.2], [7.0, 87.4], [4.6, 87.2], [3.1, 85.0], [2.7, 80.0], [3.0, 75.0], [2.7, 71.0]],
  },
  {
    id: 'graystone-highlands', name: 'Graystone Highlands', island: 'graystone', edge: 2.2, roughness: 70,
    top: { y0: 74, z0: 960, y1: 90, z1: 1080 },
    poly: [[50.6, 73.6], [53.0, 74.5], [57.0, 76.6], [61.0, 78.6], [65.0, 80.6], [69.0, 82.6], [73.0, 84.6], [77.2, 86.4], [76.0, 89.2], [70.0, 91.0], [63.0, 91.3], [56.0, 90.8], [50.6, 89.6], [49.2, 85.0], [50.0, 81.0], [50.4, 77.0]],
  },
];

// Isolated domes and mounds: granite monadnocks, dunes, spoil and landfill.
export const DOMES = [
  { peak: 'grayback', r: 1.7, shape: 'dome' },
  { peak: 'glassface-dome', r: 1.1, shape: 'dome' },
  { peak: 'cutstone-mountain', r: 1.3, shape: 'dome' },
  { peak: 'kestrel-hill', r: 0.55, shape: 'dune' },
  { id: 'corliss-landfill', name: 'Corliss Landfill Hill', at: [51.5, 57.3], z: 48, r: 0.55, shape: 'mesa' },
  { id: 'corliss-spoil-west', name: 'West Spoil Mound', at: [46.0, 57.0], z: 18, r: 0.5, shape: 'mesa' },
  { id: 'corliss-spoil-east', name: 'East Spoil Mound', at: [54.6, 58.3], z: 14, r: 0.4, shape: 'mesa' },
];

// Intermontane basins and gaps flattened toward a floor elevation.
export const BASINS = [
  { id: 'tennalee-cove', name: 'Tennalee Cove', at: [36.1, 73.6], rx: 3.3, ry: 2.1, rot: 28, floor: 470, blend: 0.55 },
  { id: 'upper-cove', name: 'Upper Tennalee Cove', at: [39.2, 75.2], rx: 1.9, ry: 1.3, rot: 35, floor: 560, blend: 0.8 },
  { id: 'shady-gap', name: 'Shady Gap', at: [14.0, 68.6], rx: 1.6, ry: 1.3, rot: 0, floor: 70, blend: 1.0 },
  { id: 'ledford-flats', name: 'Ledford Flats', at: [26.9, 68.8], rx: 1.4, ry: 1.1, rot: 10, floor: 105, blend: 0.6 },
  { id: 'gate-heights-w', name: 'Gate Shelf (Halcomb)', at: [45.3, 76.5], rx: 1.0, ry: 1.3, rot: 0, floor: 234, blend: 1.0, late: true },
  { id: 'gate-heights-e', name: 'Gate Shelf (Graystone)', at: [47.6, 76.6], rx: 0.9, ry: 1.6, rot: 0, floor: 232, blend: 1.0, late: true },
];

// Coastal cliff zones: within `poly`, land rises to at least `h` metres within
// ~70 m of the shoreline.
export const CLIFFS = [
  { name: 'Tableland Bluffs', h: 95, poly: [[1.0, 68.0], [4.6, 68.0], [4.6, 87.8], [1.0, 87.8]] },
  { name: 'Hollow Reach Walls', h: 185, poly: [[42.6, 68.6], [50.6, 68.6], [50.6, 88.6], [42.6, 88.6]] },
  { name: 'Fallon Cliffs', h: 210, poly: [[75.0, 77.0], [78.0, 79.0], [81.0, 84.0], [80.5, 88.8], [77.0, 88.8], [75.5, 84.0], [73.5, 79.0]] },
  { name: 'Graystone North Shore', h: 70, poly: [[49.5, 89.4], [76.0, 89.4], [76.0, 93.0], [49.5, 93.0]] },
  { name: 'Graystone Head', h: 45, poly: [[71.5, 67.0], [76.5, 67.0], [76.5, 76.5], [71.5, 76.5]] },
  { name: 'North Face Bluffs', h: 28, poly: [[14.0, 87.6], [44.0, 87.6], [44.0, 90.5], [14.0, 90.5]] },
  { name: 'Calder Bluff', h: 14, poly: [[35.5, 61.8], [41.0, 61.8], [41.0, 63.2], [35.5, 63.2]] },
];

// Higher ground inside the Saint Ambrose marsh complex (Pleistocene sea-island
// cores and Holocene beach ridges).
export const UPLANDS = [
  { id: 'ambrose-core', name: 'Ambrose Main', z: 6.0, poly: [[38.5, 49.5], [42.5, 50.2], [47.0, 49.5], [50.5, 47.5], [51.5, 44.0], [50.5, 40.5], [48.0, 37.5], [44.0, 36.5], [40.0, 37.5], [38.2, 41.0], [38.0, 45.5]] },
  { id: 'haversham-neck', name: 'Haversham Neck', z: 8.5, poly: [[52.8, 52.4], [55.2, 52.8], [55.4, 50.5], [55.1, 48.5], [54.8, 46.2], [53.4, 45.2], [52.2, 46.5], [52.4, 49.5]] },
  { id: 'edgewater', name: 'Edgewater Island', z: 4.5, poly: [[57.5, 50.5], [60.5, 51.2], [62.0, 49.0], [61.2, 46.0], [58.8, 45.2], [57.2, 47.0]] },
  { id: 'oyster-hammock', name: 'Oyster Hammock', z: 3.5, poly: [[40, 52.6], [42.5, 52.9], [43.0, 51.0], [40.8, 50.6]] },
  { id: 'kettle-island', name: 'Kettle Island', z: 4.0, poly: [[44, 34], [49, 35], [53, 33.5], [54, 30.5], [50, 29.5], [45, 30.2]] },
  { id: 'ambrose-beach-n', name: 'Ambrose Beach (north)', z: 3.0, dune: true, poly: ambroseBeachN },
  { id: 'ambrose-beach-s', name: 'Ambrose Beach (south)', z: 3.0, dune: true, poly: ambroseBeachS },
];

// Rivers: source → mouth. Vertices are [x, y, bedZ?, floodplainHalfWidthKm?, wallSlope m/km?].
// Bed elevations between given values are interpolated; the builder forces the
// bed to fall monotonically and to sit below the surrounding terrain.
export const RIVERS = [
  // Halcomb
  { id: 'tennalee', name: 'Tennalee River', island: 'halcomb', order: 1, width: 60, estuary: [2.0, 0.9], pts: [
    [42.4, 78.6, 1150, 0, 320], [41.0, 77.0, 900, 0, 300], [39.5, 75.6, 640, 0.15, 260], [37.8, 74.6, 545, 0.35, 200],
    [36.0, 73.9, 500, 0.4, 200], [34.8, 73.0, 480, 0.3, 260], [34.6, 71.8, 455, 0, 520], [34.95, 70.4, 390, 0, 560],
    [35.4, 69.2, 300, 0, 480], [35.9, 68.0, 170, 0, 420], [36.4, 66.9, 70, 0.05, 300], [36.9, 66.1, 24, 0.08, 200],
    [37.2, 65.7, 4, 0.12, 120], [37.6, 65.2, 1, 0.2, 80], [38.2, 64.7, -2, 0.25, 60], [38.6, 64.0, -6, 0.3, 40],
  ] },
  { id: 'coldwater', name: 'Coldwater River', island: 'halcomb', order: 1, width: 35, estuary: [2.6, 1.4], pts: [
    [13.2, 69.8, 70, 0.4, 90], [12.6, 72.5, 60, 1.0, 100], [12.0, 75.5, 50, 1.4, 110], [11.5, 78.5, 38, 1.5, 120],
    [11.2, 81.5, 27, 1.5, 120], [10.8, 84.5, 15, 1.3, 110], [10.4, 87.0, 5, 1.0, 90], [10.1, 88.8, 0, 0.6, 60], [9.9, 89.9, -3, 0.3, 40],
  ] },
  { id: 'pigeonroost', name: 'Pigeonroost Creek', island: 'halcomb', order: 2, width: 12, pts: [[27.2, 80.8, 1500, 0, 380], [26.9, 83.8, 820, 0, 380], [26.5, 86.4, 260, 0, 300], [26.3, 88.4, 20, 0.05, 150], [26.2, 89.4, -2, 0.1, 60]] },
  { id: 'big-laurel', name: 'Big Laurel Creek', island: 'halcomb', order: 2, width: 14, pts: [[36.2, 81.6, 1480, 0, 380], [36.6, 84.5, 660, 0, 360], [36.9, 86.8, 160, 0, 260], [37.0, 88.3, 10, 0.06, 120], [37.1, 89.2, -2, 0.1, 60]] },
  { id: 'rich-creek', name: 'Rich Creek', island: 'halcomb', order: 3, width: 8, pts: [[21.2, 79.6, 1350, 0, 360], [21.2, 84.0, 560, 0, 320], [21.4, 87.6, 60, 0.05, 160], [21.5, 89.6, -2, 0.08, 60]] },
  { id: 'callahan-branch', name: 'Callahan Branch', island: 'halcomb', order: 3, width: 8, pts: [[31.4, 81.4, 1600, 0, 380], [31.3, 84.6, 820, 0, 360], [31.2, 87.4, 120, 0.04, 200], [31.1, 89.4, -2, 0.08, 60]] },
  { id: 'ledford-prong', name: 'Ledford Prong', island: 'halcomb', order: 2, width: 16, estuary: [0.8, 0.35], pts: [[27.4, 78.8, 1450, 0, 360], [27.6, 76.5, 950, 0, 330], [27.4, 74.0, 620, 0.05, 280], [27.1, 71.5, 320, 0.1, 220], [26.9, 69.0, 110, 0.25, 160], [26.6, 66.8, 18, 0.25, 90], [26.4, 65.0, -2, 0.2, 60]] },
  { id: 'hominy', name: 'Hominy Creek', island: 'halcomb', order: 2, width: 14, estuary: [1.2, 0.6], pts: [[23.4, 76.6, 1150, 0, 340], [23.1, 73.0, 540, 0, 300], [22.6, 69.5, 150, 0.12, 200], [22.3, 66.6, 12, 0.2, 100], [22.2, 65.2, -2, 0.2, 60]] },
  { id: 'little-river', name: 'Little River', island: 'halcomb', order: 3, width: 10, estuary: [0.8, 0.3], pts: [[31.0, 74.4, 820, 0, 320], [31.4, 71.0, 320, 0, 280], [31.6, 67.6, 60, 0.08, 160], [31.7, 65.6, 4, 0.1, 80], [31.8, 64.4, -2, 0.12, 60]] },
  { id: 'dogwood-creek', name: 'Dogwood Creek', island: 'halcomb', order: 3, width: 10, pts: [[43.6, 75.6, 700, 0, 330], [44.4, 73.4, 300, 0, 300], [45.1, 71.6, 40, 0, 200], [45.9, 71.0, -4, 0, 100]] },
  { id: 'shady-creek', name: 'Shady Creek', island: 'halcomb', order: 3, width: 10, pts: [[14.0, 68.3, 66, 0.25, 60], [14.3, 66.8, 34, 0.35, 60], [14.7, 65.2, 6, 0.3, 50], [15.0, 63.8, -2, 0.2, 30]] },
  { id: 'sugartree-branch', name: 'Sugartree Branch', island: 'halcomb', order: 3, width: 8, pts: [[18.4, 74.6, 1000, 0, 320], [18.0, 71.0, 380, 0, 260], [17.6, 68.0, 60, 0.08, 140], [17.4, 65.6, -2, 0.1, 60]] },
  { id: 'hickory-creek', name: 'Hickory Creek', island: 'halcomb', order: 3, width: 10, pts: [[5.4, 80.4, 478, 0, 140], [7.4, 80.6, 455, 0, 160], [8.45, 80.75, 440, 0, 200], [8.75, 80.85, 330, 0, 400], [9.6, 81.0, 110, 0, 300], [11.1, 81.4, 27, 0.2, 120]] },
  { id: 'cane-creek', name: 'Cane Creek', island: 'halcomb', order: 3, width: 8, pts: [[5.6, 84.4, 520, 0, 140], [7.6, 84.5, 490, 0, 160], [8.4, 84.55, 470, 0, 220], [8.75, 84.6, 300, 0, 400], [9.5, 84.6, 80, 0, 260], [10.8, 84.5, 15, 0.2, 120]] },
  { id: 'piney-creek', name: 'Piney Creek', island: 'halcomb', order: 3, width: 8, pts: [[7.0, 74.2, 445, 0, 140], [5.2, 73.9, 400, 0, 160], [3.8, 73.75, 300, 0, 260], [3.35, 73.7, 85, 0, 500], [2.9, 73.6, -2, 0, 100]] },
  { id: 'big-laurel-north', name: 'Narrows Branch', island: 'halcomb', order: 3, width: 8, pts: [[41.6, 82.8, 900, 0, 360], [42.0, 85.6, 300, 0, 300], [42.2, 87.9, -2, 0.04, 80]] },

  // Graystone
  { id: 'thunderhole', name: 'Thunderhole River', island: 'graystone', order: 1, width: 30, estuary: [1.0, 0.5], pts: [
    [57.0, 85.0, 1180, 0, 300], [57.6, 84.0, 1040, 0.25, 160], [58.2, 83.0, 1020, 0.1, 220], [59.3, 80.8, 930, 0, 300],
    [60.2, 79.1, 720, 0, 520], [60.8, 77.6, 420, 0, 620], [61.4, 75.5, 200, 0, 480], [61.8, 73.0, 110, 0.05, 300],
    [62.1, 70.5, 45, 0.1, 200], [62.3, 68.4, 8, 0.15, 120], [62.4, 66.8, -3, 0.2, 60],
  ] },
  { id: 'bright-water', name: 'Bright Water River', island: 'graystone', order: 2, width: 22, estuary: [0.8, 0.4], pts: [
    [66.6, 86.6, 1250, 0, 300], [66.9, 85.4, 1180, 0.15, 160], [67.1, 84.2, 1080, 0, 260], [67.8, 82.6, 820, 0, 560],
    [68.6, 80.5, 330, 0, 520], [69.8, 77.5, 160, 0, 360], [70.8, 74.5, 70, 0.05, 260], [71.6, 71.5, 20, 0.1, 160], [72.1, 68.6, -3, 0.15, 60],
  ] },
  { id: 'fallon-river', name: 'Fallon River', island: 'graystone', order: 2, width: 18, pts: [[69.5, 88.7, 1060, 0, 260], [71.5, 88.8, 760, 0.1, 280], [74.2, 88.9, 380, 0, 360], [75.8, 88.6, 60, 0.05, 260], [76.8, 88.3, -3, 0.1, 80]] },
  { id: 'hollow-creek', name: 'Hollow Creek', island: 'graystone', order: 3, width: 10, pts: [[53.0, 81.4, 1000, 0, 280], [51.2, 81.2, 820, 0, 320], [50.0, 81.0, 450, 0, 420], [49.4, 81.0, 135, 0, 500], [48.75, 81.0, -6, 0, 900]] },
  { id: 'quarry-creek', name: 'Quarry Creek', island: 'graystone', order: 3, width: 8, pts: [[65.6, 72.8, 120, 0, 160], [65.0, 70.2, 30, 0.05, 120], [64.7, 67.0, -2, 0.08, 60]] },
  { id: 'ravenfork', name: 'Ravenfork', island: 'graystone', order: 3, width: 8, pts: [[63.4, 89.4, 1000, 0, 360], [63.5, 90.8, 300, 0, 500], [63.5, 91.9, -3, 0, 200]] },
  { id: 'stillhouse-branch', name: 'Stillhouse Branch', island: 'graystone', order: 3, width: 8, pts: [[56.4, 88.4, 1080, 0, 340], [56.0, 90.2, 360, 0, 480], [55.8, 91.4, -3, 0, 200]] },

  // Bellamy
  { id: 'ocosta', name: 'Ocosta River', island: 'bellamy', order: 1, width: 45, estuary: [6.5, 3.2], pts: [
    [19.5, 48.0, 66, 0.15, 30], [19.0, 45.0, 52, 0.4, 25], [19.8, 42.0, 41, 0.7, 20], [20.6, 39.0, 31, 0.9, 18],
    [21.2, 36.0, 22, 1.1, 15], [21.0, 33.0, 14, 1.2, 12], [21.6, 30.0, 7, 1.2, 10], [22.0, 27.5, 2.5, 1.0, 8], [22.2, 25.6, -1, 0.6, 6], [22.3, 24.4, -3, 0.4, 4],
  ] },
  { id: 'little-ocosta', name: 'Little Ocosta', island: 'bellamy', order: 2, width: 18, pts: [[12.5, 46.4, 72, 0.1, 30], [14.5, 43.5, 52, 0.3, 24], [16.8, 41.5, 42, 0.4, 20], [19.9, 40.5, 36, 0.5, 18]] },
  { id: 'sweetwater', name: 'Sweetwater Creek', island: 'bellamy', order: 2, width: 14, estuary: [3.0, 1.3], pts: [[15.0, 38.0, 40, 0.15, 20], [12.5, 37.0, 26, 0.3, 16], [10.0, 36.5, 10, 0.3, 12], [8.0, 36.2, -1, 0.3, 8], [7.0, 36.1, -2, 0.2, 6]] },
  { id: 'mill-branch', name: 'Mill Branch', island: 'bellamy', order: 3, width: 10, estuary: [1.4, 0.6], pts: [[23.5, 47.0, 55, 0.05, 30], [24.0, 49.5, 22, 0.15, 24], [24.3, 51.6, 1, 0.2, 14], [24.3, 52.6, -2, 0.2, 8]] },
  { id: 'black-creek', name: 'Black Creek', island: 'bellamy', order: 3, width: 10, estuary: [2.2, 0.9], pts: [[28.0, 38.0, 22, 0.1, 16], [31.0, 37.5, 8, 0.2, 12], [33.0, 37.3, 0, 0.25, 8], [34.0, 37.2, -2, 0.2, 6]] },

  // Wickham — spring runs and a blackwater creek
  { id: 'wickham-spring-run', name: 'Wickham Spring Run', island: 'wickham', order: 2, width: 25, pts: [[5.5, 12.0, 2.5, 0.08, 10], [3.0, 11.6, 1.0, 0.12, 8], [0.4, 11.2, -1.5, 0.15, 6], [-0.8, 11.1, -2, 0.15, 4]] },
  { id: 'seacow-run', name: 'Seacow Spring Run', island: 'wickham', order: 2, width: 22, pts: [[6.0, 17.0, 2.5, 0.08, 10], [3.6, 17.3, 1.0, 0.12, 8], [1.2, 17.1, -1.5, 0.15, 6], [0.2, 17.0, -2, 0.15, 4]] },
  { id: 'sawpit-river', name: 'Sawpit River', island: 'wickham', order: 2, width: 18, estuary: [2.0, 0.8], pts: [[17.6, 12.2, 14, 0.15, 10], [19.4, 11.2, 5, 0.25, 8], [21.0, 10.6, -1, 0.25, 6], [22.0, 10.4, -2, 0.2, 4]] },

  // Ossahatchee — swamp outlets
  { id: 'ossahatchee-river', name: 'Ossahatchee River', island: 'ossahatchee', order: 1, width: 40, estuary: [5.0, 2.4], pts: [[45.0, 15.2, 19, 0.3, 6], [44.0, 12.0, 16, 0.4, 6], [42.0, 9.5, 11, 0.5, 6], [40.5, 7.5, 5, 0.5, 6], [40.0, 5.6, 0.5, 0.4, 5], [39.8, 3.6, -2, 0.3, 4]] },
  { id: 'little-black', name: 'Little Black River', island: 'ossahatchee', order: 2, width: 25, estuary: [4.0, 1.5], pts: [[38.0, 16.8, 20, 0.2, 6], [34.0, 16.0, 17, 0.3, 6], [30.0, 15.4, 12, 0.35, 6], [26.5, 14.8, 5, 0.35, 6], [24.5, 14.6, 0.5, 0.3, 5], [23.0, 14.5, -2, 0.2, 4]] },
  { id: 'gapway', name: 'Gapway River', island: 'ossahatchee', order: 2, width: 22, estuary: [2.0, 0.9], pts: [[52.0, 20.2, 21, 0.2, 6], [56.0, 21.5, 17, 0.2, 8], [58.5, 22.4, 11, 0.15, 30], [61.0, 23.0, 3, 0.25, 10], [63.0, 23.2, -2, 0.2, 5]] },

  // Saint Ambrose — tidal rivers (sea-level channels through the marsh)
  { id: 'haversham-river', name: 'Haversham River', island: 'saint-ambrose', order: 1, tidal: true, width: 450, pts: [[57.0, 54.2, -9, 0, 40], [56.0, 51.0, -8, 0, 40], [55.7, 48.5, -8, 0, 40], [56.5, 45.5, -6, 0, 30], [58.5, 43.0, -4, 0, 30], [60.0, 40.5, -2.5, 0, 20]] },
  { id: 'bonnet-river', name: 'Bonnet River', island: 'saint-ambrose', order: 2, tidal: true, width: 260, pts: [[66.8, 52.0, -5, 0, 30], [65.6, 48.5, -4, 0, 30], [64.8, 45.0, -4, 0, 30], [65.6, 42.2, -5, 0, 30], [68.0, 41.4, -6, 0, 30], [70.5, 41.6, -7, 0, 30]] },
  { id: 'salt-kettle', name: 'Salt Kettle Creek', island: 'saint-ambrose', order: 2, tidal: true, width: 200, pts: [[62.6, 28.6, -4, 0, 30], [63.0, 32.0, -3, 0, 30], [64.4, 35.5, -3, 0, 30], [66.2, 38.5, -2.5, 0, 20], [67.4, 40.6, -2, 0, 20]] },
  { id: 'oyster-creek', name: 'Oyster Creek', island: 'saint-ambrose', order: 3, tidal: true, width: 160, pts: [[37.0, 51.8, -3, 0, 30], [38.6, 49.2, -2.5, 0, 30], [37.4, 46.2, -2, 0, 20]] },
];

// Lakes. kinds: reservoir (fills `region` up to `level`, held by `dam`),
// basin (ellipse; level 'auto' = local ground minus freeboard), arc (oxbow),
// quarry (steep pit).
export const LAKES = [
  // Halcomb
  { id: 'calloway-lake', name: 'Calloway Lake', island: 'halcomb', kind: 'reservoir', level: 420, dam: [[34.29, 72.21], [35.85, 71.95]], upstream: [35.2, 72.9], region: [[34.3, 72.2], [35.9, 71.9], [38.0, 72.2], [40.4, 73.4], [40.4, 76.2], [37.6, 76.8], [34.6, 76.6], [32.6, 75.0], [32.4, 72.6]] },
  { id: 'lake-hominy', name: 'Lake Hominy', island: 'halcomb', kind: 'reservoir', level: 376, dam: [[22.39, 72.42], [23.25, 72.3]], upstream: [23.1, 72.9], region: [[22.3, 72.4], [23.3, 72.3], [23.6, 74.0], [22.5, 74.2]] },
  { id: 'hickory-lake', name: 'Hickory Lake', island: 'halcomb', kind: 'basin', at: [6.6, 80.6], rx: 1.0, ry: 0.3, rot: 5, depth: 12 },
  { id: 'sinking-pond', name: 'Sinking Pond', island: 'halcomb', kind: 'basin', at: [6.0, 77.0], rx: 0.55, ry: 0.32, rot: 20, depth: 3 },
  { id: 'blue-hole', name: 'The Blue Hole', island: 'halcomb', kind: 'basin', at: [10.0, 82.8], rx: 0.12, ry: 0.1, rot: 0, depth: 22 },
  { id: 'coldwater-quarry-lake', name: 'Coldwater Quarry Lake', island: 'halcomb', kind: 'quarry', at: [14.6, 84.0], rx: 0.45, ry: 0.28, rot: 15, depth: 45 },
  { id: 'gooseberry-pond', name: 'Gooseberry Pond', island: 'halcomb', kind: 'basin', at: [17.7, 74.1], rx: 0.14, ry: 0.09, rot: 40, depth: 2 },
  { id: 'big-laurel-millpond', name: 'Big Laurel Millpond', island: 'halcomb', kind: 'basin', at: [36.95, 86.7], rx: 0.28, ry: 0.12, rot: 80, depth: 4 },
  // Graystone
  { id: 'lake-whitlock', name: 'Lake Whitlock', island: 'graystone', kind: 'reservoir', level: 942, dam: [[58.59, 80.66], [59.5, 81.12]], upstream: [58.8, 81.6], region: [[58.5, 80.6], [59.6, 81.1], [59.0, 84.0], [56.5, 84.6], [56.0, 83.0]] },
  { id: 'bright-water-lake', name: 'Bright Water Lake', island: 'graystone', kind: 'basin', at: [66.8, 85.7], rx: 0.75, ry: 0.32, rot: 75, depth: 14 },
  { id: 'fallon-reservoir', name: 'Fallon Reservoir', island: 'graystone', kind: 'basin', at: [71.0, 88.75], rx: 0.7, ry: 0.22, rot: 5, depth: 18 },
  { id: 'cutstone-quarry', name: 'Cutstone Quarry Hole', island: 'graystone', kind: 'quarry', at: [59.6, 70.3], rx: 0.42, ry: 0.3, rot: -20, depth: 70 },
  // Calder
  { id: 'heights-reservoir', name: 'Heights Reservoir', island: 'calder', kind: 'basin', at: [35.0, 58.3], rx: 0.32, ry: 0.2, rot: 33, depth: 12, level: 'auto' },
  { id: 'lake-ellery', name: 'Lake Ellery', island: 'calder', kind: 'basin', at: [31.9, 58.6], rx: 0.45, ry: 0.22, rot: 70, depth: 3 },
  // Corliss
  { id: 'corliss-cooling-pond', name: 'Corliss Cooling Pond', island: 'corliss', kind: 'basin', at: [53.3, 56.9], rx: 0.6, ry: 0.28, rot: 10, depth: 4 },
  // Bellamy
  { id: 'lake-ocosta', name: 'Lake Ocosta', island: 'bellamy', kind: 'basin', at: [19.3, 45.2], rx: 1.7, ry: 0.32, rot: 84, depth: 9 },
  { id: 'clearwater-bay', name: 'Clearwater Bay', island: 'bellamy', kind: 'basin', at: [25.6, 31.4], rx: 1.25, ry: 0.75, rot: -40, depth: 3 },
  { id: 'tar-kiln-bay', name: 'Tar Kiln Bay', island: 'bellamy', kind: 'basin', at: [17.6, 29.4], rx: 0.95, ry: 0.55, rot: -40, depth: 2.5 },
  { id: 'browns-bay', name: "Brown's Bay", island: 'bellamy', kind: 'basin', at: [28.6, 34.6], rx: 0.8, ry: 0.48, rot: -40, depth: 2.5 },
  { id: 'little-bay', name: 'Little Bay', island: 'bellamy', kind: 'basin', at: [13.4, 30.4], rx: 0.55, ry: 0.32, rot: -40, depth: 2 },
  { id: 'sand-bay', name: 'Sand Bay', island: 'bellamy', kind: 'basin', at: [11.2, 33.6], rx: 0.7, ry: 0.42, rot: -40, depth: 2 },
  { id: 'moon-lake', name: 'Moon Lake', island: 'bellamy', kind: 'arc', at: [22.3, 34.4], r: 0.55, width: 0.09, a0: -80, a1: 120, depth: 3 },
  { id: 'ox-lake', name: 'Ox Lake', island: 'bellamy', kind: 'arc', at: [20.4, 31.3], r: 0.45, width: 0.08, a0: 100, a1: 300, depth: 3 },
  { id: 'chalk-pits', name: 'The Chalk Pits', island: 'bellamy', kind: 'quarry', at: [11.9, 46.6], rx: 0.5, ry: 0.25, rot: 30, depth: 25 },
  // Mirabel
  { id: 'cypress-dune-lake', name: 'Cypress Dune Lake', island: 'mirabel', kind: 'basin', at: [0.9, 27.4], rx: 0.6, ry: 0.13, rot: 62, depth: 3 },
  { id: 'little-serena-lake', name: 'Little Serena Lake', island: 'mirabel', kind: 'basin', at: [2.0, 29.9], rx: 0.55, ry: 0.12, rot: 55, depth: 2.5 },
  { id: 'long-swale-lake', name: 'Long Swale Lake', island: 'mirabel', kind: 'basin', at: [2.2, 25.0], rx: 0.75, ry: 0.11, rot: 35, depth: 2.5 },
  { id: 'oyster-dune-lake', name: 'Oyster Lake', island: 'mirabel', kind: 'basin', at: [3.9, 24.6], rx: 0.5, ry: 0.12, rot: 40, depth: 2 },
  { id: 'lake-mirabel', name: 'Lake Mirabel', island: 'mirabel', kind: 'basin', at: [5.0, 40.0], rx: 0.42, ry: 0.16, rot: 85, depth: 3 },
  // Wickham
  { id: 'blue-sink', name: 'Blue Sink', island: 'wickham', kind: 'basin', at: [11.3, 12.6], rx: 0.22, ry: 0.2, rot: 0, depth: 28 },
  { id: 'punchbowl-sink', name: 'Punchbowl Sink', island: 'wickham', kind: 'quarry', at: [15.6, 15.9], rx: 0.13, ry: 0.13, rot: 0, depth: 30 },
  { id: 'round-lake', name: 'Round Lake', island: 'wickham', kind: 'basin', at: [15.9, 10.0], rx: 0.48, ry: 0.45, rot: 0, depth: 8 },
  { id: 'deep-lake', name: 'Deep Lake', island: 'wickham', kind: 'basin', at: [11.4, 8.9], rx: 0.34, ry: 0.3, rot: 0, depth: 18 },
  { id: 'sand-lake', name: 'Sand Lake', island: 'wickham', kind: 'basin', at: [16.2, 5.4], rx: 0.6, ry: 0.4, rot: 20, depth: 5 },
  { id: 'little-sink', name: 'Little Sink', island: 'wickham', kind: 'basin', at: [12.1, 4.8], rx: 0.15, ry: 0.13, rot: 0, depth: 12 },
  { id: 'gator-pond', name: 'Gator Pond', island: 'wickham', kind: 'basin', at: [18.0, 14.2], rx: 0.4, ry: 0.28, rot: 10, depth: 1.5 },
  { id: 'phosphate-pits', name: 'The Phosphate Pits', island: 'wickham', kind: 'quarry', at: [17.8, 7.8], rx: 0.7, ry: 0.22, rot: 25, depth: 12 },
  // Ossahatchee
  { id: 'big-water', name: 'Big Water', island: 'ossahatchee', kind: 'basin', at: [40.6, 15.2], rx: 2.0, ry: 0.16, rot: 8, depth: 3 },
  { id: 'cowhouse-lake', name: 'Cowhouse Lake', island: 'ossahatchee', kind: 'basin', at: [47.2, 13.2], rx: 0.7, ry: 0.4, rot: -15, depth: 2.5 },
  { id: 'sill-lake', name: 'Sill Lake', island: 'ossahatchee', kind: 'basin', at: [52.5, 11.0], rx: 0.6, ry: 0.35, rot: 30, depth: 2 },
  { id: 'dinner-pond', name: 'Dinner Pond', island: 'ossahatchee', kind: 'basin', at: [35.0, 12.0], rx: 0.4, ry: 0.3, rot: 0, depth: 2 },
  { id: 'honey-lake', name: 'Honey Lake', island: 'ossahatchee', kind: 'basin', at: [44.0, 20.6], rx: 0.65, ry: 0.4, rot: 10, depth: 2.5 },
  { id: 'black-lake', name: 'Black Lake', island: 'ossahatchee', kind: 'basin', at: [29.0, 10.6], rx: 0.7, ry: 0.32, rot: -10, depth: 3 },
  { id: 'long-ridge-pond', name: 'Long Ridge Pond', island: 'ossahatchee', kind: 'basin', at: [59.2, 17.1], rx: 0.2, ry: 0.18, rot: 0, depth: 9 },
  { id: 'borrow-pit-lake', name: 'Borrow Pit Lake', island: 'ossahatchee', kind: 'quarry', at: [50.5, 18.9], rx: 0.5, ry: 0.12, rot: -12, depth: 6 },
  // Saint Ambrose
  { id: 'rice-reserve', name: 'The Rice Reserve', island: 'saint-ambrose', kind: 'basin', at: [47.4, 41.8], rx: 0.9, ry: 0.5, rot: 20, depth: 1.5 },
  { id: 'cypress-pond', name: 'Cypress Pond', island: 'saint-ambrose', kind: 'basin', at: [41.4, 39.6], rx: 0.4, ry: 0.3, rot: 0, depth: 2 },
  { id: 'heron-pond', name: 'Heron Pond', island: 'saint-ambrose', kind: 'basin', at: [59.6, 48.4], rx: 0.45, ry: 0.3, rot: 30, depth: 1.5 },
  // Banks and keys
  { id: 'merrin-woods-pond', name: 'Merrin Woods Pond', island: 'gannet', kind: 'basin', at: [83.0, 9.3], rx: 0.22, ry: 0.1, rot: 40, depth: 2 },
  { id: 'sabal-salt-pond', name: 'Sabal Salt Pond', island: 'sabal', kind: 'basin', at: [43.2, 0.8], rx: 0.5, ry: 0.3, rot: 5, depth: 1.2 },
];
