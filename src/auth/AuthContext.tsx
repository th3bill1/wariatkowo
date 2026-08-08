import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { HouseholdMember } from '../../shared/models';
import { requestJson } from '../services/http';

type AuthContextValue = {
  member: HouseholdMember | null;
  members: HouseholdMember[];
  isLoading: boolean;
  login: (memberId: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  switchProfile: () => Promise<void>;
};
const AuthContext=createContext<AuthContextValue|null>(null);

export function AuthProvider({children}:{children:ReactNode}){
 const [member,setMember]=useState<HouseholdMember|null>(null);
 const [members,setMembers]=useState<HouseholdMember[]>([]);
 const [isLoading,setIsLoading]=useState(true);
 useEffect(()=>{void Promise.all([
   requestJson<HouseholdMember|null>('/api/auth/session'),
   requestJson<HouseholdMember[]>('/api/auth/members'),
 ]).then(([session,available])=>{setMember(session);setMembers(available);}).finally(()=>setIsLoading(false));},[]);
 const login=useCallback(async(memberId:string,pin:string)=>{
   setMember(await requestJson<HouseholdMember>('/api/auth/login',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({memberId,pin}),
   }));
 },[]);
 const logout=useCallback(async()=>{
   await requestJson('/api/auth/logout',{method:'POST'});setMember(null);
 },[]);
 const value=useMemo(()=>({member,members,isLoading,login,logout,switchProfile:logout}),[member,members,isLoading,login,logout]);
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth():AuthContextValue{
 const value=useContext(AuthContext);
 if(!value) throw new Error('useAuth must be used inside AuthProvider');
 return value;
}
