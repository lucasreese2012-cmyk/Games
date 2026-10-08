// Generated documentation: register books, world-scale tables, the automated
// realism audit and per-island measured blocks. Every number comes from the
// analysis of the generated terrain.
import fs from 'node:fs';
import path from 'node:path';
import { ISLANDS, PEAKS, LAKES, RIVERS, WATERS } from '../world/geography.mjs';
import { SETTLEMENTS } from '../world/settlements.mjs';
import { ROADS, RAILS, AIRPORTS, PORTS, FERRIES, POWER } from '../world/transport.mjs';
import { LANDMARKS } from '../world/registers/landmarks.mjs';
import { VIEWPOINTS } from '../world/registers/viewpoints.mjs';
import { BEACHES } from '../world/registers/beaches.mjs';
import { FORESTS } from '../world/registers/forests.mjs';
import { DISTRICTS } from '../world/registers/districts.mjs';
import { LC } from './landcover.mjs';
import { DESIGN } from './lib/profile.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const islandName = (id) => ISLANDS.find((s) => s.id === id)?.name || id;
const n0 = (v) => Math.round(v).toLocaleString('en-US');
const f1 = (v) => (Math.round(v * 10) / 10).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f2 = (v) => v.toFixed(2);
const mins = (m) => { const t = Math.round(m); return t >= 60 ? `${Math.floor(t / 60)} h ${String(t % 60).padStart(2, '0')} min` : `${t} min`; };
const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const bearing = (dx, dy) => DIRS[Math.round((((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360) / 22.5) % 16];

// "3.2 km SSE of Tennalee Falls" relative to the nearest town or village.
export function locate(at) {
  let best = null;
  for (const s of SETTLEMENTS) {
    const d = Math.hypot(at[0] - s.at[0], at[1] - s.at[1]);
    const score = d / (s.pop > 5000 ? 1.6 : 1);
    if (!best || score < best.score) best = { s, d, score };
  }
  const { s, d } = best;
  if (d < 0.6) return `in ${s.name}`;
  return `${f1(d)} km ${bearing(at[0] - s.at[0], at[1] - s.at[1])} of ${s.name}`;
}
const grid = (at) => `${f1(at[0])} E / ${f1(at[1])} N`;

const writeFile = (rel, text) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
};
// Replace the block between the generated markers, keeping hand-written text.
export function splice(rel, body) {
  const p = path.join(ROOT, rel);
  const B = '<!-- BEGIN GENERATED -->', E = '<!-- END GENERATED -->';
  let text = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : `${B}\n${E}\n`;
  if (!text.includes(B)) text += `\n${B}\n${E}\n`;
  const a = text.indexOf(B) + B.length, b = text.indexOf(E);
  writeFile(rel, `${text.slice(0, a)}\n${body.trim()}\n${text.slice(b)}`);
}

const entry = (e, extra = []) => [
  `### ${e.name}`,
  '',
  ...extra.map(([k, v]) => `- **${k}:** ${v}`),
  `- **Description:** ${e.desc}`,
  `- **Geographic justification:** ${e.why}`,
  `- **Visual identity:** ${e.look}`,
  `- **Nearby features:** ${e.near}`,
  `- **Why it is memorable:** ${e.memorable}`,
  '',
].join('\n');

const ISLAND_ORDER = ISLANDS.filter((s) => !s.offworld && !s.partOf).map((s) => s.id);
const byIsland = (list) => {
  const out = [];
  for (const id of ISLAND_ORDER) {
    const items = list.filter((e) => e.island === id || ISLANDS.find((s) => s.id === e.island)?.partOf === id);
    if (items.length) out.push([id, items]);
  }
  return out;
};
const indexTable = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

export function writeRegisters(A) {
  const seenBy = new Map();
  for (const v of A.viewpoints) for (const s of v.seen) {
    if (!seenBy.has(s.id)) seenBy.set(s.id, []);
    seenBy.get(s.id).push(v.name);
  }
  const placed = new Map(A.placement.map((p) => [`${p.reg}:${p.id}`, p]));
  const shareOf = new Map(A.viewshed.map((v) => [v.id, v.share]));

  // Landmarks ------------------------------------------------------------------
  {
    const tiers = [['primary', 'Primary landmarks', 'Visible across an island or between islands; the fixed points by which the whole archipelago is navigated.'],
      ['secondary', 'Secondary landmarks', 'Dominate one region or valley and are visible from its roads.'],
      ['local', 'Local landmarks', 'Orient a single town, cove, marsh or beach.'],
      ['micro', 'Micro landmarks', 'Small physical details found on foot, close up.']];
    let md = `# Landmark Register\n\n${LANDMARKS.length} landmarks in four tiers. Positions are on the world grid (kilometres east / north of the map origin). Ground elevations, viewshed shares and "seen from" lists are measured from the generated terrain with earth curvature, refraction and forest canopy.\n\n`;
    md += indexTable(['Tier', 'Count'], tiers.map(([t, n]) => [n, LANDMARKS.filter((l) => l.tier === t).length])) + '\n\n';
    for (const [t, title, blurb] of tiers) {
      md += `## ${title}\n\n${blurb}\n\n`;
      for (const [isl, items] of byIsland(LANDMARKS.filter((l) => l.tier === t))) {
        md += `#### ${islandName(isl)}\n\n`;
        for (const l of items) {
          const p = placed.get(`landmark:${l.id}`);
          const extra = [['Island', islandName(l.island)], ['Location', `${locate(l.at)} (grid ${grid(l.at)})`], ['Type', l.kind]];
          if (p && p.h != null) extra.push(['Ground elevation', p.wet ? 'in the water' : `${n0(p.h)} m`]);
          if (l.h) extra.push(['Structure height', `${n0(l.h)} m`]);
          if (shareOf.has(l.id)) extra.push(['Visible from', `${(shareOf.get(l.id) * 100).toFixed(0)}% of all land in the islands`]);
          const sb = seenBy.get(l.id);
          if (sb) extra.push(['Seen from viewpoints', sb.slice(0, 8).join(', ') + (sb.length > 8 ? `, and ${sb.length - 8} more` : '')]);
          md += entry(l, extra) + '\n';
        }
      }
    }
    writeFile('docs/registers/landmarks.md', md);
  }

  // Viewpoints -----------------------------------------------------------------
  {
    let md = `# Viewpoint Register\n\n${VIEWPOINTS.length} viewpoints. "Visible" lists are computed line-of-sight results to primary and secondary landmarks, summits over 1,000 m and towns over 10,000 people, out to a 60 km haze limit.\n\n`;
    md += indexTable(['Viewpoint', 'Island', 'Ground (m)', 'Eye (m)', 'Targets visible'], A.viewpoints.map((v) => [v.name, islandName(v.island), v.ground == null ? '—' : n0(Math.max(0, v.ground)), v.eye || 2, v.seen.length])) + '\n\n';
    for (const [isl, items] of byIsland(A.viewpoints)) {
      md += `## ${islandName(isl)}\n\n`;
      for (const v of items) {
        const far = v.seen.slice().sort((a, b) => b.dist - a.dist)[0];
        const extra = [['Island', islandName(v.island)], ['Location', `${locate(v.at)} (grid ${grid(v.at)})`],
          ['Elevation', `${n0(Math.max(0, v.ground))} m ground, eye ${v.eye || 2} m above it`]];
        if (v.facing != null) extra.push(['Faces', bearing(Math.sin((v.facing * Math.PI) / 180), Math.cos((v.facing * Math.PI) / 180))]);
        extra.push(['Measured view', v.seen.length ? `${v.seen.length} targets; nearest ${v.seen.slice(0, 6).map((s) => `${s.name} (${f1(s.dist)} km)`).join(', ')}${far ? `; farthest ${far.name} (${f1(far.dist)} km)` : ''}` : 'enclosed: a close view of its own setting only']);
        md += entry(v, extra) + '\n';
      }
    }
    writeFile('docs/registers/viewpoints.md', md);
  }

  // Beaches --------------------------------------------------------------------
  {
    let md = `# Beach Register\n\n${BEACHES.length} beaches. Each is snapped to the generated shoreline; length is measured along the shore.\n\n`;
    md += indexTable(['Beach', 'Island', 'Length (km)', 'Sand'], A.beaches.map((b) => [b.name, islandName(b.island), f1(b.len), b.sand])) + '\n\n';
    for (const [isl, items] of byIsland(A.beaches)) {
      md += `## ${islandName(isl)}\n\n`;
      for (const b of items) md += entry(b, [['Island', islandName(b.island)], ['Location', `${locate(b.snapped)} (grid ${grid(b.snapped)})`], ['Length', `${f1(b.len)} km`], ['Sand', b.sand]]) + '\n';
    }
    writeFile('docs/registers/beaches.md', md);
  }

  // Lakes ----------------------------------------------------------------------
  {
    let md = `# Lake Register\n\n${A.lakes.length} lakes, reservoirs, ponds and lagoons. Surface level, area and depth are measured from the flooded terrain.\n\n`;
    md += indexTable(['Lake', 'Island', 'Type', 'Surface (m)', 'Area (km²)', 'Max depth (m)'], A.lakes.map((l) => [l.name, islandName(l.island), l.type || l.kind, l.level == null ? '—' : f1(l.level), f2(l.areaKm2), f1(l.maxDepth)])) + '\n\n';
    for (const [isl, items] of byIsland(A.lakes)) {
      md += `## ${islandName(isl)}\n\n`;
      for (const l of items) md += entry(l, [['Island', islandName(l.island)], ['Location', `${l.where} — ${locate(l.at)}`], ['Type', l.type || l.kind], ['Surface elevation', `${f1(l.level)} m`], ['Area', `${f2(l.areaKm2)} km²`], ['Maximum depth', `${f1(l.maxDepth)} m`]]) + '\n';
    }
    writeFile('docs/registers/lakes.md', md);
  }

  // Forests --------------------------------------------------------------------
  {
    let md = `# Forest Register\n\n${FORESTS.length} named forests. Area is the extent of the named stand; the dominant cover class is what the land-cover model paints there.\n\n`;
    const rows = FORESTS.map((f) => [f.name, islandName(f.island), LC.find((c) => c.key === f.cover)?.name || f.cover, f1(Math.PI * f.rx * f.ry)]);
    md += indexTable(['Forest', 'Island', 'Cover', 'Extent (km²)'], rows) + '\n\n';
    for (const [isl, items] of byIsland(FORESTS)) {
      md += `## ${islandName(isl)}\n\n`;
      for (const f of items) md += entry(f, [['Island', islandName(f.island)], ['Location', `${locate(f.at)} (grid ${grid(f.at)})`], ['Forest type', LC.find((c) => c.key === f.cover)?.name || f.cover], ['Extent', `about ${f1(Math.PI * f.rx * f.ry)} km²`]]) + '\n';
    }
    writeFile('docs/registers/forests.md', md);
  }

  // Mountains ------------------------------------------------------------------
  {
    let md = `# Mountain Register\n\n${A.mountains.length} summits, from the 2,047 m Ledford Dome to coastal hills a few dozen metres high that still carry the name locally. "Relief" is the drop to the lowest ground within 3 km.\n\n`;
    const ms = A.mountains.slice().sort((a, b) => b.z - a.z);
    md += indexTable(['Summit', 'Island', 'Elevation (m)', 'Relief within 3 km (m)', 'Form'], ms.map((m) => [m.name, islandName(m.island), n0(m.z), n0(m.relief3km), m.kind])) + '\n\n';
    for (const [isl, items] of byIsland(ms)) {
      md += `## ${islandName(isl)}\n\n`;
      for (const m of items) md += entry(m, [['Island', islandName(m.island)], ['Location', `${m.where} — ${locate(m.at)}`], ['Elevation', `${n0(m.z)} m (surveyed terrain ${n0(m.measured)} m)`], ['Local relief', `${n0(m.relief3km)} m within 3 km`], ['Form', m.kind]]) + '\n';
    }
    writeFile('docs/registers/mountains.md', md);
  }

  // Districts ------------------------------------------------------------------
  {
    let md = `# Urban District Register\n\n${DISTRICTS.length} districts across the cities, towns and resort strips. Building heights are the typical range; coverage is the share of each block under roofs and paving.\n\n`;
    md += indexTable(['District', 'Island', 'Form', 'Building heights (m)'], DISTRICTS.map((d) => [d.name, islandName(d.island), d.form, d.bldg ? `${d.bldg[0]}–${d.bldg[1]}` : '—'])) + '\n\n';
    for (const [isl, items] of byIsland(DISTRICTS)) {
      md += `## ${islandName(isl)}\n\n`;
      for (const d of items) {
        const p = placed.get(`district:${d.id}`);
        const extra = [['Island', islandName(d.island)], ['Location', `${locate(d.at)} (grid ${grid(d.at)})`], ['Urban form', d.form]];
        if (d.bldg) extra.push(['Buildings', `${d.bldg[0]}–${d.bldg[1]} m tall, ${Math.round(d.bldg[2] * 100)}% of ground built or paved`]);
        if (p && p.h != null && !p.wet) extra.push(['Ground elevation', `${n0(p.h)} m`]);
        extra.push(['Extent', `about ${f1(Math.PI * d.r * d.r)} km²`]);
        md += entry(d, extra) + '\n';
      }
    }
    writeFile('docs/registers/districts.md', md);
  }
}

// ---------------------------------------------------------------------------
// World scale.
export function scaleTables(A) {
  const isl = ISLANDS.filter((s) => !s.offworld);
  const st = (id) => A.stats[id];
  // Merge Ambrose Beach into Saint Ambrose for the island table.
  const rows = [];
  const tot = { land: 0, lake: 0, coast: 0, pop: 0 };
  for (const s of isl.filter((q) => !q.partOf)) {
    const parts = [s, ...isl.filter((q) => q.partOf === s.id)].map((q) => st(q.id));
    const land = parts.reduce((a, q) => a + q.landKm2, 0), lake = parts.reduce((a, q) => a + q.lakeKm2, 0), coast = parts.reduce((a, q) => a + q.coastKm, 0);
    const top = Object.entries(PEAKS).filter(([, p]) => p.island === s.id).sort((a, b) => b[1].z - a[1].z)[0];
    const maxZ = Math.max(...parts.map((q) => q.maxZ));
    const low = parts.reduce((a, q) => a + q.lowKm2, 0), steep = parts.reduce((a, q) => a + q.steepKm2, 0);
    const meanZ = parts.reduce((a, q) => a + q.meanZ * q.landKm2, 0) / land;
    const pop = SETTLEMENTS.filter((t) => t.island === s.id || isl.find((q) => q.id === t.island)?.partOf === s.id).reduce((a, t) => a + t.pop, 0);
    tot.land += land; tot.lake += lake; tot.coast += coast; tot.pop += pop;
    rows.push([s.name, s.type, n0(land), f1(lake), n0(coast), f1(parts[0].lengthKm), top ? `${top[1].name}, ${n0(top[1].z)}` : `unnamed, ${n0(maxZ)}`, n0(meanZ), `${Math.round((low / land) * 100)}%`, `${Math.round((steep / land) * 100)}%`, n0(pop)]);
  }
  let md = '## Islands\n\n';
  md += indexTable(['Island', 'Type', 'Land (km²)', 'Inland water (km²)', 'Sea coast (km)', 'Length (km)', 'Highest point (m)', 'Mean elevation (m)', 'Land below 3 m', 'Slopes over 40%', 'Population'], rows) + '\n\n';
  md += `**Archipelago totals:** ${n0(tot.land)} km² of land, ${n0(tot.lake)} km² of lakes and rivers, ${n0(tot.coast)} km of sea coast (measured on the 50 m grid; a 10 m survey would add roughly a third), ${n0(tot.pop)} permanent residents.\n\n`;

  // Drive times.
  const M = ['calder', 'corliss', 'tennalee-falls', 'ledford', 'coldwater', 'narrows-landing', 'graystone', 'whitlock', 'fallon', 'haversham', 'ambrose-beach', 'bellamy', 'mirabel-beach', 'port-serena', 'ossahatchee', 'kestrel', 'merrin', 'wickham', 'sabal'];
  const nm = (id) => SETTLEMENTS.find((s) => s.id === id)?.name || id;
  md += '## Driving times\n\nFastest road route at posted speeds, slowed for curvature and grade; ferry legs include 15 minutes of loading. Distance in kilometres, then time.\n\n';
  md += `| From \\ To | ${M.map(nm).join(' | ')} |\n|---|${M.map(() => '---').join('|')}|\n`;
  for (const a of M) md += `| **${nm(a)}** | ${M.map((b) => (a === b ? '—' : A.drive[a]?.[b] && isFinite(A.drive[a][b].min) ? `${n0(A.drive[a][b].km)} km<br>${mins(A.drive[a][b].min)}` : 'no road')).join(' | ')} |\n`;
  md += '\n**Longest drive within each island**\n\n';
  md += indexTable(['Island', 'Between', 'Distance', 'Time'], Object.entries(A.islandDrive).filter(([, v]) => v).map(([k, v]) => [islandName(k), `${v.from} – ${v.to}`, `${f1(v.km)} km`, mins(v.min)])) + '\n\n';

  // Ferries.
  md += '## Ferries\n\n';
  md += indexTable(['Ferry', 'Type', 'Route length', 'Speed', 'Crossing'], FERRIES.map((fy) => {
    const L = fy.pts.reduce((s, p, k) => (k ? s + Math.hypot(p[0] - fy.pts[k - 1][0], p[1] - fy.pts[k - 1][1]) : 0), 0);
    return [fy.name, fy.kind, `${f1(L)} km`, `${fy.knots} kn`, mins((L / (fy.knots * 1.852)) * 60)];
  })) + '\n\n';
  // Boat passages between harbours (straight-line over water at 20 knots for a typical runabout).
  md += '**Small-boat passages** (typical 20-knot runabout, following the channels)\n\n';
  const boat = [['Calder Inner Harbor', 'Graystone', 25], ['Calder Inner Harbor', 'Port Serena', 33], ['Port Serena', 'Mirabel Pier', 18], ['Haversham', 'Kestrel', 33], ['Kestrel', 'Merrin', 22], ['Merrin', 'Sabal Key', 47], ['Wickham Landing', 'Sabal Key', 30], ['Narrows Landing', 'Calder Inner Harbor', 64]];
  md += indexTable(['From', 'To', 'Water distance', 'Time at 20 kn'], boat.map(([a, b, d]) => [a, b, `${d} km`, mins((d / 37.04) * 60)])) + '\n\n';

  // Roads.
  const routes = A.routes;
  const roadRows = ROADS.map((r) => routes.find((q) => q.id === r.id)).filter(Boolean).sort((a, b) => b.lengthKm - a.lengthKm);
  md += '## Highways and roads\n\nLengths and grades are of the routed, graded alignment (each road is engineered against the terrain within its class limits).\n\n';
  md += indexTable(['Route', 'Name', 'Class', 'Length (km)', 'Steepest grade', 'Deepest cut (m)', 'Highest fill (m)'], roadRows.map((r) => [r.ref || '—', r.name, r.cls, f1(r.lengthKm), `${f1(r.maxGradePct)}%`, n0(r.maxCut), n0(r.maxFill)])) + '\n\n';
  const sumBy = (cls) => roadRows.filter((r) => cls.includes(r.cls)).reduce((a, r) => a + r.lengthKm, 0);
  md += `Totals: ${n0(sumBy(['interstate']))} km interstate, ${n0(sumBy(['highway', 'state', 'parkway']))} km state highways and parkway, ${n0(sumBy(['county', 'arterial']))} km county roads and city arterials (major roads only; local streets are not counted).\n\n`;
  // Rails.
  const railRows = RAILS.map((r) => routes.find((q) => q.id === r.id)).filter(Boolean);
  md += '## Railways\n\n';
  md += indexTable(['Line', 'Status', 'Use', 'Length (km)', 'Ruling grade'], railRows.map((r) => [r.name, r.status, r.use, f1(r.lengthKm), `${f1(r.maxGradePct)}%`])) + '\n\n';
  // Bridges.
  md += '## Bridges\n\nEvery water crossing over 120 m on the routed network. Named bridges carry their structure type and navigation clearance.\n\n';
  const br = A.bridges.slice().sort((a, b) => b.lengthKm - a.lengthKm);
  md += indexTable(['Bridge', 'Carries', 'Length (m)', 'Type', 'Clearance (m)'], br.map((b) => [b.name || `${b.ref || b.routeName} crossing`, b.ref ? `${b.ref} ${b.routeName}` : b.routeName, n0(b.lengthKm * 1000), b.type || 'girder or trestle', b.clearance ?? '—'])) + '\n\n';
  md += '## Tunnels and viaducts\n\n';
  md += indexTable(['Structure', 'Route', 'Length (m)'], A.structures.map((s) => [s.kind, s.routeName, n0(s.lengthKm * 1000)])) + '\n\n';
  // Airports.
  md += '## Airports\n\n';
  md += indexTable(['Airport', 'Runway', 'Length (m)', 'Elevation (m)', 'Gradient', 'Approach clearance (m)'], A.runways.map((r) => {
    const [apid, rw] = r.id.split(':');
    const ap = AIRPORTS.find((q) => q.id === apid);
    const appr = A.approaches.find((q) => q.airport === ap.name && q.runway === rw);
    return [ap.name, rw, n0(r.lengthKm * 1000), n0((r.z0 + r.z1) / 2), `${f2(r.gradePct)}%`, appr ? n0(appr.worstClearance) : '—'];
  })) + '\n\n';
  md += '## Harbours\n\n';
  md += indexTable(['Port', 'Kind', 'Design depth (m)', 'Measured at berth (m)'], A.ports.map((p) => [p.name, p.kind, f1(p.depth), f1(p.measuredDepth)])) + '\n\n';
  // Rivers.
  md += '## Rivers\n\n';
  md += indexTable(['River', 'Island', 'Length (km)', 'Source (m)', 'Fall (m)', 'Mean gradient'], A.rivers.slice().sort((a, b) => b.lengthKm - a.lengthKm).map((r) => [r.name, islandName(r.island), f1(r.lengthKm), n0(r.source), n0(r.drop), `${(r.gradient * 1000).toFixed(1)} m/km`])) + '\n\n';
  // Elevations.
  md += '## Elevations\n\n';
  md += indexTable(['Summit', 'Island', 'Elevation (m)'], Object.values(PEAKS).sort((a, b) => b.z - a.z).slice(0, 25).map((p) => [p.name, islandName(p.island), n0(p.z)])) + '\n\n';
  const deep = WATERS.filter((w) => w.maxDepth).sort((a, b) => b.maxDepth - a.maxDepth);
  md += '**Water depths:** ' + deep.map((w) => `${w.name} ${w.maxDepth} m`).join(', ') + '.\n';
  return md;
}

// ---------------------------------------------------------------------------
// Automated audit.
const limitPct = (r) => 100 * (r.kind === 'rail' ? (r.status === 'abandoned' ? DESIGN['rail-abandoned'] : DESIGN.rail) : DESIGN[r.cls] || DESIGN.county).grade;
export function auditTables(A) {
  const cnt = (reg) => A.placement.filter((p) => p.reg === reg);
  const ok = (list) => `${list.filter((p) => p.ok).length} / ${list.length}`;
  const issues = A.issues;
  let md = '## Automated checks\n\n';
  md += indexTable(['Check', 'Result'], [
    ['Settlements on dry land of the right island', ok(cnt('settlement'))],
    ['Districts placed on their island', ok(cnt('district'))],
    ['Viewpoints placed (bridge and pier decks allowed)', ok(cnt('viewpoint'))],
    ['Landmarks placed (lighthouses, wrecks, bridges allowed in water)', ok(cnt('landmark'))],
    ['Beaches snapped to a real shoreline', `${A.beaches.filter((b) => b.moved != null).length} / ${A.beaches.length}; median move ${f2(A.beaches.map((b) => b.moved || 0).sort((a, b) => a - b)[Math.floor(A.beaches.length / 2)])} km`],
    ['Summits within 15 m of survey height and a local maximum', `${A.mountains.filter((m) => m.localMax && Math.abs(m.measured - m.z) <= 15).length} / ${A.mountains.length}`],
    ['Lakes holding water', `${A.lakes.filter((l) => l.areaKm2 > 0).length} / ${A.lakes.length}`],
    ['Rivers falling continuously to the sea or a lake', `${A.rivers.filter((r) => !r.rises && r.mouth !== 'land').length} / ${A.rivers.length}`],
    ['Roads and rails within class grade limits', `${A.routes.filter((r) => r.maxGradePct <= limitPct(r) + 0.05).length} / ${A.routes.length}`],
    ['Runway approach surfaces (50:1) clear of terrain and trees', `${A.approaches.filter((a) => a.worstClearance >= 0).length} / ${A.approaches.length}`],
    ['Harbour berths at design depth', `${A.ports.filter((p) => p.measuredDepth >= p.depth - 0.5).length} / ${A.ports.length}`],
    ['Open issues', String(issues.length)],
  ]) + '\n\n';
  if (issues.length) md += issues.map((i) => `- ${i.kind} **${i.id}**: ${i.msg}`).join('\n') + '\n\n';
  md += '### Closed drainage\n\nAfter drainage enforcement, the only closed depressions deeper than 1.5 m are on islands where they are real wetlands (karst sinks, cypress domes, dune swales):\n\n';
  md += indexTable(['Island', 'Area (km²)', 'Deepest (m)'], Object.entries(A.depressionByIsland).map(([k, v]) => [islandName(k), f1(v.areaKm2), f1(v.maxDepth)])) + '\n\n';
  md += '### Landmark visibility\n\nShare of all land from which each primary landmark can be seen by a standing person (1 km sample grid, curvature, refraction and canopy):\n\n';
  md += indexTable(['Primary landmark', 'Height (m)', 'Visible from'], A.viewshed.map((v) => [v.name, v.h ? n0(v.h) : 'natural', `${(v.share * 100).toFixed(0)}%`])) + '\n\n';
  md += '### Landmark chains\n\nWhat each primary landmark sees of the other primaries and the high summits — the network a traveller can steer by:\n\n';
  md += A.chains.map((c) => `- **${c.name}** → ${c.sees.length ? c.sees.join(', ') : 'none (enclosed setting)'}`).join('\n') + '\n\n';
  md += '### Road engineering\n\n';
  md += indexTable(['Route', 'Class', 'Steepest grade', 'Deepest cut (m)', 'Highest fill (m)', 'Structures'], A.routes.map((r) => [r.ref ? `${r.ref} ${r.name}` : r.name, r.cls, `${f1(r.maxGradePct)}%`, n0(r.maxCut), n0(r.maxFill), r.segs.filter((s) => s.len >= 0.1).map((s) => `${s.kind} ${n0(s.len * 1000)} m`).join(', ') || '—'])) + '\n';
  return md;
}

// Per-island measured block: area, relief, settlements, biome shares, routes.
export function islandBlock(A, id) {
  const ids = [id, ...ISLANDS.filter((s) => s.partOf === id).map((s) => s.id)];
  const parts = ids.map((k) => A.stats[k]).filter(Boolean);
  const land = parts.reduce((a, q) => a + q.landKm2, 0);
  const cover = new Array(LC.length).fill(0);
  for (const k of ids) (A.coverByIsland[k] || []).forEach((v, i) => { cover[i] += v; });
  const coverRows = cover.map((v, i) => [LC[i].name, v]).filter(([, v]) => v / land >= 0.005).sort((a, b) => b[1] - a[1]);
  const towns = SETTLEMENTS.filter((s) => ids.includes(s.island)).sort((a, b) => b.pop - a.pop);
  const peaks = Object.values(PEAKS).filter((p) => p.island === id).sort((a, b) => b.z - a.z);
  const rivers = A.rivers.filter((r) => r.island === id).sort((a, b) => b.lengthKm - a.lengthKm);
  const lakes = A.lakes.filter((l) => ids.includes(l.island));
  const lmk = LANDMARKS.filter((l) => ids.includes(l.island));
  const maxZ = Math.max(...parts.map((q) => q.maxZ));
  const coast = parts.reduce((a, q) => a + q.coastKm, 0);
  let md = '### Measured from the generated terrain\n\n';
  md += indexTable(['Measure', 'Value'], [
    ['Land area', `${n0(land)} km²`],
    ['Inland water', `${f1(parts.reduce((a, q) => a + q.lakeKm2, 0))} km²`],
    ['Sea coastline', `${n0(coast)} km`],
    ['Greatest length', `${f1(parts[0].lengthKm)} km`],
    ['Highest point', peaks.length ? `${peaks[0].name}, ${n0(peaks[0].z)} m` : `${n0(maxZ)} m (unnamed)`],
    ['Mean elevation', `${n0(parts.reduce((a, q) => a + q.meanZ * q.landKm2, 0) / land)} m`],
    ['Land below 3 m', `${Math.round((parts.reduce((a, q) => a + q.lowKm2, 0) / land) * 100)}%`],
    ['Slopes steeper than 40%', `${Math.round((parts.reduce((a, q) => a + q.steepKm2, 0) / land) * 100)}%`],
    ['Population', n0(towns.reduce((a, t) => a + t.pop, 0))],
    ['Longest drive', A.islandDrive[id] ? `${A.islandDrive[id].from} – ${A.islandDrive[id].to}, ${f1(A.islandDrive[id].km)} km, ${mins(A.islandDrive[id].min)}` : '—'],
    ['Register entries', `${lmk.length} landmarks, ${VIEWPOINTS.filter((v) => ids.includes(v.island)).length} viewpoints, ${BEACHES.filter((b) => ids.includes(b.island)).length} beaches, ${lakes.length} lakes, ${FORESTS.filter((f) => ids.includes(f.island)).length} forests, ${A.mountains.filter((m) => ids.includes(m.island)).length} summits, ${DISTRICTS.filter((d) => ids.includes(d.island)).length} districts`],
  ]) + '\n\n';
  md += '**Land cover (share of land area)**\n\n';
  md += indexTable(['Cover', 'Share', 'km²'], coverRows.map(([n, v]) => [n, `${((v / land) * 100).toFixed(1)}%`, f1(v)])) + '\n\n';
  if (towns.length) md += '**Settlements**\n\n' + indexTable(['Settlement', 'Form', 'Population', 'Why here'], towns.map((t) => [t.name, t.form, n0(t.pop), t.why])) + '\n\n';
  if (rivers.length) md += '**Rivers**\n\n' + indexTable(['River', 'Length', 'Fall', 'Gradient'], rivers.map((r) => [r.name, `${f1(r.lengthKm)} km`, `${n0(r.drop)} m`, `${(r.gradient * 1000).toFixed(1)} m/km`])) + '\n\n';
  return md;
}
