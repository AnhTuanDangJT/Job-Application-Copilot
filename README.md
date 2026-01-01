Job Application Copilot

Job Application Copilot is a modern, AI-powered platform designed to help job seekers manage applications, discover opportunities, and grow with mentor support — all in one place.

Built with a clean architecture and production-ready stack, the platform focuses on clarity, performance, and real-world usability.

✨ What Problem It Solves

Job searching today is fragmented:

Applications are scattered

Guidance is generic

Progress is hard to track

Job Application Copilot brings everything together:

Centralized application tracking

AI-assisted job exploration

Mentor–mentee collaboration

Clean, intuitive UX

🔑 Core Features

AI Job Search Assistant
Discover and explore jobs using intelligent suggestions.

Application Tracking Dashboard
Keep track of applications, status, and progress over time.

Mentor & Mentee System
Connect mentors and mentees for guided career development.

AI Copilot Chat
Get instant help with job search strategy, resumes, and interviews.

Animated, Premium Landing Page
Modern brown-themed UI with smooth text and scroll animations.

🧱 Architecture Overview
Frontend (Next.js)  →  Vercel
Backend (Spring Boot API)  →  Railway
Database  →  MongoDB Atlas
Caching / Queues  →  Redis
Email  →  SendGrid
External APIs  →  Adzuna, JSearch, GitHub


Clean separation between frontend and backend ensures scalability and maintainability.

🛠 Tech Stack

Frontend

Next.js

TypeScript

Tailwind CSS

Framer Motion

Backend

Java

Spring Boot

JWT Authentication

Infrastructure

MongoDB

Redis

Vercel

Railway

🚀 Running Locally
Frontend
git clone https://github.com/AnhTuanDangJT/Job-Application-Copilot.git
cd Job-Application-Copilot
npm install
npm run dev

Backend
cd backend
./mvnw spring-boot:run


Configure environment variables for both services before running.

🌍 Production Deployment

Frontend:
https://job-application-copilot-two.vercel.app

Backend API:
https://job-application-copilot-production.up.railway.app

Deployments are automated via GitHub → Vercel / Railway pipelines.

🎯 Design Philosophy

Minimal but expressive UI

Smooth animations without hurting performance

Mobile-first responsiveness

Clear separation of concerns

Production-first mindset

📌 Roadmap (Planned)

Advanced AI job matching

Resume parsing & scoring

Interview preparation modules

Analytics & progress insights

Custom domain & branding

🤝 Contributing

Contributions are welcome:

Fork the repository

Create a feature branch

Submit a pull request

Ideas, improvements, and feedback are always appreciated.
