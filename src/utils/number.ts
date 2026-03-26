export const clamp=(v:number,min:number,max:number)=>Math.min(Math.max(v,min),max);
export const safeDivide=(n:number,d:number)=>!Number.isFinite(n)||!Number.isFinite(d)||d===0?0:n/d;
export const toMoney=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
export const toPercent=(v:number)=>`${v.toFixed(2).replace('.',',')}%`;