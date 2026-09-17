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
    try {
      const salvo = localStorage.getItem("santinho_marquinhos_4333_v1");
      if (salvo) {
        const parsed = JSON.parse(salvo);
        return {
          ...base,
          ...parsed,
          depFed: CANDIDATO_MARQUINHOS_4333 // Fixado sempre com Marquinhos Trad 4333
        };
      }
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
      if (cfg.id === "depFed") cargoTitle = "DEPUTADO<br>FEDERAL";
      else if (cfg.id === "depEst") cargoTitle = "DEPUTADO<br>ESTADUAL";
      else if (cfg.id === "sen1") cargoTitle = "SENADOR –<br>1ª VAGA";
      else if (cfg.id === "sen2") cargoTitle = "SENADOR –<br>2ª VAGA";

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
            <div class="colinha-mockup-cargo">${cargoTitle}</div>
            <div class="colinha-mockup-cand-name ${candNome ? 'filled' : 'empty'}">${candNome || 'A DEFINIR'}</div>
          </div>
          <div class="colinha-mockup-boxes">${boxesHtml}</div>
        </div>
      `;
    }).join("");

    return `
      <div class="colinha-mockup-card-container">
        <div class="colinha-mockup-left">
          <div class="colinha-mockup-photo-wrap">
            <img src="marquinhos_painel_verde.jpg" alt="Marquinhos Trad" class="colinha-mockup-photo" onerror="this.src='marquinhos_recorte.jpg'">
          </div>
          <div class="colinha-mockup-logo-wrap">
            <img src="marquinhos_logo_oficial.png" alt="Marquinhos Trad Deputado Federal" class="colinha-mockup-logo">
          </div>
        </div>

        <div class="colinha-mockup-right">
          <div class="colinha-mockup-header">
            <div class="colinha-mockup-title">MINHA COLINHA</div>
            <div class="colinha-mockup-ano">
              <span class="ano-blue">20</span><span class="ano-green">2</span><span class="ano-yellow">6</span>
            </div>
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

  // ---------- Animação Especial: Colinha Saindo da Urna (Impressão Real com Fotos) ----------
  function dispararAnimacaoImpressaoUrna() {
    const overlay = document.getElementById("print-modal-overlay");
    const listaSlip = document.getElementById("slip-candidatos-list");
    const paperRoll = document.getElementById("paper-slip-roll");
    const statusText = document.getElementById("print-status-text");
    const conclusaoSection = document.getElementById("conclusao-section");
    const funilViewport = document.getElementById("funil-viewport");

    if (!overlay || !listaSlip) return;

    // Monta o comprovante contínuo com os 6 candidatos e SUAS FOTOS REAIS
    listaSlip.innerHTML = CARGOS_CONFIG.map(cfg => {
      const cand = colinhaState[cfg.id];
      if (!cand) return "";
      const nome = cand.urna.length > 15 ? cand.urna.slice(0, 14) + "…" : cand.urna;
      const isMarquinhos = cfg.id === "depFed";
      const fotoSrc = isMarquinhos ? "marquinhos_foto_hd.jpg" : (cand.foto_url || (cand.sq ? `fotos_tse/${cand.sq}.webp` : ""));

      return `
        <div class="slip-item-row">
          ${fotoSrc ? `<img src="${fotoSrc}" class="slip-item-photo" alt="${cand.urna}" onerror="this.style.display='none'">` : ''}
          <div class="slip-item-info">
            <span class="slip-item-cargo">${cfg.ordemVoto} ${cfg.cargo}</span>
            <span class="slip-item-name">${nome}</span>
          </div>
          <span class="slip-item-nr">${cand.nr}</span>
        </div>
      `;
    }).join("");

    // Reinicia animação de saída de papel
    if (paperRoll) {
      paperRoll.style.animation = "none";
      void paperRoll.offsetWidth;
      paperRoll.style.animation = "rollOutPaper 4.2s cubic-bezier(0.16, 1, 0.3, 1) forwards";
    }

    if (statusText) {
      statusText.innerHTML = `<span class="print-spinner"></span> Urna imprimindo seu santinho oficial...`;
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
            const stepper = appHeader.querySelector(".stepper-funil");
            if (stepper) stepper.style.display = "none";
          }
        } else {
          if (welcomeSection) welcomeSection.style.display = "none";
          if (vitrineContainer) {
            vitrineContainer.style.display = "flex";
            const nicho = vitrineContainer.querySelector(".nicho-vitrine-frame");
            if (nicho) nicho.style.display = "block";
          }
          if (appHeader) {
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

    // 3. FOTO DE MARQUINHOS TRAD (Preenchendo toda a lateral superior e média)
    const fotoPainel = await carregarImagemAsync("marquinhos_painel_verde.jpg");
    const fotoRecorte = await carregarImagemAsync("marquinhos_recorte.jpg");
    const fotoFallback = await carregarImagemAsync("marquinhos_foto_hd.jpg");

    if (fotoPainel) {
      // Recorta a face e ombro a partir da imagem quadrada (1024x1024) com foco em Marquinhos
      ctx.drawImage(fotoPainel, 0, 0, 750, 950, 0, 0, panelW, 830);
    } else if (fotoRecorte || fotoFallback) {
      const fImg = fotoRecorte || fotoFallback;
      ctx.drawImage(fImg, -20, 10, panelW + 40, 780);
    }

    // Degradê suave na transição entre a foto e o rodapé verde onde fica a logo
    const fadeGrad = ctx.createLinearGradient(0, 680, 0, 830);
    fadeGrad.addColorStop(0, "rgba(7, 40, 21, 0)");
    fadeGrad.addColorStop(1, "#072815");
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(0, 680, panelW, 150);

    // 4. LOGOMARCA OFICIAL MARQUINHOS TRAD 4333 (Sobre fundo verde escuro)
    const logoOficial = await carregarImagemAsync("marquinhos_logo_oficial.png");
    if (logoOficial) {
      const lW = 420;
      const lH = 360;
      const lX = (panelW - lW) / 2;
      const lY = 825;
      ctx.drawImage(logoOficial, lX, lY, lW, lH);
    }

    ctx.restore(); // Fecha o clip do painel lateral esquerdo

    // 5. TÍTULO SUPERIOR DIREITO: "MINHA COLINHA" + "2026"
    const rightX = 525;
    const rightW = W - rightX - 35;

    // "MINHA COLINHA"
    ctx.textAlign = "left";
    ctx.fillStyle = "#09381e";
    ctx.font = '900 68px "Outfit", sans-serif';
    ctx.fillText("MINHA COLINHA", rightX, 130);

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

    // 6. AS 6 LINHAS DA COLINHA (Com Cargo, Nome do Candidato Escolhido e Caixas de Dígitos)
    const ROW_COLORS = [
      { bg: "#15803d", text: "#ffffff" }, // 1: Verde
      { bg: "#0284c7", text: "#ffffff" }, // 2: Azul
      { bg: "#eab308", text: "#ffffff" }, // 3: Amarelo
      { bg: "#15803d", text: "#ffffff" }, // 4: Verde
      { bg: "#0284c7", text: "#ffffff" }, // 5: Azul
      { bg: "#eab308", text: "#ffffff" }  // 6: Amarelo
    ];

    const rowStartY = 315;
    const rowH = 112;
    const rowGap = 16;

    for (let i = 0; i < CARGOS_CONFIG.length; i++) {
      const cfg = CARGOS_CONFIG[i];
      const cand = colinhaState[cfg.id];
      const y = rowStartY + i * (rowH + rowGap);
      const rowColor = ROW_COLORS[i];

      // Fundo azul bem clarinho/gelo do container da linha
      ctx.fillStyle = "#f0f6fc";
      ctx.beginPath();
      ctx.roundRect(rightX, y, rightW, rowH, 14);
      ctx.fill();

      // Badge com o número da ordem (1 a 6)
      const badgeW = 68;
      const badgeH = rowH;
      ctx.fillStyle = rowColor.bg;
      ctx.beginPath();
      ctx.roundRect(rightX, y, badgeW, badgeH, [14, 0, 0, 14]);
      ctx.fill();

      ctx.textAlign = "center";
      ctx.fillStyle = rowColor.text;
      ctx.font = '900 48px "Outfit", sans-serif';
      ctx.fillText(String(i + 1), rightX + badgeW / 2, y + 74);

      // Informações: Cargo e Nome do Candidato
      const infoX = rightX + badgeW + 16;

      // Nome do Cargo (texto ampliado e nítido)
      let cargoStr = cfg.cargo.toUpperCase();
      if (cfg.id === "sen1") cargoStr = "SENADOR (1ª VAGA)";
      if (cfg.id === "sen2") cargoStr = "SENADOR (2ª VAGA)";

      ctx.textAlign = "left";
      ctx.fillStyle = "#334155";
      ctx.font = '800 22px "Outfit", sans-serif';
      ctx.fillText(cargoStr, infoX, y + 36);

      // Caixas de Dígitos de Voto (Brancas com borda fina preta/azul e dígitos pretos grandes)
      const numDigitos = cfg.digitos;
      const boxW = 48;
      const boxH = 74;
      const boxGap = 6;
      const totalBoxesW = numDigitos * boxW + (numDigitos - 1) * boxGap;
      const startBoxX = rightX + rightW - totalBoxesW - 14;
      const boxY = y + (rowH - boxH) / 2;

      // Nome do Candidato Escolhido (MUITO MAIOR E EM MÁXIMO DESTAQUE)
      let candNome = cand && cand.urna ? cand.urna.toUpperCase() : (cand && cand.nome ? cand.nome.toUpperCase() : "");

      if (candNome) {
        ctx.fillStyle = "#0c2c62";
        // Espaço horizontal máximo disponível para o nome
        const maxTextW = startBoxX - infoX - 12;
        let fontSize = 34;
        ctx.font = `900 ${fontSize}px "Outfit", sans-serif`;
        // Reduz a fonte progressivamente se o nome for extremamente longo para não suprimir nenhuma letra
        while (ctx.measureText(candNome).width > maxTextW && fontSize > 18) {
          fontSize -= 1.5;
          ctx.font = `900 ${fontSize}px "Outfit", sans-serif`;
        }
        ctx.fillText(candNome, infoX, y + 84);
      } else {
        ctx.fillStyle = "#94a3b8";
        ctx.font = 'italic 700 24px "Outfit", sans-serif';
        ctx.fillText("A DEFINIR", infoX, y + 82);
      }

      // Dígitos reais preenchidos
      const digitsArr = cand && cand.nr ? String(cand.nr).split("") : [];

      for (let d = 0; d < numDigitos; d++) {
        const bX = startBoxX + d * (boxW + boxGap);

        // Fundo Branco da Caixinha
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(bX, boxY, boxW, boxH, 8);
        ctx.fill();

        // Borda Fina
        ctx.strokeStyle = "#0c2c62";
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Dígito
        const digitoChar = digitsArr[d];
        if (digitoChar !== undefined) {
          ctx.textAlign = "center";
          ctx.fillStyle = "#000000";
          ctx.font = '900 48px "Outfit", sans-serif';
          ctx.fillText(digitoChar, bX + boxW / 2, boxY + 54);
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

  // ---------- Download da Imagem ----------
  async function baixarImagemGaleria() {
    showToast("Gerando santinho oficial em alta resolução...");
    const canvas = await desenharColinhaCanvas();
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "minha_colinha_marquinhos_4333.jpg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      showToast("✅ Colinha oficial salva na sua Galeria!");
    }, "image/jpeg", 0.96);
  }

  // ---------- Compartilhamento no WhatsApp com Engajamento ----------
  async function compartilharColinha() {
    const canvas = await desenharColinhaCanvas();
    if (!canvas) return;

    const textoEngajamento = 
      "🗳️ Vem com a Gente! Minha colinha para Deputado Federal é Marquinhos Trad 4333! Confira minha colinha oficial 2026 e monte a sua também:";

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "minha_colinha_marquinhos_4333.jpg", { type: "image/jpeg" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Minha Colinha 2026 — Marquinhos Trad 4333",
            text: textoEngajamento
          });
          showToast("Compartilhado com sucesso!");
          return;
        } catch (err) {
          if (err.name !== "AbortError") console.log("Fallback share:", err);
        }
      }

      // Fallback: Baixa a imagem e abre o WhatsApp com o texto
      baixarImagemGaleria();
      const zapUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textoEngajamento + "\n" + window.location.href)}`;
      window.open(zapUrl, "_blank");
      showToast("Colinha salva! Anexe a foto no WhatsApp.");
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

    // Botão Começar a Preencher na Tela de Boas-Vindas
    const btnWelcomeStart = document.getElementById("btn-welcome-start");
    if (btnWelcomeStart) {
      btnWelcomeStart.addEventListener("click", () => {
        localStorage.setItem("santinho_marquinhos_boas_vindas_vista", "true");
        etapaAtual = 1; // Inicia no 2º voto (Deputado Estadual)
        atualizarProgresso();
        window.scrollTo({ top: 0, behavior: "smooth" });
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
