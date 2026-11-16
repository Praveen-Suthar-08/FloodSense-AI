import React, { useState, useEffect } from 'react';
import { TileLayer } from 'react-leaflet';

/**
 * Tactical Basemap with Light / Dark dynamic alignment, Topographical/Elevation layer,
 * and live dynamic RainViewer Precipitation Weather Radar overlay without any API keys.
 */
export default function BaseTiles({ theme = 'dark', layer = 'canvas', showRadar = false }) {
  const isLight = theme === 'light';
  const [radarPath, setRadarPath] = useState(null);

  useEffect(() => {
    if (!showRadar) return;
    let isMounted = true;
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        const past = data?.radar?.past;
        if (past && past.length > 0) {
          const latest = past[past.length - 1];
          setRadarPath(latest.path);
        }
      })
      .catch(() => {
        // Fallback default
        if (isMounted) setRadarPath('/v2/radar/nowcast_4');
      });
    return () => { isMounted = false; };
  }, [showRadar]);

  return (
    <>
      {/* 1. Base Layer: Either Topographic Elevation or Canvas */}
      {layer === 'topo' ? (
        <TileLayer
          key="topo-base"
          attribution="Tiles &copy; Esri &mdash; National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={16}
          maxZoom={18}
          noWrap={true}
          bounds={[[-85, -180], [85, 180]]}
        />
      ) : isLight ? (
        <>
          <TileLayer
            key="light-base"
            attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={16}
            maxZoom={18}
            noWrap={true}
            bounds={[[-85, -180], [85, 180]]}
          />
          <TileLayer
            key="light-ref"
            attribution="&copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={16}
            maxZoom={18}
            noWrap={true}
            bounds={[[-85, -180], [85, 180]]}
          />
        </>
      ) : (
        <>
          {/* Keyless OpenStreetMap Standard & Stamen/OSM Dark Canvas with 0 watermarks and no API keys required */}
          <TileLayer
            key="osm-dark-base"
            attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="dark-map-tiles"
            maxNativeZoom={19}
            maxZoom={19}
            noWrap={true}
          />
        </>
      )}

      {/* 2. Weather Radar Overlay (Keyless RainViewer Real-Time Precipitation Tiles) */}
      {showRadar && radarPath && (
        <TileLayer
          key={`weather-radar-${radarPath}`}
          attribution="Weather Radar &copy; RainViewer"
          url={`https://tilecache.rainviewer.com${radarPath}/256/{z}/{x}/{y}/2/1_1.png`}
          opacity={0.65}
          zIndex={500}
        />
      )}
    </>
  );
}
