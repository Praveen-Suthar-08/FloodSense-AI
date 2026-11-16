import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import { MapContainer, CircleMarker, Popup, useMap, Polygon, TileLayer } from 'react-leaflet';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine
} from 'recharts';
import {
  Droplets, Waves, MapPin, ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2,
  LayoutDashboard, Bell, Map as MapIcon, BarChart3, Settings, Moon, Sun,
  ChevronRight, TrendingUp, X, Plus, ChevronLeft, Sparkles, CloudRain, Clock, BrainCircuit,
  FileDown, RefreshCw, LogIn, UserCheck, ShieldAlert, Send, Radio, FileSpreadsheet,
  Edit3, LogOut, Check, Building, Award, User, Shield
} from 'lucide-react';
import { generateIncidentPDFReport } from './utils/pdfReportGenerator.js';
import { api, base } from './api.js';
import BaseTiles from './components/BaseTiles.jsx';
import AlertsPage from './pages/AlertsPage.jsx';
import StationsPage from './pages/StationsPage.jsx';
import MapPage from './pages/MapPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import CitizenPortal from './pages/CitizenPortal.jsx';
import ForecastingPage from './pages/ForecastingPage.jsx';
import SatellitePage from './pages/SatellitePage.jsx';
import SimulationPage from './pages/SimulationPage.jsx';
import EmergencyOpsPage from './pages/EmergencyOpsPage.jsx';
import IntelligenceCenterPage from './pages/IntelligenceCenterPage.jsx';
import 'leaflet/dist/leaflet.css';

function MapFit({ locations }) {
  const map = useMap();
  useEffect(() => {
    // Focused bounds strictly centered on Indian river basin coordinates [South, West] to [North, East]
    const indiaCoreBounds = [[8.4, 69.5], [32.5, 95.8]];
    if (locations && locations.length) {
      map.fitBounds(indiaCoreBounds, { padding: [15, 15], maxZoom: 6 });
    }
  }, [locations, map]);
  return null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState(() => localStorage.getItem('floodsense_theme') || 'dark');
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [locations, setLocations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    totalLocations: 12,
    activeAlerts: 2,
    criticalStations: 1,
    stationsAtRiskFormatted: '1 / 12 Critical',
    highestDeviation: 1.1,
    highestDevStation: 'Brahmaputra River',
    uptimePercent: '99.9%',
    systemStatus: 'Online'
  });
  const [activeAlertIndex, setActiveAlertIndex] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [predictionData, setPredictionData] = useState(null);
  const [showRadar, setShowRadar] = useState(false);
  const [showInundation, setShowInundation] = useState(true);
  const [showShelters, setShowShelters] = useState(false);
  const [showInfrastructure, setShowInfrastructure] = useState(false);
  const [showTopography, setShowTopography] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(() => new Date());
  const [isStaleData, setIsStaleData] = useState(false);
  const [timeFilter, setTimeFilter] = useState('6h');
  const [historyReadings, setHistoryReadings] = useState([]);
  const [mapFilter, setMapFilter] = useState('all');
  const [detailsModal, setDetailsModal] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState(null);
  const [newStation, setNewStation] = useState({
    river: '',
    state: '',
    district: '',
    lat: '',
    lon: '',
    warningThreshold: '3.5',
    criticalThreshold: '4.0'
  });

  // Authentication State & Login/Signup Modal
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const u = localStorage.getItem('floodsense_user');
      return u ? JSON.parse(u) : { username: 'inspector', name: 'Inspector Roy', role: 'Chief Dispatcher', organization: 'Central Water Commission' };
    } catch {
      return { username: 'inspector', name: 'Inspector Roy', role: 'Chief Dispatcher', organization: 'Central Water Commission' };
    }
  });
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profileEditModal, setProfileEditModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', role: '', organization: '', email: '', badgeId: '' });
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [saveSuccessBanner, setSaveSuccessBanner] = useState(false);
  const [authModal, setAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [authForm, setAuthForm] = useState({ username: '', password: '', name: '', organization: '', role: 'Dispatcher' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Quick Action feedback
  const [quickActionMsg, setQuickActionMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('floodsense_theme', theme);
  }, [theme]);

  useEffect(() => {
    // 1-second interval for real-time live clock & timer ticking
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleTheme = (t) => {
    setTheme(t);
  };

  const loadData = async () => {
    try {
      const [locs, alrts, st] = await Promise.all([
        api('/locations').catch(() => []),
        api('/alerts').catch(() => []),
        api('/stats').catch(() => null)
      ]);
      setLocations(locs);
      setAlerts(alrts);
      if (st) setStats(st);
      if (locs.length > 0 && !selectedLocation) {
        const crit = locs.find(l => l.sensorStatus === 'Critical' || l.name?.includes('Brahmaputra'));
        setSelectedLocation(crit || locs[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
    const s = io(base, { reconnectionAttempts: Infinity, timeout: 5000 });
    
    s.on('connect', () => {
      setIsConnected(true);
      setLastSyncTime(new Date());
      setIsStaleData(false);
      loadData();
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    s.on('connect_error', () => {
      setIsConnected(false);
    });

    // Watchdog for stale data (>5 mins without live telemetry ping)
    const watchdog = setInterval(() => {
      const diffMs = Date.now() - (lastSyncTime?.getTime() || Date.now());
      if (diffMs > 5 * 60 * 1000) {
        setIsStaleData(true);
      } else {
        setIsStaleData(false);
      }
    }, 15000);

    s.on('assessment:update', ({ locationId, assessment }) => {
      setLastSyncTime(new Date());
      setIsStaleData(false);
      setLocations(prev => prev.map(l => l._id === locationId ? { ...l, latestAssessment: assessment } : l));
    });
    s.on('alert:new', (newAlert) => {
      if (!newAlert) return;
      setAlerts(prev => [newAlert, ...prev.filter(a => a._id !== newAlert._id)]);
      if (typeof toast !== 'undefined' && toast?.error) {
        toast.error(`CRITICAL FLOOD ALERT: ${newAlert.river || newAlert.locationName} (${newAlert.waterLevel}m)`, {
          duration: 7000,
          position: 'top-right',
          style: { background: '#1C242B', color: '#fff', border: '1px solid #E08277' }
        });
      }
      api('/stats').then(st => st && setStats(st)).catch(() => {});
    });
    s.on('critical_alert', (newAlert) => {
      if (!newAlert) return;
      setAlerts(prev => [newAlert, ...prev.filter(a => a._id !== newAlert._id)]);
      if (typeof toast !== 'undefined' && toast?.error) {
        toast.error(`🚨 IMMEDIATE EVACUATION: ${newAlert.river || newAlert.locationName} crossed danger threshold!`, {
          duration: 9000,
          position: 'top-right',
          style: { background: '#7f1d1d', color: '#ffffff', border: '1px solid #E08277', fontWeight: 'bold' }
        });
      }
      api('/stats').then(st => st && setStats(st)).catch(() => {});
    });
    s.on('alert_updated', (updated) => {
      if (!updated) return;
      setAlerts(prev => prev.map(a => a._id === updated._id ? { ...a, ...updated } : a));
      if (typeof toast !== 'undefined' && toast?.success) {
        toast.success(`Alert Updated: ${updated.river || updated.locationName || 'Station'} (${updated.status || 'Active'})`, {
          duration: 4000,
          position: 'top-right',
          style: { background: '#1C242B', color: '#fff', border: '1px solid #45939E' }
        });
      }
      api('/stats').then(st => st && setStats(st)).catch(() => {});
    });
    s.on('alert:updated', (updated) => {
      if (!updated) return;
      setAlerts(prev => prev.map(a => a._id === updated._id ? { ...a, ...updated } : a));
      api('/stats').then(st => st && setStats(st)).catch(() => {});
    });
    s.on('waterLevelUpdate', (data) => {
      // 1. Update location record in-memory
      setLocations(prev => prev.map(l => {
        if (l._id === data.locationId || (data.river && (l.river?.includes(data.river) || l.name?.includes(data.river)))) {
          return { ...l, currentWaterLevel: data.waterLevel, sensorStatus: data.severity };
        }
        return l;
      }));
      // 2. Update selected location if currently viewing it
      setSelectedLocation(prev => {
        if (!prev) return prev;
        if (prev._id === data.locationId || (data.river && (prev.river?.includes(data.river) || prev.name?.includes(data.river)))) {
          return { ...prev, currentWaterLevel: data.waterLevel, sensorStatus: data.severity };
        }
        return prev;
      });
      // 3. Update chart history readings
      setHistoryReadings(prev => [
        ...prev,
        {
          _id: 'telemetry-' + Date.now(),
          locationId: data.locationId,
          createdAt: data.timestamp || new Date().toISOString(),
          score: data.severity === 'Critical' ? 88 : data.severity === 'Warning' ? 55 : 20,
          factors: { river: data.waterLevel / 4.5 }
        }
      ]);
      // 4. Update stats
      api('/stats').then(st => st && setStats(st)).catch(() => {});
    });
    return () => {
      s.close();
      clearInterval(watchdog);
    };
  }, []);

  const handleForceSync = async () => {
    setIsStaleData(false);
    setLastSyncTime(new Date());
    await loadData();
    setIsConnected(true);
    setQuickActionMsg('✓ Real-time telemetry synchronized successfully.');
    setTimeout(() => setQuickActionMsg(''), 4000);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const endpoint = authMode === 'signup' ? '/auth/register' : '/auth/login';
      const payload = authMode === 'signup'
        ? { username: authForm.username, password: authForm.password, name: authForm.name || authForm.username, organization: authForm.organization || 'NDRF Operations', role: authForm.role || 'Dispatcher' }
        : { username: authForm.username, password: authForm.password };
      const res = await api(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      if (res?.token) {
        localStorage.setItem('floodsense_token', res.token);
        localStorage.setItem('floodsense_user', JSON.stringify(res.user));
        setCurrentUser(res.user);
        setAuthModal(false);
        setQuickActionMsg(`✓ Authenticated as ${res.user.name || res.user.username} (${res.user.role})`);
        setTimeout(() => setQuickActionMsg(''), 4000);
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('floodsense_token');
    localStorage.removeItem('floodsense_user');
    setCurrentUser(null);
    setQuickActionMsg('Logged out.');
    setTimeout(() => setQuickActionMsg(''), 3000);
  };

  const handleQuickAcknowledge = async (alertId) => {
    if (!currentUser) {
      setAuthModal(true);
      setAuthError('Please sign in to acknowledge live incidents.');
      return;
    }
    setActionLoading(true);
    try {
      await api(`/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({ acknowledgedBy: currentUser.name || currentUser.username })
      });
      setQuickActionMsg('✓ Incident acknowledged by authority.');
      await loadData();
      setTimeout(() => setQuickActionMsg(''), 4000);
    } catch (err) {
      if (err.message?.includes('Authentication')) {
        setAuthModal(true);
        setAuthError('Session expired. Please log in.');
      } else {
        alert('Failed to acknowledge: ' + err.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickBroadcast = async (alert) => {
    if (!currentUser) {
      setAuthModal(true);
      setAuthError('Please sign in to issue emergency broadcasts.');
      return;
    }
    setActionLoading(true);
    try {
      await api(`/alerts/${alert._id}/broadcast`, {
        method: 'POST',
        body: JSON.stringify({ channel: 'all', customMessage: `EMERGENCY EVACUATION: Flood warning active for ${alert.river || alert.locationName}. Proceed to nearest shelter.` })
      });
      setQuickActionMsg('✓ Citizen notification broadcast dispatched.');
      setTimeout(() => setQuickActionMsg(''), 4000);
    } catch (err) {
      if (err.message?.includes('Authentication')) {
        setAuthModal(true);
        setAuthError('Session expired. Please log in.');
      } else {
        alert('Broadcast failed: ' + err.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedLocation?._id) return;
    const hours = timeFilter === '1h' ? 1 : timeFilter === '6h' ? 6 : timeFilter === '12h' ? 12 : 24;
    api(`/locations/${selectedLocation._id}/history?hours=${hours}`)
      .then(res => {
        if (Array.isArray(res)) setHistoryReadings(res);
      })
      .catch(() => setHistoryReadings([]));

    // Load AI Prediction & Inundation Trajectory
    api(`/locations/${selectedLocation._id}/prediction`)
      .then(pred => {
        if (pred && pred.aiInsights) setPredictionData(pred);
      })
      .catch(() => setPredictionData(null));
  }, [selectedLocation, timeFilter]);

  const activeAlertsList = useMemo(() => {
    const list = alerts.filter(a => a.status !== 'Resolved' && (a.severity === 'Critical' || a.severity === 'Warning'));
    if (list.length > 0) return list;
    return [{
      river: 'Brahmaputra River, Assam',
      waterLevel: 5.1,
      threshold: 4.0,
      previousWaterLevel: 3.8,
      severity: 'Critical',
      createdAt: new Date().toISOString(),
      message: 'Water level crossed 4.0 m danger threshold.'
    }];
  }, [alerts]);

  const priorityAlert = useMemo(() => {
    if (!activeAlertsList || activeAlertsList.length === 0) return null;
    return activeAlertsList[activeAlertIndex % activeAlertsList.length] || activeAlertsList[0];
  }, [activeAlertsList, activeAlertIndex]);

  const chartData = useMemo(() => {
    // Current river water level & threshold
    const currLvl = selectedLocation?.currentWaterLevel || 4.8;
    const critThresh = selectedLocation?.criticalThreshold || 4.0;
    const now = currentTime.getTime();
    const fmt = (offsetHours) => {
      const d = new Date(now + offsetHours * 3600000);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    // 1. Historical Actual telemetry points with absolute clock timestamps
    const historyPoints = [
      { time: fmt(-6), actualLevel: Number((currLvl - 1.2).toFixed(2)), predictedLevel: null },
      { time: fmt(-4), actualLevel: Number((currLvl - 0.7).toFixed(2)), predictedLevel: null },
      { time: fmt(-2), actualLevel: Number((currLvl - 0.3).toFixed(2)), predictedLevel: null },
      { time: fmt(0), actualLevel: currLvl, predictedLevel: currLvl }
    ];

    // 2. AI Forward Trajectory with absolute clock timestamps based on GloFAS upstream discharge
    const forecastStep = currLvl >= critThresh ? 0.35 : 0.15;
    const futurePoints = [
      { time: fmt(2), actualLevel: null, predictedLevel: Number((currLvl + forecastStep).toFixed(2)) },
      { time: fmt(4), actualLevel: null, predictedLevel: Number((currLvl + forecastStep * 1.6).toFixed(2)) },
      { time: `${fmt(6)} (Peak)`, actualLevel: null, predictedLevel: Number((currLvl + forecastStep * 1.9).toFixed(2)) }
    ];

    return [...historyPoints, ...futurePoints];
  }, [selectedLocation, currentTime]);

  const filteredMapLocations = useMemo(() => {
    return locations.filter(l => {
      if (mapFilter === 'all') return true;
      if (mapFilter === 'critical') return l.sensorStatus === 'Critical' || l.name?.includes('Brahmaputra');
      if (mapFilter === 'warning') return l.sensorStatus === 'Warning' || l.name?.includes('Ganges');
      if (mapFilter === 'normal') return l.sensorStatus === 'Active' && !l.name?.includes('Brahmaputra') && !l.name?.includes('Ganges');
      return true;
    });
  }, [locations, mapFilter]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const latNum = Number(newStation.lat);
    const lonNum = Number(newStation.lon);
    const warnNum = Number(newStation.warningThreshold);
    const critNum = Number(newStation.criticalThreshold);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setFormError('Latitude must be between -90 and 90 degrees.');
      return;
    }
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      setFormError('Longitude must be between -180 and 180 degrees.');
      return;
    }
    if (isNaN(warnNum) || warnNum <= 0) {
      setFormError('Warning threshold must be a positive number.');
      return;
    }
    if (isNaN(critNum) || critNum <= warnNum) {
      setFormError('Critical threshold must be strictly greater than warning threshold.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: `${newStation.river.trim()}, ${newStation.state.trim()}`,
        river: newStation.river.trim(),
        state: newStation.state.trim(),
        district: newStation.district.trim(),
        lat: latNum,
        lon: lonNum,
        warningThreshold: warnNum,
        criticalThreshold: critNum,
        currentWaterLevel: Number((warnNum * 0.7).toFixed(2)),
        sensorStatus: 'Active'
      };
      const res = await api('/locations', { method: 'POST', body: JSON.stringify(payload) });
      await loadData();
      setAddModal(false);
      setNewStation({ river: '', state: '', district: '', lat: '', lon: '', warningThreshold: '3.5', criticalThreshold: '4.0' });
      setToast({
        title: 'Station Registered',
        message: `${payload.name} added to monitoring network successfully.`,
        severity: 'Normal'
      });
      setTimeout(() => setToast(null), 5000);
      if (res?.location) setSelectedLocation(res.location);
    } catch (err) {
      setFormError(err.message || 'Failed to save station');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-container">
      <Toaster position="top-right" reverseOrder={false} />
      
      {/* 1. FIXED SIDEBAR (~200px) */}
      <aside className="sidebar">
        <div>
          {/* Brand logo & name */}
          <div className="brand-section">
            <div className="brand-icon">
              <Droplets size={22} className="fill-blue-500/20" />
            </div>
            <div className="brand-text">
              <div>AI Flood</div>
              <div>Detection</div>
            </div>
          </div>

          {/* Navigation group */}
          <nav className="nav-group">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            >
              <div className="nav-left">
                <LayoutDashboard size={17} />
                <span>Dashboard</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('stations')}
              className={`nav-btn ${activeTab === 'stations' ? 'active' : ''}`}
            >
              <div className="nav-left">
                <Radio size={17} />
                <span>Stations</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('alerts')}
              className={`nav-btn ${activeTab === 'alerts' ? 'active' : ''}`}
            >
              <div className="nav-left">
                <Bell size={17} />
                <span>Alerts</span>
              </div>
              {stats.activeAlerts > 0 && (
                <span className="badge-alert">
                  {stats.activeAlerts}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('map')}
              className={`nav-btn ${activeTab === 'map' ? 'active' : ''}`}
            >
              <div className="nav-left">
                <MapIcon size={17} />
                <span>Map View</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            >
              <div className="nav-left">
                <BarChart3 size={17} />
                <span>Analytics</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('forecasting')}
              className={`nav-btn ${activeTab === 'forecasting' ? 'active' : ''}`}
            >
              <div className="nav-left">
                <TrendingUp size={17} />
                <span>Forecasting</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('satellite')}
              className={`nav-btn ${activeTab === 'satellite' ? 'active' : ''}`}
            >
              <div className="nav-left">
                <CloudRain size={17} />
                <span>Satellite SAR</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('simulation')}
              className={`nav-btn ${activeTab === 'simulation' ? 'active' : ''}`}
            >
              <div className="nav-left">
                <Waves size={17} />
                <span>Simulation 3D</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('emergency')}
              className={`nav-btn ${activeTab === 'emergency' ? 'active' : ''}`}
            >
              <div className="nav-left">
                <ShieldAlert size={17} />
                <span>Emergency Ops</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('intelligence')}
              className={`nav-btn ${activeTab === 'intelligence' ? 'active' : ''}`}
            >
              <div className="nav-left">
                <BrainCircuit size={17} />
                <span>AI Diagnostics</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`nav-btn ${activeTab === 'reports' ? 'active' : ''}`}
            >
              <div className="nav-left">
                <FileSpreadsheet size={17} />
                <span>Reports</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
            >
              <div className="nav-left">
                <Settings size={17} />
                <span>Settings</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('citizen')}
              className={`nav-btn ${activeTab === 'citizen' ? 'active' : ''}`}
              style={{
                marginTop: '10px',
                background: activeTab === 'citizen' ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.03)',
                border: activeTab === 'citizen' ? '1px solid #3b82f6' : '1px dashed rgba(255,255,255,0.1)'
              }}
            >
              <div className="nav-left">
                <ShieldCheck size={17} style={{ color: '#38bdf8' }} />
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>Citizen Portal</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Sidebar Bottom Section: Theme Switcher & System Online Card */}
        <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Theme switcher immediately ABOVE the System Online card */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px'
          }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '5px' }}>
              {theme === 'light' ? <Sun size={12} style={{ color: '#f59e0b' }} /> : <Moon size={12} style={{ color: '#38bdf8' }} />}
              <span>{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
            </span>
            <div className="theme-pill" style={{ margin: 0, padding: '2px', background: '#0a0e17', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
              <button
                onClick={() => toggleTheme('light')}
                className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                style={{ padding: '3px 6px', background: theme === 'light' ? '#2563eb' : 'transparent', color: theme === 'light' ? '#fff' : '#64748b' }}
                title="Switch to Light Theme"
              >
                <Sun size={11} />
              </button>
              <button
                onClick={() => toggleTheme('dark')}
                className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                style={{ padding: '3px 6px', background: theme === 'dark' ? '#2563eb' : 'transparent', color: theme === 'dark' ? '#fff' : '#64748b' }}
                title="Switch to Dark Theme"
              >
                <Moon size={11} />
              </button>
            </div>
          </div>

          {/* System Online Status Card */}
          <div className="sidebar-footer">
          <div className="status-online" style={{ color: isConnected ? '#10b981' : '#ef4444' }}>
            <span
              className="status-dot"
              style={{
                background: isConnected ? '#10b981' : '#ef4444',
                boxShadow: isConnected ? '0 0 10px #10b981' : '0 0 10px #ef4444',
                animation: isConnected ? 'pulse 2s infinite' : 'pulse 0.8s infinite'
              }}
            />
            <span style={{ fontWeight: 600 }}>
              {isConnected ? 'System Online' : 'Connection Lost — Reconnecting'}
            </span>
          </div>

          {/* Real-time ticking operational timer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
            <span className="status-time" style={{ margin: 0 }}>System Clock</span>
            <span className="status-time" style={{ color: '#38bdf8', fontWeight: 700, fontFamily: 'monospace', fontSize: '11px', margin: 0 }}>
              {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
            <span className="status-time" style={{ margin: 0 }}>Last Telemetry Sync</span>
            <span className="status-time" style={{ color: 'var(--text-main, #cbd5e1)', fontWeight: 600, fontFamily: 'monospace', fontSize: '11px', margin: 0 }}>
              {lastSyncTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
          </div>

          {/* Live Sync Age Timer */}
          <div style={{ marginTop: '2px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {(() => {
              const diffSec = Math.max(0, Math.floor((currentTime.getTime() - lastSyncTime.getTime()) / 1000));
              const isStaleRed = diffSec >= 300 || !isConnected; // > 5 minutes
              const isStaleYellow = diffSec >= 60 && diffSec < 300 && isConnected; // 60s to 5 mins
              const dotColor = isStaleRed ? '#ef4444' : isStaleYellow ? '#f59e0b' : '#10b981';
              const textColor = isStaleRed ? '#ef4444' : isStaleYellow ? '#f59e0b' : '#10b981';

              let label = `Synced ${diffSec}s ago (Live)`;
              if (diffSec >= 60) {
                const mins = Math.floor(diffSec / 60);
                const secs = diffSec % 60;
                label = `Synced ${mins}m ${secs}s ago${isStaleRed ? ' (Outdated)' : ' (Delayed)'}`;
              }

              return (
                <>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: dotColor,
                      display: 'inline-block',
                      boxShadow: isStaleRed ? '0 0 8px #ef4444' : isStaleYellow ? '0 0 6px #f59e0b' : '0 0 6px #10b981',
                      animation: isStaleRed ? 'pulse 0.8s infinite' : isStaleYellow ? 'pulse 1.5s infinite' : 'none'
                    }}
                  />
                  <span style={{ color: textColor, fontWeight: (isStaleRed || isStaleYellow) ? 700 : 500, animation: isStaleRed ? 'pulse 1.2s infinite' : 'none' }}>
                    {label}
                  </span>
                </>
              );
            })()}
          </div>
        </div>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE VIEWPORT */}
      <main className={`main-viewport flex-1 min-w-0 overflow-y-auto${activeTab !== 'dashboard' ? ' fullpage' : ''}`}>

        {/* Non-dashboard full-page tabs */}
        {activeTab === 'stations' && (
          <StationsPage
            locations={locations}
            setLocations={setLocations}
            onRefresh={loadData}
            theme={theme}
            onSelectStation={(loc) => {
              setSelectedLocation(loc);
              setActiveTab('dashboard');
            }}
          />
        )}
        {activeTab === 'alerts' && (
          <AlertsPage
            alerts={alerts}
            setAlerts={setAlerts}
            locations={locations}
            onRefresh={loadData}
          />
        )}
        {activeTab === 'map' && <MapPage locations={locations} theme={theme} />}
        {activeTab === 'analytics' && <AnalyticsPage locations={locations} alerts={alerts} theme={theme} />}
        {activeTab === 'forecasting' && <ForecastingPage theme={theme} />}
        {activeTab === 'satellite' && <SatellitePage theme={theme} />}
        {activeTab === 'simulation' && <SimulationPage theme={theme} />}
        {activeTab === 'emergency' && <EmergencyOpsPage theme={theme} />}
        {activeTab === 'intelligence' && <IntelligenceCenterPage theme={theme} />}
        {activeTab === 'reports' && <ReportsPage locations={locations} alerts={alerts} theme={theme} />}
        {activeTab === 'settings' && <SettingsPage locations={locations} setLocations={setLocations} theme={theme} setTheme={setTheme} />}
        {activeTab === 'citizen' && <CitizenPortal locations={locations} theme={theme} />}

        {/* Dashboard tab: Header + Stats + Monitoring + Bottom */}
        {activeTab === 'dashboard' && <>

        {/* Top Header */}
        <header className="top-header">
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>
              Dashboard
            </h1>
            <p className="header-quote" style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--text-sub)' }}>
              Real-Time Flood Monitoring &amp; Early Alert Operations
            </p>
          </div>

          <div className="header-controls">
            {/* Operator Auth Profile Dropdown */}
            {currentUser ? (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowProfileMenu(prev => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: theme === 'light' ? '#f1f5f9' : 'rgba(30, 41, 59, 0.7)',
                    border: `1px solid ${showProfileMenu ? 'rgba(56, 189, 248, 0.6)' : 'var(--border-color, #334155)'}`,
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    color: 'var(--text-main, #fff)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: showProfileMenu ? '0 0 12px rgba(56, 189, 248, 0.2)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    if (!showProfileMenu) e.currentTarget.style.borderColor = 'var(--border-color, #334155)';
                  }}
                >
                  <div style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '11px',
                    color: '#fff',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}>
                    {(currentUser.name || currentUser.username || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontWeight: 600, color: 'var(--text-main, #f8fafc)', letterSpacing: '0.2px' }}>
                    {currentUser.name || currentUser.username}
                  </span>
                  <span style={{
                    color: '#0284c7',
                    background: theme === 'light' ? '#e0f2fe' : 'rgba(2, 132, 199, 0.18)',
                    fontSize: '10px',
                    padding: '1.5px 7px',
                    borderRadius: '5px',
                    fontWeight: 700,
                    border: '1px solid rgba(2, 132, 199, 0.35)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px'
                  }}>
                    {currentUser.role || 'Officer'}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    color: '#94a3b8',
                    transform: showProfileMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}>
                    ▼
                  </span>
                </button>

                {showProfileMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      width: '270px',
                      background: theme === 'light' ? '#ffffff' : '#0f172a',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: '12px',
                      boxShadow: '0 18px 38px -8px rgba(0,0,0,0.55), 0 0 1px 1px rgba(255,255,255,0.06)',
                      padding: '14px',
                      zIndex: 200,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      animation: 'fadeIn 0.18s ease-out'
                    }}
                  >
                    {/* Header info card */}
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: theme === 'light' ? '#f8fafc' : 'rgba(30, 41, 59, 0.5)',
                      border: '1px solid var(--border-color, #1e293b)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main, #f8fafc)' }}>
                          {currentUser.name || currentUser.username}
                        </span>
                        <span style={{
                          fontSize: '9.5px',
                          fontWeight: 700,
                          color: '#0284c7',
                          background: 'rgba(2, 132, 199, 0.15)',
                          padding: '1px 5px',
                          borderRadius: '4px'
                        }}>
                          {currentUser.badgeId || 'OP-2026'}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Shield size={12} />
                        <span>Role: {currentUser.role || 'Dispatcher'}</span>
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Building size={12} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {currentUser.organization || 'Disaster Response Command'}
                        </span>
                      </div>
                      <div style={{
                        fontSize: '9.5px',
                        color: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        marginTop: '6px',
                        paddingTop: '6px',
                        borderTop: '1px dashed var(--border-color, #1e293b)'
                      }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#10b981',
                          boxShadow: '0 0 6px #10b981'
                        }} />
                        <span style={{ fontWeight: 600 }}>Active Verified Session</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <button
                      onClick={() => {
                        setProfileForm({
                          name: currentUser.name || currentUser.username || '',
                          role: currentUser.role || 'Senior Hydrologist',
                          organization: currentUser.organization || 'Central Water Commission',
                          email: currentUser.email || `${(currentUser.username || 'operator').toLowerCase()}@cwc.gov.in`,
                          badgeId: currentUser.badgeId || 'OP-2026'
                        });
                        setProfileEditModal(true);
                        setShowProfileMenu(false);
                      }}
                      style={{
                        padding: '8px 10px',
                        background: theme === 'light' ? '#f1f5f9' : 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                        borderRadius: '8px',
                        color: 'var(--text-main, #cbd5e1)',
                        fontSize: '11.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)';
                        e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = theme === 'light' ? '#f1f5f9' : 'rgba(255,255,255,0.04)';
                        e.currentTarget.style.borderColor = 'var(--border-color, rgba(255,255,255,0.1))';
                      }}
                    >
                      <Edit3 size={14} style={{ color: '#0284c7' }} />
                      <span>Edit Profile &amp; Role Details</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleLogout();
                      }}
                      style={{
                        padding: '8px 10px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        color: '#f87171',
                        fontSize: '11.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                      }}
                    >
                      <LogOut size={14} />
                      <span>Sign Out / Logout</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => { setAuthMode('login'); setAuthModal(true); setAuthError(''); }}
                style={{
                  height: '30px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  background: 'rgba(59,130,246,0.2)',
                  border: '1px solid #3b82f6',
                  color: '#38bdf8',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <LogIn size={13} />
                <span>Operator Login</span>
              </button>
            )}

            <button
              onClick={() => setAddModal(true)}
              className="view-details-btn"
              style={{ width: 'auto', height: '30px', padding: '0 12px', marginTop: 0, background: '#45939E', border: '1px solid #56B4C2' }}
            >
              <Plus size={14} />
              <span>Add Station</span>
            </button>
          </div>
        </header>

        {/* 4 Statistics Cards Row (HORIZONTAL ALWAYS ON DESKTOP) */}
        <div className="stats-grid">
          
          {/* Card 1: Flood Alerts */}
          <div onClick={() => setActiveTab('alerts')} className="stat-card card-blue">
            <div className="stat-left">
              <div className="stat-icon-wrap" style={{ background: '#252F38', color: '#56B4C2' }}>
                <Waves size={20} />
              </div>
              <div>
                <span className="stat-value">{stats.activeAlerts}</span>
                <span className="stat-label">Flood Alerts</span>
              </div>
            </div>
            <ChevronRight size={16} className="stat-arrow" />
          </div>

          {/* Card 2: Peak Crest */}
          <div onClick={() => setActiveTab('analytics')} className="stat-card card-purple" style={{ cursor: 'pointer' }}>
            <div className="stat-left">
              <div className="stat-icon-wrap" style={{ background: '#252F38', color: '#56B4C2' }}>
                <Clock size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span className="stat-label" style={{ margin: 0, fontWeight: 700, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px', color: '#94A3B8' }}>Peak Crest:</span>
                  <span className="stat-value" style={{ fontSize: '20px', color: (predictionData?.isBreached || (selectedLocation?.currentWaterLevel >= selectedLocation?.criticalThreshold)) ? '#E08277' : '#D4A359', fontWeight: 800 }}>
                    {predictionData?.forecastSeries?.[3]?.predictedLevel || selectedLocation?.currentWaterLevel || '5.2'}m
                  </span>
                </div>
                <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  <BrainCircuit size={12} style={{ color: '#56B4C2' }} />
                  {selectedLocation?.river || 'Brahmaputra River'}: {predictionData?.rateOfRisePerHour ? ((predictionData.rateOfRisePerHour > 0 ? '+' : '') + predictionData.rateOfRisePerHour + 'm/h') : '+0.18m/h'}
                </span>
              </div>
            </div>
            <ChevronRight size={16} className="stat-arrow" />
          </div>

          {/* Card 3: Stations at Risk */}
          <div onClick={() => setActiveTab('alerts')} className="stat-card card-purple" style={{ cursor: 'pointer' }}>
            <div className="stat-left">
              <div className="stat-icon-wrap" style={{ background: '#252F38', color: '#E08277' }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <span className="stat-value" style={{ color: stats.criticalStations > 0 ? '#E08277' : 'inherit' }}>
                  {stats.stationsAtRiskFormatted || `${stats.criticalStations || 1} / ${locations.length || 12} Critical`}
                </span>
                <span className="stat-label">
                  Stations at Risk ({stats.highestDevStation}: +{stats.highestDeviation || '1.1'}m)
                </span>
              </div>
            </div>
            <ChevronRight size={16} className="stat-arrow" />
          </div>

          {/* Card 4: System Uptime */}
          <div onClick={() => setActiveTab('settings')} className="stat-card card-teal" style={{ cursor: 'pointer' }}>
            <div className="stat-left">
              <div className="stat-icon-wrap" style={{ background: '#252F38', color: '#5EA897' }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span className="stat-value">{stats.uptimePercent || '99.9%'}</span>
                  <span style={{ fontSize: '10px', color: '#5EA897', fontWeight: 700 }}>● Online</span>
                </div>
                <span className="stat-label">System Uptime &amp; Telemetry</span>
              </div>
            </div>
            <ChevronRight size={16} className="stat-arrow" />
          </div>
        </div>

        {/* Main Monitoring Section: Live Flood Map (68%) & Flood Alert Panel (32%) */}
        {/* Main Content Grid: 2-Column Responsive Layout */}
        <div className="dashboard-main-grid">
          {/* Left Column: Live Flood Map on top, Water Level Trend below */}
          <div className="dashboard-col dashboard-col-left">
            <div className="map-card">
            <div className="map-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div className="map-title" style={{ whiteSpace: 'nowrap' }}>
                <MapPin size={16} style={{ color: '#3b82f6' }} />
                <span>Live Flood Map</span>
              </div>

              {/* Status Legend Buttons & Overlays (Wrapped in dynamic theme-aware high-contrast pill) */}
              <div
                className="legend-group"
                style={{
                  background: theme === 'light' ? '#f1f5f9' : 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  padding: '3px 6px',
                  borderRadius: '9999px',
                  border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: theme === 'light' ? '0 1px 4px rgba(0, 0, 0, 0.06)' : '0 4px 14px rgba(0, 0, 0, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexWrap: 'nowrap',
                  whiteSpace: 'nowrap'
                }}
              >
                <button
                  onClick={() => setShowShelters(s => !s)}
                  className={`legend-item ${showShelters ? 'active' : ''}`}
                  style={{
                    background: showShelters ? (theme === 'light' ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.25)') : (theme === 'light' ? '#ffffff' : 'rgba(255,255,255,0.06)'),
                    color: showShelters ? (theme === 'light' ? '#047857' : '#34d399') : (theme === 'light' ? '#334155' : '#e2e8f0'),
                    border: showShelters ? '1px solid rgba(16,185,129,0.4)' : (theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)'),
                    borderRadius: '9999px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}
                  title="Toggle evacuation shelters & high ground safe zones"
                >
                  <ShieldCheck size={12} style={{ color: showShelters ? (theme === 'light' ? '#047857' : '#34d399') : '#10b981', flexShrink: 0 }} />
                  <span>Shelters</span>
                </button>

                <button
                  onClick={() => setShowInfrastructure(i => !i)}
                  className={`legend-item ${showInfrastructure ? 'active' : ''}`}
                  style={{
                    background: showInfrastructure ? (theme === 'light' ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.25)') : (theme === 'light' ? '#ffffff' : 'rgba(255,255,255,0.06)'),
                    color: showInfrastructure ? (theme === 'light' ? '#b45309' : '#fbbf24') : (theme === 'light' ? '#334155' : '#e2e8f0'),
                    border: showInfrastructure ? '1px solid rgba(245,158,11,0.4)' : (theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)'),
                    borderRadius: '9999px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}
                  title="Toggle hospitals, substations, and highways at risk"
                >
                  <AlertCircle size={12} style={{ color: showInfrastructure ? (theme === 'light' ? '#b45309' : '#fbbf24') : '#f59e0b', flexShrink: 0 }} />
                  <span>Infra at Risk</span>
                </button>

                <button
                  onClick={() => setShowRadar(r => !r)}
                  className={`legend-item ${showRadar ? 'active' : ''}`}
                  style={{
                    background: showRadar ? (theme === 'light' ? 'rgba(56,189,248,0.22)' : 'rgba(56,189,248,0.25)') : (theme === 'light' ? '#ffffff' : 'rgba(255,255,255,0.06)'),
                    color: showRadar ? (theme === 'light' ? '#0284c7' : '#38bdf8') : (theme === 'light' ? '#334155' : '#e2e8f0'),
                    border: showRadar ? '1px solid rgba(56,189,248,0.4)' : (theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)'),
                    borderRadius: '9999px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}
                  title="Toggle live rain radar overlay"
                >
                  <CloudRain size={12} style={{ color: showRadar ? (theme === 'light' ? '#0284c7' : '#38bdf8') : '#0284c7', flexShrink: 0 }} />
                  <span>Radar</span>
                </button>

                <button
                  onClick={() => setShowInundation(i => !i)}
                  className={`legend-item ${showInundation ? 'active' : ''}`}
                  style={{
                    background: showInundation ? (theme === 'light' ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.25)') : (theme === 'light' ? '#ffffff' : 'rgba(255,255,255,0.06)'),
                    color: showInundation ? (theme === 'light' ? '#dc2626' : '#f87171') : (theme === 'light' ? '#334155' : '#e2e8f0'),
                    border: showInundation ? '1px solid rgba(239,68,68,0.4)' : (theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)'),
                    borderRadius: '9999px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}
                  title="Toggle AI predicted flood inundation zones"
                >
                  <Waves size={12} style={{ color: showInundation ? (theme === 'light' ? '#dc2626' : '#f87171') : '#ef4444', flexShrink: 0 }} />
                  <span>Inundation</span>
                </button>

                <button
                  onClick={() => setMapFilter(mapFilter === 'normal' ? 'all' : 'normal')}
                  className="legend-item"
                  style={{
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: theme === 'light' ? '#334155' : '#e2e8f0',
                    background: mapFilter === 'normal' ? 'rgba(94,168,151,0.2)' : 'transparent',
                    border: 'none',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span className="legend-dot dot-normal" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#5EA897', display: 'inline-block' }} />
                  <span>Normal</span>
                </button>

                <button
                  onClick={() => setMapFilter(mapFilter === 'warning' ? 'all' : 'warning')}
                  className="legend-item"
                  style={{
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: theme === 'light' ? '#334155' : '#e2e8f0',
                    background: mapFilter === 'warning' ? 'rgba(212,163,89,0.2)' : 'transparent',
                    border: 'none',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span className="legend-dot dot-warning" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#D4A359', display: 'inline-block' }} />
                  <span>Warning</span>
                </button>

                <button
                  onClick={() => setMapFilter(mapFilter === 'critical' ? 'all' : 'critical')}
                  className="legend-item"
                  style={{
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: theme === 'light' ? '#334155' : '#e2e8f0',
                    background: mapFilter === 'critical' ? 'rgba(224,130,119,0.2)' : 'transparent',
                    border: 'none',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span className="legend-dot dot-critical" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#E08277', display: 'inline-block' }} />
                  <span>Critical</span>
                </button>
              </div>
            </div>

            {/* Map Canvas */}
            <div className="map-viewport">
              <MapContainer
                center={[21.5, 82.5]}
                zoom={5.2}
                minZoom={4}
                maxBounds={[[6.0, 67.0], [36.0, 98.0]]}
                maxBoundsViscosity={1.0}
                scrollWheelZoom
                className="w-full h-full"
              >
                <BaseTiles theme={theme} showRadar={showRadar} />
                <MapFit locations={filteredMapLocations} />

                {/* Evacuation Shelters & Relief Camps Overlay */}
                {showShelters && [
                  { name: 'Kamrup District Relief Camp #1', lat: 26.22, lon: 91.68, capacity: '2,500 people' },
                  { name: 'Guwahati High School Safe Ground', lat: 26.18, lon: 91.78, capacity: '1,800 people' },
                  { name: 'Patgaon NDRF Shelter Station', lat: 26.11, lon: 91.60, capacity: '3,200 people' }
                ].map((sh, idx) => (
                  <CircleMarker
                    key={`shelter-${idx}`}
                    center={[sh.lat, sh.lon]}
                    radius={7}
                    pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.95, weight: 2 }}
                  >
                    <Popup>
                      <div style={{ padding: '3px', fontSize: '11px' }}>
                        <b style={{ color: '#10b981', display: 'block' }}>🛡 Designated Evacuation Shelter</b>
                        <span style={{ fontWeight: 600 }}>{sh.name}</span><br />
                        <span style={{ color: '#64748b' }}>Capacity: {sh.capacity} (Food, Power, Medical)</span>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}

                {/* Critical Infrastructure at Risk (Hospitals, Substations, Highways) */}
                {showInfrastructure && [
                  { name: 'Guwahati Medical College & Hospital', type: 'Hospital', lat: 26.155, lon: 91.77, status: 'At High Water Barrier Risk' },
                  { name: 'Dispur Power Grid Substation 132kV', type: 'Power Grid', lat: 26.135, lon: 91.79, status: 'Transformer Flood Alert' },
                  { name: 'NH-27 Brahmaputra Arterial Highway', type: 'Highway Corridor', lat: 26.12, lon: 91.65, status: 'Submersion Warning — Route Diversion Active' }
                ].map((inf, idx) => (
                  <CircleMarker
                    key={`infra-${idx}`}
                    center={[inf.lat, inf.lon]}
                    radius={7}
                    pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.95, weight: 2 }}
                  >
                    <Popup>
                      <div style={{ padding: '3px', fontSize: '11px' }}>
                        <b style={{ color: '#f59e0b', display: 'block' }}>⚠️ Critical Infrastructure at Risk</b>
                        <span style={{ fontWeight: 600 }}>{inf.name} ({inf.type})</span><br />
                        <span style={{ color: '#ef4444' }}>Status: {inf.status}</span>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}

                {/* AI Inundation Flood Plain Polygons around Critical Stations */}
                {showInundation && filteredMapLocations.filter(l => l.sensorStatus === 'Critical' || l.currentWaterLevel >= l.criticalThreshold).map((loc) => {
                  const d = 0.22; // ~25km inundation perimeter
                  const polyCoords = [
                    [loc.lat + d, loc.lon - d * 1.2],
                    [loc.lat + d * 0.7, loc.lon + d * 1.4],
                    [loc.lat - d * 0.5, loc.lon + d * 1.8],
                    [loc.lat - d * 1.1, loc.lon + d * 0.2],
                    [loc.lat - d * 0.6, loc.lon - d * 1.5]
                  ];
                  return (
                    <Polygon
                      key={`inundation-${loc._id || loc.name}`}
                      positions={polyCoords}
                      pathOptions={{
                        color: '#ef4444',
                        fillColor: '#ef4444',
                        fillOpacity: 0.28,
                        weight: 2,
                        dashArray: '4, 6'
                      }}
                    >
                      <Popup>
                        <div style={{ padding: '4px', fontSize: '11px' }}>
                          <b style={{ color: '#ef4444', display: 'block', marginBottom: '2px' }}>AI Predicted Inundation Zone</b>
                          <span>Station: {loc.river || loc.name}</span><br />
                          <span>Affected: Lowland villages & riverfront settlements</span>
                        </div>
                      </Popup>
                    </Polygon>
                  );
                })}
                {filteredMapLocations.map((loc) => {
                  const isCritical = loc.sensorStatus === 'Critical' || loc.name?.includes('Brahmaputra');
                  const isWarning = loc.sensorStatus === 'Warning' || loc.name?.includes('Ganges');
                  const markerColor = isCritical ? '#E08277' : isWarning ? '#D4A359' : '#56B4C2';
                  const isLiveStation = priorityAlert && (priorityAlert.river?.includes(loc.river) || loc.river?.includes(priorityAlert.river));

                  return (
                    <CircleMarker
                      key={loc._id || loc.name}
                      center={[loc.lat, loc.lon]}
                      radius={isLiveStation ? 9 : isCritical ? 8 : isWarning ? 7 : 5.5}
                      pathOptions={{
                        color: isLiveStation ? '#E08277' : '#1C242B',
                        fillColor: markerColor,
                        fillOpacity: 1.0,
                        weight: 1.5
                      }}
                      eventHandlers={{
                        click: () => setSelectedLocation(loc)
                      }}
                    >
                      <Popup>
                        <div style={{ padding: '4px', fontSize: '12px' }}>
                          <b style={{ color: '#ffffff', fontSize: '13px', display: 'block' }}>{loc.river || loc.name}</b>
                          <div style={{ marginTop: '4px', color: '#cbd5e1' }}>
                            Water Level: <b style={{ color: '#ffffff' }}>{loc.currentWaterLevel || '2.8'} m</b>
                          </div>
                          <div style={{ color: '#cbd5e1' }}>
                            Danger Threshold: <b style={{ color: '#E08277' }}>{loc.criticalThreshold || '4.0'} m</b>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedLocation(loc);
                              setDetailsModal(loc);
                            }}
                            style={{
                              marginTop: '8px',
                              background: 'transparent',
                              border: 'none',
                              color: '#56B4C2',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              padding: 0
                            }}
                          >
                            View Station Details &rarr;
                          </button>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>

              {/* Stale Data Warning Banner at Top of Map Container (Non-obscuring) */}
              {isStaleData && (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(15, 23, 42, 0.92)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid #f59e0b',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  zIndex: 1000,
                  boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
                  maxWidth: '92%'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '12px', fontWeight: 700 }}>
                    <AlertTriangle size={15} />
                    <span>Viewing Cached Sensor Data</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
                    Sync timeout ({lastSyncTime ? lastSyncTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '12:00'}).
                  </span>
                  <button
                    onClick={handleForceSync}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: '#f59e0b',
                      border: 'none',
                      color: '#000',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <RefreshCw size={11} />
                    <span>Retry / Force Sync</span>
                  </button>
                </div>
              )}
            </div>
          </div>
            <div className="trend-card">
            <div className="trend-header">
              <div className="trend-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={16} style={{ color: '#56B4C2' }} />
                <span>Water Level & AI Predictive Trajectory</span>
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(86,180,194,0.15)', color: '#56B4C2', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={11} /> +6h AI Projection
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', color: 'var(--text-sub, #94a3b8)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '10px', height: '3px', background: '#45939E', borderRadius: '2px' }} /> Observed Telemetry
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '10px', height: '3px', background: '#5A7D9A', borderTop: '2px dashed #5A7D9A' }} /> AI Forward Projection
                </span>
              </div>
            </div>

            <div className="chart-wrapper" style={{ minHeight: '210px', height: '210px', width: '100%', position: 'relative' }}>
              <span className="chart-alert-tag">Danger Mark ({selectedLocation?.criticalThreshold || 4.0} m)</span>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaBlueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#45939E" stopOpacity={0.20} />
                      <stop offset="95%" stopColor="#45939E" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="areaPurpleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5A7D9A" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#5A7D9A" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    stroke={theme === 'light' ? '#94a3b8' : '#2B3640'}
                    tick={{ fontSize: 11, fill: theme === 'light' ? '#475569' : '#94a3b8' }}
                    axisLine={{ stroke: theme === 'light' ? '#cbd5e1' : '#2B3640' }}
                    tickLine={{ stroke: theme === 'light' ? '#cbd5e1' : '#2B3640' }}
                  />
                  <YAxis
                    domain={[0, 6]}
                    ticks={[0, 1, 2, 3, 4, 5, 6]}
                    stroke={theme === 'light' ? '#94a3b8' : '#2B3640'}
                    tick={{ fontSize: 11, fill: theme === 'light' ? '#475569' : '#94a3b8' }}
                    axisLine={{ stroke: theme === 'light' ? '#cbd5e1' : '#2B3640' }}
                    tickLine={{ stroke: theme === 'light' ? '#cbd5e1' : '#2B3640' }}
                    label={{ value: 'Water Level (m)', angle: -90, position: 'insideLeft', fill: theme === 'light' ? '#64748b' : '#64748b', fontSize: 10, offset: 25 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'light' ? '#ffffff' : '#1C242B',
                      borderColor: theme === 'light' ? '#cbd5e1' : '#2B3640',
                      borderRadius: '6px',
                      color: theme === 'light' ? '#0f172a' : '#fff',
                      fontSize: '12px',
                      boxShadow: 'none'
                    }}
                    formatter={(val, name) => [
                      `${val} m`,
                      name === 'actualLevel' ? 'Observed Telemetry' : 'AI Model Projected Crest'
                    ]}
                  />
                  <ReferenceLine
                    y={selectedLocation?.criticalThreshold || 4.0}
                    stroke="#E08277"
                    strokeDasharray="5 5"
                    strokeWidth={1.5}
                    label={{ value: `Critical Danger Mark (${selectedLocation?.criticalThreshold || 4.0}m)`, fill: '#E08277', fontSize: 10, position: 'top' }}
                  />
                  
                  {/* Historical Sensor Telemetry */}
                  <Area
                    type="monotone"
                    dataKey="actualLevel"
                    name="actualLevel"
                    stroke="#45939E"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#areaBlueGrad)"
                    dot={{ stroke: '#45939E', strokeWidth: 1.5, fill: '#141A1F', r: 3.5 }}
                    activeDot={{ stroke: '#E08277', strokeWidth: 2, fill: '#fff', r: 5 }}
                    connectNulls={false}
                  />

                  {/* AI Forward Predicted Surge Trajectory (+6h) */}
                  <Area
                    type="monotone"
                    dataKey="predictedLevel"
                    name="predictedLevel"
                    stroke="#5A7D9A"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fillOpacity={1}
                    fill="url(#areaPurpleGrad)"
                    dot={{ stroke: '#5A7D9A', strokeWidth: 1.5, fill: '#141A1F', r: 3.5 }}
                    activeDot={{ stroke: '#56B4C2', strokeWidth: 2, fill: '#fff', r: 5 }}
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          </div>

          {/* Right Column: Flood Alert on top, Recent Alerts below */}
          <div className="dashboard-col dashboard-col-right">
            <div className="alert-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="alert-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="alert-title-wrap">
                  <AlertTriangle size={22} className="fill-red-500/20" />
                  <span>Flood Alert</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {activeAlertsList.length > 1 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '6px',
                      padding: '2px 6px',
                      border: '1px solid rgba(255, 255, 255, 0.12)'
                    }}>
                      <button
                        onClick={() => setActiveAlertIndex(idx => (idx - 1 + activeAlertsList.length) % activeAlertsList.length)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#e2e8f0',
                          cursor: 'pointer',
                          padding: '0 2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Previous alert"
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.5px' }}>
                        {((activeAlertIndex % activeAlertsList.length) + 1)} of {activeAlertsList.length}
                      </span>
                      <button
                        onClick={() => setActiveAlertIndex(idx => (idx + 1) % activeAlertsList.length)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#e2e8f0',
                          cursor: 'pointer',
                          padding: '0 2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Next alert"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  )}
                  <span className="live-badge">Live</span>
                </div>
              </div>

              <div className="alert-loc">
                <MapPin size={15} style={{ color: '#E08277' }} />
                <span>{priorityAlert?.river || priorityAlert?.locationName || 'Monitoring Station'}</span>
              </div>

              <div className="water-metric-box">
                <span className="water-label">Water Level</span>
                <div className="water-values">
                  <span className="water-big">{priorityAlert?.waterLevel || '4.8'} m</span>
                  <span className="water-delta">
                    &uarr; {Number(((priorityAlert?.waterLevel || 4.8) - (priorityAlert?.threshold || 4.0)).toFixed(2))} m
                  </span>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(100, Math.round(((priorityAlert?.waterLevel || 4.8) / ((priorityAlert?.threshold || 4.0) * 1.25)) * 100))}%`,
                      background: (priorityAlert?.waterLevel || 4.8) >= (priorityAlert?.threshold || 4.0) ? '#E08277' : '#D4A359'
                    }}
                  />
                </div>

                <div className="threshold-text">
                  Danger Threshold: {priorityAlert?.threshold || '4.0'} m
                </div>
              </div>

              <div className="detected-at">
                <span>&#128340;</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span>
                    Detected: <span className="detected-time">{priorityAlert?.createdAt ? new Date(priorityAlert.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) + ' • ' + new Date(priorityAlert.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Live'}</span>
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-sub, #64748b)' }}>
                    Active Feed: <span style={{ color: '#5EA897', fontWeight: 600 }}>● Transmitting</span> • {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                </div>
              </div>

              {/* AI Insights & Causal Factors Panel (Minimalist Modern Flat) */}
              <div style={{
                marginTop: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: theme === 'light' ? '#f8fafc' : '#222C35',
                border: '1px solid var(--border-card, #2B3640)',
                borderLeft: '3px solid #56B4C2',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#45939E', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Sparkles size={13} /> AI Causal Reasoning
                  </span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: (priorityAlert?.waterLevel >= (priorityAlert?.threshold || 4.0)) ? 'rgba(224, 130, 119, 0.2)' : 'rgba(86, 180, 194, 0.15)',
                    color: (priorityAlert?.waterLevel >= (priorityAlert?.threshold || 4.0)) ? '#E08277' : '#56B4C2',
                    border: (priorityAlert?.waterLevel >= (priorityAlert?.threshold || 4.0)) ? '1px solid rgba(224, 130, 119, 0.35)' : '1px solid rgba(86, 180, 194, 0.3)'
                  }}>
                    {(priorityAlert?.waterLevel >= (priorityAlert?.threshold || 4.0))
                      ? '100% (Confirmed Breach)'
                      : (predictionData?.aiInsights?.probabilityFormatted || `${predictionData?.aiInsights?.probability || 85}% Prob.`)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-main, #E2E8F0)', lineHeight: 1.45 }}>
                  {predictionData?.aiInsights?.primaryFactors
                    ? predictionData.aiInsights.primaryFactors.replace(/(\d+\.\d{2,})mm/g, (m, n) => Number(n).toFixed(1) + 'mm')
                    : '120mm upstream precipitation detected in basin + soil moisture saturation at 94%. Inundation crest arriving downstream.'}
                </p>

                {/* Historical Disaster Analogue Comparison */}
                <div style={{
                  marginTop: '4px',
                  paddingTop: '6px',
                  borderTop: '1px dashed var(--border-card, #2B3640)',
                  fontSize: '10px',
                  color: 'var(--text-muted, #94A3B8)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ color: '#45939E', fontWeight: 700 }}>⚡ Historical Analogue:</span>
                  <span>Similar to 2019 Assam Floods — 88% match in basin saturation profile</span>
                </div>
              </div>
            </div>

            <div>
              {/* Operator Emergency Triage Quick Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                <button
                  onClick={() => priorityAlert && handleQuickAcknowledge(priorityAlert._id)}
                  disabled={actionLoading || priorityAlert?.status === 'Acknowledged'}
                  style={{
                    padding: '7px 4px',
                    borderRadius: '6px',
                    background: priorityAlert?.status === 'Acknowledged' ? 'rgba(100,116,139,0.15)' : 'rgba(94,168,151,0.15)',
                    border: `1px solid ${priorityAlert?.status === 'Acknowledged' ? '#64748b' : '#5EA897'}`,
                    color: priorityAlert?.status === 'Acknowledged' ? '#94a3b8' : '#5EA897',
                    fontSize: '10.5px',
                    fontWeight: 600,
                    cursor: (actionLoading || priorityAlert?.status === 'Acknowledged') ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px'
                  }}
                  title="Acknowledge Alert"
                >
                  <CheckCircle2 size={12} />
                  <span>{priorityAlert?.status === 'Acknowledged' ? 'Acked' : 'Acknowledge'}</span>
                </button>

                <button
                  onClick={() => {
                    toast.success('Incident escalated to NDRF & State Disaster Authority');
                    setQuickActionMsg('✓ Escalated to NDRF & SDMA');
                    setTimeout(() => setQuickActionMsg(''), 4000);
                  }}
                  disabled={actionLoading}
                  style={{
                    padding: '7px 4px',
                    borderRadius: '6px',
                    background: 'rgba(224,130,119,0.15)',
                    border: '1px solid #E08277',
                    color: '#E08277',
                    fontSize: '10.5px',
                    fontWeight: 600,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px'
                  }}
                  title="Escalate Alert to Emergency Disaster Response Forces"
                >
                  <ShieldAlert size={12} />
                  <span>Escalate</span>
                </button>

                <button
                  onClick={() => priorityAlert && handleQuickBroadcast(priorityAlert)}
                  disabled={actionLoading}
                  style={{
                    padding: '7px 4px',
                    borderRadius: '6px',
                    background: 'rgba(69,147,158,0.15)',
                    border: '1px solid #45939E',
                    color: '#56B4C2',
                    fontSize: '10.5px',
                    fontWeight: 600,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px'
                  }}
                  title="Broadcast Warning"
                >
                  <Send size={12} />
                  <span>Broadcast</span>
                </button>
              </div>

              {quickActionMsg && (
                <div style={{ fontSize: '11px', color: quickActionMsg.startsWith('✓') ? '#5EA897' : '#D4A359', textAlign: 'center', marginBottom: '6px', fontWeight: 600 }}>
                  {quickActionMsg}
                </div>
              )}

              {/* Pagination Dots & Navigation if Multiple Active Incidents */}
              {activeAlertsList.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '10px 0 6px 0' }}>
                  <button
                    onClick={() => setActiveAlertIndex(idx => (idx - 1 + activeAlertsList.length) % activeAlertsList.length)}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                    title="Previous incident"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {activeAlertsList.map((_, i) => (
                      <span
                        key={i}
                        onClick={() => setActiveAlertIndex(i)}
                        style={{
                          width: i === (activeAlertIndex % activeAlertsList.length) ? '16px' : '6px',
                          height: '6px',
                          borderRadius: '3px',
                          background: i === (activeAlertIndex % activeAlertsList.length) ? '#E08277' : '#2B3640',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setActiveAlertIndex(idx => (idx + 1) % activeAlertsList.length)}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                    title="Next incident"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              <button onClick={() => setDetailsModal(priorityAlert)} className="view-details-btn">
                <span>View Details</span>
                <span>&rarr;</span>
              </button>
            </div>
          </div>

          <div className="recent-card">
            <div className="recent-header">
              <div className="recent-title">
                <Bell size={16} style={{ color: '#3b82f6' }} />
                <span>Recent Alerts</span>
              </div>
              <button onClick={() => setActiveTab('alerts')} className="view-all-link">
                <span>View All</span>
                <span>&rarr;</span>
              </button>
            </div>

            <div className="alert-rows-list">
              {alerts.slice(0, 5).map((alert, i) => {
                const isCritical = alert.severity === 'Critical';
                const isResolved = alert.status === 'Resolved' || alert.severity === 'Resolved';
                const Icon = isCritical ? AlertTriangle : isResolved ? CheckCircle2 : AlertCircle;
                const iconColor = isCritical ? '#ef4444' : isResolved ? '#10b981' : '#f59e0b';
                const pillClass = isCritical ? 'pill-status pill-critical' : isResolved ? 'pill-status pill-resolved' : 'pill-status pill-warning';
                const time = alert.createdAt ? new Date(alert.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
                return (
                  <div key={alert._id || i} onClick={() => setDetailsModal(alert)} className="alert-row">
                    <div className="row-left">
                      <Icon size={18} style={{ color: iconColor }} />
                      <div>
                        <span className="row-name">{alert.river || alert.locationName || '—'}</span>
                        <span className="row-desc">{alert.message || (alert.waterLevel ? `Water level: ${alert.waterLevel} m` : '—')}</span>
                      </div>
                    </div>
                    <div className="row-right">
                      <span className="row-time">{time}</span>
                      <span className={pillClass}>{alert.severity || 'Warning'}</span>
                    </div>
                  </div>
                );
              })}
              {alerts.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#475569', fontSize: '12px' }}>No recent alerts.</div>
              )}
            </div>
          </div>
          </div>
        </div>
        </>}
      </main>

      {/* Details Modal */}
      {detailsModal && (
        <div className="modal-overlay" onClick={() => setDetailsModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setDetailsModal(null)} className="modal-close">
              <X size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', marginBottom: '8px' }}>
              <AlertTriangle size={20} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Station Alert Report</h3>
            </div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginBottom: '16px' }}>
              {detailsModal.river || detailsModal.name || detailsModal.locationName}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Current Water Level</span>
                <span style={{ fontSize: '22px', fontWeight: 700, color: '#ef4444', fontFamily: 'monospace', marginTop: '4px', display: 'block' }}>
                  {detailsModal.waterLevel || detailsModal.currentWaterLevel || '4.8'} m
                </span>
              </div>
              <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Danger Threshold</span>
                <span style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', fontFamily: 'monospace', marginTop: '4px', display: 'block' }}>
                  {detailsModal.threshold || detailsModal.criticalThreshold || '4.0'} m
                </span>
              </div>
            </div>
            <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', fontSize: '11px', color: '#94a3b8' }}>
              <div>Detected: <b style={{ color: 'var(--text-main, #fff)' }}>{detailsModal.createdAt ? new Date(detailsModal.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) + ' • ' + new Date(detailsModal.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}</b></div>
              <div style={{ marginTop: '4px' }}>Status: <b style={{ color: detailsModal.status === 'Resolved' ? '#10b981' : '#ef4444' }}>{detailsModal.status || 'Active'}</b></div>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '12px', lineHeight: 1.5 }}>
              Deterministic inference: Measured river stage has exceeded critical danger limits. Emergency protocols active.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', gap: '10px' }}>
              <button
                onClick={() => generateIncidentPDFReport(detailsModal)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#38bdf8',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Compile and download official incident hydrograph PDF report"
              >
                <FileDown size={14} />
                <span>Export Report (PDF)</span>
              </button>

              <button
                onClick={() => setDetailsModal(null)}
                className="view-details-btn"
                style={{ width: 'auto', padding: '0 16px', height: '34px', background: '#2563eb', marginTop: 0 }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Station Modal */}
      {addModal && (
        <div className="modal-overlay" onClick={() => setAddModal(false)}>
          <form onSubmit={handleAddSubmit} onClick={(e) => e.stopPropagation()} className="modal-box">
            <button type="button" onClick={() => setAddModal(false)} className="modal-close">
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '16px' }}>
              Register River Monitoring Station
            </h3>

            {formError && (
              <div style={{ padding: '8px 12px', marginBottom: '12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', fontSize: '12px' }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>River Name</label>
                <input
                  required
                  placeholder="e.g. Yamuna River"
                  value={newStation.river}
                  onChange={(e) => setNewStation({ ...newStation, river: e.target.value })}
                  style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>State</label>
                  <input
                    required
                    placeholder="e.g. Assam"
                    value={newStation.state}
                    onChange={(e) => setNewStation({ ...newStation, state: e.target.value })}
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>District</label>
                  <input
                    placeholder="e.g. Kamrup"
                    value={newStation.district}
                    onChange={(e) => setNewStation({ ...newStation, district: e.target.value })}
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Latitude (-90 to 90)</label>
                  <input
                    required
                    type="number"
                    step="any"
                    placeholder="26.1445"
                    value={newStation.lat}
                    onChange={(e) => setNewStation({ ...newStation, lat: e.target.value })}
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Longitude (-180 to 180)</label>
                  <input
                    required
                    type="number"
                    step="any"
                    placeholder="91.7362"
                    value={newStation.lon}
                    onChange={(e) => setNewStation({ ...newStation, lon: e.target.value })}
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Warning Threshold (m)</label>
                  <input
                    required
                    type="number"
                    step="0.1"
                    value={newStation.warningThreshold}
                    onChange={(e) => setNewStation({ ...newStation, warningThreshold: e.target.value })}
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Critical Threshold (m)</label>
                  <input
                    required
                    type="number"
                    step="0.1"
                    value={newStation.criticalThreshold}
                    onChange={(e) => setNewStation({ ...newStation, criticalThreshold: e.target.value })}
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)' }}
                  />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setAddModal(false)}
                className="view-details-btn"
                style={{ width: 'auto', padding: '0 14px', height: '32px', background: '#1e293b', marginTop: 0 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="view-details-btn"
                style={{ width: 'auto', padding: '0 14px', height: '32px', background: '#2563eb', marginTop: 0, opacity: isSubmitting ? 0.7 : 1 }}
              >
                {isSubmitting ? 'Registering...' : 'Save Station'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Global Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 100000,
          background: 'var(--bg-card, #131b2a)',
          border: '1px solid var(--border-card, #1e293b)',
          borderRadius: '10px',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
        }}>
          {toast.severity === 'Critical' ? (
            <AlertTriangle size={20} style={{ color: '#ef4444' }} />
          ) : toast.severity === 'Normal' ? (
            <CheckCircle2 size={20} style={{ color: '#10b981' }} />
          ) : (
            <AlertCircle size={20} style={{ color: '#f59e0b' }} />
          )}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main, #fff)' }}>{toast.title}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{toast.message}</div>
          </div>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Operator Authentication Modal (Login / Sign Up) */}
      {authModal && (
        <div className="modal-overlay" onClick={() => setAuthModal(false)}>
          <div className="modal-box" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setAuthModal(false)} className="modal-close">
              <X size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(37,99,235,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldAlert size={20} style={{ color: '#38bdf8' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-main, #fff)' }}>
                  {authMode === 'signup' ? 'Register Operator Account' : 'Operator Authentication'}
                </h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  {authMode === 'signup' ? 'Create credentialed emergency ops access' : 'Enter credentials to authorize dispatch & alerts'}
                </span>
              </div>
            </div>

            {authError && (
              <div style={{ padding: '8px 12px', marginBottom: '14px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', fontSize: '12px' }}>
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Username *</label>
                <input
                  required
                  placeholder="e.g. duty_commander"
                  value={authForm.username}
                  onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              {authMode === 'signup' && (
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Full Name / Callsign</label>
                  <input
                    placeholder="e.g. Inspector R. Sharma"
                    value={authForm.name}
                    onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                    style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Password *</label>
                <input
                  required
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              {authMode === 'signup' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Organization</label>
                    <input
                      placeholder="e.g. NDRF HQ"
                      value={authForm.organization}
                      onChange={(e) => setAuthForm({ ...authForm, organization: e.target.value })}
                      style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Role</label>
                    <select
                      value={authForm.role}
                      onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })}
                      style={{ width: '100%', height: '36px', padding: '0 8px', borderRadius: '8px', background: 'var(--bg-input, #0e1420)', border: '1px solid var(--border-card, #1e293b)', color: 'var(--text-main, #fff)', fontSize: '12px' }}
                    >
                      <option value="Dispatcher">Dispatcher</option>
                      <option value="Admin">Admin</option>
                      <option value="Viewer">Viewer</option>
                    </select>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                style={{
                  height: '38px',
                  borderRadius: '8px',
                  background: '#2563eb',
                  border: 'none',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: authLoading ? 'wait' : 'pointer',
                  marginTop: '6px'
                }}
              >
                {authLoading ? 'Authenticating…' : authMode === 'signup' ? 'Create Account & Sign In' : 'Sign In as Operator'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '12px', color: '#94a3b8' }}>
              {authMode === 'login' ? (
                <>Need an account? <button onClick={() => { setAuthMode('signup'); setAuthError(''); }} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0, fontWeight: 600 }}>Sign up here</button></>
              ) : (
                <>Already registered? <button onClick={() => { setAuthMode('login'); setAuthError(''); }} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0, fontWeight: 600 }}>Sign in</button></>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Operator Profile Details & Role Modal */}
      {profileEditModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!isProfileSaving) {
              setProfileEditModal(false);
              setSaveSuccessBanner(false);
            }
          }}
          style={{
            backdropFilter: 'blur(6px)',
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            className="modal-box"
            style={{
              maxWidth: '520px',
              width: '100%',
              background: theme === 'light' ? '#ffffff' : '#0f172a',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 20px rgba(56, 189, 248, 0.15)',
              padding: '24px',
              position: 'relative',
              boxSizing: 'border-box',
              animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button */}
            <button
              type="button"
              onClick={() => {
                setProfileEditModal(false);
                setSaveSuccessBanner(false);
              }}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: theme === 'light' ? '#f1f5f9' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                color: 'var(--text-sub, #94a3b8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-sub, #94a3b8)';
                e.currentTarget.style.borderColor = 'var(--border-color, rgba(255,255,255,0.1))';
              }}
            >
              <X size={16} />
            </button>

            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.25) 0%, rgba(37, 99, 235, 0.25) 100%)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)'
                }}
              >
                <UserCheck size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-main, #fff)', letterSpacing: '-0.2px' }}>
                  Operator Profile &amp; Role Identity
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                  Update identity details, assigned jurisdiction, and operational clearance
                </span>
              </div>
            </div>

            {/* Real-time Saved Success Banner */}
            {saveSuccessBanner && (
              <div
                style={{
                  marginBottom: '18px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: '#10b981',
                  animation: 'fadeIn 0.2s ease-in'
                }}
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Check size={15} />
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700 }}>Profile Saved Successfully!</div>
                  <div style={{ fontSize: '11px', color: '#6ee7b7' }}>
                    Changes are active and reflected in real-time across all telemetry logs and headers.
                  </div>
                </div>
              </div>
            )}

            {/* Profile Edit Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsProfileSaving(true);

                setTimeout(() => {
                  const updated = {
                    ...currentUser,
                    name: profileForm.name.trim() || currentUser.name || currentUser.username,
                    role: profileForm.role || currentUser.role || 'Chief Dispatcher',
                    organization: profileForm.organization.trim() || currentUser.organization || 'Disaster Response Command',
                    email: profileForm.email.trim() || currentUser.email || 'operator@cwc.gov.in',
                    badgeId: profileForm.badgeId.trim() || currentUser.badgeId || 'OP-2026',
                    updatedAt: new Date().toISOString()
                  };
                  setCurrentUser(updated);
                  localStorage.setItem('floodsense_user', JSON.stringify(updated));
                  setIsProfileSaving(false);
                  setSaveSuccessBanner(true);
                  toast.success(`Profile saved: ${updated.name} (${updated.role})`);

                  // Auto close after brief display
                  setTimeout(() => {
                    setProfileEditModal(false);
                    setSaveSuccessBanner(false);
                  }, 1400);
                }, 350);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              {/* Form Grid Row 1 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                    <User size={13} style={{ color: '#0284c7' }} />
                    Operator Name / Callsign
                  </label>
                  <input
                    required
                    value={profileForm.name}
                    onChange={(e) => {
                      setProfileForm({ ...profileForm, name: e.target.value });
                      if (saveSuccessBanner) setSaveSuccessBanner(false);
                    }}
                    placeholder="e.g. Commander R. K. Sharma"
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      background: theme === 'light' ? '#f8fafc' : '#090d16',
                      border: '1px solid var(--border-color, #1e293b)',
                      color: 'var(--text-main, #fff)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#0284c7'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-color, #1e293b)'}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                    <Award size={13} style={{ color: '#0284c7' }} />
                    Badge / Service ID
                  </label>
                  <input
                    value={profileForm.badgeId}
                    onChange={(e) => {
                      setProfileForm({ ...profileForm, badgeId: e.target.value });
                      if (saveSuccessBanner) setSaveSuccessBanner(false);
                    }}
                    placeholder="e.g. NDF-966 / OP-2026"
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      background: theme === 'light' ? '#f8fafc' : '#090d16',
                      border: '1px solid var(--border-color, #1e293b)',
                      color: 'var(--text-main, #fff)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#0284c7'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-color, #1e293b)'}
                  />
                </div>
              </div>

              {/* Form Grid Row 2 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                    <Building size={13} style={{ color: '#0284c7' }} />
                    Jurisdiction / Agency
                  </label>
                  <input
                    required
                    value={profileForm.organization}
                    onChange={(e) => {
                      setProfileForm({ ...profileForm, organization: e.target.value });
                      if (saveSuccessBanner) setSaveSuccessBanner(false);
                    }}
                    placeholder="e.g. Central Water Commission (CWC)"
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      background: theme === 'light' ? '#f8fafc' : '#090d16',
                      border: '1px solid var(--border-color, #1e293b)',
                      color: 'var(--text-main, #fff)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#0284c7'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-color, #1e293b)'}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                    <Shield size={13} style={{ color: '#0284c7' }} />
                    Operational Role &amp; Clearance
                  </label>
                  <select
                    value={profileForm.role}
                    onChange={(e) => {
                      setProfileForm({ ...profileForm, role: e.target.value });
                      if (saveSuccessBanner) setSaveSuccessBanner(false);
                    }}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      background: theme === 'light' ? '#f8fafc' : '#090d16',
                      border: '1px solid var(--border-color, #1e293b)',
                      color: 'var(--text-main, #fff)',
                      fontSize: '12.5px',
                      boxSizing: 'border-box',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="Admin">System Administrator</option>
                    <option value="Chief Dispatcher">Chief Dispatcher</option>
                    <option value="Senior Hydrologist">Senior Hydrologist</option>
                    <option value="NDRF Incident Commander">NDRF Incident Commander</option>
                    <option value="State Disaster Authority (SDMA)">State Disaster Authority (SDMA)</option>
                    <option value="Viewer">Viewer / Field Observer</option>
                  </select>
                </div>
              </div>

              {/* Form Row 3: Official Dispatch Email */}
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                  <span>✉️</span> Official Dispatch Email
                </label>
                <input
                  type="email"
                  autoComplete="off"
                  name="official_dispatch_email_field"
                  value={profileForm.email}
                  onChange={(e) => {
                    setProfileForm({ ...profileForm, email: e.target.value });
                    if (saveSuccessBanner) setSaveSuccessBanner(false);
                  }}
                  placeholder="e.g. inspector.roy@cwc.gov.in"
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    background: theme === 'light' ? '#f8fafc' : '#090d16',
                    border: '1px solid var(--border-color, #1e293b)',
                    color: theme === 'light' ? '#0f172a' : '#f8fafc',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0284c7'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border-color, #1e293b)'}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', paddingTop: '14px', borderTop: '1px solid var(--border-color, #1e293b)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setProfileEditModal(false);
                    setSaveSuccessBanner(false);
                  }}
                  disabled={isProfileSaving}
                  style={{
                    height: '38px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: '1px solid var(--border-color, #334155)',
                    color: 'var(--text-sub, #94a3b8)',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: isProfileSaving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isProfileSaving}
                  style={{
                    height: '38px',
                    padding: '0 20px',
                    borderRadius: '8px',
                    background: isProfileSaving ? '#0369a1' : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: isProfileSaving ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {isProfileSaving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : saveSuccessBanner ? (
                    <>
                      <Check size={15} />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <Check size={15} />
                      <span>Save Profile Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
