(function () {
  "use strict";
  var UOS = window.UOS = window.UOS || {};
  var R = 6371008.8, RAD = Math.PI / 180;
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function fail(message) { throw new Error(message); }
  function csv(text) {
    var rows = [], row = [], field = "", quoted = false;
    text = String(text).replace(/^\uFEFF/, "");
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"') { if (field.trim()) fail("Malformed CSV quotation."); quoted = true; }
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field.replace(/\r$/, "")); if (row.some(function (v) { return v.trim(); })) rows.push(row); row = []; field = ""; }
      else field += c;
    }
    if (quoted) fail("Unclosed CSV quotation.");
    if (field || row.length) { row.push(field.replace(/\r$/, "")); if (row.some(function (v) { return v.trim(); })) rows.push(row); }
    return rows;
  }
  function finite(value, label) { if (value == null || String(value).trim() === "" || !Number.isFinite(Number(value))) fail(label + " must be a finite number."); return Number(value); }
  function cross(a,b,c) { return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]); }
  function on(a,b,p) { return Math.abs(cross(a,b,p)) < 1e-9 && p[0]>=Math.min(a[0],b[0])-1e-9 && p[0]<=Math.max(a[0],b[0])+1e-9 && p[1]>=Math.min(a[1],b[1])-1e-9 && p[1]<=Math.max(a[1],b[1])+1e-9; }
  function intersects(a,b,c,d) { var x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b); return (x*y<0 && z*w<0) || on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b); }
  function ring(points) {
    var p=points.map(function (v) { return [finite(v[0],"X"),finite(v[1],"Y")]; });
    if(p.length>1 && p[0][0]===p[p.length-1][0] && p[0][1]===p[p.length-1][1]) p.pop();
    if(p.length<3 || new Set(p.map(JSON.stringify)).size!==p.length) fail("A polygon requires at least three distinct vertices, without repeated interior points.");
    for(var i=0;i<p.length;i++) for(var j=i+1;j<p.length;j++) {
      if(j===i+1 || (i===0 && j===p.length-1)) continue;
      if(intersects(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length])) fail("The outline crosses or touches itself.");
    }
    var area=0,length=0;
    p.forEach(function(a,i){ var b=p[(i+1)%p.length]; area+=a[0]*b[1]-b[0]*a[1]; length+=Math.hypot(b[0]-a[0],b[1]-a[1]); });
    area=Math.abs(area/2); if(!(area>1e-10)) fail("The polygon has no measurable area.");
    return {points:p.concat([p[0].slice()]),areaSqM:area,lengthM:length};
  }
  function parse(text, filename) {
    if(String(text).length>5000000) fail("Moasure CSV exceeds the 5 MB limit.");
    var rows=csv(text); if(rows.length<2) fail("The CSV needs a header and coordinate rows.");
    var headers=rows.shift().map(function(h){return h.trim().toLowerCase();});
    function col(name) { return headers.indexOf(name); }
    function axis(name) { var found=[]; headers.forEach(function(h,i){if(new RegExp("^"+name+":(m|cm|mm)$").test(h)) found.push(i);}); if(found.length!==1) fail("Select a Moasure CSV with one "+name.toUpperCase()+":m, :cm or :mm column."); var i=found[0], unit=headers[i].split(":")[1]; return {index:i,scale:unit==="mm"?.001:unit==="cm"?.01:1}; }
    var x=axis("x"),y=axis("y"),zi=headers.findIndex(function(h){return /^z:(m|cm|mm)$/.test(h);}), point=col("point"),layer=col("layer"),path=col("path"),groups={};
    if(point<0 || layer<0 || path<0) fail("Moasure CSV requires Layer, Path and Point columns.");
    rows.forEach(function(row,i){
      var layerId=String(row[layer]||"").trim(),pathId=String(row[path]||"").trim();
      if(!layerId || !pathId) fail("Missing Layer or Path on row "+(i+2)+".");
      var key=JSON.stringify([layerId,pathId]),g=groups[key];
      if(!g) g=groups[key]={key:key,layer:layerId,path:pathId,name:row[col("layer-name")]||"Layer "+layerId,points:[],reportedAreaSqM:null};
      var type=String(row[col("path-type")]||"Dot2Dot").trim().toLowerCase();
      if(type!=="dot2dot") fail("Unsupported Moasure Path-Type "+type+"; export a Dot2Dot outline.");
      var n=finite(row[point],"Point on row "+(i+2));
      if(g.points.some(function(p){return p.order===n;})) fail("Duplicate Point "+n+" in Layer "+layerId+", Path "+pathId+".");
      var z=zi<0?null:finite(row[zi],"Z")*(headers[zi].endsWith(":mm")?.001:headers[zi].endsWith(":cm")?.01:1);
      g.points.push({order:n,xyz:[finite(row[x.index],"X")*x.scale,finite(row[y.index],"Y")*y.scale,z]});
      var ai=col("area:m²"); if(ai>=0 && String(row[ai]||"").trim()) {
        var a=finite(row[ai],"Area:m²");if(a<0) fail("Reported area cannot be negative.");
        if(g.reportedAreaSqM!=null && g.reportedAreaSqM!==a) fail("Conflicting reported areas within one Path.");
        g.reportedAreaSqM=a;
      }
    });
    return {filename:String(filename||"Moasure.csv"),groups:Object.keys(groups).map(function(k){
      var g=groups[k];g.points.sort(function(a,b){return a.order-b.order;});
      var m=ring(g.points.map(function(p){return p.xyz;}));
      g.coordinates=m.points;g.areaSqM=m.areaSqM;g.lengthM=m.lengthM;return g;
    })};
  }
  function tree(coords,fn) { return typeof coords[0]==="number" ? fn(coords) : coords.map(function(c){return tree(c,fn);}); }
  function flat(coords) { return typeof coords[0]==="number" ? [coords] : coords.reduce(function(p,c){return p.concat(flat(c));},[]); }
  function place(coords,anchor,bearing) {
    var a=finite(bearing,"Rotation")*RAD,c=Math.cos(a),s=Math.sin(a),k=R*RAD,cos=Math.cos(anchor[1]*RAD);
    if(!Array.isArray(anchor)||anchor.length<2||!anchor.every(Number.isFinite)||Math.abs(anchor[0])>180||Math.abs(anchor[1])>=85) fail("Placement must be a valid map coordinate below 85° latitude.");
    return tree(coords,function(p){return [anchor[0]+(p[0]*c+p[1]*s)/(k*cos),anchor[1]+(-p[0]*s+p[1]*c)/k];});
  }
  function unplace(coords,anchor,bearing) {
    var a=bearing*RAD,c=Math.cos(a),s=Math.sin(a),k=R*RAD,cos=Math.cos(anchor[1]*RAD);
    return tree(coords,function(p){var x=(p[0]-anchor[0])*k*cos,y=(p[1]-anchor[1])*k;return [x*c-y*s,x*s+y*c];});
  }
  function measure(type,coords) {
    var area=0,length=0;
    function polygon(rings) { rings.forEach(function(points,i){var m=ring(points);area+=(i?-1:1)*m.areaSqM;length+=m.lengthM;}); }
    function line(points) { points.forEach(function(p,i){finite(p[0],"X");finite(p[1],"Y");if(i)length+=Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1]);}); }
    if(type==="Polygon")polygon(coords);else if(type==="MultiPolygon")coords.forEach(polygon);else if(type==="LineString")line(coords);else if(type==="MultiLineString")coords.forEach(line);else fail("Unsupported geometry.");
    if(area<0 || (type.indexOf("Polygon")>=0 && !area) || (type.indexOf("Line")>=0 && !length)) fail("Invalid local outline measurement.");
    return {areaSqM:area,lengthM:length};
  }
  function centroid(type,coords) {
    var sx=0,sy=0,total=0;
    function polygon(rings) {rings.forEach(function(p,i){
      var a=0,x=0,y=0;for(var k=0;k<p.length;k++){var q=p[(k+1)%p.length],cross=p[k][0]*q[1]-q[0]*p[k][1];a+=cross;x+=(p[k][0]+q[0])*cross;y+=(p[k][1]+q[1])*cross;}
      var weight=Math.abs(a)*(i?-1:1);if(a){sx+=x/(3*a)*weight;sy+=y/(3*a)*weight;total+=weight;}
    });}
    if(type==="Polygon")polygon(coords);else if(type==="MultiPolygon")coords.forEach(polygon);
    if(total)return [sx/total,sy/total];
    var p=flat(coords);return p.reduce(function(c,v){return [c[0]+v[0]/p.length,c[1]+v[1]/p.length];},[0,0]);
  }
  function rotate(basis,bearing) {
    var b=clone(basis),c=centroid(b.type,b.coordinates);
    var centre=place(c,b.anchor,b.bearing),offset=place(c,centre,bearing);
    b.anchor=[centre[0]-(offset[0]-centre[0]),centre[1]-(offset[1]-centre[1])];b.bearing=bearing;
    // Longitude metre scale changes with the adjusted anchor latitude.
    var projected=place(c,b.anchor,bearing);b.anchor[0]+=centre[0]-projected[0];
    return b;
  }
  UOS.MoasureGeometry={parse:parse,ring:ring,place:place,unplace:unplace,measure:measure,rotate:rotate,centroid:centroid,tree:tree,flat:flat};
}());
