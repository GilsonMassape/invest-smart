import type { PropsWithChildren, ReactNode } from 'react';
interface CardProps extends PropsWithChildren{title:string;subtitle?:string;action?:ReactNode;}
export const Card=({title,subtitle,action,children}:CardProps)=><section className='card'><div className='card-header'><div><h2>{title}</h2>{subtitle?<p className='muted'>{subtitle}</p>:null}</div>{action}</div>{children}</section>;