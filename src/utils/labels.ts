import type { AssetType } from '../domain/types';
export const sectorMap:Record<string,string>={Banks:'Bancos',Retail:'Varejo',Industrial:'Industrial','Real Estate':'Imobiliário',Health:'Saúde',Insurance:'Seguros',Energy:'Energia',Commodities:'Commodities',Consumer:'Consumo',Agro:'Agro','Auto Parts':'Autopeças',International:'Internacional','Financial Infrastructure':'Infraestrutura Financeira',Education:'Educação','Financial Services':'Serviços Financeiros',Airlines:'Aéreo'};
export const getSectorLabel=(s:string)=>sectorMap[s]??s;
export const getAssetTypeLabel=(t:AssetType|'TODOS')=>t;
export const getRecommendationLabel=(score:number)=>score>=88?'Forte Compra':score>=80?'Compra Gradual':score>=72?'Boa':score>=65?'Neutra':'Evitar por Agora';