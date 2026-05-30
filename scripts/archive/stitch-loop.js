import fs from 'node:fs';
import path from 'node:path';

const projectId = process.env.STITCH_PROJECT_ID;
const apiKey = process.env.STITCH_API_KEY;

if (!projectId || !apiKey) {
  console.error("STITCH_PROJECT_ID and STITCH_API_KEY env vars are required.");
  process.exit(1);
}

const pages = [
  { route: '/', name: 'Landing Page', context: 'System entry point, terminal text: SEU SISTEMA DE EVOLUÇÃO AGORA PARECE UM TERMINAL DE COMANDO.' },
  { route: '/auth', name: 'Authentication Session', context: 'Login and signup page for the Praxis Protocol.' },
  { route: '/dashboard', name: 'Dashboard', context: 'Tactical User Dashboard showing Level, Rank, XP Bar, Execution Rate pie chart, Telemetry, and Active Modules metrics.' },
  { route: '/tasks', name: 'Tasks/Missions', context: 'List of daily missions and tasks with completion status, filterable by module.' },
  { route: '/arena', name: 'Arena / Combat', context: 'Duel view comparing Player vs Opponent, command history log, and tactical stats.' },
  { route: '/ranking', name: 'Ranking Leaderboard', context: 'Leaderboard showing top 3 players on a podium and a dense data table below.' },
  { route: '/profile', name: 'Operator Profile', context: 'User profile showing Bio, skill radar chart (Energy, Focus, Discipline, Production, Motivation), and recent timeline.' },
  { route: '/achievements', name: 'Achievements Gallery', context: 'Masonry grid of unlocked achievements categorized by rarity.' },
  { route: '/friends', name: 'Comrades / Friends', context: 'Social sidebar with active online friends and a feed of their latest activities.' },
  { route: '/study-ai', name: 'Study AI Assistant', context: 'Chat interface to interact with the system AI, with a sidebar for extracted notes.' },
  { route: '/modules', name: 'System Modules', context: 'Grid of available system modules (Nutrition, Workspace, Fitness, etc.) with progress indicators.' },
  { route: '/settings', name: 'System Configuration', context: 'Settings page with 2-column layout for Account, Interface, and Notification preferences.' }
];

async function generateScreen(page, index, total) {
  const prompt = `Reformulate the UI for the Praxis Protocol ${page.name}. DO NOT alter the core content/text and DO NOT change the color palette (Zinc, Amber, Black). Improve ONLY the structure, grid, and layout to make it look like a highly professional, high-performance Tactical Terminal. Context: ${page.context}`;
  
  const body = {
    jsonrpc: "2.0",
    id: index, // ID único sequencial
    method: "tools/call",
    params: {
      name: "generate_screen_from_text",
      arguments: {
        projectId: projectId,
        prompt: prompt,
        deviceType: "DESKTOP"
      }
    }
  };

  console.log(`[Stitch] [${index}/${total}] 🛠 Requisitando a geração da página: ${page.name}... (Isto pode levar ~1 minuto pelo modelo de IA)`);
  
  try {
    const startTime = Date.now();
    const response = await fetch("https://stitch.googleapis.com/mcp", {
      method: 'POST',
      headers: {
        "X-Goog-Api-Key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    
    // Ler texto puro para debugar se não for JSON válido
    await response.text();
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`[Stitch] ✅ Finalizado em ${elapsedTime}s para ${page.name}! Resposta do server registrada.`);
  } catch (err) {
    console.error(`[Stitch] ❌ Erro na requisição para ${page.name}:`, err.message);
  }
}

async function runAll() {
  console.log("Starting Loop for all pages (SEQUENTIAL MODE)...");
  
  // O PROBLEMA ANTERIOR: 
  // Fazer Promise.all() em 12 requisições pesadas de IA travou tudo, 
  // ou fez o script demorar tanto sem output no terminal que parecia quebrado ("hanging").
  // Agora rodamos uma-a-uma em sequência:
  let count = 1;
  const total = pages.length;
  for (const page of pages) {
    await generateScreen(page, count, total);
    count++;
  }
  
  console.log("All requests have been dispatched and completed! Check the Stitch platform.");
}

runAll();
