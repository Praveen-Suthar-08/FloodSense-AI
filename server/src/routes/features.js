import {z} from 'zod';import {Location,Assessment,HelpCache,Checklist} from '../models.js';import {haversineKm,parseOverpass} from '../services/geo.js';
const objectId=z.string().regex(/^[a-f\d]{24}$/i);const fallback={Low:['Monitor local weather updates.','Keep drainage clear.','Know your safe route.','Keep your phone charged.','Store key contacts.','Check vulnerable neighbours.','Review local alerts.','Stay informed.'],Moderate:['Review your household plan.','Move valuables above floor level.','Charge phones.','Clear drains safely.','Prepare clean water.','Avoid low routes.','Check local alerts.','Help neighbours safely.'],High:['Avoid flood-prone routes.','Prepare a go-bag.','Move valuables higher.','Charge devices.','Keep documents dry.','Monitor official alerts.','Plan evacuation route.','Check neighbours.'],Severe:['Follow evacuation orders.','Avoid all floodwater.','Move to higher ground.','Take emergency supplies.','Keep family together.','Call emergency services if needed.','Monitor official warnings.','Do not drive through water.']};
export function registerFeatureRoutes(app){app.get('/api/locations/:id/checklist',async(req,res,next)=>{try{const id=objectId.parse(req.params.id),lang=z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).default('en').parse(req.query.lang);const a=await Assessment.findOne({locationId:id}).sort({createdAt:-1});if(!a)return res.status(404).json({error:'Assessment not found'});let c=await Checklist.findOne({level:a.level,lang});if(!c)c=await Checklist.create({level:a.level,lang,items:fallback[a.level]});res.json({level:a.level,lang,items:c.items,translated:lang==='en'});}catch(e){next(e)}});app.get('/api/locations/:id/help',async(req,res,next)=>{try{const id=objectId.parse(req.params.id),location=await Location.findById(id);if(!location)return res.status(404).json({error:'Location not found'});const cached=await HelpCache.findOne({locationId:id});if(cached)return res.json({items:cached.items,cached:true});    let items = [];
    try {
      const query=`[out:json];(node(around:5000,${location.lat},${location.lon})[amenity~"hospital|shelter"];node(around:5000,${location.lat},${location.lon})[emergency=assembly_point];);out;`;
      const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),10000);
      const response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:query,signal:ctrl.signal});
      clearTimeout(timer);
      if(response.ok) {
        items=parseOverpass(await response.json(),location.lat,location.lon);
      }
    } catch {
      items = [];
    }
    await HelpCache.findOneAndUpdate({locationId:id},{items,fetchedAt:new Date()},{upsert:true});
    res.json({items,cached:false});}catch(e){next(e)}});}
