import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

/**
 * Custom React hook for live IoT sensor telemetry streams and anomaly detection.
 * Listens to backend WebSocket broadcast and polls REST fallback (/api/incidents & /api/anomalies).
 */
export function useSensorTelemetry() {
  const [telemetryStream, setTelemetryStream] = useState([]);
  const [latestPayload, setLatestPayload] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [networkHealth, setNetworkHealth] = useState(92.4);
  const [lastSyncTime, setLastSyncTime] = useState(new Date());
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const socketRef = useRef(null);

  // Initial fetch from REST endpoint
  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:4000/api/incidents');
      const data = await res.json();
      if (data?.incidents) {
        setAnomalies(data.incidents);
      }
    } catch (err) {
      console.error('[useSensorTelemetry] REST fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();

    // Connect to WebSocket server
    const socket = io('http://localhost:4000', {
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Real-time IoT sensor telemetry packet emitted every 5 seconds
    socket.on('sensor_telemetry', (payload) => {
      setLatestPayload(payload);
      setLastSyncTime(new Date(payload.timestamp || Date.now()));
      setTelemetryStream(prev => [payload, ...prev.slice(0, 19)]);

      if (payload.healthScore) {
        setNetworkHealth(prev => Number(((prev * 0.9) + (payload.healthScore * 0.1)).toFixed(1)));
      }
    });

    // Real-time Isolation Forest Anomaly detected
    socket.on('anomaly_detected', (payload) => {
      setLastSyncTime(new Date(payload.timestamp || Date.now()));
      setAnomalies(prev => {
        const filtered = prev.filter(p => p.sensorId !== payload.sensorId);
        return [payload, ...filtered.slice(0, 14)];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const acknowledgeAnomaly = async (id) => {
    try {
      await fetch(`http://localhost:4000/api/anomalies/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed: true })
      });
      setAnomalies(prev => prev.filter(a => a._id !== id && a.sensorId !== id));
    } catch (err) {
      console.error('Failed to acknowledge anomaly:', err);
    }
  };

  return {
    telemetryStream,
    latestPayload,
    anomalies,
    networkHealth,
    lastSyncTime,
    isConnected,
    loading,
    refresh: fetchIncidents,
    acknowledgeAnomaly
  };
}

