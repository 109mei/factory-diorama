import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {createFactoryAudio,type FactoryAudioState} from '../src/audio';
import {AUDIO_LIMITS} from '../src/audio-policy';
import {createGame} from '../src/simulation';

class FakeParam {
 value=0;events:{method:string;value:number;time:number}[]=[];
 setValueAtTime(value:number,time:number){this.value=value;this.events.push({method:'set',value,time});return this;}
 setTargetAtTime(value:number,time:number,_constant:number){this.value=value;this.events.push({method:'target',value,time});return this;}
 linearRampToValueAtTime(value:number,time:number){this.value=value;this.events.push({method:'ramp',value,time});return this;}
 cancelScheduledValues(_time:number){return this;}
 cancelAndHoldAtTime(_time:number){return this;}
}
class FakeNode {
 connections:FakeNode[]=[];disconnected=false;
 gain=new FakeParam();frequency=new FakeParam();Q=new FakeParam();pan=new FakeParam();playbackRate=new FakeParam();threshold=new FakeParam();ratio=new FakeParam();knee=new FakeParam();attack=new FakeParam();release=new FakeParam();
 type='';curve:Float32Array|null=null;oversample='';buffer:unknown;loop=false;onended:(()=>void)|null=null;starts:number[]=[];stops:number[]=[];
 constructor(readonly kind:string,readonly ctx:FakeContext){}
 connect(node:FakeNode){this.connections.push(node);return node;}
 disconnect(){this.disconnected=true;}
 start(time=0){this.starts.push(time);}
 stop(time=0){this.stops.push(time);if(time<=this.ctx.currentTime)this.onended?.();}
}
class FakeContext {
 static instances:FakeContext[]=[];static failConstruct=false;static failResume=false;static failSuspend=false;static pendingResume:false|(()=>void)=false;static deferResume=false;static deferredResumes:{resolve:()=>void;reject:(reason:Error)=>void}[]=[];
 currentTime=0;sampleRate=8000;state:'suspended'|'running'|'closed'='suspended';nodes:FakeNode[]=[];destination=new FakeNode('destination',this);onstatechange:(()=>void)|null=null;closeCalls=0;suspendCalls=0;resumeCalls=0;
 constructor(){if(FakeContext.failConstruct)throw Error('no audio');FakeContext.instances.push(this);}
 node(kind:string){const node=new FakeNode(kind,this);this.nodes.push(node);return node;}
 createGain(){return this.node('gain');}createOscillator(){return this.node('oscillator');}createBufferSource(){return this.node('buffer');}createBiquadFilter(){return this.node('filter');}createStereoPanner(){return this.node('panner');}createDynamicsCompressor(){return this.node('compressor');}createWaveShaper(){return this.node('shaper');}
 createBuffer(channels:number,length:number,sampleRate:number){const data=Array.from({length:channels},()=>new Float32Array(length));return {duration:length/sampleRate,length,sampleRate,numberOfChannels:channels,getChannelData:(channel:number)=>data[channel]};}
 async resume(){this.resumeCalls++;if(FakeContext.failResume)throw Error('gesture required');if(FakeContext.deferResume)await new Promise<void>((resolve,reject)=>{FakeContext.pendingResume=resolve;FakeContext.deferredResumes.push({resolve,reject});});if(this.state!=='closed')this.state='running';this.onstatechange?.();}
 async suspend(){this.suspendCalls++;if(FakeContext.failSuspend)throw Error('lost device');if(this.state!=='closed')this.state='suspended';this.onstatechange?.();}
 async close(){this.closeCalls++;this.state='closed';this.onstatechange?.();}
 advance(dt:number){this.currentTime+=dt;for(const source of this.nodes)if(source.stops.some(t=>t<=this.currentTime))source.onended?.();}
}
let active=true;
beforeEach(()=>{vi.useFakeTimers();active=true;FakeContext.instances=[];FakeContext.failConstruct=false;FakeContext.failResume=false;FakeContext.failSuspend=false;FakeContext.deferResume=false;FakeContext.pendingResume=false;FakeContext.deferredResumes=[];vi.stubGlobal('AudioContext',FakeContext);vi.stubGlobal('navigator',{userActivation:{get isActive(){return active;}}});});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
const lastContext=()=>FakeContext.instances.at(-1)!;
const sounds=(ctx:FakeContext)=>ctx.nodes.filter(node=>node.kind==='oscillator'||node.kind==='buffer');

describe('gesture-gated procedural factory audio',()=>{
 it('constructs nothing on load, saved intent, updates, visibility, volume, or setEnabled',async()=>{
  const audio=createFactoryAudio({enabled:true,volume:.25});
  expect(audio.getState().status).toBe('waiting');audio.update(createGame(),.1);audio.setVolume(.8);audio.setHidden(true);audio.setHidden(false);expect(await audio.setEnabled(true)).toBe(false);
  expect(FakeContext.instances).toHaveLength(0);audio.dispose();
 });
 it('requires an active gesture when the browser exposes user activation',async()=>{
  const audio=createFactoryAudio({enabled:false,volume:.25});active=false;
  expect(await audio.enableFromGesture()).toBe(false);expect(FakeContext.instances).toHaveLength(0);
  active=true;expect(await audio.enableFromGesture()).toBe(true);expect(FakeContext.instances).toHaveLength(1);expect(audio.getState().status).toBe('running');audio.dispose();
 });
 it('creates one graph on repeated gestures and exposes copies of preferences',async()=>{
  const changes:FactoryAudioState[]=[];const audio=createFactoryAudio({enabled:false,volume:.25},state=>changes.push(state));
  expect(await audio.enableFromGesture()).toBe(true);expect(await audio.enableFromGesture()).toBe(true);expect(FakeContext.instances).toHaveLength(1);
  const copy=audio.getPreferences();copy.enabled=false;expect(audio.getPreferences().enabled).toBe(true);expect(changes.at(-1)?.status).toBe('running');audio.dispose();
 });
 it('handles missing API, construction failure and resume rejection without throwing',async()=>{
  vi.stubGlobal('AudioContext',undefined);let audio=createFactoryAudio({enabled:false,volume:.25});expect(await audio.enableFromGesture()).toBe(false);expect(audio.getState().status).toBe('unavailable');audio.dispose();
  vi.stubGlobal('AudioContext',FakeContext);FakeContext.failConstruct=true;audio=createFactoryAudio({enabled:false,volume:.25});expect(await audio.enableFromGesture()).toBe(false);expect(audio.getState().status).toBe('unavailable');audio.dispose();
  FakeContext.failConstruct=false;FakeContext.failResume=true;audio=createFactoryAudio({enabled:false,volume:.25});expect(await audio.enableFromGesture()).toBe(false);expect(audio.getState().status).toBe('unavailable');
  FakeContext.failResume=false;expect(await audio.enableFromGesture()).toBe(true);audio.dispose();
 });
 it('clamps volume and ramps a bounded master without re-enabling muted intent',async()=>{
  const audio=createFactoryAudio({enabled:false,volume:.25});await audio.enableFromGesture();const ctx=lastContext();
  const master=ctx.nodes.find(node=>node.kind==='gain'&&node.connections.some(target=>target.kind==='compressor'))!;
  expect(master).toBeDefined();expect(master.gain.events.some(event=>event.value>0&&event.method!=='set')).toBe(true);
  audio.setVolume(3);expect(audio.getPreferences().volume).toBe(1);expect(master.gain.value).toBeLessThanOrEqual(AUDIO_LIMITS.masterGain);
  audio.setVolume(-4);expect(audio.getPreferences().volume).toBe(0);expect(master.gain.value).toBe(0);
  audio.setVolume(NaN);expect(Number.isFinite(audio.getPreferences().volume)).toBe(true);
  const disabling=audio.setEnabled(false);await vi.runAllTimersAsync();await disabling;audio.setVolume(.7);expect(audio.getPreferences().enabled).toBe(false);expect(master.gain.value).toBe(0);audio.dispose();
 });
 it('routes every source through a bounded soft limiter and smooth finite event envelopes',async()=>{
  const audio=createFactoryAudio({enabled:false,volume:1});await audio.enableFromGesture();const ctx=lastContext(),state=createGame();audio.update(state,.1);state.ticks++;state.shipped++;ctx.advance(.2);audio.update(state,.2);
  const limiter=ctx.nodes.find(node=>node.kind==='shaper')!;expect(limiter?.curve).toBeInstanceOf(Float32Array);
  for(const value of limiter.curve!)expect(Math.abs(value)).toBeLessThanOrEqual(AUDIO_LIMITS.outputCeiling+.000001);
  const reaches=(node:FakeNode,target:FakeNode,seen=new Set<FakeNode>()):boolean=>{if(node===target)return true;if(seen.has(node))return false;seen.add(node);return node.connections.some(next=>reaches(next,target,seen));};
  for(const source of sounds(ctx))expect(reaches(source,limiter)).toBe(true);
  expect(sounds(ctx).some(node=>node.stops.length>0)).toBe(true);
  for(const node of ctx.nodes){for(const param of [node.gain,node.frequency,node.pan])for(const event of param.events)expect(Number.isFinite(event.value)).toBe(true);}
  for(const node of ctx.nodes.filter(node=>node.kind==='panner'))expect(Math.abs(node.pan.value)).toBeLessThanOrEqual(.4);
  audio.dispose();
 });
 it('drops catch-up and starts a fresh event baseline after hidden or muted periods',async()=>{
  const audio=createFactoryAudio({enabled:false,volume:.25});await audio.enableFromGesture();const state=createGame(),ctx=lastContext();audio.update(state,.1);const base=sounds(ctx).length;
  state.shipped=100;state.ticks=1000;audio.update(state,100);expect(sounds(ctx)).toHaveLength(base);
  state.shipped++;state.ticks++;ctx.advance(.2);audio.update(state,.2);expect(sounds(ctx).length).toBeGreaterThan(base);
  audio.setHidden(true);await vi.runAllTimersAsync();expect(ctx.state).toBe('suspended');const count=sounds(ctx).length;
  state.shipped+=100;state.ticks+=1000;audio.setHidden(false);await Promise.resolve();await Promise.resolve();audio.update(state,.1);expect(sounds(ctx)).toHaveLength(count);
  state.shipped++;state.ticks++;ctx.advance(.7);audio.update(state,.2);expect(sounds(ctx).length).toBeGreaterThan(count);
  audio.dispose();expect(vi.getTimerCount()).toBe(0);
 });
 it('limits active event voices, releases ended nodes and never schedules catch-up bursts',async()=>{
  const audio=createFactoryAudio({enabled:false,volume:.5});await audio.enableFromGesture();const state=createGame(),ctx=lastContext();audio.update(state,.1);
  for(let index=0;index<1000;index++){state.ticks++;state.shipped++;ctx.advance(.1);audio.update(state,.1);const eventSources=sounds(ctx).filter(node=>!node.loop&&node.stops.length>0&&!node.disconnected);expect(eventSources.length).toBeLessThanOrEqual(AUDIO_LIMITS.maxVoices*2);}
  expect(ctx.nodes.filter(node=>node.disconnected).length).toBeGreaterThan(100);audio.dispose();
 });
 it('silences a failed suspend, cancels timers on dispose, stops sources and closes exactly once',async()=>{
  const audio=createFactoryAudio({enabled:false,volume:.25});await audio.enableFromGesture();const ctx=lastContext();FakeContext.failSuspend=true;audio.setHidden(true);await vi.runAllTimersAsync();expect(audio.getState().status).toBe('unavailable');
  audio.dispose();audio.dispose();await Promise.resolve();expect(ctx.closeCalls).toBe(1);expect(vi.getTimerCount()).toBe(0);
  for(const source of sounds(ctx)){expect(source.stops.length).toBeGreaterThan(0);expect(source.disconnected).toBe(true);}
  expect(await audio.enableFromGesture()).toBe(false);
 });
 it('restores a faded bed after an external audio interruption without replaying missed production',async()=>{
  const audio=createFactoryAudio({enabled:false,volume:.25});await audio.enableFromGesture();const ctx=lastContext(),state=createGame();audio.update(state,.1);
  const master=ctx.nodes.find(node=>node.kind==='gain'&&node.connections.some(target=>target.kind==='compressor'))!;
  ctx.state='suspended';ctx.onstatechange?.();expect(master.gain.value).toBe(0);state.ticks+=1000;state.shipped+=100;
  const count=sounds(ctx).length;ctx.state='running';ctx.onstatechange?.();expect(master.gain.value).toBeGreaterThan(0);audio.update(state,.1);expect(sounds(ctx)).toHaveLength(count);audio.dispose();
 });
 it('caps event voices even when graph time is stalled and production updates keep arriving',async()=>{
  const audio=createFactoryAudio({enabled:false,volume:1});await audio.enableFromGesture();const ctx=lastContext(),state=createGame();audio.update(state,.1);
  for(let index=0;index<30;index++){state.ticks++;state.shipped++;audio.update(state,.3);}
  expect(sounds(ctx).filter(node=>node.stops.length>0&&!node.disconnected)).toHaveLength(AUDIO_LIMITS.maxVoices*2);audio.dispose();
 });
 it('keeps a linear bounded volume scale with zero exactly silent',async()=>{
  const audio=createFactoryAudio({enabled:false,volume:.25});await audio.enableFromGesture();const ctx=lastContext();
  const master=ctx.nodes.find(node=>node.kind==='gain'&&node.connections.some(target=>target.kind==='compressor'))!;
  expect(master.gain.value).toBeCloseTo(AUDIO_LIMITS.masterGain*.25);audio.setVolume(0);expect(master.gain.value).toBe(0);audio.dispose();
 });

 it('reports starting and retries synchronously from a later gesture despite a pending resume',async()=>{
  FakeContext.deferResume=true;const states:FactoryAudioState[]=[];const audio=createFactoryAudio({enabled:false,volume:.25},state=>states.push(state));
  const first=audio.enableFromGesture(),ctx=lastContext();
  expect(audio.getState().status).toBe('starting');expect(ctx.resumeCalls).toBe(1);
  FakeContext.deferResume=false;const second=audio.enableFromGesture();
  expect(ctx.resumeCalls).toBe(2);expect(FakeContext.instances).toHaveLength(1);
  expect(await second).toBe(true);expect(await first).toBe(false);expect(audio.getState().status).toBe('running');
  expect(states.some(state=>state.status==='starting')).toBe(true);expect(vi.getTimerCount()).toBe(0);audio.dispose();
 });
 it('bounds a hanging resume and reports unavailable while preserving retry intent',async()=>{
  FakeContext.deferResume=true;const audio=createFactoryAudio({enabled:false,volume:.25});const pending=audio.enableFromGesture();
  await vi.advanceTimersByTimeAsync(2499);expect(audio.getState().status).toBe('starting');
  await vi.advanceTimersByTimeAsync(1);expect(await pending).toBe(false);expect(audio.getState().status).toBe('unavailable');expect(audio.getPreferences().enabled).toBe(true);expect(vi.getTimerCount()).toBe(0);
  FakeContext.deferResume=false;expect(await audio.enableFromGesture()).toBe(true);expect(audio.getState().status).toBe('running');audio.dispose();
 });
 it('keeps stale completion and the old timeout from overriding a successful retry',async()=>{
  FakeContext.deferResume=true;const audio=createFactoryAudio({enabled:false,volume:.25});const first=audio.enableFromGesture(),older=FakeContext.deferredResumes[0];
  await vi.advanceTimersByTimeAsync(2400);FakeContext.deferResume=false;expect(await audio.enableFromGesture()).toBe(true);expect(await first).toBe(false);
  older.resolve();await Promise.resolve();await Promise.resolve();await vi.advanceTimersByTimeAsync(3000);
  expect(audio.getState().status).toBe('running');expect(vi.getTimerCount()).toBe(0);audio.dispose();
 });
 it('ignores a stale rejection after a newer gesture successfully starts audio',async()=>{
  FakeContext.deferResume=true;const audio=createFactoryAudio({enabled:false,volume:.25});const first=audio.enableFromGesture(),older=FakeContext.deferredResumes[0];
  FakeContext.deferResume=false;expect(await audio.enableFromGesture()).toBe(true);expect(await first).toBe(false);
  older.reject(new Error('old gesture rejected'));await Promise.resolve();await Promise.resolve();
  expect(audio.getState().status).toBe('running');expect(vi.getTimerCount()).toBe(0);audio.dispose();
 });
 it('keeps timed-out attempts silent even if their browser promise later completes',async()=>{
  FakeContext.deferResume=true;const audio=createFactoryAudio({enabled:false,volume:.25});const pending=audio.enableFromGesture(),ctx=lastContext();
  await vi.advanceTimersByTimeAsync(2500);expect(await pending).toBe(false);FakeContext.deferredResumes[0].resolve();await Promise.resolve();await Promise.resolve();
  const master=ctx.nodes.find(node=>node.kind==='gain'&&node.connections.some(target=>target.kind==='compressor'))!;
  expect(audio.getState().status).toBe('unavailable');expect(master.gain.value).toBe(0);expect(vi.getTimerCount()).toBe(0);audio.dispose();
 });
 it('settles pending retries and clears every timer on disposal without resurrection',async()=>{
  FakeContext.deferResume=true;const audio=createFactoryAudio({enabled:false,volume:.25});const first=audio.enableFromGesture(),second=audio.enableFromGesture(),ctx=lastContext();
  expect(ctx.resumeCalls).toBe(2);expect(vi.getTimerCount()).toBe(1);audio.dispose();expect(vi.getTimerCount()).toBe(0);
  expect(await first).toBe(false);expect(await second).toBe(false);
  for(const deferred of FakeContext.deferredResumes)deferred.resolve();await Promise.resolve();await Promise.resolve();
  expect(audio.getState().status).toBe('off');expect(ctx.state).toBe('closed');expect(ctx.closeCalls).toBe(1);expect(vi.getTimerCount()).toBe(0);
 });

 it('does not resurrect sound when disable or dispose wins a pending resume',async()=>{
  FakeContext.deferResume=true;const audio=createFactoryAudio({enabled:false,volume:.25});const pending=audio.enableFromGesture();const ctx=lastContext();
  const disabling=audio.setEnabled(false);await vi.runAllTimersAsync();await disabling;
  if(FakeContext.pendingResume)FakeContext.pendingResume();await pending;await vi.runAllTimersAsync();expect(audio.getState().status).toBe('off');
  const master=ctx.nodes.find(node=>node.kind==='gain'&&node.connections.some(target=>target.kind==='compressor'))!;expect(master.gain.value).toBe(0);
  FakeContext.deferResume=false;await audio.enableFromGesture();audio.dispose();expect(ctx.state).toBe('closed');expect(vi.getTimerCount()).toBe(0);
 });
});
