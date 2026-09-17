/**
 * MINHA COLINHA 2026 — Lógica de Seleção, Persistência, Canvas e Compartilhamento
 */
(() => {
  "use strict";

  // Ordem oficial da Urna Eletrônica Brasileira com identificação de voto
  const CARGOS_CONFIG = [
    { id: "depFed", cargo: "Deputado Federal", ordemVoto: "1º VOTO", titulo: "1º VOTO - DEPUTADO FEDERAL", digitos: 4 },
    { id: "depEst", cargo: "Deputado Estadual", ordemVoto: "2º VOTO", titulo: "2º VOTO - DEPUTADO ESTADUAL", digitos: 5 },
    { id: "sen1", cargo: "Senador", ordemVoto: "3º VOTO", titulo: "3º VOTO - SENADOR (1ª VAGA)", digitos: 3 },
    { id: "sen2", cargo: "Senador", ordemVoto: "4º VOTO", titulo: "4º VOTO - SENADOR (2ª VAGA)", digitos: 3 },
    { id: "gov", cargo: "Governador", ordemVoto: "5º VOTO", titulo: "5º VOTO - GOVERNADOR", digitos: 2 },
    { id: "pres", cargo: "Presidente", ordemVoto: "6º VOTO", titulo: "6º VOTO - PRESIDENTE", digitos: 2 }
  ];

  // Candidato Oficial Pré-definido: Marquinhos Trad 4333 - Deputado Federal
  const CANDIDATO_MARQUINHOS_4333 = {
    sq: "120002537466",
    nr: "4333",
    urna: "Marquinhos Trad",
    cargo: "Deputado Federal",
    partido_sigla: "PV",
    foto_url: "marquinhos_foto_hd.jpg",
    situacao: "Deferido",
    situacao_julgamento: "Deferido"
  };

  let CANDIDATOS = [];
  let colinhaState = carregarColinha();
  let slotAtivo = null;

  // ---------- Utilitários ----------
  function normalizar(txt) {
    if (!txt) return "";
    return String(txt)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function debounce(fn, ms = 120) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function showToast(msg, duracao = 2500) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => {
      el.style.display = "none";
    }, duracao);
  }

  // ---------- Persistência Local (Offline / LGPD) ----------
  function carregarColinha() {
    let base = {
      depFed: CANDIDATO_MARQUINHOS_4333,
      depEst: null,
      sen1: null,
      sen2: null,
      gov: null,
      pres: null
    };
    // Reinicia sempre na tela de orientação a cada novo acesso
    try {
      localStorage.removeItem("santinho_marquinhos_boas_vindas_vista");
    } catch (e) {}
    return base;
  }

  function salvarColinha(dispararImpressaoSeCompleto = false) {
    try {
      colinhaState.depFed = CANDIDATO_MARQUINHOS_4333; // Garante permanência do 1º voto
      localStorage.setItem("santinho_marquinhos_4333_v1", JSON.stringify(colinhaState));
    } catch (e) {}
    renderSlots();
    atualizarProgresso(dispararImpressaoSeCompleto);
  }

  // ---------- Carregamento do Dataset Enxuto ----------
  async function initDados() {
    try {
      const res = await fetch("data/candidatos.json");
      const payload = await res.json();
      
      if (payload && payload.__shielded && payload.keys && Array.isArray(payload.data)) {
        CANDIDATOS = payload.data.map(row => {
          let obj = {};
          for (let i = 0; i < payload.keys.length; i++) {
            obj[payload.keys[i]] = row[i];
          }
          return obj;
        });
      } else {
        CANDIDATOS = payload;
      }
    } catch (err) {
      console.warn("Falha ao carregar base de candidatos:", err);
    }

    renderSlots();
    atualizarProgresso();
  }

  // ---------- Renderização da Tela Principal (6 Tickets) ----------
  // Inicia diretamente a partir do 2º voto (Deputado Estadual)
  let etapaAtual = 1; // Índice 1 = depEst (o 1º voto depFed já está preenchido e fixado)

  // ---------- Cédula Física de Bolso Realista (Espelho do Modelo Oficial) ----------
  function gerarCardBolsoHtml() {
    const ROW_COLORS = [
      { bg: "#15803d", text: "#ffffff" },
      { bg: "#0284c7", text: "#ffffff" },
      { bg: "#eab308", text: "#ffffff" },
      { bg: "#15803d", text: "#ffffff" },
      { bg: "#0284c7", text: "#ffffff" },
      { bg: "#eab308", text: "#ffffff" }
    ];

    const rowsHtml = CARGOS_CONFIG.map((cfg, i) => {
      const cand = colinhaState[cfg.id];
      const digitsArr = cand && cand.nr ? String(cand.nr).split("") : [];
      const rowColor = ROW_COLORS[i];

      let cargoTitle = cfg.cargo.toUpperCase();
      if (cfg.id === "sen1") cargoTitle = "SENADOR (1ª VAGA)";
      else if (cfg.id === "sen2") cargoTitle = "SENADOR (2ª VAGA)";

      let candNome = cand && cand.urna ? cand.urna.toUpperCase() : (cand && cand.nome ? cand.nome.toUpperCase() : "");

      let boxesHtml = "";
      for (let d = 0; d < cfg.digitos; d++) {
        const val = digitsArr[d] !== undefined ? digitsArr[d] : "";
        boxesHtml += `<span class="colinha-mockup-digit-box ${val ? 'has-digit' : ''}">${val}</span>`;
      }

      return `
        <div class="colinha-mockup-row">
          <div class="colinha-mockup-badge" style="background:${rowColor.bg};color:${rowColor.text};">${i + 1}</div>
          <div class="colinha-mockup-info">
            <div class="colinha-mockup-cand-name ${candNome ? 'filled' : 'empty'}">${candNome || 'A DEFINIR'}</div>
            <div class="colinha-mockup-cargo">${cargoTitle}</div>
          </div>
          <div class="colinha-mockup-boxes">${boxesHtml}</div>
        </div>
      `;
    }).join("");

    const rawNome = (localStorage.getItem("santinho_eleitor_nome") || "").trim();
    const eleitorNome = rawNome ? rawNome.split(" ")[0].toUpperCase() : "";

    const tituloLinha1 = eleitorNome ? `${eleitorNome} VOTA ASSIM` : "VEM COM A GENTE";
    const tituloLinha2 = eleitorNome ? "VEM COM A GENTE!" : "ELEIÇÕES 2026";

    return `
      <div class="colinha-mockup-card-container">
        <div class="colinha-mockup-left">
          <div class="colinha-mockup-photo-wrap">
            <picture>
              <source srcset="marquinhos_colinha_foto.webp" type="image/webp">
              <img src="marquinhos_colinha_foto.jpg" alt="Marquinhos Trad Deputado Federal" class="colinha-mockup-photo">
            </picture>
          </div>
          <div class="colinha-mockup-logo-wrap">
            <img src="marquinhos_logo_oficial.png" alt="Marquinhos Trad Deputado Federal" class="colinha-mockup-logo">
          </div>
        </div>

        <div class="colinha-mockup-right">
          <div class="colinha-mockup-header">
            <div class="colinha-mockup-slogan-topo">${tituloLinha1}</div>
            <div class="colinha-mockup-slogan-main">${tituloLinha2}</div>
          </div>

          <div class="colinha-mockup-rows-list">
            ${rowsHtml}
          </div>

          <div class="colinha-mockup-footer">
            <span class="footer-txt-left">ELEIÇÕES 2026</span>
            <div class="footer-stripes">
              <span class="stripe-green"></span>
              <span class="stripe-yellow"></span>
              <span class="stripe-blue"></span>
            </div>
            <span class="footer-txt-right">DEMOCRACIA SEMPRE</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderizarColinhaFinalPreview() {
    const previewEl = document.getElementById("colinha-final-preview");
    if (previewEl) {
      previewEl.innerHTML = gerarCardBolsoHtml();
    }
  }

  // ---------- Animação Especial: Colinha Saindo da Urna (Modelo Final Oficial Idêntico) ----------
  function dispararAnimacaoImpressaoUrna() {
    const overlay = document.getElementById("print-modal-overlay");
    const paperRoll = document.getElementById("paper-slip-roll");
    const statusText = document.getElementById("print-status-text");
    const conclusaoSection = document.getElementById("conclusao-section");
    const funilViewport = document.getElementById("funil-viewport");

    if (!overlay || !paperRoll) return;

    // Injeta O MESMO modelo exato da colinha final (com o boneco, caixas gigantes e nomes destacados)
    paperRoll.innerHTML = gerarCardBolsoHtml();

    // Reinicia animação de saída contínua do santinho oficial para fora da urna
    paperRoll.style.animation = "none";
    void paperRoll.offsetWidth;
    paperRoll.style.animation = "rollOutPaper 3.8s cubic-bezier(0.16, 1, 0.3, 1) forwards";

    if (statusText) {
      statusText.innerHTML = `<span class="print-spinner"></span> Urna emitindo sua colinha oficial...`;
    }

    overlay.style.display = "flex";

    setTimeout(() => {
      if (statusText) {
        statusText.innerHTML = `✅ Santinho impresso com sucesso!`;
      }
    }, 3800);

    setTimeout(() => {
      overlay.style.display = "none";
      if (funilViewport) funilViewport.style.display = "none";
      if (conclusaoSection) {
        renderizarColinhaFinalPreview();
        conclusaoSection.style.display = "block";
        conclusaoSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      showToast("🎉 Santinho oficial 100% pronto!");
    }, 5200);
  }

  // ---------- Vitrine 3D & Stepper: Atualização de Progresso ----------
  function atualizarProgresso(dispararImpressaoSeCompleto = false) {
    const preenchidos = Object.values(colinhaState).filter(Boolean).length;
    const conclusaoSection = document.getElementById("conclusao-section");
    const vitrineContainer = document.querySelector(".container-vitrine");
    const appHeader = document.querySelector(".app-header");
    const welcomeSection = document.getElementById("welcome-section");
    const boasVindasVista = localStorage.getItem("santinho_marquinhos_boas_vindas_vista") === "true";

    renderizarStepperFunil();
    renderizarVitrineNicho();

    if (conclusaoSection) {
      if (preenchidos === 6) {
        if (welcomeSection) welcomeSection.style.display = "none";
        renderizarColinhaFinalPreview();
        fecharSelecaoCandidato();
        // Oculta a vitrine de cédulas
        if (vitrineContainer) {
          const nicho = vitrineContainer.querySelector(".nicho-vitrine-frame");
          if (nicho) nicho.style.display = "none";
        }
        // Oculta o header da página na conclusão para evitar redundância visual da logo
        if (appHeader) {
          appHeader.style.display = "none";
        }

        if (dispararImpressaoSeCompleto) {
          dispararAnimacaoImpressaoUrna();
        } else {
          conclusaoSection.style.display = "block";
        }
      } else {
        conclusaoSection.style.display = "none";
        if (appHeader) {
          appHeader.style.display = "block";
        }

        if (!boasVindasVista && preenchidos <= 1) {
          if (welcomeSection) welcomeSection.style.display = "block";
          if (vitrineContainer) {
            const nicho = vitrineContainer.querySelector(".nicho-vitrine-frame");
            if (nicho) nicho.style.display = "none";
          }
          if (appHeader) {
            appHeader.style.display = "none"; // Evita redundância de logo no topo durante o onboarding
          }
        } else {
          if (welcomeSection) welcomeSection.style.display = "none";
          if (vitrineContainer) {
            vitrineContainer.style.display = "flex";
            const nicho = vitrineContainer.querySelector(".nicho-vitrine-frame");
            if (nicho) nicho.style.display = "block";
          }
          if (appHeader) {
            appHeader.style.display = "block";
            const stepper = appHeader.querySelector(".stepper-funil");
            if (stepper) stepper.style.display = "flex";
          }
        }
      }
    }
  }

  function renderizarStepperFunil() {
    const stepper = document.getElementById("stepper-funil");
    if (!stepper) return;

    stepper.innerHTML = CARGOS_CONFIG.map((cfg, idx) => {
      const preenchido = !!colinhaState[cfg.id];
      const ativo = idx === etapaAtual;
      const isLast = idx === CARGOS_CONFIG.length - 1;
      const isFixado = idx === 0; // 1º Voto (Deputado Federal) é fixado

      return `
        <div class="step-node-item">
          <div class="step-circle ${ativo ? 'ativo' : ''} ${preenchido ? 'concluido' : ''} ${isFixado ? 'fixado-bloqueado' : ''}" 
               data-step="${idx}" 
               title="${isFixado ? '1º VOTO: Marquinhos Trad 4333 (Oficial)' : `${cfg.ordemVoto}: ${cfg.cargo}`}" 
               aria-label="${isFixado ? 'Marquinhos Trad 4333 (Fixado)' : `Ir para ${cfg.cargo}`}">
            ${isFixado ? '⭐' : (preenchido ? '✓' : (idx + 1))}
          </div>
          ${!isLast ? `<div class="step-connector-line ${preenchido ? 'preenchida' : ''}"></div>` : ''}
        </div>
      `;
    }).join("");

    // Cliques nas bolinhas: permite navegar livremente entre os votos parametrizáveis (1 a 5)
    // Se clicar no 1º voto (índice 0), exibe toast informando que já está definido e vai para o índice 1
    stepper.querySelectorAll(".step-circle").forEach(circle => {
      circle.addEventListener("click", () => {
        const step = parseInt(circle.dataset.step, 10);
        if (step === 0) {
          showToast("⭐ 1º Voto: Marquinhos Trad 4333 já está definido!");
          etapaAtual = 0;
        } else {
          etapaAtual = step;
        }
        renderizarStepperFunil();
        renderizarVitrineNicho();
      });
    });
  }

  // ---------- 1. Renderização da Vitrine 3D de Papel Real (3 Cédulas em Leque) ----------
  function gerarCardHtml(cfg, cand, posicaoClass) {
    if (!cfg) return "";

    const isDepFed = cfg.id === "depFed";
    const isPreenchido = !!cand;
    const fotoSrc = isDepFed 
      ? "marquinhos_foto_hd.jpg" 
      : (cand ? (cand.foto_url || (cand.sq ? `fotos_tse/${cand.sq}.webp` : "")) : "");
    const titulo = cfg.cargo.toUpperCase();

    if (isDepFed) {
      // Cédula Oficial Fixa do Marquinhos Trad 4333 (Não editável pelo eleitor)
      return `
        <div class="cedula-cargo-titulo">${titulo} · OFICIAL</div>
        <div class="cedula-area-clicavel preenchido cedula-fixada-marquinhos" data-acao-fixado="true" role="region" title="1º Voto Oficial: Marquinhos Trad 4333">
          <div class="cedula-info-bloco">
            <span class="cedula-sublabel" style="color:#15803d;font-weight:900;">★ 1º VOTO CONFIRMADO:</span>
            <div class="cedula-cand-nome">${cand.urna}</div>
            <span class="cedula-cand-partido">• ${cand.partido_sigla} · VEM COM A GENTE</span>
          </div>

          <div class="cedula-corpo-voto">
            <div class="cedula-foto-frame cedula-foto-frame-marquinhos">
              <img src="${fotoSrc}" alt="${cand.urna}" style="width:100%;height:100%;object-fit:cover;">
            </div>
            <div class="cedula-numero-bloco">
              <span class="cedula-numero-label">Número Oficial:</span>
              <div class="cedula-numero-grande" style="color:#fef08a;background:#0f3d21;padding:2px 8px;border-radius:6px;">${cand.nr}</div>
              <span class="cedula-status-fixo">✓ Voto Pré-Definido</span>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="cedula-cargo-titulo">${titulo}</div>
      <div class="cedula-area-clicavel ${isPreenchido ? 'preenchido' : 'vazio'}" data-acao-selecionar="${cfg.id}" role="button" tabindex="0" title="${isPreenchido ? 'Toque para alterar' : 'Toque para escolher'}">
        <div class="cedula-info-bloco">
          <span class="cedula-sublabel">${isPreenchido ? 'Candidato:' : 'Candidato ainda não definido'}</span>
          <div class="cedula-cand-nome">${isPreenchido ? cand.urna : `+ Escolher ${cfg.cargo}`}</div>
          ${isPreenchido && cand.partido_sigla ? `<span class="cedula-cand-partido">• ${cand.partido_sigla}</span>` : ''}
        </div>

        <div class="cedula-corpo-voto">
          <div class="cedula-foto-frame">
            ${fotoSrc ? `<img src="${fotoSrc}" alt="${cand.urna}" onerror="this.style.display='none'">` : '<div class="cand-compact-photo-placeholder" style="width:100%;height:100%;font-size:26px;">👤</div>'}
          </div>
          <div class="cedula-numero-bloco">
            <span class="cedula-numero-label">Número:</span>
            <div class="cedula-numero-grande">${isPreenchido ? cand.nr : "----"}</div>
            <span class="cedula-toque-alterar">${isPreenchido ? 'Toque p/ trocar ↻' : 'Toque p/ preencher'}</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderizarVitrineNicho() {
    const elLeft = document.getElementById("cedula-left");
    const elCenter = document.getElementById("cedula-center");
    const elRight = document.getElementById("cedula-right");
    const btnPrev = document.getElementById("btn-vitrine-prev");
    const btnNext = document.getElementById("btn-vitrine-next");

    if (!elCenter) return;

    // Cargo Atual (Centro)
    const cfgCenter = CARGOS_CONFIG[etapaAtual];
    const candCenter = colinhaState[cfgCenter.id];
    elCenter.innerHTML = gerarCardHtml(cfgCenter, candCenter, "cedula-central");
    elCenter.classList.remove("cedula-animar-troca");
    void elCenter.offsetWidth;
    elCenter.classList.add("cedula-animar-troca");

    // Cargo Anterior (Esquerda)
    if (etapaAtual > 0) {
      const cfgLeft = CARGOS_CONFIG[etapaAtual - 1];
      const candLeft = colinhaState[cfgLeft.id];
      elLeft.style.display = "flex";
      elLeft.innerHTML = gerarCardHtml(cfgLeft, candLeft, "cedula-esquerda");
      elLeft.onclick = () => {
        etapaAtual--;
        atualizarProgresso();
      };
    } else {
      elLeft.style.display = "none";
    }

    // Cargo Próximo (Direita)
    if (etapaAtual < CARGOS_CONFIG.length - 1) {
      const cfgRight = CARGOS_CONFIG[etapaAtual + 1];
      const candRight = colinhaState[cfgRight.id];
      elRight.style.display = "flex";
      elRight.innerHTML = gerarCardHtml(cfgRight, candRight, "cedula-direita");
      elRight.onclick = () => {
        etapaAtual++;
        atualizarProgresso();
      };
    } else {
      elRight.style.display = "none";
    }

    if (btnPrev) btnPrev.disabled = etapaAtual === 0;
    // Clique em qualquer ponto da cédula central para abrir a lista instantânea
    const areaClicavel = elCenter.querySelector("[data-acao-selecionar]");
    if (areaClicavel) {
      areaClicavel.addEventListener("click", () => {
        abrirSelecaoCandidato(cfgCenter.id);
      });
      areaClicavel.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          abrirSelecaoCandidato(cfgCenter.id);
        }
      });
    }
  }

  function renderSlots() {
    renderizarStepperFunil();
    renderizarVitrineNicho();
  }

  function avancarParaProximoCargo() {
    let proxima = -1;
    for (let i = etapaAtual + 1; i < CARGOS_CONFIG.length; i++) {
      if (!colinhaState[CARGOS_CONFIG[i].id]) {
        proxima = i;
        break;
      }
    }

    if (proxima === -1) {
      for (let i = 0; i < CARGOS_CONFIG.length; i++) {
        if (!colinhaState[CARGOS_CONFIG[i].id]) {
          proxima = i;
          break;
        }
      }
    }

    if (proxima !== -1) {
      etapaAtual = proxima;
      atualizarProgresso();
    } else {
      atualizarProgresso(true);
    }
  }

  // ==========================================================================
  // 2. MODAL DE SELEÇÃO ISOLADA DE CANDIDATOS (Mobile Full-Screen & Desktop)
  // ==========================================================================
  function abrirSelecaoCandidato(cargoId) {
    const cargoAlvo = cargoId || CARGOS_CONFIG[etapaAtual].id;
    // O 1º voto (Deputado Federal) é fixo e exclusivo de Marquinhos Trad 4333
    if (cargoAlvo === "depFed") {
      showToast("⭐ 1º Voto oficial: Marquinhos Trad 4333 já está definido!");
      etapaAtual = 1; // Leva para o 2º voto
      atualizarProgresso();
      return;
    }

    const modal = document.getElementById("modal-selecao");
    const tituloEl = document.getElementById("modal-selecao-titulo");
    const inputBusca = document.getElementById("modal-input-busca");
    const btnClear = document.getElementById("btn-clear-modal-search");

    if (!modal) return;

    slotAtivo = cargoAlvo;
    const cfg = CARGOS_CONFIG.find(c => c.id === slotAtivo) || CARGOS_CONFIG[etapaAtual];

    if (tituloEl) {
      tituloEl.textContent = `ESCOLHER ${cfg.cargo.toUpperCase()}`;
    }

    if (inputBusca) {
      inputBusca.value = "";
      inputBusca.placeholder = `Buscar por nome ou número (${cfg.cargo})...`;
    }
    if (btnClear) btnClear.style.display = "none";

    document.body.classList.add("modal-selecao-aberto");
    modal.style.display = "flex";

    letraAtivaFiltro = ""; // Reinicia o filtro por letra
    renderListaCandidatosModal("");

    // Foco acessível no input
    setTimeout(() => {
      if (inputBusca) {
        inputBusca.focus();
      }
    }, 60);
  }

  function fecharSelecaoCandidato() {
    const modal = document.getElementById("modal-selecao");
    if (!modal) return;

    modal.style.display = "none";
    document.body.classList.remove("modal-selecao-aberto");
  }

  let letraAtivaFiltro = ""; // Letra selecionada no índice alfabético (vazio = todos)

  function renderizarBarraAlfabeto(candsDoCargo) {
    const barEl = document.getElementById("modal-alfabeto-bar");
    if (!barEl) return;

    // Se tiver poucos candidatos (ex: Presidente/Governador com < 12 candidatos), oculta para não poluir
    if (candsDoCargo.length < 12) {
      barEl.style.display = "none";
      barEl.innerHTML = "";
      return;
    }

    // Coleta apenas as primeiras letras reais dos candidatos
    const letrasMap = new Set();
    candsDoCargo.forEach(c => {
      const inicial = (c.urna || "").trim().charAt(0).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (inicial && /[A-Z]/.test(inicial)) {
        letrasMap.add(inicial);
      }
    });

    const letrasOrdenadas = Array.from(letrasMap).sort();

    let botoesHtml = `
      <button class="btn-alfabeto-pille ${!letraAtivaFiltro ? 'ativo' : ''}" data-letra="" title="Ver todos os candidatos">
        TODOS
      </button>
    `;

    letrasOrdenadas.forEach(letra => {
      const isAtiva = letraAtivaFiltro === letra;
      botoesHtml += `
        <button class="btn-alfabeto-pille ${isAtiva ? 'ativo' : ''}" data-letra="${letra}">
          ${letra}
        </button>
      `;
    });

    barEl.innerHTML = botoesHtml;
    barEl.style.display = "flex";

    // Eventos de clique nas letras
    barEl.querySelectorAll(".btn-alfabeto-pille").forEach(btn => {
      btn.addEventListener("click", () => {
        letraAtivaFiltro = btn.dataset.letra || "";
        const inputBusca = document.getElementById("modal-input-busca");
        const buscaTermo = inputBusca ? inputBusca.value.trim() : "";
        renderListaCandidatosModal(buscaTermo);
      });
    });
  }

  // 5. RESULTADOS: LISTA COMPACTA E DENSA
  // Hierarquia visual obrigatória: 1. NOME, 2. NÚMERO, 3. PARTIDO/SIGLA, 4. FOTO PEQUENA (42x42px)
  function renderListaCandidatosModal(filtro = "") {
    const listaEl = document.getElementById("modal-candidatos-lista");
    if (!listaEl) return;

    const cfg = CARGOS_CONFIG.find(c => c.id === slotAtivo) || CARGOS_CONFIG[etapaAtual];
    if (!cfg) return;

    const q = normalizar(filtro);
    let cands = CANDIDATOS.filter(c => c.cargo === cfg.cargo);

    // Evitar duplicar senador na vaga 1 e vaga 2
    if (cfg.id === "sen1" && colinhaState.sen2) {
      cands = cands.filter(c => c.nr !== colinhaState.sen2.nr);
    } else if (cfg.id === "sen2" && colinhaState.sen1) {
      cands = cands.filter(c => c.nr !== colinhaState.sen1.nr);
    }

    // Ordenação alfabética por nome de urna para facilitar navegação A-Z
    cands.sort((a, b) => (a.urna || "").localeCompare(b.urna || ""));

    // Renderiza a barra de letras com base nos candidatos do cargo
    renderizarBarraAlfabeto(cands);

    // Filtra pela letra selecionada na régua A-Z se houver
    if (letraAtivaFiltro) {
      cands = cands.filter(c => {
        const inicial = (c.urna || "").trim().charAt(0).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return inicial === letraAtivaFiltro;
      });
    }

    // Filtra pelo termo de busca (nome, partido ou número digitado) com acentos e normalização
    if (q) {
      cands = cands.filter(c => 
        normalizar(c.urna).includes(q) || 
        normalizar(c.partido_sigla).includes(q) || 
        String(c.nr).includes(q)
      );
    }

    if (!cands.length) {
      listaEl.innerHTML = `
        <div class="modal-busca-estado-vazio">
          <div style="font-size:32px;">🔍</div>
          <div style="font-size:15px;color:#19261f;font-weight:700;">Nenhum candidato encontrado</div>
          <div style="font-size:13px;">Tente buscar por outro nome ou número de <strong>${cfg.cargo}</strong>.</div>
        </div>
      `;
      return;
    }

    // Renderiza lista vertical densa (exibe várias opções na viewport)
    listaEl.innerHTML = cands.map(c => {
      const fotoSrc = c.foto_url || (c.sq ? `fotos_tse/${c.sq}.webp` : "");
      const sigla = c.partido_sigla || "";
      const isSelected = colinhaState[cfg.id] && String(colinhaState[cfg.id].sq) === String(c.sq);

      return `
        <div class="cand-compact-row ${isSelected ? 'cand-compact-selected' : ''}" 
             data-sq="${c.sq}" 
             role="option" 
             aria-selected="${isSelected ? 'true' : 'false'}"
             tabindex="0"
             title="Selecionar ${c.urna} (${c.nr})">
          ${fotoSrc ? `
            <img src="${fotoSrc}" class="cand-compact-photo" alt="${c.urna}" loading="lazy" onerror="this.outerHTML='<div class=\\'cand-compact-photo-placeholder\\'>👤</div>'">
          ` : `
            <div class="cand-compact-photo-placeholder">👤</div>
          `}
          <div class="cand-compact-info">
            <div class="cand-compact-nome">
              <span>${c.urna}</span>
              ${isSelected ? `<span class="cand-compact-selected-badge">✓ SELECIONADO</span>` : ''}
            </div>
            <div class="cand-compact-partido">${sigla}</div>
          </div>
          <div class="cand-compact-numero">${c.nr}</div>
        </div>
      `;
    }).join("");

    // 7. SELEÇÃO DIRETA: Feedback visual instantâneo e transição elegante
    listaEl.querySelectorAll(".cand-compact-row").forEach(row => {
      const handleSelect = () => {
        if (row.classList.contains("cand-compact-confirming")) return; // Evita duplo clique
        const sq = row.dataset.sq;
        const escolhido = CANDIDATOS.find(x => String(x.sq) === String(sq));
        if (escolhido && cfg) {
          colinhaState[cfg.id] = escolhido;

          const totalPreenchidos = Object.values(colinhaState).filter(Boolean).length;
          const vaiCompletar = totalPreenchidos === 6;

          // 1. Feedback visual imediato e agradável no próprio card selecionado
          row.classList.add("cand-compact-confirming");

          // 2. Aguarda 400ms para o eleitor absorver a confirmação visual antes de fechar o modal
          setTimeout(() => {
            salvarColinha(vaiCompletar);
            fecharSelecaoCandidato();

            // 3. Efeito visual fluido de avanço na cédula central
            const centerEl = document.getElementById("cedula-center");
            if (centerEl) {
              centerEl.classList.remove("cedula-animar-troca");
              void centerEl.offsetWidth;
              centerEl.classList.add("cedula-animar-troca");
            }

            showToast(`✓ ${escolhido.urna} selecionado com sucesso!`);

            // 4. Se ainda não completou os 6 votos, transiciona suavemente para o próximo cargo após 450ms
            if (!vaiCompletar) {
              setTimeout(() => {
                avancarParaProximoCargo();
              }, 450);
            }
          }, 380);
        }
      };

      row.addEventListener("click", handleSelect);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect();
        }
      });
    });
  }

  // ---------- Gerador Gráfico da Colinha (HTML5 Canvas HD Otimizado) ----------
  function carregarImagemAsync(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function desenharColinhaCanvas() {
    const canvas = document.getElementById("canvas-export");
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");

    // Proporção Exata Quadrada 1:1 de Alta Resolução: 1200 x 1200 px (fiel ao modelo de referência)
    const W = 1200;
    const H = 1200;
    canvas.width = W;
    canvas.height = H;

    // 1. Fundo Geral Branco Puro com Borda Suave Arredondada
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 28);
    ctx.fill();

    // 2. PAINEL LATERAL ESQUERDO VERDE OFICIAL (Preenche de cima a baixo sem espaços vazios)
    const panelW = 490;

    ctx.save();
    // Cria máscara arredondada para o canto esquerdo da colinha
    ctx.beginPath();
    ctx.roundRect(0, 0, panelW, H, [28, 0, 0, 28]);
    ctx.clip();

    // Fundo Verde Degradê Oficial Marquinhos Trad (Verde Bandeira -> Verde Escuro Profundo)
    const greenGrad = ctx.createLinearGradient(0, 0, 0, H);
    greenGrad.addColorStop(0, "#15803d");
    greenGrad.addColorStop(0.55, "#14532d");
    greenGrad.addColorStop(1, "#072815");
    ctx.fillStyle = greenGrad;
    ctx.fillRect(0, 0, panelW, H);

    // Ondas e Curvas Amarelas e Verdes Dinâmicas de Fundo (como na identidade de campanha)
    ctx.strokeStyle = "rgba(234, 179, 8, 0.45)";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(-40, 200);
    ctx.bezierCurveTo(160, 100, 360, 280, 520, 180);
    ctx.stroke();

    ctx.strokeStyle = "rgba(234, 179, 8, 0.35)";
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(-50, 480);
    ctx.bezierCurveTo(180, 420, 320, 580, 530, 460);
    ctx.stroke();

    // Faixa curva verde claro
    ctx.strokeStyle = "rgba(74, 222, 128, 0.25)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-30, 340);
    ctx.bezierCurveTo(140, 260, 320, 400, 510, 320);
    ctx.stroke();

    // 3. FOTO DE MARQUINHOS TRAD (Em close-up, alta aproximação do rosto e sem espaços vazios)
    const fotoOficialNova = await carregarImagemAsync("marquinhos_colinha_foto.jpg");
    const fotoPainel = await carregarImagemAsync("marquinhos_painel_verde.jpg");

    if (fotoOficialNova) {
      // Preenche todo o painel superior até conectar perfeitamente com a logo, sem qualquer espaço vazio
      ctx.drawImage(fotoOficialNova, 0, 0, panelW, 835);
    } else if (fotoPainel) {
      ctx.drawImage(fotoPainel, 0, 0, 750, 950, 0, 0, panelW, 835);
    }

    // Degradê suave na transição entre a foto e o rodapé onde fica a logo
    const fadeGrad = ctx.createLinearGradient(0, 720, 0, 835);
    fadeGrad.addColorStop(0, "rgba(7, 40, 21, 0)");
    fadeGrad.addColorStop(1, "#072815");
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(0, 720, panelW, 115);

    // 4. LOGOMARCA OFICIAL MARQUINHOS TRAD 4333 (Preenchendo a base sem lacunas)
    const logoOficial = await carregarImagemAsync("marquinhos_logo_oficial.png");
    if (logoOficial) {
      const lW = 440;
      const lH = 370;
      const lX = (panelW - lW) / 2;
      const lY = 815;
      ctx.drawImage(logoOficial, lX, lY, lW, lH);
    }

    ctx.restore(); // Fecha o clip do painel lateral esquerdo

    // 5. TÍTULO SUPERIOR DIREITO: "VEM COM A GENTE" ou "[NOME] VOTA ASSIM" (SEM ARTIGO 'O'/'A')
    const rawNome = (localStorage.getItem("santinho_eleitor_nome") || "").trim();
    const eleitorNome = rawNome ? rawNome.split(" ")[0].toUpperCase() : "";

    const rightX = 525;
    const rightW = W - rightX - 35;

    ctx.textAlign = "left";

    if (eleitorNome) {
      // Linha 1: "PAULO VOTA ASSIM" (sem artigo)
      ctx.fillStyle = "#0c2c62";
      ctx.font = '900 58px "Outfit", sans-serif';
      ctx.fillText(`${eleitorNome} VOTA ASSIM`, rightX, 130);

      // Linha 2: "VEM COM A GENTE!"
      ctx.fillStyle = "#15803d";
      ctx.font = '900 74px "Outfit", sans-serif';
      ctx.fillText("VEM COM A GENTE!", rightX, 235);
    } else {
      // Linha 1: "VEM COM A GENTE"
      ctx.fillStyle = "#09381e";
      ctx.font = '900 68px "Outfit", sans-serif';
      ctx.fillText("VEM COM A GENTE", rightX, 130);

      // "2026" GIGANTE
      const anoY = 270;
      ctx.font = '900 148px "Outfit", sans-serif';
      
      // "20" em Azul Escuro
      ctx.fillStyle = "#0c2c62";
      ctx.fillText("20", rightX, anoY);
      
      // "2" em Verde
      ctx.fillStyle = "#15803d";
      ctx.fillText("2", rightX + 215, anoY);

      // "6" em Amarelo Ouro
      ctx.fillStyle = "#eab308";
      ctx.fillText("6", rightX + 325, anoY);
    }

    // 6. AS 6 LINHAS DA COLINHA COM NOME EM DESTAQUE E NÚMEROS BEM MAIORES
    const ROW_COLORS = [
      { bg: "#15803d", text: "#ffffff" }, // 1: Verde
      { bg: "#0284c7", text: "#ffffff" }, // 2: Azul
      { bg: "#eab308", text: "#ffffff" }, // 3: Amarelo
      { bg: "#15803d", text: "#ffffff" }, // 4: Verde
      { bg: "#0284c7", text: "#ffffff" }, // 5: Azul
      { bg: "#eab308", text: "#ffffff" }  // 6: Amarelo
    ];

    const rowStartY = 315;
    const rowH = 114;
    const rowGap = 16;

    for (let i = 0; i < CARGOS_CONFIG.length; i++) {
      const cfg = CARGOS_CONFIG[i];
      const cand = colinhaState[cfg.id];
      const y = rowStartY + i * (rowH + rowGap);
      const rowColor = ROW_COLORS[i];

      // Fundo azul suave
      ctx.fillStyle = "#f0f6fc";
      ctx.beginPath();
      ctx.roundRect(rightX, y, rightW, rowH, 14);
      ctx.fill();

      // Badge de ordem (1 a 6)
      const badgeW = 68;
      const badgeH = rowH;
      ctx.fillStyle = rowColor.bg;
      ctx.beginPath();
      ctx.roundRect(rightX, y, badgeW, badgeH, [14, 0, 0, 14]);
      ctx.fill();

      ctx.textAlign = "center";
      ctx.fillStyle = rowColor.text;
      ctx.font = '900 50px "Outfit", sans-serif';
      ctx.fillText(String(i + 1), rightX + badgeW / 2, y + 76);

      // Posição inicial das informações de texto
      const infoX = rightX + badgeW + 18;

      // Caixas de Dígitos de Voto (BEM MAIORES E DESTACADAS)
      const numDigitos = cfg.digitos;
      const boxW = 54;
      const boxH = 88;
      const boxGap = 8;
      const totalBoxesW = numDigitos * boxW + (numDigitos - 1) * boxGap;
      const startBoxX = rightX + rightW - totalBoxesW - 14;
      const boxY = y + (rowH - boxH) / 2;

      // 1. NOME DO CANDIDATO ESCOLHIDO (MAIOR E NO TOPO DA LINHA)
      let candNome = cand && cand.urna ? cand.urna.toUpperCase() : (cand && cand.nome ? cand.nome.toUpperCase() : "");

      ctx.textAlign = "left";
      if (candNome) {
        ctx.fillStyle = "#0c2c62";
        const maxTextW = startBoxX - infoX - 14;
        let fontSize = 38;
        ctx.font = `900 ${fontSize}px "Outfit", sans-serif`;
        while (ctx.measureText(candNome).width > maxTextW && fontSize > 20) {
          fontSize -= 1.5;
          ctx.font = `900 ${fontSize}px "Outfit", sans-serif`;
        }
        ctx.fillText(candNome, infoX, y + 50);
      } else {
        ctx.fillStyle = "#94a3b8";
        ctx.font = 'italic 700 28px "Outfit", sans-serif';
        ctx.fillText("A DEFINIR", infoX, y + 50);
      }

      // 2. NOME DO CARGO (DISCRETO, DE APOIO, ABAIXO DO NOME)
      let cargoStr = cfg.cargo.toUpperCase();
      if (cfg.id === "sen1") cargoStr = "SENADOR (1ª VAGA)";
      if (cfg.id === "sen2") cargoStr = "SENADOR (2ª VAGA)";

      ctx.fillStyle = "#64748b";
      ctx.font = '700 20px "Outfit", sans-serif';
      ctx.fillText(cargoStr, infoX, y + 88);

      // Dígitos reais preenchidos (GRANDES E NÍTIDOS)
      const digitsArr = cand && cand.nr ? String(cand.nr).split("") : [];

      for (let d = 0; d < numDigitos; d++) {
        const bX = startBoxX + d * (boxW + boxGap);

        // Fundo Branco da Caixinha
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(bX, boxY, boxW, boxH, 10);
        ctx.fill();

        // Borda Nítida
        ctx.strokeStyle = "#0c2c62";
        ctx.lineWidth = 2.6;
        ctx.stroke();

        // Dígito Gigante
        const digitoChar = digitsArr[d];
        if (digitoChar !== undefined) {
          ctx.textAlign = "center";
          ctx.fillStyle = "#000000";
          ctx.font = '900 58px "Outfit", sans-serif';
          ctx.fillText(digitoChar, bX + boxW / 2, boxY + 66);
        }
      }
    }

    // 7. LINHA INFERIOR DISCRETA DE RODAPÉ (COMO NO MODELO)
    const footerY = 1110;
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rightX, footerY);
    ctx.lineTo(rightX + rightW, footerY);
    ctx.stroke();

    // Texto: ELEIÇÕES 2026 + Tracinhos coloridos + DEMOCRACIA SEMPRE
    ctx.textAlign = "left";
    ctx.fillStyle = "#0c2c62";
    ctx.font = '800 16px "Outfit", sans-serif';
    ctx.fillText("ELEIÇÕES 2026", rightX, footerY + 36);

    // Tracinho Verde
    ctx.fillStyle = "#15803d";
    ctx.fillRect(rightX + 160, footerY + 24, 45, 10);
    // Tracinho Amarelo
    ctx.fillStyle = "#eab308";
    ctx.fillRect(rightX + 210, footerY + 24, 45, 10);
    // Tracinho Azul
    ctx.fillStyle = "#0284c7";
    ctx.fillRect(rightX + 260, footerY + 24, 45, 10);

    ctx.textAlign = "right";
    ctx.fillStyle = "#0c2c62";
    ctx.font = '800 16px "Outfit", sans-serif';
    ctx.fillText("DEMOCRACIA SEMPRE", rightX + rightW, footerY + 36);

    return canvas;
  }

  // ---------- Salvar Imagem na Galeria / Fototeca do Celular ----------
  async function baixarImagemGaleria() {
    showToast("Gerando santinho oficial em alta resolução...");
    const canvas = await desenharColinhaCanvas();
    if (!canvas) return;

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const nomeArquivo = "colinha_marquinhos_trad_4333.jpg";
      const file = new File([blob], nomeArquivo, { type: "image/jpeg" });

      // Nos smartphones modernos (iOS Safari e Android Chrome), navigator.share com arquivos
      // abre o painel nativo do sistema onde a PRIMEIRA opção é "Salvar Imagem" (adiciona direto na Galeria/Fotos/Fototeca)
      // ao invés de baixar como arquivo no navegador de downloads!
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Colinha Marquinhos Trad 4333"
          });
          showToast("✅ Imagem pronta na sua Galeria!");
          return;
        } catch (err) {
          // Se o usuário cancelou o painel de compartilhamento, apenas ignora
          if (err.name === "AbortError") return;
        }
      }

      // Fallback tradicional para computadores ou navegadores que não possuem Web Share de arquivo
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      showToast("✅ Colinha baixada! Abra para salvar na galeria.");
    }, "image/jpeg", 0.96);
  }

  // ---------- Compartilhamento no WhatsApp com Engajamento Oficial ----------
  async function compartilharColinha() {
    const canvas = await desenharColinhaCanvas();
    if (!canvas) return;

    // Resumo legível dos votos definidos pelo eleitor
    const listaCandidatos = [];
    CARGOS_CONFIG.forEach(c => {
      const cand = colinhaState[c.id];
      if (cand) {
        listaCandidatos.push(`🔹 *${c.cargo}:* ${cand.urna} — *${cand.nr}*`);
      }
    });

    const resumoVotos = listaCandidatos.length > 0 ? "\n" + listaCandidatos.join("\n") + "\n" : "";

    const rawNome = (localStorage.getItem("santinho_eleitor_nome") || "").trim();
    const eleitorNome = rawNome ? rawNome.split(" ")[0].toUpperCase() : "";

    const tituloEngajamento = eleitorNome
      ? `${eleitorNome} VOTA ASSIM, VEM COM A GENTE!`
      : "VEM COM A GENTE · ELEIÇÕES 2026";

    const textoEngajamento = 
      `🗳️ *${tituloEngajamento}*\n\n` +
      `Para Deputado Federal meu voto é *MARQUINHOS TRAD 4333*! 💚💛\n` +
      resumoVotos +
      `\n📲 Monte sua colinha oficial também e leve para a urna sem erro:\n${window.location.href}`;

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "colinha_marquinhos_trad_4333.jpg", { type: "image/jpeg" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Vem com a Gente — Marquinhos Trad 4333",
            text: textoEngajamento
          });
          showToast("✅ Compartilhado com sucesso!");
          return;
        } catch (err) {
          if (err.name !== "AbortError") console.log("Fallback share:", err);
        }
      }

      // Fallback: Baixa a imagem para a galeria e abre o WhatsApp com a mensagem formatada
      baixarImagemGaleria();
      const zapUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textoEngajamento)}`;
      window.open(zapUrl, "_blank");
      showToast("📸 Colinha salva! Envie a foto no WhatsApp.");
    }, "image/jpeg", 0.96);
  }

  // ---------- Inicialização de Eventos ----------
  function initEventos() {
    // Botão Começar de Novo
    const btnLimpar = document.getElementById("btn-limpar");
    if (btnLimpar) {
      btnLimpar.addEventListener("click", () => {
        if (confirm("Deseja limpar os outros candidatos (Deputado Estadual a Presidente) e preencher novamente?")) {
          colinhaState = {
            depFed: CANDIDATO_MARQUINHOS_4333,
            depEst: null,
            sen1: null,
            sen2: null,
            gov: null,
            pres: null
          };
          etapaAtual = 1; // Inicia no 2º voto
          salvarColinha();
          showToast("Votos reiniciados! Marquinhos Trad 4333 mantido.");
        }
      });
    }

    // Botão de Ajuda (Header) para reabrir Boas-vindas
    const btnAjuda = document.getElementById("btn-ajuda");
    if (btnAjuda) {
      btnAjuda.addEventListener("click", () => {
        const welcomeSection = document.getElementById("welcome-section");
        const vitrineContainer = document.querySelector(".container-vitrine");
        const appHeader = document.querySelector(".app-header");
        const conclusaoSection = document.getElementById("conclusao-section");
        
        if (conclusaoSection) conclusaoSection.style.display = "none";
        if (welcomeSection) welcomeSection.style.display = "block";
        if (vitrineContainer) {
          const nicho = vitrineContainer.querySelector(".nicho-vitrine-frame");
          if (nicho) nicho.style.display = "none";
        }
        if (appHeader) {
          const stepper = appHeader.querySelector(".stepper-funil");
          if (stepper) stepper.style.display = "none";
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    // Preenchimento prévio do nome se já salvo
    const inputEleitorNome = document.getElementById("input-eleitor-nome");
    const boxInputNome = document.getElementById("box-input-nome");
    const avisoNome = document.getElementById("msg-aviso-nome");
    const savedNome = localStorage.getItem("santinho_eleitor_nome");
    if (inputEleitorNome && savedNome) {
      inputEleitorNome.value = savedNome;
    }

    // Botão Começar a Preencher na Tela de Boas-Vindas
    const btnWelcomeStart = document.getElementById("btn-welcome-start");
    if (btnWelcomeStart) {
      btnWelcomeStart.addEventListener("click", () => {
        const nomeDigitado = inputEleitorNome ? inputEleitorNome.value.trim() : "";

        // Condição: primeiro nome é necessário para avançar (sem expor a palavra 'obrigatório')
        if (!nomeDigitado) {
          if (boxInputNome) {
            boxInputNome.classList.remove("shake-input");
            void boxInputNome.offsetWidth;
            boxInputNome.classList.add("shake-input");
          }
          if (avisoNome) {
            avisoNome.textContent = "Digite seu primeiro nome para personalizar sua colinha.";
            avisoNome.style.display = "block";
          }
          if (inputEleitorNome) inputEleitorNome.focus();
          return;
        }

        // Salva apenas o primeiro nome sem artigos
        const primeiroNome = nomeDigitado.split(" ")[0].trim();
        localStorage.setItem("santinho_eleitor_nome", primeiroNome);
        if (avisoNome) avisoNome.style.display = "none";

        localStorage.setItem("santinho_marquinhos_boas_vindas_vista", "true");
        etapaAtual = 1; // Inicia no 2º voto (Deputado Estadual)
        atualizarProgresso();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    if (inputEleitorNome) {
      inputEleitorNome.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (btnWelcomeStart) btnWelcomeStart.click();
        }
      });
      inputEleitorNome.addEventListener("input", () => {
        if (avisoNome && inputEleitorNome.value.trim()) {
          avisoNome.style.display = "none";
        }
      });
    }

    // Navegação Anterior e Próximo na Vitrine de Papel Real
    const btnPrev = document.getElementById("btn-vitrine-prev");
    if (btnPrev) {
      btnPrev.addEventListener("click", () => {
        if (etapaAtual > 0) {
          etapaAtual--;
          atualizarProgresso();
        }
      });
    }

    const btnNext = document.getElementById("btn-vitrine-next");
    if (btnNext) {
      btnNext.addEventListener("click", () => {
        if (etapaAtual < CARGOS_CONFIG.length - 1) {
          etapaAtual++;
          atualizarProgresso();
        }
      });
    }

    // Botões de Ação
    const btnSave = document.getElementById("btn-download");
    if (btnSave) btnSave.addEventListener("click", baixarImagemGaleria);

    const btnShare = document.getElementById("btn-share");
    if (btnShare) btnShare.addEventListener("click", compartilharColinha);

    const btnReverAnimacao = document.getElementById("btn-rever-animacao");
    if (btnReverAnimacao) {
      btnReverAnimacao.addEventListener("click", () => {
        dispararAnimacaoImpressaoUrna();
      });
    }

    const btnReiniciarFinal = document.getElementById("btn-reiniciar-final");
    if (btnReiniciarFinal) {
      btnReiniciarFinal.addEventListener("click", () => {
        if (confirm("Deseja apagar os votos (Deputado Estadual a Presidente) e preencher novamente?")) {
          colinhaState = {
            depFed: CANDIDATO_MARQUINHOS_4333,
            depEst: null,
            sen1: null,
            sen2: null,
            gov: null,
            pres: null
          };
          etapaAtual = 1; // Inicia a partir do 2º voto
          salvarColinha();
          showToast("Pronto! Preencha a partir do 2º voto.");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    }

    // Eventos do Modal de Seleção de Candidatos
    const btnFecharSelecao = document.getElementById("btn-fechar-selecao");
    const modalSelecao = document.getElementById("modal-selecao");
    const modalInputBusca = document.getElementById("modal-input-busca");
    const btnClearModalSearch = document.getElementById("btn-clear-modal-search");

    if (btnFecharSelecao) {
      btnFecharSelecao.addEventListener("click", fecharSelecaoCandidato);
    }

    // Fechar ao clicar no backdrop (desktop/tablet)
    if (modalSelecao) {
      modalSelecao.addEventListener("click", (e) => {
        if (e.target === modalSelecao) {
          fecharSelecaoCandidato();
        }
      });
    }

    // Busca instantânea com debounce e normalização
    if (modalInputBusca) {
      const onModalSearch = debounce((v) => {
        renderListaCandidatosModal(v);
        if (btnClearModalSearch) btnClearModalSearch.style.display = v ? "block" : "none";
      }, 75);

      modalInputBusca.addEventListener("input", (e) => onModalSearch(e.target.value.trim()));
    }

    if (btnClearModalSearch) {
      btnClearModalSearch.addEventListener("click", () => {
        if (modalInputBusca) {
          modalInputBusca.value = "";
          btnClearModalSearch.style.display = "none";
          renderListaCandidatosModal("");
          modalInputBusca.focus();
        }
      });
    }

    // Tecla ESC para fechar modal no Desktop
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (modalSelecao && modalSelecao.style.display !== "none") {
          fecharSelecaoCandidato();
        }
      }
    });

    const btnEditarVotos = document.getElementById("btn-editar-votos");
    if (btnEditarVotos) {
      btnEditarVotos.addEventListener("click", () => {
        etapaAtual = 1; // Leva diretamente para o 2º voto (Deputado Estadual)
        const conclusaoSection = document.getElementById("conclusao-section");
        const vitrineContainer = document.querySelector(".container-vitrine");
        const appHeader = document.querySelector(".app-header");
        if (conclusaoSection) conclusaoSection.style.display = "none";
        if (vitrineContainer) {
          vitrineContainer.style.display = "flex";
          const nicho = vitrineContainer.querySelector(".nicho-vitrine-frame");
          if (nicho) nicho.style.display = "block";
        }
        if (appHeader) {
          appHeader.style.display = "block";
          const stepper = appHeader.querySelector(".stepper-funil");
          if (stepper) stepper.style.display = "flex";
        }
        renderizarStepperFunil();
        renderizarVitrineNicho();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    // Registrar Service Worker para PWA Offline
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }

  // Iniciar App
  initEventos();
  initDados();
})();
