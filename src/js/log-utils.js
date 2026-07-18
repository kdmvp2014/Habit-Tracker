import { S, save } from './state.js';
import { fmtDate } from './date-utils.js';

// ── LOG UTILS ─────────────────────────────────────────────
export function isLogged(hid,ds){return!!(S.logs[ds]&&S.logs[ds][hid]);}
export function toggleLog(hid,ds){if(!S.logs[ds])S.logs[ds]={};S.logs[ds][hid]=!S.logs[ds][hid];save();}
export function getStreak(hid){let n=0;const d=new Date();while(true){if(isLogged(hid,fmtDate(d)))n++;else break;d.setDate(d.getDate()-1);}return n;}
