import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {execFile} from "node:child_process";
import {promisify} from "node:util";

const root=path.resolve(import.meta.dirname,"..");
const dist=path.join(root,"dist");
const outDir=path.join(dist,"menu-images","open");
const source=await fs.readFile(path.join(dist,"menu-data.js"),"utf8");
const context={window:{}};vm.createContext(context);vm.runInContext(source,context);
const items=context.window.NUZHA_MENU.filter(x=>x.missingImage);
await fs.mkdir(outDir,{recursive:true});

const queryOverrides={
  "Beef barbecue":"grilled beef kebab",
  "Lamb ribs":"grilled lamb ribs",
  "Barbecue quail":"grilled quail dish",
  "Meat kebab (kofta)":"kofta kebab",
  "Chicken pieces with fries and salad":"grilled chicken fries salad",
  "Half charcoal chicken with bread":"charcoal grilled half chicken food",
  "Chicken pieces with fries and salad":"chicken shish tawook fries salad",
  "Liver with kidney":"liver and kidney dish",
  "Mutton kidneys":"cooked lamb kidneys food",
  "Meat with tomato":"meat tomato stew",
  "Half-fried eggs":"sunny side fried eggs",
  "Fresh mandi meat with rice — single":"lamb mandi rice",
  "Imported meat with rice":"lamb kabsa rice",
  "Broasted chicken with fries":"fried chicken french fries",
  "Grape-leaf salad":"stuffed grape leaves food",
  "Cucumber and mint yogurt":"cucumber mint yogurt",
  "Cucumber lassi":"cucumber yogurt drink",
  "Lady finger curry":"okra curry",
  "Spinach / saag":"spinach saag curry",
  "Potato with meat":"potato meat curry"
};
const slug=s=>s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,70);
const plain=s=>String(s||"").replace(/<[^>]*>/g,"").replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&amp;/g,"&");
const accepted=/public domain|cc0|cc by(?:-sa)?(?: |$)/i;
const map={},credits=[];
const runFile=promisify(execFile);
async function download(url){const {stdout}=await runFile("curl.exe",["-L","--fail","--retry","5","--retry-delay","3","--silent","--show-error",url],{encoding:"buffer",maxBuffer:25*1024*1024});return stdout}

async function search(item){
  const q=queryOverrides[item.nameEn]||`${item.nameEn} food dish`;
  const params=new URLSearchParams({action:"query",format:"json",origin:"*",generator:"search",gsrnamespace:"6",gsrlimit:"10",gsrsearch:`${q} filetype:bitmap`,prop:"imageinfo",iiprop:"url|extmetadata",iiurlwidth:"900"});
  const data=JSON.parse((await download(`https://commons.wikimedia.org/w/api.php?${params}`)).toString("utf8"));
  const pages=Object.values(data.query?.pages||{}).sort((a,b)=>(a.index||99)-(b.index||99));
  return pages.find(p=>{const i=p.imageinfo?.[0],m=i?.extmetadata||{},license=m.LicenseShortName?.value||"",url=i?.thumburl||"";return accepted.test(license)&&/\.(jpe?g|png|webp)$/i.test(p.title)&&/\.(jpe?g|png|webp)(\?|$)/i.test(url)});
}

for(const [index,item] of items.entries()){
  if(index)await new Promise(resolve=>setTimeout(resolve,1800));
  try{
    const page=await search(item),info=page?.imageinfo?.[0],meta=info?.extmetadata||{};
    if(!info)throw new Error("no suitable freely licensed image found");
    const ext=(new URL(info.thumburl).pathname.match(/\.(jpe?g|png|webp)$/i)?.[1]||"jpg").toLowerCase().replace("jpeg","jpg");
    const file=`${slug(item.category)}--${slug(item.nameEn)}.${ext}`;
    const bytes=await download(info.thumburl);
    await fs.writeFile(path.join(outDir,file),bytes);
    map[`${item.category}|${item.nameEn}`]=`menu-images/open/${file}`;
    credits.push({item:item.nameEn,file:`menu-images/open/${file}`,title:plain(meta.ObjectName?.value||page.title.replace(/^File:/,"")),creator:plain(meta.Artist?.value||"Wikimedia Commons contributor"),license:plain(meta.LicenseShortName?.value||""),licenseUrl:meta.LicenseUrl?.value||"",source:info.descriptionurl});
    console.log(`[${index+1}/${items.length}] ${item.nameEn} <- ${page.title}`);
  }catch(error){console.warn(`[${index+1}/${items.length}] ${item.nameEn}: ${error.message}`)}
}
const curatedKeys=new Set([
  "bbq|Beef barbecue","bbq|Meat kebab (kofta)","breakfast|Hummus","breakfast|Liver with kidney","breakfast|Meat with tomato","breakfast|Full fried eggs","breakfast|Half-fried eggs","breakfast|Lentil soup","breakfast|Foul","breakfast|Egg omelet","rice|Mandi chicken rice — whole","rice|Grilled chicken rice — whole","rice|Grilled chicken","rice|Mandi rice","fried|Broasted chicken with fries","appetizers|Green salad","appetizers|Grape-leaf salad","appetizers|Hummus","appetizers|Cucumber and mint yogurt","curries|Lady finger curry","curries|Mixed vegetable curry","curries|Potato with meat","curries|Chicken curry","curries|Lentils","curries|Mutton curry"
]);
const curatedMap=Object.fromEntries(Object.entries(map).filter(([key])=>curatedKeys.has(key)));
const curatedFiles=new Set(Object.values(curatedMap));
const curatedCredits=credits.filter(x=>curatedFiles.has(x.file));
await fs.writeFile(path.join(dist,"menu-open-images.json"),JSON.stringify(curatedMap,null,2)+"\n");
await fs.writeFile(path.join(dist,"menu-image-credits.json"),JSON.stringify(curatedCredits,null,2)+"\n");
console.log(`Downloaded ${credits.length}/${items.length}; published ${curatedCredits.length} visually reviewed images.`);
