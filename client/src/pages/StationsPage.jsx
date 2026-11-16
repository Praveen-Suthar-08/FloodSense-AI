import { useState, useMemo } from 'react';
import {
  Radio, Search, Plus, Filter, MapPin, Activity, AlertTriangle, AlertCircle,
  CheckCircle2, Trash2, Edit3, X, RefreshCw, BarChart2, ChevronRight, Eye,
  ExternalLink, Droplets, Waves, Shield
} from 'lucide-react';
import { api } from '../api.js';

export default function StationsPage({ locations = [], setLocations, onRefresh, theme = 'dark', onSelectStation }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedStation, setSelectedStation] = useState(null);
  const [editModalStation, setEditModalStation] = useState(null);
  const [isDeleting, setIsDeleting] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    river: '',
    state: '',
    district: '',
    warningThreshold: 3.5,
    criticalThreshold: 4.0
  });

  const filteredStations = useMemo(() => {
    return locations.filter(loc => {
      const matchSearch =
        (loc.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (loc.river || '').toLowerCase().includes(search.toLowerCase()) ||
        (loc.state || '').toLowerCase().includes(search.toLowerCase()) ||
        (loc.district || '').toLowerCase().includes(search.toLowerCase());

      const isCrit = loc.sensorStatus === 'Critical' || (loc.currentWaterLevel >= (loc.criticalThreshold || 4.0));
      const isWarn = loc.sensorStatus === 'Warning' || (loc.currentWaterLevel >= (loc.warningThreshold || 3.5));
      const status = isCrit ? 'Critical' : isWarn ? 'Warning' : loc.sensorStatus === 'Offline' ? 'Offline' : 'Normal';

      const matchStatus = statusFilter === 'All' || status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [locations, search, statusFilter]);

  const handleDelete = async (stationId, stationName) => {
    if (!window.confirm(`Are you sure you want to delete "${stationName}"? All historical telemetry and alerts for this station will be removed.`)) {
      return;
    }
    setIsDeleting(stationId);
    try {
      await api(`/locations/${stationId}`, { method: 'DELETE' });
      if (setLocations) {
        setLocations(prev => prev.filter(l => l._id !== stationId));
      }
      if (selectedStation?._id === stationId) setSelectedStation(null);
      setSuccessMsg(`✓ Station "${stationName}" removed from network.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setIsDeleting(null);
    }
  };

  const openEditModal = (station) => {
    setEditModalStation(station);
    setEditForm({
      name: station.name || '',
      river: station.river || station.name || '',
      state: station.state || '',
      district: station.district || '',
      warningThreshold: station.warningThreshold ?? 3.5,
      criticalThreshold: station.criticalThreshold ?? 4.0
    });
    setErrorMsg('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editModalStation) return;
    setIsSaving(true);
    setErrorMsg('');
    try {
      const warn = Number(editForm.warningThreshold);
      const crit = Number(editForm.criticalThreshold);
      if (isNaN(warn) || isNaN(crit) || crit <= warn) {
        setErrorMsg('Critical threshold must be strictly greater than warning threshold.');
        setIsSaving(false);
        return;
      }
      const updated = await api(`/locations/${editModalStation._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          river: editForm.river,
          name: editForm.name || editForm.river,
          state: editForm.state,
          district: editForm.district,
          warningThreshold: warn,
          criticalThreshold: crit
        })
      });
      if (setLocations) {
        setLocations(prev => prev.map(l => l._id === editModalStation._id ? { ...l, ...updated } : l));
      }
      if (selectedStation?._id === editModalStation._id) {
        setSelectedStation(prev => ({ ...prev, ...updated }));
      }
      setEditModalStation(null);
      setSuccessMsg(`✓ Station updated successfully.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      if (onRefresh) onRefresh();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update station.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', boxSizing: 'border-box', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-main, #fff)' }}>
            River Monitoring Stations
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', margin: '4px 0 0 0' }}>
            Live sensor telemetry fleet, threshold calibration, and geographic river stage management
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {successMsg && (
            <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>{successMsg}</span>
          )}
          <button
            onClick={() => onRefresh && onRefresh()}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'var(--bg-card, #131b2a)',
              border: '1px solid var(--border-card, #1e293b)',
              color: 'var(--text-main, #fff)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{
        background: 'var(--bg-card, #131b2a)',
        border: '1px solid var(--border-card, #1e293b)',
        borderRadius: '12px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search by river, station, state or district…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                paddingLeft: '36px',
                paddingRight: '12px',
                borderRadius: '8px',
                background: 'var(--bg-input, #0e1420)',
                border: '1px solid var(--border-card, #1e293b)',
                color: 'var(--text-main, #fff)',
                fontSize: '12px',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Status filters */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#64748b', marginRight: '4px' }}>Status:</span>
          {['All', 'Critical', 'Warning', 'Normal', 'Offline'].map(st => {
            const active = statusFilter === st;
            const color = st === 'Critical' ? '#ef4444' : st === 'Warning' ? '#f59e0b' : st === 'Normal' ? '#10b981' : st === 'Offline' ? '#64748b' : '#3b82f6';
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  background: active ? (theme === 'light' ? 'rgba(37,99,235,0.15)' : 'rgba(37,99,235,0.25)') : 'var(--bg-input, #0e1420)',
                  border: `1px solid ${active ? '#3b82f6' : 'var(--border-card, #1e293b)'}`,
                  color: active ? '#38bdf8' : 'var(--text-muted, #94a3b8)',
                  fontSize: '11px',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                {st !== 'All' && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, display: 'inline-block', marginRight: '5px' }} />}
                {st}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Stations Table (Left 70%) & Selected Station Details Panel (Right 30%) */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedStation ? '68fr 32fr' : '1fr', gap: '16px' }}>
        
        {/* Stations Table Card */}
        <div style={{
          background: 'var(--bg-card, #131b2a)',
          border: '1px solid var(--border-card, #1e293b)',
          borderRadius: '14px',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-card, #1e293b)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, #fff)' }}>
              Registered Network Fleet ({filteredStations.length} Stations)
            </span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Click any row to inspect live telemetry</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-card, #1e293b)', background: 'var(--bg-input, #0e1420)' }}>
                  {['Station / River', 'Location (State/Dist)', 'Coordinates', 'Water Stage', 'Thresholds (W/C)', 'Status', 'Actions'].map((h, i) => (
                    <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStations.map((station, idx) => {
                  const isCrit = station.sensorStatus === 'Critical' || (station.currentWaterLevel >= (station.criticalThreshold || 4.0));
                  const isWarn = station.sensorStatus === 'Warning' || (station.currentWaterLevel >= (station.warningThreshold || 3.5));
                  const status = isCrit ? 'Critical' : isWarn ? 'Warning' : station.sensorStatus === 'Offline' ? 'Offline' : 'Normal';
                  const badgeColor = isCrit ? '#ef4444' : isWarn ? '#f59e0b' : station.sensorStatus === 'Offline' ? '#64748b' : '#10b981';
                  const isSelected = selectedStation?._id === station._id;

                  return (
                    <tr
                      key={station._id || idx}
                      onClick={() => setSelectedStation(station)}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: isSelected ? (theme === 'light' ? 'rgba(37,99,235,0.08)' : 'rgba(37,99,235,0.15)') : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main, #fff)' }}>{station.river || station.name}</div>
                        <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>ID: {station.sensorId || `SENS-${String(idx + 1).padStart(2, '0')}`}</div>
                      </td>

                      <td style={{ padding: '12px 14px', color: 'var(--text-muted, #94a3b8)' }}>
                        <div>{station.state || 'Assam'}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{station.district || 'Kamrup'}</div>
                      </td>

                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                        {station.lat ? `${Number(station.lat).toFixed(2)}°N, ${Number(station.lon).toFixed(2)}°E` : '26.18°N, 91.75°E'}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: badgeColor, fontFamily: 'monospace' }}>
                          {station.currentWaterLevel ?? '4.2'} m
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', fontSize: '11px', color: '#94a3b8' }}>
                        <span style={{ color: '#f59e0b' }}>{station.warningThreshold ?? 3.5}m</span>
                        <span style={{ margin: '0 4px', color: '#64748b' }}>/</span>
                        <span style={{ color: '#ef4444' }}>{station.criticalThreshold ?? 4.0}m</span>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: `${badgeColor}20`,
                          color: badgeColor,
                          fontSize: '10px',
                          fontWeight: 700,
                          border: `1px solid ${badgeColor}40`
                        }}>
                          {status}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => openEditModal(station)}
                            style={{ padding: '5px', borderRadius: '6px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: '#38bdf8', cursor: 'pointer' }}
                            title="Edit station thresholds & metadata"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(station._id, station.river || station.name)}
                            disabled={isDeleting === station._id}
                            style={{ padding: '5px', borderRadius: '6px', background: 'var(--bg-input, #0e1420)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: isDeleting === station._id ? 'wait' : 'pointer' }}
                            title="Delete station from network"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Station Deep Details Drawer / Side Panel */}
        {selectedStation && (
          <div style={{
            background: 'var(--bg-card, #131b2a)',
            border: '1px solid var(--border-card, #1e293b)',
            borderRadius: '14px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Waves size={18} style={{ color: '#3b82f6' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-main, #fff)' }}>
                  Station Profile
                </h3>
              </div>
              <button onClick={() => setSelectedStation(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                <X size={16} />
              </button>
            </div>

            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main, #fff)' }}>{selectedStation.river || selectedStation.name}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{selectedStation.state}, {selectedStation.district || 'Main Basin'}</div>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Current Stage</span>
                <span style={{ fontSize: '20px', fontWeight: 800, color: (selectedStation.currentWaterLevel >= (selectedStation.criticalThreshold || 4.0)) ? '#ef4444' : '#10b981', fontFamily: 'monospace' }}>
                  {selectedStation.currentWaterLevel ?? '4.2'} m
                </span>
              </div>
              <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Danger Threshold</span>
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#ef4444', fontFamily: 'monospace' }}>
                  {selectedStation.criticalThreshold ?? '4.0'} m
                </span>
              </div>
            </div>

            {/* Technical Hardware Spec */}
            <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)' }}>
              <div>Latitude: <b style={{ color: 'var(--text-main, #fff)' }}>{selectedStation.lat || '26.14'}°N</b></div>
              <div>Longitude: <b style={{ color: 'var(--text-main, #fff)' }}>{selectedStation.lon || '91.73'}°E</b></div>
              <div>Elevation: <b style={{ color: 'var(--text-main, #fff)' }}>{selectedStation.elevation || '102'} m MSL</b></div>
              <div>Telemetry Mode: <b style={{ color: '#10b981' }}>Live Cellular / IoT Push</b></div>
              <div>Warning Stage: <b style={{ color: '#f59e0b' }}>{selectedStation.warningThreshold || 3.5} m</b></div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
              <button
                onClick={() => openEditModal(selectedStation)}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '8px',
                  background: '#2563eb',
                  border: 'none',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Configure Thresholds
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Station Modal */}
      {editModalStation && (
        <div className="modal-overlay" onClick={() => setEditModalStation(null)}>
          <form onSubmit={handleEditSubmit} onClick={e => e.stopPropagation()} className="modal-box" style={{ maxWidth: '460px' }}>
            <button type="button" onClick={() => setEditModalStation(null)} className="modal-close">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-main, #fff)' }}>
              Edit Station: {editModalStation.river || editModalStation.name}
            </h3>

            {errorMsg && (
              <div style={{ padding: '8px 12px', marginBottom: '12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', fontSize: '12px' }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>River / Station Name</label>
                <input
                  required
                  value={editForm.river}
                  onChange={e => setEditForm({ ...editForm, river: e.target.value })}
                  style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>State</label>
                  <input
                    value={editForm.state}
                    onChange={e => setEditForm({ ...editForm, state: e.target.value })}
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>District</label>
                  <input
                    value={editForm.district}
                    onChange={e => setEditForm({ ...editForm, district: e.target.value })}
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Warning Threshold (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={editForm.warningThreshold}
                    onChange={e => setEditForm({ ...editForm, warningThreshold: e.target.value })}
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Critical Danger Threshold (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={editForm.criticalThreshold}
                    onChange={e => setEditForm({ ...editForm, criticalThreshold: e.target.value })}
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditModalStation(null)}
                  style={{ padding: '8px 14px', borderRadius: '8px', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{ padding: '8px 18px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontWeight: 600, cursor: isSaving ? 'wait' : 'pointer' }}
                >
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
