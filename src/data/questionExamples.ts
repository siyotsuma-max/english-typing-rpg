type DifficultyKey = 'Eiken5' | 'Eiken4' | 'EikenPre1';
type LevelKey = 1 | 2 | 3;
type QuestionLike = { text: string };

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const withArticle = (text: string) => `${/^[aeiou]/i.test(text) ? 'an' : 'a'} ${text}`;
const pickExample = (text: string, patterns: string[]) => patterns[getStableIndex(text, patterns.length)];

const EIKEN5_LEVEL1_ADJECTIVES = new Set([
  'sunny', 'cloudy', 'rainy', 'snowy', 'windy', 'warm', 'cool', 'hot', 'cold',
  'tall', 'short', 'long', 'big', 'small', 'little', 'large', 'fat', 'thin', 'heavy', 'light',
  'old', 'new', 'young', 'good', 'bad', 'nice', 'great', 'wonderful', 'beautiful', 'pretty', 'cute',
  'happy', 'sad', 'angry', 'tired', 'sleepy', 'hungry', 'thirsty', 'sick', 'fine', 'well', 'busy',
  'free', 'easy', 'hard', 'difficult', 'interesting', 'exciting', 'fun', 'funny', 'kind', 'friendly',
  'strong', 'weak', 'fast', 'slow', 'high', 'low', 'right', 'wrong', 'same', 'different', 'important',
  'special', 'famous', 'clean', 'dirty', 'quiet', 'noisy', 'sweet', 'sour', 'soft', 'favorite',
  'popular', 'lucky', 'careful', 'ready',
]);

const EIKEN5_LEVEL1_COLORS = new Set([
  'red', 'blue', 'white', 'black', 'green', 'yellow', 'pink', 'orange', 'brown', 'purple', 'gold', 'silver',
]);

const EIKEN5_LEVEL1_NUMBERS = new Set([
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
  'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
]);

const EIKEN5_LEVEL1_BIG_NUMBERS = new Set(['hundred', 'thousand']);
const EIKEN5_LEVEL1_ORDINALS = new Set(['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']);
const EIKEN5_LEVEL1_WEEKDAYS = new Set(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
const EIKEN5_LEVEL1_MONTHS = new Set(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);
const EIKEN5_LEVEL1_SEASONS = new Set(['spring', 'summer', 'fall', 'winter']);
const EIKEN5_LEVEL1_COUNTRIES = new Set(['Japan', 'America', 'Canada', 'Australia', 'China', 'France']);
const EIKEN5_LEVEL1_LANGUAGES = new Set(['English', 'Chinese', 'French']);
const EIKEN5_LEVEL1_ADVERBS = new Set([
  'really', 'very', 'so', 'too', 'always', 'usually', 'often', 'sometimes', 'never',
  'again', 'also', 'together', 'alone', 'here', 'there', 'near', 'far', 'away', 'home', 'out',
]);
const EIKEN5_LEVEL1_PLURAL_NOUNS = new Set(['children', 'people', 'teeth', 'feet']);
const EIKEN5_LEVEL1_FOODS = new Set([
  'banana', 'sandwich', 'hamburger', 'pizza', 'curry', 'juice', 'coffee', 'milk', 'cake', 'chocolate',
  'orange', 'apple', 'tomato', 'salad', 'melon', 'lemon', 'breakfast', 'lunch', 'dinner', 'supper',
  'snack', 'food', 'fruit', 'vegetable', 'meat', 'fish', 'egg', 'bread', 'rice', 'water', 'tea', 'jam',
  'butter', 'salt', 'sugar', 'pepper', 'soy sauce', 'oil',
]);
const EIKEN5_LEVEL1_ANIMALS = new Set([
  'dog', 'cat', 'rabbit', 'hamster', 'bird', 'lion', 'tiger', 'elephant', 'monkey', 'bear', 'panda',
  'horse', 'cow', 'pig', 'sheep', 'chicken', 'dolphin', 'whale', 'insect',
]);
const EIKEN5_LEVEL1_PLACES = new Set([
  'school', 'classroom', 'gym', 'library', 'office', 'hospital', 'bank', 'station', 'airport', 'park',
  'bookstore', 'supermarket', 'building', 'apartment', 'zoo', 'museum', 'theater', 'stadium', 'bridge',
  'tower', 'street', 'city', 'town', 'village', 'country', 'world', 'kitchen', 'bathroom', 'bedroom', 'garden',
]);
const EIKEN5_LEVEL1_TRANSPORT = new Set(['bus', 'taxi', 'car', 'bike', 'bicycle', 'train', 'plane', 'ship', 'boat', 'truck']);
const EIKEN5_LEVEL1_CLOTHES = new Set([
  'cap', 'hat', 'shirt', 'coat', 'jacket', 'sweater', 'dress', 'skirt', 'shoe', 'sock', 'pocket', 'umbrella',
  'glove', 'T-shirt',
]);
const EIKEN5_LEVEL1_HOME_ITEMS = new Set([
  'camera', 'computer', 'calendar', 'notebook', 'pen', 'pencil', 'eraser', 'ruler', 'bag', 'watch', 'cup',
  'glass', 'dish', 'plate', 'spoon', 'fork', 'knife', 'chopstick', 'bottle', 'box', 'basket', 'table', 'chair',
  'desk', 'bed', 'sofa', 'curtain', 'door', 'window', 'floor', 'wall', 'room', 'phone', 'book', 'magazine',
  'newspaper', 'dictionary', 'textbook', 'page', 'map', 'picture', 'letter', 'postcard', 'ticket', 'passport',
  'card', 'present',
]);
const EIKEN5_LEVEL1_BODY_PARTS = new Set([
  'head', 'face', 'eye', 'ear', 'nose', 'mouth', 'tooth', 'teeth', 'hair', 'hand', 'finger', 'arm', 'shoulder',
  'leg', 'foot', 'feet', 'knee', 'body', 'heart', 'stomach', 'back',
]);
const EIKEN5_LEVEL1_JOBS = new Set([
  'teacher', 'student', 'doctor', 'nurse', 'dentist', 'firefighter', 'pilot', 'driver', 'cook', 'baker',
  'farmer', 'singer', 'artist', 'writer', 'scientist', 'clerk', 'waiter', 'waitress',
]);
const EIKEN5_LEVEL1_PEOPLE = new Set([
  'family', 'father', 'mother', 'parent', 'brother', 'sister', 'grandfather', 'grandmother', 'uncle', 'aunt',
  'son', 'daughter', 'baby', 'child', 'children', 'boy', 'girl', 'man', 'woman', 'friend', 'classmate',
  'neighbor', 'people', 'person',
]);
const EIKEN5_LEVEL1_NATURE = new Set([
  'flower', 'rose', 'tree', 'leaf', 'grass', 'mountain', 'river', 'sea', 'beach', 'sky', 'star', 'sun', 'moon', 'cloud',
]);

const EIKEN5_LEVEL1_EXACT_EXAMPLES: Record<string, string> = {
  ski: 'I ski in winter.',
  skate: 'They skate in the park.',
  start: 'School starts at eight.',
  camp: 'We camp by the lake in summer.',
  hiking: 'We go hiking on Sunday.',
  present: 'This present is for you.',
  watch: 'This watch is new.',
  dish: 'This dish is very good.',
  weather: 'The weather is nice today.',
  rain: 'We had rain this morning.',
  snow: 'We had snow last night.',
  wind: 'The wind is very strong today.',
  time: 'What time is it now?',
  hour: 'I studied English for an hour.',
  minute: 'Please wait a minute.',
  second: 'Please wait a second.',
  morning: 'I study English in the morning.',
  afternoon: 'We play tennis in the afternoon.',
  evening: 'My family eats dinner in the evening.',
  night: 'I read books at night.',
  noon: 'We have lunch at noon.',
  day: 'It is a busy day.',
  week: 'We play soccer every week.',
  month: 'This month is very busy.',
  year: 'This year is special.',
  today: 'I am busy today.',
  tomorrow: 'We have a test tomorrow.',
  yesterday: 'I was at home yesterday.',
  weekend: 'We go to the park on the weekend.',
  holiday: 'It is a school holiday.',
  birthday: 'Today is my birthday.',
  Christmas: 'We have a party on Christmas.',
  date: 'Please write the date here.',
  family: 'I love my family.',
  father: 'My father is kind.',
  mother: 'My mother cooks dinner.',
  parent: 'My parent came to school today.',
  brother: 'My brother plays soccer.',
  sister: 'My sister likes music.',
  uncle: 'My uncle drives a bus.',
  aunt: 'My aunt is a teacher.',
  son: 'Their son is very kind.',
  daughter: 'Their daughter can swim well.',
  hair: 'Her hair is long.',
  heart: 'My heart was happy.',
  stomach: 'My stomach is full.',
  right: 'Your answer is right.',
  left: 'My bag is on the left.',
  sorry: 'I am sorry for being late.',
  sure: 'Sure, I can help you.',
  too: 'I like dogs too.',
  much: 'We do not have much time.',
  many: 'We have many books at school.',
  'a lot of': 'We have a lot of homework today.',
  some: 'I want some water.',
  any: 'Do you have any questions?',
  all: 'All students are here today.',
  every: 'I read English every day.',
  each: 'Each student has a bag.',
  other: 'I want the other one.',
  another: 'Can I have another cup?',
  both: 'Both books are interesting.',
  only: 'Only Tom can answer it.',
  just: 'I am just a student.',
  about: 'There are about ten students here.',
  almost: 'It is almost noon.',
  either: 'I do not like coffee either.',
  into: 'The cat ran into the room.',
};

const EIKEN5_LEVEL2_EXACT_EXAMPLES: Record<string, string> = {
  'look at': 'Look at this picture.',
  'listen to': 'Please listen to the teacher.',
  'a cup of': 'I would like a cup of tea.',
  'a piece of': 'I ate a piece of cake.',
  'a lot of': 'We saw a lot of people in the park.',
  'kind of': 'What kind of music do you like?',
  'in front of': 'He is standing in front of the station.',
  'next to': 'My house is next to the park.',
  'live in': 'I live in Tokyo.',
  'like to': 'I like to read books after dinner.',
  'want to': 'I want to play tennis today.',
  'look for': 'I am looking for my notebook.',
  'talk with': 'I talk with my friends after school.',
  'wait for': 'Please wait for me here.',
  'thank you': 'Thank you for your help.',
  'you are welcome': 'You are welcome, Mike.',
  'excuse me': 'Excuse me, where is the station?',
  'I am sorry': 'I am sorry I was late.',
  'see you': 'See you after school.',
  'good morning': 'Good morning, everyone.',
  'good afternoon': 'Good afternoon, Ms. Brown.',
  'good evening': 'Good evening, Dad.',
  'good night': 'Good night, Mom.',
  'how are you': 'How are you today?',
  'nice to meet you': 'Nice to meet you, Ken.',
  'of course': 'Of course, I can help you.',
  'all right': 'It is all right now.',
  'that is right': 'That is right, Mr. Sato.',
  'over there': 'My school is over there.',
  'right here': 'Come and sit right here.',
  'T-shirt': 'This T-shirt is new.',
};

const EIKEN5_LEVEL2_VERB_STARTERS = [
  'get', 'go', 'come', 'look', 'listen', 'sit', 'stand', 'write', 'clean', 'wake',
  'take', 'have', 'play', 'watch', 'read', 'study', 'cook', 'help', 'do', 'wash',
  'use', 'make', 'speak', 'swim', 'run', 'walk', 'live', 'like', 'want', 'talk', 'wait',
];

const EIKEN5_LEVEL2_TIME_PHRASES = new Set([
  'all day', 'all night', 'all the time', 'for a long time', 'once a week', 'twice a month',
  'three times a year', 'every morning', 'last night', 'this morning', 'tomorrow morning',
  'day after tomorrow', 'day before yesterday', 'next week', 'last month', 'next year',
  'in the morning', 'in the afternoon', 'in the evening', 'at night', 'on Sunday', 'after school',
]);

const EIKEN5_LEVEL2_LOCATION_PHRASES = new Set(['at home', 'at school']);

const getEiken5Level1FallbackExample = (text: string) => {
  if (EIKEN5_LEVEL1_EXACT_EXAMPLES[text]) return EIKEN5_LEVEL1_EXACT_EXAMPLES[text];
  if (EIKEN5_LEVEL1_MONTHS.has(text)) return pickExample(text, [
    `My birthday is in ${text}.`,
    `School starts in ${text}.`,
    `We have a holiday in ${text}.`,
  ]);
  if (EIKEN5_LEVEL1_WEEKDAYS.has(text)) return pickExample(text, [
    `We play soccer on ${text}.`,
    `I go to school on ${text}.`,
    `My father is busy on ${text}.`,
  ]);
  if (EIKEN5_LEVEL1_SEASONS.has(text)) return pickExample(text, [
    `${capitalize(text)} is my favorite season.`,
    `We have good weather in ${text}.`,
    `I like ${text} very much.`,
  ]);
  if (EIKEN5_LEVEL1_COUNTRIES.has(text)) return pickExample(text, [
    `I want to visit ${text} someday.`,
    `My friend is from ${text}.`,
    `${text} is a beautiful country.`,
  ]);
  if (EIKEN5_LEVEL1_LANGUAGES.has(text)) return pickExample(text, [
    `I study ${text} at school.`,
    `My teacher speaks ${text}.`,
    `This book is in ${text}.`,
  ]);
  if (EIKEN5_LEVEL1_ORDINALS.has(text)) return pickExample(text, [
    `He is the ${text} runner.`,
    `This is my ${text} visit here.`,
    `She sits in the ${text} row.`,
  ]);
  if (EIKEN5_LEVEL1_BIG_NUMBERS.has(text)) return pickExample(text, [
    `There are a ${text} stars in the sky.`,
    `This city has a ${text} parks.`,
    `We need a ${text} yen.`,
  ]);
  if (EIKEN5_LEVEL1_NUMBERS.has(text)) return pickExample(text, [
    `I have ${text} pens.`,
    `She has ${text} dogs.`,
    `We need ${text} chairs.`,
  ]);
  if (EIKEN5_LEVEL1_COLORS.has(text)) return pickExample(text, [
    `My bag is ${text}.`,
    `His bike is ${text}.`,
    `I like the ${text} flower.`,
  ]);
  if (EIKEN5_LEVEL1_ADVERBS.has(text)) return pickExample(text, [
    `We study English ${text}.`,
    `My father comes home ${text}.`,
    `I see my friends ${text}.`,
  ]);
  if (EIKEN5_LEVEL1_ADJECTIVES.has(text)) return pickExample(text, [
    `The book is ${text}.`,
    `My dog looks ${text}.`,
    `This question is ${text}.`,
  ]);
  if (EIKEN5_LEVEL1_FOODS.has(text)) return pickExample(text, [
    `I like ${text}.`,
    `We have ${text} for lunch.`,
    `My mother buys ${text} on Sunday.`,
  ]);
  if (EIKEN5_LEVEL1_ANIMALS.has(text)) return pickExample(text, [
    `I saw ${withArticle(text)} at the zoo.`,
    `The ${text} is very cute.`,
    `My sister likes the ${text}.`,
  ]);
  if (EIKEN5_LEVEL1_PLACES.has(text)) return pickExample(text, [
    `I go to the ${text} after school.`,
    `This ${text} is near my house.`,
    `We can meet at the ${text}.`,
  ]);
  if (EIKEN5_LEVEL1_TRANSPORT.has(text)) return pickExample(text, [
    `I go to school by ${text}.`,
    `My father has a ${text}.`,
    `We can take the ${text} home.`,
  ]);
  if (EIKEN5_LEVEL1_CLOTHES.has(text)) return pickExample(text, [
    `This ${text} is new.`,
    `My mother bought a ${text} for me.`,
    `I put my ${text} on the chair.`,
  ]);
  if (EIKEN5_LEVEL1_HOME_ITEMS.has(text)) return pickExample(text, [
    `This ${text} is on my desk.`,
    `I use this ${text} every day.`,
    `My brother has ${withArticle(text)} in his room.`,
  ]);
  if (EIKEN5_LEVEL1_BODY_PARTS.has(text)) return pickExample(text, [
    `My ${text} hurts today.`,
    `Wash your ${text} before dinner.`,
    `The baby moved its ${text}.`,
  ]);
  if (EIKEN5_LEVEL1_JOBS.has(text)) return pickExample(text, [
    `My mother is ${withArticle(text)}.`,
    `That ${text} is very busy.`,
    `I want to be ${withArticle(text)} someday.`,
  ]);
  if (EIKEN5_LEVEL1_PEOPLE.has(text)) return pickExample(text, [
    `My ${text} is kind.`,
    `I talked with my ${text} after school.`,
    `The ${text} is waiting for us.`,
  ]);
  if (EIKEN5_LEVEL1_NATURE.has(text)) return pickExample(text, [
    `I can see ${withArticle(text)} from here.`,
    `The ${text} is beautiful today.`,
    `We walked near the ${text}.`,
  ]);
  if (EIKEN5_LEVEL1_PLURAL_NOUNS.has(text)) return pickExample(text, [
    `I can see ${text} in the park.`,
    `${capitalize(text)} are in the room.`,
    `We talked with the ${text}.`,
  ]);
  return pickExample(text, [
    `I saw ${withArticle(text)} today.`,
    `This is ${withArticle(text)} from my room.`,
    `My friend has ${withArticle(text)}.`,
    `We use ${withArticle(text)} at school.`,
  ]);
};

const getEiken5Level2FallbackExample = (text: string) => {
  if (EIKEN5_LEVEL2_EXACT_EXAMPLES[text]) return EIKEN5_LEVEL2_EXACT_EXAMPLES[text];
  if (EIKEN5_LEVEL2_TIME_PHRASES.has(text)) return pickExample(text, [
    `We study English ${text}.`,
    `My father is busy ${text}.`,
    `I do my homework ${text}.`,
  ]);
  if (EIKEN5_LEVEL2_LOCATION_PHRASES.has(text)) return pickExample(text, [
    `I study English ${text}.`,
    `My mother is ${text} now.`,
    `We eat dinner ${text}.`,
  ]);
  if (EIKEN5_LEVEL2_VERB_STARTERS.some(starter => text.startsWith(`${starter} `))) return pickExample(text, [
    `I ${text}.`,
    `We ${text} after school.`,
    `They ${text} every day.`,
    `My brother likes to ${text}.`,
  ]);
  return pickExample(text, [
    `I like ${text}.`,
    `We use ${text} in class.`,
    `My teacher says ${text}.`,
    `I hear "${text}" at school.`,
  ]);
};

const PRE1_LEVEL1_EXAMPLES: Record<string, string> = {
  abundant: 'Fresh water is abundant here.',
  accelerate: 'The project accelerated after the funding arrived.',
  accommodate: 'The hotel can accommodate 200 guests.',
  accompany: 'Strong winds accompanied the storm.',
  accumulate: 'Dust accumulated under the sofa.',
  accurate: 'The report was accurate.',
  acknowledge: 'She acknowledged the mistake.',
  acquire: 'He acquired new skills abroad.',
  adapt: 'Animals must adapt to changing environments.',
  adequate: 'The food supply was adequate.',
  adjust: 'You can adjust the chair height.',
  administer: 'Nurses administered the vaccine carefully.',
  advocate: 'Many parents advocate smaller classes.',
  affordable: 'The city needs more affordable housing.',
  aggression: 'The coach warned against aggression on the field.',
  allocate: 'The city allocated more money to schools.',
  alter: 'The storm altered our travel plans.',
  ambitious: 'She set an ambitious goal for the year.',
  analyze: 'Researchers analyzed the survey data.',
  anticipate: 'We anticipate a rise in demand.',
  apparent: 'It soon became apparent that we were lost.',
  appeal: 'The idea appeals to young voters.',
  appoint: 'They appointed her chair of the committee.',
  appreciate: 'I appreciate your honest feedback.',
  arbitrary: 'The limit seems arbitrary to many users.',
  architecture: 'The city has beautiful architecture.',
  assess: 'The doctor assessed his condition.',
  asset: 'Trust is a valuable asset.',
  assign: 'The teacher assigned extra homework.',
  assist: 'Two volunteers assisted the elderly man.',
  attain: 'She worked hard to attain her goal.',
  attribute: 'Patience is her best attribute.',
  authorize: 'The manager authorized the refund.',
  autonomous: 'The rover can operate in an autonomous mode.',
  barrier: 'Cost is a major barrier.',
  beneficial: 'Regular exercise is beneficial to mental health.',
  bias: 'The survey showed a clear bias.',
  brief: 'He gave a brief explanation.',
  capacity: 'This hall has a large capacity.',
  capture: 'The photo captures the moment well.',
  cease: 'The noise ceased at midnight.',
  challenge: 'Climate change is a global challenge.',
  circumstance: 'Under the circumstances, we had to leave early.',
  civil: 'The protest remained civil throughout the day.',
  clarify: 'Could you clarify the last point?',
  collapse: 'The old bridge collapsed in the storm.',
  combine: 'The recipe combines sweet and sour flavors.',
  commence: 'The ceremony will commence at noon.',
  commit: 'The company committed itself to safer practices.',
  commodity: 'Oil is a valuable commodity.',
  compatible: 'This software is compatible with older systems.',
  compile: 'She compiled the data into a chart.',
  complement: 'The scarf complements her coat.',
  component: 'Trust is a key component of teamwork.',
  comprehensive: 'The guide offers comprehensive advice.',
  compromise: 'They reached a fair compromise.',
  concentrate: 'Please concentrate on the task.',
  conclude: 'The study concluded that sleep matters.',
  concrete: 'We need concrete evidence.',
  conduct: 'The team conducted a survey.',
  confer: 'The two leaders conferred in private.',
  confine: 'Please confine your comments to the main topic.',
  confirm: 'Please confirm your reservation by Friday.',
  conflict: 'The conflict lasted for years.',
  conform: 'All products must conform to safety standards.',
  conservative: 'He comes from a conservative family.',
  considerable: 'The project requires a considerable amount of time.',
  consistent: 'Her results have been consistent for months.',
  constant: 'The machine makes a constant noise.',
  construct: 'Workers constructed a temporary bridge.',
  consult: 'You should consult a doctor.',
  consume: 'Cars consume a lot of energy.',
  contaminate: 'Dirty water can contaminate the soil.',
  contemporary: 'The museum features contemporary art.',
  context: 'You need to see the word in context.',
  contradict: 'His actions contradict his words.',
  contribute: 'Everyone can contribute ideas to the discussion.',
  controversial: 'The proposal remains highly controversial.',
  convert: 'The factory was converted into a studio.',
  convince: 'She convinced me to stay.',
  cooperate: 'The two companies agreed to cooperate.',
  cope: 'He struggled to cope after the accident.',
  core: 'Safety is at the core of the plan.',
  corporate: 'She works in corporate law.',
  correspond: 'The results do not correspond with our expectations.',
  criterion: 'Cost is an important criterion.',
  crucial: 'Timing is crucial in an emergency.',
  curb: 'The new policy aims to curb waste.',
  curious: 'Children are naturally curious.',
  currency: 'Digital currency is growing fast.',
  decade: 'The town changed a lot over the last decade.',
  decline: 'Sales declined in winter.',
  dedicate: 'She dedicated the book to her parents.',
  deficit: 'The country faces a budget deficit.',
  define: 'It is hard to define success.',
  delay: 'Fog delayed the flight.',
  demand: 'There is strong demand for clean energy.',
  demonstrate: 'The experiment demonstrated the theory.',
  dense: 'The forest is dense and dark.',
  deny: 'He denied the accusation.',
  depart: 'The train departs at 7:30.',
  depend: 'Success depends on preparation.',
  depress: 'The news depressed everyone.',
  derive: 'Many English words derive from Latin.',
  detect: 'The test can detect early signs of disease.',
  deteriorate: "The patient's condition deteriorated overnight.",
  devote: 'She devotes most of her time to research.',
  diagnose: 'Doctors diagnosed him with pneumonia.',
  differ: 'Opinions differ from person to person.',
  diminish: 'The pain gradually diminished.',
  dimension: 'The problem has a social dimension.',
  discriminate: 'It is illegal to discriminate on the basis of age.',
  dispute: 'The dispute went to court.',
  distinct: 'The twins have distinct personalities.',
  distribute: 'Volunteers distributed food to the crowd.',
  diverse: 'The city has a diverse population.',
  domestic: 'Domestic flights were canceled due to snow.',
  dominant: 'Online shopping has become the dominant trend.',
  donate: 'Many people donated clothes after the fire.',
  durable: 'These shoes are light but durable.',
  economy: 'The local economy depends on tourism.',
  efficient: 'The new system is more efficient.',
  elaborate: 'Could you elaborate on your proposal?',
  eliminate: 'The new law could eliminate that risk.',
  emerge: 'A new leader emerged during the crisis.',
  emotion: 'Her voice was full of emotion.',
  emphasize: 'The teacher emphasized the importance of practice.',
  encounter: 'We encountered heavy traffic on the way.',
  encourage: 'Good teachers encourage curiosity.',
  enormous: 'The stadium was built at enormous cost.',
  ensure: 'Please check the map to ensure accuracy.',
  enterprise: 'She started a small enterprise.',
  environmental: 'The group supports environmental education.',
  equivalent: 'This amount is equivalent to one week of pay.',
  essential: 'Water is essential for life.',
  estimate: 'Experts estimate the cost at $2 million.',
  ethical: 'The company must address ethical concerns.',
  evaluate: 'The panel will evaluate the proposals.',
  eventual: 'Her eventual success inspired the team.',
  evident: 'Her relief was evident on her face.',
  evolve: 'Languages evolve over time.',
  exceed: 'Costs may exceed the original budget.',
  exclude: 'The list excludes part-time workers.',
  executive: 'The executive approved the plan.',
  exhibit: 'The museum exhibits local art.',
  expand: 'The company plans to expand overseas.',
  expenditure: 'Government expenditure rose last year.',
  expert: 'Ask an expert for advice.',
  exploit: 'Some companies exploit cheap labor.',
  expose: 'The article exposed serious flaws in the system.',
  external: 'The device has no external damage.',
  extract: 'The recipe uses oil extracted from seeds.',
  factor: 'Sleep is a key factor in health.',
  federal: 'Federal law protects this area.',
  fee: 'There is no fee for this class.',
  finance: 'He works in finance.',
  flexible: 'My schedule is flexible this week.',
  focus: 'The main focus is safety.',
  forbid: 'School rules forbid smoking.',
  forecast: 'Rain is in the forecast for tomorrow.',
  foster: 'Reading can foster creativity.',
  fragile: 'Handle the glass carefully; it is fragile.',
  framework: 'The report provides a clear framework.',
  frequent: 'We had frequent power cuts last summer.',
  frustrate: 'Long delays frustrate commuters.',
  fund: 'The charity needs more funds.',
  furthermore: 'Furthermore, the plan would cost less.',
  gender: 'The survey asked about age and gender.',
  generate: 'The campaign generated a lot of interest.',
  genuine: 'Her apology sounded genuine.',
  grant: 'The university granted her a scholarship.',
  guarantee: 'The store cannot guarantee delivery by Friday.',
  habitat: 'This bird has lost its habitat.',
  harm: 'Too much sun can harm your skin.',
  hazard: 'Smoke is a serious hazard.',
  highlight: 'The report highlights three problems.',
  hostile: 'The audience was openly hostile.',
  household: 'Many households recycle paper.',
  ideal: 'This room is ideal for meetings.',
  identify: 'The police identified the suspect.',
  ignore: 'Please do not ignore the warning signs.',
  illustrate: 'The diagram illustrates how the machine works.',
  immediate: 'The patient needs immediate care.',
  impact: 'The decision had a big impact.',
  impose: 'The city imposed a water restriction.',
  incentive: 'Tax cuts can be an incentive.',
  incident: 'The incident shocked the town.',
  include: 'The price includes breakfast.',
  income: 'His income fell last year.',
  increase: 'The company increased wages this year.',
  indicate: 'Dark clouds indicate rain.',
  individual: 'Each individual has different needs.',
  inevitable: 'Some mistakes are inevitable at first.',
  infer: 'From his tone, I inferred that he was upset.',
  influence: 'Friends can strongly influence teenagers.',
  ingredient: 'Sugar is the main ingredient.',
  initial: 'The initial response was positive.',
  inquiry: 'We received an inquiry from a local school.',
  insight: 'The book offers useful insight.',
  insist: 'She insisted on paying the bill.',
  install: 'They installed solar panels on the roof.',
  institution: 'The school is a public institution.',
  integrate: 'The program helps newcomers integrate into society.',
  intense: 'The competition was intense.',
  interact: 'Children learn by interacting with others.',
  internal: 'The report found internal problems.',
  interpret: 'People often interpret silence differently.',
  interval: 'The buses arrive at 15-minute intervals.',
  invest: 'The company plans to invest in training.',
  issue: 'Water safety is a major issue.',
  journal: 'She published the article in a journal.',
  justify: 'Nothing can justify such violence.',
  labor: 'The job requires physical labor.',
  landscape: 'The mountain landscape was beautiful.',
  launch: 'The company launched a new service.',
  legal: 'You should get legal advice.',
  legitimate: 'The complaint raised legitimate concerns.',
  leisure: 'Reading is one of my favorite leisure activities.',
  liberal: 'She takes a more liberal view on education.',
  limit: 'Parents often limit screen time before bed.',
  localize: 'Doctors were able to localize the source of the pain.',
  maintain: 'It is hard to maintain a healthy routine.',
  majority: 'The majority supported the proposal.',
  manufacture: 'The factory manufactures medical equipment.',
  margin: 'The team won by a small margin.',
  mature: 'He became more mature after the experience.',
  maximum: 'The hall has a maximum capacity of 500.',
  measure: 'The city took strict measures.',
  medical: 'He is seeking medical treatment abroad.',
  mental: 'Regular breaks improve mental focus.',
  migrate: 'Some birds migrate south in winter.',
  minimum: 'A minimum fee will be charged.',
  minor: 'The car sustained only minor damage.',
  monitor: 'Doctors will monitor his progress.',
  mutual: 'The two countries reached a mutual agreement.',
  narrow: 'We crossed a narrow bridge.',
  necessary: 'A passport is necessary for this trip.',
  neglect: 'No child should suffer from neglect.',
  negotiate: 'They are negotiating a new contract.',
  notable: 'She made a notable contribution to the field.',
  numerous: 'The city offers numerous cultural events.',
  objective: 'Our main objective is quality.',
  observe: 'Researchers observed a change in behavior.',
  obtain: 'You must obtain permission first.',
  occupy: 'The boxes occupy too much space.',
  occur: 'Such errors rarely occur.',
  obstacle: 'Lack of funds remains a major obstacle.',
  obvious: 'The answer may seem obvious now.',
  operate: 'The clinic operates 24 hours a day.',
  oppose: 'Several residents oppose the plan.',
  ordinary: 'It was just an ordinary day.',
  outcome: 'The outcome surprised everyone.',
  overall: 'Overall, the results were encouraging.',
  participate: 'Anyone can participate in the workshop.',
  particular: 'He showed particular interest in science.',
  perceive: 'Children perceive time differently from adults.',
  permanent: 'The stain left permanent marks.',
  permit: 'The museum does not permit flash photography.',
  perspective: 'Travel changed my perspective.',
  phase: 'The project is now in its final phase.',
  physical: 'Regular exercise improves physical strength.',
  policy: 'The company changed its hiring policy.',
  positive: 'She tries to stay positive.',
  potential: 'The area has great potential for growth.',
  poverty: 'Many children still live in poverty.',
  precise: 'Please give precise instructions.',
  predict: 'No one can predict the future exactly.',
  preserve: 'These efforts help preserve local traditions.',
  primary: 'Our primary concern is safety.',
  principle: 'Honesty is an important principle.',
  priority: 'Safety is our top priority.',
  proceed: 'After a short break, the meeting proceeded.',
  process: 'Learning is a slow process.',
  professional: 'She gave me professional advice.',
  prohibit: 'The law prohibits discrimination.',
  promote: 'The campaign promotes healthy eating.',
  prospect: 'The job offers good prospects.',
  protect: 'Sunscreen helps protect your skin.',
  provide: 'The course provides practical training.',
  publish: 'The paper was published last month.',
  purchase: 'The company purchased new equipment.',
  pursue: 'She decided to pursue a career in law.',
  recover: 'He recovered quickly after surgery.',
  reduce: 'This change could reduce traffic noise.',
  regard: 'Many people regard him as a great leader.',
  region: 'Rice is grown throughout the region.',
  regulate: 'The government regulates food safety.',
  reinforce: "The coach's words reinforced my confidence.",
  reject: 'The board rejected the proposal.',
  release: 'The studio released a new film.',
  rely: 'Many villages rely on well water.',
  remove: 'Please remove your shoes at the door.',
  require: 'The job requires patience and skill.',
  reserve: 'I reserved a table for six.',
  resist: 'Some people resist change.',
  resource: 'Time is a limited resource.',
  restore: 'The rain restored the lake level.',
  restrict: 'The library restricts access after 9 p.m.',
  reveal: 'The test revealed the problem.',
  rural: 'She grew up in a rural area.',
};

const PRE1_LEVEL2_EXAMPLES: Record<string, string> = {
  'account for': 'Can you account for this mistake?',
  'adhere to': 'All members are expected to adhere to the guidelines.',
  'agree on': 'They agreed on a new plan.',
  'aim at': 'The campaign aims at young voters.',
  'allow for': 'The schedule should allow for unexpected delays.',
  'appeal to': 'The ad appeals to young people.',
  'approve of': 'I do not approve of that idea.',
  'be based on': 'The film is based on a true story.',
  'be composed of': 'The committee is composed of five members.',
  'be concerned about': 'Parents are concerned about online safety.',
  'be exposed to': 'Children are exposed to many ads.',
  'be inclined to': 'He is inclined to doubt new ideas.',
  'be involved in': 'She was involved in the project.',
  'break down': 'My car broke down yesterday.',
  'bring about': 'The new law brought about significant change.',
  'build up': 'Stress can build up over time.',
  'call for': 'The crisis calls for quick action.',
  'carry out': 'The researchers carried out the experiment.',
  'catch up with': 'I ran to catch up with Ken.',
  'come across': 'I came across an old photo.',
  'come up with': 'She came up with a good idea.',
  'comply with': 'All drivers must comply with the law.',
  'consist of': 'The team consists of five members.',
  'contribute to': 'Regular exercise contributes to good health.',
  'cope with': 'She learned to cope with stress.',
  'cut back on': 'Many families are cutting back on eating out.',
  'deal with': 'He dealt with the complaint well.',
  'depend on': 'Success depends on hard work.',
  'differ from': 'My view differs from yours.',
  'distinguish A from B': 'Can you distinguish fact from opinion?',
  'do away with': 'The school did away with the old rule.',
  'draw attention to': 'The report draws attention to rural poverty.',
  'drop out of': 'He dropped out of college.',
  'engage in': 'Many students engage in volunteer work.',
  'figure out': 'It took us hours to figure out the cause.',
  'fill in': 'Please fill in this form.',
  'focus on': 'The discussion focused on practical solutions.',
  'gain access to': 'Only staff can gain access to the room.',
  'get rid of': 'She finally got rid of the broken printer.',
  'give rise to': 'The error gave rise to confusion.',
  'go through': 'She went through a hard time.',
  'hold back': 'Do not hold back your opinion.',
  'in accordance with': 'The work was done in accordance with the rules.',
  'in addition to': 'In addition to English, he studies math.',
  'in charge of': 'She is in charge of sales.',
  'in contrast to': 'In contrast to his brother, he is quiet.',
  'in favor of': 'Most members are in favor of the plan.',
  'in response to': 'The city acted in response to complaints.',
  'in terms of': 'The idea works well in terms of cost.',
  'keep up with': 'Small firms struggle to keep up with rapid change.',
  'lead to': 'Poor sleep can lead to mistakes.',
  'look into': 'The police will look into the case.',
  'make a difference': 'Small steps can make a difference.',
  'make up for': 'I worked late to make up for lost time.',
  'object to': 'Some people object to the change.',
  'participate in': 'Many students participate in the event.',
  'pay attention to': 'Please pay attention to the signs.',
  'point out': 'She pointed out the main problem.',
  'prevent A from B': 'The lock prevents children from opening the door.',
  'put off': 'We had to put off the meeting.',
  'recover from': 'He recovered from the flu.',
  'refer to': 'The guide refers to local customs.',
  'rely on': 'Many farmers rely on rain.',
  'result in': 'Careless driving can result in accidents.',
  'result from': 'The delay resulted from bad weather.',
  'run out of': 'We ran out of paper.',
  'set up': 'They set up a small business.',
  'show up': 'Only ten people showed up.',
  'stand for': 'NPO stands for non-profit organization.',
  'suffer from': 'Many people suffer from back pain.',
  'take advantage of': 'Students should take advantage of this chance.',
  'take care of': 'She takes care of her grandmother.',
  'take into account': 'The judge took his age into account.',
  'take part in': 'He took part in the contest.',
  'take responsibility for': 'Leaders must take responsibility for mistakes.',
  'turn down': 'She turned down the offer.',
  'turn out': 'The plan turned out well.',
  'work on': 'We are working on a new app.',
  'be aware of': 'You should be aware of the risk.',
  'bear in mind': 'Bear in mind that time is limited.',
  'by means of': 'The door opens by means of a sensor.',
  'face criticism': 'The company faced criticism online.',
  'gain popularity': 'The game gained popularity quickly.',
  'have an impact on': 'The decision had an impact on prices.',
  'keep track of': 'I use an app to keep track of my spending.',
  'meet a deadline': 'We worked late to meet the deadline.',
  'on behalf of': 'She spoke on behalf of the team.',
  'play a role in': 'Diet plays a role in health.',
  'pose a threat to': 'Plastic waste poses a threat to sea life.',
  'raise awareness of': 'The campaign raised awareness of food waste.',
  'reach a conclusion': 'The team finally reached a conclusion.',
  'under pressure': 'He works well under pressure.',
  'with regard to': 'I have a question with regard to fees.',
  'at first glance': 'At first glance, the answer seemed easy.',
  'for the sake of': 'They moved for the sake of safety.',
  'in the long run': 'The change will help in the long run.',
  'on the verge of': 'The team was on the verge of winning.',
  'out of date': 'This data is out of date.',
  'take effect': 'The new rule takes effect next month.',
  'with the exception of': 'With the exception of one student, everyone passed.',
};

const PRE1_LEVEL1_INTRANSITIVE_VERBS = new Set([
  'accelerate',
  'adapt',
  'cease',
  'collapse',
  'concentrate',
  'conclude',
  'conform',
  'cooperate',
  'cope',
  'decline',
  'depart',
  'differ',
  'diminish',
  'emerge',
  'evolve',
  'exceed',
  'migrate',
  'occur',
  'proceed',
  'resist',
]);

const PRE1_LEVEL1_NOUN_HINTS = [
  'tion',
  'sion',
  'ment',
  'ity',
  'ness',
  'ship',
  'ance',
  'ence',
  'ism',
  'ist',
  'age',
  'ure',
  'hood',
];

const PRE1_LEVEL1_ADJECTIVE_HINTS = [
  'able',
  'ible',
  'al',
  'ial',
  'ical',
  'ive',
  'ous',
  'ful',
  'less',
  'ant',
  'ent',
  'ary',
  'ory',
  'ish',
  'ed',
];

const PRE1_LEVEL1_ADVERBS = new Set(['furthermore']);

const isLikelyLevel1Adjective = (text: string) => PRE1_LEVEL1_ADJECTIVE_HINTS.some(suffix => text.endsWith(suffix));
const isLikelyLevel1Noun = (text: string) => PRE1_LEVEL1_NOUN_HINTS.some(suffix => text.endsWith(suffix));

const getStableIndex = (text: string, size: number) =>
  [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0) % size;

const getPre1Level1FallbackExample = (text: string) => {
  if (PRE1_LEVEL1_ADVERBS.has(text)) {
    return `${text[0].toUpperCase()}${text.slice(1)}, the second option is cheaper.`;
  }

  if (PRE1_LEVEL1_INTRANSITIVE_VERBS.has(text)) {
    const patterns = [
      `Conditions can ${text} quickly.`,
      `Prices may ${text} over time.`,
      `Tensions often ${text} without warning.`,
    ];
    return patterns[getStableIndex(text, patterns.length)];
  }

  if (isLikelyLevel1Adjective(text)) {
    const patterns = [
      `The result was ${text}.`,
      `The policy seems ${text}.`,
      `The evidence is ${text}.`,
    ];
    return patterns[getStableIndex(text, patterns.length)];
  }

  if (isLikelyLevel1Noun(text)) {
    const patterns = [
      `The report focuses on ${text}.`,
      `We discussed ${text} in class.`,
      `${text[0].toUpperCase()}${text.slice(1)} remains an important issue.`,
    ];
    return patterns[getStableIndex(text, patterns.length)];
  }

  const patterns = [
    `The team plans to ${text} the system.`,
    `Experts continue to ${text} the issue.`,
    `They tried to ${text} the problem carefully.`,
  ];
  return patterns[getStableIndex(text, patterns.length)];
};

export const getQuestionExample = (
  difficulty: DifficultyKey,
  level: LevelKey,
  question: QuestionLike
): string | null => {
  if (difficulty === 'Eiken5') {
    if (level === 1) return getEiken5Level1FallbackExample(question.text);
    if (level === 2) return getEiken5Level2FallbackExample(question.text);
    return question.text || null;
  }

  if (difficulty !== 'EikenPre1' || level === 3) return null;

  if (level === 1) {
    return PRE1_LEVEL1_EXAMPLES[question.text] ?? getPre1Level1FallbackExample(question.text);
  }

  return PRE1_LEVEL2_EXAMPLES[question.text] ?? null;
};
