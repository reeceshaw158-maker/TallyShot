/**
 * Biometric authentication service.
 * Wraps expo-local-authentication with a simple API.
 */
import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricType = 'fingerprint' | 'face' | 'iris' | 'none';

/** Returns the best available biometric type, or 'none'. */
export async function getBiometricType(): Promise<BiometricType> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return 'none';

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) return 'none';

  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'face';
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'iris';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'fingerprint';
  return 'none';
}

/** Returns true if biometric authentication is available and enrolled. */
export async function isBiometricAvailable(): Promise<boolean> {
  const type = await getBiometricType();
  return type !== 'none';
}

export interface AuthResult {
  success: boolean;
  error?: string;
}

/**
 * Prompt the user to authenticate. Returns success:true on pass.
 * Never throws — errors are returned in the result object.
 */
export async function authenticate(reason = 'Unlock TallyShot'): Promise<AuthResult> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return { success: result.success };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Authentication error' };
  }
}
