import { Checkbox } from 'expo-checkbox';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput,
    TouchableOpacity, View, Platform, KeyboardAvoidingView,
} from 'react-native';
import { supabase } from '../../src/services/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Requisito = {
    key: 'length' | 'number' | 'upper' | 'special';
    label: string;
    met: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function evaluarRequisitos(text: string): Requisito[] {
    return [
        { key: 'length',  label: 'Al menos 10 caracteres',          met: text.length >= 10 },
        { key: 'upper',   label: 'Una letra mayúscula (A-Z)',        met: /[A-Z]/.test(text) },
        { key: 'number',  label: 'Un número (0-9)',                  met: /\d/.test(text) },
        { key: 'special', label: 'Un símbolo (!@#$%^&*…)',           met: /[!@#$%^&*(),.?":{}|<>]/.test(text) },
    ];
}

function nivelContraseña(requisitos: Requisito[]): { label: string; color: string; pct: number } {
    const cumplidos = requisitos.filter(r => r.met).length;
    if (cumplidos === 0) return { label: '',           color: '#ccc',    pct: 0   };
    if (cumplidos === 1) return { label: 'Débil',      color: '#d9534f', pct: 25  };
    if (cumplidos === 2) return { label: 'Regular',    color: '#f0ad4e', pct: 50  };
    if (cumplidos === 3) return { label: 'Buena',      color: '#5bc0de', pct: 75  };
    return                     { label: 'Fuerte ✓',   color: '#5cb85c', pct: 100 };
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function Register() {
    const [formData, setFormData] = useState({
        fullName: '', paternalName: '', maternalName: '', birthDate: new Date(),
        email: '', phoneNumber: '', password: '', consent: false,
    });
    const [loading, setLoading]             = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [fechaTexto, setFechaTexto]       = useState('');
    const [emailError, setEmailError]       = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [requisitos, setRequisitos]       = useState<Requisito[]>(evaluarRequisitos(''));
    const [passwordTocada, setPasswordTocada] = useState(false);
    const router = useRouter();

    const nivel = nivelContraseña(requisitos);

    // ── Formateador de teléfono ───────────────────────────────────────────────
    const formatPhoneNumber = (text: string) => {
        const cleaned = text.replace(/\D/g, '');
        let formatted = cleaned;
        if (cleaned.length <= 3)       formatted = `(${cleaned})`;
        else if (cleaned.length <= 6)  formatted = `(${cleaned.slice(0,3)}) ${cleaned.slice(3)}`;
        else                           formatted = `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6,10)}`;
        setFormData(prev => ({ ...prev, phoneNumber: formatted }));
    };

    // ── Validación de correo ──────────────────────────────────────────────────
    const validateEmail = (text: string) => {
        setFormData(prev => ({ ...prev, email: text }));
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        setEmailError(text.length > 0 && !emailRegex.test(text)
            ? 'Ingresa un correo válido (ej. usuario@correo.com)' : '');
    };

    // ── Evaluación de contraseña ──────────────────────────────────────────────
    const evaluatePassword = (text: string) => {
        setFormData(prev => ({ ...prev, password: text }));
        setPasswordTocada(true);
        setRequisitos(evaluarRequisitos(text));
    };

    // ── Fecha de nacimiento ───────────────────────────────────────────────────
    const onChangeDate = (event: any, selectedDate?: Date) => {
        const currentDate = selectedDate || formData.birthDate;
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            setFormData(prev => ({ ...prev, birthDate: currentDate }));
            setFechaTexto(currentDate.toISOString().split('T')[0]);
        }
    };

    // ── Registro ──────────────────────────────────────────────────────────────
    const handleRegister = async () => {
        const todosLosRequisitos = requisitos.every(r => r.met);
        if (emailError || !todosLosRequisitos || !formData.consent || !fechaTexto) {
            Alert.alert('Error', 'Por favor, completa correctamente todos los campos obligatorios.');
            return;
        }
        setLoading(true);
        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
            });
            if (authError) throw authError;

            const { error: dbError } = await supabase.from('usuario').insert({
                id_us:       authData.user?.id,
                us_nom:      formData.fullName,
                us_correo:   formData.email,
                us_telefono: formData.phoneNumber.replace(/\D/g, ''),
                us_fecha:    fechaTexto,
                us_rol:      'paciente',
            });
            if (dbError) throw dbError;

            Alert.alert('¡Bienvenido!', 'Tu cuenta ha sido creada con éxito.', [
                { text: 'Entendido', onPress: () => router.back() },
            ]);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: '#ffffff' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>Registro de Paciente</Text>

                {/* ── Aviso de accesibilidad ── */}
                <View style={styles.avisoInclusivo}>
                    <Ionicons name="accessibility" size={18} color="#9b1b6e" />
                    <Text style={styles.avisoTexto}>
                        MotriCare está diseñado para ser accesible para todos.
                        Si necesitas asistencia para completar tu registro, contáctanos.
                    </Text>
                </View>

                {/* ── Campos de nombre ── */}
                <Text style={styles.label}>Nombre(s) *</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Ej. María"
                    placeholderTextColor="#aaa"
                    onChangeText={t => setFormData(prev => ({ ...prev, fullName: t }))}
                    accessibilityLabel="Campo de nombre"
                />

                <Text style={styles.label}>Apellido Paterno *</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Ej. González"
                    placeholderTextColor="#aaa"
                    onChangeText={t => setFormData(prev => ({ ...prev, paternalName: t }))}
                    accessibilityLabel="Campo de apellido paterno"
                />

                {/* ── Fecha de nacimiento ── */}
                <Text style={styles.label}>Fecha de Nacimiento *</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
                    <View style={styles.input} pointerEvents="none">
                        <Text style={{ color: fechaTexto ? '#3d0030' : '#aaa' }}>
                            {fechaTexto || 'Selecciona tu fecha de nacimiento'}
                        </Text>
                    </View>
                </TouchableOpacity>
                {showDatePicker && (
                    <DateTimePicker
                        value={formData.birthDate}
                        mode="date"
                        display="default"
                        maximumDate={new Date()}
                        onChange={onChangeDate}
                    />
                )}

                {/* ── Teléfono ── */}
                <Text style={styles.label}>Número Telefónico</Text>
                <TextInput
                    style={styles.input}
                    placeholder="(000) 000-0000"
                    keyboardType="numeric"
                    placeholderTextColor="#aaa"
                    value={formData.phoneNumber}
                    maxLength={14}
                    onChangeText={formatPhoneNumber}
                    accessibilityLabel="Campo de teléfono"
                />

                {/* ── Correo ── */}
                <Text style={styles.label}>Correo Electrónico *</Text>
                <TextInput
                    style={[styles.input, emailError ? styles.inputError : null]}
                    placeholder="usuario@correo.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholderTextColor="#aaa"
                    onChangeText={validateEmail}
                    accessibilityLabel="Campo de correo electrónico"
                />
                {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

                {/* ── Contraseña ── */}
                <Text style={styles.label}>Contraseña *</Text>
                <View style={styles.passwordInputContainer}>
                    <TextInput
                        style={styles.passwordInput}
                        placeholder="Crea tu contraseña"
                        secureTextEntry={!isPasswordVisible}
                        placeholderTextColor="#aaa"
                        onChangeText={evaluatePassword}
                        underlineColorAndroid="transparent"
                        accessibilityLabel="Campo de contraseña"
                    />
                    <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setIsPasswordVisible(v => !v)}
                        activeOpacity={0.6}
                        accessibilityLabel={isPasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                        <Ionicons name={isPasswordVisible ? 'eye-off' : 'eye'} size={22} color="#9b1b6e" />
                    </TouchableOpacity>
                </View>

                {/* ── Barra de fortaleza ── */}
                {passwordTocada && formData.password.length > 0 && (
                    <View style={styles.strengthContainer}>
                        {/* Barra visual */}
                        <View style={styles.strengthBarBg}>
                            <View style={[styles.strengthBarFill, {
                                width: `${nivel.pct}%`,
                                backgroundColor: nivel.color,
                            }]} />
                        </View>
                        <Text style={[styles.strengthLabel, { color: nivel.color }]}>
                            {nivel.label}
                        </Text>

                        {/* Checklist de requisitos */}
                        <View style={styles.requisitosList}>
                            {requisitos.map(r => (
                                <View key={r.key} style={styles.requisitoRow}>
                                    <Ionicons
                                        name={r.met ? 'checkmark-circle' : 'ellipse-outline'}
                                        size={16}
                                        color={r.met ? '#5cb85c' : '#ccc'}
                                    />
                                    <Text style={[
                                        styles.requisitoTexto,
                                        { color: r.met ? '#3d0030' : '#aaa' }
                                    ]}>
                                        {r.label}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* ── Consentimiento ── */}
                <View style={styles.checkboxContainer}>
                    <Checkbox
                        value={formData.consent}
                        onValueChange={val => setFormData(prev => ({ ...prev, consent: val }))}
                        color={formData.consent ? '#9b1b6e' : undefined}
                        accessibilityLabel="Aceptar términos de privacidad"
                    />
                    <Text style={styles.checkboxLabel}>
                        Permito que MotriCare procese mis datos de salud de acuerdo con su política de privacidad.
                    </Text>
                </View>

                <TouchableOpacity
                    style={[styles.button, loading && { opacity: 0.7 }]}
                    onPress={handleRegister}
                    disabled={loading}
                    accessibilityLabel="Botón para crear cuenta"
                    accessibilityRole="button"
                >
                    {loading
                        ? <ActivityIndicator color="#FFFFFF" />
                        : <Text style={styles.buttonText}>Crear Cuenta</Text>
                    }
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { padding: 30, paddingBottom: 60, backgroundColor: '#ffffff', flexGrow: 1, justifyContent: 'center' },
    title: { fontSize: 26, color: '#3d0030', fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },

    avisoInclusivo: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        backgroundColor: '#fce4f3', borderRadius: 10, padding: 12,
        marginBottom: 20, borderLeftWidth: 3, borderLeftColor: '#9b1b6e',
    },
    avisoTexto: { flex: 1, fontSize: 12, color: '#3d0030', lineHeight: 18 },

    label: { fontSize: 13, fontWeight: '600', color: '#3d0030', marginBottom: 5, marginLeft: 2 },

    input: {
        backgroundColor: '#fce4f3', color: '#3d0030', padding: 15,
        borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#e8a0d0',
    },
    inputError: { borderColor: '#d9534f' },
    errorText: { color: '#d9534f', fontSize: 12, marginTop: -8, marginBottom: 10, marginLeft: 5 },

    passwordInputContainer: {
        flexDirection: 'row', backgroundColor: '#fce4f3',
        borderRadius: 10, borderWidth: 1, borderColor: '#e8a0d0',
        marginBottom: 12, alignItems: 'center', overflow: 'hidden',
    },
    passwordInput: {
        flex: 1, color: '#3d0030', paddingVertical: 15, paddingHorizontal: 15,
        backgroundColor: 'transparent', borderWidth: 0,
    },
    eyeIcon: { padding: 15, justifyContent: 'center', alignItems: 'center' },

    // Fortaleza
    strengthContainer: {
        marginTop: -4, marginBottom: 14, paddingHorizontal: 2,
    },
    strengthBarBg: {
        height: 6, backgroundColor: '#f0d0e8', borderRadius: 3,
        overflow: 'hidden', marginBottom: 6,
    },
    strengthBarFill: {
        height: '100%', borderRadius: 3,
    },
    strengthLabel: {
        fontSize: 12, fontWeight: '700', marginBottom: 8, marginLeft: 2,
    },
    requisitosList: { gap: 5 },
    requisitoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    requisitoTexto: { fontSize: 12 },

    checkboxContainer: {
        flexDirection: 'row', alignItems: 'center', marginBottom: 20,
        paddingRight: 20, marginTop: 10,
    },
    checkboxLabel: { color: '#888', marginLeft: 10, fontSize: 13, flex: 1 },

    button: { backgroundColor: '#9b1b6e', padding: 18, borderRadius: 12, alignItems: 'center', elevation: 3 },
    buttonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
});