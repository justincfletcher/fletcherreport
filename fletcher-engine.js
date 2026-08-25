/* Fletcher Report — Trailer Comparison Engine
 * v1.2.0
 *
 * v1.2.0 — feedback actually goes somewhere; sidebar trimmed
 *  - Feedback box now submits for real. Two supported targets, in priority order:
 *      (a) FEEDBACK.endpoint  — POST JSON to any URL (Formspree, Basin, webhook)
 *      (b) a Webflow form on the page with id "fletcher-feedback-form"
 *    If neither exists the feedback box is NEVER SHOWN, rather than pretending
 *    to record something. Success message only appears on real success; a real
 *    failure shows a real error.
 *  - Feedback now carries context: what was being compared, the active filters,
 *    and the last 5 filter combinations that returned zero results.
 *  - Sidebar split into primary filters + a "More filters" disclosure, with an
 *    active-count badge so collapsed filters are never invisible.
 *  - Chip groups longer than 10 collapse to 10 with a "show all" toggle.
 *
 * v1.1.0 — bug fixes
 *  1. FIX: filter chips whose value contains a double quote (every coupler value,
 *     e.g. 2-5/16" Adjustable) produced a broken data-v attribute. Clicking one
 *     filtered on the truncated string and always returned zero results.
 *  2. FIX: chip values were coerced with isNaN()/unary-plus, so a value that
 *     merely LOOKS numeric (a model family named "83") stopped matching itself.
 *  3. FIX: injected CSS is scoped to #fletcher-compare instead of global.
 *  4. FIX: all interpolated values are HTML-escaped.
 *  5. UX: GVWR switched from a select-of-every-value to a min/max range.
 */
(function(){
  var f=document.createElement("link");f.rel="stylesheet";
  f.href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap";
  document.head.appendChild(f);

  /* ---- Scoped styles. Every selector is namespaced under #fletcher-compare so
     nothing here can touch the rest of the page. ---- */
  var s=document.createElement('style');s.textContent=
"#fletcher-compare{--steel-900:#12212e;--steel-800:#1b3040;--steel-700:#264255;--steel-500:#4d7d92;--steel-400:#6a94ab;--amber:#e0a11b;--amber-dim:#b8830f;--paper:#f7f8f9;--line:#d8dee3;--line-soft:#e8edf0;--ink:#12212e;--ink-mid:#5a6b78;--ink-soft:#8797a3;--good:#1f7a4d;--warn:#b8830f;font-family:Inter,system-ui,sans-serif;color:var(--ink);background:var(--paper);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;display:block}"+
"#fletcher-compare *{box-sizing:border-box;margin:0;padding:0}"+
"#fletcher-compare .wrap{max-width:1240px;margin:0 auto;padding:20px 16px 64px}"+
"#fletcher-compare .hd{border-bottom:2px solid var(--steel-900);padding-bottom:14px;margin-bottom:20px}"+
"#fletcher-compare .eyebrow{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:6px}"+
"#fletcher-compare h1{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:38px;letter-spacing:-.01em;line-height:1.05;text-transform:uppercase;color:var(--ink)}"+
"#fletcher-compare .sub{color:var(--ink-mid);margin-top:6px;max-width:60ch}"+
"#fletcher-compare .count{font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--steel-700)}"+
"#fletcher-compare .cols{display:grid;grid-template-columns:220px 1fr;gap:24px;align-items:start}"+
"@media(max-width:860px){#fletcher-compare .cols{grid-template-columns:1fr}}"+
"#fletcher-compare .panel{background:#fff;border:1px solid var(--line);border-radius:3px;padding:14px}"+
"#fletcher-compare .panel h2{font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mid);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--line-soft)}"+
"#fletcher-compare .fgrp{margin-bottom:16px}"+
"#fletcher-compare .flab{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:6px;display:block}"+
"#fletcher-compare select,#fletcher-compare input[type=search]{width:100%;padding:7px 8px;border:1px solid var(--line);border-radius:2px;font-family:inherit;font-size:13px;background:#fff;color:var(--ink)}"+
"#fletcher-compare select:focus,#fletcher-compare input:focus{outline:2px solid var(--steel-400);outline-offset:1px}"+
"#fletcher-compare .chips{display:flex;flex-wrap:wrap;gap:4px}"+
"#fletcher-compare .chip{font-family:'JetBrains Mono',monospace;font-size:11px;padding:4px 8px;border:1px solid var(--line);background:#fff;border-radius:2px;cursor:pointer;color:var(--ink-mid);transition:all .12s;text-align:left}"+
"#fletcher-compare .chip:hover{border-color:var(--steel-400)}"+
"#fletcher-compare .chip[aria-pressed=true]{background:var(--steel-800);border-color:var(--steel-800);color:#fff}"+
"#fletcher-compare .rangeRow{display:flex;gap:6px;align-items:center}"+
"#fletcher-compare .rangeRow input{width:100%;padding:6px;border:1px solid var(--line);border-radius:2px;font-family:'JetBrains Mono',monospace;font-size:12px}"+
"#fletcher-compare .rangeRow span{color:var(--ink-soft);font-size:11px}"+
"#fletcher-compare .reset{width:100%;padding:8px;background:none;border:1px solid var(--line);border-radius:2px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-mid);cursor:pointer}"+
"#fletcher-compare .reset:hover{background:var(--steel-900);color:#fff;border-color:var(--steel-900)}"+
"#fletcher-compare .tblwrap{background:#fff;border:1px solid var(--line);border-radius:3px;overflow-x:auto}"+
"#fletcher-compare table{width:100%;border-collapse:collapse;font-size:13px}"+
"#fletcher-compare thead th{background:var(--steel-900);color:#fff;font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:12px;letter-spacing:.08em;text-transform:uppercase;padding:9px 10px;text-align:left;white-space:nowrap;cursor:pointer;user-select:none;position:sticky;top:0;z-index:2}"+
"#fletcher-compare thead th:hover{background:var(--steel-700)}"+
"#fletcher-compare thead th .ar{color:var(--amber);margin-left:3px;font-size:10px}"+
"#fletcher-compare tbody td{padding:8px 10px;border-bottom:1px solid var(--line-soft);white-space:nowrap}"+
"#fletcher-compare tbody tr:hover{background:#f2f6f8}"+
"#fletcher-compare tbody tr.sel{background:#fdf6e4}"+
"#fletcher-compare .num{font-family:'JetBrains Mono',monospace;font-weight:500;text-align:right}"+
"#fletcher-compare .fam{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;letter-spacing:.02em}"+
"#fletcher-compare .cbx{width:34px;text-align:center}"+
"#fletcher-compare input[type=checkbox]{width:15px;height:15px;accent-color:var(--amber-dim);cursor:pointer}"+
"#fletcher-compare .empty{padding:48px 20px;text-align:center;color:var(--ink-mid)}"+
"#fletcher-compare .empty strong{display:block;font-family:'Barlow Condensed',sans-serif;font-size:18px;text-transform:uppercase;margin-bottom:6px;color:var(--ink)}"+
"#fletcher-compare .tray{position:sticky;bottom:0;margin-top:0;background:var(--steel-900);color:#fff;border-radius:3px 3px 0 0;padding:12px 16px;display:none;box-shadow:0 -6px 20px rgba(18,33,46,.22);z-index:20}"+
"#fletcher-compare .tray.on{display:flex;align-items:center;gap:14px;flex-wrap:wrap}"+
"#fletcher-compare .tray .lbl{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--steel-400)}"+
"#fletcher-compare .tray .picks{display:flex;gap:6px;flex-wrap:wrap;flex:1}"+
"#fletcher-compare .pick{background:var(--steel-700);border-radius:2px;padding:4px 8px;font-size:12px;font-family:'JetBrains Mono',monospace;display:flex;align-items:center;gap:6px}"+
"#fletcher-compare .pick button{background:none;border:none;color:var(--steel-400);cursor:pointer;font-size:14px;line-height:1;padding:0}"+
"#fletcher-compare .pick button:hover{color:var(--amber)}"+
"#fletcher-compare .btn{background:var(--amber);color:var(--steel-900);border:none;border-radius:2px;padding:9px 18px;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}"+
"#fletcher-compare .btn:hover{background:#f0b32c}"+
"#fletcher-compare .btn:disabled{background:var(--steel-700);color:var(--steel-400);cursor:not-allowed}"+
"#fletcher-compare .cmp{margin-top:20px;background:#fff;border:1px solid var(--line);border-radius:3px;overflow-x:auto;display:none}"+
"#fletcher-compare .cmp.on{display:block}"+
"#fletcher-compare .cmp h2{font-family:'Barlow Condensed',sans-serif;font-size:20px;text-transform:uppercase;letter-spacing:.02em;padding:14px 16px;border-bottom:2px solid var(--steel-900)}"+
"#fletcher-compare .cmp table{font-size:13px}"+
"#fletcher-compare .cmp th.rowlab{background:#fff;color:var(--ink-mid);font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.09em;text-transform:uppercase;font-weight:500;text-align:left;padding:9px 14px;border-bottom:1px solid var(--line-soft);border-right:1px solid var(--line);cursor:default;position:static}"+
"#fletcher-compare .cmp th.rowlab:hover{background:#fff}"+
"#fletcher-compare .cmp td{text-align:center;font-family:'JetBrains Mono',monospace;font-weight:500}"+
"#fletcher-compare .cmp td.best{background:#eaf5ee;color:var(--good);font-weight:700}"+
"#fletcher-compare .cmp thead td{font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700;padding:10px;background:var(--steel-800);color:#fff;text-transform:uppercase}"+
"#fletcher-compare .grouphdr th{background:var(--steel-700);color:var(--amber);font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;text-align:left;padding:7px 14px;font-weight:700;position:static}"+
"#fletcher-compare .difftoggle{float:right;font-family:Inter,sans-serif;font-size:12px;text-transform:none;letter-spacing:0;font-weight:400;color:var(--ink-mid);display:flex;align-items:center;gap:6px}"+
"#fletcher-compare .difftoggle input{width:14px;height:14px;accent-color:var(--amber-dim)}"+
"#fletcher-compare .note{font-size:11px;color:var(--ink-soft);padding:10px 16px;border-top:1px solid var(--line-soft)}"+
"#fletcher-compare .calc{background:var(--steel-900);color:#fff;border-radius:3px;padding:16px;margin-bottom:16px}"+
"#fletcher-compare .calc h2{font-family:'Barlow Condensed',sans-serif;font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:var(--amber);margin-bottom:4px;border:none;padding:0}"+
"#fletcher-compare .calc .hint{font-size:11px;color:var(--steel-400);margin-bottom:12px;line-height:1.45}"+
"#fletcher-compare .calc .flab{color:var(--steel-400)}"+
"#fletcher-compare .calc select,#fletcher-compare .calc input{background:var(--steel-800);border-color:var(--steel-700);color:#fff}"+
"#fletcher-compare .calc select option{background:var(--steel-800)}"+
"#fletcher-compare .calc .fgrp{margin-bottom:12px}"+
"#fletcher-compare .warnbox{background:rgba(224,161,27,.12);border-left:2px solid var(--amber);padding:8px 10px;font-size:11px;color:#f3e2bb;line-height:1.45;margin-top:10px}"+
"#fletcher-compare .toggle{display:flex;align-items:center;gap:7px;margin-top:12px;cursor:pointer;font-size:12px}"+
"#fletcher-compare .toggle input{width:15px;height:15px;accent-color:var(--amber)}"+
"#fletcher-compare .fit{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.05em;text-transform:uppercase;padding:3px 7px;border-radius:2px;white-space:nowrap;font-weight:700}"+
"#fletcher-compare .fit.ok{background:#e3f2e9;color:var(--good)}"+
"#fletcher-compare .fit.no{background:#fbe9e9;color:#a33}"+
"#fletcher-compare .fit.tight{background:#fdf3dd;color:var(--warn)}"+
"#fletcher-compare .usable{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--ink-mid);display:block;margin-top:2px}"+
"#fletcher-compare .cta{background:#fff;border:1px solid var(--line);border-top:3px solid var(--amber);border-radius:0 0 3px 3px;padding:16px;margin-top:0}"+
"#fletcher-compare .cta h3{font-family:'Barlow Condensed',sans-serif;font-size:19px;text-transform:uppercase;letter-spacing:.02em;margin-bottom:4px}"+
"#fletcher-compare .cta p{color:var(--ink-mid);font-size:13px;margin-bottom:12px;max-width:56ch}"+
"#fletcher-compare .ctaform{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start}"+
"#fletcher-compare .ctaform input{flex:1;min-width:170px;padding:9px 10px;border:1px solid var(--line);border-radius:2px;font-family:inherit;font-size:13px}"+
"#fletcher-compare .done{background:#e3f2e9;border-left:3px solid var(--good);padding:12px 14px;color:var(--good);font-size:13px;font-weight:500}"+
"#fletcher-compare .fberr{background:#fbe9e9;border-left:3px solid #a33;padding:12px 14px;color:#a33;font-size:13px;margin-top:10px}"+
"#fletcher-compare details.more{border-top:1px solid var(--line-soft);margin-top:2px;padding-top:12px}"+
"#fletcher-compare details.more>summary{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--steel-700);cursor:pointer;margin-bottom:14px;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:8px}"+
"#fletcher-compare details.more>summary::-webkit-details-marker{display:none}"+
"#fletcher-compare details.more>summary::after{content:'+';font-size:15px;line-height:1}"+
"#fletcher-compare details.more[open]>summary::after{content:'\\2013'}"+
"#fletcher-compare .badge{background:var(--amber);color:var(--steel-900);border-radius:2px;padding:1px 5px;font-size:9px;font-weight:700;letter-spacing:.04em}"+
"#fletcher-compare .showmore{background:none;border:none;color:var(--steel-500);font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;padding:5px 0 0;text-decoration:underline}"+
"#fletcher-compare .chip.hid{display:none}";
  document.head.appendChild(s);

  var host=document.getElementById('fletcher-compare');
  if(!host){host=document.createElement('div');host.id='fletcher-compare';document.body.appendChild(host);}
  host.innerHTML="<div class=\"wrap\">\n<div class=\"hd\">\n<div class=\"eyebrow\">Fletcher Report · Spec Index</div>\n<h1>Trailer Comparison</h1>\n<p class=\"sub\">Every spec verified against the manufacturer's own published figures.\nShowing <span class=\"count\" id=\"shown\">0</span> of <span class=\"count\" id=\"total\">0</span> models.</p>\n</div>\n<div class=\"cols\">\n<div>\n<section class=\"calc\">\n<h2>Will it pull?</h2>\n<p class=\"hint\">Enter your truck's real numbers from the door-jamb sticker. Ratings vary\nwidely by cab, bed, axle and engine — presets are rough starting points only.</p>\n<div class=\"fgrp\"><span class=\"flab\">Truck class (starting point)</span>\n<select id=\"preset\"><option value=\"\">Choose or enter your own…</option></select></div>\n<div class=\"fgrp\"><span class=\"flab\">Max trailer weight (lb)</span>\n<input type=\"number\" id=\"towcap\" placeholder=\"e.g. 18000\"></div>\n<div class=\"fgrp\"><span class=\"flab\">Payload left for hitch (lb)</span>\n<input type=\"number\" id=\"towpay\" placeholder=\"e.g. 2400\"></div>\n<div class=\"fgrp\"><span class=\"flab\">Hitch setup</span>\n<select id=\"hitch\">\n<option value=\"0.13\">Bumper pull — 13% tongue</option>\n<option value=\"0.22\">Gooseneck — 22% pin</option>\n</select></div>\n<label class=\"toggle\"><input type=\"checkbox\" id=\"onlyfit\">Only show what my truck can pull</label>\n<div class=\"warnbox\">Payload left = your truck's payload rating minus passengers, fuel,\ntoolboxes and bed cargo. Subtract those first or the math lies to you.</div>\n<div class=\"warnbox\" style=\"border-left-color:#e05b5b;background:rgba(224,91,91,.12);color:#f5cfcf\">\n<strong>This is an estimate, not a tow rating.</strong> Figures here are a planning aid only.\nYour vehicle's door-jamb sticker, owner's manual, and the trailer's own certification label\nare the only authoritative numbers. Confirm with your dealer before towing.</div>\n</section>\n<aside class=\"panel\" id=\"filters\"><h2>Narrow results</h2><div id=\"fbody\"></div>\n<button class=\"reset\" id=\"reset\">Clear all filters</button></aside>\n</div>\n<main>\n<div class=\"tblwrap\">\n<table id=\"tbl\"><thead id=\"thead\"></thead><tbody id=\"tbody\"></tbody></table>\n<div class=\"empty\" id=\"empty\" style=\"display:none\">\n<strong>No models match</strong>Widen a filter or clear them all to start over.</div>\n</div>\n<div class=\"cmp\" id=\"cmp\">\n<h2>Side by side <label class=\"difftoggle\"><input type=\"checkbox\" id=\"diffonly\">Only show differences</label></h2>\n<table><thead id=\"cmphead\"></thead><tbody id=\"cmpbody\"></tbody></table>\n<p class=\"note\">Green marks the strongest figure in each row. Payload and curb weight are\nmanufacturer-published for that exact configuration.</p>\n</div>\n<div class=\"cta\" id=\"cta\" style=\"display:none\">\n<h3>What were you hoping to find?</h3>\n<p>We're building this out brand by brand. Tell us what's missing and it moves up the queue.\nNo email needed — we're not collecting anything.</p>\n<div class=\"ctaform\" id=\"ctaform\">\n<input type=\"text\" id=\"fbtext\" placeholder=\"e.g. Big Tex 14GN, or dump trailer prices\"\nmaxlength=\"200\" style=\"flex:2\">\n<button class=\"btn\" id=\"fbsend\">Send</button>\n</div>\n</div>\n</main>\n</div>\n<div class=\"tray\" id=\"tray\">\n<span class=\"lbl\">Comparing</span>\n<div class=\"picks\" id=\"picks\"></div>\n<button class=\"btn\" id=\"go\">Compare</button>\n</div>\n</div>";

  /* HTML-escape anything that goes into markup. */
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const SCHEMA={vertical:'trailers',groupOrder:['Capacity','Deck','Axles & Suspension','Coupler & Jack','Wheels & Tires','Frame & Finish','Warranty'],fields:[{key:'brand',label:'Brand',short:'Brand',browse:true,filter:'chips',better:null,group:'Capacity'},{key:'family',label:'Model',short:'Model',browse:true,filter:'chips',better:null,group:'Capacity'},{key:'gvwr',label:'GVWR',short:'GVWR',unit:' lb',type:'num',browse:true,filter:'range',better:'high',group:'Capacity'},{key:'payload',label:'Payload capacity',short:'Payload',unit:' lb',type:'num',browse:true,filter:'range',better:'high',group:'Capacity'},{key:'curb',label:'Curb weight',short:'Curb',unit:' lb',type:'num',browse:true,filter:false,better:'low',group:'Capacity'},{key:'axles',label:'Axle count',short:'Axles',type:'num',browse:true,filter:'chips',better:null,group:'Capacity'},{key:'category',label:'Category',short:'Type',browse:false,filter:'chips',better:null,group:'Capacity'},{key:'hitch',label:'Hitch type',short:'Hitch',browse:false,filter:'chips',better:null,group:'Capacity'},{key:'length',label:'Overall length',short:'Length',unit:"'",type:'num',browse:true,filter:'range',better:'high',group:'Deck'},{key:'deckLen',label:'Deck length',short:'Deck',unit:"'",type:'num',browse:false,filter:false,better:'high',group:'Deck'},{key:'width',label:'Deck width',short:'Width',unit:'"',type:'num',browse:false,filter:'chips',better:'high',group:'Deck'},{key:'axleBrand',label:'Axle brand',short:'Axle Mfr',browse:true,filter:'chips',better:null,group:'Axles & Suspension'},{key:'rating',label:'Axle rating (ea.)',short:'Axle',unit:' lb',type:'num',browse:false,filter:false,better:'high',group:'Axles & Suspension'},{key:'suspension',label:'Suspension',short:'Susp',browse:false,filter:'chips',better:null,group:'Axles & Suspension'},{key:'brake',label:'Brake system',short:'Brakes',browse:false,filter:'chips',better:null,group:'Axles & Suspension'},{key:'axleLube',label:'Axle lubrication',short:'Lube',browse:false,filter:false,better:null,group:'Axles & Suspension'},{key:'coupler',label:'Coupler type',short:'Coupler',browse:true,filter:'chips',better:null,group:'Coupler & Jack'},{key:'couplerBrand',label:'Coupler brand',short:'Cplr Mfr',browse:false,filter:'chips',better:null,group:'Coupler & Jack'},{key:'jack',label:'Jack type',short:'Jack',browse:false,filter:'chips',better:null,group:'Coupler & Jack'},{key:'tire',label:'Tire size',short:'Tires',browse:true,filter:'chips',better:null,group:'Wheels & Tires'},{key:'tireLoad',label:'Tire load rating',short:'Load',browse:false,filter:false,better:null,group:'Wheels & Tires'},{key:'frameMat',label:'Main frame material',short:'Frame',browse:false,filter:'chips',better:null,group:'Frame & Finish'},{key:'crossmember',label:'Crossmember spacing',short:'X-mbr',unit:'"',type:'num',browse:false,filter:false,better:'low',group:'Frame & Finish'},{key:'ibeamWt',label:'Frame I-beam weight',short:'I-beam',unit:' lb/ft',type:'num',browse:false,filter:false,better:'high',group:'Frame & Finish'},{key:'ibeamHt',label:'Frame I-beam height',short:'I-ht',unit:'"',type:'num',browse:false,filter:false,better:'high',group:'Frame & Finish'},{key:'paint',label:'Paint system',short:'Paint',browse:false,filter:'chips',better:null,group:'Frame & Finish'},{key:'fenderMount',label:'Fender mount',short:'Fender',browse:false,filter:false,better:null,group:'Frame & Finish'},{key:'extLight',label:'Exterior lighting',short:'Lights',browse:false,filter:'chips',better:null,group:'Frame & Finish'},{key:'plug',label:'Plug type',short:'Plug',browse:false,filter:false,better:null,group:'Frame & Finish'},{key:'country',label:'Country of manufacture',short:'Origin',browse:false,filter:'chips',better:null,group:'Frame & Finish'},{key:'warranty',label:'Structural warranty',short:'Warranty',browse:false,filter:'chips',better:null,group:'Warranty'},{key:'coating',label:'Coating warranty',short:'Coating',browse:false,filter:false,better:null,group:'Warranty'}]};

  const DATA_URL="https://cdn.jsdelivr.net/gh/justincfletcher/fletcherreport@main/datasets.js";

  /* ---------------- Feedback configuration ----------------
     Priority: endpoint first, then the Webflow form.
     If NEITHER is available the feedback box is not rendered at all — the tool
     will never tell someone their note was recorded when it wasn't.

     endpoint : any URL that accepts a JSON POST (Formspree, Basin, Zapier,
                Make, a Cloud Function...). Leave "" to use the Webflow form.
     webflowFormId : dom id of a Webflow form on the page. One already exists on
                /compare with fields "Wanted" and "Context" (inputs #fb-wanted
                and #fb-context). Submissions land in Webflow > Forms.
     contactEmail : optional. Shown only in the failure message. Leave "" to omit. */
  const FEEDBACK={endpoint:"",webflowFormId:"fletcher-feedback-form",contactEmail:""};

  /* Filters shown without expanding "More filters". Everything else is secondary. */
  const TIER1=['brand','family','category','hitch','gvwr','payload','length','axles'];
  const CHIP_LIMIT=10;               /* chips shown before "show all" kicks in */
  const noResultLog=[];              /* filter combos that returned nothing, this session */
  const DATA=[];let COLS=[],F=[],BROWSE=[],GROUPS=[];
  const VALS={};                    /* field key -> array of distinct values, index-addressable */
  const byKey=k=>F.find(f=>f.key===k);
  function initFields(){const HAS=k=>DATA.some(d=>d[k]!=null);F=SCHEMA.fields.filter(f=>HAS(f.key));BROWSE=F.filter(f=>f.browse);GROUPS=SCHEMA.groupOrder.filter(g=>F.some(f=>f.group===g));}

  const state={chips:{},sel:{},range:{},sort:{key:'gvwr',dir:-1},picks:[],tow:{cap:null,pay:null,pct:0.13,only:false}};
  const PRESETS=[{n:'Half-ton (F-150 / 1500 class)',cap:11000,pay:1800},{n:'3/4-ton gas (F-250 / 2500 class)',cap:15000,pay:3000},{n:'3/4-ton diesel (F-250 / 2500 class)',cap:18000,pay:2800},{n:'1-ton SRW (F-350 / 3500 class)',cap:22000,pay:4000},{n:'1-ton dually (F-350 / 3500 DRW)',cap:30000,pay:5800}];

  function fit(d){const t=state.tow;if(t.cap==null&&t.pay==null)return null;const tongue=Math.round(d.gvwr*t.pct);const overTow=t.cap!=null&&d.gvwr>t.cap;const overPay=t.pay!=null&&tongue>t.pay;let usable=d.payload;if(t.cap!=null&&d.curb!=null)usable=Math.min(usable??Infinity,t.cap-d.curb);if(usable===Infinity||usable<0)usable=usable<0?0:null;const margin=t.cap!=null?(t.cap-d.gvwr)/t.cap:1;return{ok:!overTow&&!overPay,tight:!overTow&&!overPay&&margin<0.08,why:overTow?'Over tow rating':(overPay?'Over truck payload':null),tongue,usable};}

  const fmt=(v,f)=>v==null?'—':(f.type==='num'?v.toLocaleString():v)+(v!=null&&f.unit?f.unit:'');
  const uniq=k=>[...new Set(DATA.map(d=>d[k]).filter(v=>v!=null))].sort((a,b)=>typeof a==='number'?a-b:String(a).localeCompare(String(b)));

  function groupHtml(f){
    const h=[`<div class="fgrp" data-g="${esc(f.key)}"><span class="flab">${esc(f.label)}</span>`];
    if(f.filter==='chips'){
      state.chips[f.key]=state.chips[f.key]||new Set();
      const vals=uniq(f.key);VALS[f.key]=vals;                       /* keep original types */
      h.push('<div class="chips">'+vals.map((v,i)=>
        `<button class="chip${i>=CHIP_LIMIT?' hid':''}" type="button" data-c="${esc(f.key)}" data-i="${i}" aria-pressed="false">`+
        `${esc(v)}${f.unit&&f.key!=='family'?esc(f.unit):''}</button>`).join('')+'</div>');
      if(vals.length>CHIP_LIMIT)
        h.push(`<button class="showmore" type="button" data-more="${esc(f.key)}">Show all ${vals.length}</button>`);
    }else if(f.filter==='select'){
      const vals=uniq(f.key);VALS[f.key]=vals;
      h.push(`<select data-s="${esc(f.key)}"><option value="">Any</option>`+
        vals.map((v,i)=>`<option value="${i}">${esc(fmt(v,f))}</option>`).join('')+'</select>');
    }else if(f.filter==='range'){
      const vs=uniq(f.key);
      h.push(`<div class="rangeRow"><input type="number" data-r="${esc(f.key)}" data-b="min" placeholder="${esc(vs[0])}"><span>to</span><input type="number" data-r="${esc(f.key)}" data-b="max" placeholder="${esc(vs[vs.length-1])}"></div>`);
    }
    h.push('</div>');
    return h.join('');
  }

  /* How many secondary filters are currently doing something. Surfaced on the
     "More filters" summary so a collapsed filter is never silently active. */
  function tier2ActiveCount(){
    let n=0;
    F.filter(f=>f.filter&&!TIER1.includes(f.key)).forEach(f=>{
      if(state.chips[f.key]&&state.chips[f.key].size)n++;
      else if(state.sel[f.key]!=null)n++;
      else{const r=state.range[f.key];if(r&&(r.min!=null||r.max!=null))n++;}
    });
    return n;
  }
  function updateMoreCount(){
    const el=document.getElementById('morecount');if(!el)return;
    const n=tier2ActiveCount();
    el.innerHTML=n?`<span class="badge">${n} active</span>`:'';
  }

  function buildFilters(){
    const usable=F.filter(f=>f.filter);
    const t1=usable.filter(f=>TIER1.includes(f.key)).map(groupHtml);
    const t2=usable.filter(f=>!TIER1.includes(f.key)).map(groupHtml);
    let html=t1.join('');
    if(t2.length)html+=`<details class="more"><summary><span>More filters</span><span id="morecount"></span></summary>${t2.join('')}</details>`;
    document.getElementById('fbody').innerHTML=html;

    document.querySelectorAll('#fbody .chip').forEach(b=>b.onclick=()=>{
      const key=b.dataset.c,s=state.chips[key],v=VALS[key][+b.dataset.i];   /* exact original value */
      if(s.has(v)){s.delete(v);b.setAttribute('aria-pressed','false');}
      else{s.add(v);b.setAttribute('aria-pressed','true');}
      render();
    });
    document.querySelectorAll('#fbody [data-more]').forEach(b=>b.onclick=()=>{
      const g=b.closest('.fgrp'),hidden=g.querySelectorAll('.chip.hid');
      if(hidden.length){hidden.forEach(c=>c.classList.remove('hid'));b.textContent='Show fewer';}
      else{g.querySelectorAll('.chip').forEach((c,i)=>{if(i>=CHIP_LIMIT)c.classList.add('hid');});
        b.textContent='Show all '+g.querySelectorAll('.chip').length;}
    });
    document.querySelectorAll('#fbody [data-s]').forEach(el=>el.onchange=()=>{
      state.sel[el.dataset.s]=el.value===''?null:VALS[el.dataset.s][+el.value];
      render();
    });
    document.querySelectorAll('#fbody [data-r]').forEach(el=>el.oninput=()=>{
      const k=el.dataset.r;state.range[k]=state.range[k]||{};
      state.range[k][el.dataset.b]=el.value===''?null:+el.value;
      render();
    });
    updateMoreCount();
  }

  function filtered(){return DATA.filter(d=>{
    for(const k in state.chips){const s=state.chips[k];if(s.size&&!s.has(d[k]))return false;}
    for(const k in state.sel){if(state.sel[k]!=null&&d[k]!==state.sel[k])return false;}
    for(const k in state.range){const r=state.range[k];if(r.min!=null&&(d[k]==null||d[k]<r.min))return false;if(r.max!=null&&(d[k]==null||d[k]>r.max))return false;}
    return true;});}

  function render(){
    let rows=filtered();
    const hasTow=state.tow.cap!=null||state.tow.pay!=null;
    if(hasTow&&state.tow.only)rows=rows.filter(d=>{const f=fit(d);return f&&f.ok;});
    const sk=state.sort.key,sd=state.sort.dir;
    rows.sort((a,b)=>{const x=a[sk],y=b[sk];if(x==null)return 1;if(y==null)return-1;return(typeof x==='number'?x-y:String(x).localeCompare(String(y)))*sd;});
    document.getElementById('thead').innerHTML='<tr><th class="cbx"></th>'+(hasTow?'<th>Fit</th>':'')+
      BROWSE.map(f=>`<th data-k="${esc(f.key)}">${esc(f.short)}${sk===f.key?`<span class="ar">${sd>0?'▲':'▼'}</span>`:''}</th>`).join('')+'</tr>';
    document.querySelectorAll('#thead [data-k]').forEach(th=>th.onclick=()=>{const k=th.dataset.k;state.sort=sk===k?{key:k,dir:-sd}:{key:k,dir:byKey(k).type==='num'?-1:1};render();});
    document.getElementById('tbody').innerHTML=rows.map(d=>{
      let fc='';
      if(hasTow){const f=fit(d);const cls=f.ok?(f.tight?'tight':'ok'):'no';const lbl=f.ok?(f.tight?'Tight':'Fits'):f.why;
        fc=`<td><span class="fit ${cls}">${esc(lbl)}</span>`+(f.ok&&f.usable!=null?`<span class="usable">haul ${f.usable.toLocaleString()}lb</span>`:'')+'</td>';}
      return`<tr class="${state.picks.includes(d._i)?'sel':''}"><td class="cbx"><input type="checkbox" data-p="${d._i}"${state.picks.includes(d._i)?' checked':''}${state.picks.length>=4&&!state.picks.includes(d._i)?' disabled':''}></td>`+fc+
        BROWSE.map(f=>`<td class="${f.type==='num'?'num':(f.key==='family'?'fam':'')}">${esc(fmt(d[f.key],f))}</td>`).join('')+'</tr>';
    }).join('');
    document.querySelectorAll('#tbody [data-p]').forEach(cb=>cb.onchange=()=>{
      const i=+cb.dataset.p;
      if(cb.checked){if(state.picks.length<4)state.picks.push(i);}else state.picks=state.picks.filter(p=>p!==i);
      render();tray();});
    document.getElementById('shown').textContent=rows.length;
    document.getElementById('total').textContent=DATA.length;
    document.getElementById('empty').style.display=rows.length?'none':'block';
    document.getElementById('tbl').style.display=rows.length?'':'none';
    if(!rows.length)trackEmpty();
    updateMoreCount();
  }

  const name=d=>`${d.family} ${d.length}′ ${(d.gvwr/1000).toLocaleString(undefined,{maximumFractionDigits:1})}K`;

  function tray(){
    const t=document.getElementById('tray');
    t.classList.toggle('on',state.picks.length>0);
    document.getElementById('picks').innerHTML=state.picks.map(i=>`<span class="pick">${esc(name(DATA[i]))}<button type="button" data-x="${i}">×</button></span>`).join('');
    document.querySelectorAll('#picks [data-x]').forEach(b=>b.onclick=()=>{state.picks=state.picks.filter(p=>p!==+b.dataset.x);render();tray();if(state.picks.length<2)document.getElementById('cmp').classList.remove('on');});
    document.getElementById('go').disabled=state.picks.length<2;
  }

  function renderCompare(){
    const picks=state.picks.map(i=>DATA[i]);
    document.getElementById('cmphead').innerHTML='<tr><th class="rowlab">Spec</th>'+picks.map(d=>`<td>${esc(name(d))}</td>`).join('')+'</tr>';
    const diffOnly=document.getElementById('diffonly').checked;
    let html='';
    GROUPS.forEach(g=>{
      const rows=F.filter(f=>f.group===g&&f.key!=='brand'&&f.key!=='family').map(f=>{
        const vals=picks.map(d=>d[f.key]);
        if(vals.every(v=>v==null))return'';
        if(diffOnly&&new Set(vals.map(v=>String(v))).size===1)return'';
        let best=null;
        if(f.better&&f.type==='num'){const nums=vals.filter(v=>v!=null);if(nums.length>1)best=f.better==='high'?Math.max(...nums):Math.min(...nums);}
        return`<tr><th class="rowlab">${esc(f.label)}</th>`+vals.map(v=>`<td class="${best!=null&&v===best?'best':''}">${esc(fmt(v,f))}</td>`).join('')+'</tr>';
      }).filter(Boolean).join('');
      if(rows)html+=`<tr class="grouphdr"><th colspan="${picks.length+1}">${esc(g)}</th></tr>`+rows;
    });
    document.getElementById('cmpbody').innerHTML=html+towRows(picks);
    const c=document.getElementById('cmp');c.classList.add('on');
    if(feedbackRoute())document.getElementById('cta').style.display='block';
    c.scrollIntoView({behavior:'smooth',block:'start'});
  }
  document.getElementById('go').onclick=renderCompare;

  function towRows(picks){
    const fits=picks.map(fit);
    if(fits.some(f=>f==null))return'';
    const tongues=fits.map(f=>f.tongue),minT=Math.min(...tongues);
    const use=fits.map(f=>f.usable).filter(v=>v!=null),maxU=use.length>1?Math.max(...use):null;
    return`<tr><th class="rowlab">Tongue/pin weight</th>`+fits.map(f=>`<td class="${f.tongue===minT?'best':''}">${f.tongue.toLocaleString()}lb</td>`).join('')+'</tr>'+
      `<tr><th class="rowlab">You can actually haul</th>`+fits.map(f=>`<td class="${maxU!=null&&f.usable===maxU?'best':''}">${f.usable==null?'—':f.usable.toLocaleString()+' lb'}</td>`).join('')+'</tr>'+
      `<tr><th class="rowlab">With your truck</th>`+fits.map(f=>`<td><span class="fit ${f.ok?(f.tight?'tight':'ok'):'no'}">${esc(f.ok?(f.tight?'Tight':'Fits'):f.why)}</span></td>`).join('')+'</tr>';
  }

  const $=id=>document.getElementById(id);
  $('preset').innerHTML='<option value="">Choose or enter your own…</option>'+PRESETS.map((p,i)=>`<option value="${i}">${esc(p.n)}</option>`).join('');
  $('preset').onchange=()=>{const p=PRESETS[$('preset').value];if(!p)return;$('towcap').value=p.cap;$('towpay').value=p.pay;readTow();};
  ['towcap','towpay'].forEach(id=>$(id).oninput=readTow);
  $('hitch').onchange=readTow;
  $('onlyfit').onchange=()=>{state.tow.only=$('onlyfit').checked;render();};
  function readTow(){state.tow.cap=$('towcap').value===''?null:+$('towcap').value;state.tow.pay=$('towpay').value===''?null:+$('towpay').value;state.tow.pct=+$('hitch').value;render();}

  function track(event,detail){window.dataLayer=window.dataLayer||[];window.dataLayer.push({event,...detail});}

  /* Which delivery route is actually available right now. null = none, in which
     case the feedback box is never shown. */
  function feedbackRoute(){
    if(FEEDBACK.endpoint)return 'endpoint';
    if(FEEDBACK.webflowFormId&&document.getElementById(FEEDBACK.webflowFormId))return 'webflow';
    return null;
  }

  function activeFilterSig(){
    const a=[];
    for(const k in state.chips)if(state.chips[k].size)a.push(k+':'+[...state.chips[k]].join('|'));
    for(const k in state.sel)if(state.sel[k]!=null)a.push(k+':'+state.sel[k]);
    for(const k in state.range){const r=state.range[k];
      if(r&&(r.min!=null||r.max!=null))a.push(k+':'+(r.min??'')+'-'+(r.max??''));}
    return a.join(', ');
  }

  /* Fill and submit the Webflow form, then wait for Webflow's own success or
     error state. Resolves false on timeout so we never fake a success. */
  function submitWebflowForm(wanted,context){
    return new Promise(resolve=>{
      const form=document.getElementById(FEEDBACK.webflowFormId);
      if(!form)return resolve(false);
      const wrap=form.closest('.w-form')||form.parentElement;
      const w=document.getElementById('fb-wanted'),c=document.getElementById('fb-context');
      if(!w||!c)return resolve(false);
      const setVal=(el,v)=>{el.value=v;
        el.dispatchEvent(new Event('input',{bubbles:true}));
        el.dispatchEvent(new Event('change',{bubbles:true}));};
      setVal(w,wanted);setVal(c,context);
      const done=wrap&&wrap.querySelector('.w-form-done'),fail=wrap&&wrap.querySelector('.w-form-fail');
      const shown=el=>el&&getComputedStyle(el).display!=='none';
      let settled=false;
      const finish=v=>{if(settled)return;settled=true;
        try{obs.disconnect();}catch(e){}clearTimeout(timer);resolve(v);};
      const obs=new MutationObserver(()=>{
        if(shown(done))finish(true);else if(shown(fail))finish(false);});
      if(done)obs.observe(done,{attributes:true,attributeFilter:['style','class']});
      if(fail)obs.observe(fail,{attributes:true,attributeFilter:['style','class']});
      const timer=setTimeout(()=>finish(false),10000);
      const btn=form.querySelector('input[type=submit],button[type=submit]');
      if(btn)btn.click();
      else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
      if(shown(done))finish(true);
    });
  }

  function feedbackError(){
    const cta=$('cta');
    let e=document.getElementById('fberr');
    if(!e){e=document.createElement('div');e.id='fberr';e.className='fberr';cta.appendChild(e);}
    e.textContent="That didn't send. Sorry — please try again in a moment."+
      (FEEDBACK.contactEmail?' Or email '+FEEDBACK.contactEmail+' and it will get read.':'');
  }

  async function sendFeedback(){
    const t=$('fbtext').value.trim();
    if(!t){$('fbtext').focus();return;}
    const btn=$('fbsend'),label=btn.textContent;
    btn.disabled=true;btn.textContent='Sending…';
    const err=document.getElementById('fberr');if(err)err.remove();

    const context=[
      'comparing: '+(state.picks.length?state.picks.map(i=>name(DATA[i])).join(' vs '):'nothing'),
      'filters: '+(activeFilterSig()||'none'),
      'empty searches: '+(noResultLog.slice(-5).join(' ; ')||'none')
    ].join(' | ');

    track('fletcher_feedback',{wanted:t,context});   /* still fires for GTM/GA4 if installed */

    let ok=false;
    try{
      if(FEEDBACK.endpoint){
        const r=await fetch(FEEDBACK.endpoint,{method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({wanted:t,context,page:location.pathname})});
        ok=r.ok;
      }else{
        ok=await submitWebflowForm(t,context);
      }
    }catch(e){ok=false;console.error('feedback submit failed',e);}

    if(ok){
      $('ctaform').outerHTML='<div class="done">Noted, thanks. That goes straight into what we build next.</div>';
    }else{
      btn.disabled=false;btn.textContent=label;
      feedbackError();
    }
  }
  $('fbsend').onclick=sendFeedback;

  let lastEmpty='';
  function trackEmpty(){
    const sig=activeFilterSig();
    if(sig&&sig!==lastEmpty){
      lastEmpty=sig;
      noResultLog.push(sig);
      if(noResultLog.length>20)noResultLog.shift();
      track('fletcher_no_results',{filters:sig});
    }
  }

  document.getElementById('diffonly').onchange=()=>{if(state.picks.length>1)renderCompare();};
  document.getElementById('reset').onclick=()=>{for(const k in state.chips)state.chips[k].clear();state.sel={};state.range={};state.picks=[];buildFilters();render();tray();document.getElementById('cmp').classList.remove('on');};

  async function boot(){
    const el=document.getElementById('tbody');
    el.innerHTML='<tr><td colspan="12" style="padding:40px;text-align:center;color:#5a6b78">Loading trailer data…</td></tr>';
    try{
      const txt=await(await fetch(DATA_URL,{cache:'no-cache'})).text();
      const mk=new Function(txt+"; return {COLS, DATASETS};");
      const{COLS:C,DATASETS:DS}=mk();
      window.COLS=C;let n=0;
      DS.forEach(ds=>ds.rows.forEach(r=>{const o={_i:n++,brand:ds.brand};C.forEach((c,j)=>{if(c!=='brand')o[c]=r[j];});DATA.push(o);}));
    }catch(e){
      el.innerHTML='<tr><td colspan="12" style="padding:40px;text-align:center;color:#a33">Could not load trailer data. Please refresh.</td></tr>';
      console.error('data load failed',e);return;
    }
    initFields();buildFilters();render();tray();
    if(!feedbackRoute()){const c=document.getElementById('cta');if(c)c.remove();
      console.info('fletcher: no feedback route configured — feedback box hidden');}
  }
  boot();
})();
