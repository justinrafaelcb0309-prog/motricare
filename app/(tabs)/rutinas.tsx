import React, { useEffect, useState } from 'react';
import { supabase } from '../../src/services/supabase';
import { Image, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

//Tipos de Typescript
type Rutina = {
  id_rut: string;
  rut_nom: string;
  rut_desc: string;
  rut_zona:string;
  rut_objetivo:string;
  rut_img:string;
};
type CategoriaRutina = {
  zona: string;
  rutinas: Rutina[];
}

export default function RutinasScreen() {
  const router=useRouter();
  const [catalogo, setCatalogo] = useState<CategoriaRutina[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchRutinas();
    const suscripcion=supabase
    .channel('mis-rutinas-en-vivo')
    .on(
      'postgres_changes',
      {
        event:'*',
        schema:'public',
        table:'rutina'
      },
      (payload)=>{
        console.log('¡Cambio detectado en supabase!', payload);
        fetchRutinas();
      }
    )
    .subscribe();
    return()=>{
      supabase.removeChannel(suscripcion);
    };
  }, []);

  const fetchRutinas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rutina')
        .select('*')
        .eq('es_publica', 'Pública');
      if (error) throw error;
      if (data) {
        const rutinasAgrupadas=data.reduce((acumulador:CategoriaRutina[], rutinaActual:Rutina)=>{
          const zonaExistente=acumulador.find(item=>item.zona===rutinaActual.rut_zona);
          if(zonaExistente){
            zonaExistente.rutinas.push(rutinaActual);
          }else{
            acumulador.push({
              zona:rutinaActual.rut_zona || 'Sin clasificar',
              rutinas:[rutinaActual]
            });
          }
          return acumulador;
        },[]);
        setCatalogo(rutinasAgrupadas);
      }
    } catch (error) {
      console.error('Error al descargar el catalogo:', error);
    } finally {
      setLoading(false);
    }
  };
  const renderRutina = ({ item }: { item: Rutina }) => (
    <TouchableOpacity style={styles.tarjeta} 
      onPress={()=>router.push(`/rutina/${item.id_rut}` as any)}>
      <Image
        source={{uri:item.rut_img || 'https://via.placeholder.com/150'}}
        style={styles.imagenRutina}
        resizeMode="cover"
      ></Image>
      <View style={styles.contenidoTarjeta}>
      <View style={styles.tarjetaHeader}>
        <Text style={styles.nivelTexto}>{item.rut_objetivo || 'rehabilitacion'}</Text>
      </View>
      <Text style={styles.tituloRutina} numberOfLines={2}>{item.rut_nom}</Text>
      {item.rut_desc ? (
        <Text style={styles.descripcionTexto} numberOfLines={2}>{item.rut_desc}</Text>
      ):null}
      </View>
    </TouchableOpacity>
  );

  if(loading){
    return(
      <View style={[styles.container, {justifyContent:'center', alignItems:'center'}]}>
        <ActivityIndicator size="large" color="#007AAFF"/>
        <Text style={{marginTop:10, color:'#666'}}>Cargando categorias...</Text>
      </View>
    );
  }

  if(!loading && catalogo.length===0){
    return(
      <View style={[styles.container, {justifyContent:'center', alignItems:'center'}]}>
        <Text style={{color:'#666', fontSize:16}}>Aun no hay rutinas registradas</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.tituloPantalla}>Catálogo de Rutinas</Text>

      {/* Recorremos cada categoría y creamos su sección */}
      {catalogo.map((categoria, index) => (
          <View key={index.toString()} style={styles.seccionContainer}>
          <Text style={styles.tituloSeccion}>{categoria.zona}</Text>

          <FlatList
            data={categoria.rutinas}
            renderItem={renderRutina}
            keyExtractor={(item) => item.id_rut}
            horizontal={true} // Hace que las tarjetas se deslicen de lado
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listaTarjetas}
          />
        </View>
      ))}

      {/* Espacio extra al final para que no quede pegado a la barra de tabs */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdebf7', // Fondo suave
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  tituloPantalla: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3d0030', // Texto oscuro
    marginBottom: 20,
  },
  seccionContainer: {
    marginBottom: 25,
  },
  tituloSeccion: {
    fontSize: 20,
    fontWeight: '600',
    color: '#9b1b6e', // Primary
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  listaTarjetas: {
    paddingRight: 20,
  },
  tarjeta: {
    backgroundColor: '#ffffff', // Blanco
    width: 200,
    borderRadius: 15,
    marginRight: 15,
    // Sombras personalizadas con tu RGBA
    shadowColor: 'rgba(155, 27, 110, 0.2)', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1, // Se pone en 1 porque la opacidad ya viene en tu RGBA
    shadowRadius: 8,
    elevation: 4, // Para Android
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fce4f3', // Primary light para darle un borde sutil
  },
  imagenRutina: {
    width: '100%',
    height: 100,
    backgroundColor: '#fce4f3', // Primary light como fondo mientras carga la imagen
  },
  contenidoTarjeta: {
    padding: 12,
  },
  tarjetaHeader: {
    backgroundColor: '#fce4f3', // Primary Light
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  nivelTexto: {
    fontSize: 12,
    color: '#7a1254', // Primary Dark para alto contraste
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  tituloRutina: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3d0030', // Texto oscuro
    marginBottom: 4,
  },
  descripcionTexto: {
    fontSize: 12,
    color: '#c48aa9', // Texto secundario
    lineHeight: 16,
  },
});