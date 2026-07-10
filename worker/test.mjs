import assert from "node:assert/strict";
import worker from "./src/index.js";
class Obj{constructor(v){this.v=v;this.httpEtag='"test"';}async text(){return this.v;}}
class Bucket{constructor(){this.m=new Map();}async put(k,v){this.m.set(k,String(v));}async get(k){return this.m.has(k)?new Obj(this.m.get(k)):null;}async head(k){return this.m.has(k)?{}:null;}async delete(k){this.m.delete(k);}}
const env={PLATES:new Bucket()},origin="https://cubejerry.github.io",cells=Array(96).fill("");cells[0]="Buffer";cells[1]="3150";
const body={title:"Test plate",cells,rowHeaders:["A","B","C","D","E","F","G","H"],columnHeaders:["1","2","3","4","5","6","7","8","9","10","11","12"],showRowHeaders:true,showColumnHeaders:true,expiresInDays:30};
const created=await worker.fetch(new Request("https://x.workers.dev/api/plates",{method:"POST",headers:{"Content-Type":"application/json",Origin:origin},body:JSON.stringify(body)}),env);assert.equal(created.status,201);assert.equal(created.headers.get("Access-Control-Allow-Origin"),origin);const meta=await created.json();assert.match(meta.id,/^[A-Z0-9]{10}$/);
const fetched=await worker.fetch(new Request(`https://x.workers.dev/api/plates/${meta.id}`,{headers:{Origin:origin}}),env);assert.equal(fetched.status,200);const plate=await fetched.json();assert.equal(plate.cells.length,96);assert.equal(plate.cells[0],"Buffer");
const forbidden=await worker.fetch(new Request("https://x.workers.dev/api/plates",{method:"OPTIONS",headers:{Origin:"https://evil.example"}}),env);assert.equal(forbidden.status,403);
console.log("Worker API tests passed.");
