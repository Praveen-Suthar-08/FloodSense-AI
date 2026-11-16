import mongoose from 'mongoose';
const {Schema,model}=mongoose;
const locationSchema=new Schema({
  name:{type:String,required:true},
  river:String,
  state:String,
  district:String,
  country:String,
  countryCode:{type:String,uppercase:true,trim:true},
  admin1:String,
  lat:{type:Number,required:true},
  lon:{type:Number,required:true},
  elevation:Number,
  warningThreshold:{type:Number,default:3.5},
  criticalThreshold:{type:Number,default:4.0},
  alertThreshold:{type:Number,default:50,min:10,max:90},
  sensorStatus:{type:String,enum:['Active','Warning','Critical','Offline'],default:'Active'},
  sensorId:String,
  currentWaterLevel:Number
},{timestamps:true});locationSchema.index({lat:1,lon:1},{unique:true});
const readingSchema=new Schema({locationId:{type:Schema.Types.ObjectId,ref:'Location',required:true},fetchedAt:{type:Date,default:Date.now},rain24:Number,rain72:Number,past72:Number,peakQ:Number,medQ:Number,soil:Number,hourly:Array,daily:Array});readingSchema.index({fetchedAt:1},{expireAfterSeconds:2592000});readingSchema.index({locationId:1,fetchedAt:-1});
const advisorySchema=new Schema({summary:String,drivers:[String],actions:[String],confidence:String,source:String},{_id:false});
const assessmentSchema=new Schema({locationId:{type:Schema.Types.ObjectId,ref:'Location',required:true},createdAt:{type:Date,default:Date.now},score:Number,level:String,factors:Object,advisory:advisorySchema,translations:{type:Map,of:advisorySchema,default:{}} ,readingId:Schema.Types.ObjectId});assessmentSchema.index({locationId:1,createdAt:-1});
const alertSchema=new Schema({
  locationId:Schema.Types.ObjectId,
  locationName:String,
  river:String,
  district:String,
  state:String,
  fromLevel:String,
  toLevel:String,
  score:Number,
  severity:{type:String,enum:['Normal','Warning','Critical','Resolved'],default:'Warning'},
  status:{type:String,enum:['Active','Acknowledged','Resolved'],default:'Active'},
  acknowledgedBy:String,
  acknowledgedAt:Date,
  dispatchedTeams:[String], // e.g. ['NDRF 1st Bn (Patgaon)', 'SDRF River Rescue', 'District Fire Service']
  dispatchedAt:Date,
  affectedVillages:[String],
  affectedPinCodes:[String],
  waterLevel:Number,
  previousWaterLevel:Number,
  threshold:Number,
  message:String,
  peakWaterLevel:Number,
  ongoingSince:Date,
  lastUpdated:Date,
  operatorNotes:[{
    text:String,
    author:String,
    timestamp:{type:Date,default:Date.now}
  }],
  createdAt:{type:Date,default:Date.now}
});alertSchema.index({createdAt:1},{expireAfterSeconds:7776000});
const helpCacheSchema=new Schema({locationId:{type:Schema.Types.ObjectId,unique:true},items:Array,fetchedAt:{type:Date,default:Date.now}});helpCacheSchema.index({fetchedAt:1},{expireAfterSeconds:604800});
const checklistSchema=new Schema({level:String,lang:String,items:[String]});checklistSchema.index({level:1,lang:1},{unique:true});
const subscriberSchema=new Schema({
  name:String,
  phone:String,
  email:String,
  pinCode:{type:String,required:true,index:true}, // Resident / Area Postal PIN code (e.g. "781001")
  region:String, // Basin / District
  locationId:{type:Schema.Types.ObjectId,ref:'Location'},
  channel:{type:String,enum:['webpush','sms','whatsapp','email','all'],default:'webpush'},
  // Web Push Subscription object from browser Notification API
  pushSubscription:{
    endpoint:{type:String,required:true,unique:true},
    expirationTime:{type:Number,default:null},
    keys:{
      p256dh:{type:String,required:true},
      auth:{type:String,required:true}
    }
  },
  isActive:{type:Boolean,default:true},
  lastNotifiedAt:Date
},{timestamps:true});
subscriberSchema.index({pinCode:1,isActive:1});

const outboundLogSchema=new Schema({
  subscriberId:{type:Schema.Types.ObjectId,ref:'Subscriber'},
  recipient:String,
  channel:{type:String,enum:['sms','whatsapp','email'],required:true},
  provider:String, // 'msg91' | 'twilio' | 'wati' | 'interakt' | 'nodemailer' | 'simulated'
  status:{type:String,enum:['sent','failed','queued'],default:'sent'},
  message:String,
  river:String,
  waterLevel:Number,
  createdAt:{type:Date,default:Date.now}
});
outboundLogSchema.index({createdAt:1},{expireAfterSeconds:7776000});

const userSchema = new Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Dispatcher', 'Viewer'], default: 'Viewer' },
  organization: { type: String, default: 'CWC / NDRF Incident Command' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const auditLogSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  username: String,
  role: String,
  action: { type: String, required: true }, // 'BROADCAST_EVACUATION', 'DISPATCH_TEAM', 'ACKNOWLEDGE_ALERT', 'RESOLVE_ALERT', 'UPDATE_THRESHOLD'
  targetId: String,
  targetType: String,
  details: Schema.Types.Mixed,
  ip: String,
  timestamp: { type: Date, default: Date.now }
});
auditLogSchema.index({ timestamp: -1 });

// ==========================================
// NEW SCHEMAS FOR 5 PLATFORM MODULES
// ==========================================

// 1. Forecast Records & Model Performance
const forecastRecordSchema = new Schema({
  locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
  stationName: String,
  horizon: { type: String, enum: ['1h', '3h', '6h', '12h', '24h', '3d', '7d'], required: true },
  predictedWaterLevel: Number,
  observedWaterLevel: Number,
  confidenceInterval: {
    lower: Number,
    upper: Number
  },
  floodProbability: Number,
  modelVersion: { type: String, default: 'Hydrological-Ensemble-v3.2' },
  modelAlgorithm: { type: String, default: 'Gradient-Boosted-Hydraulic' },
  status: { type: String, enum: ['Normal', 'Watch', 'Warning', 'Critical'], default: 'Normal' },
  mae: Number,
  rmse: Number,
  createdAt: { type: Date, default: Date.now }
});
forecastRecordSchema.index({ locationId: 1, horizon: 1, createdAt: -1 });

// 2. Satellite Intelligence & Flood Polygons
const satelliteJobSchema = new Schema({
  mission: { type: String, enum: ['Sentinel-1 SAR', 'Sentinel-2 Optical', 'NASA GPM'], default: 'Sentinel-1 SAR' },
  acquisitionDate: { type: Date, default: Date.now },
  basin: String,
  status: { type: String, enum: ['Processed', 'Processing', 'Cloud-Covered', 'Queued'], default: 'Processed' },
  floodExtentAreaSqKm: Number,
  polygons: [{
    coordinates: [[Number]],
    inundationDepth: Number
  }],
  verifiedBy: String,
  verificationStatus: { type: String, enum: ['Verified', 'Pending', 'Rejected'], default: 'Verified' },
  preEventDate: Date,
  postEventDate: Date,
  ndwiMean: Number
}, { timestamps: true });

// 3. Flood Simulation Scenarios & Digital Twin Outputs
const simulationScenarioSchema = new Schema({
  name: { type: String, required: true },
  scenarioType: { type: String, enum: ['Normal', 'Heavy Rainfall', 'Extreme Storm', 'Reservoir Release', 'Upstream Surge'], default: 'Heavy Rainfall' },
  basin: String,
  rainfallMm: Number,
  dischargeCumec: Number,
  peakDepthMeters: Number,
  submergedAreaSqKm: Number,
  affectedRoadsCount: Number,
  affectedBuildingsCount: Number,
  timelineSteps: [{
    hour: Number,
    waterLevel: Number,
    depthMeters: Number,
    inundationPolygons: [[Number]]
  }],
  createdAt: { type: Date, default: Date.now }
});

// 4. Shelters & Rescue Operations (Disaster Ops)
const shelterSchema = new Schema({
  name: { type: String, required: true },
  location: String,
  pinCode: String,
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  capacity: { type: Number, required: true },
  currentOccupancy: { type: Number, default: 0 },
  contact: String,
  facilities: [String],
  status: { type: String, enum: ['Active', 'Near-Full', 'Full', 'Evacuating'], default: 'Active' }
}, { timestamps: true });

const rescueTeamSchema = new Schema({
  teamId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  personnelCount: { type: Number, default: 12 },
  assetType: { type: String, enum: ['Inflatable Boat', 'Heavy Amphibious Rig', 'Rescue Helicopter', 'Medical First-Responder'], default: 'Inflatable Boat' },
  status: { type: String, enum: ['Available', 'Dispatched', 'On Scene', 'Staging'], default: 'Available' },
  lat: Number,
  lon: Number,
  assignedIncident: String,
  currentSpeed: String
}, { timestamps: true });

const citizenIncidentSchema = new Schema({
  category: { type: String, enum: ['Trapped Residents', 'Flooded Homes', 'Road Breach', 'Medical Emergency', 'Critical Evacuation'], required: true },
  description: { type: String, required: true },
  locationName: String,
  pinCode: String,
  lat: Number,
  lon: Number,
  peopleAffected: { type: Number, default: 1 },
  severity: { type: String, enum: ['Critical', 'High', 'Medium', 'Low'], default: 'High' },
  status: { type: String, enum: ['Submitted', 'Under Review', 'Verified', 'Assigned', 'In Progress', 'Resolved'], default: 'Submitted' },
  assignedTeam: String,
  contactPhone: String
}, { timestamps: true });

// 5. Sensor Anomaly Detection & Explainable AI
const sensorAnomalySchema = new Schema({
  locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
  stationName: String,
  anomalyType: { type: String, enum: ['Sudden Spike', 'Unexpected Drop', 'Flatline Freeze', 'Out-Of-Range', 'Telemetry Timeout'], required: true },
  readingValue: Number,
  thresholdExpected: Number,
  severity: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  isolationForestScore: Number, // Isolation forest anomaly score (-1 to 1)
  reviewed: { type: Boolean, default: false },
  reviewNotes: String,
  healthScore: { type: Number, default: 85 }, // 0 to 100
  factors: [String]
}, { timestamps: true });

export const Location=model('Location',locationSchema);export const Reading=model('Reading',readingSchema);export const Assessment=model('Assessment',assessmentSchema);export const Alert=model('Alert',alertSchema);export const HelpCache=model('HelpCache',helpCacheSchema);export const Checklist=model('Checklist',checklistSchema);
export const Subscriber=model('Subscriber',subscriberSchema);
export const OutboundLog=model('OutboundLog',outboundLogSchema);
export const User=model('User',userSchema);
export const AuditLog=model('AuditLog',auditLogSchema);

export const ForecastRecord = model('ForecastRecord', forecastRecordSchema);
export const SatelliteJob = model('SatelliteJob', satelliteJobSchema);
export const SimulationScenario = model('SimulationScenario', simulationScenarioSchema);
export const Shelter = model('Shelter', shelterSchema);
export const RescueTeam = model('RescueTeam', rescueTeamSchema);
export const CitizenIncident = model('CitizenIncident', citizenIncidentSchema);
export const SensorAnomaly = model('SensorAnomaly', sensorAnomalySchema);
