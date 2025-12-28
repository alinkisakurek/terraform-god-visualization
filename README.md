# Terraform God: Local Search Visualization 🌍

## 👥 Development Team

| Role | Name |
| :--- | :--- |
| **Data & Environment Architect** | Bilge Küçükçakmak |
| **UI/Visualization Specialist** | Nisanur Konur |
| **Core AI Logic Implementer** | İlayda Gündüz |
| **Advanced AI & Integration Engineer** | Alin Kısakürek |

## 📖 Project Overview
"Terraform God" is an interactive web-based simulation designed to demonstrate the limitations of **Hill Climbing** algorithms (specifically getting stuck in Local Maxima or Plateaus) and how **Simulated Annealing** solves this problem using a stochastic approach.

Unlike standard pathfinding demos, this project treats the AI algorithm as a **physics rule**. The user plays as a "Deity" controlling the global temperature (chaos factor) via a slider, directly influencing whether civilization agents behave rationally (climbing up) or erratically (exploring/rolling down).

## 🎮 Mechanics & Algorithms

### 1. The Terrain (Search Space)
The simulation uses a procedurally generated **Tile-Based Map** representing a 3D terrain with different utility scores. Unlike a simple heatmap, this environment simulates real-world geography:

- **Terrain Types & Scores:**
  - 🏡 **Village (Green):** Score **100** (Global Maximum / The Goal).
  - ⛰️ **Mountain (Brown):** Score **80** (Local Maximum / The Trap).
  - 🌾 **Transition (Yellow):** Score **50** (Plateau / Flat Land).
  - 🌵 **Drought (Orange):** Score **10** (Valley / Low Utility).

- **Generation:** The map is procedurally generated using cellular automata and noise functions, ensuring unique Local Maxima (Mountains) and Global Maxima (Villages) on every reset.

### 2. The Agents (Civilizations)
Agents start at random locations (usually Transition areas) and attempt to find the highest score on the map using **Local Search**.

#### A. Hill Climbing (Rational Behavior)
- **Scanning:** The agent scans its 4 immediate neighbors (Up, Down, Left, Right).
- **Decision Logic:**
  - Moves to a neighbor if it has a **higher score** (Climbing).
  - Moves to a neighbor if it has an **equal score** (Wandering on a Plateau/Grassland).
  - Stops if all neighbors have **lower scores** (Stuck at Peak).
- **The Problem:** The agent is "Greedy". Once it reaches a **Mountain (80)**, it refuses to go down to the **Transition (50)** area, even if a **Village (100)** is visible nearby. This demonstrates the **Local Maxima problem**.

#### B. Simulated Annealing (The "Chaos" Factor)
- The user controls a **Temperature (T)** slider in the UI.
- **High T:** Agents behave irrationally. They accept "bad moves" (moving to a lower score) with a probability calculated by the Boltzmann distribution:
  $$P = e^{-\frac{\Delta E}{T}}$$
- **Low T:** As the user lowers the slider, agents "cool down," becoming rational again and strictly climbing the nearest peak.

## 🛠️ Tech Stack
- **Core:** HTML5, CSS3, Vanilla JavaScript (ES6)
- **Rendering:** HTML5 Canvas API (Custom sprite rendering)
- **Algorithms:** Steepest Ascent Hill Climbing (with Sideways Move support), Simulated Annealing
