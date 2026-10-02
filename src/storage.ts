import {loadGame,SAVE_KEY,LEGACY_SAVE_KEY} from './save';
/** Read-only recovery. The caller persists the returned state under the v2 key. */
export function restoreGame(storage:Pick<Storage,'getItem'>,now:number):ReturnType<typeof loadGame>&{storageAvailable:boolean;usedLegacy:boolean} {
 try {
  const raw=storage.getItem(SAVE_KEY),primary=loadGame(raw,now);
  if(raw&&!primary.recovered)return {...primary,storageAvailable:true,usedLegacy:false};
  const legacyRaw=storage.getItem(LEGACY_SAVE_KEY),legacy=loadGame(legacyRaw,now);
  if(legacy.migrated&&!legacy.recovered)return {...legacy,storageAvailable:true,usedLegacy:true};
  return {...loadGame(null,now),recovered:!!(raw||legacyRaw),storageAvailable:true,usedLegacy:false};
 } catch {
  return {...loadGame(null,now),storageAvailable:false,usedLegacy:false};
 }
}
