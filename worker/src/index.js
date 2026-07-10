const EXACT_ORIGINS=new Set(["https://cubejerry.github.io","http://localhost:8000","http://127.0.0.1:8000"]);
const MAX_BYTES=64*1024,MAX_CELL=120,ALPHABET="23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export default{async fetch(request,env){try{return await route(request,env);}catch(error){console.error(error);const status=Number.isInteger(error?.status)?error.status:500;return reply(request,{error:status<500?error.message:"Internal server error."},status);}}};

async function route(request,env){
  const url=new URL(request.url),path=url.pathname.replace(/\/+$/,"")||"/";
  if(request.method==="OPTIONS")return options(request);
  if(path==="/"||path==="/health"){
    if(request.method!=="GET")return method(request,["GET","OPTIONS"]);
    return reply(request,{ok:true,service:"96-well-checklist-api",r2Binding:Boolean(env.PLATES),timestamp:new Date().toISOString()});
  }
  if(path==="/api/plates"){
    if(request.method!=="POST")return method(request,["POST","OPTIONS"]);
    allow(request);binding(env);return create(request,env);
  }
  const match=path.match(/^\/api\/plates\/([A-Z0-9]{8,14})$/i);
  if(match){if(request.method!=="GET")return method(request,["GET","OPTIONS"]);allow(request);binding(env);return get(request,env,match[1].toUpperCase());}
  return reply(request,{error:"Route not found."},404);
}

async function create(request,env){
  if(!(request.headers.get("content-type")||"").toLowerCase().includes("application/json"))return reply(request,{error:"Content-Type must be application/json."},415);
  const declared=Number(request.headers.get("content-length")||0);if(declared>MAX_BYTES)return reply(request,{error:"Plate payload is too large."},413);
  const raw=await request.text();if(new TextEncoder().encode(raw).byteLength>MAX_BYTES)return reply(request,{error:"Plate payload is too large."},413);
  let input;try{input=JSON.parse(raw);}catch{return reply(request,{error:"Request body is not valid JSON."},400);}
  const error=validate(input);if(error)return reply(request,{error},400);
  const now=new Date(),days=[7,30].includes(Number(input.expiresInDays))?Number(input.expiresInDays):30,expires=new Date(now.getTime()+days*86400000);
  let id,key;for(let attempt=0;attempt<5;attempt++){id=randomId(10);key=`plates/${id}.json`;if(!await env.PLATES.head(key))break;id=null;}if(!id)return reply(request,{error:"Could not allocate a plate ID. Try again."},503);
  const plate={version:1,id,title:clean(input.title,80)||"96-well plate",cells:input.cells.map(v=>clean(v,MAX_CELL)),rowHeaders:input.rowHeaders.map(v=>clean(v,20)),columnHeaders:input.columnHeaders.map(v=>clean(v,20)),showRowHeaders:input.showRowHeaders!==false,showColumnHeaders:input.showColumnHeaders!==false,createdAt:now.toISOString(),expiresAt:expires.toISOString()};
  await env.PLATES.put(key,JSON.stringify(plate),{httpMetadata:{contentType:"application/json; charset=utf-8"},customMetadata:{plateId:id,createdAt:plate.createdAt,expiresAt:plate.expiresAt}});
  return reply(request,{id,createdAt:plate.createdAt,expiresAt:plate.expiresAt},201,{"Cache-Control":"no-store"});
}

async function get(request,env,id){
  const key=`plates/${id}.json`,object=await env.PLATES.get(key);if(!object)return reply(request,{error:"Plate not found."},404,{"Cache-Control":"no-store"});
  let plate;try{plate=JSON.parse(await object.text());}catch{return reply(request,{error:"Stored plate data is invalid."},500);}
  if(plate.expiresAt&&Date.parse(plate.expiresAt)<=Date.now()){await env.PLATES.delete(key);return reply(request,{error:"Plate link has expired."},410,{"Cache-Control":"no-store"});}
  return reply(request,plate,200,{"Cache-Control":"private, max-age=60",ETag:object.httpEtag||""});
}

function validate(x){
  if(!x||typeof x!=="object")return"A plate object is required.";
  if(!Array.isArray(x.cells)||x.cells.length!==96)return"cells must contain exactly 96 values in row-major order.";
  if(!Array.isArray(x.rowHeaders)||x.rowHeaders.length!==8)return"rowHeaders must contain exactly 8 labels.";
  if(!Array.isArray(x.columnHeaders)||x.columnHeaders.length!==12)return"columnHeaders must contain exactly 12 labels.";
  if([...x.cells,...x.rowHeaders,...x.columnHeaders].some(v=>typeof v!=="string"))return"All cells and headers must be strings.";
  if(x.cells.some(v=>v.length>MAX_CELL))return`Each cell label must be ${MAX_CELL} characters or fewer.`;
  if(!x.cells.some(v=>clean(v,MAX_CELL)))return"At least one well must contain a value.";
  return null;
}
function options(request){const origin=request.headers.get("origin");if(origin&&!isAllowed(origin))return reply(request,{error:"Origin is not allowed."},403);return new Response(null,{status:204,headers:{...cors(request),"Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Accept","Access-Control-Max-Age":"86400"}});}
function allow(request){const origin=request.headers.get("origin");if(origin&&!isAllowed(origin)){const e=new Error("Origin is not allowed.");e.status=403;throw e;}}
function binding(env){if(!env.PLATES)throw new Error("R2 binding PLATES is missing.");}
function method(request,methods){return reply(request,{error:"Method not allowed."},405,{Allow:methods.join(", ")});}
function reply(request,payload,status=200,extra={}){const h=new Headers({"Content-Type":"application/json; charset=utf-8","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer",...cors(request)});for(const[k,v]of Object.entries(extra))if(v)h.set(k,v);return new Response(JSON.stringify(payload),{status,headers:h});}
function cors(request){const origin=request.headers.get("origin"),h={Vary:"Origin"};if(origin&&isAllowed(origin))h["Access-Control-Allow-Origin"]=origin;return h;}
function isAllowed(origin){return EXACT_ORIGINS.has(origin);}
function clean(v,n){return String(v??"").replace(/[\u0000-\u001F\u007F]/g," ").replace(/\s+/g," ").trim().slice(0,n);}
function randomId(n){const bytes=new Uint8Array(n);crypto.getRandomValues(bytes);let out="";for(const b of bytes)out+=ALPHABET[b%ALPHABET.length];return out;}
