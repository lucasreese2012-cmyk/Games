# 12 — Landmark Generation

The world's named places are kept in seven registers. They are data first (`world/registers/*.mjs`) and documents second: every entry is placed on the generated terrain, tested against it, and then written out as a book with its measured elevation, extent and sightlines.

| Register | Entries | Book |
|---|---|---|
| Landmarks | 112 (22 primary, 36 secondary, 30 local, 24 micro) | [registers/landmarks.md](registers/landmarks.md) |
| Viewpoints | 50 | [registers/viewpoints.md](registers/viewpoints.md) |
| Beaches | 50 | [registers/beaches.md](registers/beaches.md) |
| Lakes | 50 | [registers/lakes.md](registers/lakes.md) |
| Forests | 50 | [registers/forests.md](registers/forests.md) |
| Mountains | 50 | [registers/mountains.md](registers/mountains.md) |
| Urban districts | 50 | [registers/districts.md](registers/districts.md) |

**412 entries in total.** Every entry carries the eight required fields: name, island, approximate location (as a distance and bearing from the nearest town plus a grid reference), physical description, geographic justification, visual identity, nearby environmental features, and why it is visually memorable. The books add measured data: ground elevation, structure height, area, depth, summit relief, building heights, viewshed share and the list of what each viewpoint can actually see.

## How entries were chosen

1. **Geography first.** Each entry exists because a physical process puts it there: waterfalls where streams leave resistant rock; lighthouses on capes and inlets; quarries on hard rock; fire towers on the only high points of flat forest; bridges where roads must cross water; balds on thin-soiled western summits; beaches only where waves bring sand.
2. **Distribution follows the land.** Halcomb, the largest and most varied island, has the most landmarks (27); flat, empty Wickham and Ossahatchee have fewer, spaced further apart; the city has the densest district register.
3. **Tiers by visibility.** Primary landmarks are tall or vast enough to see across islands (and are tested for it); secondary ones dominate a region; local ones a town, a cove or a road; micro ones are found on foot.
4. **Variety of kind.** Landmark types range across 49 kinds — towers, masts, bridges, lighthouses, waterfalls, dams, cliffs, domes, dunes, wrecks, ruins, springs, trees, canals, tunnel portals, a sound.
5. **Physical evidence only.** Ruins, wrecks and abandoned works are described as they stand. No register entry explains a history.

## Naming

- Names are built from the local geography (Hickory Falls on Hickory Creek on the Hickory Tableland), from physical description (Blue Wall, Glassface Dome, Boneyard Beach, Sinking Pond) or from the settlement they belong to. A family of names around one feature is how real places are named and is deliberate.
- No name is reused for a different place. Where two registers name the same object — a lighthouse that is both a landmark and a viewpoint, a bridge whose deck is a viewpoint — they refer to the same structure.
- Words that recur most (Beach, Tower, Bridge, Hill, Falls, Point) are generic feature words, as on any real map.

## Tests applied to every entry

- Placed on the right island, on land (or in water where flagged — wrecks, lights on shoals, bridges, houseboats).
- Beaches snapped to a real shoreline cell.
- Summits within 15 m of their surveyed height and the local high point.
- Lakes hold water at their stated surface.
- Forests painted only onto ground whose land cover is compatible.
- Viewpoints tested for line of sight to every landmark, summit and town, with earth curvature, refraction and canopy.

The test results are in [15 — Realism Audit](15-realism-audit.md).
