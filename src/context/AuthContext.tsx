import React, {createContext, useState, useEffect, useContext} from 'react';
import{Session, User} from '@supabase/supabase-js';
import {supabase} from '../services/supabase';

type AuthProps={
    user: User | null;
    session:Session | null;
    initialized:boolean;
};

export const AuthContext= createContext<Partial<AuthProps>>({});

export function useAuth(){
    return useContext(AuthContext);
}

export const AuthProvider = ({children}: {children:React.ReactNode})=>{
    const[user, setUser]=useState<User | null>(null);
    const[session, setSession]=useState<Session | null>(null);
    const[initialized, setIniatlized]=useState<boolean>(false);

    useEffect(()=>{
        const fetchSession=async()=>{
            const{data}=await supabase.auth.getSession();
            setSession(data.session);
            setUser(data.session?.user || null);
            setIniatlized(true);
        };

        fetchSession();

        const{data: authListener}=supabase.auth.onAuthStateChange(
            async(_event, session)=>{
                setSession(session);
                setUser(session?.user || null);
            }
        );
        return()=>{
            authListener.subscription.unsubscribe();
        };
    },[]);

    return(
        <AuthContext.Provider value={{user, session, initialized}}>
            {children}
        </AuthContext.Provider>
    );
};