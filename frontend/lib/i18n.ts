import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      welcomeTitle: "Explore the history that shaped today's YMCA.",
      welcomeSubtitle: "Ask questions, discover stories, and draw lessons from the past to inspire leadership today.",
      starterCrisisTitle: "The YMCA in Times of Crisis",
      starterCrisisDesc: "How the Y responded when communities needed it most",
      starterYouthTitle: "Youth Programs Through the Decades",
      starterYouthDesc: "How the Y shaped young lives across generations",
      starterLeadershipTitle: "Leadership & Social Responsibility",
      starterLeadershipDesc: "Stories of courage, change, and moral leadership",
      starterInnovationTitle: "Innovation and Change at the Y",
      starterInnovationDesc: "From basketball to new models of community service",
      inputPlaceholder: "Ask your own question about YMCA history, programs, or leadership…",
      storyLabel: "STORY",
      whyItMatteredLabel: "Why It Mattered",
      lessonsLabel: "Lessons & Themes",
      modernReflectionLabel: "What this moment teaches us today",
      timelineLabel: "Timeline",
      locationsLabel: "Locations",
      keyPeopleLabel: "Key People",
      sourcesLabel: "Sources",
      sourceLabel: "Source",
      exploreFurtherLabel: "Explore further:",
      viewSource: "View Source"
    }
  },
  es: { translation: {} },
  fr: { translation: {} },
  de: { translation: {} },
  it: { translation: {} },
  pt: { translation: {} },
  zh: { translation: {} },
  ja: { translation: {} },
  ko: { translation: {} },
  ar: { translation: {} },
  hi: { translation: {} },
  ru: { translation: {} }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
