// Sample data + shared helpers for the gote UI-kit recreation.
// Photos are picsum placeholders standing in for iNaturalist observation
// photos (the real app pulls each user's own public observations).

window.GOTE = window.GOTE || {};

// Photos: keyword-matched nature images standing in for iNaturalist
// observation photos (the real app pulls each user's own public observations).
// `lock` keeps a given card showing a stable image across reloads.
window.GOTE.photo = (kw, lock, w = 800, h = 1100) =>
  `https://loremflickr.com/${w}/${h}/${encodeURIComponent(kw)}?lock=${lock}`;

// iNaturalist taxon groups → MaterialDesignIcons glyph + accent token name.
window.GOTE.GROUPS = {
  Amphibia: { icon: 'mdi-island', label: 'Amphibians', accent: 'green' },
  Aves: { icon: 'mdi-bird', label: 'Birds', accent: 'blue' },
  Insecta: { icon: 'mdi-bee', label: 'Insects', accent: 'amber' },
  Plantae: { icon: 'mdi-leaf', label: 'Plants', accent: 'green' },
  Fungi: { icon: 'mdi-mushroom', label: 'Fungi', accent: 'rose' },
  Mammalia: { icon: 'mdi-paw', label: 'Mammals', accent: 'slate' },
  Reptilia: { icon: 'mdi-turtle', label: 'Reptiles', accent: 'teal' },
  Mollusca: { icon: 'mdi-snail', label: 'Mollusks', accent: 'violet' },
};

// Play / learn menu rows (matches MenuScreen.js).
window.GOTE.PLAY_MODES = [
  { key: 'all', icon: 'albums-outline', accent: 'green', title: 'By name', sub: 'See a photo, choose its name' },
  { key: 'pick', icon: 'apps-outline', accent: 'blue', title: 'By picture', sub: 'See a name, choose its photo' },
  { key: 'speedrun', icon: 'flash', accent: 'amber', title: 'Speedrun', sub: 'Endless cards — survive 3 misses' },
  { key: 'nearby', icon: 'compass-outline', accent: 'teal', title: 'Nearby species', sub: 'Learn species typical to a place' },
  { key: 'custom', icon: 'options-outline', accent: 'violet', title: 'Custom game', sub: 'Choose how many cards and which groups' },
];

// Species deck — common + scientific name, group, "how well known", photo seed.
// status: 'strong' | 'learning' | 'new'
window.GOTE.SPECIES = [
  { id: 1, common: 'Eastern Newt', sci: 'Notophthalmus viridescens', group: 'Amphibia', status: 'strong', seed: 'newt-eastern' },
  { id: 2, common: 'Rough-skinned Newt', sci: 'Taricha granulosa', group: 'Amphibia', status: 'learning', seed: 'newt-rough' },
  { id: 3, common: 'American Robin', sci: 'Turdus migratorius', group: 'Aves', status: 'strong', seed: 'robin' },
  { id: 4, common: 'Western Honey Bee', sci: 'Apis mellifera', group: 'Insecta', status: 'strong', seed: 'bee' },
  { id: 5, common: 'Common Eastern Bumble Bee', sci: 'Bombus impatiens', group: 'Insecta', status: 'learning', seed: 'bumble' },
  { id: 6, common: 'Fly Agaric', sci: 'Amanita muscaria', group: 'Fungi', status: 'new', seed: 'amanita' },
  { id: 7, common: 'Red Fox', sci: 'Vulpes vulpes', group: 'Mammalia', status: 'learning', seed: 'fox' },
  { id: 8, common: 'Painted Turtle', sci: 'Chrysemys picta', group: 'Reptilia', status: 'strong', seed: 'turtle' },
  { id: 9, common: 'Garden Snail', sci: 'Cornu aspersum', group: 'Mollusca', status: 'new', seed: 'snail' },
  { id: 10, common: 'Common Milkweed', sci: 'Asclepias syriaca', group: 'Plantae', status: 'learning', seed: 'milkweed' },
  { id: 11, common: 'Monarch', sci: 'Danaus plexippus', group: 'Insecta', status: 'strong', seed: 'monarch' },
  { id: 12, common: 'Mallard', sci: 'Anas platyrhynchos', group: 'Aves', status: 'strong', seed: 'mallard' },
];

// One quiz card: the answer + 4 distractor names (real-ish look-alikes).
window.GOTE.QUIZ_CARDS = [
  {
    kw: 'newt,salamander', lock: 21, answer: 'Eastern Newt', sci: 'Notophthalmus viridescens',
    choices: ['Eastern Newt', 'Rough-skinned Newt', 'Red Eft', 'Fire Salamander', 'Spotted Salamander'],
  },
  {
    kw: 'monarch,butterfly', lock: 34, answer: 'Monarch', sci: 'Danaus plexippus',
    choices: ['Viceroy', 'Monarch', 'Queen Butterfly', 'Painted Lady', 'Red Admiral'],
  },
  {
    kw: 'amanita,mushroom', lock: 12, answer: 'Fly Agaric', sci: 'Amanita muscaria',
    choices: ['Fly Agaric', 'Caesar’s Mushroom', 'Panther Cap', 'Blusher', 'False Death Cap'],
  },
  {
    kw: 'turtle,pond', lock: 47, answer: 'Painted Turtle', sci: 'Chrysemys picta',
    choices: ['Red-eared Slider', 'Painted Turtle', 'Box Turtle', 'Map Turtle', 'Spotted Turtle'],
  },
];

window.GOTE.STATUS_LABEL = { strong: 'Known well', learning: 'Learning', new: 'New' };
