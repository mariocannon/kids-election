// Random, silly, kid-friendly political parties.

const ADJECTIVES = [
  'Sparkly', 'Sleepy', 'Mighty', 'Bouncy', 'Giggling', 'Cosmic', 'Fuzzy', 'Turbo',
  'Jolly', 'Brave', 'Wobbly', 'Super', 'Rainbow', 'Thunder', 'Happy', 'Sneaky',
];

const NOUNS = [
  'Pancake', 'Dragon', 'Unicorn', 'Dinosaur', 'Robot', 'Penguin', 'Taco', 'Rocket',
  'Banana', 'Llama', 'Octopus', 'Cupcake', 'Puppy', 'Kitten', 'Volcano', 'Waffle',
];

const SUFFIXES = ['Party', 'Club', 'Alliance', 'Crew', 'League', 'Team'];

const TITLES = ['Captain', 'Professor', 'Sir', 'Lady', 'Doctor', 'Chief', 'Admiral', 'Queen', 'King'];
const LEADER_NAMES = [
  'Waffles', 'Sprinkles', 'Bubbles', 'Noodle', 'Pickles', 'Biscuit', 'Jellybean',
  'Snickerdoodle', 'Marshmallow', 'Pudding', 'Zigzag', 'Muffin',
];

const SLOGANS = [
  'More recess for everyone!',
  'Pizza Fridays forever!',
  'Every day is pajama day!',
  'Homework? More like FUN-work!',
  'A puppy in every classroom!',
  'Dessert BEFORE dinner!',
  'Bigger slides, faster swings!',
  'Make Mondays fun again!',
  'Glitter is a human right!',
  'Naps for grown-ups too!',
  'Snow days all year round!',
  'Bedtime is just a suggestion!',
];

const PROMISES = [
  'Build a giant trampoline on the playground',
  'Ice cream machine in the cafeteria',
  'Free stickers every Friday',
  'Dance party after lunch',
  'Class pets for every class',
  'Longer summer holidays',
  'A water slide from the roof',
  'Movie afternoon once a week',
  'Silly hat day every Wednesday',
  'Teachers have to do homework too',
  'Bring your pet to school day',
  'Chocolate milk at every water fountain',
];

// Darker shades so they still look good printed in black & white or color.
const COLORS = [
  { name: 'Red', hex: '#d62828' },
  { name: 'Orange', hex: '#f77f00' },
  { name: 'Gold', hex: '#c9a000' },
  { name: 'Green', hex: '#2a9d4b' },
  { name: 'Teal', hex: '#13867f' },
  { name: 'Blue', hex: '#1d5fd1' },
  { name: 'Purple', hex: '#7b2cbf' },
  { name: 'Pink', hex: '#d63384' },
];

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeParties(count) {
  count = Math.max(2, Math.min(COLORS.length, count));
  const adjectives = shuffle(ADJECTIVES);
  const nouns = shuffle(NOUNS);
  const colors = shuffle(COLORS);
  const leaders = shuffle(LEADER_NAMES);
  const slogans = shuffle(SLOGANS);
  const promises = shuffle(PROMISES);

  return Array.from({ length: count }, (_, i) => {
    const adj = adjectives[i];
    const noun = nouns[i];
    const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
    const title = TITLES[Math.floor(Math.random() * TITLES.length)];
    return {
      id: i + 1,
      name: `The ${adj} ${noun} ${suffix}`,
      initials: adj[0] + noun[0],
      color: colors[i].hex,
      colorName: colors[i].name,
      leader: `${title} ${leaders[i]}`,
      slogan: slogans[i],
      promises: [promises[i * 2 % promises.length], promises[(i * 2 + 1) % promises.length]],
    };
  });
}
