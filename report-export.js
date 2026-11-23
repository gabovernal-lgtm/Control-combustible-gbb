(function(root){
'use strict';
const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const esc=v=>String(v??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const col=i=>String.fromCharCode(65+i);
function build(template,{rows,trucks,equipment,people,from='',to='',truck='',equipmentLabel=''}){
 const zip=root.fflate||require('./fflate.js'),files=zip.unzipSync(new Uint8Array(template));
 const source=zip.strFromU8(files['xl/worksheets/sheet2.xml']);
 const style=ref=>Number(source.match(new RegExp('r="'+ref+'" s="(\\d+)"'))[1]);
 const S={title:style('A2'),rule:style('A3'),context:style('A4'),label:style('A6'),kpi:style('A7'),integer:style('D10'),integerAlt:style('D11'),integerTotal:style('D12'),header:style('A9'),text:[style('C10'),style('C11')],date:[style('A10'),style('A11')],time:[style('B10'),style('B11')],num:[style('H10'),style('H11')],total:style('A12'),totalnum:style('H12')};
 const cell=(ref,v,s,f)=>'<c r="'+ref+'" s="'+s+'"'+(typeof v==='number'?' t="n">'+(f?'<f>'+esc(f)+'</f>':'')+'<v>'+v+'</v>':' t="inlineStr"><is><t xml:space="preserve">'+esc(v)+'</t></is>')+'</c>';
 const row=(n,cells,h=30)=>'<row r="'+n+'" ht="'+h+'" customHeight="1">'+cells+'</row>';
 const person=new Map(people.map(x=>[x.id,x.full_name])),eqs=new Map(equipment.map(x=>[x.id,x]));
 const dt=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const local=x=>{const p=Object.fromEntries(dt.formatToParts(new Date(x.delivered_at)).map(p=>[p.type,p.value]));return {date:Date.UTC(+p.year,+p.month-1,+p.day)/86400000+25569,time:(+p.hour*60+ +p.minute)/1440,day:+p.hour>=8&&+p.hour<20};};
 rows=rows.filter(x=>!x.deleted_at);const known=new Map(trucks.map(t=>[t.id,t]));
 const ids=[...new Set([...trucks.filter(t=>truck?t.id===truck:t.active!==false).map(t=>t.id),...rows.map(x=>x.truck_id)])];
 const used=new Set(['Resumen']);const groups=ids.map(id=>{const code=known.get(id)?.code||'Sin camión identificado';let name=('Camión '+code).replace(/[\\/?*\[\]:]/g,' ').slice(0,31),base=name,n=2;while(used.has(name))name=base.slice(0,27)+' '+n++;used.add(name);return {id,code,name,rows:rows.filter(x=>x.truck_id===id).sort((a,b)=>new Date(a.delivered_at)-new Date(b.delivered_at))};}).sort((a,b)=>a.code.localeCompare(b.code,'es',{numeric:true}));
 const sum=rs=>rs.reduce((s,x)=>s+Number(x.liters||0),0),qr=x=>!!(x._receiptProof||x.validation_method==='receiver_qr');
 const period='Período: '+(from||'Inicio de registros')+' al '+(to||'Último registro')+' · Hora de Chile'+(equipmentLabel?' · Equipo: '+equipmentLabel:'');
 function sheet(title,headers,widths,data,total,stats){
  const end=col(headers.length-1),last=9+data.length,totalRow=last+1;
  let content=row(2,cell('A2',title,S.title),32)+row(3,headers.map((_,i)=>cell(col(i)+'3','',S.rule)).join(''),4)+row(4,cell('A4',period,S.context),26)+row(5,cell('A5','Jornada día 08–20 h · Noche 20–08 h · Pendientes y conflictos identificados en Validación',S.context),25)+row(6,cell('A6','LITROS ENTREGADOS',S.label)+cell('D6','CARGAS',S.label),22)+row(7,cell('A7',stats.liters,S.kpi)+cell('D7',String(stats.count),S.title),30)+row(9,headers.map((v,i)=>cell(col(i)+'9',v,S.header)).join(''),34);
  data.forEach((r,i)=>{content+=row(i+10,r.map((x,j)=>cell(col(j)+(i+10),x.v,x.s??S.text[i%2],x.f)).join(''),36);});
  content+=row(totalRow,total.map((v,i)=>cell(col(i)+totalRow,v.v,v.s??S.total,v.f)).join(''),32);
  return '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="'+NS+'"><dimension ref="A1:'+end+totalRow+'"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="'+(headers.length===12?2:0)+'" ySplit="9" topLeftCell="'+(headers.length===12?'C':'A')+'10" activePane="'+(headers.length===12?'bottomRight':'bottomLeft')+'" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>'+widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols><sheetData>'+content+'</sheetData><autoFilter ref="A9:'+end+Math.max(last,9)+'"/><mergeCells count="4"><mergeCell ref="A2:'+end+'2"/><mergeCell ref="A4:'+end+'4"/><mergeCell ref="A5:'+end+'5"/><mergeCell ref="A7:C7"/></mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="8" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;LControl de Combustible GBB&amp;RPágina &amp;P de &amp;N</oddFooter></headerFooter></worksheet>';
 }
 const sheets=[];
 groups.forEach(g=>{
  const data=g.rows.map((x,i)=>{const p=local(x),e=eqs.get(x.equipment_id),proof=x._receiptProof;const values=[p.date,p.time,p.day?'Día':'Noche',x.shift||'',e?.internal_number||e?.code||x.other_equipment||'Sin equipo identificado',e?.plate||'',e?.category||'Otros',Number(x.liters||0),person.get(x.driver_id)||'Nombre no disponible',person.get(x.receiver_id)||proof?.receiver_name||(x.receiver_id?'Nombre no disponible':'Sin receptor registrado'),x._syncConflict?'Conflicto QR':x._local?'Pendiente de sincronizar':qr(x)?'QR verificado':'Registro histórico sin QR',x.notes||''];return values.map((v,j)=>({v,s:j===0?S.date[i%2]:j===1?S.time[i%2]:j===7?S.num[i%2]:S.text[i%2]}));});
  const total=Array.from({length:12},(_,j)=>({v:j===0?'TOTAL':j===7?sum(g.rows):'',s:j===7?S.totalnum:S.total,f:j===7&&data.length?'SUM(H10:H'+(9+data.length)+')':undefined}));
  sheets.push({name:g.name,xml:sheet('ENTREGAS · CAMIÓN '+g.code,['Fecha','Hora','Jornada','Turno','Equipo','Patente','Categoría','Litros','Conductor surtidor','Receptor','Validación','Observaciones'],[13,10,12,9,20,15,22,15,30,32,31,48],data,total,{liters:sum(g.rows),count:g.rows.length})});
 });
 const summary=groups.map(g=>[g.code,g.rows.length,sum(g.rows),sum(g.rows.filter(x=>local(x).day)),sum(g.rows.filter(x=>!local(x).day)),g.rows.filter(qr).length].map((v,j)=>({v,s:typeof v==='number'?((j===1||j===5)?(groups.indexOf(g)%2?S.integerAlt:S.integer):S.num[groups.indexOf(g)%2]):undefined})));
 const totals=[{v:'TOTAL GENERAL'},...Array.from({length:5},(_,j)=>({v:summary.reduce((s,r)=>s+Number(r[j+1].v),0),s:(j===0||j===4)?S.integerTotal:S.totalnum,f:summary.length?'SUM('+col(j+1)+'10:'+col(j+1)+(9+summary.length)+')':undefined}))];
 sheets.unshift({name:'Resumen',xml:sheet('CONTROL DE COMBUSTIBLE · RESUMEN',['Camión surtidor','Cargas','Litros entregados','Litros día','Litros noche','Cargas con QR'],[30,18,25,24,24,24],summary,totals,{liters:sum(rows),count:rows.length})});
 for(const key of Object.keys(files))if(key.startsWith('xl/worksheets/')||key==='xl/sharedStrings.xml')delete files[key];
 const enc=zip.strToU8;
 sheets.forEach((s,i)=>files['xl/worksheets/sheet'+(i+1)+'.xml']=enc(s.xml));
 files['xl/workbook.xml']=enc('<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="'+NS+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>'+sheets.map((s,i)=>'<sheet name="'+esc(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>');
 const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
 files['xl/_rels/workbook.xml.rels']=enc('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+rel+'worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rIdStyles" Type="'+rel+'styles" Target="styles.xml"/><Relationship Id="rIdTheme" Type="'+rel+'theme" Target="theme/theme1.xml"/></Relationships>');
 files['[Content_Types].xml']=enc('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'+sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>');
 return zip.zipSync(files,{level:6});
}
root.GBBReport={build};if(typeof module!=='undefined')module.exports=root.GBBReport;
})(typeof window!=='undefined'?window:globalThis);
