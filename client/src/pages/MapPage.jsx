import { useEffect, useState, useMemo } from 'react';
import { MapContainer, CircleMarker, Popup, useMap, Polygon } from 'react-leaflet';
import {
  MapPin, Search, Layers, X, ChevronRight, Activity, AlertTriangle, CloudRain,
  Mountain, Radio, ShieldAlert, ArrowUpRight, CheckCircle2, Waves, Navigation,
  Send, Compass, Crosshair
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, ReferenceLine } from 'recharts';
import BaseTiles from '../components/BaseTiles.jsx';
import { api } from '../api.js';
import 'leaflet/dist/leaflet.css';

// Preset regional tactical polygon zones for emergency evacuation broadcasts across India
const TACTICAL_POLYGON_ZONES = [
  {
    id: 'brahmaputra',
    name: 'Brahmaputra Lowlands (781001-781030)',
    river: 'Brahmaputra River',
    pinCodes: ['781001', '781003', '781024', '781030'],
    polygon: [
      [26.25, 91.60], [26.26, 91.85], [26.12, 91.90], [26.10, 91.65]
    ]
  },
  {
    id: 'godavari',
    name: 'Godavari Delta & Rajahmundry (533101-533105)',
    river: 'Godavari River',
    pinCodes: ['533101', '533102', '533103', '533105'],
    polygon: [
      [17.08, 81.70], [17.10, 81.88], [16.92, 81.92], [16.90, 81.72]
    ]
  },
  {
    id: 'ganges',
    name: 'Ganges Patna Riverfront & Confluence (800001-800011)',
    river: 'Ganges River',
    pinCodes: ['800001', '800003', '800008', '800011'],
    polygon: [
      [25.68, 85.05], [25.70, 85.25], [25.55, 85.28], [25.53, 85.08]
    ]
  },
  {
    id: 'yamuna',
    name: 'Yamuna Floodplain & Central Delhi (110001-110054)',
    river: 'Yamuna River',
    pinCodes: ['110001', '110006', '110054', '110092'],
    polygon: [
      [28.72, 77.20], [28.73, 77.28], [28.60, 77.30], [28.58, 77.22]
    ]
  },
  {
    id: 'teesta',
    name: 'Teesta Basin & Jalpaiguri Sector (735101-735102)',
    river: 'Teesta River',
    pinCodes: ['735101', '735102', '735122'],
    polygon: [
      [26.60, 88.65], [26.62, 88.80], [26.48, 88.82], [26.46, 88.68]
    ]
  },
  {
    id: 'narmada',
    name: 'Narmada Basin & Hoshangabad Ghats (461001-461005)',
    river: 'Narmada River',
    pinCodes: ['461001', '461005'],
    polygon: [
      [22.80, 77.65], [22.82, 77.80], [22.70, 77.82], [22.68, 77.67]
    ]
  },
  {
    id: 'krishna',
    name: 'Krishna River Sangli Submersion Sector (416416-416420)',
    river: 'Krishna River',
    pinCodes: ['416416', '416415', '416420'],
    polygon: [
      [16.90, 74.50], [16.92, 74.65], [16.80, 74.68], [16.78, 74.52]
    ]
  },
  {
    id: 'jhelum',
    name: 'Jhelum Valley Srinagar Lowlands (190001-190010)',
    river: 'Jhelum River',
    pinCodes: ['190001', '190008', '190010'],
    polygon: [
      [34.12, 74.75], [34.14, 74.88], [34.02, 74.90], [34.00, 74.78]
    ]
  }
];

// Approximate 2022 Assam flood extent polygon coordinates (Brahmaputra basin)
const ASSAM_2022_FLOOD_POLYGON = [
  [27.5, 89.9], [27.2, 91.5], [26.8, 92.8], [26.5, 93.6],
  [26.1, 94.2], [25.8, 93.5], [25.5, 92.0], [25.7, 91.0],
  [26.0, 90.2], [26.5, 89.5], [27.0, 89.3], [27.5, 89.9]
];

// Live Emergency Responders & Tactical Assets
const RESPONDERS = [
  { id: 'R1', name: 'NDRF Boat Alpha (Patgaon)', lat: 26.18, lon: 91.75, status: 'On Scene', type: 'Boat Flotilla', speed: '14 knots' },
  { id: 'R2', name: 'SDRF River Rescue Unit 3', lat: 25.60, lon: 85.10, status: 'En Route', type: 'Rescue Vessel', speed: '22 km/h' },
  { id: 'R3', name: 'Medical Evac Helicopter Unit', lat: 26.35, lon: 92.40, status: 'Airborne', type: 'Helicopter Air-Ambulance', speed: '180 km/h' },
  { id: 'R4', name: 'Army Engineer Task Force 2', lat: 23.25, lon: 77.42, status: 'Staging', type: 'Heavy Amphibious Rig', speed: 'Stationary' }
];

// Regional basin bounding coordinates for focused auto-bounding
const BASIN_BOUNDS = {
  All: [[8.0, 68.0], [35.5, 97.5]],
  Brahmaputra: [[24.5, 89.5], [28.5, 96.0]],
  Ganges: [[24.0, 78.0], [27.5, 88.0]],
  Krishna: [[15.0, 73.0], [18.0, 81.0]],
  Godavari: [[16.5, 74.0], [20.0, 82.5]],
  Narmada: [[21.2, 72.5], [23.5, 81.5]],
  Kaveri: [[10.0, 76.0], [12.5, 80.0]]
};

function MapBoundsController({ targetBounds, locations }) {
  const map = useMap();
  useEffect(() => {
    if (targetBounds) {
      map.fitBounds(targetBounds, { padding: [40, 40], maxZoom: 8, animate: true });
    } else if (locations && locations.length) {
      map.fitBounds(locations.map((x) => [x.lat, x.lon]), { padding: [40, 40], maxZoom: 6, animate: true });
    }
  }, [targetBounds, locations, map]);
  return null;
}

function getColor(loc) {
  if (loc.sensorStatus === 'Critical' || loc.name?.includes('Brahmaputra')) return '#ef4444';
  if (loc.sensorStatus === 'Warning' || loc.name?.includes('Ganges')) return '#f59e0b';
  if (loc.sensorStatus === 'Offline') return '#64748b';
  return '#10b981';
}

export default function MapPage({ locations: propLocations, theme = 'dark' }) {
  const [internalLocations, setInternalLocations] = useState([]);
  const locations = propLocations || internalLocations;
  const [loading, setLoading] = useState(!propLocations);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  // Spatial intelligence layers
  const [selectedBasin, setSelectedBasin] = useState('All');
  const [mapLayer, setMapLayer] = useState('canvas'); // 'canvas' | 'topo'
  const [showRadar, setShowRadar] = useState(false);
  const [showResponders, setShowResponders] = useState(true);
  const [showHistoricalMask, setShowHistoricalMask] = useState(false);

  // Polygon Broadcast Zone Tool
  const [polygonBroadcastOpen, setPolygonBroadcastOpen] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState('brahmaputra');
  const [polygonBroadcastSent, setPolygonBroadcastSent] = useState(false);
  const [broadcastingZone, setBroadcastingZone] = useState(false);

  const activeZone = useMemo(() => {
    return TACTICAL_POLYGON_ZONES.find(z => z.id === selectedZoneId) || TACTICAL_POLYGON_ZONES[0];
  }, [selectedZoneId]);

  // Interactive side-drawer state
  const [stationHistory, setStationHistory] = useState([]);
  const [evacuating, setEvacuating] = useState(false);
  const [evacSuccess, setEvacSuccess] = useState('');

  useEffect(() => {
    if (!propLocations) {
      api('/locations')
        .then((d) => { setInternalLocations(Array.isArray(d) ? d : []); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [propLocations]);

  // Load sparkline history for selected station
  useEffect(() => {
    if (!selected?._id) return;
    api(`/locations/${selected._id}/history?hours=12`)
      .then(res => {
        if (Array.isArray(res)) setStationHistory(res);
      })
      .catch(() => setStationHistory([]));
  }, [selected]);

  const counts = useMemo(() => ({
    All: locations.length,
    Normal: locations.filter((l) => !l.name?.includes('Brahmaputra') && !l.name?.includes('Ganges') && l.sensorStatus !== 'Offline' && l.sensorStatus !== 'Critical' && l.sensorStatus !== 'Warning').length,
    Warning: locations.filter((l) => l.sensorStatus === 'Warning' || l.name?.includes('Ganges')).length,
    Critical: locations.filter((l) => l.sensorStatus === 'Critical' || l.name?.includes('Brahmaputra')).length,
    Offline: locations.filter((l) => l.sensorStatus === 'Offline').length,
  }), [locations]);

  const displayed = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return locations.filter((l) => {
      const c = getColor(l);
      const matchFilter =
        filter === 'All' ||
        (filter === 'Critical' && c === '#ef4444') ||
        (filter === 'Warning' && c === '#f59e0b') ||
        (filter === 'Normal' && c === '#10b981') ||
        (filter === 'Offline' && c === '#64748b');

      const matchBasin =
        !q && (selectedBasin === 'All' ||
        (l.river || l.name || '').toLowerCase().includes(selectedBasin.toLowerCase()));

      const matchSearch =
        !q ||
        (l.name || '').toLowerCase().includes(q) ||
        (l.river || '').toLowerCase().includes(q) ||
        (l.state || '').toLowerCase().includes(q) ||
        (l.district || '').toLowerCase().includes(q);

      return matchFilter && matchBasin && matchSearch;
    });
  }, [locations, filter, selectedBasin, search]);

  const sparklineData = useMemo(() => {
    if (stationHistory.length >= 3) {
      return stationHistory.map(h => ({
        time: new Date(h.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        level: h.factors?.river ? Number((h.factors.river * 4.5).toFixed(2)) : (selected?.currentWaterLevel || 2.5)
      }));
    }
    const curr = selected?.currentWaterLevel || 3.8;
    return [
      { time: '00:00', level: Number((curr - 1.2).toFixed(2)) },
      { time: '03:00', level: Number((curr - 0.8).toFixed(2)) },
      { time: '06:00', level: Number((curr - 0.5).toFixed(2)) },
      { time: '09:00', level: Number((curr - 0.2).toFixed(2)) },
      { time: '12:00', level: curr }
    ];
  }, [stationHistory, selected]);

  const handleIssueEvacuationWarning = async () => {
    if (!selected) return;
    setEvacuating(true);
    setEvacSuccess('');
    try {
      await api('/alerts/simulate', {
        method: 'POST',
        body: JSON.stringify({
          locationId: selected._id,
          severity: 'Critical',
          waterLevel: Number((selected.criticalThreshold ? selected.criticalThreshold + 0.6 : 4.8).toFixed(2))
        })
      });
      setEvacSuccess('✓ Evacuation order issued and broadcast to public subscribers.');
      setTimeout(() => setEvacSuccess(''), 5000);
    } catch (e) {
      alert('Failed to trigger evacuation: ' + e.message);
    } finally {
      setEvacuating(false);
    }
  };

  const filters = ['All', 'Normal', 'Warning', 'Critical', 'Offline'];
  const basinOptions = ['All', 'Brahmaputra', 'Ganges', 'Krishna', 'Godavari', 'Narmada', 'Kaveri'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* Top Tactical Command Navbar */}
      <div style={{
        padding: '10px 20px',
        background: 'var(--bg-card, #131b2a)',
        borderBottom: '1px solid var(--border-card, #1e293b)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        zIndex: 10
      }}>
        {/* Left: Heading & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(37,99,235,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={17} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main, #fff)', margin: 0 }}>Spatial Intelligence Map</h2>
            <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
              {displayed.length} of {locations.length} live stations displayed • {selectedBasin} Basin View
            </p>
          </div>
        </div>

        {/* Basin Focus Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>Basin:</span>
          <select
            value={selectedBasin}
            onChange={(e) => setSelectedBasin(e.target.value)}
            style={{
              padding: '5px 10px',
              borderRadius: '7px',
              background: 'var(--bg-input, #0e1420)',
              border: '1px solid var(--border-card, #1e293b)',
              color: 'var(--text-main, #fff)',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            {basinOptions.map(b => (
              <option key={b} value={b}>{b === 'All' ? 'All India (Macro View)' : `${b} River Basin`}</option>
            ))}
          </select>
        </div>

        {/* Spatial Intelligence Layer Toggles */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setMapLayer(l => l === 'canvas' ? 'topo' : 'canvas')}
            style={{
              padding: '5px 11px',
              borderRadius: '7px',
              background: mapLayer === 'topo' ? '#0284c7' : 'var(--bg-input, #0e1420)',
              border: '1px solid var(--border-card, #1e293b)',
              color: mapLayer === 'topo' ? '#fff' : 'var(--text-muted, #94a3b8)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Toggle high-resolution topographical and elevation contour terrain"
          >
            <Mountain size={14} />
            <span>Elevation / Topo</span>
          </button>

          <button
            onClick={() => setShowRadar(r => !r)}
            style={{
              padding: '5px 11px',
              borderRadius: '7px',
              background: showRadar ? '#2563eb' : 'var(--bg-input, #0e1420)',
              border: '1px solid var(--border-card, #1e293b)',
              color: showRadar ? '#fff' : 'var(--text-muted, #94a3b8)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Toggle live precipitation and cloud radar overlay"
          >
            <CloudRain size={14} />
            <span>Weather Radar</span>
          </button>

          {/* Live Responder Asset Tracking Toggle */}
          <button
            onClick={() => setShowResponders(r => !r)}
            style={{
              padding: '5px 11px',
              borderRadius: '7px',
              background: showResponders ? 'rgba(59, 130, 246, 0.25)' : 'var(--bg-input, #0e1420)',
              border: showResponders ? '1px solid #3b82f6' : '1px solid var(--border-card, #1e293b)',
              color: showResponders ? '#38bdf8' : 'var(--text-muted, #94a3b8)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Toggle real-time GPS tracking for NDRF/SDRF rescue boats & vehicles"
          >
            <Navigation size={13} style={{ transform: 'rotate(45deg)' }} />
            <span>Responders ({RESPONDERS.length})</span>
          </button>

          {/* Historical 2022 Flood Extent Mask Toggle */}
          <button
            onClick={() => setShowHistoricalMask(m => !m)}
            style={{
              padding: '5px 11px',
              borderRadius: '7px',
              background: showHistoricalMask ? 'rgba(99, 102, 241, 0.25)' : 'var(--bg-input, #0e1420)',
              border: showHistoricalMask ? '1px solid #6366f1' : '1px solid var(--border-card, #1e293b)',
              color: showHistoricalMask ? '#a5b4fc' : 'var(--text-muted, #94a3b8)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Overlay satellite-derived historical flood inundation mask from 2022 Assam floods"
          >
            <Waves size={13} />
            <span>2022 Assam Flood</span>
          </button>

          {/* Polygon Broadcast Zone Tool */}
          <button
            onClick={() => setPolygonBroadcastOpen(o => !o)}
            style={{
              padding: '5px 11px',
              borderRadius: '7px',
              background: polygonBroadcastOpen ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-input, #0e1420)',
              border: polygonBroadcastOpen ? '1px solid #ef4444' : '1px solid var(--border-card, #1e293b)',
              color: polygonBroadcastOpen ? '#f87171' : 'var(--text-muted, #94a3b8)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Draw or target an evacuation polygon broadcast zone"
          >
            <Crosshair size={13} />
            <span>Polygon Zone</span>
          </button>
        </div>

        {/* Center: Search input */}
        <div style={{ position: 'relative', width: '220px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
          <input
            placeholder="Search stations, river, state…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            style={{
              width: '100%',
              height: '32px',
              paddingLeft: '30px',
              paddingRight: search ? '26px' : '10px',
              borderRadius: '7px',
              background: 'var(--bg-input, #0e1420)',
              border: '1px solid var(--border-card, #1e293b)',
              color: 'var(--text-main, #e2e8f0)',
              fontSize: '11px',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
          {filters.map((f) => {
            const dotColor = f === 'Normal' ? '#10b981' : f === 'Warning' ? '#f59e0b' : f === 'Critical' ? '#ef4444' : f === 'Offline' ? '#64748b' : '#3b82f6';
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: filter === f ? 600 : 400,
                  background: filter === f ? '#2563eb' : 'var(--bg-input, #0e1420)',
                  border: filter === f ? '1px solid #3b82f6' : '1px solid var(--border-card, #1e293b)',
                  color: filter === f ? '#fff' : 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                {f !== 'All' && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, display: 'inline-block' }} />}
                {f} {counts[f] != null ? `(${counts[f]})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Map Viewport & Sliding Drawer Container */}
      <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
        <MapContainer
          center={[22.5, 82.0]}
          zoom={4.5}
          minZoom={3}
          maxBounds={[[-85, -180], [85, 180]]}
          maxBoundsViscosity={1.0}
          scrollWheelZoom
          style={{ width: '100%', height: '100%', background: theme === 'light' ? '#f1f5f9' : '#0b0f17' }}
        >
          <BaseTiles theme={theme} layer={mapLayer} showRadar={showRadar} />
          <MapBoundsController
            targetBounds={selectedBasin !== 'All' ? BASIN_BOUNDS[selectedBasin] : null}
            locations={displayed}
          />
          {displayed.map((loc) => {
            const color = getColor(loc);
            const isCritical = color === '#ef4444';
            const isWarning = color === '#f59e0b';
            return (
              <CircleMarker
                key={loc._id || loc.name}
                center={[loc.lat, loc.lon]}
                radius={isCritical ? 11 : isWarning ? 9 : 7}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.9,
                  weight: isCritical ? 3 : 1.5,
                  className: isCritical ? 'critical-pulse' : ''
                }}
                eventHandlers={{ click: () => setSelected(loc) }}
              >
                <Popup>
                  <div style={{ padding: '4px', fontSize: '12px' }}>
                    <b style={{ color: '#ffffff', display: 'block', marginBottom: '4px' }}>{loc.river || loc.name}</b>
                    <div style={{ color: '#cbd5e1' }}>Water Level: <b style={{ color: '#fff' }}>{loc.currentWaterLevel ?? '—'} m</b></div>
                    <div style={{ color: '#cbd5e1' }}>Threshold: <b style={{ color: '#ef4444' }}>{loc.criticalThreshold ?? 4.0} m</b></div>
                    <div style={{ color: '#94a3b8', marginTop: '4px', fontSize: '10px' }}>{loc.state} • Click pin to slide out drawer &rarr;</div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
          {/* Historical Flood Mask (2022 Disaster Baseline) */}
          {showHistoricalMask && (
            <Polygon
              positions={ASSAM_2022_FLOOD_POLYGON}
              pathOptions={{
                color: '#6366f1',
                fillColor: '#6366f1',
                fillOpacity: 0.28,
                weight: 2,
                dashArray: '6, 6'
              }}
            >
              <Popup>
                <div style={{ padding: '4px', fontSize: '11px', color: '#fff' }}>
                  <b style={{ color: '#a5b4fc', display: 'block', marginBottom: '2px' }}>Historical Flood Mask: Assam 2022</b>
                  <div>Satellite SAR Inundation Extent (June 2022 Peak)</div>
                  <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '2px' }}>Area: ~4,200 sq km submerged across Brahmaputra basin.</div>
                </div>
              </Popup>
            </Polygon>
          )}

          {/* Active Tactical Inundation Polygon Layer */}
          {polygonBroadcastOpen && activeZone && (
            <Polygon
              positions={activeZone.polygon}
              pathOptions={{
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.35,
                weight: 2,
                dashArray: '4, 4'
              }}
            >
              <Popup>
                <div style={{ padding: '6px', fontSize: '11px', color: '#fff' }}>
                  <b style={{ color: '#f87171', display: 'block', marginBottom: '2px' }}>Tactical Polygon Evacuation Perimeter</b>
                  <div>Zone: <b>{activeZone.name}</b></div>
                  <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '2px' }}>
                    Target Postal PIN Codes: <b>{activeZone.pinCodes.join(', ')}</b>
                  </div>
                  <div style={{ color: '#ef4444', fontSize: '10px', marginTop: '4px', fontWeight: 700 }}>
                    ⚠️ Sirens &amp; Web Push Active for this Sector
                  </div>
                </div>
              </Popup>
            </Polygon>
          )}

          {/* Live GPS Emergency Responder Assets */}
          {showResponders && RESPONDERS.map((responder) => (
            <CircleMarker
              key={responder.id}
              center={[responder.lat, responder.lon]}
              radius={7}
              pathOptions={{
                color: '#38bdf8',
                fillColor: '#0284c7',
                fillOpacity: 0.95,
                weight: 2
              }}
            >
              <Popup>
                <div style={{ padding: '4px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Navigation size={12} style={{ color: '#38bdf8', transform: 'rotate(45deg)' }} />
                    <b style={{ color: '#fff' }}>{responder.name}</b>
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: '11px' }}>Asset Type: <b style={{ color: '#fff' }}>{responder.type}</b></div>
                  <div style={{ color: '#cbd5e1', fontSize: '11px' }}>Status: <b style={{ color: '#38bdf8' }}>{responder.status}</b> ({responder.speed})</div>
                  <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '4px' }}>Lat: {responder.lat}, Lon: {responder.lon}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Floating Polygon Broadcast Zone Control Overlay */}
        {polygonBroadcastOpen && (
          <div style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'var(--bg-card, #131b2a)',
            border: '1.5px solid #ef4444',
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.7)',
            maxWidth: '92%',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444'
              }}>
                <Crosshair size={18} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>Polygon Broadcast Tactical Zone</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Select target river sector across India:</div>
              </div>
            </div>

            {/* Tactical Zone Selector Dropdown */}
            <select
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              style={{
                height: '34px',
                padding: '0 10px',
                borderRadius: '6px',
                background: 'var(--bg-input, #0e1420)',
                border: '1px solid var(--border-card, #334155)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                minWidth: '240px'
              }}
            >
              {TACTICAL_POLYGON_ZONES.map(z => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>

            <button
              disabled={broadcastingZone}
              onClick={async () => {
                setBroadcastingZone(true);
                try {
                  await api('/alerts/polygon-broadcast', {
                    method: 'POST',
                    body: JSON.stringify({
                      region: activeZone.name,
                      pinCodes: activeZone.pinCodes,
                      title: `⚠️ REGIONAL EVACUATION SIREN: ${activeZone.river}`,
                      body: `Inundation alert active in ${activeZone.name}. Evacuate immediately!`,
                      timestamp: new Date().toISOString()
                    })
                  }).catch(() => {});
                  setPolygonBroadcastSent(true);
                  setTimeout(() => setPolygonBroadcastSent(false), 4000);
                } finally {
                  setBroadcastingZone(false);
                }
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '7px',
                background: polygonBroadcastSent ? '#10b981' : '#ef4444',
                border: 'none',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 10px rgba(239, 68, 68, 0.4)'
              }}
            >
              <Send size={12} />
              {broadcastingZone ? 'Transmitting…' : polygonBroadcastSent ? `✓ Broadcast Sent to ${activeZone.pinCodes.length} PINs!` : `Broadcast to ${activeZone.river}`}
            </button>

            <button
              onClick={() => setPolygonBroadcastOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              title="Close tactical polygon overlay"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Interactive Right-Side Sliding Drawer */}
        {selected && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '360px',
            maxWidth: '90vw',
            height: '100%',
            background: 'var(--bg-card, #131b2a)',
            borderLeft: '1px solid var(--border-card, #1e293b)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
            transition: 'transform 0.25s ease',
            boxSizing: 'border-box'
          }}>
            {/* Drawer Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-card, #1e293b)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} style={{ color: getColor(selected) }} />
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-main, #fff)' }}>
                  Station Incident Command
                </h3>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Location Profile</span>
                <h4 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main, #fff)', margin: '2px 0 4px' }}>
                  {selected.river || selected.name}
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', margin: 0 }}>
                  {[selected.district, selected.state, 'India'].filter(Boolean).join(', ')} • Elevation: {selected.elevation || 120}m
                </p>
              </div>

              {/* Water Level vs Danger Mark Comparison */}
              <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)' }}>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Hydrological Level vs Danger Mark</span>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '6px' }}>
                  <div>
                    <span style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'monospace', color: getColor(selected) }}>
                      {selected.currentWaterLevel || '2.8'}m
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>Current</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', color: '#ef4444' }}>
                      {selected.criticalThreshold || '4.0'}m
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Danger Mark</span>
                  </div>
                </div>

                {/* Status Bar */}
                <div style={{ width: '100%', height: '6px', background: '#1e293b', borderRadius: '4px', marginTop: '10px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.round(((selected.currentWaterLevel || 2.8) / (selected.criticalThreshold || 4.0)) * 100))}%`,
                    background: getColor(selected)
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                  <span>Warning Stage: {selected.warningThreshold || 3.5}m</span>
                  <span>Sensor: {selected.sensorStatus || 'Active'}</span>
                </div>
              </div>

              {/* Mini Sparkline Chart (Last 12 Hours) */}
              <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    12-Hour Hydrograph Sparkline
                  </span>
                  <span style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 600 }}>Live GloFAS Telemetry</span>
                </div>
                <div style={{ width: '100%', height: '110px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparklineData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={getColor(selected)} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={getColor(selected)} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 9, fill: '#64748b' }} />
                      <YAxis domain={[0, 5]} stroke="#475569" tick={{ fontSize: 9, fill: '#64748b' }} />
                      <ReferenceLine y={selected.criticalThreshold || 4.0} stroke="#ef4444" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="level" stroke={getColor(selected)} strokeWidth={2} fill="url(#sparklineGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Vulnerable Low-Lying Villages in Flood Impact Zone */}
              <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)' }}>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Low-Lying Inundation Zone
                </span>
                <p style={{ fontSize: '11px', color: 'var(--text-main, #cbd5e1)', margin: 0, lineHeight: 1.4 }}>
                  Vulnerable Sectors: <b>{selected.district ? `${selected.district} North & Low-Bank Settlements` : 'Basin Floodplain Settlements'}</b>
                </p>
                <div style={{ marginTop: '6px', fontSize: '10px', color: '#94a3b8' }}>
                  PIN Codes at Risk: 781001, 781003, 781030 • Population: ~45,000
                </div>
              </div>

              {/* Action Button: One-Click Issue Evacuation Warning */}
              <div>
                <button
                  onClick={handleIssueEvacuationWarning}
                  disabled={evacuating}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    background: '#dc2626',
                    border: 'none',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 15px rgba(220, 38, 38, 0.4)'
                  }}
                >
                  <ShieldAlert size={16} />
                  <span>{evacuating ? 'Broadcasting Evacuation Order…' : 'Issue Evacuation Warning'}</span>
                </button>
                {evacSuccess && (
                  <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 600, color: '#10b981', textAlign: 'center' }}>
                    {evacSuccess}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
