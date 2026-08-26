export const CONNECTED_SPEECH_MECHANISMS = {
  "elision": {
    "title": "Elision",
    "hint": "Sounds disappear",
    "description": "A sound or syllable is omitted in connected speech."
  },
  "reduction": {
    "title": "Vowel reduction & weak forms",
    "hint": "Unstressed vowels weaken",
    "description": "An unstressed vowel becomes weaker, often moving toward schwa."
  },
  "coalescence": {
    "title": "Yod coalescence",
    "hint": "Two sounds merge into one",
    "description": "A consonant and /j/ combine into a new sound such as /tʃ/ or /dʒ/."
  },
  "t_variation": {
    "title": "T-flapping & glottalization",
    "hint": "T becomes /ɾ/ or /ʔ/",
    "description": "The /t/ sound is realized as a flap or a glottal stop."
  },
  "linking": {
    "title": "Linking & resyllabification",
    "hint": "Word boundaries shift",
    "description": "Sounds connect across words and can be heard as part of the following syllable."
  },
  "syllabic_consonant": {
    "title": "Syllabic consonants",
    "hint": "A consonant forms a syllable",
    "description": "A consonant carries the syllable without a separate vowel."
  }
} as const;

export type ConnectedSpeechMechanism =
  keyof typeof CONNECTED_SPEECH_MECHANISMS;

export const PRACTICE_FORMATS = {
  "atom": {
    "title": "One change at a time",
    "hint": "Hear one connected-speech process clearly."
  },
  "lexicon": {
    "title": "Common spoken forms",
    "hint": "Recognize established conversational forms as a whole."
  },
  "stack": {
    "title": "Real phrases",
    "hint": "Hear several connected-speech processes working together."
  }
} as const;

export type PracticeFormat = keyof typeof PRACTICE_FORMATS;

export type ConnectedSpeechCard = {
  id: string;
  text: string;
  pattern: string;
  ipa: string;
  kind: PracticeFormat;
  mechanisms: readonly [
    ConnectedSpeechMechanism,
    ...ConnectedSpeechMechanism[],
  ];
  rank: number;
  searchQuery?: string;
  alternateQuery?: string;
};

export const REUSED_PRESET_IDS = {
  "s001": "preset-0",
  "s002": "preset-1",
  "s006": "preset-2",
  "s011": "preset-3",
  "s005": "preset-4",
  "s007": "preset-5",
  "s008": "preset-7",
  "s021": "preset-8",
  "s012": "preset-9",
  "s020": "preset-10",
  "s027": "preset-12",
  "s016": "preset-14",
  "s036": "preset-15",
  "s028": "preset-16",
  "s031": "preset-17",
  "s042": "preset-19",
  "s044": "preset-21",
  "s046": "preset-22",
  "s043": "preset-23",
  "s045": "preset-25",
  "s094": "preset-27",
  "s095": "preset-28",
  "s096": "preset-30",
  "s089": "preset-32",
  "s090": "preset-33",
  "s091": "preset-34",
  "s092": "preset-35",
  "s093": "preset-36",
  "s081": "preset-38",
  "s082": "preset-39",
  "s083": "preset-43",
  "s084": "preset-44",
  "s085": "preset-45",
  "s086": "preset-46",
  "s087": "preset-47",
  "s088": "preset-48"
} as const;

export const LEGACY_PRESET_PHRASES = [
  {
    "id": "preset-6",
    "text": "you're gonna have to do it",
    "pattern": "[you're gonna] [have to] [do it]",
    "ipa": "jərgənə hæftə duːɪt"
  },
  {
    "id": "preset-11",
    "text": "I don't know what to do",
    "pattern": "[I don't know] [what to do]",
    "ipa": "aɪɾənoʊ wʌɾəduː"
  },
  {
    "id": "preset-13",
    "text": "you don't have to do that",
    "pattern": "[you don't] [have to] [do that]",
    "ipa": "jədoʊn hæftə duːðæt"
  },
  {
    "id": "preset-18",
    "text": "we should have done it",
    "pattern": "[we should have] [done it]",
    "ipa": "wiʃʊɾə dʌnɪt"
  },
  {
    "id": "preset-20",
    "text": "you would have had to",
    "pattern": "[you would have] [had to]",
    "ipa": "jəwʊɾə hæɾə"
  },
  {
    "id": "preset-24",
    "text": "it doesn't have to be that",
    "pattern": "[it doesn't] [have to be] [that]",
    "ipa": "ɪtdʌzn̩ hæftəbi ðæt"
  },
  {
    "id": "preset-26",
    "text": "I don't know about that",
    "pattern": "[I don't know] [about that]",
    "ipa": "aɪɾənoʊ əbaʊðæt"
  },
  {
    "id": "preset-29",
    "text": "I should have known that",
    "pattern": "[I should have known] [that]",
    "ipa": "aɪʃʊɾənoʊn ðət"
  },
  {
    "id": "preset-31",
    "text": "so what do you do",
    "pattern": "[so] [what do you do]",
    "ipa": "soʊ wʌɾəjəduː"
  },
  {
    "id": "preset-37",
    "text": "and that'll be the",
    "pattern": "[and that'll be] [the]",
    "ipa": "ənðæɾl̩bi ðə"
  },
  {
    "id": "preset-40",
    "text": "I'm gonna have to",
    "pattern": "[I'm gonna] [have to]",
    "ipa": "aɪmgənə hæftə"
  },
  {
    "id": "preset-41",
    "text": "there used to be a",
    "pattern": "[there used to be a]",
    "ipa": "ðərjuːstəbiːə"
  },
  {
    "id": "preset-42",
    "text": "you didn't have to",
    "pattern": "[you didn't] [have to]",
    "ipa": "jədɪdn̩ hæftə"
  },
  {
    "id": "preset-49",
    "text": "d'you know what I mean",
    "pattern": "[d'you know] [what I mean]",
    "ipa": "dʒənoʊ wʌɾaɪmiːn"
  }
] as const;

export const CONNECTED_SPEECH_CARDS = [
  {
    "id": "a01",
    "text": "tell him",
    "pattern": "[tell him]",
    "ipa": "tɛlɪm",
    "kind": "atom",
    "mechanisms": [
      "elision"
    ],
    "rank": 1
  },
  {
    "id": "a02",
    "text": "a couple of",
    "pattern": "[a couple of]",
    "ipa": "əkʌplə",
    "kind": "atom",
    "mechanisms": [
      "elision"
    ],
    "rank": 2
  },
  {
    "id": "a03",
    "text": "probably",
    "pattern": "probably",
    "ipa": "prɑbli",
    "kind": "atom",
    "mechanisms": [
      "elision"
    ],
    "rank": 3
  },
  {
    "id": "a04",
    "text": "I can see",
    "pattern": "[I can see]",
    "ipa": "aɪkn̩siː",
    "kind": "atom",
    "mechanisms": [
      "reduction"
    ],
    "rank": 4
  },
  {
    "id": "a05",
    "text": "it was there",
    "pattern": "[it was there]",
    "ipa": "ɪtwəzðɛr",
    "kind": "atom",
    "mechanisms": [
      "reduction"
    ],
    "rank": 5
  },
  {
    "id": "a06",
    "text": "more than that",
    "pattern": "[more than that]",
    "ipa": "mɔːrðənðæt",
    "kind": "atom",
    "mechanisms": [
      "reduction"
    ],
    "rank": 6
  },
  {
    "id": "a07",
    "text": "did you",
    "pattern": "[did you]",
    "ipa": "dɪdʒə",
    "kind": "atom",
    "mechanisms": [
      "coalescence"
    ],
    "rank": 7
  },
  {
    "id": "a08",
    "text": "don't you",
    "pattern": "[don't you]",
    "ipa": "doʊntʃə",
    "kind": "atom",
    "mechanisms": [
      "coalescence"
    ],
    "rank": 8
  },
  {
    "id": "a09",
    "text": "miss you",
    "pattern": "[miss you]",
    "ipa": "mɪʃə",
    "kind": "atom",
    "mechanisms": [
      "coalescence"
    ],
    "rank": 9
  },
  {
    "id": "a10",
    "text": "get it",
    "pattern": "[get it]",
    "ipa": "gɛɾɪt",
    "kind": "atom",
    "mechanisms": [
      "t_variation"
    ],
    "rank": 10
  },
  {
    "id": "a11",
    "text": "better",
    "pattern": "better",
    "ipa": "bɛɾər",
    "kind": "atom",
    "mechanisms": [
      "t_variation"
    ],
    "rank": 11
  },
  {
    "id": "a12",
    "text": "can't just",
    "pattern": "[can't just]",
    "ipa": "kænʔdʒəs",
    "kind": "atom",
    "mechanisms": [
      "t_variation"
    ],
    "rank": 12
  },
  {
    "id": "a13",
    "text": "an hour",
    "pattern": "[an hour]",
    "ipa": "ənaʊr",
    "kind": "atom",
    "mechanisms": [
      "linking"
    ],
    "rank": 13
  },
  {
    "id": "a14",
    "text": "made out",
    "pattern": "[made out]",
    "ipa": "meɪdaʊt",
    "kind": "atom",
    "mechanisms": [
      "linking"
    ],
    "rank": 14
  },
  {
    "id": "a15",
    "text": "an apple",
    "pattern": "[an apple]",
    "ipa": "ənæpl̩",
    "kind": "atom",
    "mechanisms": [
      "linking"
    ],
    "rank": 15
  },
  {
    "id": "a16",
    "text": "button",
    "pattern": "button",
    "ipa": "bʌʔn̩",
    "kind": "atom",
    "mechanisms": [
      "syllabic_consonant"
    ],
    "rank": 16
  },
  {
    "id": "a17",
    "text": "that'll",
    "pattern": "that'll",
    "ipa": "ðæɾl̩",
    "kind": "atom",
    "mechanisms": [
      "syllabic_consonant"
    ],
    "rank": 17
  },
  {
    "id": "a18",
    "text": "didn't",
    "pattern": "didn't",
    "ipa": "dɪdn̩",
    "kind": "atom",
    "mechanisms": [
      "syllabic_consonant"
    ],
    "rank": 18
  },
  {
    "id": "l01",
    "text": "gonna",
    "pattern": "gonna",
    "ipa": "gənə",
    "kind": "lexicon",
    "mechanisms": [
      "elision",
      "reduction"
    ],
    "rank": 1,
    "alternateQuery": "going to"
  },
  {
    "id": "l02",
    "text": "wanna",
    "pattern": "wanna",
    "ipa": "wɑnə",
    "kind": "lexicon",
    "mechanisms": [
      "elision",
      "reduction"
    ],
    "rank": 2,
    "alternateQuery": "want to"
  },
  {
    "id": "l03",
    "text": "gotta",
    "pattern": "gotta",
    "ipa": "gɑɾə",
    "kind": "lexicon",
    "mechanisms": [
      "t_variation",
      "reduction"
    ],
    "rank": 3,
    "alternateQuery": "got to"
  },
  {
    "id": "l04",
    "text": "kinda",
    "pattern": "kinda",
    "ipa": "kaɪndə",
    "kind": "lexicon",
    "mechanisms": [
      "elision"
    ],
    "rank": 4,
    "alternateQuery": "kind of"
  },
  {
    "id": "l05",
    "text": "hafta",
    "pattern": "hafta",
    "ipa": "hæftə",
    "kind": "lexicon",
    "mechanisms": [
      "elision",
      "reduction"
    ],
    "rank": 5,
    "alternateQuery": "have to"
  },
  {
    "id": "l06",
    "text": "dunno",
    "pattern": "dunno",
    "ipa": "dəˈnoʊ",
    "kind": "lexicon",
    "mechanisms": [
      "elision"
    ],
    "rank": 6,
    "alternateQuery": "don't know"
  },
  {
    "id": "l07",
    "text": "gimme",
    "pattern": "gimme",
    "ipa": "gɪmi",
    "kind": "lexicon",
    "mechanisms": [
      "elision"
    ],
    "rank": 7,
    "alternateQuery": "give me"
  },
  {
    "id": "l08",
    "text": "lemme",
    "pattern": "lemme",
    "ipa": "lɛmi",
    "kind": "lexicon",
    "mechanisms": [
      "elision"
    ],
    "rank": 8,
    "alternateQuery": "let me"
  },
  {
    "id": "l09",
    "text": "'em",
    "pattern": "'em",
    "ipa": "əm",
    "kind": "lexicon",
    "mechanisms": [
      "elision"
    ],
    "rank": 9,
    "alternateQuery": "give them"
  },
  {
    "id": "l10",
    "text": "cuz",
    "pattern": "cuz",
    "ipa": "kəz",
    "kind": "lexicon",
    "mechanisms": [
      "elision"
    ],
    "rank": 10,
    "alternateQuery": "because I"
  },
  {
    "id": "l11",
    "text": "sorta",
    "pattern": "sorta",
    "ipa": "sɔːrɾə",
    "kind": "lexicon",
    "mechanisms": [
      "elision",
      "t_variation"
    ],
    "rank": 11,
    "alternateQuery": "sort of"
  },
  {
    "id": "l12",
    "text": "gotcha",
    "pattern": "gotcha",
    "ipa": "gɑtʃə",
    "kind": "lexicon",
    "mechanisms": [
      "coalescence",
      "t_variation"
    ],
    "rank": 12,
    "alternateQuery": "got you"
  },
  {
    "id": "l13",
    "text": "shoulda",
    "pattern": "shoulda",
    "ipa": "ʃʊɾə",
    "kind": "lexicon",
    "mechanisms": [
      "elision",
      "t_variation"
    ],
    "rank": 13,
    "alternateQuery": "should have"
  },
  {
    "id": "l14",
    "text": "woulda",
    "pattern": "woulda",
    "ipa": "wʊɾə",
    "kind": "lexicon",
    "mechanisms": [
      "elision",
      "t_variation"
    ],
    "rank": 14,
    "alternateQuery": "would have"
  },
  {
    "id": "l15",
    "text": "coulda",
    "pattern": "coulda",
    "ipa": "kʊɾə",
    "kind": "lexicon",
    "mechanisms": [
      "elision",
      "t_variation"
    ],
    "rank": 15,
    "alternateQuery": "could have"
  },
  {
    "id": "l16",
    "text": "used to",
    "pattern": "[used to]",
    "ipa": "juːstə",
    "kind": "lexicon",
    "mechanisms": [
      "elision",
      "reduction"
    ],
    "rank": 16,
    "alternateQuery": "useta"
  },
  {
    "id": "l17",
    "text": "supposed to",
    "pattern": "[supposed to]",
    "ipa": "spoʊstə",
    "kind": "lexicon",
    "mechanisms": [
      "elision",
      "reduction"
    ],
    "rank": 17,
    "alternateQuery": "sposta"
  },
  {
    "id": "l18",
    "text": "has to",
    "pattern": "[has to]",
    "ipa": "hæstə",
    "kind": "lexicon",
    "mechanisms": [
      "elision",
      "reduction"
    ],
    "rank": 18,
    "alternateQuery": "hasta"
  },
  {
    "id": "l19",
    "text": "musta",
    "pattern": "musta",
    "ipa": "mʌstə",
    "kind": "lexicon",
    "mechanisms": [
      "elision",
      "reduction"
    ],
    "rank": 19,
    "alternateQuery": "must have"
  },
  {
    "id": "l20",
    "text": "oughta",
    "pattern": "oughta",
    "ipa": "ɔːɾə",
    "kind": "lexicon",
    "mechanisms": [
      "t_variation",
      "reduction"
    ],
    "rank": 20,
    "alternateQuery": "ought to"
  },
  {
    "id": "l21",
    "text": "whatcha",
    "pattern": "whatcha",
    "ipa": "wʌtʃə",
    "kind": "lexicon",
    "mechanisms": [
      "coalescence",
      "reduction"
    ],
    "rank": 21,
    "alternateQuery": "what are you"
  },
  {
    "id": "l22",
    "text": "innit",
    "pattern": "innit",
    "ipa": "ɪnɪt",
    "kind": "lexicon",
    "mechanisms": [
      "elision",
      "syllabic_consonant"
    ],
    "rank": 22,
    "alternateQuery": "isn't it"
  },
  {
    "id": "preset-0",
    "text": "I don't know if it's",
    "pattern": "[I don't know] [if it's]",
    "ipa": "aɪɾəˈnoʊ ɪfɪts",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "t_variation"
    ],
    "rank": 1
  },
  {
    "id": "preset-1",
    "text": "you know what I mean",
    "pattern": "[you know] [what I mean]",
    "ipa": "jənoʊ wʌɾaɪ miːn",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "reduction"
    ],
    "rank": 2
  },
  {
    "id": "s003",
    "text": "one of the",
    "pattern": "[one of the]",
    "ipa": "wʌnəðə",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "reduction"
    ],
    "rank": 3
  },
  {
    "id": "s004",
    "text": "a couple of",
    "pattern": "[a couple of]",
    "ipa": "əkʌpləv",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 4
  },
  {
    "id": "preset-4",
    "text": "it's going to be a",
    "pattern": "[it's] [going to be a]",
    "ipa": "ɪts gənə biːə",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "reduction"
    ],
    "rank": 5
  },
  {
    "id": "preset-2",
    "text": "all you have to do is",
    "pattern": "[all you] [have to] [do is]",
    "ipa": "ɔːljə hæftə duːɪz",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "reduction"
    ],
    "rank": 6
  },
  {
    "id": "preset-5",
    "text": "there's a lot of it",
    "pattern": "[there's a lot of it]",
    "ipa": "ðərzəlɑɾəvɪt",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "t_variation"
    ],
    "rank": 7
  },
  {
    "id": "preset-7",
    "text": "at the end of the day",
    "pattern": "[at the end of the day]",
    "ipa": "əɾðiɛndəvðədeɪ",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "elision"
    ],
    "rank": 8
  },
  {
    "id": "s009",
    "text": "most of the time",
    "pattern": "[most of the time]",
    "ipa": "moʊsəvðətaɪm",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 9
  },
  {
    "id": "s010",
    "text": "some of them",
    "pattern": "[some of them]",
    "ipa": "sʌməvəm",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 10
  },
  {
    "id": "preset-3",
    "text": "I didn't know that it was",
    "pattern": "[I didn't know] [that it was]",
    "ipa": "aɪ dɪdn̩ noʊ ðəɾɪwəz",
    "kind": "stack",
    "mechanisms": [
      "syllabic_consonant",
      "elision",
      "reduction"
    ],
    "rank": 11
  },
  {
    "id": "preset-9",
    "text": "what do you want me to do",
    "pattern": "[what do you] [want me to] [do]",
    "ipa": "wʌɾəjə wʌnmɪɾə duː",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "elision"
    ],
    "rank": 12
  },
  {
    "id": "s013",
    "text": "all of a sudden",
    "pattern": "[all of a sudden]",
    "ipa": "ɔːləvəsʌdn̩",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "syllabic_consonant"
    ],
    "rank": 13
  },
  {
    "id": "s014",
    "text": "or something like that",
    "pattern": "[or something] [like that]",
    "ipa": "ərsʌmpm̩ laɪkðæt",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "coalescence"
    ],
    "rank": 14
  },
  {
    "id": "s015",
    "text": "and stuff like that",
    "pattern": "[and stuff] [like that]",
    "ipa": "ənstʌf laɪkðæt",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 15
  },
  {
    "id": "preset-14",
    "text": "did you tell him about it",
    "pattern": "[did you] [tell him] [about it]",
    "ipa": "dɪdʒə tɛlɪm əbaʊɾɪt",
    "kind": "stack",
    "mechanisms": [
      "coalescence",
      "elision",
      "t_variation"
    ],
    "rank": 16
  },
  {
    "id": "s017",
    "text": "I was gonna say",
    "pattern": "[I was gonna] [say]",
    "ipa": "aɪwəzgənə seɪ",
    "kind": "stack",
    "mechanisms": [
      "reduction",
      "elision"
    ],
    "rank": 17
  },
  {
    "id": "s018",
    "text": "what's going on",
    "pattern": "[what's going on]",
    "ipa": "wʌsgoʊɪnɑn",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 18
  },
  {
    "id": "s019",
    "text": "how's it going",
    "pattern": "[how's it going]",
    "ipa": "haʊzɪɾgoʊɪn",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "elision"
    ],
    "rank": 19
  },
  {
    "id": "preset-10",
    "text": "it should have been a",
    "pattern": "[it should have been a]",
    "ipa": "ɪtʃʊɾəbɪnə",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "t_variation"
    ],
    "rank": 20
  },
  {
    "id": "preset-8",
    "text": "I would have thought that",
    "pattern": "[I would have] [thought that]",
    "ipa": "aɪwʊɾə θɔːtðət",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "t_variation"
    ],
    "rank": 21
  },
  {
    "id": "s022",
    "text": "what do you think",
    "pattern": "[what do you think]",
    "ipa": "wʌɾəjəθɪŋk",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "elision"
    ],
    "rank": 22
  },
  {
    "id": "s023",
    "text": "I don't think so",
    "pattern": "[I don't think so]",
    "ipa": "aɪdoʊnθɪŋksoʊ",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 23
  },
  {
    "id": "s024",
    "text": "by the way",
    "pattern": "[by the way]",
    "ipa": "baɪðəweɪ",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 24
  },
  {
    "id": "s025",
    "text": "at the same time",
    "pattern": "[at the same time]",
    "ipa": "əɾðəseɪmtaɪm",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "elision"
    ],
    "rank": 25
  },
  {
    "id": "s026",
    "text": "the other day",
    "pattern": "[the other day]",
    "ipa": "ðiʌðərdeɪ",
    "kind": "stack",
    "mechanisms": [
      "linking"
    ],
    "rank": 26
  },
  {
    "id": "preset-12",
    "text": "there have been a lot of",
    "pattern": "[there have been a] [lot of]",
    "ipa": "ðərəvbɪnə lɑɾəv",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 27
  },
  {
    "id": "preset-16",
    "text": "I'll let you know if",
    "pattern": "[I'll let you know] [if]",
    "ipa": "aɪl lɛtʃə noʊ ɪf",
    "kind": "stack",
    "mechanisms": [
      "coalescence"
    ],
    "rank": 28
  },
  {
    "id": "s029",
    "text": "as far as I know",
    "pattern": "[as far as I know]",
    "ipa": "əzfɑrəzaɪnoʊ",
    "kind": "stack",
    "mechanisms": [
      "reduction",
      "linking"
    ],
    "rank": 29
  },
  {
    "id": "s030",
    "text": "for the most part",
    "pattern": "[for the most part]",
    "ipa": "fərðəmoʊspɑrt",
    "kind": "stack",
    "mechanisms": [
      "reduction",
      "elision"
    ],
    "rank": 30
  },
  {
    "id": "preset-17",
    "text": "that's what I'm talking about",
    "pattern": "[that's] [what I'm] [talking about]",
    "ipa": "ðæts wʌɾaɪm tɔːkɪŋəbaʊt",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "elision"
    ],
    "rank": 31
  },
  {
    "id": "s032",
    "text": "I actually think that",
    "pattern": "[I actually] [think that]",
    "ipa": "aɪækʃli θɪŋkðət",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 32
  },
  {
    "id": "s033",
    "text": "I'll probably just",
    "pattern": "[I'll probably just]",
    "ipa": "aɪlprɑblidʒəs",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 33
  },
  {
    "id": "s034",
    "text": "just because I",
    "pattern": "[just because I]",
    "ipa": "dʒəskəzaɪ",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "linking"
    ],
    "rank": 34
  },
  {
    "id": "s035",
    "text": "I just wanted to",
    "pattern": "[I just] [wanted to]",
    "ipa": "aɪdʒəs wɑnɪɾə",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "t_variation"
    ],
    "rank": 35
  },
  {
    "id": "preset-15",
    "text": "it used to be a lot",
    "pattern": "[it used to be a] [lot]",
    "ipa": "ɪtjuːstəbiːə lɑt",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "linking"
    ],
    "rank": 36
  },
  {
    "id": "s037",
    "text": "hold on a second",
    "pattern": "[hold on a second]",
    "ipa": "hoʊldɑnəsɛkn̩",
    "kind": "stack",
    "mechanisms": [
      "linking",
      "syllabic_consonant"
    ],
    "rank": 37
  },
  {
    "id": "s038",
    "text": "give me a second",
    "pattern": "[give me a second]",
    "ipa": "gɪmiəsɛkn̩",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "syllabic_consonant"
    ],
    "rank": 38
  },
  {
    "id": "s039",
    "text": "how do you know",
    "pattern": "[how do you know]",
    "ipa": "haʊdəjənoʊ",
    "kind": "stack",
    "mechanisms": [
      "reduction",
      "elision"
    ],
    "rank": 39
  },
  {
    "id": "s040",
    "text": "when did you",
    "pattern": "[when did you]",
    "ipa": "wɛndɪdʒə",
    "kind": "stack",
    "mechanisms": [
      "coalescence"
    ],
    "rank": 40
  },
  {
    "id": "s041",
    "text": "what did I",
    "pattern": "[what did I]",
    "ipa": "wʌɾɪɾaɪ",
    "kind": "stack",
    "mechanisms": [
      "t_variation"
    ],
    "rank": 41
  },
  {
    "id": "preset-19",
    "text": "what have you been up to",
    "pattern": "[what have you] [been up to]",
    "ipa": "wʌɾəvjə bɪnʌptə",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "coalescence"
    ],
    "rank": 42
  },
  {
    "id": "preset-23",
    "text": "why don't you just ask her",
    "pattern": "[why don't you] [just ask her]",
    "ipa": "waɪdoʊntʃə dʒəstæskər",
    "kind": "stack",
    "mechanisms": [
      "coalescence",
      "elision"
    ],
    "rank": 43
  },
  {
    "id": "preset-21",
    "text": "I couldn't get a hold of him",
    "pattern": "[I couldn't] [get a hold of him]",
    "ipa": "aɪkʊdn̩ gɛɾəhoʊldəvɪm",
    "kind": "stack",
    "mechanisms": [
      "syllabic_consonant",
      "t_variation",
      "elision"
    ],
    "rank": 44
  },
  {
    "id": "preset-25",
    "text": "he must have been the one",
    "pattern": "[he must have been] [the one]",
    "ipa": "imʌstəbɪn ðəwʌn",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "reduction"
    ],
    "rank": 45
  },
  {
    "id": "preset-22",
    "text": "there could have been a",
    "pattern": "[there could have been a]",
    "ipa": "ðərkʊɾəbɪnə",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "t_variation"
    ],
    "rank": 46
  },
  {
    "id": "s047",
    "text": "tell them I'll",
    "pattern": "[tell them I'll]",
    "ipa": "tɛləmaɪl",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 47
  },
  {
    "id": "s048",
    "text": "it doesn't matter",
    "pattern": "[it doesn't matter]",
    "ipa": "ɪtdʌzn̩mæɾər",
    "kind": "stack",
    "mechanisms": [
      "syllabic_consonant",
      "t_variation"
    ],
    "rank": 48
  },
  {
    "id": "s049",
    "text": "nothing to do with",
    "pattern": "[nothing to do with]",
    "ipa": "nʌθɪntəduːwɪθ",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 49
  },
  {
    "id": "s050",
    "text": "look at it",
    "pattern": "[look at it]",
    "ipa": "lʊkəɾɪt",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "linking"
    ],
    "rank": 50
  },
  {
    "id": "s051",
    "text": "talk about it",
    "pattern": "[talk about it]",
    "ipa": "tɔːkəbaʊɾɪt",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "linking"
    ],
    "rank": 51
  },
  {
    "id": "s052",
    "text": "what about it",
    "pattern": "[what about it]",
    "ipa": "wʌɾəbaʊɾɪt",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "linking"
    ],
    "rank": 52
  },
  {
    "id": "s053",
    "text": "more or less",
    "pattern": "[more or less]",
    "ipa": "mɔːrərlɛs",
    "kind": "stack",
    "mechanisms": [
      "reduction",
      "linking"
    ],
    "rank": 53
  },
  {
    "id": "s054",
    "text": "one or two",
    "pattern": "[one or two]",
    "ipa": "wʌnərtuː",
    "kind": "stack",
    "mechanisms": [
      "reduction",
      "linking"
    ],
    "rank": 54
  },
  {
    "id": "s055",
    "text": "more than a",
    "pattern": "[more than a]",
    "ipa": "mɔːrðənə",
    "kind": "stack",
    "mechanisms": [
      "reduction"
    ],
    "rank": 55
  },
  {
    "id": "s056",
    "text": "better than that",
    "pattern": "[better than that]",
    "ipa": "bɛɾərðənðæt",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "reduction"
    ],
    "rank": 56
  },
  {
    "id": "s057",
    "text": "as long as you",
    "pattern": "[as long as you]",
    "ipa": "əzlɔŋəzjə",
    "kind": "stack",
    "mechanisms": [
      "reduction",
      "coalescence"
    ],
    "rank": 57
  },
  {
    "id": "s058",
    "text": "as soon as I",
    "pattern": "[as soon as I]",
    "ipa": "əzsuːnəzaɪ",
    "kind": "stack",
    "mechanisms": [
      "reduction",
      "linking"
    ],
    "rank": 58
  },
  {
    "id": "s059",
    "text": "quite a bit",
    "pattern": "[quite a bit]",
    "ipa": "kwaɪɾəbɪt",
    "kind": "stack",
    "mechanisms": [
      "t_variation"
    ],
    "rank": 59
  },
  {
    "id": "s060",
    "text": "a bit of a",
    "pattern": "[a bit of a]",
    "ipa": "əbɪɾəvə",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "elision"
    ],
    "rank": 60
  },
  {
    "id": "s061",
    "text": "a whole lot of",
    "pattern": "[a whole lot of]",
    "ipa": "əhoʊllɑɾəv",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 61
  },
  {
    "id": "s062",
    "text": "that kind of thing",
    "pattern": "[that kind of thing]",
    "ipa": "ðætkaɪndəθɪŋ",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 62
  },
  {
    "id": "s063",
    "text": "this sort of thing",
    "pattern": "[this sort of thing]",
    "ipa": "ðɪssɔːrɾəθɪŋ",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "elision"
    ],
    "rank": 63
  },
  {
    "id": "s064",
    "text": "the thing is",
    "pattern": "[the thing is]",
    "ipa": "ðəθɪŋɪz",
    "kind": "stack",
    "mechanisms": [
      "linking"
    ],
    "rank": 64
  },
  {
    "id": "s065",
    "text": "in the first place",
    "pattern": "[in the first place]",
    "ipa": "ɪnðəfərsspleɪs",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 65
  },
  {
    "id": "s066",
    "text": "in a minute",
    "pattern": "[in a minute]",
    "ipa": "ɪnəmɪnɪt",
    "kind": "stack",
    "mechanisms": [
      "linking",
      "t_variation"
    ],
    "rank": 66
  },
  {
    "id": "s067",
    "text": "for a minute",
    "pattern": "[for a minute]",
    "ipa": "fərəmɪnɪt",
    "kind": "stack",
    "mechanisms": [
      "reduction",
      "linking"
    ],
    "rank": 67
  },
  {
    "id": "s068",
    "text": "thanks for the",
    "pattern": "[thanks for the]",
    "ipa": "θæŋksfərðə",
    "kind": "stack",
    "mechanisms": [
      "reduction"
    ],
    "rank": 68
  },
  {
    "id": "s069",
    "text": "put it in the",
    "pattern": "[put it in the]",
    "ipa": "pʊɾɪɾɪnðə",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "linking"
    ],
    "rank": 69
  },
  {
    "id": "s070",
    "text": "I can see that",
    "pattern": "[I can see that]",
    "ipa": "aɪkn̩siːðæt",
    "kind": "stack",
    "mechanisms": [
      "reduction",
      "syllabic_consonant"
    ],
    "rank": 70
  },
  {
    "id": "s071",
    "text": "you can't just",
    "pattern": "[you can't just]",
    "ipa": "jəkænʔdʒəs",
    "kind": "stack",
    "mechanisms": [
      "t_variation"
    ],
    "rank": 71
  },
  {
    "id": "s072",
    "text": "we're not gonna",
    "pattern": "[we're not gonna]",
    "ipa": "wərnɑɾgənə",
    "kind": "stack",
    "mechanisms": [
      "reduction",
      "t_variation",
      "elision"
    ],
    "rank": 72
  },
  {
    "id": "s073",
    "text": "there you go",
    "pattern": "[there you go]",
    "ipa": "ðɛrjəgoʊ",
    "kind": "stack",
    "mechanisms": [
      "reduction"
    ],
    "rank": 73
  },
  {
    "id": "s074",
    "text": "come and get it",
    "pattern": "[come and get it]",
    "ipa": "kʌmənɡɛɾɪt",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "t_variation"
    ],
    "rank": 74
  },
  {
    "id": "s075",
    "text": "nice and easy",
    "pattern": "[nice and easy]",
    "ipa": "naɪsəniːzi",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "linking"
    ],
    "rank": 75
  },
  {
    "id": "s076",
    "text": "more and more",
    "pattern": "[more and more]",
    "ipa": "mɔːrənmɔːr",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 76
  },
  {
    "id": "s077",
    "text": "I said that I",
    "pattern": "[I said that I]",
    "ipa": "aɪsɛdðəɾaɪ",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "reduction"
    ],
    "rank": 77
  },
  {
    "id": "s078",
    "text": "take a look at this",
    "pattern": "[take a look at this]",
    "ipa": "teɪkəlʊkəɾðɪs",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "linking"
    ],
    "rank": 78
  },
  {
    "id": "s079",
    "text": "let me get this straight",
    "pattern": "[let me] [get this straight]",
    "ipa": "lɛmiː gɛɾðɪsstreɪt",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "t_variation"
    ],
    "rank": 79
  },
  {
    "id": "s080",
    "text": "most of us",
    "pattern": "[most of us]",
    "ipa": "moʊsəvəs",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "reduction"
    ],
    "rank": 80
  },
  {
    "id": "preset-38",
    "text": "I think there'll be a",
    "pattern": "[I think] [there'll be a]",
    "ipa": "aɪθɪŋk ðɛrl̩biə",
    "kind": "stack",
    "mechanisms": [
      "syllabic_consonant",
      "elision"
    ],
    "rank": 81
  },
  {
    "id": "preset-39",
    "text": "if there'd been",
    "pattern": "[if there'd been]",
    "ipa": "ɪfðərdbɪn",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 82
  },
  {
    "id": "preset-43",
    "text": "that's it, isn't it",
    "pattern": "[that's it] [isn't it]",
    "ipa": "ðætsɪt ɪnɪt",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "syllabic_consonant"
    ],
    "rank": 83
  },
  {
    "id": "preset-44",
    "text": "get out of it",
    "pattern": "[get out of it]",
    "ipa": "gɛɾaʊɾəvɪt",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "linking"
    ],
    "rank": 84
  },
  {
    "id": "preset-45",
    "text": "an hour and a half",
    "pattern": "[an hour and a half]",
    "ipa": "ənaʊrənəhæf",
    "kind": "stack",
    "mechanisms": [
      "linking",
      "elision"
    ],
    "rank": 85
  },
  {
    "id": "preset-46",
    "text": "it's kind of a",
    "pattern": "[it's kind of a]",
    "ipa": "ɪtskaɪndəvə",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 86
  },
  {
    "id": "preset-47",
    "text": "not at all",
    "pattern": "[not at all]",
    "ipa": "nɑɾəɾɔːl",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "linking"
    ],
    "rank": 87
  },
  {
    "id": "preset-48",
    "text": "let me know what you",
    "pattern": "[let me know] [what you]",
    "ipa": "lɛmiːnoʊ wʌtʃə",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "coalescence"
    ],
    "rank": 88
  },
  {
    "id": "preset-32",
    "text": "could you give me a",
    "pattern": "[could you] [give me a]",
    "ipa": "kʊdʒə gɪmiə",
    "kind": "stack",
    "mechanisms": [
      "coalescence",
      "elision"
    ],
    "rank": 89
  },
  {
    "id": "preset-33",
    "text": "what did he say",
    "pattern": "[what did he say]",
    "ipa": "wʌɾɪɾiseɪ",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "elision"
    ],
    "rank": 90
  },
  {
    "id": "preset-34",
    "text": "how was he supposed to",
    "pattern": "[how was he] [supposed to]",
    "ipa": "haʊwəzi spoʊstə",
    "kind": "stack",
    "mechanisms": [
      "elision",
      "reduction"
    ],
    "rank": 91
  },
  {
    "id": "preset-35",
    "text": "just give 'em a",
    "pattern": "[just give 'em a]",
    "ipa": "dʒəsgɪvəmə",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 92
  },
  {
    "id": "preset-36",
    "text": "I did it for her",
    "pattern": "[I did it] [for her]",
    "ipa": "aɪdɪɾɪt fərər",
    "kind": "stack",
    "mechanisms": [
      "t_variation",
      "elision",
      "reduction"
    ],
    "rank": 93
  },
  {
    "id": "preset-27",
    "text": "that'll have to do for now",
    "pattern": "[that'll] [have to do] [for now]",
    "ipa": "ðæɾl̩ hæftəduː fərnaʊ",
    "kind": "stack",
    "mechanisms": [
      "syllabic_consonant",
      "elision",
      "reduction"
    ],
    "rank": 94
  },
  {
    "id": "preset-28",
    "text": "it wasn't supposed to be",
    "pattern": "[it wasn't] [supposed to be]",
    "ipa": "ɪtwʌzn̩ spoʊstəbi",
    "kind": "stack",
    "mechanisms": [
      "syllabic_consonant",
      "elision"
    ],
    "rank": 95
  },
  {
    "id": "preset-30",
    "text": "what would you do if",
    "pattern": "[what would you] [do if]",
    "ipa": "wʌwʊdʒə duːɪf",
    "kind": "stack",
    "mechanisms": [
      "coalescence",
      "reduction"
    ],
    "rank": 96
  },
  {
    "id": "s097",
    "text": "in fact",
    "pattern": "[in fact]",
    "ipa": "ɪnfækt",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 97
  },
  {
    "id": "s098",
    "text": "up and down",
    "pattern": "[up and down]",
    "ipa": "ʌpənˈdaʊn",
    "kind": "stack",
    "mechanisms": [
      "elision"
    ],
    "rank": 98
  },
  {
    "id": "s099",
    "text": "sooner or later",
    "pattern": "[sooner or later]",
    "ipa": "suːnərərleɪɾər",
    "kind": "stack",
    "mechanisms": [
      "reduction",
      "t_variation"
    ],
    "rank": 99
  },
  {
    "id": "s100",
    "text": "I told you so",
    "pattern": "[I told you so]",
    "ipa": "aɪtoʊldʒəsoʊ",
    "kind": "stack",
    "mechanisms": [
      "coalescence"
    ],
    "rank": 100
  }
] as const satisfies readonly ConnectedSpeechCard[];

type CatalogValidationInput = {
  cards: readonly ConnectedSpeechCard[];
  mechanisms: Readonly<Record<string, unknown>>;
  formats: Readonly<Record<PracticeFormat, unknown>>;
  reusedPresetIds: Readonly<Record<string, string>>;
  legacyPhrases: readonly unknown[];
};

const EXPECTED_CATALOG_COUNTS: Record<PracticeFormat, number> = { atom: 18, lexicon: 22, stack: 100 };

function validateCatalogCard(
  card: ConnectedSpeechCard,
  formats: CatalogValidationInput["formats"],
  knownMechanisms: ReadonlySet<string>,
  ids: ReadonlySet<string>,
) {
  if (ids.has(card.id)) throw new Error(`Duplicate catalog id: ${card.id}`);
  if (!Object.hasOwn(formats, card.kind)) {
    throw new Error(`Catalog card ${card.id} has unknown practice format: ${card.kind}`);
  }
  if (!card.text.trim() || !card.pattern.trim() || !card.ipa.trim()) {
    throw new Error(`Catalog card ${card.id} requires text, pattern, and IPA`);
  }
  const openingBrackets = card.pattern.match(/\[/g)?.length ?? 0;
  const closingBrackets = card.pattern.match(/\]/g)?.length ?? 0;
  if (openingBrackets !== closingBrackets || /\[\s*\]/.test(card.pattern)) {
    throw new Error(`Catalog card ${card.id} has malformed sound-block brackets`);
  }
  if (!card.mechanisms.length || card.mechanisms.some((mechanism) => !knownMechanisms.has(mechanism))) {
    throw new Error(`Catalog card ${card.id} needs at least one known mechanism`);
  }
  if (card.kind === "atom" && card.mechanisms.length !== 1) {
    throw new Error(`Atom card ${card.id} must have exactly one mechanism`);
  }
}

function validateRankSequences(cards: readonly ConnectedSpeechCard[], formats: CatalogValidationInput["formats"]) {
  for (const kind of Object.keys(formats) as PracticeFormat[]) {
    const ranks = cards
      .filter((card) => card.kind === kind)
      .map((card) => card.rank)
      .sort((a, b) => a - b);
    if (ranks.some((rank, index) => rank !== index + 1)) {
      throw new Error(`Invalid ${kind} ranks: expected 1 through ${ranks.length}`);
    }
  }
}

function validateCatalogCounts(cards: readonly ConnectedSpeechCard[], byKind: Record<PracticeFormat, number>) {
  if (cards.length !== 140) {
    throw new Error(`Connected-speech catalog must contain 140 cards; received ${cards.length}`);
  }
  for (const kind of Object.keys(EXPECTED_CATALOG_COUNTS) as PracticeFormat[]) {
    if (byKind[kind] !== EXPECTED_CATALOG_COUNTS[kind]) {
      throw new Error(`Connected-speech catalog must contain ${EXPECTED_CATALOG_COUNTS[kind]} ${kind} cards; received ${byKind[kind]}`);
    }
  }
}

function validateAtomMechanismCounts(cards: readonly ConnectedSpeechCard[], knownMechanisms: ReadonlySet<string>) {
  for (const mechanism of knownMechanisms) {
    const atomCount = cards.filter((card) => (
      card.kind === "atom" && card.mechanisms.includes(mechanism as ConnectedSpeechMechanism)
    )).length;
    if (atomCount !== 3) {
      throw new Error(`Atom mechanism ${mechanism} must have exactly 3 examples`);
    }
  }
}

export function validateConnectedSpeechCatalog(input: CatalogValidationInput) {
  const byKind: Record<PracticeFormat, number> = { atom: 0, lexicon: 0, stack: 0 };
  const ids = new Set<string>();
  const knownMechanisms = new Set(Object.keys(input.mechanisms));
  for (const card of input.cards) {
    validateCatalogCard(card, input.formats, knownMechanisms, ids);
    ids.add(card.id);
    byKind[card.kind] += 1;
  }

  validateRankSequences(input.cards, input.formats);
  validateCatalogCounts(input.cards, byKind);
  validateAtomMechanismCounts(input.cards, knownMechanisms);

  return {
    cards: input.cards.length,
    byKind,
    mechanisms: Object.keys(input.mechanisms).length,
    reusedPresetIds: Object.keys(input.reusedPresetIds).length,
    legacyPhrases: input.legacyPhrases.length,
  };
}

export const CONNECTED_SPEECH_CATALOG_VALIDATION = validateConnectedSpeechCatalog({
  cards: CONNECTED_SPEECH_CARDS,
  mechanisms: CONNECTED_SPEECH_MECHANISMS,
  formats: PRACTICE_FORMATS,
  reusedPresetIds: REUSED_PRESET_IDS,
  legacyPhrases: LEGACY_PRESET_PHRASES,
});
