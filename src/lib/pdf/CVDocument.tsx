import { Document, Page, Text, View, StyleSheet, Link } from '@react-pdf/renderer'
import type { UserProfile } from '@/types/profile'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 50,
    color: '#1a1a1a',
    lineHeight: 1.4,
  },
  name: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  contactLine: {
    fontSize: 9,
    color: '#555',
    marginBottom: 2,
  },
  link: {
    color: '#2563eb',
    textDecoration: 'underline',
  },
  sectionHeading: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    borderBottom: '1pt solid #333',
    paddingBottom: 2,
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  jobTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  subLine: {
    fontSize: 9,
    color: '#555',
    marginBottom: 2,
  },
  bullet: {
    fontSize: 9.5,
    marginLeft: 12,
    marginBottom: 2,
    lineHeight: 1.35,
  },
  bodyText: {
    fontSize: 9.5,
    marginBottom: 3,
    lineHeight: 1.4,
  },
  skillsRow: {
    fontSize: 9.5,
    marginBottom: 2,
  },
  headerDivider: {
    borderBottom: '1.5pt solid #1a1a1a',
    marginTop: 6,
    marginBottom: 2,
  },
})

interface ParsedSection {
  heading: string
  content: string[]
}

function parseMarkdownCV(md: string): { name: string; contactLines: string[]; sections: ParsedSection[] } {
  const lines = md.split('\n')
  let name = ''
  const contactLines: string[] = []
  const sections: ParsedSection[] = []
  let currentSection: ParsedSection | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('# ')) {
      name = trimmed.slice(2).trim()
    } else if (trimmed.startsWith('## ')) {
      if (currentSection) sections.push(currentSection)
      currentSection = { heading: trimmed.slice(3).trim(), content: [] }
    } else if (!currentSection) {
      // Pre-section lines are contact info
      contactLines.push(trimmed.replace(/\*\*/g, ''))
    } else {
      currentSection.content.push(trimmed)
    }
  }
  if (currentSection) sections.push(currentSection)
  return { name, contactLines, sections }
}

interface Props {
  markdown: string
  profile: UserProfile
}

export function CVDocument({ markdown, profile }: Props) {
  const { name, contactLines, sections } = parseMarkdownCV(markdown)
  const displayName = name || profile.fullName

  return (
    <Document title={`${displayName} - Resume`} author={displayName}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <Text style={styles.name}>{displayName}</Text>
        {contactLines.map((line, i) => (
          <Text key={i} style={styles.contactLine}>{line}</Text>
        ))}
        {!contactLines.length && (
          <>
            <Text style={styles.contactLine}>{profile.email}{profile.phone ? ` · ${profile.phone}` : ''}{profile.location ? ` · ${profile.location}` : ''}</Text>
            {profile.linkedinUrl && (
              <Text style={styles.contactLine}>
                <Link src={profile.linkedinUrl} style={styles.link}>{profile.linkedinUrl}</Link>
                {profile.portfolioUrl && (
                  <Text> · <Link src={profile.portfolioUrl} style={styles.link}>{profile.portfolioUrl}</Link></Text>
                )}
              </Text>
            )}
          </>
        )}
        <View style={styles.headerDivider} />

        {/* Sections */}
        {sections.map((section, si) => (
          <View key={si}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            {section.content.map((line, li) => {
              if (line.startsWith('### ')) {
                return <Text key={li} style={styles.jobTitle}>{line.slice(4)}</Text>
              }
              if (line.startsWith('- ')) {
                return <Text key={li} style={styles.bullet}>• {line.slice(2).replace(/\*\*/g, '')}</Text>
              }
              if (line.startsWith('**') && line.endsWith('**')) {
                return <Text key={li} style={{ ...styles.bodyText, fontFamily: 'Helvetica-Bold' }}>{line.slice(2, -2)}</Text>
              }
              return <Text key={li} style={styles.bodyText}>{line.replace(/\*\*/g, '')}</Text>
            })}
          </View>
        ))}
      </Page>
    </Document>
  )
}
