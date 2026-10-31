/* ═════════ وضع التطوير (2/3): the editor's screen. A camera that flies over the island (drag, pinch, twist), a rail of tools
   (select and move, add, shape the land, water, erase), a panel for whatever is selected or the brush in hand, a catalogue of
   everything that can be put down, undo and redo, and «تجربة»: straight into the game where you were looking ═════════ */
const ED_ICON = {
  sel: '<path d="M6 3.5l12.5 7.2-5.6 1.6-2.4 5.4z" fill="currentColor" stroke="none"/><path d="M13 13.4l4.5 5.1" stroke-width="2.2"/>',
  add: '<path d="M12 5v14M5 12h14" stroke-width="2.7"/>',
  ter: '<path d="M2.5 19l6.2-10 3.6 5.6 2.3-3.4 6.9 7.8z" fill="currentColor" stroke="none"/><path d="M17 3.5v5M14.6 6l2.4-2.5L19.4 6"/>',
  paint: '<path d="M14.5 3.5l6 6-7.6 7.6-6-6z" fill="currentColor" stroke="none"/><path d="M6.4 11.6c-2.4.4-3.4 2-3.6 4.2-.2 2-.9 3.3-1.8 4.2 3.4.4 7.4-.6 8.2-4.6"/>',
  gmat: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" fill="currentColor" stroke="none"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.5" fill="currentColor" stroke="none" opacity=".55"/>',
  web: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 3.6 5.6 3.6 8.5s-1 5.9-3.6 8.5c-2.6-2.6-3.6-5.6-3.6-8.5s1-5.9 3.6-8.5z"/>',
  water: '<path d="M12 3.2c3.6 4.6 6.2 7.7 6.2 10.9a6.2 6.2 0 0 1-12.4 0c0-3.2 2.6-6.3 6.2-10.9z" fill="currentColor" stroke="none"/>',
  erase: '<path d="M14.6 4.6l4.8 4.8a1.6 1.6 0 0 1 0 2.3L12 19.1H7.6L4.6 16a1.6 1.6 0 0 1 0-2.3z"/><path d="M9 9.6l5.4 5.4M12 19.1h8"/>',
  undo: '<path d="M9 14.5L4 9.5l5-5"/><path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3"/>', redo: '<path d="M15 14.5l5-5-5-5"/><path d="M19.5 9.5H10a5.5 5.5 0 0 0 0 11h3"/>',
  save: '<path d="M5 4h11.5L20 7.5V20H5z"/><path d="M8.5 4v5h7V4M8.5 20v-6h7v6"/>', play: '<path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none"/>',
  exit: '<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 8l-4 4 4 4M6 12h9.5"/>',
  rotL: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v5h5"/>', rotR: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v5h-5"/>',
  big: '<path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6"/>', small: '<path d="M10 4v6H4M14 20v-6h6M10 10L4 4M14 14l6 6"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>', ground: '<path d="M12 3.5v10M7.5 9.5l4.5 4.5 4.5-4.5M4 19.5h16"/>',
  var: '<path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3"/>', col: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  del: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13M10.5 11v5M13.5 11v5"/>', close: '<path d="M6 6l12 12M18 6 6 18" stroke-width="2.4"/>',
  zin: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M11 8v6M8 11h6"/>', zout: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M8 11h6"/>',
  tup: '<path d="M4 18.5h16M8 12.5l4-4 4 4"/>', tdown: '<path d="M4 5.5h16M8 11.5l4 4 4-4"/>', home: '<circle cx="12" cy="7" r="3"/><path d="M6 21v-3.5A4.5 4.5 0 0 1 10.5 13h3a4.5 4.5 0 0 1 4.5 4.5V21"/>',
  focus: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>', top: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>',
  floors: '<path d="M4 20h16M6 20V8l6-4 6 4v12M9 12h6M9 16h6"/>', style: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.3-1.7-.4-1.1.3-2.3 1.5-2.3H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
  count: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 20c.8-3 2.8-4.5 5-4.5s4.2 1.5 5 4.5M11 20c.8-3 2.8-4.5 5-4.5s4.2 1.5 5 4.5"/>',
  width: '<path d="M3 12h18M6 8l-3 4 3 4M18 8l3 4-3 4"/>', depth: '<path d="M12 3v18M8 6l4-3 4 3M8 18l4 3 4-3"/>', height: '<path d="M6 20.5h12M12 17V4M8 8l4-4 4 4"/>',
  level: '<path d="M3 15c2 0 2-1.5 4.5-1.5S9.5 15 12 15s2-1.5 4.5-1.5S18.5 15 21 15M12 4v7M9 8l3 3 3-3"/>',
  raise: '<path d="M3 20c3-1 4-7 9-7s6 6 9 7"/><path d="M12 10V3M9 6l3-3 3 3"/>', lower: '<path d="M3 13c3 1 4 7 9 7s6-6 9-7"/><path d="M12 3v7M9 7l3 3 3-3"/>',
  flat: '<path d="M3 15h18M3 19h18"/><path d="M7 11l5-5 5 5"/>', smooth: '<path d="M3 15c2.5-4 5-4 7.5 0s5 4 7.5 0c1-1.6 2-2.4 3-2.4"/>', rough: '<path d="M3 17l3-6 3 4 3-8 3 7 3-4 3 7"/>',
  mine: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor" stroke="none"/>',
  nature: '<path d="M12 3l6 8h-3l4 6H5l4-6H6z" fill="currentColor" stroke="none"/><path d="M12 17v4"/>',
  land: '<path d="M2.5 19l6.2-10 3.6 5.6 2.3-3.4 6.9 7.8z" fill="currentColor" stroke="none"/>',
  build: '<path d="M3 6h18v13H3zM3 10.5h18M3 15h18M8 6v4.5M14 6v4.5M11 10.5V15M17 10.5V15M8 15v4M14 15v4"/>',
  house: '<path d="M3 11l9-7 9 7"/><path d="M5.5 10v10h13V10M10 20v-5h4v5"/>', decor: '<path d="M9 3h6l2 6H7z" fill="currentColor" stroke="none"/><path d="M12 9v9M8 21h8"/>',
  veh: '<path d="M3 15v-3l2.5-5h13l2.5 5v3z" fill="currentColor" stroke="none"/><circle cx="7.5" cy="16.5" r="2" fill="currentColor"/><circle cx="16.5" cy="16.5" r="2" fill="currentColor"/>',
  life: '<circle cx="12" cy="6" r="3" fill="currentColor" stroke="none"/><path d="M6 21v-4.5A4.5 4.5 0 0 1 10.5 12h3a4.5 4.5 0 0 1 4.5 4.5V21" fill="currentColor" stroke="none"/>',
  items: '<path d="M3.5 8L12 4l8.5 4v8.5L12 20.5 3.5 16.5z"/><path d="M3.5 8l8.5 4 8.5-4M12 12v8.5"/>', grass: '<path d="M4 20c1-5 2-8 4-11M9 20c0-5 1-9 3-13M14 20c0-4 1.5-7 4-10M19 20c-.3-3 .2-5 1.5-7"/>',
  restore: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v5h5"/><path d="M12 8v4l3 2"/>',
  veg: '<path d="M12 21v-8"/><path d="M12 13c0-4.5 3-7.5 8-8 .2 5-3 8-8 8z" fill="currentColor" stroke="none"/><path d="M12 15c-.4-3.6-2.6-6-7-6.3-.1 4 2.6 6.4 7 6.3z" fill="currentColor" stroke="none"/>',
  flower: '<circle cx="12" cy="9" r="2.2" fill="currentColor"/><path d="M12 4.2a2.4 2.4 0 0 1 0 2.6M16.4 7.5a2.4 2.4 0 0 1-2 1.6M15 12.6a2.4 2.4 0 0 1-2.2-1.4M9 12.6a2.4 2.4 0 0 0 2.2-1.4M7.6 7.5a2.4 2.4 0 0 0 2 1.6"/><path d="M12 11.5V21M12 17c-2-2-4-2.4-5.5-2"/>',
  forest: '<path d="M8 3l4.5 7h-2.5l3.5 6h-11l3.5-6H3.5z" fill="currentColor" stroke="none"/><path d="M17 7l3.5 5h-2l3 5h-6" fill="currentColor" stroke="none"/><path d="M8 16v4M18 17v3"/>', rock: '<path d="M4 18l2-7 5-4 6 2 3 6-2 3z" fill="currentColor" stroke="none"/>',
};
const edSvg = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ED_ICON[k] || ''}</svg>`;
const edAr = (v, dec = 1) => toAr(Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(dec));
const ED_THUMBS = new Set('A_boar A_camel A_chicken A_cow A_deer A_fox A_goat A_horse A_rabbit A_sheep B_barrier B_bridge B_colbox B_container B_ctower B_deck B_fence_metal B_fence_picket B_fence_wood B_gate B_hedge B_pen B_ramp B_sandbags B_spawn B_stairs B_tent B_tower B_wall_brick B_wall_castle B_wall_stone D_amphora D_anvil D_banner D_barrel D_bed D_beehive D_bench D_bookcase D_cabinet D_campfire D_candle D_chair D_chandelier D_chest_big D_chest_small D_clock D_compost D_coop D_crate D_curtain D_cushion D_desk D_fence_farm D_fireplace D_flag_pole D_fountain D_furnace D_globe D_gunbench D_lantern D_loom D_mirror D_oil_lamp D_painting_city D_painting_desert D_painting_forest D_painting_sea D_planter D_pots D_rug D_rug_small D_sandcastle D_scarecrow D_shelf D_sleeping_bag D_snowman D_sofa D_statue_eagle D_statue_horse D_statue_lion D_stool D_stove D_street_lamp D_table D_tailor D_torch_wall D_trough D_vase D_wardrobe D_well D_wind_chime D_workbench G_path_dirt G_path_stone G_plot G_road H_adobe H_apart H_barn H_barracks H_chalet H_city H_clinic H_clock H_farm H_fisher H_hangar H_hut H_khan H_lodge H_mosque H_police H_ruin H_shop H_silo H_stilt H_villa H_ware I_ammo I_crate I_food I_med L_cathedral L_crag L_fortress L_hintze L_kingshall L_street L_terraces L_warehouse P_blonde P_casual P_hunter P_michelle P_soldier Q_lake Q_pond Q_pool R_boulder R_branches R_cliff R_flat R_mossy R_quiver R_stump S_bowl S_crater S_hill S_mesa S_mount S_range S_valley T_acacia T_ash T_birch T_bush T_bush2 T_bush3 T_cactus T_cypress T_dead T_oak T_oak_m T_olive T_palm T_pine T_plane T_spruce T_willow V_ambulance V_bicycle V_bike V_boat V_buggy V_bus V_craftboat V_jeep V_pickup V_police V_raft V_sedan V_sports V_suv V_taxi V_tractor V_truck V_van W_akm W_axe W_bardiche W_battleaxe W_jian W_knife W_ornate W_p92'.split(' '));   // the catalogue's pictures (tools/ed_thumbs.py fills assets/ui/ed)

/* ── the flying camera: a point on the ground it looks at, how far, which way, how steeply ── */
const EDC = { x: 0, z: 0, y: 0, yaw: 0, pitch: 0.72, dist: 40, tyaw: 0, tpitch: 0.72, tdist: 40, fly: null, lift: 0 };
function edSurface(x, z) { let h = terrainAt(x, z); if (LAND_ON) { const v = landTop(x, z); if (v > h) h = v; } return Math.max(h, waterAt(x, z) > h ? waterAt(x, z) : h); }
function edCamApply(dt) {
  const k = dt > 0 ? 1 - Math.exp(-dt * 11) : 1;
  if (EDC.fly) { const f = EDC.fly, q = 1 - Math.exp(-dt * 5); EDC.x = lerp(EDC.x, f.x, q); EDC.z = lerp(EDC.z, f.z, q); if (Math.hypot(EDC.x - f.x, EDC.z - f.z) < 0.3) EDC.fly = null; }
  EDC.tpitch = clamp(EDC.tpitch, 0.12, 1.52); EDC.tdist = clamp(EDC.tdist, 4, 2600);
  EDC.yaw = angLerp(EDC.yaw, EDC.tyaw, k); EDC.pitch = lerp(EDC.pitch, EDC.tpitch, k); EDC.dist = lerp(EDC.dist, EDC.tdist, k);
  const lim = PLAY - 30; EDC.x = clamp(EDC.x, -lim, lim); EDC.z = clamp(EDC.z, -lim, lim);
  const g = edSurface(EDC.x, EDC.z) + EDC.lift; EDC.y = dt > 0 ? lerp(EDC.y, g, 1 - Math.exp(-dt * 7)) : g;
  const cp = Math.cos(EDC.pitch), sp = Math.sin(EDC.pitch);
  camera.position.set(EDC.x + Math.sin(EDC.yaw) * cp * EDC.dist, EDC.y + sp * EDC.dist, EDC.z + Math.cos(EDC.yaw) * cp * EDC.dist);
  const gmin = edSurface(camera.position.x, camera.position.z) + 1.5; if (camera.position.y < gmin) camera.position.y = gmin;
  camera.lookAt(EDC.x, EDC.y, EDC.z);
  // far above the land the near plane moves out with the camera: the depth buffer keeps its precision (no flicker of
  // paving against ground seen from 100 m up)
  const nr = clamp(EDC.dist * 0.012, 0.08, 14);
  if (Math.abs(camera.fov - 55) > 0.01 || Math.abs(camera.near - nr) > nr * 0.15) { camera.fov = 55; camera.near = nr; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();
  ED.focus.set(EDC.x, EDC.y, EDC.z);
}
function edLookAt(x, z, dist) { EDC.fly = { x, z }; if (dist) EDC.tdist = dist; }

/* ── rays from the screen ── */
const _edRC = new THREE.Raycaster(), _edN = new THREE.Vector2();
function edRay(cx, cy) {
  const [lx, ly] = toLocalPt(cx, cy), w = forced ? innerHeight : innerWidth, h = forced ? innerWidth : innerHeight;
  _edN.set(lx / w * 2 - 1, -(ly / h) * 2 + 1); _edRC.setFromCamera(_edN, camera);
  return _edRC.ray;
}
// where the ray meets the ground (fn gives the height: the land with floors and decks, or the bare land)
function edMarch(ray, fn) {
  const o = ray.origin, d = ray.direction, far = Math.min(9000, camera.far * 1.2);
  let prev = 0, t = 0.3, diff = o.y - fn(o.x, o.z);
  if (diff < 0) return null;
  while (t < far) {
    const x = o.x + d.x * t, z = o.z + d.z * t, df = o.y + d.y * t - fn(x, z);
    if (df < 0) {
      let a = prev, b = t;
      for (let k = 0; k < 12; k++) { const m = (a + b) / 2; if (o.y + d.y * m - fn(o.x + d.x * m, o.z + d.z * m) < 0) b = m; else a = m; }
      const tt = (a + b) / 2; return { t: tt, x: o.x + d.x * tt, y: o.y + d.y * tt, z: o.z + d.z * tt };
    }
    prev = t; t += Math.max(0.3, Math.min(40, t * 0.012 + df * 0.35));
  }
  return null;
}
const edHit = (cx, cy) => edMarch(edRay(cx, cy), edGround);
const edHitBare = (cx, cy) => edMarch(edRay(cx, cy), terrainAt);
function edPlaneHit(cx, cy, y) {
  const r = edRay(cx, cy), d = r.direction; if (Math.abs(d.y) < 1e-4) return null;
  const t = (y - r.origin.y) / d.y; if (t <= 0 || t > EDC.dist * 30 + 400) return null;
  return [r.origin.x + d.x * t, r.origin.z + d.z * t];
}
function edCenterGround() {
  const g = edMarch(edRay(innerWidth / 2, innerHeight / 2), edGround);       // (the middle of the screen is the middle in either orientation)
  return g || { x: EDC.x, z: EDC.z, y: EDC.y };
}
/* which thing is under the finger: meshes first, then the round ones, then whatever covers the ground there */
function edTag(o) {
  const v = o.v; if (!v) return;
  const tag = (m) => m.traverse((q) => { q.userData.edId = o.id; });
  if (v.root) tag(v.root); for (const m of v.meshes) tag(m);
  if (v.S && v.S.ctx) for (const m of v.S.ctx.meshes) tag(m);
  if (v.veh) tag(v.veh.root);
}
function edPick(cx, cy) {
  const ray = edRay(cx, cy), list = [];
  for (const o of ED.objs) { const v = o.v; if (!v) continue; if (v.root) list.push(v.root); if (v.S && v.S.ctx) for (const m of v.S.ctx.meshes) list.push(m); if (v.veh) list.push(v.veh.root); for (const m of v.meshes) list.push(m); }
  let best = null, bt = Infinity;
  if (list.length) {
    const hits = _edRC.intersectObjects(list, true);
    for (const h of hits) { if (!h.object.visible) continue; const o = ED.byId.get(h.object.userData.edId); if (o) { best = o; bt = h.distance; break; } }
  }
  const _s = new THREE.Vector3();
  for (const o of ED.objs) { const s = o.v && o.v.sph; if (!s) continue; _s.set(s.x, s.y, s.z); const dd = ray.distanceSqToPoint(_s); if (dd > s.r * s.r) continue; const t = ray.origin.distanceTo(_s) - Math.sqrt(Math.max(0, s.r * s.r - dd)); if (t < bt) { bt = t; best = o; } }
  const g = edMarch(ray, edGround);
  if (g && g.t < bt) {
    let area = Infinity, foot = null;
    for (const o of ED.objs) { const a = edFootArea(o, g.x, g.z); if (a < area) { area = a; foot = o; } }
    if (foot) best = foot;
  }
  return best;
}
// the ground an object covers, for picking the big things by where they lie (Infinity: not here)
function edFootArea(o, x, z) {
  const d = EDK[o.k], v = o.v; if (!v) return Infinity;
  if (d.type === 'land' && v.L) { const L = v.L, [lx, lz] = landLocal(L, x, z), q = landSample(L.def.F, lx, lz); return q && q.d <= 0.5 ? L.R * L.R : Infinity; }
  if (d.type === 'lake' && v.lake) return (x - o.x) ** 2 + (z - o.z) ** 2 < (v.lake.r * 0.85) ** 2 ? v.lake.r ** 2 * 3 : Infinity;
  if (d.type === 'shape') { const c = Math.cos(o.ry), s = Math.sin(o.ry), dx = x - o.x, dz = z - o.z, lx = dx * c - dz * s, lz = dx * s + dz * c; return (lx / (o.w / 2)) ** 2 + (lz / (o.d / 2)) ** 2 < 0.8 ? o.w * o.d : Infinity; }
  if (d.type === 'villa' || (d.type === 'mesh' && (d.pre === 'plot' || d.pre === 'pen' || d.pre === 'deck'))) { const c = Math.cos(o.ry), s = Math.sin(o.ry), dx = x - o.x, dz = z - o.z; return Math.abs(dx * c - dz * s) < o.w / 2 && Math.abs(dx * s + dz * c) < o.d / 2 ? o.w * o.d : Infinity; }
  return Infinity;
}

/* ── the outline round what is selected, the brush's ring: lines drawn over everything, following the ground ── */
const ED_LINE = (() => {
  const mk = (n, col) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); const l = new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: C(col), transparent: true, opacity: 0.95, depthTest: false })); l.renderOrder = 999; l.frustumCulled = false; l.visible = false; scene.add(l); return l; };
  const arrow = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3)); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: C(0xffd76a), depthTest: false, transparent: true })); l.renderOrder = 999; l.frustumCulled = false; l.visible = false; scene.add(l); return l; })();
  return { sel: mk(160, 0xffd76a), brush: mk(72, 0x9be8ff), arrow };
})();
function edLineSet(line, pts) {
  const a = line.geometry.attributes.position.array, n = a.length / 3;
  for (let i = 0; i < n; i++) { const p = pts[Math.min(pts.length - 1, Math.floor(i * pts.length / n))]; a[i * 3] = p[0]; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = p[2]; }
  line.geometry.attributes.position.needsUpdate = true; line.visible = true;
}
function edRing(x, z, rx, rz, ry, n, lift = 0.35) {
  const c = Math.cos(ry), s = Math.sin(ry), out = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU, lx = Math.cos(a) * rx, lz = Math.sin(a) * rz, wx = x + lx * c + lz * s, wz = z - lx * s + lz * c; out.push([wx, edSurface(wx, wz) + lift, wz]); }
  return out;
}
function edRect(x, z, hx, hz, ry, n, lift = 0.35) {
  const c = Math.cos(ry), s = Math.sin(ry), out = [], per = n / 4, cs = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz], [-hx, -hz]];
  for (let e = 0; e < 4; e++) for (let i = 0; i < per; i++) { const t = i / per, lx = lerp(cs[e][0], cs[e + 1][0], t), lz = lerp(cs[e][1], cs[e + 1][1], t), wx = x + lx * c + lz * s, wz = z - lx * s + lz * c; out.push([wx, edSurface(wx, wz) + lift, wz]); }
  return out;
}
// the outline of a thing: { r } round, { hx, hz, ry } a turned box, around (x, z)
function edFoot(o) {
  const d = EDK[o.k], v = o.v; if (!v) return { r: 2 };
  switch (d.type) {
    case 'land': { if (!v.L) return { r: 20 }; const b = v.L.def.F.box, s = v.L.s, cx = (b[0] + b[2]) / 2, cz = (b[1] + b[3]) / 2; return { hx: (b[2] - b[0]) / 2 * s, hz: (b[3] - b[1]) / 2 * s, ry: o.ry, ox: cx * s, oz: cz * s }; }
    case 'lake': return { r: v.lake ? v.lake.r * 0.8 : o.w / 2 };
    case 'shape': return { rx: o.w / 2, rz: o.d / 2, ry: o.ry };
    case 'house': return v.b ? { hx: v.b.hx, hz: v.b.hz, ry: 0 } : { r: 6 };
    case 'villa': return { hx: o.w / 2, hz: o.d / 2, ry: o.ry };
    case 'veh': return { hx: VSPEC[d.veh].track / 2 + 0.3, hz: VSPEC[d.veh].wb / 2 + 0.9, ry: o.ry };
    case 'umodel': { const R = UPL.recs.get(d.mid); if (!R) return { r: 2 }; const [w, , dd] = upDims(R, (o.up || 0) % 6); return { hx: w / 2 * o.s + 0.15, hz: dd / 2 * o.s + 0.15, ry: o.ry }; }
    case 'mesh': {
      if (d.world) return { hx: o.w / 2, hz: (o.d || 1) / 2 + 0.3, ry: o.ry };
      if (o.w) return { hx: o.w / 2 * o.s + 0.2, hz: (o.d || (d.pre === 'stairs' ? o.h * 1.35 : d.pre === 'gate' ? 1 : o.w)) / 2 * o.s + 0.2, ry: o.ry };
      if (!v.box && v.root) { const bb = new THREE.Box3(); v.root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(v.root.matrixWorld).invert(); v.root.traverse((q) => { if (q.isMesh && q.geometry) { q.geometry.computeBoundingBox(); const b2 = q.geometry.boundingBox.clone().applyMatrix4(q.matrixWorld).applyMatrix4(inv); bb.union(b2); } }); v.box = bb.isEmpty() ? null : bb; }
      if (v.box) return { hx: (v.box.max.x - v.box.min.x) / 2 * o.s + 0.15, hz: (v.box.max.z - v.box.min.z) / 2 * o.s + 0.15, ry: o.ry, ox: (v.box.max.x + v.box.min.x) / 2 * o.s, oz: (v.box.max.z + v.box.min.z) / 2 * o.s };
      return { r: 1 };
    }
    default: return { r: v.sph ? Math.max(0.7, v.sph.r) : 1.2 };
  }
}
function edOutline() {
  const o = ED.sel; if (!o || !o.v) { ED_LINE.sel.visible = false; ED_LINE.arrow.visible = false; return; }
  const f = edFoot(o); let x = o.x, z = o.z;
  if (f.ox !== undefined) { const c = Math.cos(f.ry || 0), s = Math.sin(f.ry || 0); x += f.ox * c + f.oz * s; z += -f.ox * s + f.oz * c; }
  const pts = f.r !== undefined ? edRing(x, z, f.r, f.r, 0, 160) : f.rx !== undefined ? edRing(x, z, f.rx, f.rz, f.ry, 160) : edRect(x, z, f.hx, f.hz, f.ry, 160);
  edLineSet(ED_LINE.sel, pts);
  // which way is its front
  const L = f.r !== undefined ? f.r : f.rz !== undefined ? f.rz : f.hz, fx = Math.sin(o.ry), fz = Math.cos(o.ry), rx = Math.cos(o.ry), rz = -Math.sin(o.ry), q = Math.min(2.4, L * 0.35 + 0.6);
  const tipX = o.x + fx * (L + q * 1.4), tipZ = o.z + fz * (L + q * 1.4), bX = o.x + fx * (L + 0.2), bZ = o.z + fz * (L + 0.2);
  const y = (px, pz) => edSurface(px, pz) + 0.4, A = ED_LINE.arrow.geometry.attributes.position.array;
  const seg = [[bX, bZ, tipX, tipZ], [tipX, tipZ, tipX - fx * q * 0.6 + rx * q * 0.5, tipZ - fz * q * 0.6 + rz * q * 0.5], [tipX, tipZ, tipX - fx * q * 0.6 - rx * q * 0.5, tipZ - fz * q * 0.6 - rz * q * 0.5]];
  seg.forEach(([ax, az, bx2, bz2], i) => { A.set([ax, y(ax, az), az, bx2, y(bx2, bz2), bz2], i * 6); });
  ED_LINE.arrow.geometry.attributes.position.needsUpdate = true; ED_LINE.arrow.visible = !(EDK[o.k].type === 'lake' || (EDK[o.k].type === 'shape' && EDK[o.k].round));
}

/* ── undo and redo: each change is one step (a held button or a drag is one step) ── */
function edOp(op) {
  const last = ED.undo[ED.undo.length - 1];
  if (op.t === 'mod' && last && last.t === 'mod' && last.b.id === op.b.id && performance.now() - last.at < 1400 && op.merge) { last.b = op.b; last.at = performance.now(); }
  else { op.at = performance.now(); ED.undo.push(op); if (ED.undo.length > 80) ED.undo.shift(); }
  ED.redo.length = 0; ED.ver++; edStatus(); edDraftSoon();
}
function edApplySnap(s) { const o = ED.byId.get(s.id); if (!o) return null; edFree(o); Object.assign(o, edLoadRec(s), { v: null }); edBuild(o); edTag(o); return o; }
function edDoOp(op, back) {
  switch (op.t) {
    case 'add': if (back) { const o = ED.byId.get(op.s.id); if (o) edRemove(o); } else { const o = edAdd(edLoadRec(op.s)); edTag(o); } break;
    case 'del': if (back) { const o = edAdd(edLoadRec(op.s)); edTag(o); } else { const o = ED.byId.get(op.s.id); if (o) edRemove(o); } break;
    case 'mod': edApplySnap(back ? op.a : op.b); break;
    case 'ter': for (const [k, a, b] of op.ch) edTerrSet(k, back ? a : b); break;
    case 'er': for (const zn of op.add) { if (back) { zoneDel(zn); const i = ED.er.indexOf(zn); if (i >= 0) ED.er.splice(i, 1); } else { zoneAdd(zn); ED.er.push(zn); } edTouch(zn.x, zn.z, zn.r, false, zn.m); }
      for (const zn of op.rem || []) { if (back) { zoneAdd(zn); ED.er.push(zn); } else { zoneDel(zn); const i = ED.er.indexOf(zn); if (i >= 0) ED.er.splice(i, 1); } edTouch(zn.x, zn.z, zn.r, false, zn.m); }
      for (const s of op.dels || []) { if (back) { const o = edAdd(edLoadRec(s)); edTag(o); } else { const o = ED.byId.get(s.id); if (o) edRemove(o); } } break;
    case 'multi': for (const q of back ? op.ops.slice().reverse() : op.ops) edDoOp(q, back); break;
    case 'gp': case 'gb': gmDoOp(op, back); break;
  }
}
function edUndo(redo) {
  const from = redo ? ED.redo : ED.undo, to = redo ? ED.undo : ED.redo, op = from.pop(); if (!op) return;
  edDoOp(op, !redo); to.push(op); ED.ver++; edFlush(true);
  if (ED.sel && !ED.byId.has(ED.sel.id)) edSelect(null); else edSelect(ED.sel);
  edStatus(); edDraftSoon(); AUDIO.equip();
}
// a terrain chunk set back (or forward) to what it was
function edTerrSet(k, arr) {
  const ci = Math.floor(k / 8192) - 4096, cj = (k % 8192) - 4096;
  if (arr) { const a = edtChunk(ci * 64, cj * 64, true); a.set(arr); } else { EDT.ch.delete(k); EDT.n = EDT.ch.size; EDT.lastK = -1; }
  EDT.ver++; edTouch(ci * 128 + 64, cj * 128 + 64, 92, true, 7);
}

/* ── selecting, putting down, changing ── */
function edSelect(o) {
  ED.sel = o && o.v !== undefined ? o : null;
  edOutline(); edCtx();
}
function edPlace(key) {
  const d = EDK[key]; if (!d) return;
  const g = edCenterGround();
  if (d.one) { const old = ED.objs.find((q) => q.k === key); if (old) { const a = edSnap(old); old.x = r2(g.x); old.z = r2(g.z); edRebuild(old); edTag(old); edOp({ t: 'mod', a, b: edSnap(old) }); edFlush(true); edSelect(old); edToast(d.name, 'نُقلت إلى هنا'); return; } }
  const o = edNew(key, g.x, g.z);
  o.ry = d.quarter ? edQuarter(EDC.yaw) * Math.PI / 2 : Math.round(EDC.yaw / (Math.PI / 12)) * (Math.PI / 12);
  if (d.type === 'tree' || d.type === 'rock') { o.ry = rand() * TAU; o.c = Math.floor(rand() * 4); if (d.type === 'tree') o.s = r2(lerp(0.85, 1.15, rand())); }
  if (d.type === 'veh' && !d.paint) o.c = Math.floor(rand() * PAINTS.length);
  edAdd(o); edTag(o); edOp({ t: 'add', s: edSnap(o) }); edFlush(true);
  edSelect(o); edTool('sel');
  const size = Math.max(o.w || 0, o.d || 0, d.type === 'land' ? 160 : d.type === 'house' || d.type === 'villa' ? 30 : d.type === 'umodel' && UPL.recs.get(d.mid) ? Math.max(...upDims(UPL.recs.get(d.mid), 0)) * 1.4 : 0);
  if (size && EDC.tdist < size * 1.1) EDC.tdist = Math.min(2400, size * 1.25);
  AUDIO.build();
}
// change a thing: fn edits the record, then it is built again (one undo step; a held button merges into one)
function edChange(o, fn, merge) {
  if (!o || !o.v) return;
  const a = edSnap(o); fn(o); edRebuild(o); edTag(o);
  edOp({ t: 'mod', a, b: edSnap(o), merge }); edFlush(true); edOutline(); edCtx();
}
function edDelete(o) {
  if (!o) return;
  const s = edSnap(o); edRemove(o); edOp({ t: 'del', s }); edFlush(true); edSelect(null); AUDIO.build();
}
function edDuplicate(o) {
  if (!o || !o.v) return;
  const f = edFoot(o), step = (f.r !== undefined ? f.r * 2 : Math.max(f.hx || f.rx || 1, 1) * 2) + 1, rx = Math.cos(o.ry), rz = -Math.sin(o.ry);
  const n = edLoadRec(edSnap(o)); n.id = ED.nid++; n.x = r2(o.x + rx * step); n.z = r2(o.z + rz * step);
  if (EDK[o.k].one) return;
  edAdd(n); edTag(n); edOp({ t: 'add', s: edSnap(n) }); edFlush(true); edSelect(n); AUDIO.build();
}
// a drag: the thing follows the finger (heavy ones show where they go and are built again when you let go)
function edMoveLive(o, x, z) {
  const d = EDK[o.k], v = o.v; if (!v) return;
  const dx = x - o.x, dz = z - o.z; o.x = r2(x); o.z = r2(z);
  switch (d.type) {
    case 'tree': case 'rock': edRebuild(o); break;
    case 'veh': { const vh = v.veh; if (!vh) break; vh.pos.x = o.x; vh.pos.z = o.z; vh.pos.y = edVehY(d.veh, o.x, o.z) + o.dy; vh.root.position.copy(vh.pos); placeVehicleCols(vh); o.y = vh.pos.y; break; }
    case 'body': { const y = edGround(o.x, o.z) + o.dy; v.body.root.position.set(o.x, y, o.z); o.y = y; if (v.sph) { v.sph.x = o.x; v.sph.y = y + 0.95 * o.s; v.sph.z = o.z; } break; }
    case 'animal': { for (const an of v.herd.members) { an.x += dx; an.z += dz; an.y = terrainAt(an.x, an.z); } v.herd.x = o.x; v.herd.z = o.z; if (v.sph) { v.sph.x = o.x; v.sph.z = o.z; } ED.animDirty = true; break; }
    case 'land': { const now = performance.now(); if (now - (v.liveT || 0) > 220 && v.L) { v.liveT = now; const y = landFitY(v.L.def, o.x, o.z, o.ry, o.s) - edLandSink(d.land, v.L.def, o.s) + o.dy; o.y = y; landSet(v.L, o.x, o.z, o.ry, o.s, y); } break; }
    case 'shape': { const s = v.shapes[0]; if (!s) break; const now = performance.now(); edTouch(s.x, s.z, Math.max(s.w, s.d) / 2 + 3, true, 0); removeShape(s); s.x = o.x; s.z = o.z; addShape(s); edTouch(s.x, s.z, Math.max(s.w, s.d) / 2 + 3, true, 0); if (now - (v.liveT || 0) > 260) { v.liveT = now; edFlush(false); } break; }
    case 'umodel': case 'mesh': if (!d.world && !(v.pads && v.pads.length)) { const y = edGround(o.x, o.z) + o.dy; if (v.root) v.root.position.set(o.x, y, o.z); o.y = y; break; } // falls through: shown moved, built again on release
    default: {
      const sh = (m) => { m.position.x += dx; m.position.z += dz; };
      if (v.root) sh(v.root); for (const m of v.meshes) sh(m);
      if (v.S && v.S.ctx) for (const m of v.S.ctx.meshes.concat(v.S.ctx.inter)) sh(m);
      if (v.sph) { v.sph.x += dx; v.sph.z += dz; }
    }
  }
  edOutline();
}

/* ── the terrain brush: raise, dig, flatten to where you started, smooth, roughen ── */
const EDB = { on: false, x: 0, z: 0, y: 0, have: false, snap: null, flatY: 0, last: 0 };
function edBrushStart(g) {
  EDB.on = true; EDB.snap = new Map(); EDB.x = g.x; EDB.z = g.z; EDB.have = true;
  EDB.flatY = terrainBare(g.x, g.z);
}
function edBrushStep(dt, mode0) {
  if (!EDB.on || !EDB.have) return;
  const r = ED.br, k = ED.bk, mode = mode0 || ED.brush, px = EDB.x, pz = EDB.z;
  const i0 = Math.floor((px - r) * 0.5), i1 = Math.ceil((px + r) * 0.5), j0 = Math.floor((pz - r) * 0.5), j1 = Math.ceil((pz + r) * 0.5);
  const rate = clamp(r * 0.35, 2.5, 14);        // metres a second at full strength (bigger brushes move more earth)
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const wx = i * 2, wz = j * 2, dd = Math.hypot(wx - px, wz - pz); if (dd >= r) continue;
    const f = (1 - (dd / r) ** 2) ** 2, key = edtKey(i >> 6, j >> 6);
    let a = EDT.ch.get(key);
    if (!EDB.snap.has(key)) EDB.snap.set(key, a ? a.slice() : null);
    if (!a) a = edtChunk(i, j, true);
    const q = (j & 63) * 64 + (i & 63);
    if (mode === 'raise') a[q] += k * rate * dt * f;
    else if (mode === 'lower') a[q] -= k * rate * dt * f;
    else if (mode === 'flat') { const cur = terrainBare(wx, wz); a[q] += (EDB.flatY - cur) * Math.min(1, k * 5 * dt) * f; }
    else if (mode === 'smooth') { const cur = terrainBare(wx, wz), avg = (terrainBare(wx + 2, wz) + terrainBare(wx - 2, wz) + terrainBare(wx, wz + 2) + terrainBare(wx, wz - 2) + terrainBare(wx + 2, wz + 2) + terrainBare(wx - 2, wz - 2) + terrainBare(wx + 2, wz - 2) + terrainBare(wx - 2, wz + 2)) / 8; a[q] += (avg - cur) * Math.min(1, k * 6 * dt) * f; }
    else if (mode === 'rough') a[q] += (shN(wx * 0.21 + 3.1, wz * 0.21 - 1.7) - 0.5) * k * rate * 1.6 * dt * f;
  }
  EDT.ver++; edTouch(px, pz, r + 2, true, 0);
  const now = performance.now(); if (now - EDB.last > 110) { EDB.last = now; edFlush(false); }
}
function edBrushEnd() {
  if (!EDB.on) return; EDB.on = false;
  const ch = []; for (const [k, before] of EDB.snap) { const a = EDT.ch.get(k); ch.push([k, before, a ? a.slice() : null]); }
  EDB.snap = null;
  if (ch.length) edOp({ t: 'ter', ch });
  edFlush(true);
}
/* ── the planting brush: forests of the island's own trees, lush grass and flowers painted anywhere dry, the eraser (discs where
   the island grows nothing of what you chose; the editor's own trees and rocks there go) and giving back what was erased ── */
const EDE = { on: false, add: [], rem: [], dels: [], adds: [], last: null, t: 0 };
function edEraseStart() { EDE.on = true; EDE.add = []; EDE.rem = []; EDE.dels = []; EDE.adds = []; EDE.last = null; }
function edEraseAt(x, z) {
  const r = ED.br, mode = ED.vmode, far = (q) => !EDE.last || Math.hypot(EDE.last[0] - x, EDE.last[1] - z) >= r * q;
  const drop = (zn) => { zoneDel(zn); ED.er.splice(ED.er.indexOf(zn), 1); EDE.rem.push(zn); edTouch(zn.x, zn.z, zn.r, false, zn.m & 7 | (zn.m & 24 ? 4 : 0)); };
  const put = (m, px = x, pz = z, pr = r) => { const zn = zoneAdd({ t: 'c', x: r2(px), z: r2(pz), r: r2(pr), m }); ED.er.push(zn); EDE.add.push(zn); edTouch(px, pz, pr, false, m & 7 | (m & 24 ? 4 : 0)); return zn; };
  if (mode === 'back') { for (const zn of ED.er.slice()) if (Math.hypot(zn.x - x, zn.z - z) < r) drop(zn); }
  else if (mode === 'erase') {
    if (!far(0.35)) return; EDE.last = [x, z];
    put(ED.erm);
    for (const o of ED.objs.slice()) { const t = EDK[o.k].type; if (((t === 'tree' && ED.erm & 1) || (t === 'rock' && ED.erm & 2)) && Math.hypot(o.x - x, o.z - z) < r) { EDE.dels.push(edSnap(o)); edRemove(o); } }
  } else if (mode === 'grass' || mode === 'flower') {
    if (!far(0.35)) return; EDE.last = [x, z];
    for (const zn of ED.er.slice()) if ((zn.m & 4) && Math.hypot(zn.x - x, zn.z - z) < r) { drop(zn); if (zn.m & 3) put(zn.m & 3, zn.x, zn.z, zn.r); }   // grass erased here grows again
    put(mode === 'grass' ? 8 : 16);
  } else {
    if (!far(0.6)) return; EDE.last = [x, z];
    const n = Math.max(1, Math.round(ED.bk * r * r / 60));
    for (let i = 0, made = 0; i < n * 4 && made < n; i++) {
      const a = rand() * TAU, d = Math.sqrt(rand()) * r, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, h = terrainAt(px, pz);
      if (waterAt(px, pz) > h - 0.3 || slopeAt(px, pz) > 0.75 || !inPlay(px, pz) || edCleared(px, pz, 1) || (LAND_ON && landTop(px, pz) > h - 1)) continue;
      let close = false; treesNear(px, pz, 3.4, () => { close = true; return false; }); if (close) continue;
      const sp = ED.vsp === 'mix' ? speciesAt(px, pz, biomeAt(px, pz), rand()) : ED.vsp, key = 'T_' + sp; if (!EDK[key]) continue;
      const o = edNew(key, px, pz); o.ry = r2(rand() * TAU); o.c = Math.floor(rand() * 4); o.s = r2(lerp(0.8, 1.2, rand()));
      edAdd(o); EDE.adds.push(edSnap(o)); made++;
    }
  }
  const now = performance.now(); if (now - EDE.t > 250) { EDE.t = now; edFlush(true); }
}
function edEraseEnd() {
  if (!EDE.on) return; EDE.on = false;
  const ops = [];
  if (EDE.add.length || EDE.rem.length || EDE.dels.length) ops.push({ t: 'er', add: EDE.add, rem: EDE.rem, dels: EDE.dels });
  for (const s of EDE.adds) ops.push({ t: 'add', s });
  if (ops.length) edOp(ops.length === 1 ? ops[0] : { t: 'multi', ops });
  edFlush(true); if (ED.sel && !ED.byId.has(ED.sel.id)) edSelect(null);
}

/* ── the screen ── */
const EDUI = { cat: 'mine', q: '', toastT: 0 };
function edToast(title, sub) {
  const t = $('edToast'); t.innerHTML = ''; const b = document.createElement('b'); b.textContent = title; t.append(b);
  if (sub) { const s = document.createElement('small'); s.textContent = sub; t.append(s); }
  t.classList.add('show'); clearTimeout(EDUI.toastT); EDUI.toastT = setTimeout(() => t.classList.remove('show'), 2600);
}
const edCount = (n) => (n === 0 ? 'لا عناصر بعد' : n === 1 ? 'عنصر واحد' : n === 2 ? 'عنصران' : toAr(n) + ' ' + (n <= 10 ? 'عناصر' : 'عنصراً'));
function edStatus() {
  const dirty = ED.ver !== ED.savedVer;
  $('edStat').textContent = edCount(ED.objs.length) + ' · ' + (dirty ? 'تغييرات لم تُحفظ' : ED.objs.length || ED.er.length || EDT.n ? 'محفوظ' : 'ابدأ بالإضافة ＋');
  $('edSave').classList.toggle('dirty', dirty);
  $('edUndo').disabled = !ED.undo.length; $('edRedo').disabled = !ED.redo.length;
}
function edTool(t) {
  if (t === 'add') { edCatOpen(true); return; }
  ED.tool = t; edCatOpen(false);
  for (const b of document.querySelectorAll('#edRail .edt')) b.classList.toggle('on', b.dataset.tool === t);
  if (t !== 'sel') edSelect(null);
  ED_LINE.brush.visible = false;
  edCtx();
}
// the bottom panel: what is selected, or the brush in hand
function edBtn(act, icon, label, opts = {}) {
  return `<button type="button" class="edc${opts.on ? ' on' : ''}${opts.warn ? ' warn' : ''}${opts.wide ? ' wide' : ''}" data-act="${act}"${opts.hold ? ' data-hold="1"' : ''}${opts.dis ? ' disabled' : ''} aria-label="${label}">${edSvg(icon)}<span>${label}</span></button>`;
}
function edStep(key, icon, label, val) {
  return `<div class="edst"><button type="button" class="edc sm" data-act="${key}-" data-hold="1" aria-label="${label} أقل">−</button><div class="edsv">${edSvg(icon)}<b>${val}</b><small>${label}</small></div><button type="button" class="edc sm" data-act="${key}+" data-hold="1" aria-label="${label} أكثر">+</button></div>`;
}
function edCtx() {
  const el = $('edCtx'), o = ED.sel; let h = '';
  if (ED.tool === 'sel' && o) {
    const d = EDK[o.k], t = d.type, m = (v) => edAr(v) + 'م';
    h += `<div class="edname"><b>${d.name}</b><button type="button" class="edx" data-act="desel" aria-label="إلغاء التحديد">${edSvg('close')}</button></div>`;
    if (t !== 'lake' && !(t === 'shape' && d.round)) h += edBtn('rotL', 'rotL', 'تدوير', { hold: !d.quarter }) + edBtn('rotR', 'rotR', 'تدوير', { hold: !d.quarter });
    if (d.w) h += edStep('w', 'width', t === 'lake' ? 'القطر' : d.world || t === 'shape' ? 'الطول' : 'العرض', m(o.w));
    if (d.d && !d.round) h += edStep('d', 'depth', t === 'shape' || d.world ? 'العرض' : 'العمق', m(o.d));
    if (d.h) h += edStep('h', t === 'lake' || ['bowl', 'crater', 'valley'].includes(d.shape) ? 'down' : 'height', t === 'lake' || ['bowl', 'crater', 'valley'].includes(d.shape) ? 'العمق' : 'الارتفاع', m(o.h));
    if (d.f) h += edStep('f', 'floors', 'الطوابق', toAr(o.f));
    if (d.n) h += edStep('n', 'count', 'العدد', toAr(o.n));
    if (d.sc) h += edStep('s', 'big', 'الحجم', '×' + edAr(o.s, 2));
    if (t === 'lake') h += edStep('dy', 'level', 'منسوب الماء', (o.dy >= 0 ? '+' : '−') + edAr(Math.abs(o.dy), 2));
    else if (t !== 'shape' && !d.world) h += edBtn('up', 'up', 'ارفع', { hold: true }) + edBtn('down', 'down', 'اخفض', { hold: true }) + edBtn('ground', 'ground', 'على الأرض', { dis: !o.dy });
    const nv = d.vars ? d.vars.length : t === 'tree' && VEG.species[d.sp] ? VEG.species[d.sp].variants.length : t === 'rock' ? ROCK_KINDS[d.rk].length : t === 'veh' ? (d.paint || PAINTS).length : t === 'body' && d.outfits ? ED_OUTFITS.length : t === 'shape' || t === 'house' || t === 'animal' ? 6 : 0;
    if (nv > 1) h += edBtn('var', t === 'veh' ? 'style' : 'var', d.vars ? d.vars[o.c % d.vars.length] : t === 'veh' ? 'لون آخر' : t === 'body' ? 'لباس آخر' : 'شكل آخر');
    if (t === 'house' && !d.special) h += edBtn('style', 'style', 'طراز ' + (ED_STYLES.find((q) => q[0] === (o.st || d.style)) || ['', 'آخر'])[1]);
    if (t === 'villa') h += edBtn('style', 'style', 'طراز ' + ['مدينة', 'ريفي', 'جبلي', 'طيني'][o.st || 0]);
    if (['mesh', 'house', 'body', 'pickup', 'crate'].includes(t) && !d.edOnly && !d.nocol) h += edBtn('col', 'col', o.col ? 'تصادم: نعم' : 'تصادم: لا', { on: !!o.col });
    if (t === 'umodel') h += edBtn('col', 'col', ['تصادم: لا', 'تصادم: صندوق', 'تصادم: دقيق'][o.col % 3], { on: !!o.col }) + edBtn('pad', 'flat', o.pad ? 'الأرض تحته: مستوية' : 'الأرض تحته: كما هي', { on: !!o.pad }) + edBtn('upr', 'rotR', 'اقلبه');
    if (d.use === 'gate') h += edBtn('open', 'var', o.open ? 'مفتوحة' : 'مغلقة');
    h += edBtn('focus', 'focus', 'إليه') + (d.one ? '' : edBtn('dup', 'dup', 'نسخة')) + edBtn('del', 'del', 'حذف', { warn: true });
  } else if (ED.tool === 'sel') {
    h += `<div class="edtip">${TOUCH ? 'المس شيئاً لتحديده واسحبه لتحريكه · اسحب الأرض لتحريك الكاميرا · إصبعان للتكبير والتدوير' : 'انقر شيئاً لتحديده واسحبه لتحريكه · اسحب الأرض للتنقّل · الزر الأيمن للتدوير والإمالة · العجلة للتكبير'}</div>`;
    h += edBtn('add', 'add', 'أضف شيئاً', { on: true, wide: true });
  } else if (ED.tool === 'ter') {
    for (const [b, ic, lb] of [['raise', 'raise', 'رفع'], ['lower', 'lower', 'حفر'], ['flat', 'flat', 'تسوية'], ['smooth', 'smooth', 'تنعيم'], ['rough', 'rough', 'وعورة']]) h += edBtn('br:' + b, ic, lb, { on: ED.brush === b });
    h += edStep('br', 'width', 'الحجم', edAr(ED.br) + 'م') + edStep('bk', 'up', 'القوة', toAr(Math.round(ED.bk * 100)) + '٪');
    h += edBtn('shapes', 'land', 'جبال وتلال');
  } else if (ED.tool === 'paint') {
    h += gmCtx();
  } else if (ED.tool === 'water') {
    h += `<div class="edtip">الماء يملأ حوضه بنفسه: ضعه ثم حرّكه وكبّره، وارفع منسوبه أو اخفضه</div>`;
    h += edBtn('put:Q_lake', 'water', 'بحيرة') + edBtn('put:Q_pond', 'water', 'بركة') + edBtn('put:Q_pool', 'water', 'مسبح') + edBtn('put:S_valley', 'lower', 'وادٍ');
  } else if (ED.tool === 'erase') {
    for (const [m, ic, lb] of [['tree', 'forest', 'ازرع أشجاراً'], ['grass', 'grass', 'عشب كثيف'], ['flower', 'flower', 'أزهار'], ['erase', 'erase', 'امسح'], ['back', 'restore', 'أرجِع']]) h += edBtn('vm:' + m, ic, lb, { on: ED.vmode === m });
    if (ED.vmode === 'tree') h += edBtn('vsp', 'nature', ED.vsp === 'mix' ? 'أشجار المكان' : (EDK['T_' + ED.vsp] || { name: ED.vsp }).name) + edStep('bk', 'count', 'الكثافة', toAr(Math.round(ED.bk * 100)) + '٪');
    if (ED.vmode === 'erase') h += edBtn('erm:1', 'nature', 'أشجار', { on: !!(ED.erm & 1) }) + edBtn('erm:2', 'rock', 'صخور', { on: !!(ED.erm & 2) }) + edBtn('erm:4', 'grass', 'عشب', { on: !!(ED.erm & 4) });
    h += edStep('br', 'width', 'الحجم', edAr(ED.br) + 'م');
  }
  el.innerHTML = h; el.scrollLeft = 0;
  el.classList.toggle('empty', !h);
}
// what a button in the panel does
function edAct(act) {
  const o = ED.sel, d = o && EDK[o.k];
  const lim = (p, v) => { const L = d[p]; return clamp(Math.round(v / L[3]) * L[3], L[0], L[1]); };
  const big = (p, sgn) => edChange(o, (q) => { const L = d[p], st = L[3] * (q[p] > L[2] * 3 ? 4 : q[p] > L[2] * 1.5 ? 2 : 1); q[p] = r2(lim(p, q[p] + sgn * st)); }, true);
  if (act.startsWith('gm:')) { gmAct(act); return; }
  switch (act) {
    case 'desel': edSelect(null); return;
    case 'add': edTool('add'); return;
    case 'rotL': case 'rotR': edChange(o, (q) => { const s = act === 'rotL' ? 1 : -1; q.ry = d.quarter ? (edQuarter(q.ry) + s + 4) % 4 * Math.PI / 2 : (q.ry + s * Math.PI / 12 + TAU) % TAU; }, true); return;
    case 'w+': case 'w-': big('w', act[1] === '+' ? 1 : -1); return;
    case 'd+': case 'd-': big('d', act[1] === '+' ? 1 : -1); return;
    case 'h+': case 'h-': big('h', act[1] === '+' ? 1 : -1); return;
    case 'f+': case 'f-': edChange(o, (q) => { q.f = clamp(q.f + (act[1] === '+' ? 1 : -1), d.f[0], d.f[1]); }, true); return;
    case 'n+': case 'n-': edChange(o, (q) => { q.n = clamp(q.n + (act[1] === '+' ? 1 : -1), d.n[0], d.n[1]); }, true); return;
    case 's+': case 's-': edChange(o, (q) => { q.s = +clamp(q.s * (act[1] === '+' ? 1.08 : 1 / 1.08), d.sc[0], d.sc[1]).toPrecision(3); }, true); return;
    case 'dy+': case 'dy-': edChange(o, (q) => { q.dy = r2(clamp(q.dy + (act[2] === '+' ? 0.25 : -0.25), -8, 12)); }, true); return;
    case 'up': case 'down': edChange(o, (q) => { const st = d.type === 'land' ? 0.5 : 0.1; q.dy = r2(clamp(q.dy + (act === 'up' ? st : -st), -40, 200)); }, true); return;
    case 'ground': edChange(o, (q) => { q.dy = 0; }); return;
    case 'var': edChange(o, (q) => { q.c = (q.c + 1) % 997; }); return;
    case 'style': edChange(o, (q) => { if (d.type === 'villa') q.st = ((q.st || 0) + 1) % 4; else { const i = ED_STYLES.findIndex((s) => s[0] === (q.st || d.style)); q.st = ED_STYLES[(i + 1) % ED_STYLES.length][0]; } }); return;
    case 'col':
      if (d.type === 'umodel') { edChange(o, (q) => { q.col = (q.col + 1) % 3; }); edToast(['التصادم معطّل', 'تصادم صندوق', 'تصادم دقيق'][o.col], ['يمكن المرور من خلاله', 'صندوق حوله لا يُعبر', 'جدرانه تمنعك وأرضياته ودرجه تمشي عليها'][o.col]); return; }
      edChange(o, (q) => { q.col = q.col ? 0 : 1; }); edToast(o.col ? 'التصادم مفعّل' : 'التصادم معطّل', o.col ? 'لا يُعبر من خلاله' : 'يمكن المرور من خلاله'); return;
    case 'pad': edChange(o, (q) => { q.pad = q.pad ? 0 : 1; }); edToast(o.pad ? 'الأرض تحته مستوية' : 'الأرض تحته كما هي', ''); return;
    case 'upr': edChange(o, (q) => { q.up = ((q.up || 0) + 1) % 6; }); return;
    case 'open': edChange(o, (q) => { q.open = !q.open; }); return;
    case 'focus': { const f = edFoot(o), r = f.r !== undefined ? f.r : Math.max(f.hx || f.rx || 2, f.hz || f.rz || 2); edLookAt(o.x, o.z, clamp(r * 3.2, 8, 2400)); return; }
    case 'dup': edDuplicate(o); return;
    case 'del': edDelete(o); return;
    case 'br+': case 'br-': ED.br = clamp(Math.round(ED.br * (act[2] === '+' ? 1.15 : 1 / 1.15) * 2) / 2, 2, 160); edCtx(); return;
    case 'bk+': case 'bk-': ED.bk = clamp(Math.round((ED.bk + (act[2] === '+' ? 0.1 : -0.1)) * 10) / 10, 0.1, 1); edCtx(); return;
    case 'shapes': EDUI.cat = 'land'; edCatOpen(true); return;
    case 'vsp': { const L = ['mix', 'oak', 'pine', 'birch', 'spruce', 'plane', 'palm', 'olive', 'cypress', 'willow', 'acacia', 'ash', 'oak_m', 'dead', 'cactus', 'bush', 'bush2', 'bush3']; ED.vsp = L[(L.indexOf(ED.vsp) + 1) % L.length]; edCtx(); return; }
  }
  if (act.startsWith('vm:')) { ED.vmode = act.slice(3); edCtx(); return; }
  if (act.startsWith('br:')) { ED.brush = act.slice(3); edCtx(); return; }
  if (act.startsWith('erm:')) { const b = +act.slice(4); ED.erm ^= b; if (!ED.erm) ED.erm = b; edCtx(); return; }
  if (act.startsWith('put:')) { edPlace(act.slice(4)); return; }
}
// buttons answer the touch at once; the ones that change an amount repeat while held
function edWireButtons(root) {
  let held = null;
  const stop = () => { if (held) { clearTimeout(held.t); held.el.classList.remove('down'); held = null; } };
  root.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button[data-act]'); if (!b || b.disabled) return;
    e.preventDefault(); e.stopPropagation(); stop();
    const act = b.dataset.act; b.classList.add('down');
    edAct(act);
    if (b.dataset.hold) { let n = 0; const rep = () => { const nb = $('edCtx').querySelector(`button[data-act="${act}"]`); if (!nb) { stop(); return; } held.el = nb; nb.classList.add('down'); edAct(act); n++; held.t = setTimeout(rep, n > 6 ? 70 : 140); }; held = { el: b, t: setTimeout(rep, 380) }; }
    else setTimeout(() => b.classList.remove('down'), 160);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) root.addEventListener(ev, stop);
  root.addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b && e.detail === 0) edAct(b.dataset.act); });
}

/* ── the catalogue ── */
function edCatOpen(on) {
  $('edCat').classList.toggle('gone', !on);
  for (const b of document.querySelectorAll('#edRail .edt')) b.classList.toggle('on', on ? b.dataset.tool === 'add' : b.dataset.tool === ED.tool);
  if (on) { edCatTabs(); edCatGrid(); }
}
function edCatTabs() {
  $('edTabs').innerHTML = ED_CATS.map(([k, n]) => { const c = k === 'gmat' ? 12 + GMAT.recs.size : Object.values(EDK).filter((d) => d.cat === k).length; return `<button type="button" class="edtab${EDUI.cat === k && !EDUI.q ? ' on' : ''}" data-cat="${k}">${edSvg(k)}<span>${n}</span><i>${toAr(c)}</i></button>`; }).join('');
}
function edCatGrid() {
  const q = EDUI.q.trim(), list = Object.values(EDK).filter((d) => (q ? d.name.includes(q) : d.cat === EDUI.cat)), pre = !q && EDUI.cat === 'upl' ? upCards() : !q && EDUI.cat === 'gmat' ? gmCards() : '';
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  $('edGrid').innerHTML = pre + (list.length ? list.map((d) => `<button type="button" class="edcard" data-key="${d.key}">${d.thumb ? upCardImg(d) : ED_THUMBS.has(d.key) ? `<img src="assets/ui/ed/${d.key}.webp" alt="" loading="lazy" decoding="async">` : `<span class="edph">${edSvg(d.cat === 'upl' ? 'upl' : d.cat)}</span>`}<span class="ednm">${esc(d.name)}</span>${upDelBtn(d)}</button>`).join('') : pre ? '' : '<p class="edempty">لا شيء بهذا الاسم</p>');
  $('edGrid').scrollTop = 0;
}

/* ── touches and the mouse on the world ── */
const EP = { ptrs: new Map(), mode: '', o: null, ox: 0, oz: 0, before: null, moved: false, sx: 0, sy: 0, pin: null, hover: null };
function edLocal(p) { return toLocalPt(p.x, p.y); }
canvas.addEventListener('pointerdown', (e) => {
  if (!ED.on || paused) return;
  e.preventDefault();
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  EP.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!$('edCat').classList.contains('gone')) edCatOpen(false);
  if (EP.ptrs.size >= 2) {
    // a second finger: whatever one finger was doing ends, the camera takes over
    if (EP.mode === 'drag' && EP.moved) edDragEnd(); if (EP.mode === 'paint') edPaintEnd();
    EP.mode = 'two'; EP.pin = null; return;
  }
  EP.sx = e.clientX; EP.sy = e.clientY; EP.moved = false; EP.o = null;
  if (e.pointerType === 'mouse' && e.button === 2) { EP.mode = 'orbit'; return; }
  if (e.pointerType === 'mouse' && e.button === 1) { EP.mode = 'pan'; return; }
  if (ED.tool === 'ter' || ED.tool === 'erase' || ED.tool === 'paint') {
    const g = edHitBare(e.clientX, e.clientY); if (!g) { EP.mode = 'pan'; return; }
    if (ED.tool === 'paint' && !GMAT.drag) { EP.mode = 'ring'; EDB.x = g.x; EDB.z = g.z; EDB.have = true; edBrushRing(g.x, g.z); ED_LINE.brush.visible = true; return; }
    EP.mode = 'paint';
    if (ED.tool === 'ter') edBrushStart(g); else if (ED.tool === 'paint') gmBrushStart(g); else { edEraseStart(); edEraseAt(g.x, g.z); }
    edBrushRing(g.x, g.z);
    return;
  }
  const o = edPick(e.clientX, e.clientY);
  // small things move at once under your finger; big ones (a fortress, a mountain, a lake) once they are selected
  if (o && (o === ED.sel || !(EDK[o.k].big || EDK[o.k].type === 'villa' || EDK[o.k].pre === 'plot'))) {
    if (o !== ED.sel) edSelect(o);
    const g = edHit(e.clientX, e.clientY) || { x: o.x, z: o.z };
    EP.mode = 'drag'; EP.o = o; EP.ox = o.x - g.x; EP.oz = o.z - g.z; EP.before = edSnap(o);
    return;
  }
  EP.mode = 'tap'; EP.o = o;
});
canvas.addEventListener('pointermove', (e) => {
  if (!ED.on) return;
  const p = EP.ptrs.get(e.pointerId);
  if (!p) { if (e.pointerType === 'mouse' && (ED.tool === 'ter' || ED.tool === 'erase' || (ED.tool === 'paint' && (GMAT.drag || !EDB.have)))) { const g = edHitBare(e.clientX, e.clientY); if (g) edBrushRing(g.x, g.z); } return; }
  const px = p.x, py = p.y; p.x = e.clientX; p.y = e.clientY;
  if (Math.hypot(e.clientX - EP.sx, e.clientY - EP.sy) > 7) EP.moved = true;
  if (EP.mode === 'two' && EP.ptrs.size >= 2) { edTwo(); return; }
  if (EP.mode === 'pan' || (EP.mode === 'tap' && EP.moved)) { EP.mode = 'pan'; edPan(px, py, e.clientX, e.clientY); return; }
  if (EP.mode === 'orbit') { const [dx, dy] = toLocal(e.clientX - px, e.clientY - py); EDC.tyaw -= dx * 0.006; EDC.yaw = EDC.tyaw; EDC.tpitch = clamp(EDC.tpitch + dy * 0.004, 0.12, 1.52); EDC.pitch = EDC.tpitch; return; }
  if (EP.mode === 'drag' && EP.moved && EP.o) {
    const g = edHit(e.clientX, e.clientY); if (!g) return;
    edMoveLive(EP.o, g.x + EP.ox, g.z + EP.oz);
    return;
  }
  if (EP.mode === 'paint' || EP.mode === 'ring') {
    const g = edHitBare(e.clientX, e.clientY); if (!g) return;
    if (ED.tool === 'ter' || ED.tool === 'paint') { EDB.x = g.x; EDB.z = g.z; EDB.have = true; } else edEraseAt(g.x, g.z);
    edBrushRing(g.x, g.z);
  }
});
function edPointerEnd(e) {
  if (!EP.ptrs.has(e.pointerId)) return;
  EP.ptrs.delete(e.pointerId);
  if (EP.mode === 'two') { if (!EP.ptrs.size) EP.mode = ''; EP.pin = null; return; }
  if (EP.mode === 'tap' && !EP.moved) edSelect(EP.o);
  else if (EP.mode === 'drag') { if (EP.moved) edDragEnd(); }
  else if (EP.mode === 'paint') edPaintEnd();
  EP.mode = ''; EP.o = null;
}
canvas.addEventListener('pointerup', edPointerEnd);
canvas.addEventListener('pointercancel', edPointerEnd);
canvas.addEventListener('wheel', (e) => { if (!ED.on) return; e.preventDefault(); EDC.tdist = clamp(EDC.tdist * (1 + clamp(e.deltaY, -120, 120) * 0.0016), 4, 2600); }, { passive: false });
function edDragEnd() {
  const o = EP.o; if (!o) return;
  edRebuild(o); edTag(o);
  const b = edSnap(o); if (EP.before && (EP.before.x !== b.x || EP.before.z !== b.z)) edOp({ t: 'mod', a: EP.before, b });
  edFlush(true); edOutline(); EP.o = null;
}
function edPaintEnd() { if (ED.tool === 'ter') edBrushEnd(); else if (ED.tool === 'paint') gmBrushEnd(); else edEraseEnd(); }
// the ground under the finger stays under it
function edPan(px, py, x, y) {
  const a = edPlaneHit(px, py, EDC.y), b = edPlaneHit(x, y, EDC.y); if (!a || !b) return;
  let dx = a[0] - b[0], dz = a[1] - b[1]; const m = Math.hypot(dx, dz), lim = EDC.dist * 0.8 + 5; if (m > lim) { dx *= lim / m; dz *= lim / m; }
  EDC.x += dx; EDC.z += dz; EDC.fly = null; edCamApply(0);
}
// two fingers: pinch to zoom, twist to turn, move together to pan
function edTwo() {
  const [p, q] = [...EP.ptrs.values()], [ax, ay] = edLocal(p), [bx, by] = edLocal(q);
  const d = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax), mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
  const P = EP.pin;
  if (P) {
    if (d > 10 && P.d > 10) { EDC.tdist = clamp(EDC.tdist * P.d / d, 4, 2600); EDC.dist = EDC.tdist; }
    let da = ang - P.a; da = Math.atan2(Math.sin(da), Math.cos(da)); EDC.tyaw += da; EDC.yaw = EDC.tyaw;
    edCamApply(0); edPan(P.mx, P.my, mx, my);
  }
  EP.pin = { d, a: ang, mx, my };
}
function edBrushRing(x, z) {
  EP.hover = [x, z];
  const r = ED.br; edLineSet(ED_LINE.brush, edRing(x, z, r, r, 0, 72, 0.5));
  ED_LINE.brush.material.color.set(ED.tool === 'erase' ? ({ erase: 0xff8a7a, back: 0xc8c8ff, tree: 0x6ee08a, grass: 0xb8f06a, flower: 0xff9ad8 })[ED.vmode] : ED.tool === 'paint' ? ({ p: 0xffe08a, d: 0xffb07a, u: 0x9be8ff, f: 0xd6f0ff, e: 0xff8a7a })[GMAT.mode] : ED.brush === 'lower' ? 0xffb07a : 0x9be8ff);
}

/* ── keys: arrows / WASD fly, Q E turn, R F tilt, + − zoom, Delete, Ctrl+Z / Ctrl+Y, Ctrl+D, Ctrl+S, Escape ── */
const EDKEYS = new Set();
addEventListener('keydown', (e) => {
  if (!ED.on || paused || settingsOpen) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) { if (e.code === 'Escape') e.target.blur(); return; }
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.code === 'KeyZ') { e.preventDefault(); edUndo(e.shiftKey); return; }
  if (ctrl && e.code === 'KeyY') { e.preventDefault(); edUndo(true); return; }
  if (ctrl && e.code === 'KeyD') { e.preventDefault(); edDuplicate(ED.sel); return; }
  if (ctrl && e.code === 'KeyS') { e.preventDefault(); edSave(); return; }
  if (e.code === 'Delete' || e.code === 'Backspace') { if (ED.sel) { e.preventDefault(); edDelete(ED.sel); } return; }
  if (e.code === 'Escape') { if (!$('edCat').classList.contains('gone')) edCatOpen(false); else if (ED.sel) edSelect(null); else edTool('sel'); return; }
  if (e.code === 'BracketLeft' && ED.sel) { edAct('rotL'); return; }
  if (e.code === 'BracketRight' && ED.sel) { edAct('rotR'); return; }
  if (e.code === 'PageUp' && ED.sel) { edAct('up'); return; }
  if (e.code === 'PageDown' && ED.sel) { edAct('down'); return; }
  if (e.code === 'Digit1') edTool('sel'); if (e.code === 'Digit2') edTool('add'); if (e.code === 'Digit3') edTool('ter'); if (e.code === 'Digit4') edTool('water'); if (e.code === 'Digit5') edTool('erase'); if (e.code === 'Digit6') edTool('paint');
  EDKEYS.add(e.code);
});
addEventListener('keyup', (e) => EDKEYS.delete(e.code));
addEventListener('blur', () => EDKEYS.clear());
function edKeys(dt) {
  if (!EDKEYS.size) return;
  const k = (...c) => (c.some((q) => EDKEYS.has(q)) ? 1 : 0);
  const mx = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft'), mz = k('KeyS', 'ArrowDown') - k('KeyW', 'ArrowUp'), sp = EDC.dist * 0.9 + 6;
  if (mx || mz) { const c = Math.cos(EDC.yaw), s = Math.sin(EDC.yaw); EDC.x += (mx * c + mz * s) * sp * dt; EDC.z += (-mx * s + mz * c) * sp * dt; EDC.fly = null; }
  EDC.tyaw += (k('KeyQ') - k('KeyE')) * 1.6 * dt; EDC.tpitch += (k('KeyR') - k('KeyF')) * 0.9 * dt;
  const z = k('Equal', 'NumpadAdd') - k('Minus', 'NumpadSubtract'); if (z) EDC.tdist *= Math.exp(-z * 1.4 * dt);
}

/* ── in and out ── */
function edCan() { return started && player.alive && !DROP.state && !(NET && NET.inHost) && BOOT.ready; }
function edEnter() {
  if (!edCan()) { toast('لا يمكن فتح وضع التطوير الآن', DROP.state ? 'انتظر حتى تهبط' : NET && NET.inHost ? 'هذا عالم صديقك' : 'انهض أولاً'); return; }
  setPaused(false);
  if (player.vehicle) exitVehicle(true);
  if (craftOpen) closeCraft(); if (chartOpen) toggleChart(false); if (BUILD.ghost) cancelBuild();
  if (SCOPE.on) setScope(false);
  input.act = false; input.aim = false; if (document.exitPointerLock && locked) document.exitPointerLock();
  ED.back = { pos: player.pos.clone(), yaw: player.yaw, cy: cam.yaw, cp: cam.pitch };
  ED.on = true; ED.testing = false;
  app.classList.add('editing'); $('ed').classList.remove('gone'); $('edBack').classList.add('gone');
  EDC.x = player.pos.x; EDC.z = player.pos.z; EDC.y = player.pos.y; EDC.tyaw = EDC.yaw = cam.yaw; EDC.tpitch = EDC.pitch = 0.78; EDC.tdist = EDC.dist = 34; EDC.fly = null;
  edCamApply(0);
  for (const zb of ZOMBIES) if (zb.active) zb.root.visible = false;
  AUDIO.engine(false); flash.intensity = 0;
  edPlayState(false);
  ED.tool = 'sel'; edTool('sel'); edSelect(null); edStatus();
  edDraftOffer();
  if (LIB.pend.length) setTimeout(libTakeDownloads, 600);
  if (!ED.hinted) { ED.hinted = true; edToast('وضع التطوير', TOUCH ? 'اسحب لتتنقّل · إصبعان للتكبير والتدوير · ＋ لإضافة أي شيء' : 'اسحب لتتنقّل · العجلة للتكبير · الزر الأيمن للتدوير · ＋ لإضافة أي شيء'); }
}
// leave: «تجربة» puts you down where the camera looks; «خروج» back where you were
function edLeave(test) {
  if (!ED.on) return;
  if (EP.mode === 'paint') edPaintEnd(); if (EP.mode === 'drag' && EP.moved) edDragEnd(); EP.mode = ''; EP.ptrs.clear();
  ED.on = false; edSelect(null); edCatOpen(false); libClose();
  ED_LINE.sel.visible = ED_LINE.brush.visible = ED_LINE.arrow.visible = false;
  app.classList.remove('editing'); $('ed').classList.add('gone');
  edFlush(true); edPlayState(true);
  if (test) {
    const x = EDC.x, z = EDC.z, g = groundAt(x, z, edSurface(x, z) + 2);
    player.pos.set(x, Math.max(g, waterAt(x, z) - 0.5), z); player.vel.set(0, 0, 0); player.yaw = EDC.yaw + Math.PI;
    cam.yaw = cam.tyaw = EDC.yaw; cam.pitch = cam.tpitch = 0.2; ED.testing = true; $('edBack').classList.remove('gone');
  } else {
    const B = ED.back; if (B) { player.pos.copy(B.pos); player.yaw = B.yaw; cam.yaw = cam.tyaw = B.cy; cam.pitch = cam.tpitch = B.cp; }
    player.pos.y = groundAt(player.pos.x, player.pos.z, player.pos.y + 1);
  }
  player.root.position.copy(player.pos); player.root.rotation.set(0, player.yaw, 0);
  cam.focus.set(player.pos.x, player.pos.y + 1.6, player.pos.z); updateCamera(0.016, true);
  camera.fov = cam.fov; camera.near = 0.08; camera.updateProjectionMatrix(); introT = 1;
  hud.classList.add('on'); hudDirty = true;
  if (test) toast('تجربة', ED.ver !== ED.savedVer ? 'تعديلاتك لم تُحفظ بعد · زر «وضع التطوير» للعودة' : 'زر «وضع التطوير» في الأعلى للعودة');
}
// the editor shows things as placed (cars where you left them, animals at their spots, stands full); the game lets them live
function edPlayState(play) {
  for (const o of ED.objs) {
    const d = EDK[o.k], v = o.v; if (!v) continue;
    if (d.edOnly && v.root) v.root.visible = !play;
    if (play) continue;
    if (d.type === 'veh' && (!v.veh || !VEHICLES.includes(v.veh) || Math.hypot(v.veh.pos.x - o.x, v.veh.pos.z - o.z) > 0.3 || Math.abs(angDiff(v.veh.yaw, o.ry)) > 0.02)) { edRebuild(o); edTag(o); }
    if (d.type === 'animal' || d.type === 'crate') { edRebuild(o); edTag(o); }
    if (d.type === 'pickup') { v.taken = 0; v.root.visible = true; if (v.prop) v.prop.visible = true; }
  }
  if (!play) ED.animDirty = true;
}
function edDrawAnimals() {
  ED.animDirty = false;
  for (const k in PROC) PROC[k].n = 0;
  for (const an of ANIMALS) if (an.active) drawAnimal(an, 0, 0, an.state === 'dead' ? 1 : 0);
  for (const k in PROC) { const P2 = PROC[k]; P2.mesh.count = P2.n; P2.mesh.instanceMatrix.needsUpdate = true; P2.mesh.geometry.attributes.iAnim.needsUpdate = true; }
}
/* each frame while editing (from simulate, instead of the player) */
function edFrame(dt) {
  edKeys(dt); edCamApply(dt);
  if (EDB.on) { if (ED.tool === 'paint') gmBrushStep(dt); else edBrushStep(dt); }
  if (ED.pend && ED.pend.sx0 < 1e9 && !EDB.on && EP.mode !== 'drag') edFlush(false);
  if (ED.animDirty) edDrawAnimals();
  if (ED.sel && EP.mode === 'drag' && EP.o === ED.sel) { /* the outline follows in edMoveLive */ }
  if ((ED.tool === 'ter' || ED.tool === 'erase' || ED.tool === 'paint') && EP.hover && (TOUCH || (ED.tool === 'paint' && !GMAT.drag)) && EP.mode !== 'paint') ED_LINE.brush.visible = true;
  placeSun(ED.focus.x, ED.focus.y, ED.focus.z); flash.intensity = 0; updateLightPool(dt);
}

/* ── wiring ── */
(() => {
  $('edExit').innerHTML = edSvg('exit') + '<span>خروج</span>'; $('edUndo').innerHTML = edSvg('undo'); $('edRedo').innerHTML = edSvg('redo');
  $('edSave').innerHTML = edSvg('save') + '<span>حفظ</span>'; $('edTest').innerHTML = edSvg('play') + '<span>تجربة</span>'; $('edCatX').innerHTML = edSvg('close');
  $('edRail').innerHTML = [['sel', 'تحديد', 'sel'], ['add', 'إضافة', 'add'], ['ter', 'تضاريس', 'ter'], ['paint', 'أرضية', 'paint'], ['water', 'ماء', 'water'], ['erase', 'نباتات', 'veg']].map(([t, n, ic]) => `<button type="button" class="edt${t === 'add' ? ' plus' : ''}" data-tool="${t}" aria-label="${n}">${edSvg(ic)}<span>${n}</span></button>`).join('');
  $('edCam').innerHTML = [['rotL', 'rotL', 'دوران'], ['tup', 'tup', 'إمالة'], ['rotR', 'rotR', 'دوران'], ['zin', 'zin', 'تكبير'], ['home', 'home', 'إليّ'], ['zout', 'zout', 'تصغير']].map(([a, ic, lb]) => `<button type="button" class="edk" data-cam="${a}" aria-label="${lb}">${edSvg(ic)}</button>`).join('');
  $('edBack').innerHTML = edSvg('ter') + '<span>وضع التطوير</span>';
  const tapEl = (el, fn) => el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; e.preventDefault(); e.stopPropagation(); fn(e); });
  tapEl($('edExit'), () => edLeave(false)); tapEl($('edTest'), () => edLeave(true));
  tapEl($('edUndo'), () => edUndo(false)); tapEl($('edRedo'), () => edUndo(true));
  tapEl($('edSave'), () => edSave());
  tapEl($('edCatX'), () => edCatOpen(false));
  tapEl($('edBack'), () => edEnter());
  $('edRail').addEventListener('pointerdown', (e) => { const b = e.target.closest('.edt'); if (!b) return; e.preventDefault(); e.stopPropagation(); const t = b.dataset.tool; if (t === 'add' && !$('edCat').classList.contains('gone')) edCatOpen(false); else edTool(t); });
  let camHeld = null;
  // the tilt button steps through a low view, the usual one and straight down
  const camAct = (a) => { if (a === 'rotL') EDC.tyaw += 0.12; if (a === 'rotR') EDC.tyaw -= 0.12; if (a === 'tup') EDC.tpitch = EDC.tpitch < 0.55 ? 0.8 : EDC.tpitch < 1.2 ? 1.5 : 0.32; if (a === 'zin') EDC.tdist *= 0.86; if (a === 'zout') EDC.tdist /= 0.86; if (a === 'home') edLookAt(player.pos.x, player.pos.z, 34); };
  $('edCam').addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-cam]'); if (!b) return; e.preventDefault(); e.stopPropagation(); const a = b.dataset.cam; camAct(a); clearInterval(camHeld); if (a !== 'home' && a !== 'tup') camHeld = setInterval(() => camAct(a), 90); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('edCam').addEventListener(ev, () => clearInterval(camHeld));
  edWireButtons($('edCtx'));
  $('edCtx').addEventListener('input', (e) => {
    const r = e.target.closest && e.target.closest('input[data-rng]'); if (!r) return;
    const k = r.dataset.rng, v = +r.value; if (k === 'br') ED.br = v; else if (k === 'bk') ED.bk = v;
    const b = $('edCtx').querySelector('[data-rv="' + k + '"]'); if (b) b.textContent = k === 'br' ? edAr(v) + 'م' : toAr(Math.round(v * 100)) + '٪';
    if (EP.hover) edBrushRing(EP.hover[0], EP.hover[1]);
  });
  $('edTabs').addEventListener('pointerdown', (e) => { const b = e.target.closest('.edtab'); if (!b) return; e.preventDefault(); EDUI.cat = b.dataset.cat; EDUI.q = ''; $('edSearch').value = ''; edCatTabs(); edCatGrid(); });
  $('edGrid').addEventListener('click', (e) => {
    if (e.target.closest('[data-up]')) { upPick(); return; }
    if (e.target.closest('[data-gmup]')) { gmPick(); return; }
    const net = e.target.closest('[data-net]'); if (net) { edCatOpen(false); libOpen(net.dataset.net); return; }
    const gd = e.target.closest('[data-gmdel]'); if (gd) { e.stopPropagation(); gmDelete(gd.dataset.gmdel); return; }
    const gb = e.target.closest('[data-gmb]'); if (gb) { gmBaseTap(+gb.dataset.gmb); return; }
    const gm = e.target.closest('[data-gm]'); if (gm) { gmCardTap(gm.dataset.gm); return; }
    const del = e.target.closest('[data-del]'); if (del) { e.stopPropagation(); upDelete(del.dataset.del); return; }
    const b = e.target.closest('.edcard'); if (!b || !b.dataset.key) return; edCatOpen(false); edPlace(b.dataset.key);
  });
  $('edSearch').addEventListener('input', () => { EDUI.q = $('edSearch').value; edCatTabs(); edCatGrid(); });
  $('edCat').addEventListener('pointerdown', (e) => { if (e.target === $('edCat')) edCatOpen(false); });
  for (const id of ['ed', 'edBack']) for (const ev of ['wheel', 'touchmove']) $(id).addEventListener(ev, (e) => { if (e.target.closest && e.target.closest('#edGrid, #edCtx, #edTabs')) return; if (ev === 'wheel') e.preventDefault(); }, { passive: false });
  // the pause menu's door into the editor; leaving for the lobby leaves the editor first
  tapEl($('pDevBtn'), () => edEnter());
  $('pLobbyBtn').addEventListener('pointerdown', () => { if (ED.on) edLeave(false); }, true);
})();
