# 🤖 Robo Tug of War Quiz

A two-player robot quiz battle. Pull the rope to your side by answering questions correctly!  
Supports **same-screen** play and **online multiplayer** via Firebase.

---

## 🎮 Game Modes

### 🖥️ Same Screen
Both players share one keyboard.

| Player | Answer Keys |
|--------|-------------|
| Player 1 (left 🔴) | `1` `2` `3` `4` |
| Player 2 (right 🔵) | `7` `8` `9` `0` |

### 🌐 Online — Different Screens
Each player opens the game on their own phone/laptop.  
Player 1 creates a room → gets a **5-character code** → shares it with Player 2 → both battle live!

---

## 🚀 Hosting on GitHub Pages (5 minutes)

1. Create a new repository on GitHub (can be private or public)
2. Upload all four files:
   - `index.html`
   - `style.css`
   - `game.js`
   - `questions.js`
3. Go to **Settings → Pages → Deploy from branch → main → / (root) → Save**
4. Your game is live at `https://<username>.github.io/<repo-name>/`

---

## 🔥 Setting Up Firebase for Online Mode (3 minutes)

Online multiplayer uses **Firebase Realtime Database** — Google's free real-time sync service.

### Step 1 — Create a Firebase project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → enter any name → Continue → Create project

### Step 2 — Add a Web app
1. In your project dashboard, click the **`</>`** (Web) icon
2. Give the app any nickname → click **Register app**
3. You'll see a `firebaseConfig` object — **keep this page open**

### Step 3 — Create a Realtime Database
1. In the left sidebar: **Build → Realtime Database → Create database**
2. Choose any region → click **Next**
3. Select **"Start in test mode"** → click **Enable**

### Step 4 — Set security rules (for testing)
1. In Realtime Database → **Rules** tab
2. Paste this and click **Publish**:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
> ⚠️ Test mode rules expire after 30 days. For permanent use, add authentication.

### Step 5 — Enter the config in the game
1. Open your game → click **Online Multiplayer**
2. Enter the values from your `firebaseConfig`:
   - **API Key** → `apiKey`
   - **Auth Domain** → `authDomain`
   - **Database URL** → `databaseURL`
   - **Project ID** → `projectId`
3. Click **Save & Connect** — the config is saved in your browser

---

## ➕ Adding Your Own Questions

Open `questions.js` and add a new array inside `QUESTION_SETS`:

```javascript
// SET 5 — Your custom topic
[
  { q: "Your question?", options: ["A", "B", "C", "D"], answer: 0 },
  // answer = index of correct option (0=A, 1=B, 2=C, 3=D)
  // Include at least 12 questions per set
],
```

The game randomly selects one full set per match, so rematches always feel fresh.

---

## 📁 Files

```
/
├── index.html      ← All screens: title, setup, lobby, game, win
├── style.css       ← Full visual styling
├── game.js         ← Game logic + Firebase multiplayer
└── questions.js    ← Question bank (4 sets × 16 questions)
```

---

## ⚙️ Tech Stack

Pure HTML / CSS / JavaScript — no build step, no Node.js required.  
Firebase SDK loaded dynamically from Google's CDN only when online mode is used.
