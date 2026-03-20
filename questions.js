// questions.js — Question bank for Tug of War Quiz
// Add more question sets here. The game picks one set randomly each round.

const QUESTION_SETS = [
  // SET 1 — General Knowledge
  [
    { q: "What is the capital of France?", options: ["Berlin", "Madrid", "Paris", "Rome"], answer: 2 },
    { q: "How many sides does a hexagon have?", options: ["5", "6", "7", "8"], answer: 1 },
    { q: "What planet is known as the Red Planet?", options: ["Venus", "Saturn", "Jupiter", "Mars"], answer: 3 },
    { q: "Who painted the Mona Lisa?", options: ["Michelangelo", "Leonardo da Vinci", "Raphael", "Donatello"], answer: 1 },
    { q: "What is the chemical symbol for gold?", options: ["Gd", "Go", "Au", "Ag"], answer: 2 },
    { q: "How many continents are there on Earth?", options: ["5", "6", "7", "8"], answer: 2 },
    { q: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], answer: 3 },
    { q: "In what year did World War II end?", options: ["1943", "1944", "1945", "1946"], answer: 2 },
    { q: "What is the fastest land animal?", options: ["Lion", "Cheetah", "Leopard", "Horse"], answer: 1 },
    { q: "How many bones are in the adult human body?", options: ["196", "206", "216", "226"], answer: 1 },
    { q: "What gas do plants absorb from the atmosphere?", options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"], answer: 2 },
    { q: "Which country is home to the kangaroo?", options: ["New Zealand", "South Africa", "Brazil", "Australia"], answer: 3 },
    { q: "What is the square root of 144?", options: ["10", "11", "12", "13"], answer: 2 },
    { q: "Which planet has the most moons?", options: ["Jupiter", "Saturn", "Uranus", "Neptune"], answer: 1 },
    { q: "What is H2O commonly known as?", options: ["Salt", "Sugar", "Water", "Acid"], answer: 2 },
    { q: "How many strings does a standard guitar have?", options: ["4", "5", "6", "7"], answer: 2 },
  ],

  // SET 2 — Science & Nature
  [
    { q: "What is the powerhouse of the cell?", options: ["Nucleus", "Ribosome", "Mitochondria", "Vacuole"], answer: 2 },
    { q: "What force keeps planets in orbit around the Sun?", options: ["Magnetism", "Gravity", "Friction", "Nuclear force"], answer: 1 },
    { q: "What is the most abundant gas in Earth's atmosphere?", options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Argon"], answer: 2 },
    { q: "What is the speed of light (approx)?", options: ["200,000 km/s", "300,000 km/s", "400,000 km/s", "500,000 km/s"], answer: 1 },
    { q: "How many chromosomes does a human cell have?", options: ["23", "44", "46", "48"], answer: 2 },
    { q: "What is the chemical formula for table salt?", options: ["KCl", "NaCl", "MgCl", "CaCl"], answer: 1 },
    { q: "Which blood type is the universal donor?", options: ["A+", "B-", "O-", "AB+"], answer: 2 },
    { q: "What is the hardest natural substance on Earth?", options: ["Gold", "Iron", "Diamond", "Quartz"], answer: 2 },
    { q: "What organ produces insulin?", options: ["Liver", "Kidney", "Pancreas", "Spleen"], answer: 2 },
    { q: "How many planets are in our solar system?", options: ["7", "8", "9", "10"], answer: 1 },
    { q: "What type of energy does the Sun primarily produce?", options: ["Chemical", "Kinetic", "Nuclear", "Magnetic"], answer: 2 },
    { q: "What is the boiling point of water at sea level (°C)?", options: ["90", "95", "100", "105"], answer: 2 },
    { q: "Which animal has the largest brain relative to body size?", options: ["Elephant", "Dolphin", "Human", "Crow"], answer: 2 },
    { q: "What is the atomic number of carbon?", options: ["4", "6", "8", "12"], answer: 1 },
    { q: "What is the name of the process plants use to make food?", options: ["Respiration", "Fermentation", "Photosynthesis", "Osmosis"], answer: 2 },
    { q: "How many chambers does the human heart have?", options: ["2", "3", "4", "5"], answer: 2 },
  ],

  // SET 3 — History & Geography
  [
    { q: "Who was the first person to walk on the Moon?", options: ["Buzz Aldrin", "Yuri Gagarin", "Neil Armstrong", "John Glenn"], answer: 2 },
    { q: "In what year did the Berlin Wall fall?", options: ["1987", "1988", "1989", "1990"], answer: 2 },
    { q: "Which river is the longest in the world?", options: ["Amazon", "Mississippi", "Yangtze", "Nile"], answer: 3 },
    { q: "What is the smallest country in the world?", options: ["Monaco", "San Marino", "Vatican City", "Liechtenstein"], answer: 2 },
    { q: "Who wrote 'Romeo and Juliet'?", options: ["Charles Dickens", "William Shakespeare", "Mark Twain", "Jane Austen"], answer: 1 },
    { q: "Which ancient wonder was located in Alexandria?", options: ["Colossus", "Hanging Gardens", "Lighthouse", "Statue of Zeus"], answer: 2 },
    { q: "What is the capital of Japan?", options: ["Osaka", "Kyoto", "Hiroshima", "Tokyo"], answer: 3 },
    { q: "Who was the first female Prime Minister of the UK?", options: ["Queen Elizabeth II", "Margaret Thatcher", "Theresa May", "Angela Merkel"], answer: 1 },
    { q: "Which country hosted the 2016 Summer Olympics?", options: ["China", "UK", "Brazil", "Russia"], answer: 2 },
    { q: "What is the largest country by land area?", options: ["China", "Canada", "USA", "Russia"], answer: 3 },
    { q: "In what year did Christopher Columbus reach the Americas?", options: ["1488", "1490", "1492", "1498"], answer: 2 },
    { q: "What mountain range separates Europe from Asia?", options: ["Alps", "Himalayas", "Andes", "Urals"], answer: 3 },
    { q: "Which empire was ruled by Julius Caesar?", options: ["Greek", "Ottoman", "Roman", "Byzantine"], answer: 2 },
    { q: "What is the capital of Australia?", options: ["Sydney", "Melbourne", "Brisbane", "Canberra"], answer: 3 },
    { q: "Which country invented paper?", options: ["Egypt", "India", "China", "Japan"], answer: 2 },
    { q: "What language is most spoken worldwide (native speakers)?", options: ["English", "Hindi", "Spanish", "Mandarin Chinese"], answer: 3 },
  ],

  // SET 4 — Pop Culture & Sports
  [
    { q: "How many players are on a basketball team on the court?", options: ["4", "5", "6", "7"], answer: 1 },
    { q: "Which band sang 'Bohemian Rhapsody'?", options: ["The Beatles", "Led Zeppelin", "Queen", "Pink Floyd"], answer: 2 },
    { q: "What sport is played at Wimbledon?", options: ["Badminton", "Squash", "Tennis", "Table Tennis"], answer: 2 },
    { q: "How many rings are on the Olympic flag?", options: ["4", "5", "6", "7"], answer: 1 },
    { q: "Which country invented football (soccer)?", options: ["Brazil", "Spain", "France", "England"], answer: 3 },
    { q: "What is the highest possible score in a single bowling turn?", options: ["10", "20", "30", "300"], answer: 3 },
    { q: "In chess, which piece can only move diagonally?", options: ["Rook", "Knight", "Bishop", "Queen"], answer: 2 },
    { q: "Who directed 'Jurassic Park' (1993)?", options: ["James Cameron", "George Lucas", "Steven Spielberg", "Ridley Scott"], answer: 2 },
    { q: "What is the name of Batman's butler?", options: ["James", "Alfred", "Thomas", "Arthur"], answer: 1 },
    { q: "Which country has won the most FIFA World Cups?", options: ["Germany", "Italy", "Argentina", "Brazil"], answer: 3 },
    { q: "How many Grammy Awards has Beyoncé won (as of 2024)?", options: ["22", "26", "32", "28"], answer: 3 },
    { q: "What is the best-selling video game of all time?", options: ["Tetris", "GTA V", "Minecraft", "Mario Bros"], answer: 2 },
    { q: "How many colors are in a standard rainbow?", options: ["5", "6", "7", "8"], answer: 2 },
    { q: "What is the currency of Japan?", options: ["Won", "Yuan", "Yen", "Ringgit"], answer: 2 },
    { q: "Who invented the telephone?", options: ["Thomas Edison", "Alexander Graham Bell", "Nikola Tesla", "Guglielmo Marconi"], answer: 1 },
    { q: "In what year was the first iPhone released?", options: ["2005", "2006", "2007", "2008"], answer: 2 },
  ],
];

// Picks a random set and returns 12 shuffled questions
function loadQuestions() {
  const setIndex = Math.floor(Math.random() * QUESTION_SETS.length);
  const pool = [...QUESTION_SETS[setIndex]];
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 12);
}
