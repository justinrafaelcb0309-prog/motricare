import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/services/supabase';

export default function Account() {
  const [profile, setProfile] = useState<any>(null);
  const [editData, setEditData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const [cacheKey, setCacheKey] = useState(Date.now());
  const router = useRouter();

  useEffect(() => { getProfile(); }, []);

  async function getProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Consultamos la tabla 'usuario' buscando la columna 'url_foto'
      const { data: userData, error } = await supabase
        .from('usuario') 
        .select('*')
        .eq('id_us', user.id)
        .single();

      if (error) throw error;

      if (userData) {
        setProfile(userData);
        setEditData(userData);
        setCacheKey(Date.now());
      }
    } catch (e: any) {
      console.log("Error al cargar perfil:", e.message);
    } finally {
      setLoading(false);
    }
  }

  const handlePickAndUploadImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso denegado', 'Necesitamos acceso a tus fotos.');
          return;
        }
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (result.canceled) return;

      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const asset = result.assets[0];
      const fileExt = asset.uri.split('.').pop()?.toLowerCase();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;

      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: fileName,
        type: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
      } as any);

      // 1. SUBIDA AL BUCKET ESPECÍFICO: 'perfil_pacientes'
      const { error: uploadError } = await supabase.storage
        .from('perfil_pacientes')
        .upload(fileName, formData);

      if (uploadError) throw uploadError;

      // 2. ACTUALIZACIÓN EN TABLA 'usuario', COLUMNA 'url_foto'
      const { error: updateError } = await supabase
        .from('usuario')
        .update({ url_foto: fileName })
        .eq('id_us', user?.id);

      if (updateError) throw updateError;

      Alert.alert('¡Éxito!', 'Foto de perfil actualizada correctamente.');
      setCacheKey(Date.now());
      await getProfile(); 
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!profile) return;
    try {
      setLoading(true);
      
      // Actualizar datos en 'usuario'
      const { error: dbError } = await supabase
        .from('usuario')
        .update({
          us_nom: editData.us_nom,
          us_telefono: editData.us_telefono,
          us_fecha: editData.us_fecha,
        })
        .eq('id_us', profile.id_us);

      if (dbError) throw dbError;

      // Cambio de contraseña opcional
      if (newPassword.length > 0) {
        if (newPassword.length < 6) {
          Alert.alert("Atención", "La contraseña debe tener al menos 6 caracteres.");
          setLoading(false);
          return;
        }
        const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
        if (authError) throw authError;
        setNewPassword('');
      }

      setProfile(editData);
      setIsEditing(false);
      Alert.alert("Éxito", "Perfil actualizado");
      getProfile();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !profile) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#9b1b6e" size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headerTitle}>Mi Perfil</Text>
      
      <View style={styles.avatarContainer}>
        {uploading ? (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <ActivityIndicator color="#9b1b6e" />
          </View>
        ) : (
          <Image 
            key={cacheKey} 
            source={profile?.url_foto 
              ? { uri: `https://qhrennyqjhngysortocu.supabase.co/storage/v1/object/public/perfil_pacientes/${profile.url_foto}?t=${cacheKey}` } 
              : require('../../assets/images/icon.png')}
            style={styles.avatar} 
          />
        )}
        {!isEditing && (
          <TouchableOpacity onPress={handlePickAndUploadImage}>
            <Text style={styles.editPhotoText}>Cambiar Foto</Text>
          </TouchableOpacity>
        )}
      </View>

      {isEditing ? (
        <View style={styles.cardEdit}>
          <Text style={styles.cardHeader}>MODO EDICIÓN</Text>
          <Text style={styles.label}>Nombre:</Text>
          <TextInput style={styles.inputEdit} value={editData.us_nom} onChangeText={(t) => setEditData({...editData, us_nom: t})} />
          <Text style={styles.label}>Fecha Nacimiento:</Text>
          <TextInput style={styles.inputEdit} value={editData.us_fecha} onChangeText={(t) => setEditData({...editData, us_fecha: t})} />
          <Text style={styles.label}>Teléfono:</Text>
          <TextInput style={styles.inputEdit} value={editData.us_telefono} keyboardType="phone-pad" onChangeText={(t) => setEditData({...editData, us_telefono: t})} />
          
          <View style={styles.divider} />
          <Text style={styles.label}>Nueva Contraseña:</Text>
          <TextInput style={styles.inputEdit} value={newPassword} secureTextEntry onChangeText={setNewPassword} placeholder="Dejar vacío para no cambiar" placeholderTextColor="#a37492" />

          <View style={styles.row}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateProfile}><Text style={styles.btnTextWhite}>Guardar Todo</Text></TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setIsEditing(false); setNewPassword(''); }}><Text style={styles.btnTextWhite}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>NOMBRE COMPLETO</Text>
          <Text style={styles.value}>{profile?.us_nom}</Text>
          <Text style={styles.label}>TELÉFONO</Text>
          <Text style={styles.value}>{profile?.us_telefono || 'No registrado'}</Text>
          <Text style={styles.label}>FECHA DE NACIMIENTO</Text>
          <Text style={styles.value}>{profile?.us_fecha || 'No registrada'}</Text>
          <TouchableOpacity style={styles.editBtn} onPress={() => { setIsEditing(true); setEditData(profile || {}); }}>
            <Text style={styles.editBtnText}>Editar Datos Personales</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity 
  style={styles.logoutBtn} 
  onPress={() => 
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Cerrar Sesión', 
          style: 'destructive',
          onPress: () => supabase.auth.signOut().then(() => router.replace('/login'))
        },
      ]
    )
  }
>
  <Text style={styles.logoutText}>Cerrar Sesión Segura</Text>
</TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#FFFFFF', padding: 25, paddingTop: 60, paddingBottom: 100 },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: '#3d0030', marginBottom: 20 },
  avatarContainer: { alignItems: 'center', marginBottom: 30 },
  avatar: { width: 140, height: 140, borderRadius: 70, borderWidth: 3, borderColor: '#9b1b6e' },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#fce4f3' },
  editPhotoText: { color: '#9b1b6e', marginTop: 10, fontWeight: 'bold' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 15, padding: 20, borderWidth: 1, borderColor: '#e8a0d0' },
  cardEdit: { backgroundColor: '#FFFFFF', borderRadius: 15, padding: 20, borderWidth: 1, borderColor: '#9b1b6e' },
  cardHeader: { color: '#9b1b6e', fontSize: 11, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  label: { color: '#888888', fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
  value: { color: '#3d0030', fontSize: 18, marginBottom: 15 },
  inputEdit: { backgroundColor: '#fce4f3', color: '#3d0030', padding: 12, borderRadius: 8, marginBottom: 15, fontSize: 16, borderWidth: 1, borderColor: '#e8a0d0' },
  divider: { height: 1, backgroundColor: '#fce4f3', marginVertical: 10 },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  saveBtn: { flex: 1.2, backgroundColor: '#9b1b6e', padding: 15, borderRadius: 10, alignItems: 'center' },
  cancelBtn: { flex: 0.8, backgroundColor: '#888888', padding: 15, borderRadius: 10, alignItems: 'center' },
  editBtn: { borderTopWidth: 1, borderTopColor: '#fce4f3', paddingTop: 15, alignItems: 'center' },
  editBtnText: { color: '#9b1b6e', fontWeight: 'bold' },
  btnTextWhite: { fontWeight: 'bold', color: 'white', fontSize: 15 },
  logoutBtn: { padding: 18, borderRadius: 12, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#3d0030', marginTop: 40 },
  logoutText: { color: '#ff4d4d', fontWeight: 'bold', fontSize: 16 },
});