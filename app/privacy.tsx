import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useThemeTokens } from '../src/theme';

const LAST_UPDATED = '27 June 2026';
const CONTACT = 'reeceshaw158@gmail.com';

const SECTIONS = [
  {
    title: '1. Who We Are',
    body: 'TallyShot is a receipt scanning and expense tracking application developed by Reece Shaw ("we", "us", "our"). This Privacy Policy explains how TallyShot handles your data.',
  },
  {
    title: '2. What Data We Collect & Store',
    body: 'TallyShot stores all data locally on your device in an encrypted SQLite database. We collect:\n\n• Receipt images and extracted data (totals, tax, merchant, date, items)\n• Product and category information you create\n• Drive and mileage records you log\n• Your custom settings (currency, region, tax preferences)\n• Your subscription status\n\nWe do NOT collect your name, email, location, contacts, or any data that identifies you to us remotely.',
  },
  {
    title: '3. Receipt & Financial Data Security',
    body: 'Your financial data (receipts, totals, categories, reports) is stored in a local encrypted SQLite database on your device. It is never uploaded to our servers.\n\nBiometric lock (Face ID / fingerprint) is available to protect app access — biometric data is processed entirely by your device\'s secure hardware and is never accessible to TallyShot or transmitted anywhere.\n\nBackups are user-initiated and stored to the location you choose (e.g. iCloud, Google Drive). You are responsible for the security of exported backups.',
  },
  {
    title: '4. AI Features',
    body: 'TallyShot uses on-device or API-based AI to extract data from receipts and generate summaries. When receipt processing uses an external AI API:\n\n• Receipt image data is transmitted to the AI provider (e.g. Google Gemini, Groq) using encrypted HTTPS connections\n• Data is processed per the AI provider\'s privacy policy\n• We do not store AI processing results on our servers\n\nReceipt images remain on your device.',
  },
  {
    title: '5. Third-Party Services',
    body: '• Apple / Google: In-app purchase processing for Pro subscription\n• Google Gemini / Groq: AI-powered receipt processing (only if you add your own API key)\n• Expo (EAS): App build and update delivery\n\nWe do not use advertising networks, third-party analytics, or tracking SDKs.',
  },
  {
    title: '6. Your Rights (UK/EU GDPR)',
    body: 'Since all data is stored locally on your device:\n\n• Right to access: All your data is visible within the app\n• Right to erasure: Settings → Clear All Data permanently deletes everything\n• Right to portability: Use Export to download your data in CSV/PDF format\n• Right to object: Delete the app to cease all data processing\n\nFor any requests: ' + CONTACT,
  },
  {
    title: '7. Children\'s Privacy',
    body: 'TallyShot is not directed at children under 13 and is designed for adults managing personal or business finances. We do not knowingly process data from children under 13.',
  },
  {
    title: '8. Changes to This Policy',
    body: 'We may update this Privacy Policy. Changes are reflected in the "Last Updated" date. Continued use after changes constitutes acceptance.',
  },
  {
    title: '9. Contact',
    body: 'Email: ' + CONTACT + '\n\nWe respond within 30 days.',
  },
];

export default function PrivacyScreen() {
  const t = useThemeTokens();

  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      <SafeAreaView style={styles.safe}>
        <View style={[styles.topBar, { borderBottomColor: t.border }]}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: t.accent, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>← Back</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, { color: t.textPrimary }]}>Privacy Policy</Text>
          <Text style={[styles.appName, { color: t.accent }]}>TallyShot — Receipt & Expense Tracker</Text>
          <Text style={[styles.updated, { color: t.textMuted }]}>Last updated: {LAST_UPDATED}</Text>

          <View style={[styles.summaryCard, { backgroundColor: t.accent + '18', borderColor: t.accent + '35' }]}>
            <Text style={[styles.summaryTitle, { color: t.accent }]}>Plain English Summary</Text>
            <Text style={[styles.summaryText, { color: t.textPrimary }]}>
              Your receipts and financial data never leave your device unless you export them yourself. No servers. No tracking. Biometric lock keeps your data private on the device. We don't know who you are.
            </Text>
          </View>

          {SECTIONS.map((s) => (
            <View key={s.title} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>{s.title}</Text>
              <Text style={[styles.sectionBody, { color: t.textMuted }]}>{s.body}</Text>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  scroll: { padding: 20 },
  title: { fontFamily: 'Inter_800ExtraBold', fontSize: 28, marginBottom: 4, marginTop: 4, letterSpacing: -0.5 },
  appName: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 4 },
  updated: { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 20 },
  summaryCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 24 },
  summaryTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, marginBottom: 6 },
  summaryText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 8, letterSpacing: -0.2 },
  sectionBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 21 },
});
