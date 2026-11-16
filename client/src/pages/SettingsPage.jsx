import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, RefreshCw, Save, Sliders, CheckCircle2, Users, UserPlus, Shield, Trash2 } from 'lucide-react';
import { api } from '../api.js';

export default function SettingsPage({ locations: propLocations, setLocations: propSetLocations, theme = 'dark', setTheme }) {
  const [internalLocations, setInternalLocations] = useState([]);
  const locations = propLocations || internalLocations;
  const setLocations = propSetLocations || setInternalLocations;
  const [selectedId, setSelectedId] = useState('');
  const [threshold, setThreshold] = useState('50');
  const [warningThreshold, setWarningThreshold] = useState('3.5');
  const [criticalThreshold, setCriticalThreshold] = useState('4.0');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // General App preferences
  const [browserAlertsEnabled, setBrowserAlertsEnabled] = useState(true);
  const [audioSirenEnabled, setAudioSirenEnabled] = useState(true);
  const [telemetryInterval, setTelemetryInterval] = useState('60');

  // RBAC Team Management state
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState({ username: '', password: '', role: 'Viewer', organization: '' });
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberMsg, setAddMemberMsg] = useState('');
  const [deactivatingId, setDeactivatingId] = useState(null);

  useEffect(() => {
    if (!propLocations) {
      api('/locations').then((d) => {
        const locs = Array.isArray(d) ? d : [];
        setInternalLocations(locs);
        if (locs.length > 0 && !selectedId) {
          setSelectedId(locs[0]._id);
          setThreshold(String(locs[0].alertThreshold ?? 50));
          setWarningThreshold(String(locs[0].warningThreshold ?? 3.5));
          setCriticalThreshold(String(locs[0].criticalThreshold ?? 4.0));
        }
      }).catch(() => {});
    } else if (locations.length > 0 && !selectedId) {
      setSelectedId(locations[0]._id);
      setThreshold(String(locations[0].alertThreshold ?? 50));
      setWarningThreshold(String(locations[0].warningThreshold ?? 3.5));
      setCriticalThreshold(String(locations[0].criticalThreshold ?? 4.0));
    }
  }, [propLocations, locations, selectedId]);

  // Load team members
  useEffect(() => {
    setLoadingTeam(true);
    api('/users')
      .then(d => { setTeamMembers(Array.isArray(d) ? d : []); setTeamError(''); })
      .catch(e => { setTeamError(e.message?.includes('403') || e.message?.includes('401') ? 'Admin access required to manage team.' : 'Could not load team members.'); })
      .finally(() => setLoadingTeam(false));
  }, []);

  const refreshTeam = () => {
    api('/users').then(d => setTeamMembers(Array.isArray(d) ? d : [])).catch(() => {});
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api(`/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) });
      refreshTeam();
    } catch (e) {
      alert('Failed to update role: ' + e.message);
    }
  };

  const handleAddMember = async () => {
    if (!newMember.username || !newMember.password) { setAddMemberMsg('✗ Username and password required.'); return; }
    setAddingMember(true);
    setAddMemberMsg('');
    try {
      await api('/users', { method: 'POST', body: JSON.stringify(newMember) });
      setAddMemberMsg('✓ Member added successfully!');
      setNewMember({ username: '', password: '', role: 'Viewer', organization: '' });
      setShowAddMember(false);
      refreshTeam();
    } catch (e) {
      setAddMemberMsg('✗ ' + (e.message || 'Failed to add member'));
    } finally {
      setAddingMember(false);
    }
  };

  const handleDeactivate = async (userId) => {
    if (!confirm('Deactivate this user?')) return;
    setDeactivatingId(userId);
    try {
      await api(`/users/${userId}`, { method: 'DELETE' });
      refreshTeam();
    } catch (e) {
      alert('Failed to deactivate: ' + e.message);
    } finally {
      setDeactivatingId(null);
    }
  };

  const handleSelectLocation = (e) => {
    const id = e.target.value;
    setSelectedId(id);
    const loc = locations.find((l) => l._id === id);
    if (loc) {
      setThreshold(String(loc.alertThreshold ?? 50));
      setWarningThreshold(String(loc.warningThreshold ?? 3.5));
      setCriticalThreshold(String(loc.criticalThreshold ?? 4.0));
    }
    setSaveMsg('');
  };

  const selectedLoc = locations.find(l => l._id === selectedId);

  const handleSaveThreshold = async () => {
    if (!selectedId) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const w = Number(warningThreshold);
      const c = Number(criticalThreshold);
      if (isNaN(w) || w <= 0 || isNaN(c) || c <= w) {
        setSaveMsg('✗ Critical threshold must be greater than warning threshold.');
        setSaving(false);
        return;
      }

      await api(`/locations/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          alertThreshold: Number(threshold),
          warningThreshold: w,
          criticalThreshold: c
        }),
      });
      setLocations((prev) =>
        prev.map((l) => l._id === selectedId ? {
          ...l,
          alertThreshold: Number(threshold),
          warningThreshold: w,
          criticalThreshold: c
        } : l)
      );
      setSaveMsg('✓ Configuration saved and active across system.');
      setTimeout(() => setSaveMsg(''), 4000);
    } catch (err) {
      setSaveMsg(`✗ ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '28px 32px', width: '100%', height: '100%', overflowY: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(37, 99, 235, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sliders size={22} style={{ color: '#3b82f6' }} />
        </div>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main, #fff)', margin: 0 }}>System &amp; Sensor Fleet Settings</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-sub, #64748b)', margin: 0 }}>Global application preferences, appearance themes, and hydrological threshold calibration</p>
        </div>
      </div>

      {/* Top 2-Column Responsive Settings Row: Appearance (Left) & Team Access Management (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', width: '100%' }}>
        
        {/* Appearance & System Preferences Card */}
        <div style={{
          background: 'var(--bg-card, #131b2a)',
          borderRadius: '16px',
          border: '1px solid var(--border-card, #1e293b)',
          padding: '24px 28px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-main, #fff)' }}>
              Application Appearance &amp; Telemetry Timing
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Theme Selector */}
              <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #fff)', display: 'block', marginBottom: '8px' }}>
                  Interface Theme
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setTheme && setTheme('light')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      border: theme === 'light' ? '2px solid #2563eb' : '1px solid var(--border-card, #1e293b)',
                      background: theme === 'light' ? 'rgba(37,99,235,0.15)' : 'transparent',
                      color: theme === 'light' ? '#2563eb' : 'var(--text-muted, #94a3b8)',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Light Theme
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme && setTheme('dark')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      border: theme === 'dark' ? '2px solid #3b82f6' : '1px solid var(--border-card, #1e293b)',
                      background: theme === 'dark' ? 'rgba(59,130,246,0.15)' : 'transparent',
                      color: theme === 'dark' ? '#38bdf8' : 'var(--text-muted, #94a3b8)',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Dark Theme
                  </button>
                </div>
                <span style={{ fontSize: '10px', color: '#64748b', marginTop: '6px', display: 'block' }}>Changes apply immediately and persist in local storage</span>
              </div>

              {/* Telemetry Polling Frequency */}
              <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #fff)', display: 'block', marginBottom: '8px' }}>
                  IoT Telemetry Polling Rate
                </label>
                <select
                  value={telemetryInterval}
                  onChange={e => setTelemetryInterval(e.target.value)}
                  style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', background: 'var(--bg-card, #131b2a)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)', fontSize: '12px' }}
                >
                  <option value="30">Every 30 Seconds (Rapid Flash Flood)</option>
                  <option value="60">Every 1 Minute (Standard Operations)</option>
                  <option value="300">Every 5 Minutes (Battery Saver Mode)</option>
                </select>
                <span style={{ fontSize: '10px', color: '#10b981', marginTop: '6px', display: 'block' }}>✓ WebSocket real-time broadcast active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Team Access Management (RBAC) - Positioned Beside Appearance */}
        <div style={{
          background: 'var(--bg-card, #131b2a)',
          borderRadius: '16px',
          border: '1px solid var(--border-card, #1e293b)',
          padding: '24px 28px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border-card, #1e293b)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={18} style={{ color: '#3b82f6' }} />
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main, #fff)', margin: 0 }}>Team Access Management</h3>
                <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>RBAC — Manage operator roles and system access</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddMember(!showAddMember)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
            >
              <UserPlus size={13} /> Add Member
            </button>
          </div>

          {/* Add Member Form */}
          {showAddMember && (
            <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-input, #0e1420)', border: '1px solid #3b82f6', marginBottom: '14px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main, #fff)', margin: '0 0 10px 0' }}>New Team Member</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: '#64748b', display: 'block', marginBottom: '3px' }}>Username *</label>
                  <input type="text" value={newMember.username} onChange={e => setNewMember(p => ({ ...p, username: e.target.value }))}
                    placeholder="e.g. operator_raj"
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-card, #131b2a)', border: '1px solid var(--border-card, #334155)', color: 'var(--text-main, #fff)', fontSize: '11.5px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: '#64748b', display: 'block', marginBottom: '3px' }}>Password *</label>
                  <input type="password" value={newMember.password} onChange={e => setNewMember(p => ({ ...p, password: e.target.value }))}
                    placeholder="Min 6 characters"
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-card, #131b2a)', border: '1px solid var(--border-card, #334155)', color: 'var(--text-main, #fff)', fontSize: '11.5px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: '#64748b', display: 'block', marginBottom: '3px' }}>Role</label>
                  <select value={newMember.role} onChange={e => setNewMember(p => ({ ...p, role: e.target.value }))}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-card, #131b2a)', border: '1px solid var(--border-card, #334155)', color: 'var(--text-main, #fff)', fontSize: '11.5px' }}>
                    <option value="Viewer">Viewer</option>
                    <option value="Dispatcher">Dispatcher</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: '#64748b', display: 'block', marginBottom: '3px' }}>Organization</label>
                  <input type="text" value={newMember.organization} onChange={e => setNewMember(p => ({ ...p, organization: e.target.value }))}
                    placeholder="e.g. NDRF HQ"
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-card, #131b2a)', border: '1px solid var(--border-card, #334155)', color: 'var(--text-main, #fff)', fontSize: '11.5px', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={handleAddMember} disabled={addingMember}
                  style={{ padding: '6px 14px', borderRadius: '6px', background: '#10b981', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                  {addingMember ? 'Adding…' : '✓ Create Account'}
                </button>
                <button onClick={() => { setShowAddMember(false); setAddMemberMsg(''); }}
                  style={{ padding: '6px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                {addMemberMsg && <span style={{ fontSize: '10.5px', color: addMemberMsg.startsWith('✓') ? '#10b981' : '#ef4444', fontWeight: 600 }}>{addMemberMsg}</span>}
              </div>
            </div>
          )}

          {/* Access warning */}
          {teamError && (
            <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', fontSize: '11px', color: '#f59e0b', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={13} /> {teamError}
            </div>
          )}

          {/* Team Table */}
          {loadingTeam ? (
            <div style={{ textAlign: 'center', color: '#64748b', fontSize: '12px', padding: '16px' }}>Loading team members…</div>
          ) : teamMembers.length === 0 && !teamError ? (
            <div style={{ textAlign: 'center', color: '#64748b', fontSize: '12px', padding: '16px' }}>No team members found. Add your first member above.</div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '200px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-card, #1e293b)' }}>
                    {['Username', 'Role', 'Organization', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map((member) => (
                    <tr key={member._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '8px 10px', color: 'var(--text-main, #fff)', fontWeight: 600 }}>{member.username}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member._id, e.target.value)}
                          style={{ padding: '3px 6px', borderRadius: '5px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: member.role === 'Admin' ? '#a855f7' : member.role === 'Dispatcher' ? '#3b82f6' : '#10b981', fontSize: '10.5px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          <option value="Viewer">Viewer</option>
                          <option value="Dispatcher">Dispatcher</option>
                          <option value="Admin">Admin</option>
                        </select>
                      </td>
                      <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{member.organization || '—'}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ padding: '1px 6px', borderRadius: '8px', fontSize: '9.5px', fontWeight: 700, background: member.isActive !== false ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)', color: member.isActive !== false ? '#10b981' : '#64748b' }}>
                          {member.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        {member.isActive !== false && (
                          <button
                            onClick={() => handleDeactivate(member._id)}
                            disabled={deactivatingId === member._id}
                            style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 8px', borderRadius: '5px', background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', fontSize: '10.5px', cursor: 'pointer' }}
                          >
                            <Trash2 size={10} /> {deactivatingId === member._id ? '…' : 'Deactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Alert Sensitivity Slider Card - Spanning Full Width */}
      <div style={{
        background: 'var(--bg-card, #131b2a)',
        borderRadius: '16px',
        border: '1px solid var(--border-card, #1e293b)',
        padding: '28px 32px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--border-card, #1e293b)' }}>
          <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main, #fff)', margin: 0 }}>Dynamic Alert Sensitivity Slider</h3>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-sub, #64748b)', marginBottom: '20px', lineHeight: 1.6 }}>
          Select a river monitoring station to customize its alert escalation threshold and hydrological stage limits. Threshold adjustments persist directly to the database and update alert evaluation in real time.
        </p>

        {/* Station Select */}
        <div style={{ marginBottom: '22px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #e2e8f0)', display: 'block', marginBottom: '8px' }}>
            Target River Station
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={selectedId}
              onChange={handleSelectLocation}
              style={{
                width: '100%',
                appearance: 'none',
                padding: '11px 36px 11px 14px',
                borderRadius: '10px',
                background: 'var(--bg-input, #0e1420)',
                border: '1px solid var(--border-card, #1e293b)',
                color: 'var(--text-main, #e2e8f0)',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              {locations.map((l) => (
                <option key={l._id} value={l._id}>{l.river || l.name} — {l.state || l.admin1}</option>
              ))}
            </select>
            <ChevronDown size={16} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
          </div>
        </div>

        {/* Sensitivity Score Slider */}
        <div style={{ marginBottom: '24px', padding: '18px 20px', borderRadius: '12px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main, #fff)' }}>Alert Escalation Score Threshold</span>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Minimum computed risk score (10–90) required to trigger automatic alert status</span>
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: '18px', color: '#3b82f6', fontWeight: 700 }}>
              {threshold} / 100
            </span>
          </div>

          <input
            type="range"
            min={10}
            max={90}
            step={5}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer', height: '6px' }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
            <span>10 (High Sensitivity)</span>
            <span>50 (Standard)</span>
            <span>90 (Severe Only)</span>
          </div>
        </div>

        {/* Physical Stage Thresholds — Drag Sliders */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-input, #0e1420)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #e2e8f0)' }}>
                ⚠ Warning Stage (m)
              </label>
              <span style={{ fontFamily: 'monospace', fontSize: '16px', color: '#f59e0b', fontWeight: 700 }}>{Number(warningThreshold).toFixed(1)}m</span>
            </div>
            <input
              type="range"
              min="1" max="8" step="0.1"
              value={warningThreshold}
              onChange={(e) => setWarningThreshold(e.target.value)}
              style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer', height: '6px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
              <span>1.0m (Low)</span><span>4.5m (Mid)</span><span>8.0m (High)</span>
            </div>
            <span style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', display: 'block' }}>Initial cautionary alert trigger</span>
          </div>

          <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-input, #0e1420)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main, #e2e8f0)' }}>
                🔴 Critical Danger Stage (m)
              </label>
              <span style={{ fontFamily: 'monospace', fontSize: '16px', color: '#ef4444', fontWeight: 700 }}>{Number(criticalThreshold).toFixed(1)}m</span>
            </div>
            <input
              type="range"
              min="1" max="10" step="0.1"
              value={criticalThreshold}
              onChange={(e) => setCriticalThreshold(e.target.value)}
              style={{ width: '100%', accentColor: '#ef4444', cursor: 'pointer', height: '6px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
              <span>1.0m</span><span>5.5m</span><span>10.0m</span>
            </div>
            <span style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', display: 'block' }}>Critical evacuation trigger boundary</span>
          </div>
        </div>

        {/* Save button and status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-card, #1e293b)' }}>
          <button
            onClick={handleSaveThreshold}
            disabled={saving}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              background: '#2563eb',
              border: 'none',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {saving ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={15} />}
            {saving ? 'Saving Changes…' : 'Save Changes'}
          </button>

          {saveMsg && (
            <span style={{
              fontSize: '12px',
              fontWeight: 500,
              color: saveMsg.startsWith('✓') ? '#10b981' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {saveMsg}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
