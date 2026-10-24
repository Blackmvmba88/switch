'use strict';

// Experimental helicopter takeover controller. Simulation only; no hardware output here.
// Coordinate convention: pitch/bank/yaw positive per telemetry provider;
// actuator signs MUST be calibrated in the simulator before connecting an output adapter.
const clamp = (x, a=-1, b=1) => Math.max(a, Math.min(b, Number(x)||0));
const finite = x => typeof x === 'number' && Number.isFinite(x);
const REQUIRED = ['pitchDeg','bankDeg','pitchRateDegS','rollRateDegS','yawRateDegS','verticalSpeedFpm','altitudeAglFt','headingDeg'];

class HeliTakeover {
  constructor(options={}) {
    this.enabled=false;
    this.lastAt=null;
    this.target=null;
    this.maxAgeMs=options.maxAgeMs ?? 250;
    this.maxDeflection=options.maxDeflection ?? 0.35;
    this.deadzone=options.deadzone ?? 0.12;
  }
  disengage(reason='PILOT_OVERRIDE') {
    this.enabled=false;
    this.target=null;
    return {active:false,reason,commands:null};
  }
  toggle(state, nowMs=Date.now()) {
    if(this.enabled) return this.disengage();
    if(!this.valid(state,nowMs)) return this.disengage('TELEMETRY_UNAVAILABLE');
    this.enabled=true;
    this.target={altitudeAglFt:state.altitudeAglFt,headingDeg:state.headingDeg};
    this.lastAt=nowMs;
    return {active:true,reason:'ENGAGED',target:{...this.target},commands:null};
  }
  valid(s, nowMs) {
    return s && REQUIRED.every(k=>finite(s[k])) &&
      finite(s.timestampMs) && s.timestampMs<=nowMs &&
      nowMs-s.timestampMs<=this.maxAgeMs &&
      s.altitudeAglFt>=0 && s.altitudeAglFt<30000;
  }
  tick(state, pilotFrame={}, nowMs=Date.now()) {
    if(!this.enabled) return {active:false,reason:'MANUAL',commands:null};
    if(pilotFrame.override===true || pilotFrame.assistButtonPressed===true ||
       (Array.isArray(pilotFrame.axes) && pilotFrame.axes.some(x=>Math.abs(Number(x)||0)>this.deadzone))) {
      return this.disengage('PILOT_OVERRIDE');
    }
    if(!this.valid(state,nowMs)) return this.disengage('STALE_TELEMETRY');
    if(!state.airborne || state.onGround || state.altitudeAglFt<10)
      return this.disengage('GROUND_OR_LOW_ALTITUDE');
    const lim=Math.max(0,Math.min(0.5,this.maxDeflection));
    const headingError=((this.target.headingDeg-state.headingDeg+540)%360)-180;
    const altitudeError=this.target.altitudeAglFt-state.altitudeAglFt;
    const commands={
      cyclicPitch:clamp(-0.018*state.pitchDeg-0.015*state.pitchRateDegS,-lim,lim),
      cyclicRoll:clamp(-0.018*state.bankDeg-0.015*state.rollRateDegS,-lim,lim),
      pedals:clamp(0.008*headingError-0.025*state.yawRateDegS,-lim,lim),
      collectiveDelta:clamp(0.0008*altitudeError-0.00015*state.verticalSpeedFpm,-lim,lim),
    };
    return {active:true,reason:'STABILIZING',commands,target:{...this.target},
      warning:'Experimental uncalibrated outputs; do not inject until simulator validation.'};
  }
}
module.exports={HeliTakeover,REQUIRED};
