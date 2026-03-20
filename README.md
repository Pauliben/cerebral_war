# 🤖 Robo Tug of War Quiz

A two-player browser-based quiz game where robots battle in a tug of war — every correct answer pulls the rope toward your side!

## 🎮 How to Play

- **2 players** sit at the same keyboard
- Each player gets **12 questions** (independently shuffled from the same pool)
- Answer correctly → your robot pulls the rope toward you
- **Win by:** finishing all 12 questions first, OR having the highest score when the **100-second timer** runs out

### Controls

| Player | Keys |
|--------|------|
| Player 1 (left) | `1` `2` `3` `4` |
| Player 2 (right) | `7` `8` `9` `0` |

> Each number maps to answer options A / B / C / D

### Scoring Mechanics
- ✅ Correct answer → rope pulls +5 units toward you
- 🔥 3+ streak → bonus pull (+2 extra)
- ❌ Wrong answer → no pull, streak resets

---

## 🚀 Hosting on GitHub Pages

1. **Fork or create** a new GitHub repository
2. **Upload** all three files:
   - `index.html`
   - `style.css`
   - `game.js`
   - `questions.js`
3. Go to **Settings → Pages**
4. Set source to **Deploy from a branch → main → / (root)**
5. Click **Save** — your game will be live at:
   `https://<your-username>.github.io/<repo-name>/`

---

## ➕ Adding More Questions

Open `questions.js` and add a new array inside `QUESTION_SETS`:

```javascript
// SET 5 — Your custom topic
[
  { q: "Your question here?", options: ["A", "B", "C", "D"], answer: 0 },
  // answer: index of correct option (0=A, 1=B, 2=C, 3=D)
  // Add at least 12 questions per set
],
```

The game randomly picks one set per match, ensuring fresh questions every round.

---

## 📁 File Structure

```
/
├── index.html      ← Game layout & screens
├── style.css       ← All visual styling
├── game.js         ← Game logic & controls
└── questions.js    ← Question bank (add your own!)
```

---

## 🛠 Tech Stack

Pure HTML / CSS / JavaScript — no dependencies, no build step required.
