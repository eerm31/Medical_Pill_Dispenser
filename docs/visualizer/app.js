(function () {
  'use strict';
  var host=document.getElementById('sceneHost'), fallback=document.getElementById('webglFallback');
  var DATA=window.DISPENSER_CONCEPT_DATA, Controller=window.DispenserDemoController;
  var controller=new Controller(), renderer=null, scene=null, camera=null, root3d=null, drumGroup=null, targets={}, labels=[], pills={}, capToggle=document.getElementById('capsToggle'), labelToggle=document.getElementById('labelsToggle'), scannerToggle=document.getElementById('scannerSubsystemToggle');
  var last=performance.now(), lastStatus=0, orbit={theta:.72,phi:1.02,radius:330}, pointer=null, pinchDistance=0, previousSnapshot=null;
  var mechanismToggle=document.getElementById('mechanismToggle'), mechanismGroup=null, mechanismVisible=true;
  var SCAN_DX=-29, fixedAssemblyGroup=null, fixedGroup=null, scannerGroup=null, stationGroups={}, cartridgeLiftGroups={}, carriageGroup=null, tongueGroup=null, servoLinkageGroup=null, capHingeParts={}, assemblySchedule=DATA.assembly_schedule||null, placementById={}, groupById={}, tongueSpringEndpoints=null;
  var cameraTarget=new THREE.Vector3(-8,4,-12);
  var palette={}; DATA.palette.forEach(function (item) { palette[item.id]=item.three; });
  var recipeMap={}; DATA.component_recipes.forEach(function (r) { recipeMap[r.recipe_id]=r; });
  var componentMap={}, componentBases={}, capPivots={}, capPivotBases={}, scannerVisualObjects=[], scannerVisible=true, placedContainers={}, dimensionsToggle=document.getElementById('dimensionsToggle'), dimensionCategory=document.getElementById('dimensionCategory'), dimensionCategoryRow=document.getElementById('dimensionCategoryRow'), dimensionDetails=document.getElementById('dimensionDetails'), dimensionRecords=[], dimensionGroups={fixed:null,rotating:null}, dimensionCategoryGroups={};
  var integratedSubmeshMeshes={};
  function toThree(p){return new THREE.Vector3(p[0],p[2],-p[1]);}
  function mappedRotation(r){
    var x=r[0],y=r[1],z=r[2],sx=Math.sin(x),cx=Math.cos(x),sy=Math.sin(y),cy=Math.cos(y),sz=Math.sin(z),cz=Math.cos(z);
    var R=[[cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx],[sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx],[-sy,cy*sx,cy*cx]];
    var A=[[1,0,0],[0,0,1],[0,-1,0]], out=[[0,0,0],[0,0,0],[0,0,0]];
    for(var i=0;i<3;i++)for(var j=0;j<3;j++)for(var k=0;k<3;k++)for(var m=0;m<3;m++)out[i][j]+=A[i][k]*R[k][m]*A[j][m];
    var mat=new THREE.Matrix4().set(out[0][0],out[0][1],out[0][2],0,out[1][0],out[1][1],out[1][2],0,out[2][0],out[2][1],out[2][2],0,0,0,0,1);
    return new THREE.Euler().setFromRotationMatrix(mat,'XYZ');
  }
  function material(color,opacity){return new THREE.MeshStandardMaterial({color:color,roughness:.72,metalness:.04,transparent:opacity<1,opacity:opacity,depthWrite:opacity===1});}
  function geometry(recipe,component){var p=recipe.parameters,k=recipe.kind;
    if(component&&component.category==='drum'){
      var ringShape=new THREE.Shape();ringShape.absarc(0,0,p.outer_radius,0,Math.PI*2,false);
      var bore=new THREE.Path();bore.absarc(0,0,p.inner_radius,0,Math.PI*2,true);ringShape.holes.push(bore);
      var ring=new THREE.ExtrudeGeometry(ringShape,{depth:p.height,bevelEnabled:false,curveSegments:p.segments||32});
      ring.rotateX(-Math.PI/2);ring.translate(0,-p.height/2,0);return ring;
    }
    if(component&&component.category==='crank'){
      var crank=new THREE.Group();
      var arm=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.4,p.length),new THREE.MeshStandardMaterial({color:0x687582,roughness:.48,metalness:.35}));
      arm.position.z=-p.length/4;crank.add(arm);
      var hub=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,2,16),new THREE.MeshStandardMaterial({color:0x8293a2,roughness:.42,metalness:.45}));hub.rotation.x=Math.PI/2;hub.position.z=-p.length/2;crank.add(hub);
      return crank;
    }
    if(k==='compound_box'){
      var frame=new THREE.Group();
      p.boxes.concat((p.fixed_feature_boxes||[]).map(function(item){return item.box;})).forEach(function(b){
        var bar=new THREE.Mesh(new THREE.BoxGeometry(b[3],b[5],b[4]),
          new THREE.MeshStandardMaterial({color:0x7b8998,roughness:.65,metalness:.08,transparent:true,opacity:.42,depthWrite:false}));
        bar.position.set(b[0],b[2],-b[1]);frame.add(bar);
      });
      return frame;
    }
    if(component&&component.category==='cartridge'){
      var outer=new THREE.Shape();outer.moveTo(-p.size[0]/2,-p.size[1]/2);outer.lineTo(p.size[0]/2,-p.size[1]/2);outer.lineTo(p.size[0]/2,p.size[1]/2);outer.lineTo(-p.size[0]/2,p.size[1]/2);outer.closePath();
        var hole=new THREE.Path(),inset=p.wall_inset_mm||1;hole.moveTo(-p.size[0]/2+inset,-p.size[1]/2+inset);hole.lineTo(p.size[0]/2-inset,-p.size[1]/2+inset);hole.lineTo(p.size[0]/2-inset,p.size[1]/2-inset);hole.lineTo(-p.size[0]/2+inset,p.size[1]/2-inset);hole.closePath();outer.holes.push(hole);
      var shell=new THREE.ExtrudeGeometry(outer,{depth:p.size[2],bevelEnabled:false});shell.rotateX(-Math.PI/2);shell.translate(0,-p.size[2]/2,0);return shell;
    }
    if(component&&component.category==='blade'){
      var group=new THREE.Group(),mat=material(0xc5a354,1),bodyEnd=p.tab_start_y;
      function addPrism(profile,xStart,xWidth){
        var shape=new THREE.Shape();shape.moveTo(profile[0][0],profile[0][1]);
        for(var j=1;j<profile.length;j++)shape.lineTo(profile[j][0],profile[j][1]);
        shape.closePath();
        var g=new THREE.ExtrudeGeometry(shape,{depth:xWidth,bevelEnabled:false,curveSegments:1}),pos=g.attributes.position;
        for(var i=0;i<pos.count;i++)pos.setXYZ(i,xStart+pos.getZ(i),pos.getY(i),-pos.getX(i));
        pos.needsUpdate=true;g.computeVertexNormals();group.add(new THREE.Mesh(g,mat));
      }
      // Local Y is the clarified short-channel slide axis. The closed nose is
      // local y=0; top-only wedge runs to 2.6 mm with flat underside z=0.
      addPrism([[0,0],[bodyEnd,0],[bodyEnd,p.thickness],[p.wedge.length,p.thickness],[0,p.wedge.leading_thickness]],-p.width/2,p.width);
      function addCanonicalBox(size,center){var box=new THREE.Mesh(new THREE.BoxGeometry(size[0],size[2],size[1]),mat);box.position.set(center[0],center[2],-center[1]);group.add(box);}
      var halfSlotX=p.slot_width/2,arm=(p.tab_width-p.slot_width)/2,slotHalfY=p.slot_length/2;
      [-1,1].forEach(function(side){addCanonicalBox([arm,p.slot_length,p.thickness],[side*(halfSlotX+arm/2),p.slot_center_y,p.thickness/2]);});
      var tabStart=p.tab_start_y,tabEnd=p.tab_end_y;
      [[tabStart,(p.slot_center_y-slotHalfY-tabStart)/2], [p.slot_center_y+slotHalfY,(tabEnd-p.slot_center_y-slotHalfY)/2]].forEach(function(item){var start=item[0],span=item[1];addCanonicalBox([p.tab_width,span,p.thickness],[0,start+span/2,p.thickness/2]);});
      return group;
    }
    if(k==='box')return new THREE.BoxGeometry(p.size[0],p.size[2],p.size[1]);
    if(k==='cylinder')return new THREE.CylinderGeometry(p.radius,p.radius,p.height,p.segments||20);
    if(k==='rod')return new THREE.CylinderGeometry(p.radius,p.radius,p.length,12);
    if(k==='cone')return new THREE.CylinderGeometry(p.radius_top||0,p.radius_bottom,p.height,p.segments||20);
    if(k==='helix'){
      var pts=[]; for(var i=0;i<=96;i++){var t=i/96*Math.PI*2*p.turns;pts.push(new THREE.Vector3(p.radius*Math.cos(t),-p.height/2+p.height*i/96,p.radius*Math.sin(t)));}
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),96,p.tube_radius,6,false);
    }
    throw new Error('Unsupported concept recipe '+k);
  }
  function makeLabel(text,color){function face(hot){var canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;var ctx=canvas.getContext('2d');ctx.fillStyle=hot?'rgba(74,48,0,.98)':'rgba(8,15,24,.88)';ctx.fillRect(0,0,256,64);ctx.strokeStyle=hot?'#ffb300':'#567087';ctx.lineWidth=hot?4:1;ctx.strokeRect(hot?2:1,hot?2:1,hot?252:254,hot?60:62);ctx.font='bold 22px sans-serif';ctx.fillStyle=hot?'#ffffff':(color||'#eff8ff');ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,32);return new THREE.CanvasTexture(canvas);}var tex=face(false);var sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));sprite.userData.texNormal=tex;sprite.userData.texHot=face(true);sprite.scale.set(10,2.5,1);return sprite;}
  function formatDimensionValue(item){if(item.suffix)return item.suffix;if(!item.numeric)return 'unspecified';if(Array.isArray(item.value))return item.value.join(' × ');return String(item.value);}
  function dimensionLineSpan(item){if(!item.numeric)return 0;if(!Array.isArray(item.value))return Number(item.value)||0;if(item.sourceId==='tongue.edge_positions'||item.sourceId==='blade.tip_travel')return Math.abs(item.value[1]-item.value[0]);return Number(item.value[0])||0;}
  function makeDimensionValueLabel(item){var canvas=document.createElement('canvas');canvas.width=1024;canvas.height=112;var ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);var text=(item.color?item.color.toUpperCase()+' · ':'')+formatDimensionValue(item)+(item.numeric?' '+item.unit:'');ctx.font='600 58px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=4;ctx.strokeStyle='rgba(4,10,18,.95)';ctx.strokeText(text,canvas.width/2,canvas.height/2,canvas.width-28);ctx.fillStyle='#ffffff';ctx.fillText(text,canvas.width/2,canvas.height/2,canvas.width-28);var texture=new THREE.CanvasTexture(canvas);texture.needsUpdate=true;var sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));sprite.scale.set(22,2.3,1);sprite.renderOrder=10000;sprite.name='dimension value label · '+item.label;sprite.userData.dimensionId=item.id;return sprite;}
  function dimensionLabel(item){var canvas=document.createElement('canvas');canvas.width=384;canvas.height=112;var ctx=canvas.getContext('2d');ctx.fillStyle='rgba(8,15,24,.94)';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#7de4ee';ctx.lineWidth=2;ctx.strokeRect(1,1,382,110);ctx.textAlign='left';ctx.textBaseline='top';ctx.font='bold 20px sans-serif';ctx.fillStyle='#b8f8ff';ctx.fillText(item.label+': '+formatDimensionValue(item)+(item.numeric?' '+item.unit:''),10,8);ctx.font='bold 15px sans-serif';ctx.fillStyle='#e8e2ff';ctx.fillText(item.provenance+' · '+item.verificationStatus,10,36);ctx.font='12px sans-serif';ctx.fillStyle='#d2dbe7';var caveat=(item.caveat||'Concept value only.').replace(/\s+/g,' ');ctx.fillText(caveat.slice(0,52),10,62);ctx.fillText(caveat.slice(52,104),10,82);var texture=new THREE.CanvasTexture(canvas);var sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.scale.set(8,2.4,1);sprite.name='dimension label: '+item.label;sprite.userData.dimensionId=item.id;return sprite;}
  function addDimensionSegment(parent,start,end,name,color){if(start.distanceToSquared(end)<1e-12)return null;var geometry=new THREE.BufferGeometry().setFromPoints([start,end]),line=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:color||0xe5eaf0,linewidth:1,depthTest:false,depthWrite:false,transparent:true,opacity:.96}));line.name='dimension segment · '+name;line.renderOrder=9999;parent.add(line);return line;}
  function setDimensionCategory(category){var showAssembly=category==='assembly';Object.keys(dimensionCategoryGroups).forEach(function(key){dimensionCategoryGroups[key].visible=showAssembly?(key==='station'||key==='post-drum'):key===category;});}
  function dimensionRecordMatchesCategory(item,category){if(category==='assembly')return item.group==='station'||item.group==='post-drum';if(category.indexOf('upper-blade-')===0)return item.group==='upper-blade'&&item.color===category.slice('upper-blade-'.length);if(category.indexOf('cartridge-channel-cap-')===0)return item.group==='cartridge-channel-cap'&&item.color===category.slice('cartridge-channel-cap-'.length);if(category==='pin-slot')return item.group==='pin-slot'&&!item.color;if(category.indexOf('pin-slot-')===0)return item.group==='pin-slot'&&item.color===category.slice('pin-slot-'.length);return item.group===category;}
  function renderDimensionDetails(){dimensionDetails.replaceChildren();var category=dimensionCategory.value;dimensionRecords.filter(function(item){return dimensionRecordMatchesCategory(item,category);}).forEach(function(item){var row=document.createElement('article'),heading=document.createElement('strong'),value=document.createElement('div'),source=document.createElement('div'),caveat=document.createElement('small');row.className='dimension-detail';heading.textContent=item.label;value.className='dimension-value';value.textContent=formatDimensionValue(item)+(item.numeric?' '+item.unit:'');source.className='dimension-source';source.textContent=item.provenance+' · '+item.verificationStatus;caveat.textContent=item.caveat||'Concept value only; NOT VALIDATED and not a manufacturing tolerance.';row.appendChild(heading);row.appendChild(value);row.appendChild(source);row.appendChild(caveat);dimensionDetails.appendChild(row);});dimensionDetails.hidden=!dimensionsToggle.checked;}
  function buildDimensionOverlay(){
    var catalog=window.DispenserDimensionAnnotations;if(!catalog||typeof catalog.build!=='function')throw new Error('Dimension annotation catalog did not load locally.');
    dimensionRecords=catalog.build(DATA);
    dimensionGroups.fixed=new THREE.Group();dimensionGroups.fixed.name='dimension overlay · fixed assembly annotations';mechanismGroup.add(dimensionGroups.fixed);
    dimensionGroups.rotating=new THREE.Group();dimensionGroups.rotating.name='dimension overlay · rotating drum annotations';drumGroup.add(dimensionGroups.rotating);
    dimensionRecords.forEach(function(item){
      var group=item.group==='upper-blade'||item.group==='cartridge-channel-cap'?dimensionGroups.rotating:dimensionGroups.fixed;
      if(item.color)group=dimensionGroups.rotating;
      var categoryKey=item.group+(item.color?'-'+item.color:''),categoryGroup=dimensionCategoryGroups[categoryKey];
      if(!categoryGroup){categoryGroup=new THREE.Group();categoryGroup.name='dimension group '+categoryKey;categoryGroup.visible=false;dimensionCategoryGroups[categoryKey]=categoryGroup;group.add(categoryGroup);}
      var annotation=new THREE.Group();annotation.name='dimension annotation '+item.id;annotation.userData.dimension=item;
      var anchor=toThree(item.anchor),axis=toThree(item.axis).normalize(),span=dimensionLineSpan(item);
      if(group===dimensionGroups.rotating)anchor.sub(toThree([0,15,25]));
      if(item.numeric&&span>0){
        var half=span/2,start=anchor.clone().addScaledVector(axis,-half),end=anchor.clone().addScaledVector(axis,half);
        addDimensionSegment(annotation,start,end,item.label,0xe8edf3);
      }
      var layoutIndex=categoryGroup.children.length,callout=anchor.clone();callout.y=58+layoutIndex*2.5;
      var valueLabel=makeDimensionValueLabel(item);valueLabel.position.copy(callout);
      addDimensionSegment(annotation,anchor,callout,item.label+' guide line',0xb9c3cf);
      annotation.add(valueLabel);categoryGroup.add(annotation);
    });
    setDimensionCategory(dimensionCategory.value);dimensionGroups.fixed.visible=false;dimensionGroups.rotating.visible=false;renderDimensionDetails();
  }
  function addFictionalBarcodeLabel(container){var canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;var ctx=canvas.getContext('2d');ctx.fillStyle='#f8f7f1';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#202333';ctx.font='bold 17px sans-serif';ctx.fillText('DEMO ONLY',12,24);var widths=[3,2,5,2,3,4,2,6,2,3,5,2,4,2,3,6,2,4,3,2,5,2,3,4,2,5,3,2];var x=18;widths.forEach(function(width,index){if(index%2===0)ctx.fillRect(x,35,width*2,68);x+=width*2+2;});ctx.font='12px sans-serif';ctx.fillText('NOT MEDICATION',12,119);var texture=new THREE.CanvasTexture(canvas);texture.needsUpdate=true;var arc=2.1,label=new THREE.Mesh(new THREE.CylinderGeometry(3.23,3.23,6,24,1,true,-Math.PI/2-arc/2,arc),new THREE.MeshBasicMaterial({map:texture,side:THREE.FrontSide}));label.position.y=.4;label.name='fictional barcode label on container surface, facing scanner optics';container.add(label);return label;}
  function fictionalContainerAccent(color){return color==='purple'?0x9b59ff:(palette[color]||0xe8e1d1);}
  function setFictionalContainerColor(container,color){if(container.userData.displayColor===color)return;var accent=fictionalContainerAccent(color);(container.userData.colorMeshes||[]).forEach(function(mesh,index){mesh.material.color.setHex(index===0?accent:new THREE.Color(accent).multiplyScalar(index===1?.8:.72).getHex());});container.userData.displayColor=color;}
  function makeFictionalContainer(color){var accent=fictionalContainerAccent(color),group=new THREE.Group();var body=new THREE.Mesh(new THREE.CylinderGeometry(3.2,3.2,10,28),new THREE.MeshStandardMaterial({color:accent,roughness:.56,metalness:.12}));body.position.y=0;group.add(body);var collar=new THREE.Mesh(new THREE.CylinderGeometry(3.1,3.1,1.6,28),new THREE.MeshStandardMaterial({color:new THREE.Color(accent).multiplyScalar(0.8).getHex(),roughness:.45,metalness:.18}));collar.position.y=5.4;group.add(collar);var band=new THREE.Mesh(new THREE.TorusGeometry(2.9,0.32,16,28),new THREE.MeshStandardMaterial({color:0xf6f1ea,roughness:.55,metalness:.1}));band.rotation.x=Math.PI/2;band.position.y=-4.5;group.add(band);var base=new THREE.Mesh(new THREE.CylinderGeometry(3.1,3.1,0.8,24),new THREE.MeshStandardMaterial({color:new THREE.Color(accent).multiplyScalar(0.72).getHex(),roughness:.6,metalness:.08}));base.position.y=-5.2;group.add(base);group.userData.colorMeshes=[body,collar,base];group.userData.displayColor=color;addFictionalBarcodeLabel(group);group.name='fictional demo container with barcode · not a medication';return group;}
  function addScannerSubsystemVisuals(){
    var housing=componentMap['barcode-scanner-housing'];
    if(housing){var bezel=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,.65,24),new THREE.MeshStandardMaterial({color:0x75669a,emissive:0x281d41,metalness:.18,roughness:.35}));bezel.rotation.z=Math.PI/2;bezel.position.set(-36.575+SCAN_DX,29.9,0);bezel.name='scanner optical bezel · visual only';scannerGroup.add(bezel);scannerVisualObjects.push(bezel);var lens=new THREE.Mesh(new THREE.SphereGeometry(.8,20,14),new THREE.MeshStandardMaterial({color:0xd8c1ff,emissive:0x6845a0,emissiveIntensity:.7,roughness:.22}));lens.position.set(-37+SCAN_DX,29.9,0);lens.name='scanner optical read point · visual only';scannerGroup.add(lens);scannerVisualObjects.push(lens);}
    var details=new THREE.Group();details.name='scanner guide and decoder · visual-only demo components';scannerGroup.add(details);details.position.x=SCAN_DX;
    var guideMaterial=new THREE.MeshStandardMaterial({color:0x647b93,metalness:.35,roughness:.5});
    [[-29.5,29.9,4.6],[-29.5,29.9,-4.6]].forEach(function(position,index){var rail=new THREE.Mesh(new THREE.BoxGeometry(.75,12,.75),guideMaterial);rail.position.set(position[0],position[1],position[2]);rail.name='demo container positioning guide '+(index+1);details.add(rail);});
    var guideStop=new THREE.Mesh(new THREE.BoxGeometry(9,.65,12),guideMaterial);guideStop.position.set(-29.5,24.55,0);guideStop.name='demo container guide stop';details.add(guideStop);
    var decoder=new THREE.Mesh(new THREE.BoxGeometry(7,4,7),new THREE.MeshStandardMaterial({color:0x33304b,emissive:0x171225,roughness:.45}));decoder.position.set(-47.7,36.4,0);decoder.name='local fixture decoder module · visual only';details.add(decoder);
    var decoderLabel=makeLabel('LOCAL DEMO DECODER','#cfbaff');decoderLabel.position.set(-47.7,40,0);details.add(decoderLabel);
    scannerVisualObjects.push(details);
  }
  function setScannerSubsystemVisibility(visible){scannerVisible=Boolean(visible);scannerVisualObjects.forEach(function(object){object.visible=scannerVisible;});if(targets.package)targets.package.visible=scannerVisible;if(targets.beam)targets.beam.visible=scannerVisible&&controller.state.phase==='BEAM';}
  function setDispensingMechanismVisibility(visible){mechanismVisible=Boolean(visible);if(mechanismGroup)mechanismGroup.visible=mechanismVisible;}
  var rotationPreview={angle:0,target:0,saved:null,only:false},TWO_PI=Math.PI*2,DRUM_RAD_S=1.3,HALF_STEPS_PER_REV=4096;
  function syncRotationSelection(){var look=window.DispenserReferenceLook,sel=look&&look.selectedRotationPart?look.selectedRotationPart():null;document.querySelectorAll('#rotationPartsList .rot-part').forEach(function(b){var on=b.dataset.part===sel;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on?'true':'false');});}
  // Selecting a part or pinning a dimension drops the other-parts opacity to 2%; it returns when neither is active.
  var focusFade={part:false,dimension:false,before:null};
  function setFocusFade(source,on){
    focusFade[source]=Boolean(on);var active=focusFade.part||focusFade.dimension,slider=document.getElementById('rotationFade'),look=window.DispenserReferenceLook;
    if(!slider||!look||!look.setRotationFade)return;
    function apply(value){slider.value=value;document.getElementById('rotationFadeOut').value=value+'%';look.setRotationFade(value/100);}
    if(active&&focusFade.before===null){focusFade.before=Number(slider.value);apply(2);}
    else if(!active&&focusFade.before!==null){apply(focusFade.before);focusFade.before=null;}
  }
  // Part and dimension selection share one focus; this keeps the list, the dimension blocks and the opacity in step with it.
  function syncSelectionUI(){
    var look=window.DispenserReferenceLook,part=look.selectedRotationPart(),dim=look.selectedRotationDimension();
    syncRotationSelection();
    document.querySelectorAll('#dimensionDetails [data-dim]').forEach(function(row){row.classList.toggle('selected',row.dataset.dim===dim);});
    setFocusFade('part',Boolean(part));setFocusFade('dimension',Boolean(dim));
  }
  function selectRotationPart(label){var look=window.DispenserReferenceLook;if(!look||!look.selectRotationPart)return null;var next=look.selectedRotationPart()===label?null:label;look.selectRotationPart(next);if(next&&!labelToggle.checked){labelToggle.checked=true;look.setRotationLabels(true);}syncSelectionUI();return next;}
  // Whole-machine selection: any component can be hovered or clicked to highlight it and show only its label.
  var selectedComponentId=null,componentHoverId=null,componentSelectionMaterial=null;
  function componentIdOf(object){for(var o=object;o;o=o.parent)if(o.userData&&o.userData.component)return o.userData.component.component_id;return null;}
  function componentOverlay(id){
    var node=componentMap[id];if(!node)return null;if(node.userData.selectionOverlay)return node.userData.selectionOverlay;
    if(!componentSelectionMaterial)componentSelectionMaterial=new THREE.MeshBasicMaterial({color:0xffb300,transparent:true,opacity:.8,depthTest:false,depthWrite:false});
    var overlay=new THREE.Group();overlay.name='selection overlay · '+id;overlay.visible=false;
    node.children.forEach(function(child){if(child.isSprite||child.userData.selectionOverlay)return;var copy=child.clone(true);copy.traverse(function(o){o.visible=true;if(o.isMesh){o.material=componentSelectionMaterial;o.renderOrder=25;}else if(o.isLine||o.isSprite)o.visible=false;});overlay.add(copy);});
    node.add(overlay);node.userData.selectionOverlay=overlay;return overlay;
  }
  function applyComponentHighlight(){
    var focus=componentHoverId;
    Object.keys(componentMap).forEach(function(id){var node=componentMap[id];if(node.userData.selectionOverlay)node.userData.selectionOverlay.visible=id===focus;});
    if(focus){var overlay=componentOverlay(focus);if(overlay)overlay.visible=true;}
    labels.forEach(function(label){var owner=label.parent&&label.parent.userData&&label.parent.userData.component,hot=Boolean(focus&&owner&&owner.component_id===focus);if(label.userData.texHot){label.material.map=hot?label.userData.texHot:label.userData.texNormal;label.scale.set(hot?11:10,hot?2.75:2.5,1);}});
  }
  // Part types control: tick 3D-printed parts and/or electronic components; the rest fades.
  var partTypes=[];
  function closePrintPlates(){var look=window.DispenserReferenceLook,btn=document.getElementById('printPlatesBtn');if(look&&look.setPrintLayout)look.setPrintLayout(false);if(btn){btn.textContent='Show print plates';btn.setAttribute('aria-pressed','false');}}
  function applyPartType(){
    var look=window.DispenserReferenceLook;if(!look||!look.setPartFilter)return;
    partTypes=Array.prototype.map.call(document.querySelectorAll('input[name="partType"]:checked'),function(box){return box.value;});
    var printed=partTypes.indexOf('printed')>=0,electronic=partTypes.indexOf('electronic')>=0;
    if(!printed){look.selectPrintJob(null);closePrintPlates();}
    look.setPartFilter(partTypes);
    document.getElementById('printGroups').hidden=!printed;document.getElementById('electronicGroups').hidden=!electronic;
    refreshPartLists();
  }
  function refreshPartLists(){
    if(partTypes.indexOf('printed')>=0)fillPrintJobs();
    if(partTypes.indexOf('electronic')>=0)fillElectronics();
    if(rotationPreview.only)fillRotationParts();
  }
  function fillElectronics(){
    var look=window.DispenserReferenceLook,list=document.getElementById('electronicList');list.replaceChildren();
    (look&&look.electronicList?look.electronicList():[]).forEach(function(name){var li=document.createElement('li');li.textContent=name+wiringSuffix(name);list.appendChild(li);});
  }
  // The printed parts of the view in two options: one-piece prints, and parts printed separately.
  function fillPrintJobs(){
    var list=document.getElementById('printGroupsList'),look=window.DispenserReferenceLook,info=document.getElementById('printJobInfo'),jobs=look&&look.printJobs?look.printJobs().filter(function(j){return j.inView;}):[];
    var hint='Pick an option to keep only those parts solid. Blue border: printed as one piece. Orange border: each part printed on its own. ASSUMED / NOT_VALIDATED.';
    if(look.selectedPrintJob()&&!jobs.some(function(j){return j.mode===look.selectedPrintJob();}))look.selectPrintJob(null);
    list.replaceChildren();info.textContent=look.selectedPrintJob()?info.textContent:hint;
    filterDownloads(jobs);
    [['one','Print as ONE piece','Each is a single print that already includes its smaller features'],['separate','Print SEPARATELY','Each part is its own print, assembled afterwards']].forEach(function(group){
      var items=jobs.filter(function(j){return j.mode===group[0];});if(!items.length)return;
      var total=items.reduce(function(n,j){return n+j.qty;},0),item=document.createElement('li'),button=document.createElement('button'),title=document.createElement('strong'),sub=document.createElement('small');
      button.type='button';button.className='rot-part print-job '+group[0];button.dataset.job=group[0];button.setAttribute('aria-pressed',look.selectedPrintJob()===group[0]?'true':'false');
      title.textContent=group[1]+' · '+total+(total===1?' print':' prints');
      sub.textContent=items.map(function(j){return (j.qty>1?j.qty+'× ':'')+j.label+(j.partial?' (part of it)':'');}).join(', ');
      button.append(title,sub);
      button.addEventListener('click',function(){
        var next=look.selectedPrintJob()===group[0]?null:group[0];look.selectPrintJob(next);
        list.querySelectorAll('.print-job').forEach(function(b){var on=b.dataset.job===next;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on?'true':'false');});
        info.textContent=next?group[2]+'. '+items.map(function(j){return j.label+': '+j.includes+'; '+j.orientation+'.'+(j.note?' '+j.note:'');}).join(' '):hint;
      });
      item.appendChild(button);list.appendChild(item);
    });
  }
  // Download links follow the same in-view test as the print options; coupons shown are the ones those parts need.
  function filterDownloads(jobs){
    var ids=jobs.map(function(j){return j.id;}),coupons={};
    document.querySelectorAll('#printDownloads li[data-job]').forEach(function(li){
      var on=ids.indexOf(li.dataset.job)>=0;li.hidden=!on;
      if(on)li.dataset.coupons.split(' ').forEach(function(c){if(c)coupons[c]=true;});
    });
    var any=false;
    document.querySelectorAll('#printDownloads li[data-coupon]').forEach(function(li){var on=Boolean(coupons[li.dataset.coupon]);li.hidden=!on;any=any||on;});
    document.getElementById('printCouponsTitle').hidden=!any;
  }
  function fillRotationParts(){var list=document.getElementById('rotationPartsList'),look=window.DispenserReferenceLook;list.replaceChildren();(look&&look.rotationParts?look.rotationParts():[]).filter(function(part){return !partTypes.length||partTypes.indexOf(part.type)>=0;}).forEach(function(part){var item=document.createElement('li'),button=document.createElement('button'),kind=document.createElement('span');button.type='button';button.className='rot-part';button.dataset.part=part.label;button.setAttribute('aria-pressed','false');kind.className='rot-kind '+part.kind;kind.textContent=part.kind;button.append(kind,' '+part.label);button.addEventListener('click',function(){selectRotationPart(part.label);});button.addEventListener('mouseenter',function(){look.highlightRotationPartLabel(part.label);});button.addEventListener('focus',function(){look.highlightRotationPartLabel(part.label);});button.addEventListener('mouseleave',function(){look.highlightRotationPartLabel(null);});button.addEventListener('blur',function(){look.highlightRotationPartLabel(null);});item.appendChild(button);list.appendChild(item);});syncRotationSelection();}
  // Compartment removal demo (viewer only, never touches controller state): held, clips flex, lift out, return.
  var removalStep=0,REMOVAL_MSG=['The {C} compartment sits on its deck, held down by two clips whose hooks sit over the catch ledges.','Pull up: each clip flexes outward about 0.7 mm so the hooks clear the ledges.','Lift the {C} compartment straight up and out (50 mm shown). No tools are needed.','Lower it back in: the hooks snap over the ledges and the compartment is held again.'];
  function removalColor(){return document.getElementById('removalColor').value;}
  function removalRender(){
    var name=removalColor().toUpperCase(),items=document.querySelectorAll('#removalSteps li');
    items.forEach(function(li,i){li.classList.toggle('done',i<removalStep-1);li.classList.toggle('current',i===removalStep-1);});
    document.getElementById('removalStatus').textContent=removalStep?REMOVAL_MSG[removalStep-1].replace(/\{C\}/g,name)+' (concept, ASSUMED / NOT_VALIDATED)':'Concept only (ASSUMED / NOT_VALIDATED): press Next step to see how a compartment comes out.';
    document.getElementById('removalNext').textContent=removalStep>=4?'Done':'Next step';
  }
  function removalReset(){
    var look=window.DispenserReferenceLook;removalStep=0;
    if(look&&look.setRemovalState)look.setRemovalState({flex:false,lift:false,blade:0,color:removalColor()});
    document.getElementById('bladeSlide').value=0;bladeRender(0);removalRender();
  }
  function bladeRender(v){document.getElementById('bladeOut').value=v<=0.02?'closed':v>=0.98?'open (10.4 mm)':Math.round(v*100)+'%';document.getElementById('bladeToggle').textContent=v>=0.5?'Slide blade closed':'Slide blade open';}
  function bladeSet(v){var look=window.DispenserReferenceLook;if(!look||!look.setRemovalState)return;v=Math.max(0,Math.min(1,v));look.setRemovalState({color:removalColor(),blade:v});document.getElementById('bladeSlide').value=Math.round(v*100);bladeRender(v);}
  function removalAdvance(){
    var look=window.DispenserReferenceLook,color=removalColor();if(!look||removalStep>=4)return;removalStep+=1;
    if(removalStep===2)look.setRemovalState({color:color,flex:true});
    else if(removalStep===3)look.setRemovalState({color:color,flex:true,lift:true});
    else if(removalStep===4)look.setRemovalState({color:color,flex:false,lift:false});
    removalRender();
  }
  function setRotationOnly(on,view){
    var look=window.DispenserReferenceLook;on=Boolean(on);
    if(on&&rotationPreview.only&&look&&look.selectRotationPart){look.selectRotationPart(null);setFocusFade('part',false);setFocusFade('dimension',false);}
    rotationPreview.only=on;if(on){selectedComponentId=null;componentHoverId=null;applyComponentHighlight();}
    if(look&&look.setRotationView)look.setRotationView(on,view);
    document.getElementById('rotationPanel').hidden=!on;
    var ringFloor=document.getElementById('ringFloor'),floorRow=document.getElementById('ringFloorRow'),floorHere=Boolean(on&&view==='compartment'&&look&&look.ringActive&&look.ringActive());
    if(!floorHere&&ringFloor&&!ringFloor.checked){ringFloor.checked=true;if(look&&look.ringMagazine)look.ringMagazine.setFloor(true);}
    if(floorRow)floorRow.hidden=!floorHere;
    if(on){var ringM=Boolean(look&&look.ringActive&&look.ringActive()),still=ringM||view==='mount'||view==='compartment'||view==='housing';document.getElementById('removalFlow').hidden=ringM||view!=='compartment';if(view==='compartment'&&!ringM)removalReset();document.getElementById('rotationPanelTitle').textContent=view==='mount'?'Stepper mount preview':view==='housing'?'Housing preview':view==='compartment'?(ringM?'Ring magazine preview':'Compartments & decks preview'):(ringM?'Ring rotation preview':'Rotation subsystem preview');document.querySelector('#rotationPanel .rotation-buttons').hidden=still;document.querySelector('#rotationPanel .readout-grid').hidden=still;fillRotationParts();}
    else{if(look&&look.selectRotationPart)look.selectRotationPart(null);setFocusFade('part',false);setFocusFade('dimension',false);rotationPreview.angle=0;rotationPreview.target=0;}
    refreshPartLists();
    if(camera)updateCamera();
  }
  function spinPreview(rad){if(!rotationPreview.only||controller.snapshot().operation)return;rotationPreview.target+=rad;}
  function homePreview(){if(!rotationPreview.only||controller.snapshot().operation)return;var total=controller.snapshot().drumAngle+rotationPreview.target;rotationPreview.target+=(TWO_PI-((total%TWO_PI)+TWO_PI)%TWO_PI)%TWO_PI;}
  // Bench preview only: adds to the controller drum angle while idle and never changes controller state.
  function advanceRotationPreview(dt,s){
    if(s.operation){rotationPreview.angle=0;rotationPreview.target=0;return;}
    if(rotationPreview.angle<rotationPreview.target)rotationPreview.angle=Math.min(rotationPreview.target,rotationPreview.angle+DRUM_RAD_S*(parseFloat(document.getElementById('speedRange').value)||1)*dt);
    else if(rotationPreview.angle>rotationPreview.target)rotationPreview.angle=Math.max(rotationPreview.target,rotationPreview.angle-DRUM_RAD_S*(parseFloat(document.getElementById('speedRange').value)||1)*dt);
    else if(rotationPreview.target>=TWO_PI){rotationPreview.target%=TWO_PI;rotationPreview.angle=rotationPreview.target;}
    if(!rotationPreview.only)return;
    var a=(((s.drumAngle+rotationPreview.angle)%TWO_PI)+TWO_PI)%TWO_PI,home=a<.07||a>TWO_PI-.07;
    document.getElementById('rotAngle').textContent=(a*180/Math.PI).toFixed(1)+'°';document.getElementById('rotSteps').textContent=String(Math.round(a/TWO_PI*HALF_STEPS_PER_REV)%HALF_STEPS_PER_REV);document.getElementById('rotHome').textContent=home?'LOW · magnet at home':'HIGH · not home';
  }
  function firstPillCenterZ(){return DATA.station.parked_stack.lowest_pill_bottom_z_mm+DATA.demo.pill_size_mm[2]/2;}
  function stationCoordinates(color){var part=DATA.components.find(function(item){return item.component_id===color+'-cartridge';});if(!part)throw new Error('Missing cartridge station '+color);return part.position.slice(0,2);}
  function pillStackPitch(){return DATA.station.parked_stack.pill_pitch_mm||6.5;}
  function traySlotPosition(color,index,sequence){var S=window.DispenserRotationSpec&&window.DispenserRotationSpec.g,h=DATA.demo.pill_size_mm[2],floorTop=S?S.table_z:-51,layer=(Number.isFinite(sequence)?sequence:0)%2;return new THREE.Vector3(0,floorTop+h/2+layer*h,0);}
  function tongueLandingPosition(color,index){root3d.updateMatrixWorld(true);var pill=pills[color][index],source=pill.userData.stationGroup.localToWorld(pill.userData.rest.clone());return new THREE.Vector3(source.x,DATA.station.tongue.z_bounds_mm[1]+DATA.demo.pill_size_mm[2]/2,source.z);}
  function fallPillPosition(tongue,finish,progress){var p=Math.max(0,Math.min(1,progress)),q=p*p;return new THREE.Vector3(tongue.x+(finish.x-tongue.x)*q,tongue.y+(finish.y-tongue.y)*q,tongue.z+(finish.z-tongue.z)*q);}
  function transferPillPosition(start,tongue,progress){var p=Math.max(0,Math.min(1,progress));return start.clone().lerp(tongue,p*p*(3-2*p));}
  var CAP_OPEN_RAD=Math.PI*.95;
  function containerTargetPosition(color){var cartridge=componentMap[color+'-cartridge'];if(!cartridge)return new THREE.Vector3(-29.5+SCAN_DX,29.9,16);root3d.updateMatrixWorld(true);var position=cartridge.getWorldPosition(new THREE.Vector3());position.y+=recipeMap.cartridge.parameters.size[2]/2;var look=window.DispenserReferenceLook;if(look&&look.cartridgeOffset)position.y+=look.cartridgeOffset(color);return position;}
  function bladeTravelDirection(rotation){return new THREE.Vector3(0,0,-1).applyEuler(rotation).normalize();}
  function selectedBladeWorldDirection(color){var blade=componentMap[(color||'red')+'-upper-blade-tab'];root3d.updateMatrixWorld(true);var origin=blade.localToWorld(new THREE.Vector3(0,0,0)),end=blade.localToWorld(new THREE.Vector3(0,0,-1));return end.sub(origin).normalize();}
  function colorFor(component){if(component.category==='station')return 0x6d7d8d;if(component.category==='cartridge')return palette[component.color]||0x8294a5;if(component.category==='cap')return palette[component.color]||0x8294a5;if(component.category==='blade'||component.category==='spring')return 0xc5a354;if(component.category==='drum')return 0x3a6d76;if(component.category==='pin')return 0x3b5267;if(component.category==='tongue')return 0x91a5ae;if(component.category==='scanner')return 0x586679;if(component.category==='tray')return 0x788897;return 0xaab6c3;}
  var FR034_AK_FALLBACK={
    socketRadiusMm:15,cartridgeCenterZMm:26,capCenterZMm:47.75,
    pinClosedYmm:-14.8,pinTipEngagedZmm:6.3,pinTipRaisedZmm:11.3,pinHeightMm:13,
    carriageZmm:17,solenoidBoundsZmm:[20.5,34],railBounds:{
      left:{x:[-6.8,-5.2],y:[-52,-20],z:[15,16.6]},
      right:{x:[5.2,6.8],y:[-52,-20],z:[15,16.6]}
    },
    servoPivotMm:[0,-54,15.2],servoBodyBoundsMm:{x:[-6.1,6.1],y:[-71.2,-48.2],z:[16.6,39.3]},
    connectingRodFallbackMm:[0,-36.3,15.2],tongueRodFallbackMm:[0,-62.15,-.75],
    tongueSpringFallbackMm:[0,-57.15,-.75]
  };
  function midpoint(bounds){return (bounds[0]+bounds[1])/2;}
  function socketRadiusMm(){var radial=DATA.dimensions.find(function(item){return item.id==='cartridge.radial_position';});return radial&&Number.isFinite(radial.value)?radial.value:FR034_AK_FALLBACK.socketRadiusMm;}
  function socketFrame(socket,index){
    var angle=Number.isFinite(socket&&socket.angle_rad)?socket.angle_rad:index*Math.PI/2;
    var radius=socketRadiusMm(),datumY=assemblySchedule&&assemblySchedule.datum&&assemblySchedule.datum.drum_post_axis_xy_mm[1]||15,x=radius*Math.sin(angle),y=datumY-radius*Math.cos(angle);
    return {angle:angle,center:[x,y,FR034_AK_FALLBACK.cartridgeCenterZMm],cartridgeRotation:angle-Math.PI/2,bladeRotation:angle+Math.PI};
  }
  function socketIndex(color){return COLORS.indexOf(color);}
  function akWorldPosition(component){
    var id=component.component_id,schedule=assemblySchedule||{},pin=schedule.pin_schedule||{},servo=schedule.servo_schedule||{},placement=placementById[id],fallback=placement&&placement.rendered_fallback_position_mm;
    if(component.color&&socketIndex(component.color)>=0){
      var socket=(schedule.socket_frames||[]).find(function(item){return item.color===component.color;})||{},frame=socketFrame(socket,socketIndex(component.color));
      if(component.category==='cartridge')return frame.center.slice();
      if(component.category==='cap')return [frame.center[0],frame.center[1],FR034_AK_FALLBACK.capCenterZMm];
      if(['cap-label','tag-carrier','cap-hinge','cap-latch'].indexOf(component.category)>=0){
        var source=fallback||(placement&&placement.world_position_mm)||component.position,oldCenter=Array.isArray(socket.center_mm)&&socket.center_mm.length===3?socket.center_mm:[frame.center[0],frame.center[1],27.1],oldAngle=Array.isArray(socket.rotation_rad)?socket.rotation_rad[2]:frame.angle;
        var dx=source[0]-oldCenter[0],dy=source[1]-oldCenter[1],delta=frame.cartridgeRotation-oldAngle,c=Math.cos(delta),s=Math.sin(delta);
        return [frame.center[0]+dx*c-dy*s,frame.center[1]+dx*s+dy*c,frame.center[2]+source[2]-oldCenter[2]];
      }
    }
    if(id==='servo-unit'){
      var body=servo.body_bounds_mm||FR034_AK_FALLBACK.servoBodyBoundsMm;
      return [midpoint(body.x),midpoint(body.y),midpoint(body.z)];
    }
    if(id==='servo-crank')return (servo.pivot_mm||FR034_AK_FALLBACK.servoPivotMm).slice();
    if(id==='connecting-rod')return (fallback||FR034_AK_FALLBACK.connectingRodFallbackMm).slice();
    if(id==='pin-carriage')return (fallback||[0,pin.closed_center_y_mm||FR034_AK_FALLBACK.pinClosedYmm,midpoint(pin.carriage_block_z_bounds_mm||[14,20])]).slice();
    if(id==='carriage-rail-left'||id==='carriage-rail-right'){
      var side=id==='carriage-rail-left'?'left':'right',bounds=(schedule.carriage_rail_bounds_mm&&schedule.carriage_rail_bounds_mm[side])||FR034_AK_FALLBACK.railBounds[side];
      return [midpoint(bounds.x),midpoint(bounds.y),midpoint(bounds.z)];
    }
    if(id==='pull-solenoid')return (fallback||[0,pin.closed_center_y_mm||FR034_AK_FALLBACK.pinClosedYmm,midpoint(pin.solenoid_body_z_bounds_mm||FR034_AK_FALLBACK.solenoidBoundsZmm)]).slice();
    if(id==='engagement-pin'){
      var height=recipeMap.pin&&recipeMap.pin.parameters.height||FR034_AK_FALLBACK.pinHeightMm,raised=pin.tip_z_raised_mm||FR034_AK_FALLBACK.pinTipRaisedZmm;
      return (fallback||[0,pin.closed_center_y_mm||FR034_AK_FALLBACK.pinClosedYmm,raised+height/2]).slice();
    }
    if(id==='tongue-actuator-rod')return (fallback||FR034_AK_FALLBACK.tongueRodFallbackMm).slice();
    if(id==='tongue-return-spring')return (fallback||FR034_AK_FALLBACK.tongueSpringFallbackMm).slice();
    if(placement&&Array.isArray(placement.world_position_mm))return placement.world_position_mm.slice();
    if(placement&&Array.isArray(placement.rendered_fallback_position_mm))return placement.rendered_fallback_position_mm.slice();
    return placement?null:(component.position||null);
  }
  function placementInfo(component){
    var placement=placementById[component.component_id],position=akWorldPosition(component),fallbackUsed=Boolean(placement&&placement.world_position_mm===null);
    if(fallbackUsed)return {position:position,source:'rendered_fallback_position_mm',provenance:placement.rendered_fallback_provenance||'ASSUMED',status:'UNRESOLVED',verificationStatus:placement.verification_status||'NOT_VALIDATED'};
    return {position:position,source:placement?'world_position_mm':'component source pose',provenance:placement&&placement.placement_provenance||component.provenance||'ASSUMED',status:position?'NOT_VALIDATED':'UNRESOLVED',verificationStatus:placement&&placement.verification_status||'NOT_VALIDATED'};
  }
  function scheduledWorldPosition(component){return placementInfo(component).position;}
  function scheduledRotation(component){
    if(component.color&&socketIndex(component.color)>=0){var socket=(assemblySchedule&&assemblySchedule.socket_frames||[]).find(function(item){return item.color===component.color;})||{},frame=socketFrame(socket,socketIndex(component.color));if(component.category==='blade')return [0,0,frame.bladeRotation];if(['cartridge','cap'].indexOf(component.category)>=0)return [0,0,frame.cartridgeRotation];}
    return component.rotation||[0,0,0];
  }
  function poseInFrame(component,framePosition,frameQuaternion){
    var canonicalPosition=scheduledWorldPosition(component),worldQuaternion=new THREE.Quaternion().setFromEuler(mappedRotation(scheduledRotation(component))),inverse=frameQuaternion.clone().invert();
    if(!canonicalPosition)return {position:new THREE.Vector3(),quaternion:inverse.multiply(worldQuaternion),resolved:false};
    var worldPosition=toThree(canonicalPosition);return {position:worldPosition.sub(framePosition).applyQuaternion(inverse),quaternion:inverse.multiply(worldQuaternion),resolved:true};
  }
  function addIntegratedSubmeshes(node,recipe,component){
    (recipe.integrated_submeshes||[]).forEach(function(feature){
      if(feature.owner_component_id&&feature.owner_component_id!==component.component_id||feature.owner_category&&feature.owner_category!==component.category)throw new Error('Integrated submesh owner mismatch: '+feature.submesh_id);
      var size=feature.parameters.size_mm,geom=feature.kind==='cylinder'?new THREE.CylinderGeometry(feature.parameters.diameter_mm/2,feature.parameters.diameter_mm/2,feature.parameters.height_mm,24):new THREE.BoxGeometry(size[0],size[2],size[1]);
      var solid=feature.display_size_only!==true,mesh=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({color:solid?0x4f6a80:0x9fb2c4,roughness:.55,metalness:.25,transparent:solid,opacity:solid?.58:1,depthWrite:!solid}));
      mesh.name='integrated submesh · '+(feature.display_name||feature.submesh_id);
      mesh.position.copy(toThree(feature.position_mm||[0,0,0]));mesh.quaternion.setFromEuler(mappedRotation(feature.rotation_rad||[0,0,0]));
      mesh.userData.submeshId=feature.submesh_id;mesh.userData.ownerComponentId=component.component_id;mesh.userData.positionStatus=feature.position_status;
      node.add(mesh);integratedSubmeshMeshes[feature.submesh_id+(feature.owner_category?':'+component.component_id:'')]={mesh:mesh,base:mesh.position.clone(),owner:node,feature:feature};
    });
  }
  function componentObject(component){
    var recipe=recipeMap[component.recipe_id],opacity=component.category==='station'?.24:(component.category==='cartridge'?.34:(component.category==='cap'?.52:1)),geom=geometry(recipe,component),renderable=geom&&geom.isObject3D?geom:new THREE.Mesh(geom,material(colorFor(component),opacity)),node=new THREE.Group();
    renderable.name=component.name+' geometry';node.add(renderable);node.name=component.name;node.userData.component=component;node.userData.placement=placementById[component.component_id]||null;addIntegratedSubmeshes(node,recipe,component);
    node.traverse(function(part){if(part.isMesh){part.castShadow=true;part.receiveShadow=true;}});
    if(component.category==='cartridge'&&renderable.geometry){var edges=new THREE.LineSegments(new THREE.EdgesGeometry(renderable.geometry,12),new THREE.LineBasicMaterial({color:new THREE.Color(colorFor(component)).multiplyScalar(1.7),transparent:true,opacity:1}));renderable.add(edges);}
    return node;
  }
  function setNodeInFrame(node,component,framePosition,frameQuaternion){var pose=poseInFrame(component,framePosition,frameQuaternion);node.position.copy(pose.position);node.quaternion.copy(pose.quaternion);node.visible=pose.resolved;node.userData.poseResolved=pose.resolved;componentBases[component.component_id]={position:node.position.clone(),rotation:node.rotation.clone(),quaternion:node.quaternion.clone()};}
  function makeFrameGroup(parent,name,worldPosition,worldRotation){var group=new THREE.Group();group.name=name;group.position.copy(toThree(worldPosition));group.quaternion.setFromEuler(mappedRotation(worldRotation||[0,0,0]));parent.add(group);return group;}
  function stationForComponent(component){return component.color&&stationGroups[component.color]?stationGroups[component.color]:null;}
  function addScheduledLabel(component,node){
    if(!(component.category==='cartridge'||component.category==='scanner'||component.component_id==='servo-unit'||component.component_id==='pull-solenoid'||component.component_id==='shared-lower-tongue'||component.component_id==='outlet-tray'))return;
    var label=makeLabel(component.color?component.color.toUpperCase():component.name,component.color?('#'+new THREE.Color(palette[component.color]).getHexString()):'#edf4fb');label.position.set(0,component.category==='cartridge'?9:7,0);label.userData.color=component.color||null;label.userData.scannerPart=component.category==='scanner';node.add(label);labels.push(label);if(component.category==='scanner')scannerVisualObjects.push(label);
  }
  function buildScene(){
    scene=new THREE.Scene();scene.background=new THREE.Color(0x101b29);scene.fog=new THREE.Fog(0x101b29,210,340);camera=new THREE.PerspectiveCamera(42,1,.1,1600);
    root3d=new THREE.Group();root3d.name='station world frame · canonical XYZ mapped once';scene.add(root3d);
    fixedAssemblyGroup=new THREE.Group();fixedAssemblyGroup.name='fixed station datum S=(0,0,0)';root3d.add(fixedAssemblyGroup);
    mechanismGroup=new THREE.Group();mechanismGroup.name='dispensing mechanism · presentation visibility';fixedAssemblyGroup.add(mechanismGroup);
    fixedGroup=new THREE.Group();fixedGroup.name='Station Housing transform frame · fixed-housing';fixedGroup.userData.componentId='station-housing';mechanismGroup.add(fixedGroup);
    scannerGroup=new THREE.Group();scannerGroup.name='scanner and electronics · independent visibility';scannerGroup.userData.logicalParentComponentId='station-housing';fixedAssemblyGroup.add(scannerGroup);
    var datum=assemblySchedule&&assemblySchedule.datum?assemblySchedule.datum:{drum_post_axis_xy_mm:[0,15]},pivot=[datum.drum_post_axis_xy_mm[0],datum.drum_post_axis_xy_mm[1],25];
    drumGroup=makeFrameGroup(fixedGroup,'rotating drum pivot at canonical (0,15,25)',pivot,[0,0,0]);
    var pinSchedule=assemblySchedule&&assemblySchedule.pin_schedule||{},carriageCenter=[0,pinSchedule.closed_center_y_mm||FR034_AK_FALLBACK.pinClosedYmm,FR034_AK_FALLBACK.carriageZmm];
    carriageGroup=makeFrameGroup(fixedGroup,'carriage slide · canonical −Y from FR-034 A–K',[carriageCenter[0],carriageCenter[1],carriageCenter[2]],[0,0,0]);
    tongueGroup=makeFrameGroup(fixedGroup,'shared tongue slide · canonical −Y',[0,-6.3,-.75],[0,0,0]);
    servoLinkageGroup=new THREE.Group();servoLinkageGroup.name='fixed servo and linkage group';fixedGroup.add(servoLinkageGroup);
    var frames={
      'fixed-housing':{parent:fixedGroup,position:new THREE.Vector3(),quaternion:new THREE.Quaternion()},
      'rotating-drum':{parent:drumGroup,position:toThree(pivot),quaternion:new THREE.Quaternion()},
      'servo-linkage':{parent:servoLinkageGroup,position:new THREE.Vector3(),quaternion:new THREE.Quaternion()},
      'carriage-slide':{parent:carriageGroup,position:toThree(carriageCenter),quaternion:new THREE.Quaternion()},
      'tongue-slide':{parent:tongueGroup,position:toThree([0,-6.3,-.75]),quaternion:new THREE.Quaternion()},
      'scanner-electronics':{parent:scannerGroup,position:new THREE.Vector3(SCAN_DX,0,0),quaternion:new THREE.Quaternion()}
    };
    (assemblySchedule&&assemblySchedule.browser_groups||[]).forEach(function(group){groupById[group.group_id]=group;});
    (assemblySchedule&&assemblySchedule.component_placements||[]).forEach(function(placement){placementById[placement.component_id]=placement;});
    var parts={};DATA.components.forEach(function(component){parts[component.component_id]=component;});
    (assemblySchedule&&assemblySchedule.socket_frames||[]).forEach(function(socket,index){
      var pose=socketFrame(socket,index),rotation=[0,0,pose.cartridgeRotation],frameId='station-'+socket.color,station=makeFrameGroup(drumGroup,frameId+' socket frame · FR-034 cartridge Rz(a−π/2)',pose.center,rotation);station.position.sub(toThree(pivot));stationGroups[socket.color]=station;
      frames[frameId]={parent:station,position:toThree(pose.center),quaternion:new THREE.Quaternion().setFromEuler(mappedRotation(rotation))};
    });
    scene.add(new THREE.HemisphereLight(0xdcecff,0x354252,.72));var key=new THREE.DirectionalLight(0xfff1d8,.82);key.position.set(65,100,70);scene.add(key);var rim=new THREE.DirectionalLight(0x65b9d8,.32);rim.position.set(-60,35,-70);scene.add(rim);
    DATA.components.forEach(function(component){
      var node=componentObject(component),placement=placementById[component.component_id],motion=placement&&placement.motion_group||'fixed-housing',frame=frames[motion]||frames['fixed-housing'];
      if(component.category==='scanner'||motion==='scanner-electronics'){frame=frames['scanner-electronics'];}
      else if(component.component_id==='rotating-drum'){frame=frames['rotating-drum'];}
      else if(component.category==='carriage'||component.category==='solenoid'||component.category==='pin'){frame=frames['carriage-slide'];}
      else if(component.category==='tongue'||component.category==='tongue-rod'){frame=frames['tongue-slide'];}
      else if(component.component_id==='tongue-return-spring'||component.category==='rail'){frame=frames['fixed-housing'];}
      else if(stationForComponent(component)){frame=frames['station-'+component.color];}
      else if(motion==='servo-linkage'){frame=frames['servo-linkage'];}
      frame.parent.add(node);setNodeInFrame(node,component,frame.position,frame.quaternion);componentMap[component.component_id]=node;targets[component.component_id]=node;targets[component.category+'|'+(component.color||'')]=node;
      node.userData.scheduledParentComponentId=placement&&placement.parent_component_id||null;node.userData.motionGroup=motion;node.userData.browserParentGroup=frame.parent.name;addScheduledLabel(component,node);
      if(component.category==='scanner'||motion==='scanner-electronics')scannerVisualObjects.push(node);
      if(component.component_id==='pin-carriage')carriageGroup.userData.carriageNode=node;
      if(component.component_id==='shared-lower-tongue')tongueGroup.userData.tongueNode=node;
      if(component.component_id==='tongue-return-spring')node.userData.dynamicSpring=true;
      if(component.component_id==='rotating-drum')node.position.set(0,0,0);
    });
    COLORS.forEach(function(color){
      var station=stationGroups[color],cap=componentMap[color+'-cap'],hingePart=componentMap[color+'-cap-hinge-assembly'];if(!station||!cap||!hingePart)return;
      var pivotGroup=new THREE.Group();pivotGroup.name=color+' cap hinge pivot · schedule-owned';pivotGroup.position.copy(hingePart.position);pivotGroup.quaternion.copy(hingePart.quaternion);station.add(pivotGroup);
      [color+'-cap',color+'-cap-label-plate',color+'-passive-tag-carrier',color+'-cap-latch-body'].forEach(function(id){var node=componentMap[id];if(!node)return;node.position.sub(pivotGroup.position).applyQuaternion(pivotGroup.quaternion.clone().invert());node.quaternion.premultiply(pivotGroup.quaternion.clone().invert());pivotGroup.add(node);});
      capPivots[color]=pivotGroup;capPivotBases[color]=pivotGroup.quaternion.clone();capHingeParts[color]=hingePart;
      var liftGroup=new THREE.Group();liftGroup.name=color+' removable cartridge and cap assembly · local +Z lift';station.add(liftGroup);cartridgeLiftGroups[color]=liftGroup;station.updateMatrixWorld(true);
      [componentMap[color+'-cartridge'],hingePart,pivotGroup].forEach(function(node){if(node)liftGroup.attach(node);});
    });
    COLORS.forEach(function(color){
      var station=stationGroups[color],socket=(assemblySchedule&&assemblySchedule.socket_frames||[]).find(function(item){return item.color===color;}),group=new THREE.Group();group.name=color+' assumed refill pill actors';pills[color]=[];
      for(var n=0;n<5;n++){var pill=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),material(0xf5f0df,1));pill.scale.set(5,2.5,3.5);pill.position.copy(toThree([0,0,firstPillCenterZ()+n*pillStackPitch()-(socket?socketFrame(socket,COLORS.indexOf(color)).center[2]:0)]));pill.userData.rest=pill.position.clone();pill.userData.stationGroup=group;pill.userData.onTray=false;pill.userData.transferStart=null;pill.userData.pillIndex=n;pill.userData.identity=color+':'+n;group.add(pill);pills[color].push(pill);}station.add(group);
    });
    var carton=makeFictionalContainer('red');carton.position.set(-29.5+SCAN_DX,29.9,16);scannerGroup.add(carton);targets.package=carton;scannerVisualObjects.push(carton);
    COLORS.forEach(function(color){var placed=makeFictionalContainer(color);placed.name='fictional '+color+' container placed in matching compartment';placed.visible=false;placedContainers[color]=placed;scannerGroup.add(placed);scannerVisualObjects.push(placed);});
    var beamMat=new THREE.LineBasicMaterial({color:0xc49aff,transparent:true,opacity:.95}),beamGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-37+SCAN_DX,29.9,0),new THREE.Vector3(-32.75+SCAN_DX,29.9,0)]),beam=new THREE.Line(beamGeo,beamMat);beam.visible=false;beam.name='scanner read beam · demo only';scannerGroup.add(beam);targets.beam=beam;scannerVisualObjects.push(beam);
    addScannerSubsystemVisuals();setScannerSubsystemVisibility(scannerToggle.checked);buildDimensionOverlay();updateCamera();resize();
    if(window.DispenserReferenceLook)window.DispenserReferenceLook.install({THREE:THREE,root3d:root3d,fixedGroup:fixedGroup,mechanismGroup:mechanismGroup,scannerGroup:scannerGroup,drumGroup:drumGroup,stationGroups:stationGroups,cartridgeLiftGroups:cartridgeLiftGroups,carriageGroup:carriageGroup,tongueGroup:tongueGroup,componentMap:componentMap,toThree:toThree,COLORS:COLORS,DATA:DATA,renderer:renderer,scannerVisualObjects:scannerVisualObjects,CAP_OPEN_RAD:CAP_OPEN_RAD});
  }

  var COLORS=['red','blue','green','orange'];
  function updateCamera(){if(scene&&scene.fog){if(!updateCamera.fog)updateCamera.fog=[scene.fog.near-148,scene.fog.far-148];scene.fog.near=orbit.radius+updateCamera.fog[0];scene.fog.far=orbit.radius+updateCamera.fog[1];}var x=cameraTarget.x+orbit.radius*Math.sin(orbit.phi)*Math.sin(orbit.theta),z=cameraTarget.z+orbit.radius*Math.sin(orbit.phi)*Math.cos(orbit.theta),y=cameraTarget.y+orbit.radius*Math.cos(orbit.phi);camera.position.set(x,y,z);camera.lookAt(cameraTarget);}
  function resize(){if(!renderer||!camera)return;var rect=host.getBoundingClientRect();if(!rect.width||!rect.height)return;renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();}
  function initRenderer(){try{if(!window.THREE||!THREE.WebGLRenderer)throw new Error('Three.js r128 did not load locally.');renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.NoToneMapping;renderer.domElement.setAttribute('aria-hidden','true');renderer.domElement.style.position='absolute';renderer.domElement.style.inset='0';renderer.domElement.style.zIndex='0';host.insertBefore(renderer.domElement,fallback);renderer.domElement.addEventListener('webglcontextlost',function(e){e.preventDefault();showFallback('WebGL context was lost. Reload the local page or enable hardware acceleration.');});buildScene();if(window.location.search.indexOf('geometry-debug=1')!==-1){window.dispenserSceneQA={meshTris:function(){root3d.updateMatrixWorld(true);var out=[];root3d.traverse(function(o){if(!o.isMesh||!o.geometry)return;for(var n=o;n;n=n.parent){if(!n.visible)return;}var label=null,chain=[];for(var q=o;q;q=q.parent){var rp=q.userData&&q.userData.rotationPart;if(rp&&rp.callout)return;if(rp&&rp.label&&!label)label=rp.label+(rp.piece?'/'+rp.piece:'');if(q.name)chain.push(q.name);}var g=o.geometry,pos=g.attributes.position,idx=g.index,v=new THREE.Vector3(),tri=[];function P(i){v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);tri.push(+v.x.toFixed(2),+(-v.z).toFixed(2),+v.y.toFixed(2));}if(idx){for(var i=0;i<idx.count;i++)P(idx.getX(i));}else{for(var k=0;k<pos.count;k++)P(k);}out.push({label:label||chain[0]||'?',chain:chain.slice(0,3).join(' < '),t:tri});});return JSON.stringify(out);},meshBoxes:function(){root3d.updateMatrixWorld(true);var out=[];root3d.traverse(function(o){if(!o.isMesh||!o.geometry)return;for(var n=o;n;n=n.parent){if(!n.visible)return;}var label=null,chain=[];for(var q=o;q;q=q.parent){var rp=q.userData&&q.userData.rotationPart;if(rp&&rp.callout)return;if(rp&&rp.label&&!label)label=rp.label+(rp.piece?'/'+rp.piece:'');if(q.name)chain.push(q.name);}var b=new THREE.Box3().setFromObject(o);if(b.isEmpty())return;out.push({label:label||chain[0]||'?',chain:chain.slice(0,3).join(' < '),min:[b.min.x,-b.max.z,b.min.y],max:[b.max.x,-b.min.z,b.max.y]});});return out;},state:function(){return controller.snapshot();},request:function(color){return controller.requestDispense(color);},scan:function(code){return controller.scan(code,controller.snapshot().wallNow);},step:function(dt){var s=controller.tick(dt,controller.snapshot().wallNow+dt*1000);animateActors(s);return s;},inspect:function(color){var gate=componentMap[color+'-upper-blade-tab'],pin=componentMap['engagement-pin'];if(!gate||!pin)throw new Error('Unknown station '+color);root3d.updateMatrixWorld(true);var slot=gate.localToWorld(new THREE.Vector3(0,0,-recipeMap.blade.parameters.slot_center_y)),pinCenter=pin.getWorldPosition(new THREE.Vector3()),pinAxis=pin.localToWorld(new THREE.Vector3(0,1,0)).sub(pinCenter).normalize();return {phase:controller.snapshot().phase,gateSlot:[slot.x,slot.y,slot.z],pinCenter:[pinCenter.x,pinCenter.y,pinCenter.z],pinAxis:[pinAxis.x,pinAxis.y,pinAxis.z],horizontalError:Math.hypot(slot.x-pinCenter.x,slot.z-pinCenter.z)};}};window.dispenserSceneQA.paused=false;window.dispenserSceneQA.assemblyDiagnostics=assemblyDiagnostics;window.dispenserSceneQA.socketCenters=function(){return assemblyDiagnostics().socketCenters;};window.dispenserSceneQA.controllerMotionTrace=function(){return assemblyDiagnostics().controllerTrace;};window.dispenserSceneQA.sliderCrankDiagnostic=function(){return sliderCrankDiagnostic(controller.snapshot());};window.dispenserSceneQA.tongueSpringState=function(){return tongueSpringState(controller.snapshot(),false);};}window.addEventListener('resize',resize);if(window.ResizeObserver)new ResizeObserver(resize).observe(host);}
    catch(error){showFallback('Unable to initialize the local Three.js/WebGL scene. '+error.message+' Enable WebGL or use a supported browser; no network connection is used.');}}
  function showFallback(text){fallback.hidden=false;fallback.querySelector('p').textContent=text;if(renderer){renderer.dispose();renderer=null;}}
  function buildControls(){
    var rows=document.getElementById('cartridgeControls'),bars=document.getElementById('barcodeControls');
    DATA.palette.forEach(function(c){var row=document.createElement('div');row.className='cartridge-row';row.innerHTML='<div class="cartridge-name"><i class="dot '+c.id+'"></i>'+c.label+'<span class="cartridge-meta" id="meta-'+c.id+'">Present · EMPTY · 0/5 assumed</span></div><button class="mini-button" data-cap="'+c.id+'" type="button">Locked · scan first</button><button class="mini-button" data-exchange="'+c.id+'" type="button">Remove</button><button class="mini-button" data-fill="'+c.id+'" type="button" disabled>Fill</button>';rows.appendChild(row);});
    var examples=DATA.demo.scan_examples||{}, invalidCode=examples.invalid;
    function addScanButton(code,color){var button=document.createElement('button'),label=color?color.toUpperCase():'INVALID CONTAINER';button.type='button';button.className='mini-button barcode-button';if(!color)button.classList.add('invalid-container-fixture');button.dataset.scan=code;button.textContent=code+' → '+label;bars.appendChild(button);}
    Object.keys(DATA.demo.barcodes).forEach(function(code){var color=DATA.demo.barcodes[code];if(color)addScanButton(code,color);});
    if(invalidCode&&!Object.prototype.hasOwnProperty.call(DATA.demo.barcodes,invalidCode))addScanButton(invalidCode,null);
    document.querySelectorAll('[data-dispense]').forEach(function(btn){btn.addEventListener('click',function(){controller.requestDispense(btn.dataset.dispense);renderStatus(controller.snapshot());});});
    rows.addEventListener('click',function(event){var b=event.target.closest('button');if(!b)return;var id=b.dataset.cap||b.dataset.exchange||b.dataset.fill,s=controller.snapshot(),c=s.cartridges[id];if(b.dataset.cap){if(c.capOpen)controller.closeCap(id);else if(c.occupancy==='loaded')controller.openCap(id);else controller.reject('This supported-color compartment is empty. Scan and place a matching fictional container first.');}else if(b.dataset.exchange)controller.exchange(id);else if(b.dataset.fill)controller.fill(id);renderStatus(controller.snapshot());});
    bars.addEventListener('click',function(event){var b=event.target.closest('[data-scan]');if(b)controller.scan(b.dataset.scan,performance.now());renderStatus(controller.snapshot());});
    document.getElementById('resetBtn').addEventListener('click',function(){controller.reset();renderStatus(controller.snapshot());});
    document.getElementById('scheduleBtn').addEventListener('click',function(){controller.startSchedule(document.getElementById('scheduleMode').value);renderStatus(controller.snapshot());});
    document.getElementById('speedRange').addEventListener('input',function(event){var value=controller.setSpeed(event.target.value);document.getElementById('speedOutput').value=value.toFixed(1)+'×';renderStatus(controller.snapshot());});
    capToggle.addEventListener('change',function(){DATA.components.forEach(function(c){if(c.category==='cap')componentMap[c.component_id].visible=capToggle.checked;});});
    labelToggle.addEventListener('change',function(){labels.forEach(function(label){label.visible=labelToggle.checked&&housingLabelsOk();});});
    document.getElementById('housingVisible').addEventListener('change',function(e){var look=window.DispenserReferenceLook;if(look&&look.setHousingHidden)look.setHousingHidden(!e.target.checked);});
    document.querySelectorAll('input[name="housingModeOpt"]').forEach(function(radio){radio.addEventListener('change',function(){if(!radio.checked)return;var look=window.DispenserReferenceLook,mode=radio.value,wasExploded=look.housingMode()==='exploded';if(look&&look.setHousingMode)look.setHousingMode(mode);if(mode==='exploded'){flyTo({y:98,radius:Math.max(orbit.radius,610)});}else if(wasExploded){flyTo({y:4,radius:Math.min(orbit.radius,330)});}});});
    scannerToggle.addEventListener('change',function(){setScannerSubsystemVisibility(scannerToggle.checked);});
    mechanismToggle.addEventListener('change',function(){setDispensingMechanismVisibility(mechanismToggle.checked);});
    [mechanismToggle,scannerToggle].forEach(function(toggle){toggle.addEventListener('change',closePrintPlates,true);});
    var activeSubView=null,subViews=document.querySelectorAll('input[name="subsystemView"]'),otherToggles=[mechanismToggle,scannerToggle,labelToggle,dimensionsToggle],savedToggles=null,savedDimensionOptions=null;
    function applyToggleEffects(skip){
      if(skip!==mechanismToggle)setDispensingMechanismVisibility(mechanismToggle.checked);
      if(skip!==scannerToggle)setScannerSubsystemVisibility(scannerToggle.checked);
      if(skip!==dimensionsToggle){dimensionGroups.fixed.visible=dimensionsToggle.checked;dimensionGroups.rotating.visible=dimensionsToggle.checked;dimensionCategoryRow.hidden=!dimensionsToggle.checked;renderDimensionDetails();}
    }
    // Rotation view needs the mechanism and electronics groups drawn, so their visibility is forced on while their marks are cleared.
    function enterRotationSubview(view,switching){
      if(!switching){
        savedToggles=otherToggles.map(function(t){return t.checked;});
        otherToggles.forEach(function(t){t.checked=false;});
        applyToggleEffects(null);setDispensingMechanismVisibility(true);setScannerSubsystemVisibility(true);
        if(window.DispenserReferenceLook){window.DispenserReferenceLook.setRotationLabels(false);window.DispenserReferenceLook.setRotationFade(document.getElementById('rotationFade').value/100);}
      }
      setRotationOnly(true,view);
      if(!switching)savedDimensionOptions={html:dimensionCategory.innerHTML,value:dimensionCategory.value};
      fillDimensionGroups();renderRotationDimensions();
    }
    function fillDimensionGroups(){var look=window.DispenserReferenceLook,all=document.createElement('option');all.value='all';all.textContent='Rotation: all dimensions';dimensionCategory.replaceChildren(all);look.rotationDimensionGroups().forEach(function(group){var option=document.createElement('option');option.value=group.id;option.textContent=group.label;dimensionCategory.appendChild(option);});dimensionCategory.selectedIndex=0;}
    function leaveRotationSubview(skip){
      setRotationOnly(false);
      if(savedDimensionOptions){dimensionCategory.innerHTML=savedDimensionOptions.html;dimensionCategory.value=savedDimensionOptions.value;savedDimensionOptions=null;}
      if(savedToggles)otherToggles.forEach(function(t,i){if(t!==skip)t.checked=savedToggles[i];});
      savedToggles=null;applyToggleEffects(skip);
    }
    subViews.forEach(function(radio){radio.addEventListener('click',function(){
      closePrintPlates();
      if(activeSubView===radio){radio.checked=false;activeSubView=null;leaveRotationSubview(null);}else{var switching=Boolean(activeSubView);activeSubView=radio;enterRotationSubview(radio.id==='mountOnlyToggle'?'mount':radio.id==='housingOnlyToggle'?'housing':radio.id==='compartmentOnlyToggle'?'compartment':'rotation',switching);}
    });});
    // In rotation view, Show labels drives the part callouts; picking either subsystem returns to the normal view.
    labelToggle.addEventListener('change',function(){if(rotationPreview.only)window.DispenserReferenceLook.setRotationLabels(labelToggle.checked);});
    [mechanismToggle,scannerToggle].forEach(function(toggle){toggle.addEventListener('change',function(){
      if(!rotationPreview.only||!toggle.checked)return;
      subViews.forEach(function(radio){radio.checked=false;});activeSubView=null;leaveRotationSubview(toggle);
    });});
    document.getElementById('bladeSlide').addEventListener('input',function(e){bladeSet(e.target.value/100);});document.getElementById('bladeToggle').addEventListener('click',function(){bladeSet(Number(document.getElementById('bladeSlide').value)>=50?0:1);});document.getElementById('removalNext').addEventListener('click',removalAdvance);document.getElementById('removalRestart').addEventListener('click',removalReset);document.getElementById('removalColor').addEventListener('change',removalReset);
    document.querySelectorAll('input[name="partType"]').forEach(function(box){box.addEventListener('change',applyPartType);});
    document.getElementById('printPlatesBtn').addEventListener('click',function(){var look=window.DispenserReferenceLook,btn=document.getElementById('printPlatesBtn');if(!look||!look.setPrintLayout)return;var on=!look.printLayoutOn();look.setPrintLayout(on);btn.textContent=on?'Hide print plates':'Show print plates';btn.setAttribute('aria-pressed',on?'true':'false');});
    function setView(name){var id=name==='mount'?'mountOnlyToggle':name==='housing'?'housingOnlyToggle':name==='compartment'?'compartmentOnlyToggle':name==='rotation'?'rotationOnlyToggle':null,current=activeSubView?activeSubView.id:null;if(id===current)return;if(id)document.getElementById(id).click();else if(activeSubView)activeSubView.click();}
    window.DispenserStepHost={controller:controller,barcodes:DATA.demo.barcodes,schedule:DATA.demo.schedule,setView:setView,
      view:function(){return activeSubView?(activeSubView.id==='mountOnlyToggle'?'mount':activeSubView.id==='housingOnlyToggle'?'housing':activeSubView.id==='compartmentOnlyToggle'?'compartment':'rotation'):'main';},
      spin:spinPreview,home:homePreview,rotationTo:function(t){if(!rotationPreview.only)return;if(t>rotationPreview.angle&&rotationPreview.angle<1e-6&&t>Math.PI)rotationPreview.angle=TWO_PI;rotationPreview.target=t;},removalTo:function(n){removalReset();for(var i=0;i<n;i++)removalAdvance();},rotationSettled:function(){return Math.abs(rotationPreview.angle-rotationPreview.target)<1e-6;},
      setRemovalColor:function(color){document.getElementById('removalColor').value=color;removalReset();},removalAdvance:removalAdvance,removalReset:removalReset,bladeSet:bladeSet};
    document.getElementById('rotationSpin90').addEventListener('click',function(){spinPreview(Math.PI/2);});
    document.getElementById('rotationSpin360').addEventListener('click',function(){spinPreview(TWO_PI);});
    document.getElementById('rotationHome').addEventListener('click',homePreview);
    (function(){
      var toggle=document.getElementById('controlsToggle');
      ['pointerdown','pointerup','pointermove','touchstart','wheel'].forEach(function(name){toggle.addEventListener(name,function(event){event.stopPropagation();});});
      toggle.addEventListener('click',function(){
        var hidden=document.body.classList.toggle('controls-hidden'),text=hidden?'Show controls':'Hide controls';
        toggle.setAttribute('aria-pressed',hidden?'true':'false');toggle.setAttribute('aria-label',text);toggle.title=text;
        requestAnimationFrame(function(){resize();});
      });
    }());
    document.getElementById('rotationFade').addEventListener('input',function(event){document.getElementById('rotationFadeOut').value=event.target.value+'%';window.DispenserReferenceLook.setRotationFade(event.target.value/100);});
    var rotationTap=null,hoverDimensionId=null,hoverQueued=false;
    function castFromClient(x,y){var rect=host.getBoundingClientRect(),ray=new THREE.Raycaster();ray.camera=camera;ray.params.Line.threshold=.7;ray.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,-((y-rect.top)/rect.height)*2+1),camera);return ray.intersectObjects(root3d.children,true);}
    function pickComponentAt(x,y){var hits=castFromClient(x,y);function shown(o){for(;o;o=o.parent)if(!o.visible)return false;return true;}for(var k=0;k<hits.length;k++){var id=componentIdOf(hits[k].object);if(id&&shown(componentMap[id]))return id;}return null;}
    function componentLabelAt(x,y){var hits=castFromClient(x,y);function shown(o){for(;o;o=o.parent)if(!o.visible)return false;return true;}for(var k=0;k<hits.length;k++){var o=hits[k].object;if(o.isSprite&&o.userData.texHot&&shown(o))return componentIdOf(o);}return null;}
    function labelHitAt(x,y){var hits=castFromClient(x,y),best=null,bestOrder=-1;function shown(o){for(;o;o=o.parent)if(!o.visible)return false;return true;}for(var k=0;k<hits.length;k++){var o=hits[k].object;if(!(o.isSprite||o.isLine)||!shown(o))continue;var hit=null,rp=o.userData.rotationPart;if(o.userData.dimensionId)hit={kind:'dim',id:o.userData.dimensionId};else if(o.userData.partLabel||(rp&&rp.callout&&rp.label))hit={kind:'part',id:o.userData.partLabel||rp.label};if(hit&&o.renderOrder>bestOrder){best=hit;bestOrder=o.renderOrder;}}return best;}
    // highlights only last while hovering; leaving a hover clears them (selection stays)
    function restoreHighlight(){var look=window.DispenserReferenceLook;look.highlightRotationDimension(null);look.highlightRotationPartLabel(null);}
    host.addEventListener('pointermove',function(e){
      if(!camera||e.buttons||hoverQueued)return;
      hoverQueued=true;var cx=e.clientX,cy=e.clientY;
      requestAnimationFrame(function(){
        hoverQueued=false;
        if(!rotationPreview.only){var cid=componentLabelAt(cx,cy);if(cid!==componentHoverId){componentHoverId=cid;host.style.cursor=cid?'pointer':'';applyComponentHighlight();}return;}
        var hit=labelHitAt(cx,cy),key=hit?hit.kind+':'+hit.id:null,look=window.DispenserReferenceLook;if(key===hoverDimensionId)return;
        hoverDimensionId=key;host.style.cursor=hit?'pointer':'';
        if(hit&&hit.kind==='dim')showDimensionHighlight(look.rotationDimensions(dimensionCategory.value).filter(function(d){return d.id===hit.id;})[0]);
        else if(hit)look.highlightRotationPartLabel(hit.id);
        else restoreHighlight();
      });
    });
    host.addEventListener('pointerleave',function(){if(componentHoverId){componentHoverId=null;applyComponentHighlight();host.style.cursor='';}if(hoverDimensionId===null)return;hoverDimensionId=null;host.style.cursor='';restoreHighlight();});
    host.addEventListener('pointerdown',function(e){rotationTap={x:e.clientX,y:e.clientY};});
    host.addEventListener('pointerup',function(e){
      var tap=rotationTap;rotationTap=null;
      if(!tap||!camera||!scene||Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>4)return;
      if(!rotationPreview.only){var picked=pickComponentAt(e.clientX,e.clientY);if(picked){selectedComponentId=selectedComponentId===picked?null:picked;applyComponentHighlight();}return;}
      var look=window.DispenserReferenceLook,hits=castFromClient(e.clientX,e.clientY),label=null;
      function shown(o){for(;o;o=o.parent)if(!o.visible)return false;return true;}
      var labelHit=labelHitAt(e.clientX,e.clientY);
      if(labelHit&&labelHit.kind==='dim'){var dimRow=dimensionDetails.querySelector('[data-dim="'+labelHit.id+'"]');if(dimRow)dimRow.click();return;}
      if(labelHit&&labelHit.kind==='part'){selectRotationPart(labelHit.id);return;}
      var firstDistance=null,hubLabel='Drum hub + socket decks';
      for(var i=0;i<hits.length;i++){if(!hits[i].object.visible||hits[i].object.isSprite)continue;var found=look.rotationPartLabelOf(hits[i].object);if(!found)continue;if(firstDistance===null){firstDistance=hits[i].distance;label=found;}else if(found===label)continue;else if(label===hubLabel&&hits[i].distance<firstDistance+18){label=found;break;}else break;}
      if(label)selectRotationPart(label);else if(look.selectedRotationPart())selectRotationPart(look.selectedRotationPart());
    });
    dimensionsToggle.addEventListener('change',function(){dimensionGroups.fixed.visible=dimensionsToggle.checked;dimensionGroups.rotating.visible=dimensionsToggle.checked;dimensionCategoryRow.hidden=!dimensionsToggle.checked;renderDimensionDetails();});
    dimensionCategory.addEventListener('change',function(){setDimensionCategory(dimensionCategory.value);renderDimensionDetails();});
    // In rotation view the Show dimensions toggle and the group selector switch to the rotation spec.
    var pinnedDimension=null;
    function showDimensionHighlight(item){window.DispenserReferenceLook.highlightRotationDimension(item?item.id:null);}
    // one select path for every dimension entry point (block, label, line), like selectRotationPart for parts
    function selectDimensionItem(item){var look=window.DispenserReferenceLook,next=look.selectedRotationDimension()===item.id?null:item.id;look.selectRotationDimension(next);pinnedDimension=next?item:null;syncSelectionUI();showDimensionHighlight(item);return next;}
    function syncPinnedDimension(){dimensionDetails.querySelectorAll('[data-dim]').forEach(function(row){row.classList.toggle('selected',Boolean(pinnedDimension)&&row.dataset.dim===pinnedDimension.id);});}
    function renderRotationDimensions(){
      var look=window.DispenserReferenceLook,group=dimensionCategory.value,focus=look.rotationDimensionGroups().filter(function(g){return g.id===group;})[0];
      pinnedDimension=null;hoverDimensionId=null;look.highlightRotationDimension(null);look.selectRotationDimension(null);setFocusFade('dimension',false);look.setRotationDimensions(dimensionsToggle.checked,group);dimensionGroups.fixed.visible=false;dimensionGroups.rotating.visible=false;
      dimensionDetails.replaceChildren();
      look.rotationDimensions(group).forEach(function(item){var row=document.createElement('article'),heading=document.createElement('strong'),value=document.createElement('div'),source=document.createElement('div'),note=document.createElement('small');row.className='dimension-detail';row.tabIndex=0;row.dataset.dim=item.id;heading.textContent=item.short;value.className='dimension-value';value.textContent=item.nominal.toFixed(2)+' mm '+item.tol;source.className='dimension-source';source.textContent=item.kind+' · ASSUMED · NOT_VALIDATED';note.textContent='CAD: '+item.print+(item.note?' — '+item.note:'');row.append(heading,value,source,note);
        row.addEventListener('mouseenter',function(){showDimensionHighlight(item);});row.addEventListener('focus',function(){showDimensionHighlight(item);});
        row.addEventListener('mouseleave',function(){restoreHighlight();});row.addEventListener('blur',function(){restoreHighlight();});
        row.addEventListener('click',function(){selectDimensionItem(item);});
        row.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();row.click();}});
        dimensionDetails.appendChild(row);});
      dimensionDetails.hidden=!dimensionsToggle.checked;
    }
    [dimensionsToggle,dimensionCategory].forEach(function(el){el.addEventListener('change',function(){if(rotationPreview.only)renderRotationDimensions();});});
    host.addEventListener('wheel',function(e){e.preventDefault();orbit.radius=Math.max(56,Math.min(640,orbit.radius+e.deltaY*.12));updateCamera();},{passive:false});
    host.addEventListener('pointerdown',function(e){pointer={id:e.pointerId,x:e.clientX,y:e.clientY};host.setPointerCapture(e.pointerId);});
    host.addEventListener('pointermove',function(e){if(!pointer||pointer.id!==e.pointerId)return;var dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer.x=e.clientX;pointer.y=e.clientY;orbit.theta-=dx*.008;orbit.phi=Math.max(.22,Math.min(2.75,orbit.phi+dy*.008));updateCamera();});
    host.addEventListener('pointerup',function(){pointer=null;});host.addEventListener('pointercancel',function(){pointer=null;});
    host.addEventListener('touchstart',function(e){if(e.touches.length===2)pinchDistance=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);},{passive:true});
    host.addEventListener('touchmove',function(e){if(e.touches.length===2){var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);orbit.radius=Math.max(56,Math.min(640,orbit.radius+(pinchDistance-d)*.18));pinchDistance=d;updateCamera();}},{passive:true});
  }
  function renderStatus(s){
    var labels={'PARKED':'Parked · chamber empty','DRUM_ROTATE':'Rotate drum','CARRIAGE_APPROACH':'Pin aligns with selected tab','PIN_ENGAGE':'Pin engagement','BLADE_PULL_RELEASE':'Upper blade opens','STACK_SETTLE':'Bottom pill drops to lower tongue','BLADE_ISOLATE_CLOSE':'Wedge closes upper blade','BLADE_CLOSED_DWELL':'Upper blade closed · dwell','PIN_LIFT':'Pin lifts from tab slot','TONGUE_RELEASE':'Lower tongue releases pill','PILL_CLEAR':'Pill clears outlet','TONGUE_RETURN':'Lower tongue spring return','PACKAGE_IN':'Package in','BEAM':'Barcode scan beam','SCAN_RESULT':'Scan result','PACKAGE_PLACE':'Place in matching compartment','PACKAGE_OUT':'Package out','CAP_OPEN':'Opening cap','CAP_CLOSE':'Closing cap','CARTRIDGE_LIFT':'Removing cartridge','CARTRIDGE_INSERT':'Inserting cartridge'};
    document.getElementById('phaseLabel').textContent=((window.DispenserReferenceLook&&window.DispenserReferenceLook.ringLabel&&window.DispenserReferenceLook.ringLabel(s.phase))||[])[0]||labels[s.phase]||s.phase;document.getElementById('busyBadge').textContent=s.operation?'BUSY':'IDLE';document.getElementById('servoStatus').textContent=Math.round(s.servoAngle)+'°';document.getElementById('pinStatus').textContent=s.pin.toUpperCase();var bladeOffset=s.selected?s.cartridges[s.selected].blade:-0;document.getElementById('bladeStatus').textContent=(-5.2+10.4*bladeOffset).toFixed(1)+' mm';document.getElementById('tongueStatus').textContent=(s.tongueEdge>0?'+':'')+s.tongueEdge.toFixed(1)+' mm';document.getElementById('trayStatus').textContent=s.trayCount+' visual pills';document.getElementById('scannerStatus').textContent=s.scanner;
    document.getElementById('actorStatus').textContent=s.pill?(s.pill.identity+' · '+s.pill.stage):'None — chamber empty';
    document.getElementById('inventoryStatus').innerHTML=COLORS.map(function(id){var c=s.cartridges[id];return '<div class="inventory-chip"><i class="'+id+'"></i>'+id[0].toUpperCase()+id.slice(1)+': '+(c.present?'present':'removed')+' · '+(c.occupancy==='empty'?'empty':'container placed')+' · '+c.count+'/'+DATA.demo.max_inventory+' assumed pills · '+c.cap+'</div>';}).join('');
    COLORS.forEach(function(id){var c=s.cartridges[id], meta=document.getElementById('meta-'+id);if(meta)meta.textContent=(c.present?'Present':'Removed')+' · '+(c.occupancy==='empty'?'EMPTY':('CONTAINER PLACED · '+c.count+'/'+DATA.demo.max_inventory+' assumed pills'))+' · '+(c.capOpen?'cap open':'cap locked');var cap=document.querySelector('[data-cap="'+id+'"]');if(cap)cap.textContent=c.capOpen?'Close & lock':(c.occupancy==='loaded'?(c.cap==='unlocked'?'Open cap':'Close & lock'):'Locked · scan first');if(cap)cap.disabled=!c.capOpen&&c.occupancy!=='loaded';var fill=document.querySelector('[data-fill="'+id+'"]');if(fill)fill.disabled=!c.capOpen||c.occupancy!=='loaded'||c.count>=DATA.demo.max_inventory;var exchange=document.querySelector('[data-exchange="'+id+'"]');if(exchange)exchange.textContent=c.present?'Remove':'Insert';});
    document.getElementById('scheduleStatus').textContent='Schedule: '+s.schedule.mode+' · '+(s.schedule.active?'request '+s.schedule.index+' of 6':'idle');document.getElementById('scanStatus').textContent=s.scanResult||('Scanner: '+s.scanner.toLowerCase());document.getElementById('rejectionStatus').textContent=s.rejection;
    var loading=document.getElementById('loadingNotice');if(loading){var loaded=COLORS.filter(function(id){return s.cartridges[id].occupancy==='loaded';}),empty=COLORS.filter(function(id){return s.cartridges[id].occupancy==='empty';});loading.textContent=loaded.length?('Container placed: '+loaded.join(', ').toUpperCase()+'. Assumed pill inventory remains zero until explicit Fill; empty: '+empty.join(', ').toUpperCase()+'. Refill is available only while its matching cap is open.'):'All four supported compartments are empty, count zero, closed, and locked. No pill actors are shown; failed scans place nothing.';}
  }
  function animateLegacyActors(s){
    if(drumGroup)drumGroup.rotation.y=-s.drumAngle;
    var byColor={}; DATA.components.forEach(function(c){if(c.color)byColor[c.color]=c;});
    ['red','blue','green','orange'].forEach(function(color){var base=byColor[color], c=s.cartridges[color];if(!base)return;
      DATA.components.filter(function(item){return item.color===color;}).forEach(function(item){
        var mesh=componentMap[item.component_id],base=componentBases[item.component_id];if(!mesh||!base)return;
        if(item.category!=='cap'){mesh.position.copy(base.position);mesh.rotation.copy(base.rotation);}
        var focused=s.selected===color;
        if(item.category==='cap'){mesh.visible=capToggle.checked;var hinge=capPivots[color],openAngle=CAP_OPEN_RAD*c.capAngle;if(hinge){hinge.rotation.copy(capPivotBases[color]);hinge.rotateX(-openAngle);}}
        if(item.category==='cartridge'){mesh.visible=c.present||c.lift>0;mesh.position.y+=c.lift*75;}
        if(item.category==='blade'){
          // Local Y is the selected short-width slide axis; the mutual interlock only allows this motion with the tongue fully closed.
          var tongueClosed=s.tongueMotion==='closed'&&Math.abs(s.tongueEdge-5.7)<1e-9, safeBlade=tongueClosed?c.blade:0;
          mesh.position.copy(base.position).addScaledVector(bladeTravelDirection(base.rotation),safeBlade*DATA.station.blade.stroke_mm);
          mesh.traverse(function(part){if(part.isMesh&&part.material){part.material.transparent=false;part.material.depthWrite=true;part.material.opacity=1;part.material.color.setHex(focused?0xf24664:0xc5a354);}});
        }
      });
      pills[color].forEach(function(pill,index){
        var dispensed=5-c.count,active=s.pill&&s.pill.color===color&&index===s.pill.pill_index;
        if(s.trayCount===0){pill.userData.onTray=false;pill.userData.transferStart=null;}
        if(active&&s.pill.stage!=='tray'&&s.pill.stage!=='stack'){
          if(!pill.userData.transferStart){root3d.updateMatrixWorld(true);pill.userData.transferStart=pill.getWorldPosition(new THREE.Vector3());mechanismGroup.attach(pill);}pill.userData.onTray=false;pill.visible=true;
          var start=pill.userData.transferStart,tongue=tongueLandingPosition(color,index),finish=traySlotPosition(color,index,s.trayCount),progress=Math.max(0,Math.min(1,s.pill.progress||0));
          if(s.pill.stage==='falling_to_tongue')pill.position.copy(transferPillPosition(start,tongue,progress));else if(s.pill.stage==='tongue')pill.position.copy(tongue);else if(s.pill.stage==='falling')pill.position.copy(fallPillPosition(tongue,finish,progress));else pill.position.copy(tongue);return;
        }
        if(dispensed>index&&active&&s.pill.stage==='tray'){pill.userData.onTray=true;pill.userData.traySequence=s.trayCount-1;}
        if(pill.userData.onTray){if(pill.parent!==root3d)root3d.attach(pill);pill.visible=true;pill.position.copy(traySlotPosition(color,index,pill.userData.traySequence));pill.userData.transferStart=null;return;}
        if(pill.parent!==pill.userData.stationGroup)pill.userData.stationGroup.attach(pill);
        pill.userData.onTray=false;pill.userData.transferStart=null;pill.position.copy(pill.userData.rest);pill.visible=index>=dispensed&&index<dispensed+c.count;
        if(color===s.selected&&index>=dispensed)pill.position.y+=c.stackOffset||0;
      });
    });
    labels.forEach(function(label){var owner=label.parent&&label.parent.userData&&label.parent.userData.component;label.visible=!rotationPreview.only&&housingLabelsOk()&&(!label.userData.scannerPart||scannerVisible)&&(selectedComponentId?Boolean(owner&&owner.component_id===selectedComponentId):labelToggle.checked);});
    var carriage=componentMap['pin-carriage'];if(carriage)carriage.position.copy(componentBases['pin-carriage'].position).z+=s.carriage;
    var solenoid=componentMap['pull-solenoid'];if(solenoid)solenoid.position.copy(componentBases['pull-solenoid'].position).z+=s.carriage;
    var pin=componentMap['engagement-pin'];if(pin){pin.position.copy(componentBases['engagement-pin'].position);pin.position.z+=s.carriage;pin.position.y+=s.pinZ;if(pin.material)pin.material.color.setHex(s.pin==='engaged'?0xf24664:0x3b5267);}
    var tongue=componentMap['shared-lower-tongue'],tongueBase=componentBases['shared-lower-tongue'];if(tongue&&tongueBase){var bladesClosed=Object.keys(s.cartridges).every(function(id){return s.cartridges[id].blade===0&&s.cartridges[id].bladeMotion==='closed';}),safeEdge=bladesClosed?s.tongueEdge:5.7;tongue.position.copy(tongueBase.position);tongue.position.z+=DATA.station.tongue.edge_y_closed_open_mm[0]-safeEdge;var spring=componentMap['tongue-return-spring'],springBase=componentBases['tongue-return-spring'],springRecipe=recipeMap['tongue-return-spring'].parameters,tongueCanonical=DATA.components.find(function(item){return item.component_id==='shared-lower-tongue';}),tongueLength=recipeMap.tongue.parameters.size[1],springSeat=recipeMap.housing.parameters.tongue_spring_reaction_pad;if(spring&&springBase&&springRecipe&&tongueCanonical&&springSeat){var movingAnchorY=tongueCanonical.position[1]+tongueLength/2+(safeEdge-DATA.station.tongue.edge_y_closed_open_mm[0]),fixedAnchorY=springSeat.center_mm[1]+springSeat.size_mm[1]/2,springLength=Math.max(.1,fixedAnchorY-movingAnchorY);spring.position.copy(springBase.position);spring.position.z=-(fixedAnchorY+movingAnchorY)/2;spring.scale.set(1,springLength/springRecipe.height,1);}}
    var crank=componentMap['servo-crank'], crankBase=componentBases['servo-crank'];if(crank&&crankBase){crank.rotation.copy(crankBase.rotation);crank.rotation.y-=THREE.MathUtils.degToRad(s.servoAngle);}
    var rod=componentMap['connecting-rod'],rodBase=componentBases['connecting-rod'];if(rod&&rodBase){rod.position.copy(rodBase.position);rod.position.z+=s.carriage*.5;rod.rotation.copy(rodBase.rotation);rod.rotation.x+=Math.atan2(s.carriage,34);}
    var shaft=componentMap['servo-unit'],shaftBase=componentBases['servo-unit'];if(shaft&&shaftBase){shaft.rotation.copy(shaftBase.rotation);shaft.rotation.y-=THREE.MathUtils.degToRad(s.servoAngle);}
    if(targets.package){var invalidExample=(DATA.demo.scan_examples||{}).invalid,fixtureColor=DATA.demo.barcodes[s.scanCode]||'red';setFictionalContainerColor(targets.package,s.scanCode===invalidExample?'purple':fixtureColor);var packagePark=new THREE.Vector3(-29.5+SCAN_DX,29.9,16),packageAtReader=new THREE.Vector3(-29.5+SCAN_DX,29.9,0),packageProgress=0;if(s.phase==='PACKAGE_IN')packageProgress=s.phaseProgress;else if(s.phase==='BEAM'||s.phase==='SCAN_RESULT')packageProgress=1;else if(s.phase==='PACKAGE_PLACE'&&s.scanMatchedColor)targets.package.position.lerpVectors(packageAtReader,containerTargetPosition(s.scanMatchedColor),s.phaseProgress);else if(s.phase==='PACKAGE_OUT'){if(s.scanAction==='place'&&s.scanMatchedColor)targets.package.position.copy(containerTargetPosition(s.scanMatchedColor));else targets.package.position.lerpVectors(packageAtReader,packagePark,s.phaseProgress);}if(s.phase!=='PACKAGE_PLACE'&&s.phase!=='PACKAGE_OUT')targets.package.position.lerpVectors(packagePark,packageAtReader,packageProgress);var activeScanPhase=s.phase==='PACKAGE_IN'||s.phase==='BEAM'||s.phase==='SCAN_RESULT'||s.phase==='PACKAGE_PLACE'||s.phase==='PACKAGE_OUT';targets.package.visible=scannerVisible&&activeScanPhase;var beamPositions=targets.beam.geometry.attributes.position;beamPositions.setXYZ(0,-37+SCAN_DX,29.9,0);beamPositions.setXYZ(1,targets.package.position.x-3.25,targets.package.position.y,targets.package.position.z);beamPositions.needsUpdate=true;targets.beam.geometry.computeBoundingSphere();targets.beam.visible=scannerVisible&&s.phase==='BEAM';}
    COLORS.forEach(function(color){var c=s.cartridges[color],actor=placedContainers[color];if(!actor)return;actor.visible=scannerVisible&&c.present&&c.occupancy==='loaded'&&c.capOpen;if(actor.visible)actor.position.copy(containerTargetPosition(color));});
  }
  function canonicalPointFromThree(point){return [point.x,-point.z,point.y];}
  function canonicalWorldPosition(object){root3d.updateMatrixWorld(true);return canonicalPointFromThree(object.getWorldPosition(new THREE.Vector3()));}
  function tongueSpringState(snapshot,apply){
    var spring=componentMap['tongue-return-spring'],recipe=recipeMap['tongue-return-spring']&&recipeMap['tongue-return-spring'].parameters,lower=assemblySchedule&&assemblySchedule.actuator_zones&&assemblySchedule.actuator_zones.lower_tongue||{},placement=placementById['tongue-return-spring'],center=lower.spring_center_fallback_mm||placement&&placement.rendered_fallback_position_mm||FR034_AK_FALLBACK.tongueSpringFallbackMm,axis=lower.spring_axis_canonical||[0,1,0];
    if(!spring||!recipe)return {status:'UNRESOLVED',reason:'Spring recipe or lower-plunger spring fallback is unavailable.'};
    var bracket=(assemblySchedule&&assemblySchedule.integrated_features||[]).find(function(item){return item.feature_id==='tongue-return-fixed-bracket';})||{},closedEdge=DATA.station.tongue.edge_y_closed_open_mm[0],travel=snapshot.tongueEdge-closedEdge;
    // Display-only: the fixed seat is the rest-span -Y end and the moving seat is the carriage face that follows the tongue; no source seat offsets exist.
    var fixedY=center[1]-recipe.height/2,movingY=center[1]+recipe.height/2+travel,carriageSubmesh=integratedSubmeshMeshes['lower-tongue-moving-carriage'];
    if(carriageSubmesh){root3d.updateMatrixWorld(true);movingY=canonicalPointFromThree(carriageSubmesh.mesh.getWorldPosition(new THREE.Vector3()))[1]-carriageSubmesh.feature.parameters.size_mm[2]/2;}
    var length=Math.max(.1,movingY-fixedY),moving=[center[0],movingY,center[2]],fixed=[center[0],fixedY,center[2]];
    if(apply){spring.position.copy(toThree([center[0],(fixedY+movingY)/2,center[2]]));spring.quaternion.copy(componentBases['tongue-return-spring'].quaternion);spring.scale.set(1,length/recipe.height,1);tongueSpringEndpoints={moving:moving.slice(),fixed:fixed.slice(),length:length,placementSource:'assumed lower-plunger spring_center_fallback_mm'};}
    var renderedMoving=null,renderedFixed=null,renderedLength=null;
    root3d.updateMatrixWorld(true);renderedMoving=canonicalPointFromThree(spring.localToWorld(new THREE.Vector3(0,recipe.height/2,0)));renderedFixed=canonicalPointFromThree(spring.localToWorld(new THREE.Vector3(0,-recipe.height/2,0)));renderedLength=Math.hypot(renderedFixed[0]-renderedMoving[0],renderedFixed[1]-renderedMoving[1],renderedFixed[2]-renderedMoving[2]);
    return {status:'UNRESOLVED',springCenterFallbackMm:center.slice(),springAxisCanonical:axis.slice(),concentricWithNodeId:lower.spring_concentric_with_node_id||null,movingEndpointNodeId:lower.spring_moving_endpoint_node_id||null,fixedBracketFeatureId:bracket.feature_id||null,fixedBracketRenderedFallbackMm:bracket.rendered_fallback_position_mm||null,springEndSeatOffsetsMm:lower.spring_end_seat_offsets_mm===undefined?null:lower.spring_end_seat_offsets_mm,plungerCarriageContactMm:lower.plunger_carriage_contact_mm===undefined?null:lower.plunger_carriage_contact_mm,sourcePositionMm:null,movingEndpointMm:moving,fixedEndpointMm:fixed,lengthMm:length,renderedMovingEndpointMm:renderedMoving,renderedFixedEndpointMm:renderedFixed,renderedLengthMm:renderedLength,renderedTransformStatus:'UNRESOLVED',renderedFallbackProvenance:'ASSUMED',placementSource:'spring_center_fallback_mm',requiredClearance:'UNRESOLVED',fixedBracketConflict:'The assumed fixed-bracket fallback lies inside the display spring span; seat positions are not reconciled.',historicalLengthNote:'A–K spring lengths are historical and are not used as the current lower-plunger spring endpoints; the display mesh height is only a schematic size.',fr033Sc024Contradiction:'A–K shortens on opening; FR-033/SC-024 says it extends. Not reconciled.',note:'Schematic concentric canonical-Y visual only; not actual hardware coordinates, a clearance result, or physical validation.'};
  }
  function sliderCrankDiagnostic(snapshot){
    var schedule=assemblySchedule&&assemblySchedule.slider_crank||assemblySchedule&&assemblySchedule.servo_schedule,r=schedule&&(schedule.radius_mm||schedule.crank_radius_mm),l=schedule&&(schedule.rod_length_mm||schedule.connecting_rod_length_mm);
    if(!Number.isFinite(r)||!Number.isFinite(l))return {status:'UNRESOLVED',reason:'Slider-crank parameters are unavailable.'};
    var theta=THREE.MathUtils.degToRad(snapshot.servoAngle),q=r*(1+Math.cos(theta))+Math.sqrt(Math.max(0,l*l-r*r*Math.sin(theta)*Math.sin(theta)))-l;
    return {status:'UNRESOLVED',thetaRad:theta,derivedQmm:q,controllerCarriageMm:snapshot.carriage,closureDeltaMm:q-snapshot.carriage,authority:'FSM controller carriage value only; formula is a diagnostic and never drives scene or controller motion.',endpointMapping:'UNRESOLVED',verificationStatus:schedule.verification_status||'NOT_VALIDATED'};
  }
  function housingLabelsOk(){var look=window.DispenserReferenceLook;return !(look&&look.housingMode&&look.housingMode()==='assembled');}
  function animateActors(s){
    if(drumGroup)drumGroup.rotation.y=-(s.drumAngle+rotationPreview.angle);
    COLORS.forEach(function(color){
      var state=s.cartridges[color],lift=cartridgeLiftGroups[color],cap=componentMap[color+'-cap'],pivotGroup=capPivots[color],capBase=componentBases[color+'-cap'],blade=componentMap[color+'-upper-blade-tab'],bladeBase=componentBases[color+'-upper-blade-tab'];
      if(lift)lift.position.y=(state.lift||0)*75;
      if(cap){cap.visible=capToggle.checked&&cap.userData.poseResolved!==false;}
      if(pivotGroup){pivotGroup.quaternion.copy(capPivotBases[color]);pivotGroup.rotateX(-CAP_OPEN_RAD*state.capAngle);}
      if(blade&&bladeBase){var tongueClosed=s.tongueMotion==='closed'&&Math.abs(s.tongueEdge-5.7)<1e-9,safeBlade=tongueClosed?state.blade:0;blade.position.copy(bladeBase.position).addScaledVector(bladeTravelDirection(bladeBase.rotation),safeBlade*DATA.station.blade.stroke_mm);blade.traverse(function(part){if(part.isMesh&&part.material){part.material.transparent=false;part.material.depthWrite=true;part.material.opacity=1;part.material.color.setHex(s.selected===color?0xf24664:0xc5a354);}});}
      pills[color].forEach(function(pill,index){
        var dispensed=5-state.count,active=s.pill&&s.pill.color===color&&index===s.pill.pill_index;
        if(s.trayCount===0){pill.userData.onTray=false;pill.userData.transferStart=null;}
        if(active&&s.pill.stage!=='tray'&&s.pill.stage!=='stack'){
          if(!pill.userData.transferStart){root3d.updateMatrixWorld(true);pill.userData.transferStart=pill.getWorldPosition(new THREE.Vector3());mechanismGroup.attach(pill);}pill.userData.onTray=false;pill.visible=true;
          var start=pill.userData.transferStart,tongue=tongueLandingPosition(color,index),finish=traySlotPosition(color,index,s.trayCount),progress=Math.max(0,Math.min(1,s.pill.progress||0));
          if(s.pill.stage==='falling_to_tongue')pill.position.copy(transferPillPosition(start,tongue,progress));else if(s.pill.stage==='tongue')pill.position.copy(tongue);else if(s.pill.stage==='falling')pill.position.copy(fallPillPosition(tongue,finish,progress));else pill.position.copy(tongue);return;
        }
        if(dispensed>index&&active&&s.pill.stage==='tray'){pill.userData.onTray=true;pill.userData.traySequence=s.trayCount-1;}
        if(pill.userData.onTray){if(pill.parent!==mechanismGroup)mechanismGroup.attach(pill);pill.visible=true;pill.position.copy(traySlotPosition(color,index,pill.userData.traySequence));pill.userData.transferStart=null;return;}
        if(pill.parent!==pill.userData.stationGroup)pill.userData.stationGroup.attach(pill);
        pill.userData.onTray=false;pill.userData.transferStart=null;pill.position.copy(pill.userData.rest);pill.visible=index>=dispensed&&index<dispensed+state.count;if(color===s.selected&&index>=dispensed)pill.position.y+=state.stackOffset||0;
      });
    });
    labels.forEach(function(label){var owner=label.parent&&label.parent.userData&&label.parent.userData.component;label.visible=!rotationPreview.only&&housingLabelsOk()&&(!label.userData.scannerPart||scannerVisible)&&(selectedComponentId?Boolean(owner&&owner.component_id===selectedComponentId):labelToggle.checked);});
    var unlockerPin=integratedSubmeshMeshes['lid-unlocker-pin'];if(unlockerPin){var pinLift=0;COLORS.forEach(function(color){if(s.cartridges[color].cap!=='locked'&&stationGroups[color]){var at=canonicalWorldPosition(stationGroups[color]);if(Math.hypot(at[0],at[1])<1)pinLift=3;}});unlockerPin.mesh.position.copy(unlockerPin.base);unlockerPin.mesh.position.y+=pinLift;}
    if(carriageGroup){var pinSchedule=assemblySchedule&&assemblySchedule.pin_schedule||{},carriageBase=toThree([0,pinSchedule.closed_center_y_mm||FR034_AK_FALLBACK.pinClosedYmm,FR034_AK_FALLBACK.carriageZmm]);carriageGroup.position.copy(carriageBase);carriageGroup.position.z+=s.carriage;}
    var pin=componentMap['engagement-pin'];if(pin){pin.position.copy(componentBases['engagement-pin'].position);pin.position.y+=s.pinZ;var pinMesh=pin.children[0];if(pinMesh&&pinMesh.material)pinMesh.material.color.setHex(s.pin==='engaged'?0xf24664:0x3b5267);}
    if(tongueGroup){tongueGroup.position.copy(toThree([0,-6.3,-.75]));tongueGroup.position.z+=DATA.station.tongue.edge_y_closed_open_mm[0]-s.tongueEdge;}
    var lowerBody=integratedSubmeshMeshes['lower-tongue-pull-solenoid-body'];
    if(lowerBody){var tongueShift=DATA.station.tongue.edge_y_closed_open_mm[0]-s.tongueEdge;lowerBody.mesh.position.copy(lowerBody.base).add(new THREE.Vector3(0,0,-tongueShift).applyQuaternion(lowerBody.owner.quaternion.clone().invert()));}
    tongueSpringState(s,true);
    var crank=componentMap['servo-crank'],crankBase=componentBases['servo-crank'],rod=componentMap['connecting-rod'],rodBase=componentBases['connecting-rod'],shaft=componentMap['servo-unit'],shaftBase=componentBases['servo-unit'];
    if(crank&&crankBase){crank.quaternion.copy(crankBase.quaternion);crank.rotateY(-THREE.MathUtils.degToRad(s.servoAngle));}
    if(rod&&rodBase){rod.position.copy(rodBase.position);rod.position.z+=s.carriage*.5;rod.quaternion.copy(rodBase.quaternion);rod.rotateX(Math.atan2(s.carriage,34));}
    if(shaft&&shaftBase){shaft.quaternion.copy(shaftBase.quaternion);shaft.rotateY(-THREE.MathUtils.degToRad(s.servoAngle));}
    if(targets.package){var invalidExample=(DATA.demo.scan_examples||{}).invalid,fixtureColor=DATA.demo.barcodes[s.scanCode]||'red';setFictionalContainerColor(targets.package,s.scanCode===invalidExample?'purple':fixtureColor);var packagePark=new THREE.Vector3(-29.5+SCAN_DX,29.9,16),packageAtReader=new THREE.Vector3(-29.5+SCAN_DX,29.9,0),packageProgress=0;if(s.phase==='PACKAGE_IN')packageProgress=s.phaseProgress;else if(s.phase==='BEAM'||s.phase==='SCAN_RESULT')packageProgress=1;else if(s.phase==='PACKAGE_PLACE'&&s.scanMatchedColor)targets.package.position.lerpVectors(packageAtReader,containerTargetPosition(s.scanMatchedColor),s.phaseProgress);else if(s.phase==='PACKAGE_OUT'){if(s.scanAction==='place'&&s.scanMatchedColor)targets.package.position.copy(containerTargetPosition(s.scanMatchedColor));else targets.package.position.lerpVectors(packageAtReader,packagePark,s.phaseProgress);}if(s.phase!=='PACKAGE_PLACE'&&s.phase!=='PACKAGE_OUT')targets.package.position.lerpVectors(packagePark,packageAtReader,packageProgress);var activeScanPhase=s.phase==='PACKAGE_IN'||s.phase==='BEAM'||s.phase==='SCAN_RESULT'||s.phase==='PACKAGE_PLACE'||s.phase==='PACKAGE_OUT';targets.package.visible=scannerVisible&&activeScanPhase;var beamPositions=targets.beam.geometry.attributes.position;beamPositions.setXYZ(0,-37+SCAN_DX,29.9,0);beamPositions.setXYZ(1,targets.package.position.x-3.25,targets.package.position.y,targets.package.position.z);beamPositions.needsUpdate=true;targets.beam.geometry.computeBoundingSphere();targets.beam.visible=scannerVisible&&s.phase==='BEAM';}
    COLORS.forEach(function(color){var state=s.cartridges[color],actor=placedContainers[color];if(!actor)return;actor.visible=scannerVisible&&state.present&&state.occupancy==='loaded'&&state.capOpen;if(actor.visible)actor.position.copy(containerTargetPosition(color));});
    if(window.DispenserReferenceLook)window.DispenserReferenceLook.update(s);
  }
  function assemblyDiagnostics(){
    var s=controller.snapshot(),socketRecords=[],parts={},parentStatus='PASS',boundsStatus='PASS',transformStatus='PASS';
    root3d.updateMatrixWorld(true);
    (assemblySchedule&&assemblySchedule.socket_frames||[]).forEach(function(socket,index){
      var pose=socketFrame(socket,index),group=stationGroups[socket.color],actual=group?canonicalWorldPosition(group):null,angle=-s.drumAngle,pivot=assemblySchedule.datum.drum_post_axis_xy_mm,dx=pose.center[0]-pivot[0],dy=pose.center[1]-pivot[1],expected=[pivot[0]+dx*Math.cos(angle)-dy*Math.sin(angle),pivot[1]+dx*Math.sin(angle)+dy*Math.cos(angle),pose.center[2]],match=actual&&actual.every(function(value,i){return Math.abs(value-expected[i])<1e-6;});
      socketRecords.push({color:socket.color,expectedMm:expected,restMm:pose.center,actualMm:actual,rotationRad:pose.cartridgeRotation,worldQuaternion:group?group.getWorldQuaternion(new THREE.Quaternion()).toArray():null,renderAgreement:match?'PASS':'FAIL',rotationStatus:'UNRESOLVED',status:'UNRESOLVED',verificationStatus:'NOT_VALIDATED'});
    });
    function expectedWorld(component,placement){
      var resolved=placementInfo(component);if(!placement||!placement.world_position_mm||!resolved.position)return null;
      var p=resolved.position.slice(),id=component.component_id,color=component.color,stationState=color&&s.cartridges[color],isCapChild=color&&['cap','cap-label','tag-carrier','cap-hinge','cap-latch'].indexOf(component.category)>=0;
      if(isCapChild&&stationState){if(component.category!=='cap-hinge'&&stationState.capAngle>0)return null;p[2]+=(stationState.lift||0)*75;}
      if(color&&placement.motion_group==='station-'+color){
        if(component.category==='blade'&&stationState){var tongueClosed=s.tongueMotion==='closed'&&Math.abs(s.tongueEdge-5.7)<1e-9,travel=tongueClosed?stationState.blade*DATA.station.blade.stroke_mm:0,rz=scheduledRotation(component)[2];p[0]-=Math.sin(rz)*travel;p[1]+=Math.cos(rz)*travel;}
        var pivot=assemblySchedule.datum.drum_post_axis_xy_mm,angle=-s.drumAngle,dx=p[0]-pivot[0],dy=p[1]-pivot[1];
        p[0]=pivot[0]+dx*Math.cos(angle)-dy*Math.sin(angle);p[1]=pivot[1]+dx*Math.sin(angle)+dy*Math.cos(angle);
      }
      if(component.category==='carriage'||component.category==='solenoid'||component.category==='pin')p[1]-=s.carriage;
      if(component.category==='pin')p[2]+=s.pinZ;
      if(component.category==='tongue'||component.category==='tongue-rod')p[1]+=s.tongueEdge-5.7;
      if(id==='connecting-rod')p[1]-=s.carriage*.5;
      if(id==='tongue-return-spring')return null;
      return p;
    }
    DATA.components.forEach(function(component){
      var id=component.component_id,node=componentMap[id],placement=placementById[id],sourceInfo=placementInfo(component),box=node?new THREE.Box3().setFromObject(node):null,actual=node?canonicalWorldPosition(node):null,planned=expectedWorld(component,placement),error=planned&&actual?Math.hypot(actual[0]-planned[0],actual[1]-planned[1],actual[2]-planned[2]):null,parentOk=Boolean(node&&placement&&(node.userData.scheduledParentComponentId||null)===(placement.parent_component_id||null)&&node.userData.motionGroup===placement.motion_group),pose='UNRESOLVED';
      if(planned&&error!==null)pose=error<1e-5?'PASS':'FAIL';else if(!node||!placement)pose='FAIL';if(sourceInfo.status==='UNRESOLVED')pose='UNRESOLVED';
      var boxOk=Boolean(box&&[box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z].every(Number.isFinite));if(!node||!placement||!parentOk)parentStatus='FAIL';if(pose==='FAIL')transformStatus='FAIL';else if(pose==='UNRESOLVED'&&transformStatus==='PASS')transformStatus='UNRESOLVED';if(!boxOk)boundsStatus='FAIL';
      parts[id]={exists:Boolean(node),name:node&&node.name,parent:node&&node.parent&&node.parent.name,scheduledParentComponentId:placement&&placement.parent_component_id||null,motionGroup:placement&&placement.motion_group||null,worldMm:actual,expectedWorldMm:sourceInfo.status==='UNRESOLVED'?null:planned,renderedFallbackPositionMm:placement&&placement.rendered_fallback_position_mm||null,placementSource:sourceInfo.source,placementProvenance:sourceInfo.provenance,placementStatus:sourceInfo.status,positionErrorMm:sourceInfo.status==='UNRESOLVED'?null:error,transformStatus:pose,worldQuaternion:node?node.getWorldQuaternion(new THREE.Quaternion()).toArray():null,boundsThree:boxOk?{min:box.min.toArray(),max:box.max.toArray(),status:'PASS',meaning:'Rendered recipe bounds only; not a clearance or fit result.'}:null};
    });
    var pin=componentMap['engagement-pin'],pinWorld=pin?canonicalWorldPosition(pin):null,pinRecipe=recipeMap.pin&&recipeMap.pin.parameters,pinSchedule=assemblySchedule&&assemblySchedule.pin_schedule||{},pinHeight=pinRecipe&&pinRecipe.height||FR034_AK_FALLBACK.pinHeightMm,pinTipZ=pinWorld?pinWorld[2]-pinHeight/2:null,coil=pinSchedule.solenoid_body_z_bounds_mm||FR034_AK_FALLBACK.solenoidBoundsZmm;
    var spring=tongueSpringState(s,false),checks=(assemblySchedule&&assemblySchedule.clearance_checks||[]).map(function(check){return {id:check.check_id,status:check.status==='PASS'?'UNRESOLVED':check.status,requiredGapMm:check.required_gap_mm===undefined?null:check.required_gap_mm,note:'No physical clearance PASS is asserted.'};});
    function ensureCheck(id,status,note){if(!checks.some(function(item){return item.id===id;}))checks.push({id:id,status:status,requiredGapMm:null,note:note});}
    ensureCheck('G-carriage-rail-endpoint','CONFLICT','Closed carriage y=-14.8 is 5.2 mm beyond fixed rail endpoint y=-20.');
    ensureCheck('I-tongue-return-spring','UNRESOLVED','A–K spring shortens on opening; FR-033/SC-024 extension description remains contradictory.');
    ensureCheck('G-plunger-head-gap','UNRESOLVED','Plunger-head extent and required gap are not specified.');
    var conflicts=(assemblySchedule&&assemblySchedule.conflicts||[]).slice();
    function ensureConflict(id,status,description){if(!conflicts.some(function(item){return (item.conflict_id||item.id)===id;}))conflicts.push({conflict_id:id,status:status,verification_status:'NOT_VALIDATED',description:description});}
    ensureConflict('pin-carriage-rail-endpoint','CONFLICT','Closed carriage coordinate y=-14.8 lies 5.2 mm beyond fixed rail endpoint y=-20; neither is moved.');
    ensureConflict('tongue-spring-fr033-ak','UNRESOLVED','A–K spring shortening conflicts with FR-033/SC-024 extension wording; not reconciled.');
    var servoSchedule=assemblySchedule&&assemblySchedule.servo_schedule||{},rodPlacement=placementById['connecting-rod'],servoBodyBounds=servoSchedule.body_bounds_mm||FR034_AK_FALLBACK.servoBodyBoundsMm,servoPivot=servoSchedule.pivot_mm||FR034_AK_FALLBACK.servoPivotMm;
    var pinY=FR034_AK_FALLBACK.pinClosedYmm-s.carriage,raised=pinSchedule.tip_z_raised_mm||FR034_AK_FALLBACK.pinTipRaisedZmm,engaged=pinSchedule.tip_z_engaged_mm||FR034_AK_FALLBACK.pinTipEngagedZmm;
    return {
      status:'Concept placement diagnostics only; no fit, clearance, or physical validation claim.',
      inventory:{status:DATA.components.length===52&&DATA.components.filter(function(c){return c.component_id.indexOf('scanner-mount')===0;}).length===1?'PASS':'FAIL',physicalComponentCount:DATA.components.length,scannerMountIds:DATA.components.filter(function(c){return c.component_id.indexOf('scanner-mount')===0;}).map(function(c){return c.component_id;})},
      parents:{status:parentStatus,records:parts},
      transforms:{status:transformStatus,unresolvedCount:Object.keys(parts).filter(function(id){return parts[id].transformStatus==='UNRESOLVED';}).length},
      bounds:{status:boundsStatus,interpretation:'Finite rendered recipe BBoxes only; they do not establish intersection clearance or fit.'},
      socketCenters:{status:'UNRESOLVED',renderAgreement:socketRecords.every(function(item){return item.renderAgreement==='PASS';})?'PASS':'FAIL',records:socketRecords},
      controllerTrace:{phase:s.phase,selected:s.selected,carriageMm:s.carriage,pinWorldYmm:pinWorld&&pinWorld[1],scheduledPinYmm:pinY,pinTipZmm:pinTipZ,pinTipEndpointsMm:{engaged:engaged,raised:raised},tongueEdgeMm:s.tongueEdge,tongueSpringMovingEndpointYmm:spring.movingEndpointMm?spring.movingEndpointMm[1]:null,tongueSpringFixedEndpointYmm:spring.fixedEndpointMm?spring.fixedEndpointMm[1]:null,movingGroups:assemblySchedule&&assemblySchedule.motion_trace&&assemblySchedule.motion_trace.moving_group_ids||['carriage-slide','tongue-slide'],movedParts:['pin-carriage','pull-solenoid','engagement-pin','shared-lower-tongue','tongue-actuator-rod'].map(function(id){return {componentId:id,worldMm:parts[id]&&parts[id].worldMm,expectedWorldMm:parts[id]&&parts[id].expectedWorldMm,transformStatus:parts[id]&&parts[id].transformStatus,placementStatus:parts[id]&&parts[id].placementStatus,placementSource:parts[id]&&parts[id].placementSource,parent:parts[id]&&parts[id].parent};})},
      tongueSpring:spring,
      plungerCoil:{status:'UNRESOLVED',tipPointStatus:'UNRESOLVED',tipPointWorldZmm:pinTipZ,tipEndpointsMm:{engaged:engaged,raised:raised},assumedBodyBoundsZmm:coil,headExtentStatus:'UNRESOLVED',headGapStatus:'UNRESOLVED',clearance:'UNRESOLVED',reason:'A pin-tip point and assumed solenoid bounds do not specify a plunger-head extent or required clearance.'},
      servoLinkage:{status:'UNRESOLVED',bodyBoundsMm:servoBodyBounds,bodyCenterMm:[midpoint(servoBodyBounds.x),midpoint(servoBodyBounds.y),midpoint(servoBodyBounds.z)],pivotMm:servoPivot,connectingRodLengthMm:servoSchedule.connecting_rod_length_mm||(assemblySchedule&&assemblySchedule.slider_crank&&assemblySchedule.slider_crank.rod_length_mm)||34,rodEndpointPositionsMm:rodPlacement&&rodPlacement.endpoint_positions_mm||null,renderedRodFallbackMm:rodPlacement&&rodPlacement.rendered_fallback_position_mm||FR034_AK_FALLBACK.connectingRodFallbackMm,rodPlacementStatus:'UNRESOLVED',verificationStatus:'NOT_VALIDATED'},
      sliderCrank:sliderCrankDiagnostic(s),clearanceChecks:checks,conflicts:conflicts
    };
  }
  function wiringSuffix(name){var W=window.DispenserWiringSpec;if(!W)return '';if(name.indexOf('micro servos')!==-1)return ' · GPIO '+W.signals.filter(function(s){return /^servo/.test(s.fn);}).map(function(s){return s.gpio+' ('+s.to.split('.')[0].toUpperCase()+')';}).join(', ');if(name.indexOf('stepper')!==-1)return ' · driven through the ULN2003';var comp=W.components.filter(function(c){return c.viewer_label===name||name.indexOf(c.viewer_label)===0;})[0];if(!comp)return '';var gpios=W.signals.filter(function(s){return s.from.indexOf(comp.id+'.')===0||s.to.indexOf(comp.id+'.')===0;}).map(function(s){return s.gpio;}).sort(function(a,b){return a-b;});if(comp.id==='esp32')gpios=W.signals.map(function(s){return s.gpio;}).sort(function(a,b){return a-b;});return gpios.length?' · GPIO '+gpios.join(', '):'';}
  // The scene area shows the 3D mechanism, the 3D wiring harness or the 2D wiring diagram; the demo state stays the same.
  var viewMode='mechanism',lastWiringStyle='wiring3d',wiringFrame=document.getElementById('wiringFrame'),wiringHud=document.getElementById('wiringHud'),wiringModelInst=null,lastWiringHud=0,lastWiringFeed=0,wiringSaved=null,hudRows={};
  function wiringApi(){var look=window.DispenserReferenceLook;return look&&(viewMode==='wiringlayout'?look.wiringLayout:look.wiring)||null;}
  function wiringApis(){var look=window.DispenserReferenceLook;return look?[look.wiring,look.wiringLayout].filter(Boolean):[];}
  function buildWiringHud(){
    var W=window.DispenserWiringSpec,api=wiringApis()[0],list=document.getElementById('wiringHudRows');if(!W||!api||list.children.length)return;
    var colors={};api.colors().forEach(function(c){colors[c.id]=c.color;});
    W.signals.slice().sort(function(a,b){return a.gpio-b.gpio;}).forEach(function(s){
      var li=document.createElement('li'),sw=document.createElement('i'),g=document.createElement('b'),n=document.createElement('span'),v=document.createElement('em');
      sw.style.background=colors[s.id]||'#cbd7e6';g.textContent='GPIO'+s.gpio;n.textContent=s.id;li.title=s.role;v.textContent='';
      li.appendChild(sw);li.appendChild(g);li.appendChild(n);li.appendChild(v);list.appendChild(li);hudRows[s.id]={li:li,v:v,fn:s.fn,group:s.group};
    });
    [['wireSignal','signal'],['wireMotor','motor'],['wirePower','power']].forEach(function(p){document.getElementById(p[0]).addEventListener('change',function(e){wiringApis().forEach(function(a){a.setClass(p[1],e.target.checked);});});});
    ['pointerdown','pointerup','pointermove','touchstart','wheel'].forEach(function(name){wiringHud.addEventListener(name,function(event){event.stopPropagation();});});
    var hudToggle=document.getElementById('wiringHudToggle');
    function collapseHud(on){wiringHud.classList.toggle('collapsed',on);hudToggle.setAttribute('aria-expanded',on?'false':'true');hudToggle.innerHTML=on?'&#9656;':'&#9662;';hudToggle.title=on?'Expand':'Collapse';hudToggle.setAttribute('aria-label',on?'Expand wiring panel':'Collapse wiring panel');}
    hudToggle.addEventListener('click',function(){collapseHud(!wiringHud.classList.contains('collapsed'));});
    collapseHud(host.clientWidth<640);
    if(pinTableBuilt)applyWiringGroups();
  }
  // Side panel: subsystem filter and a pin table of every part in the wiring.
  var wiringGroups=null,wiringHide=false,pinTableBuilt=false,pinRows=[],sysDots={};
  function wiringGroupOn(g){return g==='core'||!wiringGroups||wiringGroups.indexOf(g)>=0;}
  function applyWiringGroups(){
    var checked=Array.prototype.map.call(document.querySelectorAll('#wiringSystems input:checked'),function(c){return c.value;}),shown=0;
    wiringGroups=checked; // an unticked system loses its wires; its parts stay, hazed
    wiringHide=document.getElementById('wiringHide').checked;
    wiringApis().forEach(function(a){a.setGroups(wiringGroups,wiringHide);});
    // the pin table lists only the ticked systems; a part's header row stays only while one of its pin rows does
    var head=null,headRows=0;
    function closeHead(){if(head)head.tr.hidden=!headRows;}
    pinRows.forEach(function(r){
      if(r.header){closeHead();head=r;headRows=0;return;}
      var on=!wiringGroups||wiringGroups.indexOf(r.group)>=0;r.tr.hidden=!on;r.tr.classList.remove('faded');if(on){shown+=1;headRows+=1;}
    });
    closeHead();
    Object.keys(hudRows).forEach(function(id){var on=wiringGroupOn(hudRows[id].group);hudRows[id].li.hidden=!on&&wiringHide;hudRows[id].li.classList.toggle('faded',!on&&!wiringHide);});
    document.getElementById('wiringTableCount').textContent=shown+' of '+pinRows.filter(function(r){return !r.header;}).length+' pins';
    if(wiringFrame.contentWindow)wiringFrame.contentWindow.postMessage({source:'dispenser-viewer-filter',groups:wiringGroups||[],hide:wiringHide&&Boolean(wiringGroups)},'*');
  }
  function buildWiringPanel(){
    var W=window.DispenserWiringSpec;if(pinTableBuilt||!W)return;pinTableBuilt=true;
    var chips=document.getElementById('wiringSystems'),body=document.getElementById('pinTableRows'),NET={'5V':'+5 V','3V3':'3V3','GND':'GND'},pinOf={},ends={};
    function span(list){list=list.slice().sort(function(a,b){return a-b;});var out=[],i=0;while(i<list.length){var j=i;while(j+1<list.length&&list[j+1]===list[j]+1)j++;out.push(j>i?list[i]+'–'+list[j]:String(list[i]));i=j+1;}return out.join(', ');}
    W.group_parents.forEach(function(par){
      var members=W.groups.filter(function(g){return g.parent===par.id;});if(!members.length)return;
      var title=document.createElement('div');title.className='sys-group-title';title.textContent=par.label;chips.appendChild(title);
      members.forEach(function(g){
        var sigs=W.signals.filter(function(s){return s.group===g.id;}),links=W.links.filter(function(l){return l.group===g.id;}),gpios=sigs.map(function(s){return s.gpio;});
        var row=document.createElement('label'),box=document.createElement('input'),main=document.createElement('span'),name=document.createElement('strong'),note=document.createElement('small'),meta=document.createElement('span'),dot=document.createElement('i');
        row.className='sys-row';box.type='checkbox';box.checked=true;box.value=g.id;box.autocomplete='off';
        main.className='sys-main';name.textContent=g.label;note.textContent=g.note;main.appendChild(name);main.appendChild(note);
        meta.className='sys-meta';meta.textContent=gpios.length?'GPIO '+span(gpios):'+5 V · GND';row.title=sigs.length+' signal'+(sigs.length===1?'':'s')+(links.length?' and a '+links.length+'-wire motor cable':'');
        dot.className='sys-dot';dot.title='lights up while the system is active';
        row.appendChild(box);row.appendChild(main);row.appendChild(meta);row.appendChild(dot);chips.appendChild(row);
        box.addEventListener('change',applyWiringGroups);sysDots[g.id]=dot;
      });
    });
    document.getElementById('wiringHide').addEventListener('change',applyWiringGroups);
    document.getElementById('wiringAll').addEventListener('click',function(){chips.querySelectorAll('input').forEach(function(b){b.checked=true;});applyWiringGroups();});
    document.getElementById('wiringNone').addEventListener('click',function(){chips.querySelectorAll('input').forEach(function(b){b.checked=false;});applyWiringGroups();});
    W.components.forEach(function(c){c.pins.forEach(function(p){pinOf[c.id+'.'+p.id]={c:c,p:p};});});
    W.signals.concat(W.links).forEach(function(s){(ends[s.from]=ends[s.from]||[]).push({o:s.to,fn:s.fn,id:s.id});(ends[s.to]=ends[s.to]||[]).push({o:s.from,fn:s.fn,id:s.id});});
    function cell(tr,cls,text){var td=document.createElement('td');if(cls)td.className=cls;td.textContent=text;tr.appendChild(td);return td;}
    var sigGroup={};W.signals.concat(W.links).forEach(function(s){sigGroup[s.id]=s.group;});
    var order=W.components.filter(function(c){return c.id==='esp32';}).concat(W.components.filter(function(c){return c.id!=='esp32';}));
    order.forEach(function(c){
      var head=document.createElement('tr'),hd=document.createElement('td');head.className='grp';hd.colSpan=4;hd.textContent=c.label+(c.external?' (external)':'');head.appendChild(hd);body.appendChild(head);pinRows.push({tr:head,group:c.group,header:true});
      c.pins.forEach(function(p){
      var pid=c.id+'.'+p.id,e=ends[pid]&&ends[pid][0],tr=document.createElement('tr'),sigCls='sig',sig,conn;
      if(p.gpio!==undefined){sig='GPIO'+p.gpio;sigCls+=' gpio';}
      else if(p.net){sig=NET[p.net]||p.net;sigCls+=p.net==='5V'?' v5':p.net==='GND'?' gnd':'';}
      else sig=e?e.id:'—';
      if(e){var o=pinOf[e.o];conn=o.c.viewer_label+' · '+o.p.id;}
      else if(p.net)conn=(NET[p.net]||p.net)+' rail';
      else conn=p.note||'not connected';
      cell(tr,'',p.id);cell(tr,sigCls,sig);cell(tr,'',conn);var live=cell(tr,'live','');
      body.appendChild(tr);pinRows.push({tr:tr,live:live,group:c.id==='esp32'?((e&&sigGroup[e.id])||'power'):c.group,fn:e?e.fn:null,net:p.net||null}); // an ESP32 pin follows the system it feeds
    });});
    applyWiringGroups();
  }
  function updatePinTable(m,WM){
    var activeBy={};
    pinRows.forEach(function(r){
      if(r.header)return;
      if(r.fn&&r.fn!=='common'&&WM.isActive(r.fn,m))activeBy[r.group]=true;
      if(r.tr.hidden)return;
      var text,on=false;
      if(r.fn&&r.fn!=='common'){text=WM.liveText(r.fn,m);on=WM.isActive(r.fn,m);}
      else if(r.net)text={'5V':'5 V','3V3':'3.3 V','GND':'0 V'}[r.net];
      else text='—';
      if(r.live.textContent!==text)r.live.textContent=text;
      r.tr.classList.toggle('on',on);
    });
    Object.keys(sysDots).forEach(function(g){sysDots[g].classList.toggle('on',Boolean(activeBy[g]));});
  }
  // The wiring view keeps its own settings: Mechanism filters are saved, replaced by a clean baseline, and put back on leaving.
  function setBox(box,on){if(box.checked===on)return;box.checked=on;box.dispatchEvent(new Event('change',{bubbles:true}));}
  function captureMech(){
    var look=window.DispenserReferenceLook,host=window.DispenserStepHost,part=function(v){return document.querySelector('input[name="partType"][value="'+v+'"]').checked;},view=host?host.view():'main';
    if(view!=='main')host.setView('main'); // leaving a subsystem view first puts the real toggle values back
    return {view:view,housing:document.getElementById('housingVisible').checked,mode:look&&look.housingMode?look.housingMode():'assembled',electronic:part('electronic'),printed:part('printed'),
      scanner:scannerToggle.checked,mechanism:mechanismToggle.checked,labels:labelToggle.checked,dims:dimensionsToggle.checked,job:look&&look.selectedPrintJob?look.selectedPrintJob():null,plates:Boolean(look&&look.printLayoutOn&&look.printLayoutOn())};
  }
  function wiringBaseline(){
    var look=window.DispenserReferenceLook,host=window.DispenserStepHost;
    if(host&&host.view()!=='main')host.setView('main');
    closePrintPlates();if(look&&look.selectPrintJob)look.selectPrintJob(null);
    if(look&&look.setHousingMode)look.setHousingMode('assembled');
    if(look&&look.setRemovalState)look.setRemovalState({flex:false,lift:false,blade:0});
    setBox(document.getElementById('housingVisible'),false);
    setBox(mechanismToggle,true);setBox(scannerToggle,true);setBox(dimensionsToggle,false);setBox(labelToggle,false);
    setBox(document.querySelector('input[name="partType"][value="printed"]'),false);setBox(document.querySelector('input[name="partType"][value="electronic"]'),true);
  }
  function restoreMech(s){
    var look=window.DispenserReferenceLook,host=window.DispenserStepHost;
    setBox(document.getElementById('housingVisible'),s.housing);
    if(look&&look.setHousingMode)look.setHousingMode(s.mode);
    setBox(document.querySelector('input[name="partType"][value="printed"]'),s.printed);setBox(document.querySelector('input[name="partType"][value="electronic"]'),s.electronic);
    setBox(mechanismToggle,s.mechanism);setBox(scannerToggle,s.scanner);setBox(dimensionsToggle,s.dims);setBox(labelToggle,s.labels);
    if(host&&s.view!=='main')host.setView(s.view);
    if(look&&look.selectPrintJob&&s.job)look.selectPrintJob(s.job);
    if(s.plates&&look&&look.setPrintLayout){look.setPrintLayout(true);var btn=document.getElementById('printPlatesBtn');btn.textContent='Hide print plates';btn.setAttribute('aria-pressed','true');}
  }
  function enterWiring3d(){
    var api=wiringApi();
    wiringSaved={mech:captureMech(),target:cameraTarget.clone(),orbit:{theta:orbit.theta,phi:orbit.phi,radius:orbit.radius}};
    wiringBaseline();
    var look3=window.DispenserReferenceLook;if(look3&&look3.setGhostOpacity)look3.setGhostOpacity(.03);
    api.setPartsLive(true);if(pinTableBuilt)applyWiringGroups();
    cameraTarget.set(-12,-14,-4);orbit.theta=.72;orbit.phi=.95;orbit.radius=235;updateCamera();setCamHome();
    wiringHud.hidden=false;document.getElementById('wiringHudNote').textContent='routing wires…';
    window.setTimeout(function(){
      if(viewMode!=='wiring3d')return;
      api.setVisible(true);buildWiringHud();var r=api.report();
      document.getElementById('wiringHudNote').textContent=r.failed.length?('not routed: '+r.failed.join(', ')):(r.wires.length+' wires routed');
    },40);
  }
  function leaveWiring3d(){
    var api=wiringApi(),s=wiringSaved,look3=window.DispenserReferenceLook;if(api){api.setVisible(false);api.setPartsLive(false);}if(look3&&look3.setGhostOpacity)look3.setGhostOpacity(.07);wiringHud.hidden=true;if(!s)return;wiringSaved=null;
    restoreMech(s.mech);setScannerSubsystemVisibility(scannerToggle.checked);
    cameraTarget.copy(s.target);orbit.theta=s.orbit.theta;orbit.phi=s.orbit.phi;orbit.radius=s.orbit.radius;updateCamera();camHome={x:-8,y:4,z:-12,theta:.72,phi:1.02,radius:330};
  }
  // Side panel: every section is a collapsible group under its own header.
  var panelEl=document.getElementById('controlPanel'),panelSections=Array.prototype.slice.call(panelEl.querySelectorAll('.control-section'));
  function setSectionOpen(sec,open){sec.classList.toggle('collapsed',!open);var head=sec.querySelector('.section-title');if(head)head.setAttribute('aria-expanded',open?'true':'false');}
  panelSections.forEach(function(sec){
    var head=sec.querySelector('.section-title');if(!head)return;
    var chev=document.createElement('i');chev.className='chev';chev.setAttribute('aria-hidden','true');head.appendChild(chev);
    head.classList.add('accordion-head');head.setAttribute('role','button');head.tabIndex=0;
    function toggle(){setSectionOpen(sec,sec.classList.contains('collapsed'));}
    head.addEventListener('click',function(e){if(e.target.closest('button,select,input,a'))return;toggle();});
    head.addEventListener('keydown',function(e){if(e.target===head&&(e.key==='Enter'||e.key===' ')){e.preventDefault();toggle();}});
    setSectionOpen(sec,sec.classList.contains('housing-section')||(!sec.id&&sec.querySelector('#stepAnim')!==null));
  });
  document.getElementById('panelExpand').addEventListener('click',function(){panelSections.forEach(function(s){setSectionOpen(s,true);});});
  document.getElementById('panelCollapse').addEventListener('click',function(){panelSections.forEach(function(s){setSectionOpen(s,false);});});
  function showWiringSection(on,wasOn){
    if(on&&!wasOn){setSectionOpen(document.getElementById('wiringPanel'),true);setSectionOpen(document.getElementById('wiringPins'),true);panelEl.scrollTop=0;}
  }
  var layoutHidden=[];
  function enterWiringLayout(){
    var api=wiringApi();
    wiringSaved={mech:captureMech(),target:cameraTarget.clone(),orbit:{theta:orbit.theta,phi:orbit.phi,radius:orbit.radius}};
    wiringBaseline();
    layoutHidden=[];root3d.children.forEach(function(ch){if(ch!==api.group&&ch.visible){layoutHidden.push(ch);ch.visible=false;}});
    api.setVisible(true);buildWiringHud();
    cameraTarget.set(55,14,0);orbit.theta=.28;orbit.phi=.78;orbit.radius=Math.max(330,Math.min(640,440/(Math.tan(camera.fov*Math.PI/360)*Math.min(camera.aspect,1.7))));updateCamera();setCamHome();
    wiringHud.hidden=false;document.getElementById('wiringHudNote').textContent='organised layout, not to scale';
  }
  function leaveWiringLayout(){
    var look=window.DispenserReferenceLook,s=wiringSaved;if(look&&look.wiringLayout)look.wiringLayout.setVisible(false);
    layoutHidden.forEach(function(ch){ch.visible=true;});layoutHidden=[];wiringHud.hidden=true;
    if(s){wiringSaved=null;restoreMech(s.mech);cameraTarget.copy(s.target);orbit.theta=s.orbit.theta;orbit.phi=s.orbit.phi;orbit.radius=s.orbit.radius;updateCamera();camHome={x:-8,y:4,z:-12,theta:.72,phi:1.02,radius:330};}
  }
  function setViewMode(mode){
    if(mode===viewMode)return;
    var wasWiring=viewMode!=='mechanism';
    if((mode==='wiring3d'&&!(window.DispenserReferenceLook&&window.DispenserReferenceLook.wiring))||(mode==='wiringlayout'&&!(window.DispenserReferenceLook&&window.DispenserReferenceLook.wiringLayout))){mode='mechanism';}
    if(viewMode==='wiring3d')leaveWiring3d();
    if(viewMode==='wiringlayout')leaveWiringLayout();
    if(viewMode==='wiring2d')wiringFrame.hidden=true;
    viewMode=mode;
    if(mode==='wiring3d')enterWiring3d();
    if(mode==='wiringlayout')enterWiringLayout();
    if(mode==='wiring2d'){if(!wiringFrame.getAttribute('src'))wiringFrame.src='wiring.html?embed=1';wiringFrame.hidden=false;}
    if(mode!=='mechanism')lastWiringStyle=mode;
    document.querySelectorAll('input[name="viewMode"]').forEach(function(r){r.checked=r.value===(mode==='mechanism'?'mechanism':'wiring');});
    document.querySelectorAll('input[name="wiringStyle"]').forEach(function(r){r.checked=r.value===lastWiringStyle;});
    document.body.classList.toggle('wiring-view',mode!=='mechanism');
    document.getElementById('wiringPanel').hidden=mode==='mechanism';document.getElementById('wiringPins').hidden=mode==='mechanism';if(mode!=='mechanism')buildWiringPanel();
    showWiringSection(mode!=='mechanism',wasWiring);
    if(mode!=='wiring2d')resize();
  }
  document.querySelectorAll('input[name="viewMode"]').forEach(function(r){r.addEventListener('change',function(){if(r.checked)setViewMode(r.value==='wiring'?lastWiringStyle:'mechanism');});});
  document.querySelectorAll('input[name="wiringStyle"]').forEach(function(r){r.addEventListener('change',function(){if(r.checked)setViewMode(r.value);});});
  document.querySelectorAll('input[name="subsystemView"]').forEach(function(r){r.addEventListener('click',function(){if(viewMode!=='mechanism')setViewMode('mechanism');},true);});
  function sendWiringFeed(now,state){var target=viewMode==='wiring2d'&&wiringFrame.contentWindow;if(!target||now-lastWiringFeed<33)return;lastWiringFeed=now;target.postMessage({source:'dispenser-viewer',state:state,drumAngle:state.drumAngle+rotationPreview.angle,groups:wiringGroups,hide:wiringHide},'*');}
  function updateWiring3d(now,state){
    if(viewMode==='mechanism')return;
    var WM=window.DispenserWiringModel;if(!wiringModelInst)wiringModelInst=WM.create();
    var m=wiringModelInst.derive(state,state.drumAngle+rotationPreview.angle,now),api=viewMode==='wiring2d'?null:wiringApi();
    if(api)api.update(m,now/1000);
    if(now-lastWiringHud>=100){lastWiringHud=now;updatePinTable(m,WM);Object.keys(hudRows).forEach(function(id){var r=hudRows[id],hi=WM.isHigh(r.fn,m);r.v.textContent=WM.liveText(r.fn,m);r.li.classList.toggle('hi',hi);r.li.classList.toggle('on',WM.isActive(r.fn,m));});}
  }
  // Camera aids: viewpoint presets, zoom and reset buttons, right-drag / Shift-drag pan, double-click reset and the keyboard.
  var camHome={x:-8,y:4,z:-12,theta:.72,phi:1.02,radius:330},camTween=null,panning=null;
  function setCamHome(){camHome={x:cameraTarget.x,y:cameraTarget.y,z:cameraTarget.z,theta:orbit.theta,phi:orbit.phi,radius:orbit.radius};}
  function flyTo(g){
    var from={x:cameraTarget.x,y:cameraTarget.y,z:cameraTarget.z,theta:orbit.theta,phi:orbit.phi,radius:orbit.radius},to={x:g.x===undefined?from.x:g.x,y:g.y===undefined?from.y:g.y,z:g.z===undefined?from.z:g.z,theta:g.theta===undefined?from.theta:g.theta,phi:g.phi===undefined?from.phi:g.phi,radius:g.radius===undefined?from.radius:g.radius};
    var turn=to.theta-from.theta;turn=Math.atan2(Math.sin(turn),Math.cos(turn));to.theta=from.theta+turn;
    var start=performance.now(),id=camTween={};
    (function step(now){
      if(camTween!==id)return;var k=Math.min(1,(now-start)/380),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      cameraTarget.set(from.x+(to.x-from.x)*e,from.y+(to.y-from.y)*e,from.z+(to.z-from.z)*e);
      orbit.theta=from.theta+(to.theta-from.theta)*e;orbit.phi=from.phi+(to.phi-from.phi)*e;orbit.radius=from.radius+(to.radius-from.radius)*e;updateCamera();
      if(k<1)requestAnimationFrame(step);
    }(start));
  }
  var CAM_VIEWS={iso:{theta:.72,phi:1.02},front:{theta:0,phi:1.5},side:{theta:Math.PI/2,phi:1.5},back:{theta:Math.PI,phi:1.5},top:{theta:0,phi:.24}};
  function camAction(name){
    if(CAM_VIEWS[name])flyTo(CAM_VIEWS[name]);
    else if(name==='in')flyTo({radius:Math.max(56,orbit.radius*.78)});
    else if(name==='out')flyTo({radius:Math.min(640,orbit.radius*1.28)});
    else if(name==='reset')flyTo(camHome);
  }
  (function(){
    var tools=document.getElementById('camTools');if(!tools)return;
    ['pointerdown','pointerup','pointermove','touchstart','wheel','dblclick'].forEach(function(n){tools.addEventListener(n,function(e){e.stopPropagation();});});
    tools.addEventListener('click',function(e){var b=e.target.closest('button[data-cam]');if(b)camAction(b.dataset.cam);});
    host.tabIndex=0;host.setAttribute('aria-keyshortcuts','ArrowKeys + - 0 1 2 3 4 5');
    host.addEventListener('dblclick',function(e){if(e.target.closest('button'))return;camAction('reset');});
    host.addEventListener('contextmenu',function(e){e.preventDefault();});
    host.addEventListener('keydown',function(e){
      if(e.target!==host||e.ctrlKey||e.metaKey||e.altKey)return;var used=true;camTween=null;
      if(e.key==='ArrowLeft')orbit.theta+=.15;else if(e.key==='ArrowRight')orbit.theta-=.15;
      else if(e.key==='ArrowUp')orbit.phi=Math.max(.22,orbit.phi-.12);else if(e.key==='ArrowDown')orbit.phi=Math.min(2.75,orbit.phi+.12);
      else if(e.key==='+'||e.key==='=')orbit.radius=Math.max(56,orbit.radius*.9);else if(e.key==='-'||e.key==='_')orbit.radius=Math.min(640,orbit.radius*1.1);
      else if(e.key==='0')camAction('reset');else if(e.key>='1'&&e.key<='5')camAction(['iso','front','side','top','back'][Number(e.key)-1]);
      else used=false;
      if(used){e.preventDefault();updateCamera();}
    });
    // pan: capture-phase handlers claim right-drag and Shift-drag before the orbit handlers see them
    host.addEventListener('pointerdown',function(e){
      if(e.button!==2&&!(e.button===0&&e.shiftKey))return;
      panning={id:e.pointerId,x:e.clientX,y:e.clientY};camTween=null;host.setPointerCapture(e.pointerId);e.stopImmediatePropagation();e.preventDefault();
    },true);
    host.addEventListener('pointermove',function(e){
      if(!panning||panning.id!==e.pointerId)return;
      var dx=e.clientX-panning.x,dy=e.clientY-panning.y,k=2*orbit.radius*Math.tan(camera.fov*Math.PI/360)/Math.max(1,host.clientHeight),m=camera.matrixWorld.elements;
      panning.x=e.clientX;panning.y=e.clientY;
      cameraTarget.x=Math.max(-300,Math.min(300,cameraTarget.x-m[0]*dx*k+m[4]*dy*k));cameraTarget.y=Math.max(-300,Math.min(300,cameraTarget.y-m[1]*dx*k+m[5]*dy*k));cameraTarget.z=Math.max(-300,Math.min(300,cameraTarget.z-m[2]*dx*k+m[6]*dy*k));
      updateCamera();e.stopImmediatePropagation();
    },true);
    function endPan(e){if(panning&&panning.id===e.pointerId){panning=null;e.stopImmediatePropagation();}}
    host.addEventListener('pointerup',endPan,true);host.addEventListener('pointercancel',endPan,true);
  }());
  function frame(now){requestAnimationFrame(frame);var dt=Math.min(.25,Math.max(0,(now-last)/1000));last=now;var steps=window.DispenserStepAnimations,state=window.dispenserSceneQA&&window.dispenserSceneQA.paused?controller.snapshot():(steps?steps.tick(dt,now):controller.tick(dt,now));if(now-lastStatus>=100){renderStatus(state);lastStatus=now;}advanceRotationPreview(dt,state);sendWiringFeed(now,state);updateWiring3d(now,state);animateActors(state);if(window.DispenserReferenceLook&&window.DispenserReferenceLook.declutterLabels&&camera)window.DispenserReferenceLook.declutterLabels(camera,host.clientWidth,host.clientHeight);if(renderer&&scene&&camera&&viewMode!=='wiring2d')renderer.render(scene,camera);}
  buildControls();initRenderer();
  if(window.dispenserSceneQA){
    window.dispenserSceneQA.containerCapBounds=function(color){var cap=componentMap[color+'-cap'],container=placedContainers[color];if(!cap||!container)throw new Error('Unknown compartment '+color);root3d.updateMatrixWorld(true);var capBounds=new THREE.Box3().setFromObject(cap),containerBounds=new THREE.Box3().setFromObject(container),cartridge=componentMap[color+'-cartridge'];return {attached:cap.parent===capPivots[color]&&capPivots[color].parent===cartridgeLiftGroups[color],attachedTo:cap.parent&&cap.parent.name,cartridgeParent:cartridge.parent&&cartridge.parent.name,overlap:capBounds.intersectsBox(containerBounds),cap:{min:capBounds.min.toArray(),max:capBounds.max.toArray()}};};
    window.dispenserSceneQA.packageColor=function(){return targets.package.userData.displayColor;};
    window.dispenserSceneQA.componentScreen=function(id){root3d.updateMatrixWorld(true);var node=componentMap[id];if(!node)return null;var q=node.getWorldPosition(new THREE.Vector3()).project(camera),r=host.getBoundingClientRect();return {x:r.left+(q.x+1)/2*r.width,y:r.top+(1-q.y)/2*r.height};};
    window.dispenserSceneQA.componentLabelScreen=function(id){root3d.updateMatrixWorld(true);var label=labels.filter(function(l){var o=l.parent&&l.parent.userData&&l.parent.userData.component;return o&&o.component_id===id;})[0];if(!label)return null;var q=label.getWorldPosition(new THREE.Vector3()).project(camera),r=host.getBoundingClientRect();return {x:r.left+(q.x+1)/2*r.width,y:r.top+(1-q.y)/2*r.height,visible:label.visible};};
    window.dispenserSceneQA.cameraPose=function(){return camera.position.toArray().concat(cameraTarget.toArray()).map(function(v){return Math.round(v*1000)/1000;});};
    window.dispenserSceneQA.dimensionLineScreen=function(id){var found=null;root3d.updateMatrixWorld(true);root3d.traverse(function(o){if(o.isLine&&o.userData.dimensionId===id)found=o;});if(!found)return null;var pos=found.geometry.attributes.position,m=new THREE.Vector3((pos.getX(4)+pos.getX(5))/2,(pos.getY(4)+pos.getY(5))/2,(pos.getZ(4)+pos.getZ(5))/2);found.localToWorld(m);m.project(camera);var r=host.getBoundingClientRect();return {x:r.left+(m.x+1)/2*r.width,y:r.top+(1-m.y)/2*r.height,visible:found.visible};};
    window.dispenserSceneQA.labelHitAt=function(x,y){return labelHitAt(x,y);};
    window.dispenserSceneQA.componentSelection=function(){var visibleLabels=labels.filter(function(l){return l.visible;}).length;return {selected:selectedComponentId,hover:componentHoverId,visibleLabels:visibleLabels};};
    window.dispenserSceneQA.rotationView={set:setRotationOnly,select:selectRotationPart,dimensionLabelScreen:function(id){var found=null;root3d.updateMatrixWorld(true);root3d.traverse(function(o){if(o.isSprite&&(o.userData.dimensionId===id||o.userData.partLabel===id))found=o;});if(!found)return null;var p=found.getWorldPosition(new THREE.Vector3()).project(camera),r=host.getBoundingClientRect();return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height,hot:found.material.map===found.userData.texHot,visible:found.visible};},spin:spinPreview,home:homePreview,preview:function(){return {angle:rotationPreview.angle,target:rotationPreview.target,only:rotationPreview.only};},step:function(dt){var s=controller.snapshot();advanceRotationPreview(dt,s);animateActors(s);return rotationPreview.angle;},parts:function(){return window.DispenserReferenceLook.rotationParts();}};
    window.dispenserSceneQA.capHingeState=function(color){root3d.updateMatrixWorld(true);var pivot=capPivots[color],cap=componentMap[color+'-cap'];if(!pivot||!cap)throw new Error('Unknown compartment '+color);var axis=new THREE.Vector3(1,0,0).applyQuaternion(pivot.getWorldQuaternion(new THREE.Quaternion()));return {pivotCanonicalMm:canonicalWorldPosition(pivot),axisCanonical:[axis.x,-axis.z,axis.y],capCanonicalMm:canonicalWorldPosition(cap),capLocalMm:[cap.position.x,-cap.position.z,cap.position.y]};};
    window.dispenserSceneQA.tongueSpringState=function(){return tongueSpringState(controller.snapshot(),false);};
    window.dispenserSceneQA.dimensionOverlayStatus=function(){var enabled=Boolean(dimensionGroups.fixed.visible&&dimensionGroups.rotating.visible),visibleAnnotations=0,visibleValueLabels=0,visibleDimensionSegments=0,visibleGuideSegments=0,minCalloutHeight=Infinity;root3d.updateMatrixWorld(true);Object.keys(dimensionCategoryGroups).forEach(function(key){var categoryGroup=dimensionCategoryGroups[key];if(enabled&&categoryGroup.visible){visibleAnnotations+=categoryGroup.children.length;categoryGroup.traverse(function(object){if(object.isSprite&&object.name.indexOf('dimension value label')===0){visibleValueLabels+=1;minCalloutHeight=Math.min(minCalloutHeight,object.getWorldPosition(new THREE.Vector3()).y);}if(object.isLineSegments&&object.name.indexOf('dimension segment')===0){visibleDimensionSegments+=1;if(object.name.indexOf('guide line')!==-1)visibleGuideSegments+=1;}});}});return {enabled:enabled,selectedCategory:dimensionCategory.value,visibleAnnotations:visibleAnnotations,visibleValueLabels:visibleValueLabels,visibleDimensionSegments:visibleDimensionSegments,visibleGuideSegments:visibleGuideSegments,minCalloutHeight:Number.isFinite(minCalloutHeight)?minCalloutHeight:null,calloutRailHeight:62,categories:Object.keys(dimensionCategoryGroups),defaultOff:!dimensionGroups.fixed.visible&&!dimensionGroups.rotating.visible};};
    window.dispenserSceneQA.dimensionIsolationSnapshot=function(){root3d.updateMatrixWorld(true);return {state:JSON.stringify(controller.snapshot()),camera:camera.position.toArray(),mechanismVisible:mechanismGroup.visible,scannerVisible:scannerVisible,physical:DATA.components.filter(function(item){return item.category!=='scanner';}).map(function(item){var mesh=componentMap[item.component_id];return [item.component_id,mesh.visible,mesh.position.toArray(),mesh.rotation.toArray()];}),labels:labels.map(function(label){return [label.name,label.visible];}),scanner:scannerVisualObjects.map(function(object){return [object.name||'scanner visual group',object.visible];}),caps:COLORS.map(function(color){return [color,componentMap[color+'-cap'].visible];})};};
    window.dispenserSceneQA.containerVisible=function(color){return Boolean(placedContainers[color]&&placedContainers[color].visible);};
    window.dispenserSceneQA.scannerSubsystem=function(visible){if(typeof visible==='boolean'){scannerToggle.checked=visible;setScannerSubsystemVisibility(visible);}root3d.updateMatrixWorld(true);var beamPositions=targets.beam.geometry.attributes.position;return {enabled:scannerVisible,housing:componentMap['barcode-scanner-housing'].visible,package:targets.package.visible,packagePosition:targets.package.position.toArray(),beam:targets.beam.visible,beamStart:new THREE.Vector3().fromBufferAttribute(beamPositions,0).toArray(),beamEnd:new THREE.Vector3().fromBufferAttribute(beamPositions,1).toArray(),visualParts:scannerVisualObjects.map(function(object){return {name:object.name||'scanner visual group',visible:object.visible};})};};
    window.dispenserSceneQA.inventoryActors=function(){var actors=[];COLORS.forEach(function(color){pills[color].forEach(function(actor,index){actors.push({color:color,index:index,visible:actor.visible,identity:actor.userData.identity});});});return actors;};
    window.dispenserSceneQA.tonguePosition=function(){root3d.updateMatrixWorld(true);return componentMap['shared-lower-tongue'].getWorldPosition(new THREE.Vector3()).toArray();};
    window.dispenserSceneQA.pinBounds=function(){root3d.updateMatrixWorld(true);var b=new THREE.Box3().setFromObject(componentMap['engagement-pin']);return {min:b.min.toArray(),max:b.max.toArray()};};
    window.dispenserSceneQA.pillPosition=function(color,index){root3d.updateMatrixWorld(true);return pills[color][index].getWorldPosition(new THREE.Vector3()).toArray();};
    window.dispenserSceneQA.gateTravel=function(color){var id=color+'-upper-blade-tab',base=componentBases[id],mesh=componentMap[id];if(!base||!mesh)throw new Error('Unknown station '+color);root3d.updateMatrixWorld(true);var direction=bladeTravelDirection(base.rotation),start=base.position.clone(),current=mesh.position.clone(),delta=current.clone().sub(start),worldStart=mesh.parent.localToWorld(start.clone()),worldCurrent=mesh.getWorldPosition(new THREE.Vector3()),worldDelta=worldCurrent.clone().sub(worldStart);return {start:start.toArray(),current:current.toArray(),direction:direction.toArray(),expectedDistance:controller.snapshot().cartridges[color].blade*DATA.station.blade.stroke_mm,localDistance:delta.length(),localAxisError:delta.clone().addScaledVector(direction,-delta.dot(direction)).length(),worldDelta:worldDelta.toArray(),worldDistance:worldDelta.length(),carriageStroke:controller.snapshot().carriage};};
    window.dispenserSceneQA.gateAndPillBounds=function(color){root3d.updateMatrixWorld(true);var gate=componentMap[color+'-upper-blade-tab'],gateBounds=new THREE.Box3().setFromObject(gate),stack=pills[color].map(function(pill,index){var box=new THREE.Box3().setFromObject(pill);return {index:index,visible:pill.visible,min:box.min.toArray(),max:box.max.toArray()};});return {gate:{min:gateBounds.min.toArray(),max:gateBounds.max.toArray()},stack:stack};};
    window.dispenserSceneQA.pathProbe=function(color,index,progress){var start=pills[color][index].userData.transferStart||pills[color][index].getWorldPosition(new THREE.Vector3());return transferPillPosition(start,tongueLandingPosition(),progress).toArray();};
    window.dispenserSceneQA.fallProbe=function(color,index,progress){var pill=pills[color][index];if(!pill)throw new Error('Unknown pill actor '+color+':'+index);root3d.updateMatrixWorld(true);return fallPillPosition(tongueLandingPosition(color,index),traySlotPosition(color,index),progress).toArray();};
  }
  renderStatus(controller.snapshot());requestAnimationFrame(frame);
}());
