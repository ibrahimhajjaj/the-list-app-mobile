import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { AuthStackScreenProps } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { registerUser } from '../../store/slices/authSlice';
import { commonStyles } from '../../theme/commonStyles';
import { spacing } from '../../theme/spacing';

export default function RegisterScreen({ navigation }: AuthStackScreenProps<'Register'>) {
  const dispatch = useAppDispatch();
  const { loading, error, lastAttempt } = useAppSelector((state) => state.auth);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (error) {
      setShowError(true);
      console.error('Registration Error State:', {
        error,
        lastAttempt,
      });
    }
  }, [error, lastAttempt]);

  const handleRegister = async () => {
    try {
      console.log('Starting registration...');
      const resultAction = await dispatch(registerUser({ name, email, password }));
      
      if (registerUser.fulfilled.match(resultAction)) {
        console.log('Registration successful:', resultAction.payload);
        // The root navigator will automatically switch to Main screen
        // when the token is set in the Redux store
      } else if (registerUser.rejected.match(resultAction)) {
        console.error('Registration failed:', {
          error: resultAction.payload,
          type: resultAction.type,
        });
      }
    } catch (err) {
      console.error('Registration error:', err);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={commonStyles.container}
    >
      <ScrollView contentContainerStyle={commonStyles.scrollContainer}>
        <View style={commonStyles.formContainer}>
          <Text style={commonStyles.title}>Create Account</Text>
          
          {showError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                {error || 'An error occurred during registration'}
              </Text>
              {lastAttempt?.details?.status && (
                <Text style={styles.errorDetail}>
                  Status: {lastAttempt.details.status}
                </Text>
              )}
              <TouchableOpacity onPress={() => setShowError(false)}>
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}

          <TextInput
            style={commonStyles.input}
            placeholder="Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          
          <TextInput
            style={commonStyles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <TextInput
            style={commonStyles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          
          <TouchableOpacity
            style={[commonStyles.button, loading && commonStyles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={commonStyles.buttonText}>Register</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={commonStyles.linkButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={commonStyles.linkText}>
              Already have an account? Login
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 5,
    marginVertical: 10,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  errorDetail: {
    color: '#c62828',
    fontSize: 12,
    marginTop: 5,
  },
  dismissText: {
    color: '#2196f3',
    fontSize: 14,
    marginTop: 5,
    textAlign: 'right',
  },
}); 