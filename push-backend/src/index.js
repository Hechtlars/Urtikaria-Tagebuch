import webpush from "web-push";
const C={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const J=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...C,"content-type":"application/json"}});
async function sendDue(env){
 webpush.setVapidDetails(env.VAPID_SUBJECT,env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY);
 const {results=[]}=await env.DB.prepare("SELECT * FROM subscriptions").all(),now=new Date();
 for(const row of results){try{
  const ps=new Intl.DateTimeFormat("en-CA",{timeZone:row.timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
  const x=Object.fromEntries(ps.map(p=>[p.type,p.value])),date=`${x.year}-${x.month}-${x.day}`,time=`${x.hour}:${x.minute}`;
  if(time===row.local_time&&row.last_sent_date!==date){await webpush.sendNotification(JSON.parse(row.subscription),JSON.stringify({title:"Urtikaria",body:"Zeit für deinen heutigen Eintrag."}));await env.DB.prepare("UPDATE subscriptions SET last_sent_date=? WHERE endpoint=?").bind(date,row.endpoint).run()}
 }catch(e){if(e.statusCode===404||e.statusCode===410)await env.DB.prepare("DELETE FROM subscriptions WHERE endpoint=?").bind(row.endpoint).run()}}
}
export default{
 async fetch(req,env){if(req.method==="OPTIONS")return new Response(null,{headers:C});const u=new URL(req.url);
  if(u.pathname==="/vapid-public")return new Response(env.VAPID_PUBLIC_KEY,{headers:C});
  if(u.pathname==="/subscribe"&&req.method==="POST"){const b=await req.json();if(!b.subscription?.endpoint||!/^\d{2}:\d{2}$/.test(b.time||""))return J({error:"invalid"},400);await env.DB.prepare("INSERT OR REPLACE INTO subscriptions(endpoint,subscription,local_time,timezone,last_sent_date) VALUES(?,?,?,?,NULL)").bind(b.subscription.endpoint,JSON.stringify(b.subscription),b.time,b.tz||"Europe/Berlin").run();return J({ok:true})}
  if(u.pathname==="/unsubscribe"&&req.method==="POST"){const b=await req.json();await env.DB.prepare("DELETE FROM subscriptions WHERE endpoint=?").bind(b.endpoint||"").run();return J({ok:true})}
  return J({ok:true});
 },
 async scheduled(c,env,ctx){ctx.waitUntil(sendDue(env))}
};