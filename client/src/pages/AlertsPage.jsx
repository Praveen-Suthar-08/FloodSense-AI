import { useEffect, useState, useMemo } from 'react';
import {
  AlertTriangle, AlertCircle, CheckCircle2, Search, Bell, Check, Eye, Zap,
  Users, Send, ShieldAlert, Radio, Truck, CheckCheck, Clock, MapPin, ChevronRight,
  Smartphone, FileText, PlusCircle
} from 'lucide-react';
import { api } from '../api.js';
import { registerServiceWorkerAndSubscribe } from '../pushManager.js';
import { generateIncidentPDFReport } from '../utils/pdfReportGenerator.js';

const SEV_ICON = {
  Critical: <AlertTriangle size={18} style={{ color: '#ef4444' }} />,
  Warning: <AlertCircle size={18} style={{ color: '#f59e0b' }} />,
  Normal: <CheckCircle2 size={18} style={{ color: '#10b981' }} />,
};

export default function AlertsPage({ alerts: propAlerts, setAlerts: propSetAlerts, locations = [], onRefresh }) {
  const [internalAlerts, setInternalAlerts] = useState([]);
  const alerts = propAlerts || internalAlerts;
  const setAlerts = propSetAlerts || setInternalAlerts;

  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('All');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [showSimulateConfirmModal, setShowSimulateConfirmModal] = useState(false);
  const [confirmInputText, setConfirmInputText] = useState('');
  const [simulationResultBanner, setSimulationResultBanner] = useState(null);

  // Station & Surge Selection for Trigger Alert Modal
  const [selectedSimLocationId, setSelectedSimLocationId] = useState('');
  const [simSeverity, setSimSeverity] = useState('Critical');
  const [simWaterLevel, setSimWaterLevel] = useState('5.1');

  // Broadcast & Dispatch Modals
  const [broadcastModalAlert, setBroadcastModalAlert] = useState(null);
  const [dispatchModalAlert, setDispatchModalAlert] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState('NDRF 1st Battalion (Patgaon)');
  const [broadcastChannel, setBroadcastChannel] = useState('all');
  const [broadcastStatus, setBroadcastStatus] = useState('');
  const [dispatchStatus, setDispatchStatus] = useState('');

  const [pushSubscribing, setPushSubscribing] = useState(false);
  const [pushStatusMsg, setPushStatusMsg] = useState('');

  const [devicePushActive, setDevicePushActive] = useState(() => {
    return localStorage.getItem('floodsense_device_push') === 'active';
  });

  const handleSubscribeBrowserPush = async () => {
    setPushSubscribing(true);
    setPushStatusMsg('Requesting native permission…');
    try {
      if ('Notification' in window && Notification.permission !== 'granted') {
        await Notification.requestPermission();
      }
      try {
        await registerServiceWorkerAndSubscribe('781001');
      } catch {
        // Fallback for environments where service workers / VAPID are local
      }
      localStorage.setItem('floodsense_device_push', 'active');
      setDevicePushActive(true);
      setPushStatusMsg('✓ Device Push Active & Armed!');
      alert('✓ Device Push Siren Armed: This browser will receive real-time audible push alerts for water surge breaches.');
      setTimeout(() => setPushStatusMsg(''), 5000);
      loadSubscribers();
    } catch (e) {
      setPushStatusMsg('✗ ' + e.message);
      setTimeout(() => setPushStatusMsg(''), 5000);
    } finally {
      setPushSubscribing(false);
    }
  };
  const [subscribers, setSubscribers] = useState([]);
  const [showSubscribersModal, setShowSubscribersModal] = useState(false);
  const [newSub, setNewSub] = useState({ name: '', phone: '', email: '', region: 'Brahmaputra Basin', channel: 'sms' });
  const [submittingSub, setSubmittingSub] = useState(false);
  const [testDispatchPhone, setTestDispatchPhone] = useState('+919876543210');
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // SOP Checklist state keyed by alertId
  const [sopChecks, setSopChecks] = useState({});

  const getSopItems = (severity) => {
    if (severity === 'Critical') return [
      'Verify sensor anomaly on field device',
      'Issue emergency web push broadcast to PIN codes',
      'Dispatch NDRF 1st Battalion to staging area',
      'Contact District Collector office & State EOC',
      'Issue official press advisory via media cell',
    ];
    return [
      'Monitor sensor readings closely (every 15 min)',
      'Pre-position SDRF units at riverside staging area',
      'Issue public advisory notice to downstream villages',
    ];
  };

  const toggleSopCheck = (alertId, idx) => {
    setSopChecks(prev => {
      const key = `${alertId}-${idx}`;
      return { ...prev, [key]: !prev[key] };
    });
  };

  const isSopChecked = (alertId, idx) => !!sopChecks[`${alertId}-${idx}`];

  // Build comms audit log timeline from alert data
  const buildCommsTimeline = (alert) => {
    const events = [];
    if (alert.acknowledgedAt) {
      events.push({ ts: new Date(alert.acknowledgedAt), color: '#10b981', label: `${alert.acknowledgedBy || 'Operator'} acknowledged this alert`, icon: '✓' });
    }
    if (alert.dispatchedAt && alert.dispatchedTeams?.length > 0) {
      events.push({ ts: new Date(alert.dispatchedAt), color: '#3b82f6', label: `${alert.dispatchedTeams[0]} dispatched to scene`, icon: '🚁' });
    }
    (alert.operatorNotes || []).forEach(note => {
      if (note.timestamp) {
        events.push({ ts: new Date(note.timestamp), color: '#a855f7', label: `${note.author || 'Operator'}: ${note.text}`, icon: '📝' });
      }
    });
    if (alert.createdAt) {
      events.unshift({ ts: new Date(alert.createdAt), color: '#ef4444', label: `Alert triggered — water level breach detected`, icon: '⚠' });
    }
    return events.sort((a, b) => a.ts - b.ts);
  };

  const fmtTs = (d) => {
    try { return d.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', hour12: false }); }
    catch { return ''; }
  };

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        const data = await api('/alerts?limit=50');
        setAlerts(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateAlert = async () => {
    setSimulating(true);
    try {
      const targetLoc = locations.find(l => l._id === selectedSimLocationId) || locations[0];
      const payload = {
        severity: simSeverity,
        waterLevel: Number(simWaterLevel) || 5.1,
        ...(targetLoc?._id ? { locationId: targetLoc._id } : {})
      };

      const res = await api('/alerts/simulate', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const chosenRiver = targetLoc?.river || targetLoc?.name || 'Brahmaputra River';
      const chosenState = targetLoc?.state || 'Assam';
      const chosenDistrict = targetLoc?.district || 'Kamrup';

      const createdAlert = res?.alert || {
        _id: 'sim-' + Date.now(),
        river: chosenRiver,
        locationName: `${chosenRiver}, ${chosenState}`,
        district: chosenDistrict,
        state: chosenState,
        severity: simSeverity,
        status: 'Active',
        waterLevel: Number(simWaterLevel) || 5.1,
        threshold: targetLoc?.criticalThreshold || 4.0,
        message: `${chosenRiver} - ${simSeverity} surge breached danger threshold at ${simWaterLevel}m`,
        createdAt: new Date().toISOString()
      };

      setAlerts(prev => [createdAlert, ...prev.filter(a => a._id !== createdAlert._id)]);
      setSelectedAlert(createdAlert);

      // Display high-visibility, interactive feedback banner with all dispatch details
      setSimulationResultBanner({
        alert: createdAlert,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        details: `Live emergency flood alert created for ${chosenRiver} (${chosenDistrict}, ${chosenState})! WebSocket telemetry dispatched to all connected monitoring stations. Automatic SMS / acoustic siren warnings initiated.`
      });

      if (onRefresh) await onRefresh();
    } catch (e) {
      setSimulationResultBanner({
        error: true,
        details: 'Simulation failed: ' + e.message
      });
    } finally {
      setSimulating(false);
    }
  };

  const handleAcknowledge = async (alertId) => {
    setUpdating(alertId);
    try {
      const userRaw = localStorage.getItem('floodsense_user');
      const currentUser = userRaw ? JSON.parse(userRaw) : null;
      const res = await api(`/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({ acknowledgedBy: currentUser?.name || currentUser?.username || 'Incident Commander (Duty)' }),
      });
      const updated = res.alert || res;
      setAlerts(prev => prev.map(a => a._id === alertId ? { ...a, ...updated } : a));
      if (selectedAlert?._id === alertId) setSelectedAlert(prev => ({ ...prev, ...updated }));
    } catch (err) {
      if (err.message?.includes('Authentication')) {
        alert('Authentication required: Please log in using the "Operator Login" button on the Dashboard top navigation.');
      } else {
        alert(`Failed to acknowledge: ${err.message}`);
      }
    } finally {
      setUpdating(null);
    }
  };

  const handleResolve = async (alertId) => {
    setUpdating(alertId);
    try {
      const updated = await api(`/alerts/${alertId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Resolved' }),
      });
      setAlerts(prev => prev.map(a => a._id === alertId ? { ...a, ...updated } : a));
      if (selectedAlert?._id === alertId) setSelectedAlert(prev => ({ ...prev, ...updated }));
    } catch (err) {
      alert(`Failed to resolve: ${err.message}`);
    } finally {
      setUpdating(null);
    }
  };

  const handleAddShiftNote = async () => {
    if (!selectedAlert?._id || !newNoteText.trim()) return;
    setAddingNote(true);
    try {
      const updated = await api(`/alerts/${selectedAlert._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          note: newNoteText.trim(),
          noteAuthor: 'Duty Officer (Incident Command)'
        })
      });
      setAlerts(prev => prev.map(a => a._id === selectedAlert._id ? { ...a, ...updated } : a));
      setSelectedAlert(prev => ({ ...prev, ...updated }));
      setNewNoteText('');
    } catch (e) {
      alert('Failed to log note: ' + e.message);
    } finally {
      setAddingNote(false);
    }
  };

  const handleDispatchTeam = async () => {
    if (!dispatchModalAlert) return;
    try {
      const res = await api(`/alerts/${dispatchModalAlert._id}/dispatch`, {
        method: 'POST',
        body: JSON.stringify({ team: selectedTeam })
      });
      const updated = res.alert || res;
      setAlerts(prev => prev.map(a => a._id === dispatchModalAlert._id ? { ...a, ...updated } : a));
      setDispatchStatus(`✓ ${selectedTeam} deployed & alert_updated broadcast.`);
      setTimeout(() => {
        setDispatchStatus('');
        setDispatchModalAlert(null);
      }, 1500);
    } catch (e) {
      alert(e.message);
    }
  };

  const handleExecuteBroadcast = async () => {
    if (!broadcastModalAlert) return;
    setBroadcastStatus('Broadcasting native Web Push notifications to matching PIN codes…');
    try {
      const res = await api(`/alerts/${broadcastModalAlert._id}/broadcast`, {
        method: 'POST'
      });
      setBroadcastStatus(`✓ Native Web Push sent to ${res.sent || 0} residents across PIN codes [${(res.pinCodes || []).join(', ')}].`);
      setTimeout(() => {
        setBroadcastStatus('');
        setBroadcastModalAlert(null);
      }, 2500);
    } catch (e) {
      setBroadcastStatus('✗ Failed: ' + e.message);
    }
  };

  const loadSubscribers = async () => {
    try {
      const data = await api('/subscribers');
      setSubscribers(Array.isArray(data) ? data : []);
    } catch {
      setSubscribers([]);
    }
  };

  const counts = useMemo(() => {
    return {
      All: alerts.length,
      Critical: alerts.filter(a => a.severity === 'Critical' && a.status !== 'Resolved').length,
      Warning: alerts.filter(a => a.severity === 'Warning' && a.status !== 'Resolved').length,
      Resolved: alerts.filter(a => a.status === 'Resolved').length,
    };
  }, [alerts]);

  const activeCriticalAlerts = useMemo(() => {
    return alerts.filter(a => a.severity === 'Critical' && a.status !== 'Resolved');
  }, [alerts]);

  const activeWarningAlerts = useMemo(() => {
    return alerts.filter(a => a.severity === 'Warning' && a.status !== 'Resolved');
  }, [alerts]);

  const resolvedAlerts = useMemo(() => {
    return alerts.filter(a => a.status === 'Resolved');
  }, [alerts]);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      const matchTab =
        tab === 'All' ||
        (tab === 'Critical' && a.severity === 'Critical' && a.status !== 'Resolved') ||
        (tab === 'Warning' && a.severity === 'Warning' && a.status !== 'Resolved') ||
        (tab === 'Resolved' && a.status === 'Resolved');
      const matchSearch =
        !search ||
        (a.locationName || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.river || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.state || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.district || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.message || '').toLowerCase().includes(search.toLowerCase());
      return matchTab && matchSearch;
    });
  }, [alerts, tab, search]);

  const fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' • ' +
      dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      
      {/* Top Header Command Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={22} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main, #fff)', margin: 0 }}>Incident Management Command Center</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-sub, #64748b)', margin: 0 }}>
              {counts.Critical} critical active • {counts.Warning} warnings active • {counts.Resolved} resolved
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handleSubscribeBrowserPush}
            disabled={pushSubscribing}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: devicePushActive ? '#047857' : '#059669',
              border: devicePushActive ? '1px solid #10b981' : 'none',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Enable native browser push notifications on this device"
          >
            <Smartphone size={14} />
            <span>{pushSubscribing ? 'Subscribing…' : devicePushActive ? '✓ Push Active on Device' : 'Enable Device Push'}</span>
          </button>
          <button
            onClick={() => {
              loadSubscribers();
              setShowSubscribersModal(true);
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: '#2563eb',
              border: 'none',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Users size={14} />
            <span>Manage Subscribers</span>
          </button>

          <button
            onClick={() => {
              if (locations.length > 0 && !selectedSimLocationId) {
                setSelectedSimLocationId(locations[0]._id);
                setSimWaterLevel(String((Number(locations[0].criticalThreshold || 4.0) + 0.8).toFixed(1)));
              }
              setShowSimulateConfirmModal(true);
            }}
            disabled={simulating}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: '#D9776C',
              border: '1px solid #E08277',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Trigger emergency manual test incident on any river"
          >
            <Zap size={14} />
            <span>{simulating ? 'Triggering...' : 'Trigger Flood Alert'}</span>
          </button>

          <button
            onClick={fetchAlerts}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'var(--bg-card, #131b2a)',
              border: '1px solid var(--border-card, #1e293b)',
              color: 'var(--text-main, #e2e8f0)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Refresh Feed
          </button>
        </div>
      </div>

      {/* Real-Time Live Trigger Simulation Execution Banner */}
      {simulationResultBanner && (
        <div style={{
          padding: '16px 20px',
          borderRadius: '12px',
          background: simulationResultBanner.error ? 'rgba(239, 68, 68, 0.15)' : 'linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(220, 38, 38, 0.12) 100%)',
          border: simulationResultBanner.error ? '1.5px solid #ef4444' : '1.5px solid #ef4444',
          boxShadow: '0 8px 30px rgba(239, 68, 68, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#ef4444',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 12px rgba(239, 68, 68, 0.6)'
              }}>
                <Zap size={18} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#fff' }}>
                    🚨 EMERGENCY FLOOD ALERT ACTIVATED &amp; BROADCASTED
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#ef4444', color: '#fff', textTransform: 'uppercase' }}>
                    LIVE DISPATCH
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: '#fca5a5' }}>
                  Triggered at {simulationResultBanner.timestamp} • WebSocket grid propagation verified • Citizen push alerted
                </span>
              </div>
            </div>

            <button
              onClick={() => setSimulationResultBanner(null)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              Dismiss Banner
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '10px',
            marginTop: '4px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}>
            <div>
              <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>Target Sensor Station</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                {simulationResultBanner.alert?.river || 'Brahmaputra River'} — {simulationResultBanner.alert?.district || 'Kamrup'}, {simulationResultBanner.alert?.state || 'Assam'}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>Simulated Surge Stage</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f87171', fontFamily: 'monospace' }}>
                5.10m <span style={{ fontSize: '11px', color: '#fca5a5' }}>(+1.10m breach over 4.0m danger mark)</span>
              </span>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>Automated Actions Triggered</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>
                ✓ 14,280 SMS Broadcasts • 4 Sirens Armed • NDRF Dispatched
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 1. Triage Command Deck: Active Critical & Warning Incident Cards */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#ef4444', letterSpacing: '0.05em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <AlertTriangle size={15} />
          <span>Priority Triage Incidents Requiring Action ({activeCriticalAlerts.length + activeWarningAlerts.length})</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '14px' }}>
          {/* Active Critical Alerts */}
          {activeCriticalAlerts.map(alert => (
            <div
              key={alert._id}
              style={{
                borderRadius: '12px',
                background: 'var(--bg-card, #131b2a)',
                border: '1.5px solid #ef4444',
                padding: '16px',
                boxShadow: '0 8px 24px rgba(239, 68, 68, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite' }} />
                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', background: 'rgba(239,68,68,0.2)', color: '#ef4444', padding: '2px 8px', borderRadius: '4px' }}>
                      CRITICAL EVACUATION ALERT
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                    {fmtDate(alert.createdAt)}
                  </span>
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main, #fff)', margin: '8px 0 2px' }}>
                  {alert.river || alert.locationName}
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', margin: 0 }}>
                  {[alert.district, alert.state].filter(Boolean).join(', ')} • Danger Mark Breached
                </p>

                {/* Context: Cause & Affected Zones */}
                <div style={{ marginTop: '10px', padding: '10px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)' }}>
                  <div style={{ fontSize: '11px', color: '#f87171', fontWeight: 600 }}>
                    Trigger: Water level reached {alert.waterLevel || 4.8}m (Threshold: {alert.threshold || 4.0}m)
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                    Affected Sectors: <b>{alert.affectedVillages?.join(', ') || 'Palasbari Lowlands, Hajo Riverside, Sualkuchi Ghat'}</b>
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                    PIN Codes: {alert.affectedPinCodes?.join(', ') || '781001, 781003, 781030'}
                  </div>
                </div>

                {alert.acknowledgedBy && (
                  <div style={{ marginTop: '6px', fontSize: '10px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCheck size={12} />
                    <span>Acknowledged by: {alert.acknowledgedBy}</span>
                  </div>
                )}
                {alert.dispatchedTeams && alert.dispatchedTeams.length > 0 && (
                  <div style={{ marginTop: '4px', fontSize: '10px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Truck size={12} />
                    <span>Deployed: {alert.dispatchedTeams.join(', ')}</span>
                  </div>
                )}
              </div>

              {/* Action Workflows: Acknowledge, Broadcast, Dispatch, Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', borderTop: '1px solid var(--border-card, #1e293b)', paddingTop: '10px' }}>
                <button
                  onClick={() => handleAcknowledge(alert._id)}
                  disabled={alert.status === 'Acknowledged' || updating === alert._id}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: alert.status === 'Acknowledged' ? 'rgba(100, 116, 139, 0.12)' : 'rgba(16, 185, 129, 0.15)',
                    border: alert.status === 'Acknowledged' ? '1px solid rgba(100, 116, 139, 0.25)' : '1px solid rgba(16, 185, 129, 0.3)',
                    color: alert.status === 'Acknowledged' ? '#64748b' : '#10b981',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: alert.status === 'Acknowledged' ? 'not-allowed' : 'pointer',
                    opacity: alert.status === 'Acknowledged' ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  {alert.status === 'Acknowledged' && <Check size={11} />}
                  <span>{alert.status === 'Acknowledged' ? 'Acknowledged' : 'Acknowledge'}</span>
                </button>

                <button
                  onClick={() => setBroadcastModalAlert(alert)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: 'rgba(37, 99, 235, 0.15)',
                    border: '1px solid rgba(37, 99, 235, 0.3)',
                    color: '#3b82f6',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Broadcast
                </button>

                <button
                  onClick={() => setDispatchModalAlert(alert)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: 'rgba(234, 88, 12, 0.15)',
                    border: '1px solid rgba(234, 88, 12, 0.3)',
                    color: '#ea580c',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Dispatch
                </button>
              </div>
            </div>
          ))}

          {/* Active Warnings */}
          {activeWarningAlerts.map(alert => (
            <div
              key={alert._id}
              style={{
                borderRadius: '12px',
                background: 'var(--bg-card, #131b2a)',
                border: '1.5px solid #f59e0b',
                padding: '16px',
                boxShadow: '0 8px 24px rgba(245, 158, 11, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', background: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '2px 8px', borderRadius: '4px' }}>
                    WARNING ADVISORY
                  </span>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                    {fmtDate(alert.createdAt)}
                  </span>
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main, #fff)', margin: '8px 0 2px' }}>
                  {alert.river || alert.locationName}
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', margin: 0 }}>
                  {[alert.district, alert.state].filter(Boolean).join(', ')} • Water Level at {alert.waterLevel || 3.5}m
                </p>

                <div style={{ marginTop: '10px', padding: '10px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)' }}>
                  <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 600 }}>
                    Cautionary Stage: {alert.message || 'Approaching warning threshold.'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                    Riparian Sectors: {alert.affectedVillages?.join(', ') || 'Digha Ghat, Danapur Diara, Fatuha Lowlands'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', borderTop: '1px solid var(--border-card, #1e293b)', paddingTop: '10px' }}>
                <button
                  onClick={() => handleAcknowledge(alert._id)}
                  disabled={alert.status === 'Acknowledged' || updating === alert._id}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: alert.status === 'Acknowledged' ? 'rgba(100, 116, 139, 0.12)' : 'rgba(16, 185, 129, 0.15)',
                    border: alert.status === 'Acknowledged' ? '1px solid rgba(100, 116, 139, 0.25)' : '1px solid rgba(16, 185, 129, 0.3)',
                    color: alert.status === 'Acknowledged' ? '#64748b' : '#10b981',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: alert.status === 'Acknowledged' ? 'not-allowed' : 'pointer',
                    opacity: alert.status === 'Acknowledged' ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  {alert.status === 'Acknowledged' && <Check size={11} />}
                  <span>{alert.status === 'Acknowledged' ? 'Acknowledged' : 'Acknowledge'}</span>
                </button>
                <button
                  onClick={() => setBroadcastModalAlert(alert)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: 'rgba(37, 99, 235, 0.15)',
                    border: '1px solid rgba(37, 99, 235, 0.3)',
                    color: '#3b82f6',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Broadcast
                </button>
                <button
                  onClick={() => handleResolve(alert._id)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#10b981',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. All Incident Records Table */}
      <div style={{
        background: 'var(--bg-card, #131b2a)',
        borderRadius: '14px',
        border: '1px solid var(--border-card, #1e293b)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Filter Tabs + Search */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input, #0e1420)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-card, #1e293b)' }}>
            {['All', 'Critical', 'Warning', 'Resolved'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: tab === t ? 600 : 400,
                  background: tab === t ? '#2563eb' : 'transparent',
                  color: tab === t ? '#fff' : 'var(--text-muted, #94a3b8)',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {t} ({counts[t] ?? 0})
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              placeholder="Search river, district, message…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                height: '32px',
                paddingLeft: '30px',
                paddingRight: '12px',
                borderRadius: '6px',
                background: 'var(--bg-input, #0e1420)',
                border: '1px solid var(--border-card, #1e293b)',
                color: 'var(--text-main, #fff)',
                fontSize: '11px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Incidents Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-card, #1e293b)', color: '#64748b', textTransform: 'uppercase', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>River & Station</th>
                <th style={{ padding: '8px 10px' }}>Severity</th>
                <th style={{ padding: '8px 10px' }}>Water Level</th>
                <th style={{ padding: '8px 10px' }}>Threshold</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
                <th style={{ padding: '8px 10px' }}>Detected At</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(alert => {
                const isCrit = alert.severity === 'Critical';
                const isWarn = alert.severity === 'Warning';
                const isRes = alert.status === 'Resolved';
                return (
                  <tr key={alert._id} style={{ borderBottom: '1px solid var(--border-card, #1e293b)' }}>
                    <td style={{ padding: '10px' }}>
                      <b style={{ color: 'var(--text-main, #fff)', display: 'block' }}>{alert.river || alert.locationName}</b>
                      <span style={{ color: '#64748b', fontSize: '10px' }}>{[alert.district, alert.state].filter(Boolean).join(', ')}</span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        background: isCrit ? 'rgba(239,68,68,0.15)' : isWarn ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                        color: isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#10b981'
                      }}>
                        {alert.severity || 'Warning'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 700, color: isCrit ? '#ef4444' : '#fff' }}>
                      {alert.waterLevel != null ? `${alert.waterLevel}m` : '—'}
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', color: '#94a3b8' }}>
                      {alert.threshold != null ? `${alert.threshold}m` : '—'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ color: isRes ? '#10b981' : alert.status === 'Acknowledged' ? '#38bdf8' : '#f87171', fontWeight: 600 }}>
                        {alert.status || 'Active'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: '#94a3b8' }}>{fmtDate(alert.createdAt)}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {/* Quick Action: Acknowledge */}
                        <button
                          onClick={() => handleAcknowledge(alert._id)}
                          disabled={alert.status === 'Acknowledged' || updating === alert._id}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '5px',
                            background: alert.status === 'Acknowledged' ? 'rgba(100, 116, 139, 0.1)' : 'rgba(16, 185, 129, 0.15)',
                            border: alert.status === 'Acknowledged' ? '1px solid rgba(100, 116, 139, 0.2)' : '1px solid rgba(16, 185, 129, 0.35)',
                            color: alert.status === 'Acknowledged' ? '#64748b' : '#10b981',
                            cursor: alert.status === 'Acknowledged' ? 'not-allowed' : 'pointer',
                            fontSize: '10px',
                            fontWeight: 600,
                            opacity: alert.status === 'Acknowledged' ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title={alert.status === 'Acknowledged' ? 'Incident already acknowledged' : 'Quick Acknowledge Incident'}
                        >
                          <Check size={10} />
                          <span>{alert.status === 'Acknowledged' ? 'Acked' : 'Ack'}</span>
                        </button>

                        {/* Quick Action: Broadcast */}
                        <button
                          onClick={() => setBroadcastModalAlert(alert)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '5px',
                            background: 'rgba(37, 99, 235, 0.15)',
                            border: '1px solid rgba(37, 99, 235, 0.35)',
                            color: '#38bdf8',
                            cursor: 'pointer',
                            fontSize: '10px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title="Quick Broadcast Evacuation Alert to PIN Codes"
                        >
                          <Radio size={10} />
                          <span>Broadcast</span>
                        </button>

                        {/* Details Drawer */}
                        <button
                          onClick={() => setSelectedAlert(alert)}
                          style={{
                            padding: '3px 6px',
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '11px'
                          }}
                          title="Open Comprehensive Incident Handoff Details"
                        >
                          Details &rarr;
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

      {/* Broadcast Modal */}
      {broadcastModalAlert && (
        <div className="modal-overlay" onClick={() => setBroadcastModalAlert(null)}>
          <div className="modal-box" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Radio size={20} style={{ color: '#2563eb' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-main, #fff)' }}>
                Broadcast Public Evacuation Warning
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', marginBottom: '14px' }}>
              Pings public and regional authority subscribers across <b>{broadcastModalAlert.river || broadcastModalAlert.locationName}</b> via telecom pipelines.
            </p>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Broadcast Pipeline Channel</label>
              <select
                value={broadcastChannel}
                onChange={(e) => setBroadcastChannel(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)', fontSize: '12px' }}
              >
                <option value="all">Omnichannel (SMS + WhatsApp + Email)</option>
                <option value="sms">SMS Priority (Twilio / MSG91)</option>
                <option value="whatsapp">WhatsApp Template (WATI / Interakt)</option>
                <option value="email">Email Bulletin (SendGrid / SES)</option>
              </select>
            </div>
            {broadcastStatus && (
              <div style={{ marginBottom: '12px', fontSize: '12px', fontWeight: 600, color: broadcastStatus.startsWith('✓') ? '#10b981' : '#f59e0b' }}>
                {broadcastStatus}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setBroadcastModalAlert(null)} style={{ padding: '8px 14px', borderRadius: '6px', background: 'transparent', border: '1px solid #334155', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleExecuteBroadcast} style={{ padding: '8px 16px', borderRadius: '6px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Execute Broadcast</button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Emergency Response Teams Modal */}
      {dispatchModalAlert && (
        <div className="modal-overlay" onClick={() => setDispatchModalAlert(null)}>
          <div className="modal-box" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Truck size={20} style={{ color: '#ea580c' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-main, #fff)' }}>
                Dispatch Emergency Response Teams
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', marginBottom: '14px' }}>
              Authorize deployment of disaster response units to <b>{dispatchModalAlert.river || dispatchModalAlert.locationName}</b>.
            </p>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Select Task Force Unit</label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)', fontSize: '12px' }}
              >
                <option value="NDRF 1st Battalion (Patgaon)">NDRF 1st Battalion (Patgaon)</option>
                <option value="SDRF River Rescue Unit 3">SDRF River Rescue Unit 3</option>
                <option value="State Civil Defense & Quick Response">State Civil Defense & Quick Response</option>
                <option value="District Fire & Rescue Flotilla">District Fire & Rescue Flotilla</option>
              </select>
            </div>
            {dispatchStatus && (
              <div style={{ marginBottom: '12px', fontSize: '12px', fontWeight: 600, color: '#10b981' }}>{dispatchStatus}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setDispatchModalAlert(null)} style={{ padding: '8px 14px', borderRadius: '6px', background: 'transparent', border: '1px solid #334155', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDispatchTeam} style={{ padding: '8px 16px', borderRadius: '6px', background: '#ea580c', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Authorize Deployment</button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Details Modal */}
      {selectedAlert && (
        <div className="modal-overlay" onClick={() => setSelectedAlert(null)}>
          <div className="modal-box" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {SEV_ICON[selectedAlert.severity] || SEV_ICON.Warning}
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main, #fff)' }}>{selectedAlert.river || selectedAlert.locationName}</span>
              </div>
              <button onClick={() => setSelectedAlert(null)} className="modal-close">✕</button>
            </div>

            <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Incident Diagnosis</span>
              <p style={{ fontSize: '12px', color: 'var(--text-main, #fff)', margin: 0 }}>
                {selectedAlert.message || 'Water level breached danger boundary. Immediate evacuation protocol active.'}
              </p>
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#94a3b8' }}>
                Affected Villages: <b>{selectedAlert.affectedVillages?.join(', ') || 'Palasbari Lowlands, Hajo Riverside, Sualkuchi Ghat'}</b>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                PIN Codes: {selectedAlert.affectedPinCodes?.join(', ') || '781001, 781003, 781030'}
              </div>
            </div>

            {/* SOP Checklist */}
            {(() => {
              const sopItems = getSopItems(selectedAlert.severity);
              const checkedCount = sopItems.filter((_, i) => isSopChecked(selectedAlert._id, i)).length;
              const pct = Math.round((checkedCount / sopItems.length) * 100);
              return (
                <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700 }}>📋 Standard Operating Procedure</span>
                    <span style={{ fontSize: '10px', color: checkedCount === sopItems.length ? '#10b981' : '#94a3b8', fontWeight: 600 }}>
                      {checkedCount} / {sopItems.length} steps complete
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', marginBottom: '10px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: '2px', background: pct === 100 ? '#10b981' : '#f59e0b', transition: 'width 0.3s ease' }} />
                  </div>
                  {sopItems.map((item, i) => {
                    const checked = isSopChecked(selectedAlert._id, i);
                    return (
                      <div key={i} onClick={() => toggleSopCheck(selectedAlert._id, i)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 4px', cursor: 'pointer', borderRadius: '4px', marginBottom: '2px' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: `1px solid ${checked ? '#10b981' : '#475569'}`, background: checked ? '#10b981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {checked && <span style={{ fontSize: '9px', color: '#fff', fontWeight: 700 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: '11px', color: checked ? '#64748b' : 'var(--text-main, #e2e8f0)', textDecoration: checked ? 'line-through' : 'none', transition: 'all 0.2s' }}>
                          {item}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Comms Audit Log Timeline */}
            {(() => {
              const timeline = buildCommsTimeline(selectedAlert);
              return (
                <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', marginBottom: '14px' }}>
                  <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '10px' }}>
                    <Clock size={12} /> Comms Audit Log
                  </span>
                  {timeline.length === 0 ? (
                    <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>No actions recorded yet.</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                      {timeline.map((ev, i) => (
                        <div key={i} style={{ display: 'flex', gap: '10px', paddingBottom: i < timeline.length - 1 ? '8px' : '0' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ev.color, marginTop: '2px', flexShrink: 0 }} />
                            {i < timeline.length - 1 && <div style={{ width: '1px', flex: 1, background: 'rgba(255,255,255,0.08)', marginTop: '3px' }} />}
                          </div>
                          <div style={{ paddingBottom: i < timeline.length - 1 ? '6px' : '0' }}>
                            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '1px' }}>{fmtTs(ev.ts)}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-main, #e2e8f0)' }}>{ev.icon} {ev.label}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Shift Handoff Notes & Audit Trail */}
            <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: '#c084fc', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} /> Shift Handoff Log & Operator Notes
                </span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>
                  {(selectedAlert.operatorNotes?.length || 0)} entries
                </span>
              </div>

              {/* Existing Notes List */}
              <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                {(selectedAlert.operatorNotes && selectedAlert.operatorNotes.length > 0) ? (
                  selectedAlert.operatorNotes.map((note, idx) => (
                    <div key={idx} style={{ padding: '6px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '11px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '10px', marginBottom: '2px' }}>
                        <b>{note.author}</b>
                        <span>{new Date(note.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ color: 'var(--text-main, #fff)' }}>{note.text}</div>
                    </div>
                  ))
                ) : (
                  <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>No shift notes recorded yet. Add handoff instructions below.</span>
                )}
              </div>

              {/* Add Note Input */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="e.g. Contacted DC Office at 16:30, police barricades active."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddShiftNote()}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-card, #131b2a)',
                    border: '1px solid var(--border-card, #334155)',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                />
                <button
                  onClick={handleAddShiftNote}
                  disabled={addingNote || !newNoteText.trim()}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '6px',
                    background: '#7c3aed',
                    border: 'none',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Log Note
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Generate Official PDF Incident Report */}
              <button
                onClick={() => generateIncidentPDFReport(selectedAlert)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Export official NDRF / CWC certified Incident Audit PDF"
              >
                <FileText size={14} />
                <span>Generate Incident PDF</span>
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedAlert.status !== 'Resolved' && (
                  <button
                    onClick={() => handleResolve(selectedAlert._id)}
                    style={{ padding: '8px 14px', borderRadius: '6px', background: '#10b981', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Mark Resolved
                  </button>
                )}
                <button
                  onClick={() => setSelectedAlert(null)}
                  style={{ padding: '8px 14px', borderRadius: '6px', background: 'transparent', border: '1px solid #334155', color: '#fff', fontSize: '12px', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscribers Modal */}
      {showSubscribersModal && (
        <div className="modal-overlay" onClick={() => setShowSubscribersModal(false)}>
          <div className="modal-box" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-main, #fff)' }}>Alert Subscribers ({subscribers.length})</h3>
              <button onClick={() => setShowSubscribersModal(false)} className="modal-close">✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
              {subscribers.map(sub => (
                <div key={sub._id} style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <b style={{ fontSize: '12px', color: 'var(--text-main, #fff)' }}>{sub.name}</b>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{sub.phone || 'Browser Web Push'} • PIN: {sub.pinCode || '781001'} • {sub.region} • [{sub.channel.toUpperCase()}]</div>
                  </div>
                  <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>Active</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trigger Flood Alert Station Selector & Safety Confirmation Modal */}
      {showSimulateConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowSimulateConfirmModal(false)}>
          <div className="modal-box" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: '#ef4444' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-main, #fff)' }}>Manual Emergency Trigger</h3>
                <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>Multi-River Emergency Simulation &amp; Grid Broadcast</span>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-sub, #94a3b8)', lineHeight: 1.5, margin: '0 0 14px 0' }}>
              Select a target river monitoring station to simulate an active surge breach. This will propagate across the WebSocket grid, update live dashboard cards, and trigger evacuation broadcast workflows.
            </p>

            {/* Target River Station Dropdown */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-sub, #94a3b8)', display: 'block', marginBottom: '5px', fontWeight: 600 }}>
                Target River Monitoring Station:
              </label>
              <select
                value={selectedSimLocationId}
                onChange={(e) => {
                  const locId = e.target.value;
                  setSelectedSimLocationId(locId);
                  const found = locations.find(l => l._id === locId);
                  if (found) {
                    setSimWaterLevel(String((Number(found.criticalThreshold || 4.0) + 0.8).toFixed(1)));
                  }
                }}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  background: 'var(--bg-input, #0e1420)',
                  border: '1px solid var(--border-card, #334155)',
                  color: 'var(--text-main, #fff)',
                  fontSize: '12px',
                  fontWeight: 600,
                  outline: 'none'
                }}
              >
                {locations.length > 0 ? (
                  locations.map(loc => (
                    <option key={loc._id} value={loc._id}>
                      {loc.river || loc.name} — {loc.district ? `${loc.district}, ` : ''}{loc.state || 'India'} (Danger Mark: {loc.criticalThreshold || 4.0}m)
                    </option>
                  ))
                ) : (
                  <option value="">Brahmaputra River — Assam</option>
                )}
              </select>
            </div>

            {/* Severity & Breach Water Level */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-sub, #94a3b8)', display: 'block', marginBottom: '5px', fontWeight: 600 }}>
                  Alert Severity:
                </label>
                <select
                  value={simSeverity}
                  onChange={(e) => setSimSeverity(e.target.value)}
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-input, #0e1420)',
                    border: '1px solid var(--border-card, #334155)',
                    color: simSeverity === 'Critical' ? '#ef4444' : '#f59e0b',
                    fontSize: '12px',
                    fontWeight: 700,
                    outline: 'none'
                  }}
                >
                  <option value="Critical">Critical (Evacuation)</option>
                  <option value="Warning">Warning (Advisory)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-sub, #94a3b8)', display: 'block', marginBottom: '5px', fontWeight: 600 }}>
                  Breach Water Level (m):
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="15.0"
                  value={simWaterLevel}
                  onChange={(e) => setSimWaterLevel(e.target.value)}
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-input, #0e1420)',
                    border: '1px solid var(--border-card, #334155)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Authorization Confirmation Guard */}
            <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-main, #e2e8f0)', display: 'block', marginBottom: '6px' }}>
                Type <b style={{ color: '#ef4444', letterSpacing: '1px' }}>CONFIRM</b> below to authorize broadcast:
              </label>
              <input
                type="text"
                placeholder="CONFIRM"
                value={confirmInputText}
                onChange={(e) => setConfirmInputText(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'var(--bg-card, #131b2a)',
                  border: confirmInputText === 'CONFIRM' ? '1px solid #10b981' : '1px solid var(--border-card, #334155)',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => {
                  setShowSimulateConfirmModal(false);
                  setConfirmInputText('');
                }}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  background: 'transparent',
                  border: '1px solid var(--border-card, #334155)',
                  color: 'var(--text-main, #cbd5e1)',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSimulateConfirmModal(false);
                  setConfirmInputText('');
                  handleSimulateAlert();
                }}
                disabled={confirmInputText !== 'CONFIRM' || simulating}
                style={{
                  padding: '7px 16px',
                  borderRadius: '6px',
                  background: confirmInputText === 'CONFIRM' ? '#dc2626' : 'rgba(220, 38, 38, 0.3)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: confirmInputText === 'CONFIRM' ? 'pointer' : 'not-allowed',
                  opacity: confirmInputText === 'CONFIRM' ? 1 : 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Zap size={13} />
                <span>Execute Emergency Alert</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
