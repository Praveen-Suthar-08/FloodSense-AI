import {connectDb} from '../config/db.js'; 
import {Location, Alert} from '../models.js'; 
import {fetchElevation} from '../services/openMeteo.js';

const riverLocations = [
  {
    name: 'Brahmaputra River, Assam',
    river: 'Brahmaputra River',
    district: 'Kamrup',
    state: 'Assam',
    country: 'India',
    lat: 26.1445,
    lon: 91.7362,
    warningThreshold: 3.5,
    criticalThreshold: 4.0,
    currentWaterLevel: 4.8,
    sensorStatus: 'Critical',
    sensorId: 'SEN-BRAHMA-01'
  },
  {
    name: 'Ganges River, Bihar',
    river: 'Ganges River',
    district: 'Patna',
    state: 'Bihar',
    country: 'India',
    lat: 25.5941,
    lon: 85.1376,
    warningThreshold: 3.0,
    criticalThreshold: 4.2,
    currentWaterLevel: 3.5,
    sensorStatus: 'Warning',
    sensorId: 'SEN-GANGES-02'
  },
  {
    name: 'Narmada River, MP',
    river: 'Narmada River',
    district: 'Hoshangabad',
    state: 'Madhya Pradesh',
    country: 'India',
    lat: 22.7533,
    lon: 77.7249,
    warningThreshold: 2.8,
    criticalThreshold: 3.8,
    currentWaterLevel: 2.1,
    sensorStatus: 'Active',
    sensorId: 'SEN-NARMADA-03'
  },
  {
    name: 'Godavari River, Andhra Pradesh',
    river: 'Godavari River',
    district: 'East Godavari',
    state: 'Andhra Pradesh',
    country: 'India',
    lat: 16.9891,
    lon: 81.7840,
    warningThreshold: 3.2,
    criticalThreshold: 4.5,
    currentWaterLevel: 2.6,
    sensorStatus: 'Active',
    sensorId: 'SEN-GODAVARI-04'
  },
  {
    name: 'Yamuna River, Delhi',
    river: 'Yamuna River',
    district: 'Central Delhi',
    state: 'Delhi',
    country: 'India',
    lat: 28.6139,
    lon: 77.2090,
    warningThreshold: 3.0,
    criticalThreshold: 4.1,
    currentWaterLevel: 3.1,
    sensorStatus: 'Warning',
    sensorId: 'SEN-YAMUNA-05'
  },
  {
    name: 'Mahanadi River, Odisha',
    river: 'Mahanadi River',
    district: 'Cuttack',
    state: 'Odisha',
    country: 'India',
    lat: 20.4625,
    lon: 85.8828,
    warningThreshold: 2.9,
    criticalThreshold: 3.9,
    currentWaterLevel: 2.3,
    sensorStatus: 'Active',
    sensorId: 'SEN-MAHANADI-06'
  },
  {
    name: 'Krishna River, Maharashtra',
    river: 'Krishna River',
    district: 'Sangli',
    state: 'Maharashtra',
    country: 'India',
    lat: 16.8524,
    lon: 74.5815,
    warningThreshold: 3.2,
    criticalThreshold: 4.4,
    currentWaterLevel: 2.4,
    sensorStatus: 'Active',
    sensorId: 'SEN-KRISHNA-07'
  },
  {
    name: 'Kaveri River, Tamil Nadu',
    river: 'Kaveri River',
    district: 'Thanjavur',
    state: 'Tamil Nadu',
    country: 'India',
    lat: 10.7870,
    lon: 79.1378,
    warningThreshold: 2.5,
    criticalThreshold: 3.5,
    currentWaterLevel: 1.9,
    sensorStatus: 'Active',
    sensorId: 'SEN-KAVERI-08'
  },
  {
    name: 'Teesta River, West Bengal',
    river: 'Teesta River',
    district: 'Jalpaiguri',
    state: 'West Bengal',
    country: 'India',
    lat: 26.5405,
    lon: 88.7194,
    warningThreshold: 2.8,
    criticalThreshold: 3.8,
    currentWaterLevel: 2.9,
    sensorStatus: 'Warning',
    sensorId: 'SEN-TEESTA-09'
  },
  {
    name: 'Tapi River, Gujarat',
    river: 'Tapi River',
    district: 'Surat',
    state: 'Gujarat',
    country: 'India',
    lat: 21.1702,
    lon: 72.8311,
    warningThreshold: 3.0,
    criticalThreshold: 4.2,
    currentWaterLevel: 2.0,
    sensorStatus: 'Active',
    sensorId: 'SEN-TAPI-10'
  },
  {
    name: 'Sutlej River, Punjab',
    river: 'Sutlej River',
    district: 'Rupnagar',
    state: 'Punjab',
    country: 'India',
    lat: 30.9664,
    lon: 76.5331,
    warningThreshold: 3.2,
    criticalThreshold: 4.3,
    currentWaterLevel: 2.2,
    sensorStatus: 'Active',
    sensorId: 'SEN-SUTLEJ-11'
  },
  {
    name: 'Jhelum River, J&K',
    river: 'Jhelum River',
    district: 'Srinagar',
    state: 'Jammu and Kashmir',
    country: 'India',
    lat: 34.0837,
    lon: 74.7973,
    warningThreshold: 2.7,
    criticalThreshold: 3.7,
    currentWaterLevel: 1.8,
    sensorStatus: 'Active',
    sensorId: 'SEN-JHELUM-12'
  }
];

await connectDb();

for (const loc of riverLocations) {
  const elevation = await fetchElevation(loc.lat, loc.lon).catch(() => 50);
  await Location.findOneAndUpdate(
    { lat: loc.lat, lon: loc.lon },
    { $set: { ...loc, elevation } },
    { upsert: true, new: true }
  );
}

// Seed Reference Alerts matching screenshot
const brahma = await Location.findOne({ name: 'Brahmaputra River, Assam' });
const ganges = await Location.findOne({ name: 'Ganges River, Bihar' });
const narmada = await Location.findOne({ name: 'Narmada River, MP' });

if (brahma) {
  await Alert.findOneAndUpdate(
    { locationName: brahma.name, message: 'Water level crossed 4.0 m' },
    {
      $set: {
        locationId: brahma._id,
        locationName: brahma.name,
        river: brahma.river,
        district: brahma.district,
        state: brahma.state,
        fromLevel: 'High',
        toLevel: 'Severe',
        severity: 'Critical',
        status: 'Active',
        waterLevel: 4.8,
        previousWaterLevel: 3.6,
        threshold: 4.0,
        message: 'Water level crossed 4.0 m',
        createdAt: new Date('2026-11-10T16:58:00Z')
      }
    },
    { upsert: true }
  );
}

if (ganges) {
  await Alert.findOneAndUpdate(
    { locationName: ganges.name, message: 'Water level at 3.5 m' },
    {
      $set: {
        locationId: ganges._id,
        locationName: ganges.name,
        river: ganges.river,
        district: ganges.district,
        state: ganges.state,
        fromLevel: 'Low',
        toLevel: 'Moderate',
        severity: 'Warning',
        status: 'Active',
        waterLevel: 3.5,
        previousWaterLevel: 3.0,
        threshold: 3.0,
        message: 'Water level at 3.5 m',
        createdAt: new Date('2026-11-10T15:20:00Z')
      }
    },
    { upsert: true }
  );
}

if (narmada) {
  await Alert.findOneAndUpdate(
    { locationName: narmada.name, message: 'Back to normal (2.1 m)' },
    {
      $set: {
        locationId: narmada._id,
        locationName: narmada.name,
        river: narmada.river,
        district: narmada.district,
        state: narmada.state,
        fromLevel: 'Moderate',
        toLevel: 'Low',
        severity: 'Resolved',
        status: 'Resolved',
        waterLevel: 2.1,
        previousWaterLevel: 2.8,
        threshold: 2.8,
        message: 'Back to normal (2.1 m)',
        createdAt: new Date('2026-11-10T13:45:00Z')
      }
    },
    { upsert: true }
  );
}

console.log('Seed complete with 12 reference monitoring stations and alerts.');
process.exit(0);
