# 🎨 Punit Dethe - Developer E-Portfolio

Welcome to the source code for my interactive e-portfolio! 

This repository houses a custom, fully responsive personal website built to showcase my projects, professional experience, and academic background. Rather than a standard scrolling webpage, this portfolio is designed as an interactive, playful "Desktop UI" experience featuring draggable sticky notes, dynamic window modals, and a retro aesthetic.

🌐 **Live Website:** [https://punitdethe.vercel.app/](https://punitdethe.vercel.app/)

---

## ✨ Key Features
* **Interactive Desktop GUI:** Features a custom left-dock for navigation that opens draggable, closable, and minimizable "windows".
* **Dynamic Feed System:** Projects, experiences, and tools are pulled dynamically using a lightweight `data.json` architecture.
* **Physics & Motion:** Features scattered sticky-notes that initialize in random orientations and collide dynamically using custom JavaScript physics.
* **Responsive Design:** Translates seamlessly from a sprawling desktop canvas to a mobile-friendly bottom-tab experience.
* **Thematic Styling:** Uses brutalist, comic-style CSS borders, halftone patterns, and vibrant flat colors.

## 🛠️ Tech Stack
This project was built from scratch without bulky frameworks to ensure maximum performance and creative control over the DOM.

* **Frontend:** HTML5, Vanilla CSS3 (Custom Properties, Grid/Flexbox), Vanilla JavaScript (ES6+)
* **Data Layer:** Local JSON File Fetching (`data.json`)
* **Deployment & Hosting:** Vercel
* **Version Control:** Git, GitHub

## 🚀 Running Locally
Because the data is fetched dynamically via JavaScript, you must run the project through a local web server to bypass strict browser CORS policies.

1. Clone the repository: `git clone https://github.com/Punit-Dethe/Portfolio-Webiste.git`
2. Open the directory in your terminal.
3. Start a local server:
   - **Python:** `python -m http.server 8000`
   - **Node.js:** `npx serve .`
4. Open `http://localhost:8000/` or the provided local port in your browser.

---
*Developed by Punit Dethe* 👨‍💻
