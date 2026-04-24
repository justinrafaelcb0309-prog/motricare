import { useRouter } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Welcome() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/images/icon.png')} style={styles.logo} />
      
      <Text style={styles.title}>MotriCare</Text>
      <Text style={styles.tagline}>Tu terapia física al alcance de tu mano</Text>

      {/* Botón Principal */}
      <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push('/(auth)/login' as any)}>
        <Text style={styles.btnText}>Iniciar Sesión</Text>
      </TouchableOpacity>

      {/* Botón Secundario */}
      <TouchableOpacity style={styles.btnSecondary} onPress={() => router.push('/(auth)/register' as any)}>
        <Text style={[styles.btnText, { color: '#9b1b6e' }]}>Crear Cuenta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#ffffff', // --color-white
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 30 
  },
  logo: { 
    width: 120, 
    height: 120, 
    marginBottom: 120, 
    borderColor: '#9b1b6e', // --color-primary
    borderWidth: 2, 
    borderRadius: 60 
  },
  title: { 
    fontSize: 36, 
    fontWeight: 'bold', 
    color: '#3d0030', // --color-text-dark (Púrpura muy oscuro para elegancia)
    marginBottom: 10 
  },
  tagline: { 
    fontSize: 16, 
    color: '#888888', // Gris medio (Texto secundario) 
    textAlign: 'center', 
    marginBottom: 50 
  },
  btnPrimary: { 
    width: '100%', 
    backgroundColor: '#9b1b6e', // --color-primary
    padding: 18, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginBottom: 15,
    // Sombra sutil para que resalte el nuevo color
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  btnSecondary: { 
    width: '100%', 
    borderWidth: 2, 
    borderColor: '#9b1b6e', // --color-primary
    backgroundColor: '#fce4f3', // --color-primary-lt (Un toque de rosa muy claro de fondo)
    padding: 18, 
    borderRadius: 12, 
    alignItems: 'center' 
  },
  btnText: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#ffffff' // Texto en blanco 
  },
});