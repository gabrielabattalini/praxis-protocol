import fs from 'node:fs';
import path from 'node:path';

const projectId = process.env.STITCH_PROJECT_ID;
const apiKey = process.env.STITCH_API_KEY;

if (!projectId || !apiKey) {
  console.error("STITCH_PROJECT_ID and STITCH_API_KEY env vars are required.");
  process.exit(1);
}

async function downloadProject() {
  console.log("Baixando informações do projeto diretamente da API do Stitch...");

  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "get_project",
      arguments: {
        name: `projects/${projectId}`
      }
    }
  };

  try {
    const response = await fetch("https://stitch.googleapis.com/mcp", {
      method: "POST",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const json = await response.json();
    if (json.error || json.result?.isError) {
      console.error("Erro da API:", json.error || json.result?.content);
      return;
    }

    const projectDataRaw = json.result.content[0].text;
    const projectData = JSON.parse(projectDataRaw);
    
    console.log("Telas encontradas no projeto:", projectData.screens ? projectData.screens.length : 0);

    const designsPath = path.join(__dirname, '..', '.stitch', 'designs');
    if (!fs.existsSync(designsPath)) {
      fs.mkdirSync(designsPath, { recursive: true });
    }

    fs.writeFileSync(path.join(designsPath, 'metadata.json'), JSON.stringify(projectData, null, 2));
    if (!projectData.screens) return;

    let index = 1;
    for (const screen of projectData.screens) {
      console.log(`[${index}/${projectData.screens.length}] Salvando Tela: ${screen.name || screen.id}`);
      
      const htmlUrl = screen.htmlCode?.downloadUrl;
      const imageUrl = screen.screenshot?.downloadUrl;
      const screenName = `Screen_${index}`;
      
      if (htmlUrl) {
        const htmlRes = await fetch(htmlUrl);
        fs.writeFileSync(path.join(designsPath, `${screenName}.html`), await htmlRes.text());
      }
      
      if (imageUrl) {
        const resUrl = imageUrl.includes('=') ? imageUrl : `${imageUrl}=w1200`;
        const imgRes = await fetch(resUrl);
        fs.writeFileSync(path.join(designsPath, `${screenName}.png`), Buffer.from(await imgRes.arrayBuffer()));
      }

      index++;
    }

    console.log("✅ DOWNLOAD DOS ARQUIVOS CONCLUÍDO!");

  } catch (error) {
    console.error("❌ Falha na comunicação:", error.message);
  }
}

downloadProject();
