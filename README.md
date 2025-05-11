

# 🌟 DailyX

**DailyX** is a modern productivity and habit-tracking app built with **React Native** and **Firebase**. It helps users plan, complete, and reflect on daily tasks while delivering insightful analytics to build better routines.

---

## 🚀 Features

### ✅ Core Functionality

* **Task Management** – Create, update, complete, and delete tasks, earning XP for each.
* **Recurring Tasks** – Build habits with automatically repeating daily tasks.
* **Task History** – Every task action is timestamped and device-tracked.
* **XP System** – Gain XP, level up, and track your growth.
* **Personal Journal** – Log moods, thoughts, and reflections.
* **User Profile** – Customize with a username, full name, and profile picture.
* **Sidebar Navigation** – Quick access to all major app screens.

### 📊 Insightful Analytics (Read-Only)

* **Daily XP Trend** – Visualize your XP day by day.
* **Streak Counter** – Track your current XP streak.
* **Completion Rate Card** – View your daily task success rate.
* **Average XP per Task** – See how efficient your task rewards are.
* **Minimalist Visuals** – Focus on insights without distractions.

### 🎨 Theming & UX

* **Dark Mode** – Full support across all screens.
* **Responsive Design** – Optimized for iOS and Android.
* **Clean UI** – Minimalistic and modern user interface.

---

## 🧱 Tech Stack

* **React Native** (with Expo)
* **Firebase** (Authentication & Firestore)
* **Redux** (State Management)
* **React Navigation**
* **TypeScript**

---

## 🗂️ Project Structure

```
DailyX/
├── app/
│   ├── components/     # Reusable UI components
│   ├── screens/        # App screens (Dashboard, Analytics, Journal, etc.)
│   ├── services/       # Firebase logic and integrations
│   ├── store/          # Redux slices and selectors
│   ├── assets/PP/      # Profile pictures
│   ├── theme/          # Theme context and style utilities
│   └── utils/          # Helper functions
```

---

## 🧠 Design Philosophy

* **Passive Analytics** – Analytics screens are read-only and never trigger backend updates.
* **Stateless Visualizers** – Components receive props only; no internal state or side effects.
* **Data Isolation** – Each user's data is stored securely under their unique Firestore collection.
* **Actionable Insights** – Analytics prioritize clarity over raw data overload.

---

## ⚙️ Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/)
* [Yarn](https://yarnpkg.com/) or `npm`
* [Expo CLI](https://docs.expo.dev/)
* Firebase project (with **Authentication** and **Firestore** enabled)

### Installation

1. **Clone the repository**:

```bash
git clone https://github.com/yourusername/DailyX.git
cd DailyX
```

2. **Install dependencies**:

```bash
yarn install
# or
npm install
```

3. **Configure Firebase**:

* Copy `firebaseConfig.example.ts` to `firebaseConfig.ts`
* Add your Firebase project credentials.

4. **Start the app**:

```bash
expo start
```

---

## 📦 Building for Production

### Android (APK):

```bash
eas build -p android --profile production
```

### iOS (App Store):

```bash
eas build -p ios --profile production
```

---

## 🔐 Security & Privacy

* All user data is stored under `users/{userId}` in Firestore.
* Authentication is securely managed via Firebase Auth.
* We do **not** share or sell any user data.

---

## 🤝 Contributing

Contributions are welcome!
For major changes, please open an issue first to discuss what you'd like to improve.

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 🙏 Acknowledgements

* Inspired by the best practices in habit-building and productivity.
* Built with ❤️ 

