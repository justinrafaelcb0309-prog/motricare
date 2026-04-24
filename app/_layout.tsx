import {Slot, useRouter, useSegments} from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';

const InitialLayout=()=>{
  const{session, initialized}=useAuth();
  const segments=useSegments();
  const router=useRouter();

  useEffect(()=>{
    if(!initialized) return;
    const inAuthGroup=(segments[0] as string)==="(auth)";
    if(session && inAuthGroup){
      router.replace('/(tabs)/' as any);
    }else if(!session && !inAuthGroup){
      router.replace('/(auth)/welcome' as any);
    }

  }, [session, initialized, segments]);

  if(!initialized){
    return(
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#9b1b6e" />
      </View>
    );
  }

  return <Slot/>
};

export default function RootLayout(){
  return(
    <AuthProvider>
      <InitialLayout/>
    </AuthProvider>
  );
}