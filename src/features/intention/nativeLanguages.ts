// The learner's own language, with an ISO-639-1 code attached.
//
// The target language stays free text — "Brazilian Portuguese" and "Kansai dialect" are
// legitimate destinations. The native language can't be, because two machines need a real
// code from it: Whisper transcribes far better when told the language, and Intl.Segmenter
// needs a locale to split words in scripts that don't use spaces.

import type { NativeLanguage } from '../../domain/entities'

export const NATIVE_LANGUAGES: NativeLanguage[] = [
  { name: 'English', code: 'en' },
  { name: 'Spanish', code: 'es' },
  { name: 'Portuguese', code: 'pt' },
  { name: 'French', code: 'fr' },
  { name: 'German', code: 'de' },
  { name: 'Italian', code: 'it' },
  { name: 'Dutch', code: 'nl' },
  { name: 'Polish', code: 'pl' },
  { name: 'Russian', code: 'ru' },
  { name: 'Ukrainian', code: 'uk' },
  { name: 'Romanian', code: 'ro' },
  { name: 'Swedish', code: 'sv' },
  { name: 'Norwegian', code: 'no' },
  { name: 'Danish', code: 'da' },
  { name: 'Finnish', code: 'fi' },
  { name: 'Greek', code: 'el' },
  { name: 'Turkish', code: 'tr' },
  { name: 'Arabic', code: 'ar' },
  { name: 'Hebrew', code: 'he' },
  { name: 'Persian', code: 'fa' },
  { name: 'Hindi', code: 'hi' },
  { name: 'Bengali', code: 'bn' },
  { name: 'Urdu', code: 'ur' },
  { name: 'Tamil', code: 'ta' },
  { name: 'Chinese', code: 'zh' },
  { name: 'Japanese', code: 'ja' },
  { name: 'Korean', code: 'ko' },
  { name: 'Vietnamese', code: 'vi' },
  { name: 'Thai', code: 'th' },
  { name: 'Indonesian', code: 'id' },
  { name: 'Filipino', code: 'tl' },
  { name: 'Swahili', code: 'sw' },
]

/** Free text, no code — transcription falls back to auto-detection. */
export const OTHER_NATIVE_LANGUAGE = 'other'

export function findNativeLanguage(code: string): NativeLanguage | undefined {
  return NATIVE_LANGUAGES.find((l) => l.code === code)
}
