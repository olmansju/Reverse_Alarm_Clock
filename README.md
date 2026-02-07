# Reverse Alarm Clock Prototype

A browser-based **reverse alarm clock** that helps users go to bed on time by shifting intervention *earlier* in the night—before poor sleep decisions compound.

Instead of only alarming at wake-up time, this system calculates a nightly plan, monitors the current time against that plan, issues graduated warnings before bedtime, and triggers a final alarm if the user stays up too late.

This is a lightweight, client-side prototype designed for rapid iteration, UX experimentation, and research-informed behavior design.

---

## Core Idea

Most alarm clocks intervene **too late**.

By the time a morning alarm goes off, the damage is already done: insufficient sleep, cognitive fatigue, and reduced next-day performance.

This prototype explores an alternative model:

**Support the decision to stop earlier—while the user still has agency.**

---

## Key Features

- **Reverse planning**
  - User inputs:
    - Desired wake time
    - Desired sleep duration
    - Optional wind-down / ritual buffer
  - App calculates:
    - Ritual start time
    - Bedtime
    - Warning window(s)

- **Night monitoring mode**
  - Locks the plan for the night
  - Displays:
    - Tonight’s plan
    - Live countdown
    - Current phase (safe, warning, alarm)
  - Hides setup inputs to reduce renegotiation friction

- **Graduated warnings**
  - Gentle audio warnings before bedtime
  - Repeated chimes to increase salience
  - Designed to nudge rather than punish

- **Final alarm**
  - Fires if the user exceeds their planned sleep window
  - Louder and longer than warnings
  - Explicitly signals that sleep debt is accumulating

- **Pure client-side**
  - No backend
  - No accounts
  - Uses only browser APIs and local state

---

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript

No frameworks, no build step, no external dependencies.

---

## Project Structure

```text
/
├── index.html        # Main UI
├── styles.css        # Visual styles
├── app.js            # Core logic and state management
├── audio/            # Warning and alarm sounds
│   ├── warning.mp3
│   └── alarm.mp3
└── README.md
