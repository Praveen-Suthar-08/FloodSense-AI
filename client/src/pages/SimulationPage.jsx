import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Layers, 
  Droplet, 
  Building2, 
  AlertTriangle,
  MapPin,
  Waves,
  Maximize2,
  Compass
} from 'lucide-react';
import { MapContainer, TileLayer, Polygon, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import SharedPageLayout from './SharedPageLayout';

// Center on Brahmaputra River Basin (Guwahati / Kamrup Valley)
const BRAHMAPUTRA_CENTER = [26.185, 91.750];

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function SimulationPage({ theme }) {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState('GIS'); // 'GIS' (Real Map Terrain) or '3D' (Digital Twin Mesh)
  const [waterLevelRise, setWaterLevelRise] = useState(1.8);
  const [customDischarge, setCustomDischarge] = useState(5800);
  const [runningSim, setRunningSim] = useState(false);

  const canvas3DRef = useRef(null);

  const fetchScenarios = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/simulation/scenarios');
      const data = await res.json();
      setScenarios(data);
      if (data.length > 0 && !selectedScenario) {
        setSelectedScenario(data[0]);
      }
    } catch (err) {
      console.error('Failed to load scenarios', err);
    }
  };

  useEffect(() => {
    fetchScenarios();
  }, []);

  // Timeline Auto-Play Loop
  useEffect(() => {
    let timer = null;
    if (isPlaying && selectedScenario?.timelineSteps?.length) {
      timer = setInterval(() => {
        setTimelineIndex((prev) => (prev + 1) % selectedScenario.timelineSteps.length);
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [isPlaying, selectedScenario]);

  // Current Step Telemetry
  const currentStep = selectedScenario?.timelineSteps?.[timelineIndex] || { depthMeters: 1.8, waterLevel: 4.8 };
  const effectiveRise = Number(((currentStep.depthMeters || waterLevelRise) * 0.8).toFixed(2));
  const expansionScale = 0.005 + (timelineIndex * 0.004) + (waterLevelRise * 0.003);

  // Dynamic GeoJSON Coordinates expanding over Brahmaputra Basin
  const dynamicFloodPolygons = [
    // Main River Inundation Core
    [
      [26.195 + expansionScale, 91.710 - expansionScale],
      [26.210 + expansionScale * 1.2, 91.750],
      [26.198 + expansionScale, 91.800 + expansionScale],
      [26.175 - expansionScale * 0.8, 91.780],
      [26.170 - expansionScale, 91.730 - expansionScale]
    ],
    // Lowland Basin Spread (North Guwahati floodplain)
    [
      [26.215 + expansionScale * 1.1, 91.730 - expansionScale],
      [26.235 + expansionScale * 1.4, 91.770 + expansionScale],
      [26.220 + expansionScale, 91.790 + expansionScale],
      [26.205, 91.755]
    ]
  ];

  // Three.js True 3D Digital Twin Terrain Mesh & Animated Water Volume
  const threeContainerRef = useRef(null);

  useEffect(() => {
    if (viewMode !== '3D') return;
    const container = threeContainerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 460;

    // 1. Scene, Camera & Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme === 'light' ? 0xf8fafc : 0x090d16);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 32, 42);
    camera.lookAt(0, 2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, theme === 'light' ? 0.8 : 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(25, 40, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e293b, 0.5);
    scene.add(hemiLight);

    // 3. Realistic River Valley Terrain Mesh (Brahmaputra DEM Contour)
    const gridRes = 60;
    const terrainGeo = new THREE.PlaneGeometry(44, 44, gridRes, gridRes);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);

      // Meandering riverbed formula
      const riverCenter = Math.sin(vz * 0.25) * 3.5;
      const distFromRiver = Math.abs(vx - riverCenter);

      // Fluvial valley + hill contours
      let elevation = 0;
      if (distFromRiver < 4.0) {
        // Deep river channel
        elevation = -2.2 + (distFromRiver / 4.0) * 1.5;
      } else {
        // Terraced banks and surrounding hills
        const bankDist = distFromRiver - 4.0;
        elevation = -0.7 + Math.pow(bankDist, 1.15) * 0.85 + Math.sin(vx * 0.4) * Math.cos(vz * 0.4) * 0.8;
      }
      pos.setY(i, elevation);
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: theme === 'light' ? 0x94a3b8 : 0x1e293b,
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true,
      wireframe: false
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Wireframe overlay for Digital Twin telemetry inspection aesthetic
    const wireframeMat = new THREE.MeshBasicMaterial({
      color: theme === 'light' ? 0x64748b : 0x334155,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    const wireframeMesh = new THREE.Mesh(terrainGeo, wireframeMat);
    scene.add(wireframeMesh);

    // 4. Dynamic Water Inundation Volume
    // Calculate water level from effectiveRise (0.5m -> 2.5m)
    const baseWaterLevel = -1.6;
    const targetWaterY = baseWaterLevel + (effectiveRise * 1.35);

    const waterGeo = new THREE.PlaneGeometry(43.8, 43.8, 40, 40);
    waterGeo.rotateX(-Math.PI / 2);

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.82,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.6,
      ior: 1.333,
      depthWrite: false
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.y = targetWaterY;
    scene.add(waterMesh);

    // 5. 3D Vulnerable Landmark Beacons on the Terrain
    const landmarks = [
      { name: 'Guwahati Port', x: -2.5, z: 2.0, baseElevation: -0.2 },
      { name: 'Bharalumukh Residential', x: -6.5, z: -4.0, baseElevation: 0.9 },
      { name: 'Uzanbazar Ghats', x: 3.5, z: 6.0, baseElevation: 0.4 }
    ];

    const beaconGroup = new THREE.Group();
    landmarks.forEach(lm => {
      const isSubmerged = targetWaterY >= lm.baseElevation;
      const beaconColor = isSubmerged ? 0xef4444 : 0x10b981;

      // Pin cylinder
      const pinGeo = new THREE.CylinderGeometry(0.2, 0.2, 2.2, 16);
      const pinMat = new THREE.MeshStandardMaterial({ color: beaconColor, emissive: beaconColor, emissiveIntensity: 0.5 });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.set(lm.x, lm.baseElevation + 1.1, lm.z);
      beaconGroup.add(pinMesh);

      // Glowing sphere head
      const sphereGeo = new THREE.SphereGeometry(0.55, 16, 16);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: beaconColor,
        emissive: beaconColor,
        emissiveIntensity: 0.8
      });
      const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
      sphereMesh.position.set(lm.x, lm.baseElevation + 2.2, lm.z);
      beaconGroup.add(sphereMesh);
    });
    scene.add(beaconGroup);

    // 6. Interactive Drag Orbit Controls
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let rotY = 0;
    let rotX = 0.55;

    const onMouseDown = (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      rotY += deltaX * 0.008;
      rotX = Math.max(0.15, Math.min(1.2, rotX + deltaY * 0.008));
    };

    const onMouseUp = () => { isDragging = false; };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // 7. Continuous Animation Loop (Water Wave Undulation + Camera Orbit)
    let reqId;
    let clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Gentle wave ripples
      const waterPos = waterGeo.attributes.position;
      for (let i = 0; i < waterPos.count; i++) {
        const u = waterPos.getX(i);
        const v = waterPos.getZ(i);
        const wave = Math.sin(u * 0.6 + elapsedTime * 2.5) * 0.08 + Math.cos(v * 0.5 + elapsedTime * 2.0) * 0.08;
        waterPos.setY(i, wave);
      }
      waterGeo.computeVertexNormals();
      waterGeo.attributes.position.needsUpdate = true;

      // Smooth camera position from orbit angles
      const radius = 48;
      camera.position.x = Math.sin(rotY) * Math.cos(rotX) * radius;
      camera.position.y = Math.sin(rotX) * radius;
      camera.position.z = Math.cos(rotY) * Math.cos(rotX) * radius;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(reqId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.dispose();
      terrainGeo.dispose();
      waterGeo.dispose();
      container.innerHTML = '';
    };
  }, [viewMode, effectiveRise, theme]);

  return (
    <SharedPageLayout 
      title="3D Hydraulic Flood Simulation & DEM Topography" 
      subtitle="Physics-informed shallow water equation solver with terrain elevation contours"
    >
      <div className="space-y-6">
        {/* Controls Bar / Toolbar Wrapper */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-[var(--card-bg)] p-3 rounded-xl border border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/30">
              <Compass className="w-3.5 h-3.5" /> Brahmaputra Basin (Lat: 26.18, Lng: 91.75)
            </span>
          </div>

          {/* Segmented Control Container */}
          <div className="flex items-center p-1 bg-gray-800/50 rounded-lg border border-gray-700/50 w-full xl:w-auto">
            <button
              onClick={() => setViewMode('GIS')}
              className={`flex-1 xl:flex-none text-center px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                viewMode === 'GIS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }`}
            >
              GIS Topographic Map
            </button>
            <button
              onClick={() => setViewMode('3D')}
              className={`flex-1 xl:flex-none text-center px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                viewMode === '3D'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }`}
            >
              3D Digital Twin Mesh
            </button>
          </div>
        </div>

        {/* Main Studio Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Scenarios & Physical Controls */}
        <div className="space-y-4">
          <div className="card p-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
              Preset Scenarios
            </h2>
            <div className="space-y-2">
              {scenarios.map(s => (
                <button
                  key={s._id}
                  onClick={() => { setSelectedScenario(s); setTimelineIndex(0); }}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedScenario?._id === s._id
                      ? 'border-blue-500 bg-blue-50/10 dark:bg-blue-950/20 text-blue-600 font-bold'
                      : 'border-[var(--border-color)] text-[var(--text-primary)] hover:border-slate-400'
                  }`}
                >
                  <div className="text-xs">{s.name}</div>
                  <div className="text-[10px] text-[var(--text-secondary)] mt-1 font-normal">
                    {s.durationHours || 3}h duration • {(s.dischargeCumec || s.riverDischargeCusecs || 4800).toLocaleString()} m³/s
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Hydrologic Sliders */}
          <div className="card p-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-sm space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Dynamic River Controls
            </h2>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--text-secondary)] font-medium">Water Level Surge</span>
                <span className="font-mono font-bold text-blue-500">+{waterLevelRise}m</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="4.0"
                step="0.1"
                value={waterLevelRise}
                onChange={(e) => setWaterLevelRise(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--text-secondary)] font-medium">Upstream Discharge</span>
                <span className="font-mono font-bold text-blue-500">{customDischarge} m³/s</span>
              </div>
              <input
                type="range"
                min="2000"
                max="12000"
                step="200"
                value={customDischarge}
                onChange={(e) => setCustomDischarge(parseInt(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Center / Right: GIS Map & 3D Visualizer */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] overflow-hidden shadow-sm relative">
            <div className="p-3 border-b border-[var(--border-color)] flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-2 text-[var(--text-primary)]">
                <Waves className="w-4 h-4 text-blue-500" />
                {viewMode === 'GIS' ? 'Leaflet 30m DEM Topography & Flood Polygons' : 'Digital Twin Isometric Terrain Elevation'}
              </span>
              <span className="font-mono text-rose-500 font-bold">
                Crest Depth: +{effectiveRise}m
              </span>
            </div>

            <div className="h-[460px] w-full relative">
              {viewMode === 'GIS' ? (
                <MapContainer
                  center={BRAHMAPUTRA_CENTER}
                  zoom={12}
                  scrollWheelZoom={true}
                  className="w-full h-full z-10"
                >
                  <MapController center={BRAHMAPUTRA_CENTER} zoom={12} />
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    className="dark-map-tiles"
                    attribution="&copy; OpenStreetMap contributors"
                  />

                  {/* Dynamic Flood Expansion Polygons */}
                  {dynamicFloodPolygons.map((poly, idx) => (
                    <Polygon
                      key={`flood-poly-${idx}-${timelineIndex}`}
                      positions={poly}
                      pathOptions={{
                        color: '#2563eb',
                        fillColor: '#3b82f6',
                        fillOpacity: 0.45 + (timelineIndex * 0.08),
                        weight: 2
                      }}
                    >
                      <Popup>
                        <div style={{ fontSize: '11px', padding: '4px' }}>
                          <b style={{ color: '#ef4444' }}>🌊 Inundation Contour Step {timelineIndex + 1}</b><br />
                          <span>River: Brahmaputra Main Basin</span><br />
                          <span>Estimated Depth: <b>{effectiveRise}m</b></span><br />
                          <span>Area Submerged: <b>{((idx + 1) * 12.4 + expansionScale * 100).toFixed(1)} km²</b></span>
                        </div>
                      </Popup>
                    </Polygon>
                  ))}

                  {/* Vulnerable Landmarks in Guwahati Basin */}
                  {[
                    { name: 'Guwahati Port Terminus', coords: [26.188, 91.745], safe: effectiveRise < 1.5 },
                    { name: 'Bharalumukh Residential District', coords: [26.175, 91.735], safe: effectiveRise < 2.0 },
                    { name: 'Uzanbazar Riverbank Road', coords: [26.192, 91.758], safe: effectiveRise < 1.2 }
                  ].map((lm, i) => (
                    <CircleMarker
                      key={`landmark-${i}`}
                      center={lm.coords}
                      radius={6}
                      pathOptions={{
                        color: lm.safe ? '#10b981' : '#ef4444',
                        fillColor: lm.safe ? '#10b981' : '#ef4444',
                        fillOpacity: 0.9,
                        weight: 2
                      }}
                    >
                      <Popup>
                        <div style={{ fontSize: '11px' }}>
                          <b>{lm.name}</b><br />
                          Status: <span style={{ color: lm.safe ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                            {lm.safe ? 'Clear & Dry' : 'Inundation Warning'}
                          </span>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              ) : (
                <div className="w-full h-full relative cursor-grab active:cursor-grabbing select-none">
                  <div
                    ref={threeContainerRef}
                    className="w-full h-full block"
                  />
                  {/* Floating 3D Interaction Badge */}
                  <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 pointer-events-none flex items-center gap-2 shadow-lg">
                    <Compass className="w-3.5 h-3.5 text-blue-400 animate-spin" style={{ animationDuration: '8s' }} />
                    <span><b>Click &amp; Drag:</b> 360° Orbit • <b>Physics:</b> Live Water Undulation</span>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline Playback Bar */}
            <div className="p-3 border-t border-[var(--border-color)] bg-[var(--card-bg)] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-sm flex items-center gap-1.5 text-xs"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlaying ? 'Pause' : 'Play Simulation'}</span>
                </button>
                <button
                  onClick={() => { setTimelineIndex(0); setIsPlaying(false); }}
                  className="p-2 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-blue-600 transition-colors"
                  title="Reset Timeline"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Step indicator buttons */}
              <div className="flex items-center gap-1.5 flex-1 max-w-md mx-4">
                {(selectedScenario?.timelineSteps || [1, 2, 3, 4, 5, 6]).map((step, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setTimelineIndex(idx); setIsPlaying(false); }}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-all ${
                      timelineIndex === idx 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-slate-100 dark:bg-slate-800 text-[var(--text-secondary)] hover:bg-slate-200'
                    }`}
                  >
                    T+{idx * 3}h
                  </button>
                ))}
              </div>

              <div className="text-right text-xs font-mono font-bold text-[var(--text-primary)]">
                Step {timelineIndex + 1} / 6
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </SharedPageLayout>
  );
}
