export type QuestionType = 'edgy' | 'funny' | 'factual' | 'trueFalse' | 'currentEvents';

export interface TriviaQuestion {
  id: string;
  category: string;
  text: string;
  options: string[];
  correctAnswer: number;
  funniestAnswer: number;
  type: QuestionType;
  era?: string;
}

export const triviaQuestions: TriviaQuestion[] = [
  // EDGY QUESTIONS (50%)
  {
    id: 'edgy-1',
    category: 'Dating Red Flags Through History',
    text: 'If Cleopatra had a dating app, her biggest red flag would be:',
    options: [
      'Has trust issues with snakes',
      'Killed last two boyfriends',
      'Only dates powerful men',
      'Speaks dead language'
    ],
    correctAnswer: 1,
    funniestAnswer: 1,
    type: 'edgy',
    era: 'Ancient'
  },
  {
    id: 'edgy-2',
    category: 'Things Your Ex Would Google',
    text: 'A vampire applying for health insurance would most likely claim:',
    options: [
      'Pre-existing condition',
      'Night shift worker',
      'Dietary restrictions',
      'Allergic to sunlight'
    ],
    correctAnswer: 3,
    funniestAnswer: 0,
    type: 'edgy'
  },
  {
    id: 'edgy-3',
    category: 'Midlife Crisis Shopping List',
    text: 'If a mid-life crisis went to Victoria\'s Secret, it would buy:',
    options: [
      'Wonder Bra',
      'Spanx',
      'I\'m too old for this t-shirt',
      'Gift card for someone younger'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'edgy-4',
    category: 'Red Flags in Historical Context',
    text: 'If Henry VIII had Tinder, his bio would say:',
    options: [
      'Looking for wife #7',
      'Divorced (x6)',
      'Head over heels for you',
      'Swipe right to lose your head'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'edgy',
    era: '1500s'
  },

  // FUNNY QUESTIONS (25%)
  {
    id: 'funny-1',
    category: '70s TV Gold',
    text: 'Which show would a lava lamp most likely binge-watch:',
    options: [
      'The Brady Bunch',
      'All in the Family',
      'The Love Boat',
      'That 70s Show'
    ],
    correctAnswer: 3,
    funniestAnswer: 3,
    type: 'funny',
    era: '1970s'
  },
  {
    id: 'funny-2',
    category: 'Things That Make You Go Hmm',
    text: 'An octopus planning a family reunion would binge-watch:',
    options: [
      'Eight is Enough',
      'Jon & Kate Plus 8',
      'Sister Wives',
      'The Octonauts'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'funny-3',
    category: 'Things Your GPS Would Say',
    text: 'A vampire\'s ideal navigation voice would be:',
    options: [
      'Morgan Freeman',
      'That dead-inside Siri lady',
      'Gordon Ramsay',
      'Dracula himself'
    ],
    correctAnswer: 3,
    funniestAnswer: 1,
    type: 'funny'
  },

  // VIDEO GAME REFERENCES
  {
    id: 'gaming-1',
    category: '80s Arcade Therapy',
    text: 'If Mario had a dating profile, his biggest red flag would be:',
    options: [
      'Obsessed with princesses in other castles',
      'Job involves breaking into homes',
      'Eats mushrooms for strength',
      'Plumber who never fixes pipes'
    ],
    correctAnswer: 1,
    funniestAnswer: 0,
    type: 'edgy',
    era: '1980s'
  },
  {
    id: 'gaming-2',
    category: 'Video Game Logic in Real Life',
    text: 'Pac-Man\'s Yelp review of a nightclub would complain about:',
    options: [
      'Too many ghosts on the dance floor',
      'Not enough pills',
      'Maze-like layout',
      'Terrible dot selection'
    ],
    correctAnswer: 2,
    funniestAnswer: 0,
    type: 'funny'
  },

  // CURRENT EVENTS (10%)
  {
    id: 'current-1',
    category: '2026 Chaos Chronicles',
    text: 'Which current trend would confuse a 1990s person most:',
    options: [
      'AI girlfriends',
      '$7 coffee',
      'People paying for Twitter',
      'Influencer is a real job'
    ],
    correctAnswer: 3,
    funniestAnswer: 0,
    type: 'currentEvents'
  },
  {
    id: 'current-2',
    category: 'TikTok vs Reality',
    text: 'Which 2026 trend would make a medieval peasant cry:',
    options: [
      'Avocado toast prices',
      'Ring lights',
      'Paying for parking apps',
      'Subscription services for everything'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'currentEvents'
  },

  // STALE FACTUAL (10%) - Made funny through category placement
  {
    id: 'factual-1',
    category: 'Things Your Therapist Would Say',
    text: 'The capital of Vermont is:',
    options: [
      'Montpelier',
      'Burlington',
      'Rutland',
      'Maple Syrup City'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'factual'
  },
  {
    id: 'factual-2',
    category: 'Wikipedia Rabbit Holes',
    text: 'The shortest war in history lasted:',
    options: [
      '38 minutes',
      '2 hours',
      '6 days',
      'One lunch break'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'factual'
  },

  // TRUE/FALSE (5%)
  {
    id: 'tf-1',
    category: 'Boring Facts That Slap',
    text: 'True or False: A group of flamingos is called a "flamboyance."',
    options: [
      'True',
      'False',
      'Only the gay ones',
      'Only in Miami'
    ],
    correctAnswer: 0,
    funniestAnswer: 2,
    type: 'trueFalse'
  },

  // SONG LYRICS
  {
    id: 'music-1',
    category: 'Songs That Hit Different Now',
    text: 'Which 90s song contains: "I don\'t want to be the one who walks away, but I can\'t bear the thought of one more day"?',
    options: [
      'I Want It That Way',
      'MMMBop',
      'Torn (Natalie Imbruglia)',
      '...Baby One More Time'
    ],
    correctAnswer: 2,
    funniestAnswer: 1,
    type: 'funny',
    era: '1990s'
  },
  {
    id: 'music-2',
    category: 'Songs Your Parents Ruined',
    text: 'Which 80s hit contains: "Just a small town girl, living in a lonely world"?',
    options: [
      'Don\'t Stop Believin\'',
      'Sweet Child O\' Mine',
      'Livin\' on a Prayer',
      'Girls Just Want to Have Fun'
    ],
    correctAnswer: 0,
    funniestAnswer: 0,
    type: 'funny',
    era: '1980s'
  },

  // MORE EDGY QUESTIONS
  {
    id: 'edgy-5',
    category: 'Ex-Files',
    text: 'If your ex was a streaming service, they\'d be:',
    options: [
      'Netflix (used to be good)',
      'Peacock (nobody asked for this)',
      'Apple TV+ (expensive and disappointing)',
      'Quibi (dead and forgotten)'
    ],
    correctAnswer: 3,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'edgy-6',
    category: 'Therapy Session Soundtracks',
    text: 'Which song would play during a breakup with your smartphone:',
    options: [
      'Somebody That I Used to Know',
      'Before He Cheats',
      'I Will Survive',
      'We Are Never Getting Back Together'
    ],
    correctAnswer: 3,
    funniestAnswer: 0,
    type: 'edgy'
  },
  {
    id: 'edgy-7',
    category: '2026 Dating Horror Stories',
    text: 'Which dating app feature would terrify Gen X the most:',
    options: [
      'AI personality matching',
      'Credit score verification',
      'Parent approval required',
      'Video calls mandatory'
    ],
    correctAnswer: 3,
    funniestAnswer: 2,
    type: 'edgy'
  },

  // MORE GAMING QUESTIONS
  {
    id: 'gaming-3',
    category: 'Characters Who Need Dating Apps',
    text: 'Sonic\'s dating profile would most likely say:',
    options: [
      '"I move too fast for most people"',
      '"Gotta go fast (in relationships too)"',
      '"Collect rings, not red flags"',
      '"Blue hedgehog seeks yellow rings"'
    ],
    correctAnswer: 0,
    funniestAnswer: 1,
    type: 'edgy'
  },
  {
    id: 'gaming-4',
    category: 'Boss Fight Breakups',
    text: 'Which Final Fantasy character would your ex most relate to:',
    options: [
      'Sephiroth (burns everything down)',
      'Cloud (emotionally unavailable)',
      'Yuffie (steals your stuff)',
      'Cactuar (runs away from problems)'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'gaming-5',
    category: 'Modern Gaming Chaos',
    text: 'Which 2026 gaming trend would confuse a 1990s gamer most:',
    options: [
      'Paying $20 for character skins',
      'Games that aren\'t finished at launch',
      'Streaming yourself playing games',
      'NFT weapon unlocks'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'currentEvents'
  },

  // MORE CURRENT EVENTS
  {
    id: 'current-3',
    category: 'AI Took My Job',
    text: 'Which profession would ChatGPT struggle with most:',
    options: [
      'Therapist',
      'Stand-up comedian',
      'DMV employee',
      'Divorce lawyer'
    ],
    correctAnswer: 2,
    funniestAnswer: 1,
    type: 'currentEvents'
  },
  {
    id: 'current-4',
    category: 'Influencer Economics',
    text: 'Which 2026 side hustle would make your grandmother cry:',
    options: [
      'OnlyFans fitness coach',
      'TikTok grief counselor',
      'LinkedIn life coach',
      'Instagram plant therapist'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'currentEvents'
  },

  // MORE FUNNY QUESTIONS
  {
    id: 'funny-4',
    category: 'Things Your Inner Child Would Say',
    text: 'A rubber duck\'s therapy session would focus on:',
    options: [
      'Nobody takes me seriously',
      'I\'m tired of always being squeezed',
      'Bath time trauma',
      'Why do I always float alone?'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'funny-5',
    category: 'Karaoke From Hell',
    text: 'If a disco ball could sing karaoke, it would choose:',
    options: [
      'I Will Survive',
      'Dancing Queen',
      'Mirror Ball (Taylor Swift)',
      'Shiny Happy People'
    ],
    correctAnswer: 1,
    funniestAnswer: 2,
    type: 'funny'
  },
  {
    id: 'funny-6',
    category: 'Corporate Nightmare Fuel',
    text: 'Which Zoom meeting feature causes the most existential dread:',
    options: [
      'Camera always on',
      'Can see yourself talking',
      'Awkward silence counter',
      'Productivity score visible to all'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'funny'
  },

  // MORE FACTUAL QUESTIONS (in funny categories)
  {
    id: 'factual-3',
    category: 'Historical Oversharing',
    text: 'The Boston Tea Party happened in:',
    options: [
      '1773',
      '1775',
      '1776',
      'When Starbucks got too expensive'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'factual'
  },
  {
    id: 'factual-4',
    category: 'Science Class Trauma',
    text: 'Which planet has the most moons:',
    options: [
      'Jupiter',
      'Saturn',
      'The moon (it\'s complicated)',
      'Earth (if you count commitment issues)'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'factual'
  },

  // MORE TRUE/FALSE
  {
    id: 'tf-2',
    category: 'Songs That Hit Too Close to Home',
    text: 'True or False: "Baby Shark" was the most-watched YouTube video of 2021.',
    options: [
      'True',
      'False',
      'Unfortunately true',
      'Stop making me think about it'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'trueFalse'
  },
  {
    id: 'tf-3',
    category: 'Relationship Advice from Hell',
    text: 'True or False: Bananas are berries, but strawberries are not.',
    options: [
      'True',
      'False',
      'Only organic ones',
      'Depends on the smoothie'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'trueFalse'
  }
];

export const getQuestionsByCategory = (category: string): TriviaQuestion[] => {
  return triviaQuestions.filter(q => q.category === category);
};

export const getQuestionsByType = (type: QuestionType): TriviaQuestion[] => {
  return triviaQuestions.filter(q => q.type === type);
};

export const getQuestionsByEra = (era: string): TriviaQuestion[] => {
  return triviaQuestions.filter(q => q.era === era);
};

export const getRandomQuestion = (): TriviaQuestion => {
  return triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];
};

export const getQuestionMix = (count: number = 25): TriviaQuestion[] => {
  const edgyCount = Math.floor(count * 0.5);
  const funnyCount = Math.floor(count * 0.25);
  const factualCount = Math.floor(count * 0.1);
  const tfCount = Math.floor(count * 0.05);
  const currentCount = count - edgyCount - funnyCount - factualCount - tfCount;

  const edgy = getQuestionsByType('edgy').slice(0, edgyCount);
  const funny = getQuestionsByType('funny').slice(0, funnyCount);
  const factual = getQuestionsByType('factual').slice(0, factualCount);
  const tf = getQuestionsByType('trueFalse').slice(0, tfCount);
  const current = getQuestionsByType('currentEvents').slice(0, currentCount);

  // Shuffle the combined array
  const allQuestions = [...edgy, ...funny, ...factual, ...tf, ...current];
  return allQuestions.sort(() => Math.random() - 0.5);
};