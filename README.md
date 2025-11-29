# Terraform God: Local Search Visualization 🌍

## 👥 Development Team

| Role | Name |
| :--- | :--- |
| **Data & Environment Architect** | Bilge Küçükçakmak |
| **UI/Visualization Specialist** | Nisanur Konur |
| **Core AI Logic Implementer** | İlayda Gündüz |
| **Advanced AI & Integration Engineer** | Alin Kısakürek |

## 📖 Project Overview
"Terraform God" is an interactive web-based simulation designed to demonstrate the limitations of **Hill Climbing** algorithms (getting stuck in Local Maxima) and how **Simulated Annealing** solves this problem using a stochastic approach.

Unlike standard pathfinding demos, this project treats the AI algorithm as a **physics rule**. The user plays as a "Deity" controlling the global temperature (chaos factor) via a slider, directly influencing whether civilization agents behave rationally (climbing up) or erratically (exploring/rolling down).

## 🎮 Mechanics & Algorithms

### 1. The Terrain (Search Space)
- A **2D Grid Heatmap** rendered on HTML5 Canvas representing a 3D terrain.
- **Color Intensity:** Represents the "Height" or "Score" of the terrain.
  - 🟦 **Dark / Blue:** Low utility (Valleys).
  - ⬜ **Bright / White:** High utility (Peaks/Global Maximum).
- The map is procedurally generated with random noise, ensuring a unique landscape with multiple local maxima on every reset.

### 2. The Agents (Civilizations)
Agents start at random locations and attempt to find the brightest (highest) point on the map using **Local Search**.

#### A. Hill Climbing (Rational Behavior)
- By default, agents scan their immediate neighbors (Up, Down, Left, Right).
- They move to a neighbor **only if** it is higher (brighter) than their current position.
- **The Problem:** They quickly get stuck on small, local bright spots (Local Maxima) and fail to reach the main white peak.

#### B. Simulated Annealing (The "Chaos" Factor)
- The user controls a **Temperature (T)** slider in the UI.
- **High T:** Agents behave irrationally. They accept "bad moves" (moving to a darker/lower pixel) with a probability calculated by the Boltzmann distribution:
  $$P = e^{-\frac{\Delta E}{T}}$$
- **Low T:** As the user lowers the slider, agents "cool down," becoming rational again and strictly climbing the nearest peak.

## 🛠️ Tech Stack
- **Core:** HTML5, CSS3, Vanilla JavaScript (ES6)
- **Rendering:** HTML5 Canvas API (No external game engines used)
- **Algorithms:** Steepest Ascent Hill Climbing, Simulated Annealing

