const modelos = {
    claude: "claude-haiku-5-5",
    openai: "gpt-4.1-mini",
    gemini: "gemini-2.5-flash",
    groq: "llama-3.3-70b-versatile"
};

const campoProvedor = document.getElementById("campo-provedor");
const campoChave = document.getElementById("campo-chave");
const chat = document.getElementById("chat");
const input = document.getElementById("input");
const listaConversas = document.getElementById("lista-conversas");

let conversas = JSON.parse(localStorage.getItem("conversas")) || [];
let conversaAtual = null;

function mostrarMensagem(texto, tipo) {
    const div = document.createElement("div");
    div.className = "msg msg-" + tipo;
    div.textContent = texto;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

function carregarChave() {
    campoChave.value = localStorage.getItem("chave-" + campoProvedor.value) || "";
}

function salvarChave() {
    localStorage.setItem("chave-" + campoProvedor.value, campoChave.value);
    alert("Chave salva!");
}

function mostrarHistorico() {
    listaConversas.innerHTML = "";
    conversas.forEach(function (conversa) {
        const li = document.createElement("li");
        li.textContent = conversa.titulo;
        li.onclick = function () {
            abrirConversa(conversa);
        };
        listaConversas.appendChild(li);
    });
}

function abrirConversa(conversa) {
    conversaAtual = conversa;
    chat.innerHTML = "";
    conversa.mensagens.forEach(function (m) {
        mostrarMensagem(m.content, m.role === "user" ? "usuario" : "ia");
    });
}

function novaConversa() {
    conversaAtual = null;
    chat.innerHTML = "";
}

async function perguntarIA(provedor, chave, mensagens) {
    const modelo = modelos[provedor];

    if (provedor === "claude") {
        const resposta = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-api-key": chave,
                "anthropic-version": "2026-10-21",
                "anthropic-dangerous-direct-browser-access": "true"
            },
            body: JSON.stringify({ model: modelo, max_tokens: 4096, messages: mensagens })
        });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.error.message);
        return dados.content.find(function (bloco) {
            return bloco.type === "text";
        }).text;
    }

    if (provedor === "gemini") {
        const url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelo + ":generateContent";
        const resposta = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": chave },
            body: JSON.stringify({
                contents: mensagens.map(function (m) {
                    return { role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] };
                })
            })
        });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.error.message);
        return dados.candidates[0].content.parts[0].text;
    }

    const url = provedor === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.groq.com/openai/v1/chat/completions";
    const resposta = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "authorization": "Bearer " + chave },
        body: JSON.stringify({ model: modelo, messages: mensagens })
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.error.message);
    return dados.choices[0].message.content;
}

async function enviarMensagem(evento) {
    evento.preventDefault();

    const texto = input.value.trim();
    const chave = campoChave.value.trim();
    if (!texto) return;
    if (!chave) {
        mostrarMensagem("Digite sua chave de API ao lado.", "erro");
        return;
    }

    if (!conversaAtual) {
        conversaAtual = { titulo: texto.slice(0, 30), mensagens: [] };
        conversas.unshift(conversaAtual);
        mostrarHistorico();
    }

    conversaAtual.mensagens.push({ role: "user", content: texto });
    mostrarMensagem(texto, "usuario");
    input.value = "";

    try {
        const respostaIA = await perguntarIA(campoProvedor.value, chave, conversaAtual.mensagens);
        conversaAtual.mensagens.push({ role: "assistant", content: respostaIA });
        mostrarMensagem(respostaIA, "ia");
        localStorage.setItem("conversas", JSON.stringify(conversas));
    } catch (erro) {
        conversaAtual.mensagens.pop();
        mostrarMensagem("Erro: " + erro.message, "erro");
    }
}

campoProvedor.addEventListener("change", carregarChave);
document.getElementById("btn-salvar").addEventListener("click", salvarChave);
document.getElementById("btn-nova").addEventListener("click", novaConversa);
document.getElementById("form").addEventListener("submit", enviarMensagem);

carregarChave();
mostrarHistorico();
