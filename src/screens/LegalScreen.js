// Legal / data attribution screen. Explains where the photos and data come from
// (iNaturalist and its observers) and the copyright terms that apply. Reached
// from Settings → About → Data & licensing.

import React from 'react';
import { View, Text, Pressable, ScrollView, Linking, StyleSheet } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import { useThemedStyles } from '../theme';

function Para({ children }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={styles.para}>{children}</Text>;
}

function Link({ url, children }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Text style={styles.link} onPress={() => Linking.openURL(url)}>
      {children}
    </Text>
  );
}

export default function LegalScreen({ onBack }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.flex}>
      <ScreenHeader title="Data & licensing" onBack={onBack} />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Where the data comes from</Text>
        <Para>
          gote shows photos and species information from{' '}
          <Link url="https://www.inaturalist.org">iNaturalist</Link>, retrieved
          through the public iNaturalist API. The observations, photographs, and
          identifications are created by the iNaturalist community, not by gote.
        </Para>

        <Text style={styles.heading}>Copyright &amp; licensing</Text>
        <Para>
          Each photograph and observation remains the property of the observer
          who created it, and is made available under the license that observer
          chose on iNaturalist (for example, various Creative Commons licenses,
          or “all rights reserved”). Those terms — including any requirement to
          credit the author — apply to every image shown in this app.
        </Para>
        <Para>
          gote displays this content for personal, educational study only. It
          does not grant you any rights to the photos or data beyond what the
          original license from each observer allows. To reuse a photo, check its
          license and attribution on its iNaturalist page and follow the
          observer’s terms.
        </Para>

        <Text style={styles.heading}>Your data</Text>
        <Para>
          gote works without an account. Your statistics, streak and preferences
          are stored on this device, and clearing them is always available under
          Settings → Reset statistics.
        </Para>
        <Para>
          If you turn on Sync across devices, your gameplay statistics and the
          email address you use to link devices are stored on our server so your
          devices can share one set of numbers. You can delete that account and
          everything on it at any time from Settings → Devices → Sync across
          devices. No advertising, no tracking, and nothing is ever sold.
        </Para>
        <Para>
          Full details are in the{' '}
          <Link url="https://github.com/turbolya/gote/blob/main/PRIVACY.md">
            Privacy Policy
          </Link>
          .
        </Para>

        <Text style={styles.heading}>Not affiliated with iNaturalist</Text>
        <Para>
          gote is an independent, unofficial app. It is not created, endorsed, or
          supported by iNaturalist, the California Academy of Sciences, or the
          National Geographic Society. “iNaturalist” is a trademark of its
          owners.
        </Para>

        <Text style={styles.heading}>Learn more</Text>
        <Para>
          See iNaturalist’s{' '}
          <Link url="https://www.inaturalist.org/pages/terms">Terms of Service</Link>
          ,{' '}
          <Link url="https://www.inaturalist.org/pages/api+reference">
            API guidelines
          </Link>
          , and individual observation pages for the exact license and author of
          each photo.
        </Para>

        <Pressable
          style={styles.button}
          onPress={() => Linking.openURL('https://www.inaturalist.org/pages/terms')}
        >
          <Text style={styles.buttonText}>Open iNaturalist Terms</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  heading: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 22,
    marginBottom: 8,
  },
  para: { fontSize: 15, lineHeight: 22, color: colors.text, marginBottom: 10 },
  link: { color: colors.primaryDark, fontWeight: '700' },
  button: {
    marginTop: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: colors.primaryDark, fontSize: 15, fontWeight: '700' },
});
