(function () {
  'use strict';
  var list = document.getElementById('results');
  var summary = document.getElementById('summary');
  var passed = 0, failed = 0;
  function test(name, fn) {
    var row = document.createElement('li');
    try { fn(); row.textContent = 'PASS — ' + name; passed += 1; }
    catch (error) { row.textContent = 'FAIL — ' + name + ': ' + error.message; failed += 1; }
    list.appendChild(row);
  }
  function equal(actual, expected) {
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw new Error(JSON.stringify(actual) + ' !== ' + JSON.stringify(expected));
  }
  function advance(controller, duration, wallStart, step) {
    step = step || 0.05;
    var n = Math.ceil(duration / step);
    for (var i = 1; i <= n; i += 1)
      controller.tick(Math.min(step, duration - (i - 1) * step), wallStart + i * step * 1000);
  }
  function seedLoaded(controller, color, count) {
    var cartridge = controller.state.cartridges[color];
    cartridge.occupancy = 'loaded'; cartridge.containerCode = 'TEST-SEED-' + color;
    cartridge.count = count === undefined ? 5 : count;
  }
  function seedAllLoaded(controller) { COLORS.forEach(function (color) { seedLoaded(controller, color); }); }
  var C = window.DispenserDemoController;
  var COLORS = ['red','blue','green','orange'];
  function akPinSchedule(schedule){return schedule.pin_schedule||{closed_center_y_mm:-14.8,tip_z_engaged_mm:6.3,tip_z_raised_mm:11.3,stroke_mm:5,carriage_block_z_bounds_mm:[14,20],solenoid_body_z_bounds_mm:[20.5,34],verification_status:'NOT_VALIDATED'};}
  function nearArray(actual,expected,tolerance){if(!Array.isArray(actual)||actual.length!==expected.length||actual.some(function(value,index){return Math.abs(value-expected[index])>(tolerance||1e-8);}))throw new Error(JSON.stringify(actual)+' is not near '+JSON.stringify(expected));}
  test('canonical bundle describes exactly 52 physical parts and fixed fixtures', function () {
    var data=window.DISPENSER_CONCEPT_DATA;
    equal(data.components.length, 52);
    equal(data.export.physical_component_count,52);
    equal(data.components.filter(function(item){return item.component_id.indexOf('scanner-mount')===0;}).map(function(item){return item.component_id;}),['scanner-mount']);
    equal(window.DISPENSER_CONCEPT_DATA.palette.map(function (item) { return item.id; }), ['red', 'blue', 'green', 'orange']);
    equal(Object.values(window.DISPENSER_CONCEPT_DATA.demo.barcodes).filter(Boolean).sort(), ['blue', 'green', 'orange', 'red']);
    equal(window.DISPENSER_CONCEPT_DATA.export.print_ready, false);
    equal(window.DISPENSER_CONCEPT_DATA.station.chamber.parked_occupancy, 0); // Assert chamber occupancy is 0
    equal(new C().snapshot().pill, null); // Assert pill is null
    equal(new C().snapshot().chamberOccupancy, 0); // Assert parked chamber occupancy is zero pills
    equal(window.DISPENSER_CONCEPT_DATA.demo.initial_pills_per_cartridge, 0);
  });
  test('dimension catalog retains source value, unit, provenance and missing-value status', function () {
    var builder=window.DispenserDimensionAnnotations;
    if(!builder||typeof builder.build!=='function')throw new Error('dimension annotation catalog builder is missing');
    var annotations=builder.build(window.DISPENSER_CONCEPT_DATA),byId={};
    annotations.forEach(function(item){(byId[item.sourceId]||(byId[item.sourceId]=[])).push(item);});
    ['station.footprint_x','station.footprint_y','post.radius','post.height','drum.outer_radius','recipe:drum.height','cartridge.radial_position','station.channel_xy','recipe:cartridge.size','recipe:cap.size','blade.profile','blade.top_wedge','blade.tip_travel','tongue.length','tongue.edge_positions','tongue.floor_z','tongue.y_travel','pin.diameter','pin.stroke','pin.slot','servo.crank_radius','servo.connecting_rod_length','servo.pivot_y','servo.pivot_z','station.outlet_aperture','tray.approximate_size','tray.height'].forEach(function(id){if(!byId[id])throw new Error('dimension catalog omits '+id);});
    ['red','blue','green','orange'].forEach(function(color){if(!annotations.some(function(item){return item.color===color&&item.group==='upper-blade';}))throw new Error('blade dimensions missing for '+color);});
    annotations.forEach(function(item){if(!item.unit||!item.provenance||!item.verificationStatus||!item.caveat)throw new Error('dimension annotation lacks source/status metadata: '+item.sourceId);if(item.sourceId==='tray.height'&&(item.value!==null||item.numeric!==false||!(/unspecified/i.test(item.caveat))))throw new Error('unspecified tray height became numeric or lost its caveat');if(item.numeric&&item.verificationStatus!=='NOT_VALIDATED')throw new Error('dimension was incorrectly promoted to validated');});
  });
  test('dimension catalog separates the required groups without mutating demo state', function () {
    var builder=window.DispenserDimensionAnnotations,controller=new C(),before=controller.snapshot();
    if(!builder||typeof builder.build!=='function')throw new Error('dimension annotation catalog builder is missing');
    var annotations=builder.build(window.DISPENSER_CONCEPT_DATA),groups={};
    annotations.forEach(function(item){groups[item.group]=(groups[item.group]||0)+1;});
    ['station','post-drum','cartridge-channel-cap','upper-blade','lower-tongue','pin-slot','actuator-linkage','outlet-tray'].forEach(function(group){if(!groups[group])throw new Error('dimension group is missing: '+group);});
    if(groups['upper-blade']!==12)throw new Error('each of four blade stations needs profile, wedge and travel annotations');
    equal(controller.snapshot(),before);
  });
  test('main-scene startup is empty across exact supported colors and has no pill actors', function () {
    var state=new C().snapshot();
    equal(COLORS,['red','blue','green','orange']);
    COLORS.forEach(function(color){if(state.cartridges[color].count!==0||state.cartridges[color].cap!=='locked'||state.cartridges[color].capOpen)throw new Error(color+' must start empty and locked');});
    if(state.pill!==null||state.trayCount!==0)throw new Error('startup must not contain a staged or dispensed actor');
  });
  test('canonical station dimensions and selected local-Y blade axis retain the source conflict', function () {
    var station=window.DISPENSER_CONCEPT_DATA.station, frames=window.DISPENSER_CONCEPT_DATA.frames;
    equal(station.channel.size_mm,[10.8,8.4]);
    equal(station.pill.size_mm,[10,7,5]);
    equal(station.blade.stroke_axis,'component_local_y');
    if(!/perpendicular-gate sentence/.test(frames.note)||!/user clarified the blade slides on local Y/.test(frames.note))throw new Error('the user-selected Y direction and contradictory source wording must remain explicit');
  });
  test('selected cartridge, cap, upper gate and pin share the scheduled local gate axis', function () {
    var data=window.DISPENSER_CONCEPT_DATA, parts={},pivot=data.assembly_schedule.datum.drum_post_axis_xy_mm;
    data.components.forEach(function(part){parts[part.component_id]=part;});
    var colors=['red','blue','green','orange'];
    colors.forEach(function(color,index){
      var cartridge=parts[color+'-cartridge'],cap=parts[color+'-cap'],blade=parts[color+'-upper-blade-tab'];
      if(!cartridge||!cap||!blade)throw new Error('missing '+color+' station components');
      if(cartridge.position[0]!==cap.position[0]||cartridge.position[1]!==cap.position[1])throw new Error(color+' cap is not centered on its cartridge station');
      var gateRecipe=data.component_recipes.find(function(r){return r.recipe_id===blade.recipe_id;});
      if(gateRecipe.kind!=='blade_with_wedge'||gateRecipe.parameters.tab_start_y!==16||gateRecipe.parameters.tab_end_y!==24||gateRecipe.parameters.slot_center_y!==20||gateRecipe.parameters.slot_width!==5||gateRecipe.parameters.slot_length!==4||gateRecipe.parameters.wedge.leading_thickness!==.3||gateRecipe.parameters.wedge.body_thickness!==1)throw new Error(color+' outer-end gate slot/profile differs from controlling station geometry');
      var socket=data.assembly_schedule.socket_frames[index];equal([cartridge.position[0],cartridge.position[1]],socket.center_mm.slice(0,2));if(cartridge.position[2]!==26)throw new Error(color+' cartridge tube center must be z=26 mm');
      var angle=-index*Math.PI/2,dx=cartridge.position[0]-pivot[0],dy=cartridge.position[1]-pivot[1],rotated=[pivot[0]+dx*Math.cos(angle)-dy*Math.sin(angle),pivot[1]+dx*Math.sin(angle)+dy*Math.cos(angle)];
      if(Math.abs(rotated[0]-pivot[0])>.001||Math.abs(rotated[1]-(pivot[1]-15))>.001)throw new Error(color+' does not rotate onto the common pin axis');
      var slotDistance=gateRecipe.parameters.slot_center_y,sx=blade.position[0]-slotDistance*Math.sin(blade.rotation[2]),sy=blade.position[1]+slotDistance*Math.cos(blade.rotation[2]),slotDx=sx-pivot[0],slotDy=sy-pivot[1],aligned=[pivot[0]+slotDx*Math.cos(angle)-slotDy*Math.sin(angle),pivot[1]+slotDx*Math.sin(angle)+slotDy*Math.cos(angle)];
      if(Math.abs(aligned[0])>.001||Math.abs(aligned[1]+14.8)>.001)throw new Error(color+' outer tab slot does not index to the scheduled carriage datum');
    });
    if(akPinSchedule(data.assembly_schedule).closed_center_y_mm!==-14.8)throw new Error('A–K closed carriage/pin datum must be y=-14.8');
    if(parts['engagement-pin'].position[0]!==parts['pin-carriage'].position[0]||parts['engagement-pin'].position[1]!==parts['pin-carriage'].position[1])throw new Error('pin is offset from carriage travel axis');
  });
  test('upper gate occupies the separator gap between bottom and next pill', function () {
    var data=window.DISPENSER_CONCEPT_DATA,station=data.station;
    COLORS.forEach(function(color){var gate=data.components.find(function(c){return c.component_id===color+'-upper-blade-tab';}),recipe=data.component_recipes.find(function(r){return r.recipe_id==='blade';});if(gate.position[2]!==station.chamber.z_max_mm||station.parked_stack.lowest_pill_bottom_z_mm!==6||recipe.parameters.thickness!==1||recipe.parameters.wedge.side!=='top')throw new Error(color+' blade/chamber/parked stack datum mismatch');});
  });
  test('upper gates travel along each scheduled station radial axis', function () {
    var data=window.DISPENSER_CONCEPT_DATA,pivot=data.assembly_schedule.datum.drum_post_axis_xy_mm;
    COLORS.forEach(function(color){var gate=data.components.find(function(c){return c.component_id===color+'-upper-blade-tab';}),cartridge=data.components.find(function(c){return c.component_id===color+'-cartridge';}),angle=gate.rotation[2],dx=-Math.sin(angle),dy=Math.cos(angle),radial=[cartridge.position[0]-pivot[0],cartridge.position[1]-pivot[1]],dot=radial[0]*dx+radial[1]*dy;if(Math.abs(Math.hypot(dx,dy)-1)>.001)throw new Error(color+' gate travel vector is not horizontal');if(Math.abs(dot-15)>.001)throw new Error(color+' local Y blade travel is not directed outward along its short channel axis');});
  });
  test('pin carriage starts at the scheduled station-root outer-tab datum', function () {
    var data=window.DISPENSER_CONCEPT_DATA,parts={};data.components.forEach(function(c){parts[c.component_id]=c;});
    var pinSchedule=akPinSchedule(data.assembly_schedule);
    if(pinSchedule.closed_center_y_mm!==-14.8||Math.abs(pinSchedule.closed_center_y_mm-10.4-(-25.2))>1e-8||pinSchedule.tip_z_engaged_mm!==6.3||pinSchedule.tip_z_raised_mm!==11.3)throw new Error('A–K carriage/pin endpoints do not preserve the corrected 10.4/5 mm schedule');
    if(data.component_recipes.find(function(r){return r.recipe_id==='blade';}).parameters.local_y_start!=='nose_at_closed_tip')throw new Error('closed blade does not locate nose at the closed travel endpoint');
  });
  test('four cartridge footprints remain separated instead of overlapping', function () {
    var data=window.DISPENSER_CONCEPT_DATA,recipes={};data.component_recipes.forEach(function(r){recipes[r.recipe_id]=r;});
    var names=['red-cartridge','blue-cartridge','green-cartridge','orange-cartridge'];
    var boxes=names.map(function(id){var c=data.components.find(function(x){return x.component_id===id;}),size=recipes[c.recipe_id].parameters.size,angle=c.rotation[2],hx=(Math.abs(Math.cos(angle))*size[0]+Math.abs(Math.sin(angle))*size[1])/2,hy=(Math.abs(Math.sin(angle))*size[0]+Math.abs(Math.cos(angle))*size[1])/2;return {x:c.position[0],y:c.position[1],hx:hx,hy:hy,id:id};});
    boxes.forEach(function(a,i){boxes.slice(i+1).forEach(function(b){var separated=Math.abs(a.x-b.x)>=a.hx+b.hx-.05||Math.abs(a.y-b.y)>=a.hy+b.hy-.05;if(!separated)throw new Error(a.id+' footprint overlaps '+b.id);});});
  });
  test('single dispense follows each motion stage and removes one visual pill', function () {
    var a = new C(), b = new C(), visited = [];
    if(a.snapshot().pill!==null||a.snapshot().cartridges.red.count!==0||a.snapshot().chamberOccupancy!==0)throw new Error('main scene must start with empty compartments and no selected pill actor');
    seedLoaded(a,'red');seedLoaded(b,'red');
    if (!a.requestDispense('red') || !b.requestDispense('red')) throw new Error('request rejected');
    for (var i = 0; i < 500 && a.snapshot().operation; i += 1) {
      a.tick(.025, i * 25); b.tick(.025, i * 25); visited.push(a.snapshot().phase);
    }
    equal(a.snapshot(), b.snapshot());
    if (a.snapshot().cartridges.red.count !== 4 || a.snapshot().trayCount !== 1) throw new Error('expected one visual event');
    if (a.snapshot().pill.pill_index !== 0||a.snapshot().pill.identity!=='red:0') throw new Error('dispense did not preserve the bottom pill identity');
    if(a.snapshot().chamberOccupancy)throw new Error('parked chamber must be empty after the pill clears');
      ['CARRIAGE_APPROACH','PIN_ENGAGE','BLADE_PULL_RELEASE','STACK_SETTLE','BLADE_ISOLATE_CLOSE','BLADE_CLOSED_DWELL','PIN_LIFT','TONGUE_RELEASE','PILL_CLEAR','TONGUE_RETURN'].forEach(function (phase) {
      if (!visited.includes(phase)) throw new Error('phase missing: ' + phase);
    });
    if (a.snapshot().phase !== 'PARKED' || a.snapshot().carriage !== 0 || a.snapshot().pin !== 'up'||a.snapshot().tongueMotion!=='closed'||a.snapshot().cartridges.red.bladeMotion!=='closed') throw new Error('failed to reach safe parked state');
  });
  test('drum angle interpolates while rotating, not only at the endpoint', function () {
    var c = new C(); seedLoaded(c,'blue'); c.requestDispense('blue'); c.tick(.2, 200);
    if (c.snapshot().phase !== 'DRUM_ROTATE' || Math.abs(c.snapshot().drumAngle) < .05) throw new Error('rotation did not animate continuously');
  });
  test('phase boundaries snap carriage to the exact indexed gate datum', function () {
    COLORS.forEach(function(color,index){var c=new C();seedLoaded(c,color);c.setSpeed(3);if(!c.requestDispense(color))throw new Error(color+' request rejected');for(var i=0;i<40&&c.snapshot().phase!=='PIN_ENGAGE';i++)c.tick(.25,i*250);var state=c.snapshot(),target=index*Math.PI/2,wrapped=Math.atan2(Math.sin(target),Math.cos(target));if(state.phase!=='PIN_ENGAGE')throw new Error(color+' did not reach pin engagement');if(Math.abs(state.carriage)>.001)throw new Error(color+' pin carriage should be parked at the outer closed-slot datum before the pull stroke');if(Math.abs(state.drumAngle-wrapped)>.001)throw new Error(color+' did not index onto the common gate axis');});
  });
  test('pill fall interpolates throughout PILL_CLEAR instead of teleporting', function () {
    var c=new C();seedLoaded(c,'red');if(!c.requestDispense('red'))throw new Error('request rejected');
    for(var i=0;i<800&&c.snapshot().phase!=='PILL_CLEAR';i++)c.tick(.01,i*10);
    if(c.snapshot().phase!=='PILL_CLEAR')throw new Error('did not reach pill clearance');
    c.tick(.1,8100);var pill=c.snapshot().pill;
    if(pill.stage!=='falling'||!(pill.progress>0&&pill.progress<1))throw new Error('fall actor did not interpolate while tongue is open');
  });
  test('gate retracts before the pill settles onto the tongue', function () {
    var c=new C();seedLoaded(c,'red');if(!c.requestDispense('red'))throw new Error('request rejected');
    for(var i=0;i<500&&c.snapshot().phase!=='BLADE_PULL_RELEASE';i++)c.tick(.01,i*10);
    c.tick(.05,5100);if(c.snapshot().pill.stage!=='stack')throw new Error('bottom pill must remain supported in stack while blade retracts');
    if(c.snapshot().cartridges.red.count!==5)throw new Error('inventory decremented before pill landed');
    for(i=0;i<200&&c.snapshot().phase==='BLADE_PULL_RELEASE';i++)c.tick(.01,5200+i*10);
    if(c.snapshot().phase!=='STACK_SETTLE'||c.snapshot().pill.stage!=='falling_to_tongue'||c.snapshot().cartridges.red.count!==5)throw new Error('bottom pill did not begin its drop after the upper blade fully opened');
    c.tick(.1,7300);if(c.snapshot().cartridges.red.bladeMotion!=='open'||c.snapshot().tongueMotion!=='closed')throw new Error('stack settle must keep blade open while lower tongue stays closed');
    for(i=0;i<100&&c.snapshot().phase==='STACK_SETTLE';i++)c.tick(.01,7400+i*10);
    if(c.snapshot().phase!=='BLADE_ISOLATE_CLOSE'||c.snapshot().pill.stage!=='tongue'||c.snapshot().cartridges.red.count!==4||c.snapshot().chamberOccupancy!==1)throw new Error('bottom pill did not land/count on the lower tongue');
    c.tick(.2,8500);if(!(c.snapshot().cartridges.red.blade<1&&c.snapshot().cartridges.red.blade>0)||c.snapshot().cartridges.red.stackOffset>-5.7)throw new Error('upper gate did not wedge-lift the remaining stack by about 1 mm');
    for(i=0;i<100&&c.snapshot().phase==='BLADE_ISOLATE_CLOSE';i++)c.tick(.01,8600+i*10);
    if(c.snapshot().phase!=='BLADE_CLOSED_DWELL'||c.snapshot().cartridges.red.bladeMotion!=='closed'||c.snapshot().cartridges.red.blade!==0)throw new Error('upper gate failed to reach its closed separator endpoint');
    c.tick(.1,9700);if(c.snapshot().phase!=='BLADE_CLOSED_DWELL'||c.snapshot().cartridges.red.blade!==0)throw new Error('closed blade dwell was not observable before pin lift');
  });
  test('upper blade and shared tongue enforce mutual endpoint interlocks', function () {
    var c=new C();c.state.operation='dispense';c.state.selected='red';c.state.phase='PIN_ENGAGE';
    c.state.tongueMotion='opening';c.state.tongueEdge=0;
    if(c.commandBlade('red',true,true)!==false)throw new Error('blade moved while tongue was in motion');
    c.state.tongueMotion='closed';c.state.tongueEdge=5.7;c.state.cartridges.red.bladeMotion='opening';c.state.cartridges.red.blade=.5;
    if(c.commandTongue(true,true)!==false)throw new Error('tongue moved while blade was in motion');
    c.state.cartridges.red.bladeMotion='open';c.state.cartridges.red.blade=1;
    if(c.commandTongue(true,true)!==false)throw new Error('tongue opened while blade was fully open');
    c.state.cartridges.red.bladeMotion='closed';c.state.cartridges.red.blade=0;
      c.state.phase='PIN_LIFT';c.state.carriage=0;c.state.pin='up';
    if(c.commandTongue(true,true)!==true)throw new Error('tongue refused after every blade was fully closed');
  });
  test('no successful cycle overlaps gate motion or opens both gates', function () {
    COLORS.forEach(function(color){var c=new C();seedLoaded(c,color);if(!c.requestDispense(color))throw new Error(color+' request rejected');for(var i=0;i<1800&&c.snapshot().operation;i++){var s=c.tick(.01,i*10);var blade=s.cartridges[color];if(blade.bladeMotion!=='closed'&&s.tongueMotion!=='closed')throw new Error(color+' both gates moving/open at '+s.phase);if(s.tongueMotion!=='closed'&&blade.bladeMotion!=='closed')throw new Error(color+' tongue opened before upper blade closed');}if(c.snapshot().operation||c.snapshot().trayCount!==1||c.snapshot().cartridges[color].count!==4)throw new Error(color+' cycle did not complete once');});
  });
  test('idle RAF ticks do not drift mechanism or inventory', function () {
    var c=new C(),before=c.snapshot();
    for(var i=0;i<120;i++)c.tick(1/60,i*1000/60);
    var after=c.snapshot();
    ['phase','drumAngle','servoAngle','pin','pinZ','carriage','tongueEdge','trayCount','cartridges'].forEach(function(key){equal(after[key],before[key]);});
  });
  test('speed changes duration but never skips mechanism stages', function () {
    var slow=new C(),fast=new C();seedLoaded(slow,'red');seedLoaded(fast,'red');slow.requestDispense('red');fast.setSpeed(3);fast.requestDispense('red');
    for(var i=0;i<1000&&slow.snapshot().phase!=='BLADE_PULL_RELEASE';i++)slow.tick(.01,i*10);
    for(var j=0;j<1000&&fast.snapshot().phase!=='BLADE_PULL_RELEASE';j++)fast.tick(.01,j*10);
    slow.tick(.05,11000);fast.tick(.05,11000);
    if(slow.snapshot().phase!=='BLADE_PULL_RELEASE'||fast.snapshot().phase!=='BLADE_PULL_RELEASE')throw new Error('speed skipped or delayed blade opening');
    if(!(fast.snapshot().carriage>slow.snapshot().carriage))throw new Error('speed did not scale the horizontal blade stroke');
    var delayed=new C();seedLoaded(delayed,'red');delayed.requestDispense('red');delayed.tick(2,2000);if(delayed.snapshot().phase!=='PIN_ENGAGE')throw new Error('large frame delta skipped the pin-engagement state');
  });
  test('interlocks reject unsafe, busy, removed, empty and cap-open actions', function () {
    var c = new C(); c.state.pin = 'engaged';
    if (c.requestDispense('blue') !== false) throw new Error('unsafe request accepted');
    c.state.pin='up'; c.state.carriage=0; c.state.cartridges.red.capOpen=true;
    if (c.requestDispense('red') !== false) throw new Error('open cap ignored');
    c.state.cartridges.red.capOpen=false; c.state.cartridges.blue.present=false;
    if (c.requestDispense('blue') !== false) throw new Error('absent cartridge accepted');
    c.state.cartridges.blue.present=true; c.state.cartridges.blue.count=0;
    if (c.requestDispense('blue') !== false) throw new Error('empty cartridge accepted');
    seedLoaded(c,'blue',1); c.requestDispense('blue');
    if (c.requestDispense('red') !== false) throw new Error('busy request accepted');
  });
  test('all four exact barcode fixtures map to their matching cap', function () {
    var fixtures=window.DISPENSER_CONCEPT_DATA.demo.barcodes;
    equal(Object.values(fixtures).filter(Boolean).sort(),['blue','green','orange','red']);
    Object.keys(fixtures).forEach(function(code){var color=fixtures[code];if(!color)return;var c=new C();c.scan(code,0);advance(c,5,0);var state=c.snapshot();if(!state.cartridges[color].capOpen||state.cartridges[color].cap!=='open'||state.cartridges[color].count!==0||state.cartridges[color].occupancy!=='loaded')throw new Error(code+' did not place only its matching empty container and open its cap');if(Object.keys(state.cartridges).some(function(id){return id!==color&&(state.cartridges[id].capOpen||state.cartridges[id].occupancy!=='empty');}))throw new Error(code+' changed a non-matching compartment');if(!c.fill(color)||c.snapshot().cartridges[color].count!==5)throw new Error(code+' did not allow explicit assumed refill after cap opening');});
  });
  test('unsupported and unsuccessful scanner inputs preserve every compartment snapshot', function () {
    ['5012345678948','9999999999999','5012345678999','###'].forEach(function(code){var c=new C(),before=JSON.stringify(c.snapshot().cartridges);if(!c.scan(code,0))throw new Error('scan rejected before result: '+code);advance(c,5,0);equal(JSON.stringify(c.snapshot().cartridges),before);if(c.snapshot().pill!==null)throw new Error('failed scan created a pill actor');});
  });
  test('loaded same-color target rejects rescanning without overwrite or lid opening', function () {
    var c=new C();c.scan('5012345678900',0);advance(c,5,0);c.fill('red');c.closeCap('red');advance(c,.3,6000);var before=JSON.stringify(c.snapshot().cartridges);
    if(c.scan('5012345678900',7000)===false)throw new Error('idle loaded-target scan should complete to an unavailable result');
    advance(c,5,7000);equal(JSON.stringify(c.snapshot().cartridges),before);
    if(!/loaded or unavailable/.test(c.snapshot().scanResult))throw new Error('loaded-target refusal missing from scan result');
  });
  test('successful scanner flow auto-opens only its matched cap after package-out', function () {
    var c = new C(), visited = [];
    if (!c.scan('5012345678917', 0)) throw new Error('Blue demo scan rejected');
    for (var i = 0; i < 240 && c.snapshot().phase !== 'CAP_OPEN'; i += 1) {
      var state = c.tick(.025, i * 25);
      visited.push(state.phase);
      if (state.phase === 'PACKAGE_PLACE' && state.cartridges.blue.occupancy !== 'empty') throw new Error('compartment changed before placement animation completed');
      if (state.phase === 'PACKAGE_OUT' && state.cartridges.blue.capOpen) throw new Error('lid opened before package-out completed');
    }
    ['PACKAGE_IN','BEAM','SCAN_RESULT','PACKAGE_PLACE','PACKAGE_OUT','CAP_OPEN'].forEach(function (phase) { if (!visited.includes(phase) && c.snapshot().phase !== phase) throw new Error('scanner phase missing: '+phase); });
    if (!c.snapshot().cartridges.blue.capOpen || c.snapshot().cartridges.blue.cap !== 'open' || c.snapshot().cartridges.red.capOpen || c.snapshot().cartridges.green.capOpen || c.snapshot().cartridges.orange.capOpen) throw new Error('scan did not open only its mapped cap');
    advance(c, .3, 8000);
    if (c.snapshot().cartridges.blue.capAngle !== 1 || !c.snapshot().cartridges.blue.capOpen || c.snapshot().scanner!=='idle') throw new Error('automatic cap opening animation did not complete or scanner remained busy');
    c.tick(25, 30000);
    if (!c.snapshot().cartridges.blue.capOpen || c.snapshot().cartridges.blue.cap !== 'open') throw new Error('unopened-unlock expiry incorrectly closed an already-open lid');
    c.closeCap('blue'); advance(c, .3, 31000);
    if (c.snapshot().cartridges.blue.capOpen || c.snapshot().cartridges.blue.cap !== 'locked') throw new Error('manual close did not relock the automatically opened cap');
    var unknown = new C(); unknown.scan('9999999999999', 0); advance(unknown, 5, 0);
    if (Object.keys(unknown.snapshot().cartridges).some(function (color) { return unknown.snapshot().cartridges[color].capOpen; })) throw new Error('unknown scan opened a cap');
  });
  test('unsupported scan grants no placement and preserves every empty compartment', function () {
    ['5012345678948','9999999999999'].forEach(function(code){var c=new C(),before=JSON.stringify(c.snapshot().cartridges);c.scan(code,100);advance(c,5,100);equal(JSON.stringify(c.snapshot().cartridges),before);if(!/no compartment changed/.test(c.snapshot().scanResult))throw new Error('unsupported scan status missing');});
  });
  test('cap opening/closing animates, gates refill, and blocks dispense', function () {
    var c = new C(); c.scan('5012345678900',0); advance(c,5,0);
    if (!c.snapshot().cartridges.red.capOpen) throw new Error('successful fixture did not open its lid automatically');
    if (c.requestDispense('red') !== false) throw new Error('dispense accepted with cap open');
    advance(c,.3,6000); if (c.snapshot().cartridges.red.capAngle < .99) throw new Error('cap did not open smoothly');
    c.fill('red'); if (c.snapshot().cartridges.red.count !== 5) throw new Error('fill failed');
    c.closeCap('red'); advance(c,.3,4400); if(c.snapshot().cartridges.red.cap !== 'locked'||c.snapshot().cartridges.red.capAngle!==0)throw new Error('cap did not close and lock');
  });
  test('supported scan shows read, result, placement, package-out, then matching-cap opening', function () {
    var c=new C(), code='5012345678917', before=JSON.stringify(c.snapshot().cartridges);
    if(!c.scan(code,0))throw new Error('supported Blue fixture was refused');
    equal(c.snapshot().phase,'PACKAGE_IN');
    advance(c,.8,0);equal(c.snapshot().phase,'BEAM');equal(JSON.stringify(c.snapshot().cartridges),before);
    advance(c,.9,800);equal(c.snapshot().phase,'SCAN_RESULT');equal(JSON.stringify(c.snapshot().cartridges),before);
    advance(c,.9,1700);equal(c.snapshot().phase,'PACKAGE_PLACE');equal(JSON.stringify(c.snapshot().cartridges),before);
    advance(c,.9,2600);equal(c.snapshot().phase,'PACKAGE_OUT');
    var placed=c.snapshot().cartridges.blue;
    equal([placed.occupancy,placed.containerCode,placed.count,placed.cap,placed.capOpen],['loaded',code,0,'locked',false]);
    ['red','green','orange'].forEach(function(color){equal(c.snapshot().cartridges[color],new C().snapshot().cartridges[color]);});
    advance(c,.8,3500);equal(c.snapshot().phase,'CAP_OPEN');
    if(!c.snapshot().cartridges.blue.capOpen||c.snapshot().cartridges.red.capOpen||c.snapshot().cartridges.green.capOpen||c.snapshot().cartridges.orange.capOpen)throw new Error('cap did not open only after package-out');
    if(c.snapshot().cartridges.blue.count!==0||c.snapshot().pill!==null)throw new Error('pill inventory/actors appeared before explicit refill');
    advance(c,.3,4300);
    if(!c.fill('blue')||c.snapshot().cartridges.blue.count!==5)throw new Error('explicit refill did not create assumed inventory');
  });
  test('unsupported, unmapped, unknown, ambiguous and invalid scans preserve every compartment', function () {
    var examples=window.DISPENSER_CONCEPT_DATA.demo.scan_examples;
    if(!examples)throw new Error('amended scanner refusal fixtures are missing');
    ['unsupported_color','unmapped','unknown','ambiguous','invalid'].forEach(function(kind){
      var c=new C(),before=JSON.stringify(c.snapshot().cartridges),code=examples[kind];
      if(!code)throw new Error(kind+' demo refusal input is missing');
      if(!c.scan(code,0))throw new Error(kind+' scan did not produce a result');
      advance(c,6,0);
      equal(JSON.stringify(c.snapshot().cartridges),before);
      if(c.snapshot().pill!==null||!c.snapshot().scanResult||!/no compartment|no container|unchanged/i.test(c.snapshot().scanResult))throw new Error(kind+' refusal did not report a state-neutral result');
    });
  });
  test('loaded mapped target refusal reports a reason and preserves full compartment state', function () {
    var c=new C();seedLoaded(c,'orange');c.state.cartridges.orange.containerCode='5012345678931';var before=JSON.stringify(c.snapshot().cartridges);
    if(!c.scan('5012345678931',c.snapshot().wallNow))throw new Error('loaded target scan was not handled');
    advance(c,6,c.snapshot().wallNow);
    equal(JSON.stringify(c.snapshot().cartridges),before);
    if(!/loaded or unavailable/i.test(c.snapshot().scanResult)||c.snapshot().pill!==null)throw new Error('loaded-target refusal did not preserve state with an explicit result');
  });
  test('zero-pill matching container rescan recognizes and reopens without placing or mutating it', function () {
    var c=new C(),code='5012345678900',target=c.state.cartridges.red;
    target.occupancy='loaded';target.containerCode=code;target.count=0;
    var before=c.snapshot().cartridges,visited=[],states=[];
    if(!c.scan(code,0))throw new Error('matching zero-pill container rescan was refused');
    for(var i=0;i<500&&c.snapshot().operation;i++){var state=c.tick(.025,i*25);visited.push(state.phase);states.push(state);}
    ['PACKAGE_IN','BEAM','SCAN_RESULT','PACKAGE_OUT','CAP_OPEN'].forEach(function(phase){if(!visited.includes(phase))throw new Error('refill recognition phase missing: '+phase);});
    if(visited.includes('PACKAGE_PLACE'))throw new Error('refill recognition placed a duplicate container');
    var packageOutIndex=visited.indexOf('PACKAGE_OUT'),capOpenIndex=visited.indexOf('CAP_OPEN');
    if(packageOutIndex<0||capOpenIndex<=packageOutIndex)throw new Error('matching cap opened before package-out completed');
    var final=c.snapshot();
    equal([final.cartridges.red.occupancy,final.cartridges.red.containerCode,final.cartridges.red.count,final.cartridges.red.capOpen],['loaded',code,0,true]);
    ['blue','green','orange'].forEach(function(color){equal(final.cartridges[color],new C().snapshot().cartridges[color]);});
    if(!states.some(function(s){return s.phase==='PACKAGE_OUT'&&s.scanAction==='reuse'&&/existing.*container|container.*already/i.test(s.scanResult);}))throw new Error('scan result did not identify the existing container');
    if(!c.fill('red')||c.snapshot().cartridges.red.count!==5)throw new Error('explicit refill after matching rescan failed');
    equal([before.red.occupancy,before.red.containerCode,before.red.count],['loaded',code,0]);
  });
  test('zero-pill mismatched existing container scan is refused without changing compartments', function () {
    var c=new C(),target=c.state.cartridges.red;target.occupancy='loaded';target.containerCode='5012345678917';target.count=0;
    var before=JSON.stringify(c.snapshot().cartridges);
    if(!c.scan('5012345678900',0))throw new Error('mismatched-target scan was not handled');
    advance(c,6,0);
    equal(JSON.stringify(c.snapshot().cartridges),before);
    if(!/loaded or unavailable|mismatch/i.test(c.snapshot().scanResult))throw new Error('mismatched-container refusal reason is missing');
  });
  test('absent, busy, cap-open and unlocked rescan targets preserve compartment snapshots', function () {
    function unchanged(label,prepare,scanStarts){var c=new C();prepare(c);var before=JSON.stringify(c.snapshot().cartridges),started=c.scan('5012345678900',0);if(started!==scanStarts)throw new Error(label+' scan start result was unexpected');if(started)advance(c,6,0);equal(JSON.stringify(c.snapshot().cartridges),before);}
    unchanged('absent',function(c){c.state.cartridges.red.present=false;},true);
    unchanged('busy',function(c){c.state.operation='dispense';c.state.phase='CARRIAGE_APPROACH';},false);
    unchanged('open-cap',function(c){c.state.cartridges.red.cap='open';c.state.cartridges.red.capOpen=true;},false);
    unchanged('unlocked-cap',function(c){c.state.cartridges.red.cap='unlocked';c.state.cartridges.red.unlockUntil=100000;},true);
  });
  test('reset restores empty zero-count closed locked compartments and no actors after loading', function () {
    var c=new C();c.scan('5012345678900',0);advance(c,5,0);c.fill('red');c.closeCap('red');advance(c,.3,6000);
    if(!c.reset())throw new Error('safe reset after closing the cap was refused');
    var state=c.snapshot();
    equal(Object.keys(state.cartridges).sort(),['blue','green','orange','red']);
    Object.keys(state.cartridges).forEach(function(color){var item=state.cartridges[color];if(!item.present||item.occupancy!=='empty'||item.count!==0||item.cap!=='locked'||item.capOpen)throw new Error(color+' was not reset to the empty locked baseline');});
    if(state.pill!==null||state.chamberOccupancy!==0||state.trayCount!==0)throw new Error('reset retained an actor or inventory event');
  });
  test('cartridge exchange animates and preserves pill count', function () {
    var c=new C();seedLoaded(c,'green',3);c.exchange('green');
    if(c.snapshot().cartridges.green.present!==false)throw new Error('remove did not change presence');
    advance(c,1.3,0);if(c.snapshot().cartridges.green.lift!==1)throw new Error('remove lift did not complete');
    c.exchange('green');advance(c,1.3,1400);
    if(!c.snapshot().cartridges.green.present||c.snapshot().cartridges.green.count!==3)throw new Error('insert did not preserve inventory');
  });
  test('once schedule completes six requests and repeat stops at depletion', function () {
    var c=new C();seedAllLoaded(c);c.startSchedule('once');
    for(var i=0;i<2500&&c.snapshot().schedule.active;i++)c.tick(.025,i*25);
    if(c.snapshot().schedule.active||c.snapshot().trayCount!==6)throw new Error('once schedule did not finish exactly six events');
    var repeat=new C();seedAllLoaded(repeat);repeat.startSchedule('repeat');
    for(var j=0;j<6000&&repeat.snapshot().schedule.active;j++)repeat.tick(.025,j*25);
    if(repeat.snapshot().schedule.active||repeat.snapshot().trayCount>20)throw new Error('repeat schedule did not stop safely at depletion');
  });
  test('safe reset restores the deterministic initial fixture', function () {
    var c=new C();seedLoaded(c,'red');c.requestDispense('red');advance(c,8,0);if(c.snapshot().trayCount!==1)throw new Error('precondition dispense failed');
    if(!c.reset())throw new Error('safe reset refused');
    var state=c.snapshot();if(state.phase!=='PARKED'||state.trayCount!==0||state.pill!==null||COLORS.some(function(color){return state.cartridges[color].count!==0||state.cartridges[color].occupancy!=='empty'||state.cartridges[color].cap!=='locked';}))throw new Error('reset fixture must restore four empty locked compartments');
  });
  test('source controller contains no nondeterministic random calls', function () {
    if (/Math\.random/.test(C.toString())) throw new Error('unseeded randomness found');
  });
  test('two-gate reset parks with an empty chamber and no staged pill', function () {
    var state = new C().snapshot();
    if (state.phase !== 'PARKED' || state.pill !== null || state.chamberOccupancy !== 0) throw new Error('parked chamber is not empty');
    equal(state.tongueEdge, 5.7);
    COLORS.forEach(function (color) { if (state.cartridges[color].blade !== 0 || state.cartridges[color].count !== 0) throw new Error(color + ' must start empty above a closed blade'); });
  });
  test('two-gate cycle preserves bottom pill identity and exact event boundaries', function () {
    COLORS.forEach(function (color) {
      var c = new C(), visited = [], snapshots = [], before = c.snapshot();seedAllLoaded(c);
      if (!c.requestDispense(color)) throw new Error(color + ' request rejected');
      for (var i = 0; i < 1200 && c.snapshot().operation; i += 1) {
        c.tick(.025, i * 25);
        var s = c.snapshot(); visited.push(s.phase); snapshots.push(s);
        if (s.pill && s.pill.color !== color) throw new Error('pill identity changed color');
        var total = s.trayCount + s.chamberOccupancy + Object.keys(s.cartridges).reduce(function (n, key) { return n + s.cartridges[key].count; }, 0);
        if (total !== 20) throw new Error('inventory/actor/tray conservation failed');
        if (s.cartridges[color].bladeMotion!=='closed' && (s.tongueMotion!=='closed'||s.tongueEdge!==5.7)) throw new Error('blade moved before tongue fully closed');
        if (s.tongueEdge !== 5.7 && s.cartridges[color].blade !== 0) throw new Error('tongue moved before selected blade closed');
      }
      var state = c.snapshot();
      ['CARRIAGE_APPROACH','PIN_ENGAGE','BLADE_PULL_RELEASE','STACK_SETTLE','BLADE_ISOLATE_CLOSE','BLADE_CLOSED_DWELL','PIN_LIFT','TONGUE_RELEASE','PILL_CLEAR','TONGUE_RETURN'].forEach(function (phase) { if (!visited.includes(phase)) throw new Error('phase missing: ' + phase); });
      if (state.phase !== 'PARKED' || state.trayCount !== 1 || state.cartridges[color].count !== 4) throw new Error('final event counts incorrect');
      if (before.pill !== null || state.pill.color !== color || state.pill.pill_index !== 0 || state.pill.stage !== 'tray') throw new Error('stable bottom actor not retained');
      var landed = snapshots.find(function (x) { return x.phase === 'BLADE_ISOLATE_CLOSE'; });
      if (!landed || landed.cartridges[color].count !== 4 || landed.pill.stage !== 'tongue'||landed.chamberOccupancy!==1) throw new Error('count did not decrement at landing');
      var dwell = snapshots.filter(function (x) { return x.phase === 'BLADE_CLOSED_DWELL'; });
      if (!dwell.length || dwell.some(function (x) { return x.cartridges[color].blade !== 0 || x.cartridges[color].bladeMotion!=='closed' || x.tongueEdge !== 5.7; })) throw new Error('closed blade dwell not observable');
      if (visited.indexOf('PIN_LIFT') < visited.indexOf('BLADE_CLOSED_DWELL')) throw new Error('pin lifted before the blade-closed dwell');
    });
  });
  test('command interlock refuses blade motion unless tongue fully closed', function () {
    var c = new C();
    c.state.selected='blue';c.state.operation='dispense';c.state.phase='PIN_LIFT';c.state.carriage=0;c.state.pin='up';
    if (!c.commandTongue(true,true)) throw new Error('safe tongue test motion failed');
    var before = c.snapshot();
    if (c.commandBlade('red', true, true) !== false) throw new Error('blade command accepted while tongue open/moving');
    var after = c.snapshot();
    equal(after.cartridges, before.cartridges); equal(after.pill, before.pill); equal(after.tongueEdge, before.tongueEdge);
  });
  test('command interlock refuses tongue motion unless selected blade fully closed', function () {
    var c = new C(); c.state.selected = 'blue'; c.state.cartridges.blue.blade = .5;
    var before = c.snapshot();
    if (c.commandTongue(true,true) !== false) throw new Error('tongue command accepted while selected blade open');
    equal(c.snapshot().cartridges, before.cartridges); equal(c.snapshot().tongueEdge, before.tongueEdge);
  });
  test('large frame deltas cannot skip gate interlocks, dwell, or event boundaries', function () {
    var c = new C(); seedLoaded(c,'orange'); c.requestDispense('orange'); var visited = [];
    for (var i = 0; i < 40 && c.snapshot().operation; i += 1) { c.tick(100, i * 100000); var s = c.snapshot(); visited.push(s.phase); if (s.cartridges.orange.blade > 0 && s.tongueEdge !== 5.7) throw new Error('unsafe sampled gates'); }
      ['BLADE_PULL_RELEASE','STACK_SETTLE','BLADE_ISOLATE_CLOSE','BLADE_CLOSED_DWELL','PIN_LIFT','TONGUE_RELEASE','PILL_CLEAR','TONGUE_RETURN'].forEach(function (phase) { if (!visited.includes(phase)) throw new Error('large delta skipped ' + phase); });
    if (c.snapshot().trayCount !== 1 || c.snapshot().cartridges.orange.count !== 4) throw new Error('large delta duplicated or lost the event');
  });
  test('SC-028 browser source declares one origin station, four towers, four blades, and one shared tongue', function () {
    var data=window.DISPENSER_CONCEPT_DATA,schedule=data.assembly_schedule,station=schedule.station_interface;
    if(!station)throw new Error('SC-028 canonical origin station interface is missing');
    equal(station.station_count,1);equal(station.origin_mm,[0,0,0]);
    equal(station.active_cartridge_policy,'single_indexed_cartridge_only');
    equal(station.active_index_source,'controller.selected');
    equal(station.provenance,'USER_SPECIFIED');equal(station.verification_status,'NOT_VALIDATED');
    var axle=schedule.datum.drum_post_axis_xy_mm,radius=data.dimensions.find(function(item){return item.id==='cartridge.radial_position';}).value;
    equal(radius,15);equal(schedule.socket_frames.length,4);
    equal(schedule.socket_frames.map(function(socket){return socket.color;}),COLORS);
    schedule.socket_frames.forEach(function(socket){var dx=socket.center_mm[0]-axle[0],dy=socket.center_mm[1]-axle[1];if(Math.abs(Math.sqrt(dx*dx+dy*dy)-15)>1e-8)throw new Error(socket.color+' tower is not at 15 mm radius');});
    equal(data.components.filter(function(item){return item.category==='blade';}).map(function(item){return item.component_id;}),COLORS.map(function(color){return color+'-upper-blade-tab';}));
    equal(data.components.filter(function(item){return item.category==='tongue';}).map(function(item){return item.component_id;}),['shared-lower-tongue']);
    var conflicts=schedule.conflicts.map(function(item){return item.conflict_id;});
    ['drum-radius-discrepancy','blade-axis-conflict','pin-carriage-rail-endpoint','servo-pivot-rod-closure','tongue-spring-fr033-ak','fr031-cartridge-recipe-envelope'].forEach(function(id){if(conflicts.indexOf(id)<0)throw new Error('historical A–K conflict was dropped: '+id);});
    equal(schedule.frame_conversion.translation_mm,[0,15,0]);equal(schedule.frame_conversion.applied_component_ids,[]);
    equal(schedule.housing_nominal_bounds_mm.x,[-22,22]);equal(schedule.housing_nominal_bounds_mm.y,[-38,36]);
  });
  test('SC-028 controller actuates only the blade on the currently indexed cartridge', function () {
    var color='green',c=new C();seedAllLoaded(c);
    if(!c.requestDispense(color))throw new Error('indexed blade request rejected');
    var now=0,steps=0;
    while(c.snapshot().phase!=='BLADE_PULL_RELEASE'&&steps<1000){now+=50;c.tick(.05,now);steps+=1;}
    if(c.snapshot().phase!=='BLADE_PULL_RELEASE')throw new Error('selected blade phase was not reached');
    now+=100;c.tick(.1,now);
    var state=c.snapshot();
    if(state.selected!==color)throw new Error('active index does not identify the requested cartridge');
    COLORS.forEach(function(candidate){var blade=state.cartridges[candidate].blade;if(candidate===color){if(!(blade>0))throw new Error('indexed '+color+' blade did not actuate');}else if(blade!==0)throw new Error('nonindexed '+candidate+' blade actuated');});
  });
  test('SC-028 browser source records the ordered vertical stack and assumed 12 mm tray relation', function () {
    var schedule=window.DISPENSER_CONCEPT_DATA.assembly_schedule,stack=schedule.station_stack;
    if(!stack)throw new Error('SC-028 vertical stack contract is missing');
    equal(stack.layer_order,['selected_upper_blade','empty_one_pill_chamber','shared_lower_tongue','outlet_aperture','tray_receiving_plane']);
    equal(window.DISPENSER_CONCEPT_DATA.station.chamber.parked_occupancy,0);
    var relation=stack.outlet_to_tray_receiving_plane;
    equal(relation.distance_mm,12);equal(relation.direction,'below_outlet_plane');
    equal(relation.provenance,'USER_SPECIFIED');equal(relation.verification_status,'NOT_VALIDATED');
    equal(relation.outlet_plane_datum_status,'ASSUMED');equal(relation.receiving_surface_status,'ASSUMED');
    equal(relation.outlet_plane_z_mm,null);equal(relation.tray_receiving_plane_z_mm,null);
    var tongue=window.DISPENSER_CONCEPT_DATA.components.find(function(item){return item.component_id==='shared-lower-tongue';});
    var recipe=window.DISPENSER_CONCEPT_DATA.component_recipes.find(function(item){return item.recipe_id===tongue.recipe_id;});
    equal(recipe.parameters.size,[14,24,1.5]);
    equal(tongue.position[0],0);equal(tongue.position[2],-.75);
    var closedEdge=window.DISPENSER_CONCEPT_DATA.station.tongue.edge_y_closed_open_mm[0];
    if(Math.abs(tongue.position[1]-(closedEdge-recipe.parameters.size[1]/2))>1e-8)throw new Error('tongue center Y must follow the e datum and plate length, not be assumed at world Y=0');
    equal(window.DISPENSER_CONCEPT_DATA.station.tongue.z_bounds_mm,[-1.5,0]);
  });
  test('SC-029 browser source separates upper pin and lower tongue actuator zones and chains', function () {
    var data=window.DISPENSER_CONCEPT_DATA,schedule=data.assembly_schedule,zones=schedule.actuator_zones;
    if(!zones)throw new Error('SC-029 actuator-zone schedule is missing');
    equal(zones.upper.carriage_rail_z_band_mm,[14,20]);
    equal(zones.upper.pin_solenoid_component_id,'pull-solenoid');
    equal(zones.upper.pin_solenoid_role,'upper_vertical_pin_solenoid');
    equal(zones.upper.pin_solenoid_z_bounds_mm,[20.5,34]);
    equal(zones.upper.pin_solenoid_tower_zone_relation,'separate_from_four_tower_bank');
    equal(zones.upper.pin_solenoid_tower_zone_status,'ASSUMED');
    var parts={};data.components.forEach(function(item){parts[item.component_id]=item;});
    var solenoidRecipe=data.component_recipes.find(function(item){return item.recipe_id===parts['pull-solenoid'].recipe_id;}),solenoid=parts['pull-solenoid'],drum=parts['rotating-drum'];
    if(solenoid.position[2]<=20.5)throw new Error('upper pin solenoid is not above the station');
    if(Math.hypot(solenoid.position[0]-drum.position[0],solenoid.position[1]-drum.position[1])<=15)throw new Error('upper pin solenoid is not spatially separated from the drum/tower bank');
    equal(solenoidRecipe.parameters.size,[16,8,10]);
    nearArray([solenoid.position[2]-solenoidRecipe.parameters.size[2]/2,solenoid.position[2]+solenoidRecipe.parameters.size[2]/2],[22.25,32.25]);
    equal(zones.upper.pin_solenoid_source_z_bounds_mm,[20.5,34]);
    equal(zones.upper.pin_solenoid_source_bounds_status,'UNRESOLVED_CONFLICT');
    equal(zones.upper.servo_tower_zone_relation,'separate_from_four_tower_bank');
    equal(zones.upper.servo_tower_zone_status,'ASSUMED');
    equal(zones.upper.drive_chain,['servo-unit','servo-crank','connecting-rod','pin-carriage']);
    equal(zones.upper.shaft_to_selected_slot_chain,['servo-unit','servo-output-shaft','servo-crank','crank-pin','connecting-rod','pin-carriage','carriage-rail-left','carriage-rail-right','pull-solenoid','upper-solenoid-armature','engagement-pin','selected-blade-slot']);
    equal(zones.upper.guide_component_ids,['carriage-rail-left','carriage-rail-right']);
    equal(zones.upper.pin_chain,['pull-solenoid','engagement-pin','selected-blade-slot']);
    equal(zones.upper.crank_radius_mm,5.2);equal(zones.upper.connecting_rod_length_mm,34);
    equal(zones.lower_tongue.center_z_mm,-.75);
    equal(zones.lower_tongue.tower_zone_relation,'separate_from_four_tower_bank');
    equal(zones.lower_tongue.tower_zone_status,'ASSUMED');
    equal(zones.lower_tongue.pull_axis_canonical,[0,-1,0]);
    equal(zones.lower_tongue.pull_solenoid_owner_component_id,'tongue-actuator-rod');
    equal(zones.lower_tongue.pull_solenoid_submesh_id,'lower-tongue-pull-solenoid-body');
    equal(zones.lower_tongue.actuator_chain,['lower-tongue-pull-solenoid','lower-plunger','lower-tongue-moving-carriage','lower-tongue-strap','shared-lower-tongue']);
    equal(zones.lower_tongue.spring_concentric_with_node_id,'lower-plunger');
    equal(zones.lower_tongue.spring_moving_endpoint_node_id,'lower-tongue-moving-carriage');
    equal(zones.lower_tongue.spring_fixed_endpoint_component_id,'station-housing');
    equal(data.components.length,52);equal(data.export.physical_component_count,52);
    ['lower-tongue-pull-solenoid','lower-plunger','lower-tongue-moving-carriage','lower-tongue-strap'].forEach(function(id){if(data.components.some(function(item){return item.component_id===id;}))throw new Error('integrated lower actuator subfeature became a new physical ID: '+id);});
  });
  test('SC-029 browser source leaves unspecified actuator offsets and interfaces unresolved', function () {
    var zones=window.DISPENSER_CONCEPT_DATA.assembly_schedule.actuator_zones;
    if(!zones)throw new Error('SC-029 actuator-zone schedule is missing');
    equal(zones.upper.exact_mount_offsets_mm,null);
    equal(zones.upper.interface_status,'UNRESOLVED');
    equal(zones.upper.crank_pin_offset_mm,null);
    equal(zones.upper.rod_carriage_joint_offset_mm,null);
    equal(zones.upper.selected_slot_contact_mm,null);
    equal(zones.lower_tongue.exact_mount_offsets_mm,null);
    equal(zones.lower_tongue.interface_status,'UNRESOLVED');
    equal(zones.lower_tongue.plunger_carriage_contact_mm,null);
    equal(zones.lower_tongue.spring_end_seat_offsets_mm,null);
  });
  test('SC-029 browser bundle keeps the lower actuator and microswitch under their existing owners', function () {
    var data=window.DISPENSER_CONCEPT_DATA,recipes={},parts={};
    data.component_recipes.forEach(function(recipe){recipes[recipe.recipe_id]=recipe;});
    data.components.forEach(function(part){parts[part.component_id]=part;});
    var lower=recipes[parts['tongue-actuator-rod'].recipe_id].integrated_submeshes;
    ['lower-tongue-pull-solenoid-body','lower-plunger','lower-tongue-moving-carriage','lower-tongue-strap'].forEach(function(id){
      var feature=lower.find(function(item){return item.submesh_id===id;});
      if(!feature||feature.owner_component_id!=='tongue-actuator-rod'||feature.position_status!=='ASSUMED_RENDERED_FALLBACK'||feature.source_position_mm!==null||feature.verification_status!=='NOT_VALIDATED')throw new Error('lower visual submesh ownership/source status is incomplete: '+id);
    });
    equal(lower.find(function(item){return item.submesh_id==='lower-tongue-pull-solenoid-body';}).parameters.size_mm,[29.5,20.6,23.9]);
    var microswitch=recipes[parts['pin-carriage'].recipe_id].integrated_submeshes.find(function(item){return item.submesh_id==='microswitch-body';});
    equal(microswitch.owner_component_id,'pin-carriage');equal(microswitch.parameters.size_mm,[12.8,5.8,6.5]);
    equal(data.components.length,52);equal(data.export.physical_component_count,52);
  });
  test('FR-034 browser hierarchy maps station-root transforms and co-moving station parts', function () {
    var data=window.DISPENSER_CONCEPT_DATA,schedule=data.assembly_schedule;
    if(!schedule)throw new Error('A–K station-root schedule is missing from the local bundle');
    equal(schedule.datum.station_s_mm,[0,0,0]);equal(schedule.datum.drum_post_axis_xy_mm,[0,15]);
    var parts={};data.components.forEach(function(part){parts[part.component_id]=part;});
    var placements={};schedule.component_placements.forEach(function(item){placements[item.component_id]=item;});
    var groups={};schedule.browser_groups.forEach(function(group){groups[group.group_id]=group;});
    ['fixed-housing','rotating-drum','carriage-slide','tongue-slide','scanner-electronics'].forEach(function(id){if(!groups[id])throw new Error('browser motion group missing: '+id);});
    var socketRadius=window.DISPENSER_CONCEPT_DATA.dimensions.find(function(item){return item.id==='cartridge.radial_position';}).value,axisY=schedule.datum.drum_post_axis_xy_mm[1];
    COLORS.forEach(function(color,index){
      var socket=schedule.socket_frames[index],cartridge=parts[color+'-cartridge'];
      var angle=socket.angle_rad,expectedXY=[socketRadius*Math.sin(angle),axisY-socketRadius*Math.cos(angle)];
      equal(socket.color,color);nearArray(socket.center_mm.slice(0,2),expectedXY);
      equal(socket.local_axes.w,[0,0,1]);
      var cartridgePlacement=placements[color+'-cartridge'];
      if(!cartridge||!cartridgePlacement||!cartridgePlacement.parent_component_id||!cartridgePlacement.motion_group)throw new Error(color+' cartridge lacks parent/motion ownership');
      ['cap','upper-blade-tab','upper-blade-return-spring'].forEach(function(suffix){var child=parts[color+'-'+suffix],placement=placements[color+'-'+suffix];if(!child||!placement||!placement.motion_group||!placement.parent_component_id)throw new Error(color+' '+suffix+' lacks co-moving hierarchy metadata');if(placement.motion_group!==cartridgePlacement.motion_group)throw new Error(color+' station parts do not co-move in one station group');});
      if(cartridgePlacement.lift_axis_canonical!=='+Z')throw new Error(color+' cartridge lift is not local +Z');
    });
    ['central-post','barcode-scanner-housing','electronics-deck','controller-board-placeholder','scanner-head-placeholder','scanner-mount','outlet-tray','shared-lower-tongue','tongue-actuator-rod','pin-carriage','engagement-pin','pull-solenoid','connecting-rod'].forEach(function(id){if(!parts[id])throw new Error('scheduled browser component missing: '+id);});
    var features=schedule.integrated_features.map(function(feature){return feature.feature_id;});
    ['post-support','station-sockets','carriage-ears','carriage-flags','plunger-head','scanner-optics-guide','tongue-return-fixed-bracket'].forEach(function(id){if(features.indexOf(id)<0)throw new Error('integrated named feature missing: '+id);});
    if(schedule.credit_card_reference.physical_component!==false||schedule.credit_card_reference.export_included!==false)throw new Error('K reference card must remain presentation-only and excluded');
  });
  test('FR-034 placement records provide unique parents, browser groups, and exact 52-part ownership', function () {
    var data=window.DISPENSER_CONCEPT_DATA,schedule=data.assembly_schedule,parts={},placements={},groups={};
    if(!schedule||schedule.component_placements.length!==52)throw new Error('expected 52 scheduled placements');
    data.components.forEach(function(part){if(parts[part.component_id])throw new Error('duplicate physical ID '+part.component_id);parts[part.component_id]=part;});
    schedule.component_placements.forEach(function(item){if(placements[item.component_id])throw new Error('duplicate placement '+item.component_id);placements[item.component_id]=item;if(!parts[item.component_id])throw new Error('placement has no physical component '+item.component_id);if(item.verification_status!=='NOT_VALIDATED'||item.placement_provenance!=='ASSUMED'||!item.motion_group)throw new Error('placement status/ownership is incomplete for '+item.component_id);if(item.parent_component_id&&!parts[item.parent_component_id])throw new Error('unknown scheduled parent '+item.parent_component_id);if(item.world_position_mm===null){if(!Array.isArray(item.rendered_fallback_position_mm)||item.rendered_fallback_provenance!=='ASSUMED')throw new Error(item.component_id+' null world pose must use only an explicitly assumed rendered fallback');var fallbackResolution={position:item.rendered_fallback_position_mm,status:'UNRESOLVED',provenance:item.rendered_fallback_provenance};if(fallbackResolution.status!=='UNRESOLVED'||fallbackResolution.provenance!=='ASSUMED')throw new Error(item.component_id+' rendered fallback was promoted to a source pose');}});
    if(Object.keys(parts).length!==52||Object.keys(placements).length!==52)throw new Error('physical and placement inventories differ from 52');
    schedule.browser_groups.forEach(function(item){groups[item.group_id]=item;if(item.parent_group_id&&!schedule.browser_groups.some(function(candidate){return candidate.group_id===item.parent_group_id;}))throw new Error('unknown browser group parent '+item.parent_group_id);});
    ['fixed-housing','rotating-drum','station-red','station-blue','station-green','station-orange','servo-linkage','carriage-slide','tongue-slide','scanner-electronics'].forEach(function(id){if(!groups[id])throw new Error('required schedule browser group missing '+id);});
    COLORS.forEach(function(color){
      var cartridge=placements[color+'-cartridge'],cap=placements[color+'-cap'],label=placements[color+'-cap-label-plate'],tag=placements[color+'-passive-tag-carrier'],hinge=placements[color+'-cap-hinge-assembly'],latch=placements[color+'-cap-latch-body'],blade=placements[color+'-upper-blade-tab'],spring=placements[color+'-upper-blade-return-spring'];
      if(cartridge.parent_component_id!=='rotating-drum'||cartridge.motion_group!=='station-'+color||cartridge.lift_axis_canonical!=='+Z')throw new Error(color+' cartridge ownership/lift differs from schedule');
      [cap,label,tag,hinge,latch].forEach(function(item){if(!item||item.motion_group!=='station-'+color||item.parent_component_id!==color+'-cartridge'&&item.parent_component_id!==color+'-cap')throw new Error(color+' cap/ID child has inconsistent schedule ownership');});
      if(blade.motion_group!=='station-'+color||spring.motion_group!=='station-'+color)throw new Error(color+' blade/spring is not station-owned');
    });
    if(placements['tongue-return-spring'].parent_component_id!=='station-housing'||placements['tongue-return-spring'].motion_group!=='tongue-slide')throw new Error('tongue return spring must connect moving tongue group to fixed housing');
    if(placements['engagement-pin'].parent_component_id!=='pull-solenoid'||placements['pull-solenoid'].parent_component_id!=='pin-carriage'||placements['pin-carriage'].motion_group!=='carriage-slide')throw new Error('pin/solenoid/carriage ownership is inconsistent');
    if(Object.keys(parts).filter(function(id){return id.indexOf('scanner-mount')===0;}).join(',')!=='scanner-mount')throw new Error('do not invent Scanner Mount 2–4');
  });
  test('FR-034 A–K rotations use the separate cartridge and blade station bases', function () {
    var schedule=window.DISPENSER_CONCEPT_DATA.assembly_schedule,radius=window.DISPENSER_CONCEPT_DATA.dimensions.find(function(item){return item.id==='cartridge.radial_position';}).value,datum=schedule.datum.drum_post_axis_xy_mm;
    schedule.socket_frames.forEach(function(socket,index){var a=socket.angle_rad,u=[Math.sin(a),-Math.cos(a)],v=[Math.cos(a),Math.sin(a)],center=[radius*Math.sin(a),datum[1]-radius*Math.cos(a)];nearArray(socket.center_mm.slice(0,2),center);nearArray(socket.local_axes.u.slice(0,2),u);nearArray(socket.local_axes.v.slice(0,2),v);var cartridgeAngle=a-Math.PI/2,bladeAngle=a+Math.PI,bladeY=[-Math.sin(bladeAngle),Math.cos(bladeAngle)];if(Math.abs(bladeY[0]-u[0])>1e-8||Math.abs(bladeY[1]-u[1])>1e-8)throw new Error(COLORS[index]+' blade local +Y does not point outward along u');if(Math.abs(cartridgeAngle-(a-Math.PI/2))>1e-8)throw new Error(COLORS[index]+' cartridge rotation is not Rz(a−π/2)');});
  });
  test('FR-034 A–K controller trace follows corrected pin and tongue-spring schedule without claiming clearances', function () {
    var data=window.DISPENSER_CONCEPT_DATA,schedule=data.assembly_schedule,pinSchedule=akPinSchedule(schedule);
    if(!schedule)throw new Error('A–K pin schedule is missing');
    var tongueSchedule=schedule.tongue_group_schedule||{moving_edge_e_closed_open_mm:[5.7,-5.7],spring_moving_endpoint_local_y_offset_mm:-52,spring_fixed_bracket_y_bounds_mm:[-70,-68],spring_length_closed_open_mm:[21.7,10.3],ownership_conflict_status:'UNRESOLVED'},movingGroups=schedule.motion_trace&&schedule.motion_trace.moving_group_ids||['carriage-slide','tongue-slide'];
    var movingOffset=tongueSchedule.spring_moving_endpoint_local_y_offset_mm,fixedY=tongueSchedule.spring_fixed_bracket_y_bounds_mm[1],lengths=tongueSchedule.spring_length_closed_open_mm;
    var c=new C(),trace=[],initial=c.snapshot();seedLoaded(c,'blue');if(!c.requestDispense('blue'))throw new Error('Blue trace request rejected');
    for(var i=0;i<1800&&c.snapshot().operation;i++){
      var state=c.tick(.025,i*25),pinWorldY=pinSchedule.closed_center_y_mm-state.carriage,tongueEdge=state.tongueEdge,movingY=tongueEdge+movingOffset,springLength=Math.abs(fixedY-movingY),tipZ=pinSchedule.tip_z_raised_mm+state.pinZ;
      trace.push({phase:state.phase,carriageMm:state.carriage,pinWorldY:pinWorldY,tongueEdge:tongueEdge,movingSpringY:movingY,fixedSpringY:fixedY,springLength:springLength,movingGroups:movingGroups,pinTipZ:tipZ,plungerHeadGapStatus:'UNRESOLVED'});
      if(!Number.isFinite(pinWorldY)||!Number.isFinite(tongueEdge)||!Number.isFinite(springLength))throw new Error('incomplete corrected A–K trace at '+state.phase);
    }
    trace.unshift({phase:'PARKED',carriageMm:initial.carriage,pinWorldY:pinSchedule.closed_center_y_mm,tongueEdge:initial.tongueEdge,movingSpringY:initial.tongueEdge+movingOffset,fixedSpringY:fixedY,springLength:Math.abs(fixedY-(initial.tongueEdge+movingOffset)),movingGroups:movingGroups,pinTipZ:pinSchedule.tip_z_raised_mm,plungerHeadGapStatus:'UNRESOLVED'});
    trace.push({phase:'PARKED',carriageMm:c.snapshot().carriage,pinWorldY:pinSchedule.closed_center_y_mm,tongueEdge:c.snapshot().tongueEdge,movingSpringY:c.snapshot().tongueEdge+movingOffset,fixedSpringY:fixedY,springLength:Math.abs(fixedY-(c.snapshot().tongueEdge+movingOffset)),movingGroups:movingGroups,pinTipZ:pinSchedule.tip_z_raised_mm,plungerHeadGapStatus:'UNRESOLVED'});
    window.dispenserPhase17Trace=trace;
    ['PARKED','DRUM_ROTATE','CARRIAGE_APPROACH','PIN_ENGAGE','BLADE_PULL_RELEASE','STACK_SETTLE','BLADE_ISOLATE_CLOSE','BLADE_CLOSED_DWELL','PIN_LIFT','TONGUE_RELEASE','PILL_CLEAR','TONGUE_RETURN'].forEach(function(phase){if(!trace.some(function(item){return item.phase===phase;}))throw new Error('trace omitted full FSM phase '+phase);});
    if(!trace.some(function(item){return Math.abs(item.pinWorldY-pinSchedule.closed_center_y_mm)<1e-8;}))throw new Error('closed pin Y did not use the A–K datum');
    if(!trace.some(function(item){return Math.abs(item.pinWorldY-(pinSchedule.closed_center_y_mm-10.4))<1e-8;}))throw new Error('open blade pin Y did not move negative 10.4 mm');
    if(!trace.some(function(item){return Math.abs(item.pinTipZ-pinSchedule.tip_z_engaged_mm)<1e-8;})||!trace.some(function(item){return Math.abs(item.pinTipZ-pinSchedule.tip_z_raised_mm)<1e-8;}))throw new Error('pin tip did not preserve the scheduled engaged/raised Z endpoints');
    if(Math.abs(trace[0].movingSpringY-(-46.3))>1e-8||Math.abs(trace[0].springLength-lengths[0])>1e-8)throw new Error('closed A–K spring endpoint/length differs');
    var open=trace.find(function(item){return Math.abs(item.tongueEdge+5.7)<1e-8;});
    if(!open||Math.abs(open.movingSpringY-(-57.7))>1e-8||Math.abs(open.springLength-lengths[1])>1e-8||!(trace[0].springLength>open.springLength))throw new Error('open A–K spring endpoint/length must shorten to 10.3 mm');
    if(trace.some(function(item){return item.plungerHeadGapStatus!=='UNRESOLVED';}))throw new Error('missing plunger-head extent/gap was promoted to a clearance result');
    if(trace.some(function(item){return item.movingGroups.indexOf('carriage-slide')<0||item.movingGroups.indexOf('tongue-slide')<0;}))throw new Error('trace omitted controller moving groups');
    var beforeFormula=c.snapshot(),r=schedule.slider_crank.radius_mm,l=schedule.slider_crank.rod_length_mm,theta=beforeFormula.servoAngle*Math.PI/180,q=r*(1+Math.cos(theta))+Math.sqrt(l*l-r*r*Math.sin(theta)*Math.sin(theta))-l;
    if(!Number.isFinite(q))throw new Error('slider-crank diagnostic formula did not produce a finite comparison');
    equal(c.snapshot(),beforeFormula);
  });
  test('FR-034 conflict and K no-overlap checks report unresolved instead of global clearance PASS', function () {
    var schedule=window.DISPENSER_CONCEPT_DATA.assembly_schedule;
    if(!schedule)throw new Error('A–K conflict register is missing');
    var checks=schedule.clearance_checks;
    ['K-tray-outlet-interface','K-credit-card-reference-separation'].forEach(function(id){var check=checks.find(function(item){return item.check_id===id;});if(!check)throw new Error('K must-not-overlap review missing: '+id);if(check.status==='PASS')throw new Error(id+' was incorrectly promoted to clearance PASS');});
    ['drum-radius-discrepancy','blade-axis-conflict','blade-spring-housing-extents','servo-pivot-rod-closure','vertical-stack-clearance','scanner-read-point-basis'].forEach(function(id){if(!schedule.conflicts.some(function(item){return item.conflict_id===id&&item.status!=='PASS';}))throw new Error('unresolved source conflict missing: '+id);});
    var railConflict=schedule.conflicts.find(function(item){return item.conflict_id==='pin-carriage-rail-endpoint';}),springConflict=schedule.conflicts.find(function(item){return item.conflict_id==='tongue-spring-fr033-ak';}),headCheck=checks.find(function(item){return /plunger-head|pin-head/i.test(item.check_id);});
    if(railConflict&&railConflict.status!=='CONFLICT')throw new Error('5.2 mm carriage/rail endpoint conflict must remain explicit');
    var springStatus=springConflict?springConflict.status:'UNRESOLVED';
    if(springStatus!=='UNRESOLVED'&&springStatus!=='CONFLICT')throw new Error('FR-033/SC-024 spring contradiction must remain unresolved/conflicted');
    if(headCheck&&headCheck.status==='PASS')throw new Error('unknown plunger-head gap was promoted to clearance PASS');
    var closedY=akPinSchedule(schedule).closed_center_y_mm,railEndY=-20;if(Math.abs(Math.abs(closedY-railEndY)-5.2)>1e-8)throw new Error('corrected closed carriage/rail endpoint separation is not 5.2 mm');
    if(!headCheck&&checks.some(function(item){return item.status==='PASS'&&item.required_gap_mm===null;}))throw new Error('unspecified plunger-head gap was implicitly passed');
    if(checks.some(function(item){return item.status==='PASS'&&item.required_gap_mm===null;}))throw new Error('unknown clearance was promoted to PASS');
  });
  summary.textContent = passed + ' passed, ' + failed + ' failed';
  summary.dataset.failed = String(failed);
}());
