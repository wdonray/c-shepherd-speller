/**
 * Curated K-3 word bank for pattern-based spelling suggestions.
 *
 * WORD_SUGGESTIONS[normalizedSound][normalizedPattern] = words.
 * Both keys are lowercase, trimmed. All words are lowercase, single tokens,
 * K-3 reading level, no proper nouns or slang.
 *
 * Suggestions only appear on EXACT sound+pattern match (see PatternEditor).
 * Never fuzzy-matched, never guessed.
 */
export type WordSuggestions = Record<string, Record<string, string[]>>

export const WORD_SUGGESTIONS: WordSuggestions = {
  'short a': {
    a: ['cat', 'hat', 'map', 'pan', 'bag', 'jam', 'van', 'sad', 'nap', 'tap'],
  },
  'short e': {
    e: ['bed', 'red', 'pen', 'ten', 'men', 'net', 'pet', 'leg', 'hen', 'wet'],
  },
  'short i': {
    i: ['pig', 'big', 'sit', 'hit', 'lip', 'win', 'pin', 'mix', 'six', 'kid'],
  },
  'short o': {
    o: ['hot', 'pot', 'dog', 'log', 'box', 'fox', 'top', 'mop', 'hop', 'jog'],
  },
  'short u': {
    u: ['cup', 'bus', 'sun', 'run', 'fun', 'mud', 'hug', 'tub', 'rug', 'pup'],
  },
  'long a': {
    a_e: ['cake', 'bake', 'made', 'name', 'game', 'late', 'date', 'grape', 'plane', 'brave'],
    ai: ['rain', 'pain', 'train', 'mail', 'wait', 'paint', 'trail', 'snail', 'brain', 'chain'],
    ay: ['day', 'play', 'say', 'may', 'tray', 'stay', 'spray', 'clay', 'sway', 'pay'],
  },
  'long e': {
    ee: ['see', 'tree', 'green', 'sleep', 'sheep', 'street', 'free', 'queen', 'sweet', 'deep'],
    ea: ['read', 'sea', 'team', 'dream', 'clean', 'leaf', 'beach', 'teach', 'cream', 'speak'],
    e_e: ['these', 'eve'],
    y: ['happy', 'sunny', 'funny', 'candy', 'puppy'],
  },
  'long i': {
    i_e: ['bike', 'like', 'time', 'five', 'nine', 'drive', 'smile', 'white', 'prize', 'fine'],
    igh: ['light', 'night', 'high', 'sight', 'bright', 'fight', 'right', 'tight'],
    ie: ['pie', 'tie', 'die', 'lie'],
    y: ['fly', 'cry', 'try', 'dry', 'sky', 'shy', 'my', 'by'],
  },
  'long o': {
    o_e: ['home', 'rope', 'nose', 'stone', 'phone', 'drove', 'chose', 'globe'],
    oa: ['boat', 'road', 'coat', 'goat', 'soap', 'toast', 'float', 'throat'],
    ow: ['snow', 'show', 'blow', 'grow', 'flow', 'slow', 'yellow', 'window'],
    oe: ['toe', 'doe', 'foe'],
  },
  'long u': {
    u_e: ['cube', 'tube', 'tune', 'mule', 'flute', 'huge', 'prune'],
    ue: ['blue', 'true', 'glue', 'clue'],
    ew: ['new', 'few', 'dew', 'grew', 'chew', 'blew'],
  },
  sh: {
    sh: ['ship', 'fish', 'shop', 'wish', 'brush', 'fresh', 'crash', 'dish', 'cash', 'rush'],
  },
  ch: {
    ch: ['chip', 'chat', 'chest', 'lunch', 'bench', 'branch', 'catch', 'match', 'rich', 'such'],
    tch: ['watch', 'catch', 'match', 'batch', 'patch', 'hatch', 'witch', 'ditch'],
  },
  th: {
    th: ['this', 'that', 'them', 'then', 'with', 'bath', 'math', 'thick', 'thin', 'think'],
  },
  wh: {
    wh: ['when', 'what', 'where', 'which', 'white', 'whale', 'wheel', 'whip'],
  },
  ph: {
    ph: ['phone', 'photo', 'graph'],
  },
  ar: {
    ar: ['car', 'far', 'star', 'park', 'dark', 'shark', 'barn', 'yarn', 'hard', 'march'],
  },
  er: {
    er: ['her', 'fern', 'verb', 'clerk', 'sheriff'],
    ir: ['bird', 'girl', 'first', 'shirt', 'third', 'dirt', 'birth', 'stir'],
    ur: ['turn', 'burn', 'hurt', 'surf', 'curl', 'burst', 'church', 'nurse'],
  },
  or: {
    or: ['for', 'corn', 'horse', 'storm', 'sport', 'short', 'born', 'worn', 'fork', 'horn'],
  },
  oo: {
    oo: ['moon', 'spoon', 'food', 'soon', 'zoo', 'pool', 'school', 'room', 'broom', 'gloom'],
  },
  'book oo': {
    oo: ['book', 'look', 'took', 'good', 'foot', 'wood', 'stood', 'hook', 'cook', 'brook'],
  },
  ow: {
    ow: ['cow', 'how', 'now', 'brown', 'down', 'town', 'owl', 'crowd', 'plow'],
    ou: ['out', 'house', 'mouse', 'cloud', 'shout', 'mouth', 'round', 'found', 'loud', 'proud'],
  },
  oy: {
    oi: ['oil', 'coin', 'join', 'point', 'noise', 'soil', 'boil'],
    oy: ['boy', 'toy', 'joy', 'enjoy', 'royal'],
  },
  aw: {
    aw: ['saw', 'paw', 'claw', 'draw', 'straw', 'jaw', 'law', 'crawl'],
    au: ['haul', 'launch', 'pause'],
    al: ['talk', 'walk', 'chalk', 'small', 'ball', 'call', 'fall', 'tall'],
  },
  air: {
    air: ['air', 'fair', 'hair', 'pair', 'chair', 'stairs'],
    are: ['care', 'share', 'dare', 'scare', 'stare'],
  },
  ear: {
    ear: ['hear', 'near', 'fear', 'dear', 'year', 'clear', 'ear'],
    eer: ['deer', 'steer', 'cheer', 'peer'],
  },
  ck: {
    ck: ['back', 'pack', 'duck', 'luck', 'rock', 'clock', 'truck', 'snack', 'brick', 'stick'],
  },
  ng: {
    ng: ['sing', 'ring', 'king', 'long', 'song', 'wing', 'swing', 'bring', 'string', 'strong'],
    nk: ['bank', 'tank', 'pink', 'drink', 'think', 'trunk', 'skunk', 'blink'],
  },
  tch: {
    tch: ['watch', 'catch', 'match', 'batch', 'patch', 'hatch', 'witch', 'ditch'],
  },
  dge: {
    dge: ['bridge', 'fridge', 'badge', 'edge', 'fudge', 'judge', 'dodge', 'hedge'],
  },
  kn: {
    kn: ['know', 'knee', 'knock', 'knife', 'knot', 'knight'],
  },
  wr: {
    wr: ['write', 'wrong', 'wrist', 'wrap', 'wreck'],
  },
  mb: {
    mb: ['lamb', 'comb', 'thumb', 'climb', 'bomb', 'numb'],
  },
  ce: {
    ce: ['ice', 'face', 'place', 'dance', 'fence', 'nice', 'rice', 'twice'],
    ci: ['city', 'circus'],
  },
  ge: {
    ge: ['cage', 'page', 'huge', 'stage', 'orange', 'giraffe'],
    gi: ['giant', 'ginger'],
  },
  all: {
    all: ['all', 'ball', 'call', 'fall', 'tall', 'small', 'wall', 'hall'],
  },
  ild: {
    ild: ['wild', 'child', 'mild'],
    ind: ['find', 'kind', 'mind', 'behind'],
  },
  old: {
    old: ['old', 'cold', 'gold', 'hold', 'told', 'sold'],
    olt: ['bolt', 'colt'],
    ost: ['most', 'post', 'toast'],
  },
}
