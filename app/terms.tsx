import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useThemeTokens } from '../src/theme';

const LAST_UPDATED = '27 June 2026';
const CONTACT = 'reeceshaw158@gmail.com';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: 'By downloading, installing, or using TallyShot ("the App"), you agree to these Terms of Use. If you do not agree, do not use the App. These Terms are governed by the laws of England and Wales.',
  },
  {
    title: '2. What TallyShot Is',
    body: 'TallyShot is a personal expense tracking and receipt management application developed by Reece Shaw. It is designed to help individuals and small businesses track spending, scan receipts, and generate expense reports.\n\nTallyShot is not a financial advisory service, accountancy software, or tax filing tool. Always verify expense and tax information with a qualified accountant.',
  },
  {
    title: '3. Free vs Pro Plan',
    body: 'Free Plan: Manual receipt entry (unlimited), limited AI scans per month, drives, reports, and export.\n\nPro Plan: Unlimited AI receipt scanning, all features. Billed monthly or annually via the App Store or Google Play.\n\nSubscriptions auto-renew unless cancelled at least 24 hours before the end of the billing period. You can manage or cancel your subscription through your device\'s App Store or Google Play account settings.',
  },
  {
    title: '4. AI Receipt Extraction',
    body: 'TallyShot uses AI (including Google Gemini and similar APIs) to extract data from receipt images. When you scan a receipt:\n\n• Your receipt image is transmitted to the AI provider using encrypted HTTPS\n• The AI processes the image and returns extracted data\n• We do not store receipt images or extracted data on our servers\n\nAI extraction may produce errors. Always verify extracted amounts, merchants, and tax values before using them for accounting or tax purposes. We are not liable for errors in AI-extracted data.',
  },
  {
    title: '5. Your Data & Privacy',
    body: 'All your receipts, categories, drives, and financial data are stored locally on your device in an encrypted SQLite database. We do not access, view, or retain your data.\n\nYou are responsible for backing up your data. We are not liable for data loss due to device failure, deletion, or reinstallation.\n\nFor full details on data handling, see our Privacy Policy.',
  },
  {
    title: '6. Intellectual Property',
    body: 'The TallyShot app, its design, code, and branding are the intellectual property of Reece Shaw. You may not copy, reverse-engineer, decompile, or create derivative works from any part of the App.',
  },
  {
    title: '7. Prohibited Uses',
    body: 'You agree not to:\n• Use TallyShot for any unlawful purpose including tax fraud\n• Attempt to reverse-engineer or extract the App\'s source code\n• Share your Pro subscription access with others\n• Interfere with or disrupt the App or its associated services\n• Misrepresent financial data extracted by the App',
  },
  {
    title: '8. Disclaimer of Warranties',
    body: 'TallyShot is provided "as is" without warranties of any kind. We do not guarantee that:\n• AI receipt extraction will always be accurate\n• The App will be uninterrupted or error-free\n• The App is suitable for professional accounting or tax filing purposes\n\nAlways verify financial data with a qualified professional.',
  },
  {
    title: '9. Limitation of Liability',
    body: 'To the maximum extent permitted by law, Reece Shaw shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of TallyShot — including financial losses resulting from incorrect data extraction or calculation. Our total liability to you shall not exceed the amount you paid in the 12 months preceding the claim.',
  },
  {
    title: '10. Changes & Termination',
    body: 'We may update these Terms at any time. Changes take effect when updated in the App. We may also modify, suspend, or discontinue the App at any time with or without notice.',
  },
  {
    title: '11. Contact',
    body: 'For questions about these Terms:\n\nEmail: ' + CONTACT + '\n\nWe respond within 30 days.',
  },
];

export default function TermsScreen() {
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
          <Text style={[styles.title, { color: t.textPrimary }]}>Terms of Use</Text>
          <Text style={[styles.appName, { color: t.accent }]}>TallyShot — Receipt & Expense Tracker</Text>
          <Text style={[styles.updated, { color: t.textMuted }]}>Last updated: {LAST_UPDATED}</Text>

          {SECTIONS.map((s) => (
            <View key={s.title} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>{s.title}</Text>
              <Text style={[styles.sectionBody, { color: t.textMuted }]}>{s.body}</Text>
            </View>
          ))}

          <Text style={[styles.footer, { color: t.textMuted, borderTopColor: t.border }]}>
            These Terms constitute the entire agreement between you and Reece Shaw regarding TallyShot. If any provision is unenforceable, the remaining provisions remain in full effect.
          </Text>

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
  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 8, letterSpacing: -0.2 },
  sectionBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 21 },
  footer: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, borderTopWidth: 1, paddingTop: 20 },
});
