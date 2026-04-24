import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform, KeyboardAvoidingView} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/services/supabase';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const[emailError, setEmailError]=useState('');
    const togglePasswordVisibility = () => {
        setIsPasswordVisible(!isPasswordVisible);
    }

    const validateEmail = (text: string) => {
        setEmail(text);
        // Expresión regular que exige texto, un @, más texto, un punto y texto final
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (text.length > 0 && !emailRegex.test(text)) {
            setEmailError('Ingresa un correo válido (ej. usuario@correo.com)');
        } else {
            setEmailError('');
        }
    };

    const handleLogin = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                Alert.alert('Error', 'Correo o contraseña incorrectos.');
                return;
            }
            console.log("¡Inicio de sesion exitoso!");
        } catch (error: any) {
            Alert.alert("Error inesperado", error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#ffff' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Usamos el nuevo color de texto oscuro para el header */}
                <Text style={styles.header}>Bienvenido a MotriCare</Text>
                <Text style={styles.subHeader}>Inicio de sesión</Text>

                <TextInput
                    style={[styles.input, emailError ? styles.inputError:null]}
                    placeholder="Correo electrónico"
                    keyboardType="email-address"
                    placeholderTextColor="#888888"
                    autoCapitalize="none"
                    onChangeText={validateEmail}
                    value={email}
                />
                {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

                <View style={styles.passwordInputContainer}>
                    <TextInput
                        style={styles.passwordInput}
                        placeholder="Contraseña"
                        placeholderTextColor="#888888"
                        value={password}
                        secureTextEntry={!isPasswordVisible}
                        onChangeText={setPassword}
                        underlineColorAndroid="transparent"
                    />
                    <TouchableOpacity style={styles.eyeIcon} onPress={togglePasswordVisibility} activeOpacity={0.6}>
                        <Ionicons
                            name={isPasswordVisible ? "eye-off" : "eye"}
                            size={22}
                            color="#3d0030" />
                    </TouchableOpacity>
                </View>
                {/* Botón con el nuevo color primario púrpura */}
                <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.buttonText}>Entrar</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/(auth)/register' as any)} style={styles.registerLink}>
                    <Text style={styles.linkText}>
                        ¿No tienes cuenta? <Text style={styles.linkAction}>Regístrate</Text>
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff', // --color-white
        padding: 30,
        justifyContent: 'center'
    },
    header: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#3d0030', // --color-text-dark (Púrpura oscuro)
        marginBottom: 5,
        textAlign: 'center'
    },
    subHeader: {
        fontSize: 16,
        color: '#888888', // Gris medio
        marginBottom: 30,
        textAlign: 'center'
    },
    input: {
        backgroundColor: '#fce4f3', // --color-primary-lt (Rosa muy claro para el fondo del input)
        color: '#3d0030', // --color-text-dark para el texto que escribe el usuario
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#e8a0d0' // --color-border (Rosa medio para el borde)
    },
    button: {
        backgroundColor: '#9b1b6e', // --color-primary (Púrpura vibrante)
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
        elevation: 3, // Sombra para Android
        shadowColor: '#000', // Sombra para iOS
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    buttonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF'
    },
    linkText: {
        color: '#888888',
        textAlign: 'center',
        marginTop: 25
    },
    linkAction: {
        color: '#9b1b6e', // --color-primary en el enlace de registro
        fontWeight: 'bold'
    },
    passwordInputContainer: {
        flexDirection: 'row',
        backgroundColor: '#fce4f3',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e8a0d0',
        marginBottom: 12,
        alignItems: 'center',
        overflow: 'hidden', // Asegura que nada se salga del borde redondeado
    },
    passwordInput: {
        flex: 1,
        color: '#3d0030',
        paddingVertical: 15,
        paddingHorizontal: 15,
        backgroundColor: 'transparent', // Sin fondo
        borderWidth: 0, // Sin bordes
    },
    eyeIcon: {
        padding: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    registerLink: {
        marginTop: 25,
        alignItems: 'center'
    },
    inputError: { 
        borderColor: '#d9534f' 
    },
    errorText: { 
        color: '#d9534f', 
        fontSize: 12, 
        marginTop: -10, 
        marginBottom: 15, 
        marginLeft: 5 
    },
});