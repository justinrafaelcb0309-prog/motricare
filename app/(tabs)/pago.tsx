import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { Calendar, DateData } from 'react-native-calendars';
import { WebView } from "react-native-webview";
import { supabase } from "../../src/services/supabase";

const STRIPE_CHECKOUT_URL = "https://stripe-checkout-ruby.vercel.app";

export default function AgendarCita() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [description, setDescription] = useState('');
  
  const [fisioterapeutas, setFisioterapeutas] = useState<any[]>([]);
  const [selectedFisio, setSelectedFisio] = useState<string | null>(null);

  const [visibleHistorial, setVisibleHistorial] = useState(false);
  const [historial, setHistorial] = useState({
    motivo_consulta: '',
    tiempo_padecimiento: '',
    zona_afectada: '',
    nivel_dolor_inicial: '',
    enfermedades_cronicas: '',
    cirugias_previas: '',
    traumatismos_previos: '',
    medicamentos_actuales: '',
    alergias: '',
    antecedentes_familiares: '',
    actividad_fisica: '',
    ocupacion: '',
    fuma: false,
    consume_alcohol: false,
    sistema_cardiovascular: '',
    sistema_respiratorio: '',
    sistema_nervioso: '',
    sistema_musculo: '',
    acepta_tratamiento: true,
    acepta_datos: true,
    firma_paciente: '',
  });
const [keyboardVisible, setKeyboardVisible] = useState(false);

useEffect(() => {
  const show = Keyboard.addListener("keyboardDidShow", () => {
    setKeyboardVisible(true);
  });

  const hide = Keyboard.addListener("keyboardDidHide", () => {
    setKeyboardVisible(false);
  });

  return () => {
    show.remove();
    hide.remove();
  };
}, []);
  const times = ["11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

  useEffect(() => { fetchFisioterapeutas(); }, []);

  async function fetchFisioterapeutas() {
    try {
      const { data, error } = await supabase
        .from('fisioterapeutas') 
        .select('id, nombre, apellido_paterno, activo, especialidad')
        .eq('activo', true);
      if (error) throw error;
      if (data) {
        setFisioterapeutas(data);
        if (data.length > 0) setSelectedFisio(data[0].id);
      }
    } catch (error: any) { console.log("Error:", error.message); }
  }

  const handleDayPress = (day: DateData) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(day.year, day.month - 1, day.day);
    if (selectedDateObj <= today) {
      Alert.alert("Fecha no válida", "Solo puedes agendar a partir de mañana.");
      return;
    }
    setSelectedDate(day.dateString);
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDateString = tomorrow.toISOString().split('T')[0];

  const handleCheckAndOpenHistorial = async () => {
    if (!selectedDate || !selectedTime || !description || !selectedFisio) {
      Alert.alert("Atención", "Completa la selección de fisio, fecha y hora.");
      return;
    }

    setLoading(true);
    try {
      const { data: ocupada } = await supabase
        .from('citas')
        .select('id')
        .eq('fecha', selectedDate)
        .eq('hora_inicio', selectedTime)
        .eq('fisioterapeuta_id', selectedFisio)
        .maybeSingle();

      if (ocupada) {
        Alert.alert("No Disponible", "Este horario ya está reservado.");
        setLoading(false);
        return;
      }
      setLoading(false);
      setVisibleHistorial(true); 
    } catch (error) {
      setLoading(false);
      Alert.alert("Error", "Error de conexión.");
    }
  };

  const handleGoToPayment = () => {
    const { motivo_consulta, zona_afectada, nivel_dolor_inicial, tiempo_padecimiento } = historial;

    if (!motivo_consulta.trim() || !zona_afectada.trim() || !nivel_dolor_inicial.trim() || !tiempo_padecimiento.trim()) {
      Alert.alert("Formulario Incompleto", "Llena los campos marcados con (*) para continuar.");
      return;
    }

    setVisibleHistorial(false);
    setVisible(true);
  };
useEffect(() => {
  const hide = Keyboard.addListener("keyboardDidHide", () => {
    Keyboard.dismiss();
  });

  return () => hide.remove();
}, []);
  
const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "CLOSE_PAYMENT") {
        setVisible(false);
        return;
      }

      if (data.type === "PAYMENT_SUCCESS") {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          Alert.alert("Error", "No se encontró usuario autenticado.");
          return;
        }

        const [hours, minutes] = selectedTime.split(':');
        const horaFin = `${(parseInt(hours) + 1).toString().padStart(2, '0')}:${minutes}`;

        // 1. Insertar Cita
        const { data: nuevaCita, error: errorCita } = await supabase
          .from('citas')
          .insert({
            usuario_id: user.id,
            fisioterapeuta_id: selectedFisio,
            fecha: selectedDate,
            hora_inicio: selectedTime,
            hora_fin: horaFin,
            motivo: description,
            estado: 'confirmada'
          })
          .select()
          .single();

        if (errorCita) {
          Alert.alert("Error Cita", errorCita.message);
          return;
        }

        // 2. Historia clínica - CAMBIO A UPSERT PARA EVITAR DUPLICADOS
        const historialPayload = {
          paciente_id: user.id, // Supabase usará esto para saber si ya existe
          motivo_consulta: historial.motivo_consulta,
          tiempo_padecimiento: historial.tiempo_padecimiento,
          zona_afectada: historial.zona_afectada,
          nivel_dolor_inicial: parseInt(historial.nivel_dolor_inicial) || 0,
          enfermedades_cronicas: historial.enfermedades_cronicas || null,
          cirugias_previas: historial.cirugias_previas || null,
          traumatismos_previos: historial.traumatismos_previos || null,
          medicamentos_actuales: historial.medicamentos_actuales || null,
          alergias: historial.alergias || null,
          antecedentes_familiares: historial.antecedentes_familiares || null,
          actividad_fisica: historial.actividad_fisica || null,
          ocupacion: historial.ocupacion || null,
          fuma: historial.fuma,
          consume_alcohol: historial.consume_alcohol,
          sistema_cardiovascular: historial.sistema_cardiovascular || null,
          sistema_respiratorio: historial.sistema_respiratorio || null,
          sistema_nervioso: historial.sistema_nervioso || null,
          sistema_musculo: historial.sistema_musculo || null,
          acepta_tratamiento: historial.acepta_tratamiento,
          acepta_datos: historial.acepta_datos,
          firma_paciente: historial.firma_paciente || null,
        };

        // Usamos upsert con onConflict para que actualice si ya existe el paciente_id
        const { error: errorHist } = await supabase
          .from('historia_clinica')
          .upsert(historialPayload, { onConflict: 'paciente_id' });

        if (errorHist) {
          Alert.alert("Error Historia Clínica", errorHist.message);
          return;
        }

        // 3. Pago
        const { error: errorPago } = await supabase
          .from('pagos')
          .insert({
            cita_id: nuevaCita.id,
            monto: 499,
            metodo: 'tarjeta_debito',
            estado_pago: 'procesado',
            proveedor_pago: 'Stripe'
          });

        if (errorPago) {
          Alert.alert("Error Pago", errorPago.message);
          return;
        }

        setVisible(false);
        Alert.alert("¡Éxito!", "Pago realizado y cita agendada correctamente.", [
          { 
            text: "OK", 
            onPress: () => {
              // Limpiar estados
              setSelectedDate('');
              setSelectedTime('');
              setDescription('');
              // Aquí asumo que usas React Navigation para volver al index
              // Si no usas navegación, puedes usar un estado global o resetear el componente
              // navigation.navigate('index'); 
            }
          }
        ]);
      }

    } catch (e: any) {
      Alert.alert("Error General", e.message);
    }
  };
 
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Agendar Cita</Text>
      
      <View style={styles.card}>
        <Text style={styles.label}>1. FISIOTERAPEUTA</Text>
        <View style={styles.fisioGrid}>
          {fisioterapeutas.map((fisio) => (
            <TouchableOpacity key={fisio.id} style={[styles.fisioSlot, selectedFisio === fisio.id && styles.selectedSlot]} onPress={() => setSelectedFisio(fisio.id)}>
              <Text style={[styles.especialidadText, selectedFisio === fisio.id && styles.selectedText]}>{fisio.especialidad || 'GENERAL'}</Text>
              <Text style={[styles.fisioText, selectedFisio === fisio.id && styles.selectedText]}>Dr. {fisio.nombre}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Calendar onDayPress={handleDayPress} minDate={minDateString} markedDates={{ [selectedDate]: { selected: true, selectedColor: '#9b1b6e' } }} />

        <View style={styles.timeGrid}>
          {times.map((t) => (
            <TouchableOpacity key={t} style={[styles.timeSlot, selectedTime === t && styles.selectedSlot]} onPress={() => setSelectedTime(t)}>
              <Text style={[styles.timeText, selectedTime === t && styles.selectedText]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput style={styles.textArea} placeholder="Breve descripción del malestar..." multiline value={description} onChangeText={setDescription} />
      </View>

      <TouchableOpacity style={styles.payBtn} onPress={handleCheckAndOpenHistorial} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>Llenar Historial y Pagar</Text>}
      </TouchableOpacity>

      {/* MODAL HISTORIA CLÍNICA */}
      <Modal visible={visibleHistorial} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.topBar}>
            <Text style={styles.topBarTitle}>📋 Historia Clínica Inicial</Text>
            <TouchableOpacity onPress={() => setVisibleHistorial(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>

            <Text style={styles.inputLabel}>MOTIVO DE CONSULTA *</Text>
            <TextInput style={styles.textArea} value={historial.motivo_consulta} onChangeText={(t) => setHistorial({...historial, motivo_consulta: t})} placeholder="¿Qué le duele?" multiline />

            <Text style={styles.inputLabel}>ZONA AFECTADA *</Text>
            <TextInput style={styles.inputSimple} value={historial.zona_afectada} onChangeText={(t) => setHistorial({...historial, zona_afectada: t})} placeholder="Ej: Espalda baja" />

            <Text style={styles.inputLabel}>TIEMPO CON EL DOLOR *</Text>
            <TextInput style={styles.inputSimple} value={historial.tiempo_padecimiento} onChangeText={(t) => setHistorial({...historial, tiempo_padecimiento: t})} placeholder="Ej: 3 días" />

            <Text style={styles.inputLabel}>NIVEL DE DOLOR (0-10) *</Text>
            <TextInput style={styles.inputSimple} keyboardType="numeric" value={historial.nivel_dolor_inicial} onChangeText={(t) => setHistorial({...historial, nivel_dolor_inicial: t})} placeholder="Ej: 7" />

            <Text style={styles.inputLabel}>OCUPACIÓN</Text>
            <TextInput style={styles.inputSimple} value={historial.ocupacion} onChangeText={(t) => setHistorial({...historial, ocupacion: t})} placeholder="Ej: Oficinista" />

            <Text style={styles.inputLabel}>ACTIVIDAD FÍSICA</Text>
            <TextInput style={styles.inputSimple} value={historial.actividad_fisica} onChangeText={(t) => setHistorial({...historial, actividad_fisica: t})} placeholder="Ej: Camina 30 min diario" />

            <Text style={styles.inputLabel}>CIRUGÍAS PREVIAS</Text>
            <TextInput style={styles.textArea} value={historial.cirugias_previas} onChangeText={(t) => setHistorial({...historial, cirugias_previas: t})} placeholder="Ninguna / describa..." multiline />

            <Text style={styles.inputLabel}>TRAUMATISMOS PREVIOS</Text>
            <TextInput style={styles.textArea} value={historial.traumatismos_previos} onChangeText={(t) => setHistorial({...historial, traumatismos_previos: t})} placeholder="Ninguno / describa..." multiline />

            <Text style={styles.inputLabel}>MEDICAMENTOS ACTUALES</Text>
            <TextInput style={styles.textArea} value={historial.medicamentos_actuales} onChangeText={(t) => setHistorial({...historial, medicamentos_actuales: t})} placeholder="Ninguno / liste los que toma..." multiline />

            <Text style={styles.inputLabel}>ALERGIAS O ENFERMEDADES CRÓNICAS</Text>
            <TextInput style={styles.textArea} value={historial.alergias} onChangeText={(t) => setHistorial({...historial, alergias: t})} placeholder="Opcional..." multiline />

            <Text style={styles.inputLabel}>ANTECEDENTES FAMILIARES</Text>
            <TextInput style={styles.textArea} value={historial.antecedentes_familiares} onChangeText={(t) => setHistorial({...historial, antecedentes_familiares: t})} placeholder="Opcional..." multiline />

            <Text style={styles.inputLabel}>SISTEMA CARDIOVASCULAR</Text>
            <TextInput style={styles.inputSimple} value={historial.sistema_cardiovascular} onChangeText={(t) => setHistorial({...historial, sistema_cardiovascular: t})} placeholder="Normal / alterado..." />

            <Text style={styles.inputLabel}>SISTEMA RESPIRATORIO</Text>
            <TextInput style={styles.inputSimple} value={historial.sistema_respiratorio} onChangeText={(t) => setHistorial({...historial, sistema_respiratorio: t})} placeholder="Normal / alterado..." />

            <Text style={styles.inputLabel}>SISTEMA NERVIOSO</Text>
            <TextInput style={styles.inputSimple} value={historial.sistema_nervioso} onChangeText={(t) => setHistorial({...historial, sistema_nervioso: t})} placeholder="Normal / alterado..." />

            <Text style={styles.inputLabel}>SISTEMA MÚSCULO-ESQUELÉTICO</Text>
            <TextInput style={styles.inputSimple} value={historial.sistema_musculo} onChangeText={(t) => setHistorial({...historial, sistema_musculo: t})} placeholder="Normal / alterado..." />

            <Text style={styles.inputLabel}>¿FUMA?</Text>
            <View style={styles.boolRow}>
              <TouchableOpacity style={[styles.boolBtn, historial.fuma && styles.selectedSlot]} onPress={() => setHistorial({...historial, fuma: true})}>
                <Text style={[styles.boolText, historial.fuma && styles.selectedText]}>Sí</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.boolBtn, !historial.fuma && styles.selectedSlot]} onPress={() => setHistorial({...historial, fuma: false})}>
                <Text style={[styles.boolText, !historial.fuma && styles.selectedText]}>No</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>¿CONSUME ALCOHOL?</Text>
            <View style={styles.boolRow}>
              <TouchableOpacity style={[styles.boolBtn, historial.consume_alcohol && styles.selectedSlot]} onPress={() => setHistorial({...historial, consume_alcohol: true})}>
                <Text style={[styles.boolText, historial.consume_alcohol && styles.selectedText]}>Sí</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.boolBtn, !historial.consume_alcohol && styles.selectedSlot]} onPress={() => setHistorial({...historial, consume_alcohol: false})}>
                <Text style={[styles.boolText, !historial.consume_alcohol && styles.selectedText]}>No</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>FIRMA DEL PACIENTE</Text>
            <TextInput style={styles.inputSimple} value={historial.firma_paciente} onChangeText={(t) => setHistorial({...historial, firma_paciente: t})} placeholder="Nombre completo como firma..." />

            <TouchableOpacity style={[styles.payBtn, { marginBottom: 40 }]} onPress={handleGoToPayment}>
              <Text style={styles.payBtnText}>Confirmar e Ir a Pagar</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL PAGO */}
      <Modal
  visible={visible}
  animationType="slide"
  statusBarTranslucent={true} // 🔥 IMPORTANTE
>
  <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === "ios" ? "padding" : undefined}
  >
    <SafeAreaView style={{ flex: 1 }}>
      
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}></Text>
        <TouchableOpacity onPress={() => setVisible(false)}>
          <Text style={styles.closeBtn}></Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: keyboardVisible ? 500 : 100 }}>
 <WebView
  source={{ uri: STRIPE_CHECKOUT_URL }}
  onMessage={handleMessage}
  style={{ flex: 1 }}
  scrollEnabled={true}
/>
</View>

    </SafeAreaView>
  </KeyboardAvoidingView>
</Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#fff", flexGrow: 1 },
  title: { color: "#3d0030", fontSize: 24, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
  card: { backgroundColor: "#fff", borderRadius: 15, padding: 15, borderWidth: 1, borderColor: "#fce4f3" },
  label: { color: "#9b1b6e", fontSize: 13, fontWeight: "bold", marginBottom: 12 },
  fisioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  fisioSlot: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e8a0d0', backgroundColor: '#fce4f3', minWidth: '45%', alignItems: 'center' },
  especialidadText: { fontSize: 9, fontWeight: 'bold', color: '#9b1b6e' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 15 },
  timeSlot: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e8a0d0', width: '30%', alignItems: 'center', backgroundColor: '#fce4f3' },
  selectedSlot: { backgroundColor: '#9b1b6e', borderColor: '#9b1b6e' },
  fisioText: { color: '#9b1b6e', fontWeight: '700', fontSize: 12 },
  timeText: { color: '#9b1b6e', fontWeight: '700' },
  selectedText: { color: '#fff' },
  textArea: { backgroundColor: '#fce4f3', borderRadius: 12, padding: 15, textAlignVertical: 'top', color: '#3d0030', height: 100, borderWidth: 1, borderColor: '#e8a0d0', marginTop: 15 },
  payBtn: { backgroundColor: "#9b1b6e", borderRadius: 15, padding: 20, alignItems: "center", marginTop: 25 },
  payBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  modal: { flex: 1, backgroundColor: "#fff" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#fce4f3" },
  topBarTitle: { fontWeight: "bold", color: "#3d0030" },
  closeBtn: { fontSize: 22, color: "#888888" },
  inputSimple: { backgroundColor: '#fce4f3', borderRadius: 12, padding: 12, marginBottom: 15, borderWidth: 1, borderColor: '#e8a0d0', color: '#3d0030' },
  inputLabel: { color: "#9b1b6e", fontSize: 12, fontWeight: "bold", marginBottom: 5, marginTop: 10 },
  boolRow: { flexDirection: 'row', gap: 10, marginBottom: 15, marginTop: 5 },
  boolBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e8a0d0', backgroundColor: '#fce4f3', alignItems: 'center' },
  boolText: { color: '#9b1b6e', fontWeight: '700' },
});