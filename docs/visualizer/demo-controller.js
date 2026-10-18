(function (root) {
  'use strict';
  var DATA = root.DISPENSER_CONCEPT_DATA;
  var COLORS = ['red', 'blue', 'green', 'orange'];
  var PHASES = [
    ['CARRIAGE_APPROACH', 0.2], ['PIN_ENGAGE', 5 / 8], ['BLADE_PULL_RELEASE', Math.PI / 3.1],
    ['STACK_SETTLE', 0.5], ['BLADE_ISOLATE_CLOSE', Math.PI / 3.1], ['BLADE_CLOSED_DWELL', 0.3],
    ['PIN_LIFT', 5 / 8], ['TONGUE_RELEASE', 11.4 / 14],
    ['PILL_CLEAR', 0.5], ['TONGUE_RETURN', 11.4 / 14]
  ];
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.keys(value).forEach(function (key) { freeze(value[key]); });
      Object.freeze(value);
    }
    return value;
  }
  function Controller() { this.resetState(); }
  Controller.prototype.resetState = function () {
    var cartridges = {};
    COLORS.forEach(function (id) { cartridges[id] = { present: true, count: 0, occupancy: 'empty', containerCode: null, cap: 'locked', unlockUntil: 0, capOpen: false, capAngle: 0, capTarget: 0, lift: 0, liftTarget: 0, blade: 0, bladeMotion: 'closed', stackOffset: 0 }; });
    this.state = { phase: 'PARKED', selected: null, drumAngle: 0, rotationStart: 0, rotationDelta: 0, phaseProgress: 0, servoAngle: 180, pin: 'up', pinZ: 0, carriage: 0, tongueEdge: 5.7,
      tongueMotion: 'closed', chamberOccupancy: 0, trayCount: 0, pill: null, cartridges: cartridges, scanner: 'idle', scanCode: null, scanResult: '', schedule: { mode: 'once', active: false, index: 0 },
      speed: 1, rejection: '', operation: null, transitionIndex: 0, pending: 0, remaining: 0, duration: 0, wallNow: 0, scanMatchedColor: null, scanPlacementColor: null, scanPlacementReady: false, scanAction: null };
  };
  Controller.prototype.snapshot = function () { return freeze(copy(this.state)); };
  Controller.prototype.reject = function (reason) { this.state.rejection = reason; return false; };
  Controller.prototype.idle = function () { return this.state.phase === 'PARKED' && this.state.operation === null; };
  Controller.prototype.canMoveBlade = function (color, opening) {
    var s=this.state,c=s.cartridges[color];
    if(!c||s.tongueMotion!=='closed'||Math.abs(s.tongueEdge-5.7)>1e-9)return false;
    return opening?s.phase==='PIN_ENGAGE'&&c.bladeMotion==='closed'&&c.blade===0:s.phase==='STACK_SETTLE'&&c.bladeMotion==='open'&&c.blade===1;
  };
  Controller.prototype.canMoveTongue = function () {
    var s=this.state;
    return s.phase==='PIN_LIFT'&&s.tongueMotion==='closed'&&Math.abs(s.tongueEdge-5.7)<1e-9&&Math.abs(s.carriage)<1e-9&&COLORS.every(function(color){var c=s.cartridges[color];return c.bladeMotion==='closed'&&c.blade===0;});
  };
  Controller.prototype.commandBlade = function (color, opening, internal) {
    var s=this.state,c=s.cartridges[color];
    if(!internal)return this.reject('Upper blade motion is controller-owned.');
    if(!this.canMoveBlade(color,opening))return this.reject('Upper blade interlock: shared lower tongue must be fully closed and the blade at its opposite endpoint.');
    c.bladeMotion=opening?'opening':'closing';return true;
  };
  Controller.prototype.commandTongue = function (opening, internal) {
    var s=this.state;
    if(!internal)return this.reject('Lower tongue motion is controller-owned.');
    var allowed=opening?this.canMoveTongue():(s.phase==='PILL_CLEAR'&&s.tongueMotion==='open'&&Math.abs(s.tongueEdge+5.7)<1e-9&&COLORS.every(function(color){var c=s.cartridges[color];return c.bladeMotion==='closed'&&c.blade===0;}));
    if(!allowed)
      return this.reject('Lower tongue interlock: every upper blade must be fully closed before tongue motion.');
    s.tongueMotion=opening?'opening':'closing';return true;
  };
  Controller.prototype.requestDispense = function (color, internal) {
    var s = this.state, cartridge = s.cartridges[color];
    if (!COLORS.includes(color)) return this.reject('Unknown cartridge color.');
    if (!internal && !this.idle()) return this.reject('Mechanism or scanner is busy.');
    if (internal && !this.idle()) return false;
    if (Object.keys(s.cartridges).some(function (key) { return s.cartridges[key].capOpen; })) return this.reject('Close every open cap before dispensing.');
    if (!cartridge.present) return this.reject('Selected cartridge is removed.');
    if (cartridge.occupancy !== 'loaded' || cartridge.count < 1) return this.reject('Selected compartment is empty; scan and place a matching fictional container first.');
    if (s.pin !== 'up' || Math.abs(s.carriage) > 0.01) return this.reject('Rotation interlock: pin must be up and carriage parked.');
    if(cartridge.bladeMotion!=='closed'||cartridge.blade!==0||s.tongueMotion!=='closed'||Math.abs(s.tongueEdge-5.7)>1e-9)return this.reject('Dispense interlock: both gates must be fully closed.');
    s.rejection = ''; s.selected = color; s.operation = 'dispense'; s.pill = {color:color,pill_index:5-cartridge.count,identity:color+':'+(5-cartridge.count),stage:'stack',progress:0,position:null};
    var target = COLORS.indexOf(color) * Math.PI / 2;
    var delta = Math.atan2(Math.sin(target - s.drumAngle), Math.cos(target - s.drumAngle));
    if (Math.abs(delta) > 0.001) {
      s.phase = 'DRUM_ROTATE'; s.remaining = Math.abs(delta) / DATA.demo.rates.drum_rad_s; s.duration = s.remaining; s.rotationStart=s.drumAngle; s.rotationDelta = delta;
    } else { this.enterPhase('CARRIAGE_APPROACH',0.2); }
    return true;
  };
  Controller.prototype.enterPhase = function (name, duration) { this.state.phase = name; this.state.remaining = duration || 0; this.state.duration = duration || 0; this.state.phaseProgress=0; this.state.transitionIndex += 1; };
  Controller.prototype.scan = function (code, wallMs) {
    var s = this.state;
    if (!this.idle()) return this.reject('Cannot scan while another operation is active.');
    if (Object.keys(s.cartridges).some(function (key) { return s.cartridges[key].capOpen; })) return this.reject('Close every open cap before scanning.');
    s.operation = 'scan'; s.scanCode = String(code); s.scanResult = ''; s.scanMatchedColor = null; s.scanPlacementColor = null; s.scanPlacementReady = false; s.scanAction = null; s.scanner = 'PACKAGE_IN'; s.phase = 'PACKAGE_IN'; s.remaining = 0.8; s.duration = 0.8; s.pending = 0; s.wallNow = Number(wallMs) || s.wallNow;
    return true;
  };
  Controller.prototype.openCap = function (color) {
    var s=this.state, c=s.cartridges[color];
    if (!c || !this.idle()) return this.reject('Cap operation requires an idle mechanism.');
    if (!c.present) return this.reject('Insert the cartridge before opening its cap.');
    if (c.cap !== 'unlocked' || s.wallNow >= c.unlockUntil) return this.reject('A matching barcode scan is required to unlock this cap.');
    c.capOpen=true; c.cap='open'; c.capTarget=1; s.operation='cap'; s.capColor=color; s.phase='CAP_OPEN'; s.remaining=DATA.demo.durations.cap_ease_s; s.duration=s.remaining; s.rejection=''; return true;
  };
  Controller.prototype.closeCap = function (color) { var c=this.state.cartridges[color],s=this.state; if (!c || !this.idle()) return this.reject('Cap operation requires an idle mechanism.'); c.capOpen=false; c.cap='locked'; c.unlockUntil=0;c.capTarget=0;s.operation='cap';s.capColor=color;s.phase='CAP_CLOSE';s.remaining=DATA.demo.durations.cap_ease_s;s.duration=s.remaining;return true; };
  Controller.prototype.fill = function (color) { var c=this.state.cartridges[color]; if (!c || !this.idle()) return this.reject('Refill requires an idle mechanism.'); if (!c.capOpen) return this.reject('Open the matching cap before refilling.'); if(c.occupancy!=='loaded')return this.reject('A matching container scan is required before refill.'); c.count=DATA.demo.max_inventory; return true; };
  Controller.prototype.exchange = function (color) { var c=this.state.cartridges[color],s=this.state; if (!c || !this.idle()) return this.reject('Cartridge exchange requires an idle mechanism.'); if (c.capOpen || c.cap==='unlocked') return this.reject('Close and lock the cap before cartridge exchange.'); c.present=!c.present;c.liftTarget=c.present?0:1;s.operation='cartridge';s.capColor=color;s.phase=c.present?'CARTRIDGE_INSERT':'CARTRIDGE_LIFT';s.remaining=DATA.demo.durations.cartridge_lift_s;s.duration=s.remaining;return true; };
  Controller.prototype.setSpeed = function (value) { this.state.speed=Math.max(DATA.demo.speed.min,Math.min(DATA.demo.speed.max,Number(value)||1)); return this.state.speed; };
  Controller.prototype.startSchedule = function (mode) { if (!this.idle()) return this.reject('Schedule can start only while idle.'); this.state.schedule={mode:mode==='repeat'?'repeat':'once',active:true,index:0}; return this.runScheduleNext(); };
  Controller.prototype.runScheduleNext = function () { var q=this.state.schedule, sequence=DATA.demo.schedule; if (!q.active) return false; if (q.index>=sequence.length) { if (q.mode==='repeat') q.index=0; else { q.active=false; return false; } } var color=sequence[q.index]; if (!this.requestDispense(color,true)) { q.active=false; return false; } q.index+=1; return true; };
  Controller.prototype.reset = function () { if (!this.idle() || Object.keys(this.state.cartridges).some(function (k) { return this.state.cartridges[k].capOpen; },this)) return this.reject('Reset requires parked idle state and all caps closed.'); this.resetState(); return true; };
  Controller.prototype.tick = function (dt, wallMs) {
    var s=this.state, wall=Number(wallMs); if (Number.isFinite(wall)) s.wallNow=wall;
    Object.keys(s.cartridges).forEach(function (key) { var c=s.cartridges[key]; if (c.cap==='unlocked' && s.wallNow>=c.unlockUntil) { c.cap='locked'; c.unlockUntil=0; } });
    if (s.operation===null) return this.snapshot();
    if (s.operation==='cap'||s.operation==='cartridge') {
      var visual=s.cartridges[s.capColor], advance=Math.max(0,Number(dt)||0)*s.speed;
      if(s.operation==='cap')visual.capAngle+=Math.sign(visual.capTarget-visual.capAngle)*Math.min(Math.abs(visual.capTarget-visual.capAngle),advance/Math.max(DATA.demo.durations.cap_ease_s,0.001));
      else visual.lift+=Math.sign(visual.liftTarget-visual.lift)*Math.min(Math.abs(visual.liftTarget-visual.lift),advance/Math.max(DATA.demo.durations.cartridge_lift_s,0.001));
      s.remaining=Math.max(0,s.remaining-advance);s.phaseProgress=1-s.remaining/Math.max(s.duration,0.001);
      if(s.remaining<=0){if(s.operation==='cap'){visual.capAngle=visual.capTarget;if(s.phase==='CAP_OPEN')s.scanner='idle';}else visual.lift=visual.liftTarget;s.operation=null;s.phase='PARKED';s.phaseProgress=0;}
      return this.snapshot();
    }
    s.pending += Math.max(0,Number(dt)||0) * s.speed;
    if (s.remaining > 0 && s.pending < s.remaining) { s.remaining-=s.pending; s.pending=0; this.interpolate(); return this.snapshot(); }
    s.pending=Math.max(0,s.pending-Math.max(0,s.remaining)); s.remaining=0;
    if (s.operation==='scan') { this.advanceScan(); return this.snapshot(); }
    if (s.phase==='DRUM_ROTATE') { s.drumAngle=s.rotationStart+s.rotationDelta; s.rotationDelta=0; this.enterPhase('CARRIAGE_APPROACH',0.2); this.interpolate(); return this.snapshot(); }
    this.interpolate();
    var current=s.phase;
    if (current==='STACK_SETTLE' && s.pill) { var staged=s.cartridges[s.selected];staged.count-=1;staged.stackOffset=-5*(5-staged.count)-1;s.pill.stage='tongue';s.pill.progress=1;s.chamberOccupancy=1; }
    if (current==='BLADE_ISOLATE_CLOSE') { var closedBlade=s.cartridges[s.selected];closedBlade.blade=0;closedBlade.bladeMotion='closed';closedBlade.stackOffset=-5*(5-closedBlade.count); }
    if (current==='TONGUE_RELEASE') { s.tongueEdge=-5.7; s.tongueMotion='open'; if(s.pill) {s.pill.stage='falling';s.pill.progress=0;} }
    if (current==='PILL_CLEAR') { s.trayCount+=1; s.chamberOccupancy=0; if(s.pill) {s.pill.stage='tray';s.pill.progress=1;} }
    if (current==='PIN_LIFT') { s.pin='up'; s.pinZ=0; }
    if (current==='TONGUE_RETURN') { s.tongueEdge=5.7; s.tongueMotion='closed'; s.pin='up'; s.pinZ=0; s.carriage=0; s.servoAngle=180; s.operation=null; s.phase='PARKED'; s.remaining=0; if(s.schedule.active) this.runScheduleNext(); return this.snapshot(); }
    var index=PHASES.findIndex(function (item) { return item[0]===current; });
    if (index>=0 && index+1<PHASES.length) {
      var next=PHASES[index+1];
      if(next[0]==='BLADE_PULL_RELEASE'&&!this.commandBlade(s.selected,true,true))return this.snapshot();
      if(next[0]==='BLADE_ISOLATE_CLOSE'&&!this.commandBlade(s.selected,false,true))return this.snapshot();
      if(next[0]==='TONGUE_RELEASE'&&!this.commandTongue(true,true))return this.snapshot();
      if(next[0]==='TONGUE_RETURN'&&!this.commandTongue(false,true))return this.snapshot();
      this.enterPhase(next[0],next[1]);
      if (next[0]==='PIN_ENGAGE') { s.pin='moving'; s.pinZ=-5; }
      if (next[0]==='BLADE_PULL_RELEASE') {
        s.pin='engaged';
      }
      if(next[0]==='STACK_SETTLE'&&s.pill){s.pill.stage='falling_to_tongue';s.pill.progress=0;}
      if (next[0]==='PIN_LIFT') s.pin='moving';
      this.interpolate();
    }
    return this.snapshot();
  };
  Controller.prototype.advanceScan = function () {
    var s=this.state;
    if(s.phase==='PACKAGE_IN') { s.scanner='BEAM';s.phase='BEAM';s.remaining=DATA.demo.durations.scan_beam_s;s.duration=s.remaining;s.phaseProgress=0;s.transitionIndex+=1;return; }
    if(s.phase==='BEAM') { s.scanner='SCAN_RESULT';s.phase='SCAN_RESULT';s.remaining=DATA.demo.durations.scan_result_s;s.duration=s.remaining;s.phaseProgress=0;s.transitionIndex+=1;return; }
    if(s.phase==='SCAN_RESULT') {
      var examples=DATA.demo.scan_examples||{}, color=DATA.demo.barcodes[s.scanCode], target=color&&s.cartridges[color];
      if(s.scanCode===examples.ambiguous||!/^\d{13}$/.test(s.scanCode)) {
        s.scanResult=s.scanCode===examples.ambiguous?'Ambiguous fictional fixture result; no container placed and no compartment changed.':'Invalid fictional barcode; no container placed and no compartment changed.';
        s.scanner='PACKAGE_OUT';s.phase='PACKAGE_OUT';s.remaining=DATA.demo.durations.scan_out_s;s.duration=s.remaining;s.phaseProgress=0;s.transitionIndex+=1;return;
      }
      if(!color) {
        var result=s.scanCode===examples.unsupported_color?'Unsupported container color':(s.scanCode===examples.unknown?'Unknown barcode':(s.scanCode===examples.unmapped?'Unmapped barcode':'Unsupported or unknown barcode'));
        s.scanResult=result+'; no container placed, no compartment changed, and no lid opened.';
        s.scanner='PACKAGE_OUT';s.phase='PACKAGE_OUT';s.remaining=DATA.demo.durations.scan_out_s;s.duration=s.remaining;s.phaseProgress=0;s.transitionIndex+=1;return;
      }
      var available=target&&target.present&&target.count===0&&!target.capOpen&&target.cap==='locked';
      var matchingContainer=available&&target.occupancy==='loaded'&&target.containerCode===s.scanCode;
      var emptyTarget=available&&target.occupancy==='empty'&&target.containerCode===null;
      if(!matchingContainer&&!emptyTarget) {
        s.scanResult='Matching '+color+' compartment is loaded or unavailable; no container placed and no compartment changed.';
        s.scanner='PACKAGE_OUT';s.phase='PACKAGE_OUT';s.remaining=DATA.demo.durations.scan_out_s;s.duration=s.remaining;s.phaseProgress=0;s.transitionIndex+=1;return;
      }
      s.scanMatchedColor=color;
      if(matchingContainer){s.scanAction='reuse';s.scanPlacementReady=false;s.scanResult='Existing matching '+color+' container recognized for refill. No new container will be placed.';s.scanner='PACKAGE_OUT';s.phase='PACKAGE_OUT';s.remaining=DATA.demo.durations.scan_out_s;s.duration=s.remaining;s.phaseProgress=0;s.transitionIndex+=1;return;}
      s.scanAction='place';s.scanPlacementReady=true;
      s.scanResult='Fictional '+color+' container recognized. Moving it to the matching empty compartment.';
      s.scanner='PACKAGE_PLACE';s.phase='PACKAGE_PLACE';s.remaining=DATA.demo.durations.scan_place_s;s.duration=s.remaining;s.phaseProgress=0;s.transitionIndex+=1;return;
    }
    if(s.phase==='PACKAGE_PLACE') {
      var placed=s.cartridges[s.scanMatchedColor];
      if(s.scanAction!=='place'||!placed||!s.scanPlacementReady||placed.occupancy!=='empty'||placed.containerCode!==null||placed.count!==0||!placed.present||placed.cap!=='locked'||placed.capOpen) {
        s.scanResult='Mapped compartment became unavailable; placement cancelled and all compartments preserved.';
        s.scanMatchedColor=null;s.scanPlacementReady=false;s.scanAction=null;s.scanner='UNAVAILABLE';s.phase='PACKAGE_OUT';s.remaining=DATA.demo.durations.scan_out_s;s.duration=s.remaining;s.phaseProgress=0;s.transitionIndex+=1;return;
      }
      placed.occupancy='loaded';placed.containerCode=s.scanCode;placed.count=0;
      s.scanResult='Fictional container placed in '+s.scanMatchedColor+'. Assumed pill inventory remains zero until explicit refill; only its simulated lid opens after package-out.';
      s.scanner='PACKAGE_OUT';s.phase='PACKAGE_OUT';s.remaining=DATA.demo.durations.scan_out_s;s.duration=s.remaining;s.phaseProgress=0;s.transitionIndex+=1;return;
    }
    if(s.phase==='PACKAGE_OUT') {
      var placedColor=s.scanMatchedColor;
      s.scanner=placedColor?'CAP_OPEN':'idle';s.transitionIndex+=1;
      if(placedColor) {
        var cap=s.cartridges[placedColor];cap.capOpen=true;cap.cap='open';cap.capTarget=1;
        s.operation='cap';s.capColor=placedColor;s.phase='CAP_OPEN';s.remaining=DATA.demo.durations.cap_ease_s;s.duration=s.remaining;s.phaseProgress=0;
        s.scanResult=s.scanAction==='reuse'?'Existing matching '+placedColor+' container reused; its cap reopened for explicit refill. No new container placed. Fictional demo only; no hardware action.':'Matching '+placedColor+' compartment opened after container placement. Fictional demo only; no hardware action.';
        s.scanMatchedColor=null;s.scanPlacementReady=false;
      } else {s.operation=null;s.phase='PARKED';s.remaining=0;s.duration=0;s.phaseProgress=0;}
      return;
    }
    s.operation=null;s.phase='PARKED';s.scanner='idle';s.remaining=0;s.duration=0;s.phaseProgress=0;
  };
  Controller.prototype.interpolate = function () {
    var s=this.state, progress=Math.max(0,Math.min(1,1-(s.remaining/Math.max(s.duration,0.001))));
    s.phaseProgress=progress;
    if(s.phase==='DRUM_ROTATE')s.drumAngle=s.rotationStart+s.rotationDelta*progress;
    if(s.phase==='CARRIAGE_APPROACH') { s.carriage=0; s.servoAngle=180; }
    if(s.phase==='BLADE_PULL_RELEASE') { s.carriage=10.4*progress;s.servoAngle=180*(1-progress);var opening=s.cartridges[s.selected];if(opening){opening.blade=progress;opening.bladeMotion=progress>=1?'open':'opening';} }
    if(s.phase==='STACK_SETTLE') { s.carriage=10.4; s.servoAngle=0;var settle=s.cartridges[s.selected];if(settle){settle.stackOffset=-5*(5-settle.count)-6*progress;}if(s.pill){s.pill.progress=progress;s.pill.stage='falling_to_tongue';} }
    if(s.phase==='BLADE_ISOLATE_CLOSE') { s.carriage=10.4*(1-progress); s.servoAngle=180*progress;var closing=s.cartridges[s.selected];if(closing){closing.blade=1-progress;closing.bladeMotion=progress>=1?'closed':'closing';closing.stackOffset=-5*(5-closing.count)-1+progress;} }
    if(s.phase==='PIN_ENGAGE'||s.phase==='PIN_LIFT') s.pinZ=s.phase==='PIN_ENGAGE'?-5*progress:-5*(1-progress);
    if(s.phase==='TONGUE_RELEASE') { s.tongueEdge=5.7-11.4*progress; }
    if(s.phase==='PILL_CLEAR'&&s.pill){s.pill.progress=progress;s.pill.stage='falling';}
    if(s.phase==='TONGUE_RETURN') s.tongueEdge=-5.7+11.4*progress;
  };
  root.DispenserDemoController = Controller;
}(typeof window !== 'undefined' ? window : this));
