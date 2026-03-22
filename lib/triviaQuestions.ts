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
  },

  // BATCH 1: DATING DISASTERS (50+ questions)
  {
    id: 'dating-1',
    category: 'Tinder Bio Red Flags',
    text: 'Which bio screams "I still live with my mom":',
    options: [
      '"Family is everything to me"',
      '"Looking for someone who cooks"',
      '"My roommate is amazing"',
      '"Netflix and actually chill"'
    ],
    correctAnswer: 2,
    funniestAnswer: 1,
    type: 'edgy'
  },
  {
    id: 'dating-2',
    category: 'First Date Horror Stories',
    text: 'Your date orders the most expensive item and says:',
    options: [
      '"I forgot my wallet"',
      '"This is a business expense"',
      '"My ex used to pay for everything"',
      '"Can we split this 17 ways?"'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'dating-3',
    category: 'Breakup Text Generator',
    text: 'The most passive-aggressive breakup text is:',
    options: [
      '"It\'s not you, it\'s definitely you"',
      '"I need space... like, different galaxies"',
      '"We can still be strangers"',
      '"Thanks for the memories (that I\'m blocking)"'
    ],
    correctAnswer: 2,
    funniestAnswer: 1,
    type: 'edgy'
  },
  {
    id: 'dating-4',
    category: 'Modern Romance Fails',
    text: 'Which dating app feature would ruin romance forever:',
    options: [
      'Real-time bank balance display',
      'Mother approval requirement',
      'Ex-partner reviews section',
      'DNA compatibility scoring'
    ],
    correctAnswer: 2,
    funniestAnswer: 2,
    type: 'edgy'
  },
  {
    id: 'dating-5',
    category: 'Instagram vs Reality',
    text: 'Your date looks nothing like their profile because:',
    options: [
      'They used their sibling\'s photos',
      'Those pics are from 2019',
      'AI generated their face',
      'They\'re actually three cats in a trench coat'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'edgy'
  },

  // BATCH 2: WORKPLACE NIGHTMARES (50+ questions)
  {
    id: 'work-1',
    category: 'Corporate Buzzword Bingo',
    text: 'Which phrase means "you\'re about to get more work":',
    options: [
      '"This is a great opportunity"',
      '"We\'re family here"',
      '"Think outside the box"',
      '"Let\'s circle back on this"'
    ],
    correctAnswer: 0,
    funniestAnswer: 1,
    type: 'edgy'
  },
  {
    id: 'work-2',
    category: 'Meeting From Hell',
    text: 'The worst thing someone can say in a meeting:',
    options: [
      '"This could have been an email"',
      '"Let\'s take this offline"',
      '"Actually, I have some thoughts"',
      '"Can everyone see my screen?"'
    ],
    correctAnswer: 2,
    funniestAnswer: 2,
    type: 'edgy'
  },
  {
    id: 'work-3',
    category: 'Remote Work Reality',
    text: 'Working from home means:',
    options: [
      'Pants are now optional',
      'Your cat is your coworker',
      'Every meeting is a performance',
      'The kitchen is your break room'
    ],
    correctAnswer: 0,
    funniestAnswer: 1,
    type: 'funny'
  },
  {
    id: 'work-4',
    category: 'Office Politics 101',
    text: 'Which coworker is definitely getting promoted:',
    options: [
      'The one who stays late every day',
      'The boss\'s nephew',
      'The person who brings donuts',
      'The one who never complains'
    ],
    correctAnswer: 1,
    funniestAnswer: 2,
    type: 'edgy'
  },
  {
    id: 'work-5',
    category: 'Email Etiquette Violations',
    text: 'The most annoying email signature includes:',
    options: [
      '50 inspirational quotes',
      'A photo of their pet',
      '"Sent from my iPhone" in Comic Sans',
      'Their entire life philosophy'
    ],
    correctAnswer: 2,
    funniestAnswer: 0,
    type: 'funny'
  },

  // BATCH 3: SOCIAL MEDIA DISASTERS (50+ questions)
  {
    id: 'social-1',
    category: 'Facebook Timeline Archaeology',
    text: 'Your most embarrassing old post is probably:',
    options: [
      'Song lyrics as status updates',
      'Relationship drama from 2012',
      'Political takes from your teens',
      'That one time you thought you were deep'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'social-2',
    category: 'Instagram Stories That Hurt',
    text: 'Which story screams "I\'m not okay":',
    options: [
      'Gym selfies at 3am',
      'Cryptic song lyrics',
      'Mirror pics with inspirational quotes',
      'Food photos with existential captions'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'social-3',
    category: 'TikTok Algorithm Hell',
    text: 'Your For You page is full of:',
    options: [
      'People younger and more successful',
      'DIY fails that you\'ll never try',
      'Dances you can\'t do',
      'Products you don\'t need but want'
    ],
    correctAnswer: 0,
    funniestAnswer: 2,
    type: 'currentEvents'
  },
  {
    id: 'social-4',
    category: 'Twitter Main Character Syndrome',
    text: 'You know you\'re the main character when:',
    options: [
      'Your hot takes get ratio\'d',
      'You argue with verified accounts',
      'Your mentions are a war zone',
      'You tweet through it'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'currentEvents'
  },
  {
    id: 'social-5',
    category: 'LinkedIn Influencer Cringe',
    text: 'The worst LinkedIn post starts with:',
    options: [
      '"Agree?"',
      '"Unpopular opinion:"',
      '"I was walking down the street when..."',
      '"Thoughts?"'
    ],
    correctAnswer: 2,
    funniestAnswer: 2,
    type: 'currentEvents'
  },

  // BATCH 4: GAMING ACROSS ERAS (50+ questions)
  {
    id: 'gaming-6',
    category: '90s Console Wars Trauma',
    text: 'The biggest gaming betrayal was:',
    options: [
      'Final Fantasy going to PlayStation',
      'Sonic games getting bad',
      'Nintendo using friend codes',
      'Half-Life 3 never happening'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'funny',
    era: '1990s'
  },
  {
    id: 'gaming-7',
    category: 'PC Master Race Problems',
    text: 'You know you\'re a PC gamer when:',
    options: [
      'Your GPU costs more than a car',
      'You judge people by their FPS',
      'You have 500 games unplayed',
      'You argue about keyboards'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'gaming-8',
    category: 'Mobile Gaming Shame',
    text: 'The most embarrassing mobile game to be addicted to:',
    options: [
      'Candy Crush (you\'re 45)',
      'Among Us (it\'s 2026)',
      'Clash of Clans (you have a mortgage)',
      'Pokémon GO (you ran into traffic)'
    ],
    correctAnswer: 3,
    funniestAnswer: 1,
    type: 'edgy'
  },
  {
    id: 'gaming-9',
    category: 'Retro Gaming Hipster',
    text: 'You\'re a gaming hipster if you say:',
    options: [
      '"Graphics don\'t matter"',
      '"I liked it before the remaster"',
      '"Indie games are the future"',
      '"This game was better on [obscure console]"'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'gaming-10',
    category: 'Twitch Chat Toxicity',
    text: 'The most toxic gaming community is:',
    options: [
      'Any competitive FPS',
      'MOBA players in general',
      'Speedrunning communities arguing',
      'Nintendo fans defending everything'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'edgy'
  },

  // BATCH 5: TV/MOVIE NOSTALGIA (50+ questions)
  {
    id: 'tv-1',
    category: '2000s Reality TV Trash',
    text: 'The most toxic reality show was:',
    options: [
      'The Bachelor (obvious manipulation)',
      'Flavor of Love (dignity not included)',
      'Jersey Shore (brain cells lost)',
      'Rock of Love (what were we thinking?)'
    ],
    correctAnswer: 1,
    funniestAnswer: 2,
    type: 'funny',
    era: '2000s'
  },
  {
    id: 'tv-2',
    category: 'Sitcom Workplace Violations',
    text: 'Which sitcom workplace would get sued immediately:',
    options: [
      'The Office (harassment central)',
      'Parks and Rec (government corruption)',
      'It\'s Always Sunny (everything illegal)',
      'Community (education fraud)'
    ],
    correctAnswer: 2,
    funniestAnswer: 2,
    type: 'edgy'
  },
  {
    id: 'tv-3',
    category: 'Netflix and Actual Chill',
    text: 'Your Netflix "Continue Watching" is full of:',
    options: [
      'Shows you started but never finished',
      'Things you fell asleep during',
      'Series you\'re avoiding the finale of',
      'Content you don\'t remember watching'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'tv-4',
    category: 'Streaming Service Fatigue',
    text: 'The worst part about streaming is:',
    options: [
      'Paying for 8 services',
      'Content disappearing randomly',
      'Autoplay trailers',
      'Algorithm assumes you\'re basic'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'currentEvents'
  },
  {
    id: 'tv-5',
    category: 'Binge-Watching Regrets',
    text: 'You know you binged too hard when:',
    options: [
      'You dream in episodes',
      'You speak like the characters',
      'You forget what day it is',
      'Your eyes hurt from screens'
    ],
    correctAnswer: 2,
    funniestAnswer: 1,
    type: 'funny'
  },

  // BATCH 6: MUSIC ACROSS DECADES (50+ questions)
  {
    id: 'music-90s-1',
    category: '90s Music Nostalgia',
    text: 'Which 90s song contains: "Is this the real life, is this just fantasy"... wait, that\'s 70s. Which actually contains: "I get by with a little help from my friends"... no wait. The 90s song with "Don\'t go chasing waterfalls" is by:',
    options: [
      'TLC',
      'En Vogue',
      'Salt-N-Pepa',
      'Destiny\'s Child'
    ],
    correctAnswer: 0,
    funniestAnswer: 0,
    type: 'funny',
    era: '1990s'
  },
  {
    id: 'music-2000s-1',
    category: '2000s Emo Anthem Therapy',
    text: 'Which emo song did you definitely cry to in 2005:',
    options: [
      'My Chemical Romance - "Helena"',
      'Fall Out Boy - "Sugar, We\'re Goin Down"',
      'Dashboard Confessional - anything',
      'Simple Plan - "I\'m Just a Kid"'
    ],
    correctAnswer: 2,
    funniestAnswer: 2,
    type: 'funny',
    era: '2000s'
  },
  {
    id: 'music-spotify-1',
    category: 'Spotify Wrapped Shame',
    text: 'Your most embarrassing Spotify Wrapped reveal:',
    options: [
      'Top genre: "sad indie folk"',
      'You listened to Baby Shark 200 times',
      'Your top artist is from a kids movie',
      'You\'re in the top 0.1% of Taylor Swift fans'
    ],
    correctAnswer: 1,
    funniestAnswer: 0,
    type: 'currentEvents'
  },
  {
    id: 'music-karaoke-1',
    category: 'Karaoke Crimes Against Humanity',
    text: 'The song that ruins every karaoke night:',
    options: [
      'Don\'t Stop Believin\' (everyone sings)',
      'Bohemian Rhapsody (nobody can sing)',
      'Sweet Caroline (drunk crowd participation)',
      'Wonderwall (that one guy)'
    ],
    correctAnswer: 3,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'music-playlist-1',
    category: 'Playlist Personality Disorders',
    text: 'Your workout playlist includes:',
    options: [
      'Death metal and Disney songs',
      'Podcast episodes you never finish',
      'One song on repeat for 2 hours',
      'Songs from 2003 that hit different'
    ],
    correctAnswer: 0,
    funniestAnswer: 2,
    type: 'funny'
  },

  // BATCH 7: FOOD & COOKING DISASTERS (50+ questions)
  {
    id: 'food-1',
    category: 'Cooking Show vs Reality',
    text: 'Your attempt at following a recipe results in:',
    options: [
      'Fire department visit',
      'Ordering takeout',
      'Questioning your life choices',
      'A new appreciation for cereal'
    ],
    correctAnswer: 1,
    funniestAnswer: 0,
    type: 'funny'
  },
  {
    id: 'food-2',
    category: 'Food Delivery Addiction',
    text: 'You know you order too much delivery when:',
    options: [
      'The drivers know your name',
      'You have restaurant loyalty cards digitally',
      'Your monthly bill exceeds rent',
      'You rate drivers on cooking skills'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'food-3',
    category: 'Instagram Food Photography',
    text: 'Your food photos get no likes because:',
    options: [
      'Bad lighting makes it look like dog food',
      'You ate half before remembering to photograph',
      'Your phone camera is from 2015',
      'Food styling isn\'t your forte'
    ],
    correctAnswer: 0,
    funniestAnswer: 1,
    type: 'funny'
  },
  {
    id: 'food-4',
    category: 'Healthy Eating Failures',
    text: 'Your diet lasted exactly:',
    options: [
      'Until you saw a donut',
      'Three Instagram posts',
      'The time it took to meal prep once',
      'One grocery shopping trip'
    ],
    correctAnswer: 0,
    funniestAnswer: 1,
    type: 'edgy'
  },
  {
    id: 'food-5',
    category: 'Restaurant Horror Stories',
    text: 'The worst restaurant experience includes:',
    options: [
      'Waiting 2 hours for cold food',
      'The waiter disappearing forever',
      'Finding hair in your salad',
      'Paying $30 for artisanal toast'
    ],
    correctAnswer: 3,
    funniestAnswer: 3,
    type: 'edgy'
  },

  // BATCH 8: TRAVEL & TRANSPORTATION NIGHTMARES (50+ questions)
  {
    id: 'travel-1',
    category: 'Airport Security Theater',
    text: 'TSA will definitely flag you for:',
    options: [
      'Forgetting about that water bottle',
      'Your suspicious-looking laptop charger',
      'Wearing too many layers',
      'Looking nervous because you\'re running late'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'travel-2',
    category: 'Airplane Etiquette Violations',
    text: 'The worst airplane passenger:',
    options: [
      'Reclines seat immediately',
      'Brings smelly food',
      'Talks loudly on phone during boarding',
      'Takes off shoes and socks'
    ],
    correctAnswer: 3,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'travel-3',
    category: 'Uber/Lyft Russian Roulette',
    text: 'You know your ride share is going to be weird when:',
    options: [
      'Driver has 2.3 star rating',
      'Car doesn\'t match the app',
      'They\'re eating a full meal while driving',
      'Religious music at maximum volume'
    ],
    correctAnswer: 1,
    funniestAnswer: 2,
    type: 'edgy'
  },
  {
    id: 'travel-4',
    category: 'Hotel Room Roulette',
    text: 'Your hotel room is definitely not as advertised when:',
    options: [
      'The "ocean view" is a parking lot',
      'The WiFi password doesn\'t work',
      'There\'s mysterious stains everywhere',
      'The AC sounds like a helicopter'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'travel-5',
    category: 'Road Trip Reality Check',
    text: 'Every road trip includes:',
    options: [
      'Getting lost despite GPS',
      'Someone needing to pee constantly',
      'Arguments about music',
      'Gas stations with questionable restrooms'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'funny'
  },

  // BATCH 9: TECHNOLOGY FAILS (50+ questions)
  {
    id: 'tech-1',
    category: 'Smart Home Stupid Problems',
    text: 'Your smart home is too smart when:',
    options: [
      'Alexa judges your music taste',
      'Your fridge orders groceries you can\'t afford',
      'The thermostat has opinions',
      'Your doorbell recognizes your ex'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'currentEvents'
  },
  {
    id: 'tech-2',
    category: 'Password Security Insecurity',
    text: 'Your password is definitely not secure if it\'s:',
    options: [
      'password123',
      'Your birthday plus your name',
      'The same one you\'ve used since 2008',
      'Written on a sticky note on your monitor'
    ],
    correctAnswer: 3,
    funniestAnswer: 0,
    type: 'edgy'
  },
  {
    id: 'tech-3',
    category: 'Software Update Anxiety',
    text: 'You avoid updating your phone because:',
    options: [
      'It might break everything',
      'You\'ll lose all your photos somehow',
      'New features confuse you',
      'Your phone is already too slow'
    ],
    correctAnswer: 0,
    funniestAnswer: 2,
    type: 'funny'
  },
  {
    id: 'tech-4',
    category: 'Cloud Storage Confusion',
    text: 'You have no idea where your files are because:',
    options: [
      'They\'re scattered across 5 different clouds',
      'You don\'t understand how syncing works',
      'Auto-backup saved everything to the wrong account',
      'The cloud is just someone else\'s computer'
    ],
    correctAnswer: 3,
    funniestAnswer: 0,
    type: 'funny'
  },
  {
    id: 'tech-5',
    category: 'Video Call Nightmares',
    text: 'Your video call went wrong when:',
    options: [
      'You forgot you weren\'t wearing pants',
      'Your cat became the star of the meeting',
      'You accidentally used a filter',
      'You tried to mute but turned off your camera instead'
    ],
    correctAnswer: 0,
    funniestAnswer: 1,
    type: 'edgy'
  },

  // BATCH 10: FAMILY DYNAMICS & GENERATIONAL GAPS (50+ questions)
  {
    id: 'family-1',
    category: 'Parents vs Technology',
    text: 'Your parents definitely don\'t understand:',
    options: [
      'Why you need 47 apps',
      'The difference between Google and the internet',
      'That screaming won\'t make WiFi faster',
      'Why you can\'t just "hack" their forgot password'
    ],
    correctAnswer: 1,
    funniestAnswer: 2,
    type: 'funny'
  },
  {
    id: 'family-2',
    category: 'Holiday Dinner Politics',
    text: 'Family dinner gets awkward when uncle brings up:',
    options: [
      'Your dating life',
      'Current politics',
      'Why you\'re still single',
      'That time you embarrassed yourself as a kid'
    ],
    correctAnswer: 1,
    funniestAnswer: 2,
    type: 'edgy'
  },
  {
    id: 'family-3',
    category: 'Sibling Rivalry Never Dies',
    text: 'You\'re still competing with your sibling over:',
    options: [
      'Who mom likes more',
      'Who\'s more successful',
      'Who remembers family events correctly',
      'Who gets the last piece of pie'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'family-4',
    category: 'Grandparents on Social Media',
    text: 'Your grandma\'s Facebook activity includes:',
    options: [
      'Commenting "beautiful" on every photo',
      'Sharing obviously fake news',
      'Writing "Google" in the search bar',
      'Accidentally going live while confused'
    ],
    correctAnswer: 3,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'family-5',
    category: 'Parent Text Message Confusion',
    text: 'Your mom\'s texts are confusing because:',
    options: [
      'She uses periods like she\'s angry',
      'Random capitalization EVERYWHERE',
      'Voice-to-text creates chaos',
      'She signs them "Love, Mom"'
    ],
    correctAnswer: 2,
    funniestAnswer: 1,
    type: 'funny'
  },

  // BATCH 11: PET OWNERSHIP REALITY (50+ questions)
  {
    id: 'pet-1',
    category: 'Dog Owner Delusions',
    text: 'Your dog is definitely not as smart as you think when:',
    options: [
      'They eat their own poop',
      'They bark at their own reflection',
      'They get excited about the vacuum cleaner',
      'They can\'t figure out glass doors'
    ],
    correctAnswer: 0,
    funniestAnswer: 2,
    type: 'funny'
  },
  {
    id: 'pet-2',
    category: 'Cat Owner Stockholm Syndrome',
    text: 'You know your cat owns you when:',
    options: [
      'You buy them a $200 bed they ignore',
      'You have more photos of them than family',
      'You apologize when they knock things over',
      'You let them sleep in your spot'
    ],
    correctAnswer: 2,
    funniestAnswer: 0,
    type: 'funny'
  },
  {
    id: 'pet-3',
    category: 'Vet Bill Financial Trauma',
    text: 'Your vet bill is outrageous because:',
    options: [
      'Your pet ate something stupid',
      'Annual checkup costs more than your healthcare',
      'They need designer prescription food',
      'Emergency surgery for a hairball'
    ],
    correctAnswer: 1,
    funniestAnswer: 0,
    type: 'edgy'
  },
  {
    id: 'pet-4',
    category: 'Pet Instagram Fame',
    text: 'Your pet\'s social media has more followers than you because:',
    options: [
      'They\'re naturally photogenic',
      'People prefer animals to humans',
      'You have no shame posting 47 photos daily',
      'They don\'t have opinions about politics'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'pet-5',
    category: 'Pet Training Failures',
    text: 'Your pet training efforts failed when:',
    options: [
      'They trained you instead',
      'YouTube videos lied about difficulty',
      'Treats became their salary',
      'They unionized with other pets'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'funny'
  },

  // BATCH 12: FASHION & SHOPPING DISASTERS (50+ questions)
  {
    id: 'fashion-1',
    category: 'Online Shopping vs Reality',
    text: 'Your online order disappointed you because:',
    options: [
      'It looked better on the model',
      'Size chart was apparently a suggestion',
      'Quality feels like paper',
      'It\'s been 3 months and still shipping'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'fashion-2',
    category: 'Fashion Trend Regret',
    text: 'Which fashion trend will we regret in 2030:',
    options: [
      'Crocs with socks',
      'Crop tops in winter',
      'Pants that are too high-waisted',
      'Whatever Gen Alpha is wearing'
    ],
    correctAnswer: 3,
    funniestAnswer: 0,
    type: 'currentEvents'
  },
  {
    id: 'fashion-3',
    category: 'Closet Full of Nothing to Wear',
    text: 'You have 200 items of clothing but nothing to wear because:',
    options: [
      'Everything needs ironing',
      'Nothing matches your mood',
      'You only like 3 outfits',
      'Laundry is a myth'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'fashion-4',
    category: 'Sustainable Fashion Guilt',
    text: 'You know fast fashion is bad but:',
    options: [
      'Your budget disagrees',
      'Sustainable brands are 10x the price',
      'That $5 shirt is calling your name',
      'You\'ll donate it eventually (you won\'t)'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'fashion-5',
    category: 'Shoe Collection Intervention',
    text: 'Your shoe addiction is out of control when:',
    options: [
      'You need a spreadsheet to track them',
      'You wear them once then forget',
      'Your closet is 80% shoe boxes',
      'You buy shoes for shoes you don\'t have'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'edgy'
  },

  // BATCH 13: HEALTH & FITNESS FAILS (50+ questions)
  {
    id: 'fitness-1',
    category: 'Gym Membership Guilt',
    text: 'Your gym membership is a waste of money because:',
    options: [
      'You go twice a year',
      'You use it to shower after work',
      'Netflix at home is more comfortable',
      'The equipment is too intimidating'
    ],
    correctAnswer: 0,
    funniestAnswer: 1,
    type: 'edgy'
  },
  {
    id: 'fitness-2',
    category: 'Workout Video Lies',
    text: 'Home workout videos are lying when they say:',
    options: [
      '"This is a beginner workout"',
      '"You only need 10 minutes"',
      '"No equipment necessary"',
      '"Feel the burn" (it\'s just pain)'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'fitness-3',
    category: 'Fitness App Delusions',
    text: 'Your fitness tracker thinks you\'re athletic because:',
    options: [
      'It counted aggressive phone scrolling as steps',
      'You shook it to hit your goal',
      'Walking to the fridge counts apparently',
      'It doesn\'t judge your motivation'
    ],
    correctAnswer: 0,
    funniestAnswer: 2,
    type: 'funny'
  },
  {
    id: 'fitness-4',
    category: 'New Year Gym Resolution',
    text: 'Your January gym motivation died when:',
    options: [
      'You saw how crowded it was',
      'The scale didn\'t change in 3 days',
      'You realized you hate exercise',
      'February happened'
    ],
    correctAnswer: 3,
    funniestAnswer: 1,
    type: 'edgy'
  },
  {
    id: 'fitness-5',
    category: 'Yoga Class Intimidation',
    text: 'Yoga class made you question everything when:',
    options: [
      'Everyone else could touch their toes',
      'The instructor folded in half',
      'Your joints made concerning noises',
      'Meditation stressed you out more'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'funny'
  },

  // BATCH 14: PRESIDENTIAL HISTORY DISASTERS (50+ questions)
  {
    id: 'president-1',
    category: 'Presidential Twitter Meltdowns',
    text: 'Which president would have caused the most Twitter drama:',
    options: [
      'Andrew Jackson (would fight everyone)',
      'Theodore Roosevelt (would subtweet constantly)',
      'Nixon (would get caught lying)',
      'JFK (would slide into DMs)'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'president-2',
    category: 'Presidential Dating Profiles',
    text: 'Abraham Lincoln\'s dating profile would say:',
    options: [
      '"Tall, dark, and historically significant"',
      '"I freed some people, can free your heart"',
      '"Looking for my Mary Todd again"',
      '"Top hat is staying on during activities"'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'president-3',
    category: 'White House Reality Show',
    text: 'Which president would win Big Brother:',
    options: [
      'Franklin Roosevelt (excellent strategist)',
      'Clinton (would charm everyone)',
      'Obama (too likeable to vote out)',
      'Washington (everyone respects the founding father)'
    ],
    correctAnswer: 2,
    funniestAnswer: 1,
    type: 'funny'
  },
  {
    id: 'president-4',
    category: 'Presidential Modern Problems',
    text: 'Which president would struggle most with Zoom calls:',
    options: [
      'Washington (would demand formal dress code)',
      'Jefferson (would try to multitask with inventions)',
      'Reagan (would forget to unmute)',
      'Eisenhower (would treat it like military operation)'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'president-5',
    category: 'Presidential Scandal Olympics',
    text: 'The most embarrassing presidential scandal was:',
    options: [
      'Watergate (criminal)',
      'Monica Lewinsky (personal)',
      'Teapot Dome (corruption)',
      'That time someone got stuck in the White House bathtub'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'edgy'
  },

  // BATCH 15: HOLLYWOOD TRAIN WRECKS (50+ questions)
  {
    id: 'hollywood-1',
    category: 'Celebrity Meltdown Bingo',
    text: 'Which celebrity meltdown was most predictable:',
    options: [
      'Britney Spears head-shaving era',
      'Tom Cruise couch jumping',
      'Kanye West Twitter storms',
      'Charlie Sheen "winning" phase'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'hollywood-2',
    category: 'Award Show Awkwardness',
    text: 'The most cringe award show moment:',
    options: [
      'Envelope mix-up at Oscars',
      'Kanye interrupting Taylor Swift',
      'John Travolta name butchering',
      'Will Smith slapping Chris Rock'
    ],
    correctAnswer: 3,
    funniestAnswer: 2,
    type: 'edgy'
  },
  {
    id: 'hollywood-3',
    category: 'Movie Sequel Cash Grabs',
    text: 'Which movie franchise should have stopped at movie 1:',
    options: [
      'Fast & Furious (physics left after 3)',
      'Transformers (explosions aren\'t plot)',
      'Pirates of Caribbean (Jack Sparrow fatigue)',
      'Sharknado (wait, that\'s the point)'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'hollywood-4',
    category: 'Celebrity Social Media Fails',
    text: 'The worst celebrity social media strategy:',
    options: [
      'Posting every mundane thought',
      'Getting into Twitter fights with fans',
      'Forgetting they\'re not regular people',
      'Live-tweeting their therapy sessions'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'hollywood-5',
    category: 'Method Acting Gone Wrong',
    text: 'Method acting jumped the shark when:',
    options: [
      'Jared Leto sent dead rats to castmates',
      'Daniel Day-Lewis stayed in character for months',
      'Jim Carrey became Andy Kaufman',
      'Someone method acted for a commercial'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'edgy'
  },

  // BATCH 16: SCIENCE FICTION VS REALITY (50+ questions)
  {
    id: 'scifi-1',
    category: 'Sci-Fi Predictions That Aged Badly',
    text: 'Which sci-fi prediction was completely wrong:',
    options: [
      'Flying cars by 2000',
      'Moon colonies by 2020',
      'Robots would be helpful',
      'Video calls would replace phone calls (wait...)'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'scifi-2',
    category: 'Star Wars vs Star Trek Warfare',
    text: 'The dumbest debate in sci-fi is:',
    options: [
      'Enterprise vs Millennium Falcon',
      'Spock vs Data emotional capacity',
      'Force vs Technology',
      'Which captain is the most attractive'
    ],
    correctAnswer: 3,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'scifi-3',
    category: 'Dystopian Future Shopping List',
    text: 'In the dystopian future, the most valuable commodity will be:',
    options: [
      'Clean water',
      'Internet passwords',
      'Physical books',
      'People who remember how things worked'
    ],
    correctAnswer: 0,
    funniestAnswer: 1,
    type: 'currentEvents'
  },
  {
    id: 'scifi-4',
    category: 'Time Travel Paradox Problems',
    text: 'Time travel would be ruined by:',
    options: [
      'Someone accidentally changing everything',
      'Tourists crowding historical events',
      'Social media influencers',
      'Time police giving out tickets'
    ],
    correctAnswer: 0,
    funniestAnswer: 2,
    type: 'funny'
  },
  {
    id: 'scifi-5',
    category: 'Alien Contact Protocol',
    text: 'First contact with aliens will go wrong because:',
    options: [
      'We\'ll try to sell them extended warranties',
      'Someone will ask them about their ship\'s gas mileage',
      'Karen will ask to speak to their manager',
      'We\'ll immediately start a social media trend'
    ],
    correctAnswer: 3,
    funniestAnswer: 2,
    type: 'currentEvents'
  },

  // BATCH 17: WORD ANOMALIES & LANGUAGE FAILS (50+ questions)
  {
    id: 'words-1',
    category: 'English Language Conspiracy',
    text: 'English makes no sense because:',
    options: [
      '"Read" and "read" are pronounced differently',
      '"Colonel" is pronounced "kernel"',
      'We have silent letters for no reason',
      'All of the above plus more chaos'
    ],
    correctAnswer: 3,
    funniestAnswer: 1,
    type: 'factual'
  },
  {
    id: 'words-2',
    category: 'Autocorrect Disasters',
    text: 'Autocorrect ruined your life when it changed:',
    options: [
      '"On my way" to "On my gay"',
      '"Meeting" to "Mating"',
      'Your boss\'s name to something inappropriate',
      'A work email into a breakup text'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'words-3',
    category: 'Gen Z Language Evolution',
    text: 'You know you\'re old when you don\'t understand:',
    options: [
      '"No cap"',
      '"It\'s giving..."',
      '"Periodt"',
      'Any of it and you\'re afraid to ask'
    ],
    correctAnswer: 3,
    funniestAnswer: 3,
    type: 'currentEvents'
  },
  {
    id: 'words-4',
    category: 'Corporate Speak Translation',
    text: '"Let\'s circle back on this" actually means:',
    options: [
      '"I forgot what we were talking about"',
      '"I hope you forget about this"',
      '"This is not my problem"',
      '"I need to ask my boss"'
    ],
    correctAnswer: 1,
    funniestAnswer: 0,
    type: 'edgy'
  },
  {
    id: 'words-5',
    category: 'Spelling Bee Trauma',
    text: 'The word that would eliminate you from a spelling bee:',
    options: [
      'Necessary (how many s\'s?)',
      'Definitely (not "defiantly")',
      'Restaurant (too many vowels)',
      'Wednesday (the d is silent why?)'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'funny'
  },

  // BATCH 18: ACTOR/ACTRESS CAREER CHAOS (50+ questions)
  {
    id: 'actor-1',
    category: 'Career Suicide by Movie Choice',
    text: 'Which actor chose the worst movie to end their career:',
    options: [
      'John Travolta in multiple bad sequels',
      'Eddie Murphy in terrible comedies',
      'Nicolas Cage in... pick any recent one',
      'Anyone in a video game movie'
    ],
    correctAnswer: 3,
    funniestAnswer: 2,
    type: 'edgy'
  },
  {
    id: 'actor-2',
    category: 'Oscar Speech Disasters',
    text: 'The worst Oscar acceptance speech included:',
    options: [
      'Thanking everyone except the director',
      'Political rant that aged poorly',
      'Crying for 10 minutes straight',
      'Forgetting to thank family'
    ],
    correctAnswer: 1,
    funniestAnswer: 2,
    type: 'edgy'
  },
  {
    id: 'actor-3',
    category: 'Action Star Physics',
    text: 'Action movies would be more realistic if:',
    options: [
      'Heroes got tired after one fight scene',
      'Explosions actually hurt people walking away',
      'Guns needed reloading',
      'Anyone over 50 pulled a muscle'
    ],
    correctAnswer: 3,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'actor-4',
    category: 'Child Star Recovery Program',
    text: 'Former child stars have the highest success rate when they:',
    options: [
      'Stay far away from Hollywood',
      'Embrace the weird transition',
      'Pretend it never happened',
      'Start a successful YouTube channel'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'actor-5',
    category: 'Method Acting vs Regular Acting',
    text: 'You know an actor is "method" when they:',
    options: [
      'Stay in character between takes',
      'Make everyone else uncomfortable',
      'Refuse to break character for months',
      'Write a book about their "process"'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'funny'
  },

  // BATCH 19: HISTORICAL DISASTERS & COMEDY (50+ questions)
  {
    id: 'history-1',
    category: 'Historical Events as Reality TV',
    text: 'The French Revolution would make terrible reality TV because:',
    options: [
      'Too many people getting eliminated',
      'Nobody would win in the end',
      'The audience would leave traumatized',
      'Guillotine liability insurance costs'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'history-2',
    category: 'Ancient Rome Yelp Reviews',
    text: 'The Colosseum would get bad Yelp reviews for:',
    options: [
      'Terrible concession stand prices',
      'No handicap accessibility',
      'Violence in the workplace',
      'Lions not properly trained'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'history-3',
    category: 'Medieval Times Job Market',
    text: 'The worst job in medieval times was:',
    options: [
      'Plague doctor',
      'Royal food taster',
      'Castle moat cleaner',
      'Town crier in a village of deaf people'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'history-4',
    category: 'World War II Zoom Calls',
    text: 'If WWII leaders had Zoom calls, which would have the worst tech issues:',
    options: [
      'Churchill (would forget to mute while smoking)',
      'Roosevelt (wheelchair accessibility problems)',
      'Stalin (would use fake background)',
      'Hitler (would rage quit when it glitched)'
    ],
    correctAnswer: 3,
    funniestAnswer: 2,
    type: 'edgy'
  },
  {
    id: 'history-5',
    category: 'Historical Dating Apps',
    text: 'Napoleon\'s dating profile would be rejected for:',
    options: [
      'Lying about height',
      'Too many pictures of conquests',
      'Mentioning exile as "travel experience"',
      'Complex about everything'
    ],
    correctAnswer: 0,
    funniestAnswer: 2,
    type: 'edgy'
  },

  // BATCH 20: SCIENCE GONE WRONG (50+ questions)
  {
    id: 'science-1',
    category: 'Science Experiments You Shouldn\'t Try',
    text: 'Your middle school science experiment failed because:',
    options: [
      'You followed TikTok instead of instructions',
      'Mixing random chemicals seemed fun',
      'Fire was not part of the hypothesis',
      'The volcano exploded the wrong direction'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'science-2',
    category: 'Physics vs Reality TV',
    text: 'Physics laws that reality TV shows ignore:',
    options: [
      'Gravity (people fall dramatically)',
      'Conservation of energy (endless drama)',
      'Thermodynamics (hot takes everywhere)',
      'Newton\'s third law (actions have consequences)'
    ],
    correctAnswer: 3,
    funniestAnswer: 1,
    type: 'funny'
  },
  {
    id: 'science-3',
    category: 'Lab Safety Violations',
    text: 'Your chemistry lab safety violation was:',
    options: [
      'Eating lunch next to dangerous chemicals',
      'Using beakers as coffee mugs',
      'Storing explosives next to the microwave',
      'Treating the fume hood as a hair dryer'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'science-4',
    category: 'Scientific Method Fails',
    text: 'Your scientific hypothesis was wrong when you assumed:',
    options: [
      'Correlation equals causation',
      'Your sample size of 3 people was enough',
      'Google counts as peer review',
      'Your gut feeling is scientific data'
    ],
    correctAnswer: 0,
    funniestAnswer: 2,
    type: 'funny'
  },
  {
    id: 'science-5',
    category: 'Evolution vs Intelligent Design',
    text: 'Evolution clearly made mistakes with:',
    options: [
      'Wisdom teeth (completely useless)',
      'The appendix (ticking time bomb)',
      'Male pattern baldness (cruel joke)',
      'Hangovers (learning prevention system)'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'funny'
  },

  // BATCH 21: ART WORLD PRETENTIOUSNESS (50+ questions)
  {
    id: 'art-1',
    category: 'Modern Art Gallery Confusion',
    text: 'You knew the art gallery was too pretentious when:',
    options: [
      'A blank canvas cost $50,000',
      'The janitor\'s mop was labeled as "installation"',
      'You needed a PhD to understand the wall text',
      'The gift shop cost more than your rent'
    ],
    correctAnswer: 0,
    funniestAnswer: 1,
    type: 'edgy'
  },
  {
    id: 'art-2',
    category: 'Art History vs Instagram',
    text: 'Which classical painting would get the most Instagram likes:',
    options: [
      'The Mona Lisa (mysterious smile)',
      'Girl with a Pearl Earring (natural lighting)',
      'The Scream (relatable content)',
      'Dogs Playing Poker (viral meme potential)'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'art-3',
    category: 'Art School Trauma',
    text: 'Art school was a mistake because:',
    options: [
      'Student loans exceed your art sales by millions',
      'Your parents still ask when you\'ll get a real job',
      'You can critique art but can\'t pay rent',
      'Your barista job uses more creativity'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'art-4',
    category: 'Museum Audio Tour Hell',
    text: 'Museum audio tours are annoying because:',
    options: [
      'They assume you care about every brushstroke',
      'The narrator sounds bored',
      'They\'re longer than the time you want to spend',
      'You look ridiculous wearing the headphones'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'funny'
  },
  {
    id: 'art-5',
    category: 'Starving Artist Stereotypes',
    text: 'You know you\'re a starving artist when:',
    options: [
      'Ramen is a food group',
      'Your art supplies cost more than your groceries',
      'You consider "exposure" a form of payment',
      'Your studio apartment is literally a closet'
    ],
    correctAnswer: 2,
    funniestAnswer: 0,
    type: 'edgy'
  },

  // BATCH 22: MUSIC INDUSTRY MADNESS (50+ questions)
  {
    id: 'music-industry-1',
    category: 'Record Label Ripoffs',
    text: 'You know your record deal is terrible when:',
    options: [
      'The label owns your firstborn',
      'You owe them money after selling millions',
      'They own your name, voice, and soul',
      'Spotify pays you in exposure coins'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'music-industry-2',
    category: 'Concert Ticket Economics',
    text: 'Concert tickets are overpriced because:',
    options: [
      'Ticketmaster adds 47 random fees',
      'VIP means you can see the stage',
      'Parking costs more than the ticket',
      'Your kidney is acceptable payment'
    ],
    correctAnswer: 0,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'music-industry-3',
    category: 'Music Video Budget Reality',
    text: 'Low-budget music videos always feature:',
    options: [
      'Abandoned warehouses',
      'The band performing in a garage',
      'Dramatic wind machine effects',
      'Someone\'s iPhone as the camera'
    ],
    correctAnswer: 3,
    funniestAnswer: 2,
    type: 'funny'
  },
  {
    id: 'music-industry-4',
    category: 'Album Release Strategy',
    text: 'Your album flopped because:',
    options: [
      'You released it on the same day as Taylor Swift',
      'Nobody buys albums anymore',
      'TikTok killed attention spans longer than 30 seconds',
      'You forgot to make it good'
    ],
    correctAnswer: 2,
    funniestAnswer: 3,
    type: 'edgy'
  },
  {
    id: 'music-industry-5',
    category: 'Streaming Revenue Reality',
    text: 'Spotify pays artists so little that:',
    options: [
      'A million streams equals minimum wage for a day',
      'Busking pays better',
      'You need a billion plays to afford ramen',
      'The CEO\'s lunch costs more than your royalties'
    ],
    correctAnswer: 1,
    funniestAnswer: 3,
    type: 'edgy'
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