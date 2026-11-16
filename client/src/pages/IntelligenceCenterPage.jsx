import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  Activity, 
  RefreshCw, 
  Sparkles, 
  Layers, 
  Radio,
  Search,
  Check
} from 'lucide-react';
import { useSensorTelemetry } from '../hooks/useSensorTelemetry.js';
import SharedPageLayout from './SharedPageLayout';

export default function IntelligenceCenterPage({ theme }) {
  const { 
    anomalies, 
    networkHealth, 
    latestPayload, 
    lastSyncTime, 
    isConnected, 
    loading, 
    refresh, 
    acknowledgeAnomaly 
  } = useSensorTelemetry();

  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const activeAnomaly = selectedAnomaly || anomalies[0];

  const handleAcknowledge = async (id) => {
    setReviewing(true);
    await acknowledgeAnomaly(id);
    setReviewing(false);
    if (selectedAnomaly?._id === id || selectedAnomaly?.sensorId === id) {
      setSelectedAnomaly(null);
    }
  };

  return (
    <SharedPageLayout 
      title="AI Diagnostics & Telemetry Stream" 
      subtitle="Real-time isolation forest unsupervised anomaly scoring, SHAP local attributions & gauge telemetry"
    >
      <div className="space-y-6">
        {/* Stream Status and Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--card-bg)] p-3 rounded-xl border border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              isConnected ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {isConnected ? 'WebSocket Stream: 5s Live Ingestion' : 'Reconnecting WebSocket...'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-xs">
              <span className="text-[var(--text-secondary)] font-medium">Last Sync: </span>
              <span className="font-mono font-bold text-blue-500">
                {lastSyncTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </span>
            </div>
            <button 
              onClick={refresh}
              className="p-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-blue-600 transition-colors shadow-sm"
              title="Refresh Incidents"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Hardware Fleet Health Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-sm">
          <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs font-semibold mb-2">
            <span>NETWORK SENSOR HEALTH INDEX</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {networkHealth}% <span className="text-xs font-normal text-[var(--text-secondary)]">Fleet Score</span>
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-2">
            Continuously updated from incoming IoT telemetry payloads
          </div>
        </div>

        <div className="card p-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-sm">
          <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs font-semibold mb-2">
            <span>ACTIVE ANOMALIES FLAGGED</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">
            {anomalies.length} <span className="text-xs font-normal text-[var(--text-secondary)]">Active Incidents</span>
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-2">
            Monitored by Isolation Forest unsupervised statistical scoring
          </div>
        </div>

        <div className="card p-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-sm">
          <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs font-semibold mb-2">
            <span>LATEST SENSOR INGESTION</span>
            <Radio className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-lg font-bold text-[var(--text-primary)] truncate">
            {latestPayload?.location || 'Brahmaputra (Guwahati Station)'}
          </div>
          <div className="text-xs font-mono text-[var(--text-secondary)] mt-1">
            Reading: {latestPayload?.telemetryReading || '5.20'}m • Batt: {latestPayload?.batteryVoltage || '3.75'}V
          </div>
        </div>
      </div>

      {/* Main Studio Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Dynamic Telemetry Anomaly Queue */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Incoming Telemetry Anomaly Queue ({anomalies.length})
            </h2>
            <span className="text-xs text-[var(--text-secondary)]">Real-time Stream</span>
          </div>

          <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
            {anomalies.length === 0 ? (
              <div className="card p-8 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-center text-sm text-[var(--text-secondary)]">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                No active sensor anomalies detected. All hydrometric gauges reporting nominal variance.
              </div>
            ) : (
              anomalies.map((anom, idx) => {
                const isSelected = (activeAnomaly?._id && activeAnomaly._id === anom._id) || activeAnomaly?.sensorId === anom.sensorId;
                return (
                  <div
                    key={anom._id || anom.sensorId || idx}
                    onClick={() => setSelectedAnomaly(anom)}
                    className={`card p-4 rounded-xl border cursor-pointer transition-all shadow-sm ${
                      isSelected 
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10 dark:bg-blue-950/20' 
                        : 'border-[var(--border-color)] bg-[var(--card-bg)] hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-blue-500">
                        {anom.sensorId || `GAUGE-${idx + 1}`}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/30">
                        {anom.anomalyType || 'Statistical Outlier'}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-[var(--text-primary)] mb-1">
                      {anom.location}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[var(--border-color)] text-xs">
                      <div>
                        <span className="text-[var(--text-secondary)] block text-[10px]">Telemetry</span>
                        <span className="font-mono font-bold text-rose-500">{anom.telemetryReading}m</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-secondary)] block text-[10px]">Anomaly Score</span>
                        <span className="font-mono font-bold text-amber-500">{(anom.anomalyScore * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Columns: SHAP Causal Explainability & Remediation */}
        <div className="lg:col-span-2 space-y-6">
          {activeAnomaly ? (
            <div className="card p-6 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[var(--border-color)]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-blue-500">{activeAnomaly.sensorId}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30">
                      {activeAnomaly.anomalyType || 'Isolation Forest Outlier'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mt-1">
                    {activeAnomaly.location}
                  </h3>
                </div>

                <button
                  onClick={() => handleAcknowledge(activeAnomaly._id || activeAnomaly.sensorId)}
                  disabled={reviewing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-2"
                >
                  <Check className="w-3.5 h-3.5" />
                  {reviewing ? 'Acknowledging...' : 'Acknowledge & Recalibrate'}
                </button>
              </div>

              {/* Payload Data Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg border border-[var(--border-color)] bg-slate-50 dark:bg-slate-900/40">
                  <span className="text-[10px] font-bold uppercase text-[var(--text-secondary)] block">Telemetry Reading</span>
                  <span className="text-xl font-black text-rose-500 font-mono">{activeAnomaly.telemetryReading}m</span>
                </div>
                <div className="p-3 rounded-lg border border-[var(--border-color)] bg-slate-50 dark:bg-slate-900/40">
                  <span className="text-[10px] font-bold uppercase text-[var(--text-secondary)] block">Health Score</span>
                  <span className="text-xl font-black text-emerald-500 font-mono">{activeAnomaly.healthScore || 82}%</span>
                </div>
                <div className="p-3 rounded-lg border border-[var(--border-color)] bg-slate-50 dark:bg-slate-900/40">
                  <span className="text-[10px] font-bold uppercase text-[var(--text-secondary)] block">Isolation Forest</span>
                  <span className="text-xl font-black text-amber-500 font-mono">{((activeAnomaly.anomalyScore || 0.78) * 100).toFixed(0)}%</span>
                </div>
                <div className="p-3 rounded-lg border border-[var(--border-color)] bg-slate-50 dark:bg-slate-900/40">
                  <span className="text-[10px] font-bold uppercase text-[var(--text-secondary)] block">Detection Frame</span>
                  <span className="text-xs font-bold text-[var(--text-primary)] block mt-1">Continuous 5s Tick</span>
                </div>
              </div>

              {/* SHAP Local Feature Attributions */}
              <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    SHAP Explainable AI Feature Attributions
                  </h4>
                </div>

                <div className="space-y-2">
                  {(activeAnomaly.shapExplanations && activeAnomaly.shapExplanations.length > 0) ? (
                    activeAnomaly.shapExplanations.map((shap, i) => (
                      <div key={i} className="p-3 rounded-lg border border-[var(--border-color)] bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs font-bold text-[var(--text-primary)]">{shap.factor}</div>
                          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{shap.description}</div>
                        </div>
                        <span className="font-mono text-xs font-bold text-rose-500 px-2 py-1 rounded bg-rose-500/10">
                          {shap.impact}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 rounded-lg border border-[var(--border-color)] bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-[var(--text-primary)]">Rate of Rise Divergence</div>
                        <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Sudden dZ/dt telemetry jump exceeding 3 sigma threshold</div>
                      </div>
                      <span className="font-mono text-xs font-bold text-rose-500 px-2 py-1 rounded bg-rose-500/10">+0.48</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-12 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-center text-sm text-[var(--text-secondary)]">
              Select an incident from the Telemetry Anomaly Queue to inspect AI diagnostic breakdowns and feature attributions.
            </div>
          )}
        </div>
      </div>
    </div>
  </SharedPageLayout>
  );
}
