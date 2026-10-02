import {STATIONS,type GameState} from './simulation';
import {AUDIO_LIMITS,createAudioEventTracker,factoryAudioActivity,normalizeAudioPreferences,type AudioPreferences,type FactoryAudioEvent} from './audio-policy';
export * from './audio-policy';

export interface FactoryAudioState {preferences:AudioPreferences;status:'off'|'waiting'|'starting'|'running'|'suspended'|'unavailable';}
export const AUDIO_RESUME_TIMEOUT_MS=2500;
interface ResumeAttempt {promise:Promise<boolean>;resolve:(started:boolean)=>void;timer:ReturnType<typeof setTimeout>|null;}
interface Voice {sources:AudioScheduledSourceNode[];nodes:AudioNode[];end:number;}
interface AudioGraph {
 master:GainNode;hum:GainNode;rolling:GainNode;rollSource:AudioBufferSourceNode;rollFilter:BiquadFilterNode;
 noise:AudioBuffer;nodes:Set<AudioNode>;sources:Set<AudioScheduledSourceNode>;voices:Set<Voice>;
}

function smooth(param:AudioParam,value:number,time:number,seconds=.12){
 // Hold the current automation value before replacing it, including rapid slider input.
 if(typeof param.cancelAndHoldAtTime==='function')param.cancelAndHoldAtTime(time);
 else {param.cancelScheduledValues(time);param.setValueAtTime(param.value,time);}
 param.linearRampToValueAtTime(value,time+seconds);
}
function variation(seed:number){const value=Math.sin(seed*127.1+311.7)*43758.5453;return value-Math.floor(value);}

/** Locally synthesized, long, seamless colored noise; never downloads an audio asset. */
function makeNoise(ctx:AudioContext):AudioBuffer {
 const seconds=23,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*seconds),ctx.sampleRate),data=buffer.getChannelData(0);
 let pink=0,slow=0;
 for(let index=0;index<data.length;index++){
  const white=Math.random()*2-1;pink=.965*pink+.035*white;slow=.998*slow+.002*white;
  data[index]=Math.max(-1,Math.min(1,(pink-slow)*3.5));
 }
 // Join to the initial sample with zero slope, avoiding an impulse at the loop boundary.
 const tail=Math.min(Math.floor(ctx.sampleRate*.2),data.length),start=data.length-tail,first=data[0];
 for(let index=0;index<tail;index++){const t=index/(tail-1),blend=t*t*(3-2*t);data[start+index]=data[start+index]*(1-blend)+first*blend;}
 return buffer;
}
function buildGraph(ctx:AudioContext):AudioGraph {
 const nodes=new Set<AudioNode>(),sources=new Set<AudioScheduledSourceNode>();
 const own=<T extends AudioNode>(node:T):T=>{nodes.add(node);return node;};
 const master=own(ctx.createGain()),compressor=own(ctx.createDynamicsCompressor()),limiter=own(ctx.createWaveShaper());
 master.gain.value=0;compressor.threshold.value=-20;compressor.knee.value=16;compressor.ratio.value=4;compressor.attack.value=.018;compressor.release.value=.35;
 const curve=new Float32Array(4097);for(let index=0;index<curve.length;index++){const x=index/(curve.length-1)*2-1;curve[index]=AUDIO_LIMITS.outputCeiling*Math.tanh(x/AUDIO_LIMITS.outputCeiling);}
 limiter.curve=curve;limiter.oversample='2x';master.connect(compressor);compressor.connect(limiter);limiter.connect(ctx.destination);
 const hum=own(ctx.createGain());hum.gain.value=.025;hum.connect(master);
 for(const [frequency,gain] of [[57,.67],[86.7,.33]]){
  const oscillator=own(ctx.createOscillator()),balance=own(ctx.createGain());oscillator.type='sine';oscillator.frequency.value=frequency;balance.gain.value=gain;
  oscillator.connect(balance);balance.connect(hum);sources.add(oscillator);oscillator.start();
 }
 const noise=makeNoise(ctx),rollSource=own(ctx.createBufferSource()),rollFilter=own(ctx.createBiquadFilter()),highpass=own(ctx.createBiquadFilter()),rolling=own(ctx.createGain()),pan=own(ctx.createStereoPanner());
 rollSource.buffer=noise;rollSource.loop=true;rollSource.playbackRate.value=.83;
 highpass.type='highpass';highpass.frequency.value=90;highpass.Q.value=.45;rollFilter.type='lowpass';rollFilter.frequency.value=700;rollFilter.Q.value=.45;
 rolling.gain.value=0;pan.pan.value=-.08;rollSource.connect(highpass);highpass.connect(rollFilter);rollFilter.connect(rolling);rolling.connect(pan);pan.connect(master);sources.add(rollSource);rollSource.start(0,Math.random()*noise.duration);
 return {master,hum,rolling,rollSource,rollFilter,noise,nodes,sources,voices:new Set()};
}
function releaseVoice(graph:AudioGraph,voice:Voice,stop=false){
 if(!graph.voices.delete(voice))return;
 for(const source of voice.sources){source.onended=null;if(stop){try{source.stop();}catch{/* A source may have already ended. */}}graph.sources.delete(source);}
 for(const node of voice.nodes){node.disconnect();graph.nodes.delete(node);}
}
function clearVoices(graph:AudioGraph){for(const voice of [...graph.voices])releaseVoice(graph,voice,true);}
function playEvent(ctx:AudioContext,graph:AudioGraph,event:FactoryAudioEvent){
 for(const voice of [...graph.voices])if(voice.end<=ctx.currentTime)releaseVoice(graph,voice);
 if(graph.voices.size>=AUDIO_LIMITS.maxVoices)return;
 const stage=STATIONS.indexOf(event.station),v=variation(event.seed+stage*37),start=ctx.currentTime,end=start+.48+v*.2;
 const oscillator=ctx.createOscillator(),texture=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),toneGain=ctx.createGain(),textureGain=ctx.createGain(),envelope=ctx.createGain(),pan=ctx.createStereoPanner();
 const nodes:AudioNode[]=[oscillator,texture,filter,toneGain,textureGain,envelope,pan],sources:AudioScheduledSourceNode[]=[oscillator,texture];
 const voice:Voice={sources,nodes,end};for(const node of nodes)graph.nodes.add(node);for(const source of sources)graph.sources.add(source);graph.voices.add(voice);
 oscillator.type='sine';oscillator.frequency.setValueAtTime((76+stage*19)*(1+(v-.5)*.08),start);oscillator.frequency.linearRampToValueAtTime((67+stage*18)*(1+(v-.5)*.06),end);
 texture.buffer=graph.noise;texture.playbackRate.value=.78+v*.25;filter.type='lowpass';filter.frequency.value=[300,420,840,520,270,670,750][stage];filter.Q.value=.45;
 toneGain.gain.value=.55;textureGain.gain.value=.45;envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(AUDIO_LIMITS.eventPeak*(.8+.2*v),start+.055);envelope.gain.linearRampToValueAtTime(AUDIO_LIMITS.eventPeak*.22,start+.2);envelope.gain.linearRampToValueAtTime(0,end);
 pan.pan.value=(stage-3)*.07+(v-.5)*.08;
 oscillator.connect(toneGain);toneGain.connect(envelope);texture.connect(filter);filter.connect(textureGain);textureGain.connect(envelope);envelope.connect(pan);pan.connect(graph.master);
 let ended=0;for(const source of sources)source.onended=()=>{if(++ended===sources.length)releaseVoice(graph,voice);};
 oscillator.start(start);texture.start(start,v*(graph.noise.duration-1));oscillator.stop(end+.015);texture.stop(end+.015);
}

/**
 * Owns one lazy Web Audio graph. Call enableFromGesture directly in a trusted
 * interaction handler. Restored preferences alone never construct a context.
 * The owner forwards visibility/renderer availability and persists preferences.
 */
export function createFactoryAudio(initial:AudioPreferences,onStateChange?:(state:FactoryAudioState)=>void){
 let preferences=normalizeAudioPreferences(initial),context:AudioContext|null=null,graph:AudioGraph|null=null;
 let hidden=false,disposed=false,authorized=false,failed=false,resuming:ResumeAttempt|null=null;
 let suspendTimer:ReturnType<typeof setTimeout>|null=null,finishSuspend:((value:boolean)=>void)|null=null;
 const tracker=createAudioEventTracker();let motionTime=0;
 const wanted=()=>!disposed&&!hidden&&preferences.enabled;
 function getState():FactoryAudioState {
  return {preferences:{...preferences},status:disposed||!preferences.enabled?'off':failed?'unavailable':!context?'waiting':resuming?'starting':hidden||context.state!=='running'?'suspended':'running'};
 }
 function notify(){try{onStateChange?.(getState());}catch{/* UI callbacks cannot break the audio lifecycle. */}}
 function cancelSuspend(){if(suspendTimer!==null){clearTimeout(suspendTimer);suspendTimer=null;}finishSuspend?.(false);finishSuspend=null;}
 function masterTarget(){if(graph&&context)smooth(graph.master.gain,wanted()&&context.state==='running'&&!failed&&!resuming?preferences.volume*AUDIO_LIMITS.masterGain:0,context.currentTime,.18);}
 function unavailable(){failed=true;tracker.reset();if(graph&&context)smooth(graph.master.gain,0,context.currentTime,.08);notify();}
 function suspendAfterFade():Promise<boolean>{
  cancelSuspend();tracker.reset();if(!context||!graph){notify();return Promise.resolve(false);}
  smooth(graph.master.gain,0,context.currentTime,.08);const ctx=context;
  return new Promise(resolve=>{
   finishSuspend=resolve;
   suspendTimer=setTimeout(()=>{
    suspendTimer=null;finishSuspend=null;
    if(disposed||wanted()){resolve(false);return;}
    clearVoices(graph!);
    try{void ctx.suspend().then(()=>{notify();resolve(false);if(wanted())void resume();},()=>{unavailable();resolve(false);});}
    catch{unavailable();resolve(false);}
   },100);
  });
 }
 function settleResume(attempt:ResumeAttempt,started:boolean){
  if(resuming!==attempt)return;
  if(attempt.timer!==null)clearTimeout(attempt.timer);
  attempt.timer=null;resuming=null;attempt.resolve(started);
 }
 function cancelResume(){if(resuming)settleResume(resuming,false);}
 function resume(fromGesture=false):Promise<boolean>{
  cancelSuspend();if(!wanted()||!authorized||!context){notify();return Promise.resolve(false);}
  if(resuming&&!fromGesture)return resuming.promise;
  // Safari may leave an earlier, non-activating touch resume pending forever.
  // A later trusted gesture must make a new synchronous native resume call.
  cancelResume();const ctx=context;tracker.reset();failed=false;
  let resolve!:(started:boolean)=>void;
  const promise=new Promise<boolean>(done=>{resolve=done;});
  const attempt:ResumeAttempt={promise,resolve,timer:null};resuming=attempt;
  attempt.timer=setTimeout(()=>{
   if(resuming!==attempt||disposed)return;
   settleResume(attempt,false);unavailable();
  },AUDIO_RESUME_TIMEOUT_MS);
  notify();
  if(resuming!==attempt||!wanted())return promise;
  const reject=()=>{if(resuming===attempt&&!disposed){settleResume(attempt,false);unavailable();}};
  try {
   const pending=fromGesture||ctx.state!=='running'?ctx.resume():Promise.resolve();
   void pending.then(()=>{
    if(disposed)return;
    if(resuming!==attempt){if(!wanted())void suspendAfterFade();return;}
    if(!wanted()){settleResume(attempt,false);void suspendAfterFade();return;}
    if(ctx.state!=='running'){reject();return;}
    settleResume(attempt,true);failed=false;tracker.reset();masterTarget();notify();
   },reject);
  }catch{reject();}
  return promise;
 }
 function ensureContext():boolean {
  if(context)return context.state!=='closed';
  const Constructor=globalThis.AudioContext??(globalThis as typeof globalThis&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  if(!Constructor){unavailable();return false;}
  try {
   context=new Constructor();graph=buildGraph(context);
   context.onstatechange=()=>{if(disposed)return;if(context?.state!=='running'){tracker.reset();if(graph&&context)smooth(graph.master.gain,0,context.currentTime,.08);}else if(!wanted())void suspendAfterFade();else {tracker.reset();masterTarget();}notify();};
   return true;
  }catch{
   // A partially initialized graph must not leave a live audio device behind.
   if(context){void context.close().catch(()=>{});context=null;}graph=null;unavailable();return false;
  }
 }
 async function enableFromGesture():Promise<boolean>{
  if(disposed)return false;
  if(typeof navigator!=='undefined'&&navigator.userActivation?.isActive===false)return false;
  preferences={...preferences,enabled:true};authorized=true;failed=false;notify();
  if(hidden)return false;
  return ensureContext()?resume(true):false;
 }
 async function setEnabled(enabled:boolean):Promise<boolean>{
  if(disposed)return false;preferences={...preferences,enabled:enabled===true};failed=false;tracker.reset();notify();
  if(!preferences.enabled){cancelResume();return suspendAfterFade();}
  return resume();
 }
 function setVolume(volume:number){
  if(disposed)return;
  preferences={...preferences,volume:Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):preferences.volume};masterTarget();notify();
 }
 function setHidden(value:boolean){
  if(disposed||hidden===value)return;hidden=value;tracker.reset();
  if(hidden){cancelResume();void suspendAfterFade();}else void resume();notify();
 }
 function update(state:GameState,dt:number){
  if(disposed)return;
  if(!wanted()||!context||!graph||context.state!=='running'||failed||resuming){tracker.reset();return;}
  try {
   const events=tracker.update(state,dt),activity=factoryAudioActivity(state);
   if(Number.isFinite(dt)&&dt>0&&dt<=AUDIO_LIMITS.maxFrameGap)motionTime+=dt;
   // Incommensurate slow drift, rather than a metronome or repeating impact loop.
   const drift=.94+.04*Math.sin(motionTime*.113)+.02*Math.sin(motionTime*.071);
   smooth(graph.hum.gain,Math.min(AUDIO_LIMITS.humPeak,(.025+activity.working*.028)*drift),context.currentTime,.3);
   smooth(graph.rolling.gain,AUDIO_LIMITS.rollingPeak*Math.sqrt(activity.rolling)*drift,context.currentTime,.25);
   smooth(graph.rollSource.playbackRate,.83+.035*Math.sin(motionTime*.093),context.currentTime,.4);
   smooth(graph.rollFilter.frequency,590+210*activity.rolling+55*Math.sin(motionTime*.067),context.currentTime,.4);
   for(const event of events)playEvent(context,graph,event);
  }catch{unavailable();}
 }
 function dispose(){
  if(disposed)return;disposed=true;cancelResume();cancelSuspend();tracker.reset();
  if(graph){clearVoices(graph);for(const source of graph.sources){source.onended=null;try{source.stop();}catch{/* Already ended. */}}for(const node of graph.nodes)node.disconnect();graph.sources.clear();graph.nodes.clear();}
  if(context){context.onstatechange=null;try{void context.close().catch(()=>{});}catch{/* Device was already closed. */}}
  graph=null;notify();
 }
 return {getPreferences:()=>({...preferences}),getState,enableFromGesture,setEnabled,setVolume,setHidden,update,dispose};
}
