// Puts every menu dish photo on the same Nuzha plate (white, gold rim, dark-green background).
// The food is the restaurant's real photo; only the plate and background are replaced.
//
// Usage (from nuzha-website):
//   npm install --no-save sharp            (one-time; node_modules is git-ignored)
//   node scripts/plate-menu-photos.mjs [inputDir] [outputDir]
// Defaults: input dist/menu-images/restaurant, output dist/menu-images/restaurant/temp (review there,
// then copy over the originals). Run it on UNPLATED photos only, e.g. straight after
// scripts/extract-cdr-menu-photos.mjs; running it on already-plated photos would plate them twice.
//
// FOOD: [centreX, centreY, radius] of the food area as fractions of the unplated web photo.
// KEY: dishes whose leftover old plate/bowl (light, low-saturation pixels connected to the edge) is removed.
// Dishes not listed (fried fish, mixed barbecue platter, mixed appetizers) keep their original platter.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.resolve(process.argv[2] || path.join(root, "dist", "menu-images", "restaurant"));
const out = path.resolve(process.argv[3] || path.join(dir, "temp"));
const only = process.argv[4] ? process.argv[4].split(",") : null;
fs.mkdirSync(out, {recursive: true});
const P = {
  "barbecue-quail": [0.5, 0.47, 0.4],
  "beef-barbecue": [0.5, 0.45, 0.38],
  "biryani-rice": [0.5, 0.45, 0.38],
  "brinjal-curry": [0.5, 0.47, 0.36],
  "broasted-chicken": [0.45, 0.47, 0.4],
  "bukhari-rice": [0.5, 0.5, 0.4],
  "charcoal-chicken-rice": [0.5, 0.5, 0.4],
  "chicken-curry": [0.5, 0.47, 0.36],
  "chicken-kebab": [0.48, 0.48, 0.4],
  "cucumber-yogurt": [0.5, 0.53, 0.27],
  "egg-omelet-shakshuka": [0.5, 0.48, 0.38],
  "foul": [0.52, 0.5, 0.37],
  "french-fries": [0.48, 0.47, 0.36],
  "fresh-mandi-meat": [0.5, 0.48, 0.37],
  "full-fried-eggs": [0.5, 0.45, 0.36],
  "grape-leaf-salad": [0.5, 0.5, 0.42],
  "green-salad": [0.5, 0.5, 0.42],
  "grilled-chicken-half": [0.5, 0.47, 0.4],
  "grilled-chicken-quarter": [0.5, 0.47, 0.4],
  "grilled-chicken-whole": [0.47, 0.5, 0.37],
  "grilled-chicken": [0.5, 0.47, 0.36],
  "half-charcoal-chicken": [0.55, 0.5, 0.4],
  "half-fried-eggs": [0.55, 0.6, 0.38],
  "hummus": [0.5, 0.5, 0.4],
  "imported-meat-rice": [0.5, 0.45, 0.4],
  "lamb-ribs": [0.5, 0.42, 0.36],
  "lentil-soup": [0.47, 0.48, 0.33],
  "lentils": [0.48, 0.5, 0.4],
  "liver-with-kidney": [0.5, 0.5, 0.29],
  "liver-with-tomato": [0.48, 0.45, 0.33],
  "mandi-chicken-half": [0.5, 0.5, 0.37],
  "mandi-chicken-quarter": [0.48, 0.5, 0.36],
  "mandi-chicken-whole": [0.5, 0.5, 0.42],
  "mandi-rice": [0.5, 0.53, 0.37],
  "meat-kebab-kofta": [0.5, 0.55, 0.34],
  "meat-with-tomato": [0.48, 0.47, 0.35],
  "mixed-bbq-plate": [0.52, 0.45, 0.4],
  "mixed-vegetable-curry": [0.45, 0.45, 0.36],
  "mutabbal": [0.5, 0.47, 0.42],
  "mutton-curry": [0.55, 0.5, 0.28],
  "mutton-kidneys": [0.5, 0.47, 0.36],
  "okra-curry": [0.47, 0.5, 0.31],
  "plain-rice": [0.48, 0.5, 0.4],
  "potato-with-meat": [0.52, 0.52, 0.32],
  "shish-tawook": [0.5, 0.42, 0.33],
  "spinach-molokhia": [0.5, 0.58, 0.28],
  "tabbouleh": [0.5, 0.45, 0.38],
  "white-rice": [0.5, 0.5, 0.4]
};
const KEY = new Set(["barbecue-quail","beef-barbecue","chicken-kebab","broasted-chicken","grape-leaf-salad","green-salad","grilled-chicken","half-charcoal-chicken","lamb-ribs","meat-kebab-kofta","mixed-bbq-plate","shish-tawook","brinjal-curry","chicken-curry","liver-with-tomato","meat-with-tomato","mutton-kidneys","lentils","tabbouleh","foul","okra-curry","mixed-vegetable-curry","spinach-molokhia","lentil-soup","liver-with-kidney","egg-omelet-shakshuka","full-fried-eggs","french-fries","mutton-curry","potato-with-meat","grilled-chicken-whole","mandi-chicken-whole"]);
const W=900,C=W/2,PLATE=420,FOOD=318,D=FOOD*2;
const base=Buffer.from(`<svg width="${W}" height="${W}" xmlns="http://www.w3.org/2000/svg"><defs>
<radialGradient id="bg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#2b5446"/><stop offset="1" stop-color="#10251d"/></radialGradient>
<radialGradient id="pl" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#ffffff"/><stop offset=".75" stop-color="#f6f3ec"/><stop offset="1" stop-color="#e3ddd0"/></radialGradient>
<radialGradient id="well" cx="50%" cy="50%" r="50%"><stop offset=".86" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#7a6a50" stop-opacity=".28"/></radialGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18"/></filter></defs>
<rect width="${W}" height="${W}" fill="url(#bg)"/>
<circle cx="${C+10}" cy="${C+18}" r="${PLATE}" fill="#000" opacity=".45" filter="url(#sh)"/>
<circle cx="${C}" cy="${C}" r="${PLATE}" fill="url(#pl)"/>
<circle cx="${C}" cy="${C}" r="${PLATE-14}" fill="none" stroke="#c9a24a" stroke-width="4"/>
<circle cx="${C}" cy="${C}" r="${PLATE-22}" fill="none" stroke="#e2cf9c" stroke-width="1.5"/>
<circle cx="${C}" cy="${C}" r="${FOOD+30}" fill="url(#well)"/>
<circle cx="${C}" cy="${C}" r="${FOOD+30}" fill="none" stroke="#d9d2c3" stroke-width="2"/></svg>`);
const plateLike=(r,g,b)=>{const mx=Math.max(r,g,b),mn=Math.min(r,g,b);return mn>125&&mx-mn<48}; // light, low-saturation (white/grey/pinkish ceramic)
for(const [name,[cx,cy,rr]] of Object.entries(P)){
  if(only&&!only.includes(name))continue;
  const src=path.join(dir,name+'.jpg');const m=await sharp(src).metadata();const s=Math.min(m.width,m.height);
  let side=Math.round(2*rr*s),left=Math.round(cx*m.width-side/2),top=Math.round(cy*m.height-side/2);
  left=Math.max(0,Math.min(m.width-side,left));top=Math.max(0,Math.min(m.height-side,top));
  const {data:px}=await sharp(src).extract({left,top,width:side,height:side}).resize(D,D).modulate({saturation:1.05}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=new Float32Array(D*D);
  for(let y=0;y<D;y++)for(let x=0;x<D;x++){const d=Math.hypot(x-FOOD+.5,y-FOOD+.5)/FOOD;alpha[y*D+x]=d<=.9?1:d>=1?0:(1-d)/.1}
  if(KEY.has(name)){
    // flood-fill plate-coloured pixels that connect to the disc edge, then remove them
    const seen=new Uint8Array(D*D),q=new Int32Array(D*D);let qh=0,qt=0;
    const ok=i=>plateLike(px[i*3],px[i*3+1],px[i*3+2]);
    for(let y=0;y<D;y++)for(let x=0;x<D;x++){const d=Math.hypot(x-FOOD+.5,y-FOOD+.5)/FOOD;if(d>.86&&d<=1){const i=y*D+x;if(ok(i)&&!seen[i]){seen[i]=1;q[qt++]=i}}}
    while(qh<qt){const i=q[qh++],x=i%D,y=(i/D)|0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=D||ny>=D)continue;const j=ny*D+nx;if(!seen[j]&&ok(j)){seen[j]=1;q[qt++]=j}}}
    // soften: blur the removal mask
    const rm=new Float32Array(D*D);for(let i=0;i<D*D;i++)rm[i]=seen[i];
    const R=3,tmp=new Float32Array(D*D);
    for(let y=0;y<D;y++)for(let x=0;x<D;x++){let s2=0,n=0;for(let k=-R;k<=R;k++){const xx=x+k;if(xx>=0&&xx<D){s2+=rm[y*D+xx];n++}}tmp[y*D+x]=s2/n}
    for(let y=0;y<D;y++)for(let x=0;x<D;x++){let s2=0,n=0;for(let k=-R;k<=R;k++){const yy=y+k;if(yy>=0&&yy<D){s2+=tmp[yy*D+x];n++}}alpha[y*D+x]*=1-Math.min(1,s2/n*1.15)}
  }
  const rgba=Buffer.alloc(D*D*4);for(let i=0;i<D*D;i++){rgba[i*4]=px[i*3];rgba[i*4+1]=px[i*3+1];rgba[i*4+2]=px[i*3+2];rgba[i*4+3]=Math.round(alpha[i]*255)}
  const food=await sharp(rgba,{raw:{width:D,height:D,channels:4}}).png().toBuffer();
  // shadow shaped like the food
  const sh=Buffer.alloc(D*D*4);for(let i=0;i<D*D;i++){sh[i*4]=59;sh[i*4+1]=42;sh[i*4+2]=20;sh[i*4+3]=Math.round(alpha[i]*90)}
  const shadow=await sharp(sh,{raw:{width:D,height:D,channels:4}}).blur(9).png().toBuffer();
  const buf=await sharp(base).composite([{input:shadow,left:C-FOOD+4,top:C-FOOD+8},{input:food,left:C-FOOD,top:C-FOOD}]).jpeg({quality:84,mozjpeg:true}).toBuffer();
  for(let t=0;t<5;t++){try{fs.writeFileSync(path.join(out,name+'.jpg'),buf);break}catch(e){if(t===4)throw e}}
  console.log('plated',name);
}
console.log('done');
