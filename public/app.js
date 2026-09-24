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

  // Candidato Oficial Pré-definido: Marquinhos Trad 4333 - Deputado Federal (Imutável contra adulteração)
  const CANDIDATO_MARQUINHOS_4333 = Object.freeze({
    sq: "120002537466",
    nr: "4333",
    urna: "Marquinhos Trad",
    cargo: "Deputado Federal",
    partido_sigla: "PV",
    foto_url: "marquinhos_foto_hd.jpg",
    situacao: "Deferido",
    situacao_julgamento: "Deferido"
  });

  let CANDIDATOS = [];
  let colinhaState = carregarColinha();
  let slotAtivo = null;

  // ---------- Utilitários de Segurança e Formatação ----------
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

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

  // Limpeza de chaves legadas permanentes no localStorage para garantir privacidade e sigilo total
  try {
    localStorage.removeItem("santinho_eleitor_nome");
    localStorage.removeItem("santinho_marquinhos_4333_v1");
    localStorage.removeItem("santinho_marquinhos_boas_vindas_vista");
  } catch (e) {}

  let eleitorNomeGlobal = "";
  try {
    eleitorNomeGlobal = (sessionStorage.getItem("santinho_eleitor_nome") || "").trim();
  } catch (e) {}

  function getEleitorNome() {
    let nome = eleitorNomeGlobal;
    if (!nome) {
      try {
        nome = (sessionStorage.getItem("santinho_eleitor_nome") || "").trim();
      } catch (e) {}
    }
    return nome ? nome.split(" ")[0].toUpperCase() : "";
  }

  function setEleitorNome(novoNome) {
    eleitorNomeGlobal = (novoNome || "").trim();
    try {
      if (eleitorNomeGlobal) {
        sessionStorage.setItem("santinho_eleitor_nome", eleitorNomeGlobal);
      } else {
        sessionStorage.removeItem("santinho_eleitor_nome");
      }
    } catch (e) {}
  }

  // ---------- Persistência em Sessão (Volátil / Sigilo Absoluto LGPD) ----------
  function carregarColinha() {
    let base = {
      depFed: CANDIDATO_MARQUINHOS_4333,
      depEst: null,
      sen1: null,
      sen2: null,
      gov: null,
      pres: null
    };
    // Recupera dados da sessão atual se o usuário atualizar a página
    try {
      const salvo = sessionStorage.getItem("santinho_marquinhos_4333_v1");
      if (salvo) {
        const parsed = JSON.parse(salvo);
        if (parsed && typeof parsed === "object") {
          base = Object.assign(base, parsed);
        }
      }
    } catch (e) {}
    return base;
  }

  function salvarColinha(dispararImpressaoSeCompleto = false) {
    try {
      colinhaState.depFed = CANDIDATO_MARQUINHOS_4333; // Garante permanência do 1º voto
      sessionStorage.setItem("santinho_marquinhos_4333_v1", JSON.stringify(colinhaState));
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
    const eleitorNome = getEleitorNome();

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

      // Destaque visual especial de liderança para Marquinhos Trad (1º Voto - Deputado Federal)
      let nameInnerHtml = "";
      let rowExtraClass = "";
      if (cfg.id === "depFed") {
        rowExtraClass = "colinha-row-marquinhos-destaque";
        nameInnerHtml = `
          <div class="colinha-nome-marquinhos-duas-linhas">
            <span class="mq-l1">MARQUINHOS</span>
            <span class="mq-l2">TRAD</span>
          </div>
        `;
      } else {
        nameInnerHtml = `<div class="colinha-mockup-cand-name ${candNome ? 'filled' : 'empty'}">${candNome || 'A DEFINIR'}</div>`;
      }

      return `
        <div class="colinha-mockup-row ${rowExtraClass}">
          <div class="colinha-mockup-badge" style="background:${rowColor.bg};color:${rowColor.text};">${i + 1}</div>
          <div class="colinha-mockup-info">
            ${nameInnerHtml}
            <div class="colinha-mockup-cargo">${cargoTitle}</div>
          </div>
          <div class="colinha-mockup-boxes">${boxesHtml}</div>
        </div>
      `;
    }).join("");

    let headerSloganHtml = "";
    if (eleitorNome) {
      headerSloganHtml = `
        <div class="colinha-mockup-personalizado-wrap">
          <span class="colinha-nome-destaque">${eleitorNome}</span>
          <span class="colinha-vota-assim-sub">VOTA ASSIM</span>
        </div>
      `;
    } else {
      headerSloganHtml = `<div class="colinha-mockup-slogan-topo">VEM COM A GENTE</div>`;
    }

    return `
      <div class="colinha-mockup-card-container">
        <!-- Lado Esquerdo Oficial (Fiel à Imagem de Referência 2) -->
        <div class="colinha-mockup-left">
          <picture>
            <source srcset="marquinhos_painel_lateral.webp" type="image/webp">
            <img src="marquinhos_painel_lateral.jpg" alt="Marquinhos Trad Deputado Federal 4333" class="colinha-painel-lateral-img">
          </picture>
        </div>

        <!-- Lado Direito: Cédula com os 6 Votos (Fiel à Imagem de Referência 2) -->
        <div class="colinha-mockup-right">
          <!-- Cabeçalho com Nome e Cores Cívicas -->
          <div class="colinha-mockup-header">
            ${headerSloganHtml}
            <div class="colinha-header-color-bar">
              <span class="bar-g"></span>
              <span class="bar-y"></span>
              <span class="bar-b"></span>
            </div>
          </div>

          <!-- As 6 Linhas com caixas numéricas -->
          <div class="colinha-mockup-rows-list">
            ${rowsHtml}
          </div>

          <!-- Rodapé Cívico com Marcas Oficiais -->
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
      statusText.innerHTML = `<span class="print-spinner"></span> Sua colinha está saindo da urna...`;
    }

    overlay.style.display = "flex";

    setTimeout(() => {
      if (statusText) {
        statusText.innerHTML = `✅ Sua colinha está pronta!`;
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
      showToast("🎉 Sua colinha oficial está pronta!");
    }, 5200);
  }

  // ---------- Vitrine 3D & Stepper: Atualização de Progresso ----------
  function atualizarProgresso(dispararImpressaoSeCompleto = false) {
    const preenchidos = Object.values(colinhaState).filter(Boolean).length;
    const conclusaoSection = document.getElementById("conclusao-section");
    const vitrineContainer = document.querySelector(".container-vitrine");
    const appHeader = document.querySelector(".app-header");
    const welcomeSection = document.getElementById("welcome-section");
    const boasVindasVista = sessionStorage.getItem("santinho_marquinhos_boas_vindas_vista") === "true";

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

  const STEP_COLORS = [
    { bg: "#15803d", text: "#ffffff", border: "#4ade80", glow: "rgba(34, 197, 94, 0.65)" }, // 1: Verde (Marquinhos Trad)
    { bg: "#0284c7", text: "#ffffff", border: "#38bdf8", glow: "rgba(2, 132, 199, 0.65)" }, // 2: Azul (Deputado Estadual)
    { bg: "#eab308", text: "#000000", border: "#fef08a", glow: "rgba(234, 179, 8, 0.65)" }, // 3: Amarelo (Senador 1)
    { bg: "#15803d", text: "#ffffff", border: "#4ade80", glow: "rgba(34, 197, 94, 0.65)" }, // 4: Verde (Senador 2)
    { bg: "#0284c7", text: "#ffffff", border: "#38bdf8", glow: "rgba(2, 132, 199, 0.65)" }, // 5: Azul (Governador)
    { bg: "#eab308", text: "#000000", border: "#fef08a", glow: "rgba(234, 179, 8, 0.65)" }  // 6: Amarelo (Presidente)
  ];

  function renderizarStepperFunil() {
    const stepper = document.getElementById("stepper-funil");
    if (!stepper) return;

    stepper.innerHTML = CARGOS_CONFIG.map((cfg, idx) => {
      const preenchido = !!colinhaState[cfg.id];
      const ativo = idx === etapaAtual;
      const isLast = idx === CARGOS_CONFIG.length - 1;
      const isFixado = idx === 0; // 1º Voto (Deputado Federal) é fixado
      const col = STEP_COLORS[idx] || STEP_COLORS[0];

      let dynamicStyle = "";
      if (ativo) {
        dynamicStyle = `background:${col.bg};color:${col.text};border-color:${col.border};box-shadow:0 0 16px ${col.glow};transform:scale(1.18);`;
      } else if (preenchido) {
        dynamicStyle = `background:${col.bg};color:${col.text};border-color:${col.border};`;
      }

      return `
        <div class="step-node-item">
          <div class="step-circle ${ativo ? 'ativo' : ''} ${preenchido ? 'concluido' : ''} ${isFixado ? 'fixado-bloqueado' : ''}" 
               data-step="${idx}" 
               style="${dynamicStyle}"
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
          showToast("⭐ O 1º voto já é do Marquinhos 4333! Escolha os outros 5.");
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
        <div class="cedula-area-clicavel preenchido cedula-fixada-marquinhos" data-acao-fixado="true" role="region" title="1º Voto: Marquinhos Trad 4333">
          <div class="cedula-info-bloco">
            <span class="cedula-sublabel" style="color:#15803d;font-weight:900;">★ 1º VOTO:</span>
            <div class="cedula-cand-nome">${cand.urna}</div>
            <span class="cedula-cand-partido">• ${cand.partido_sigla} · VEM COM A GENTE</span>
          </div>

          <div class="cedula-corpo-voto">
            <div class="cedula-foto-frame cedula-foto-frame-marquinhos">
              <img src="${fotoSrc}" alt="${cand.urna}" style="width:100%;height:100%;object-fit:cover;">
            </div>
            <div class="cedula-numero-bloco">
              <span class="cedula-numero-label">Número:</span>
              <div class="cedula-numero-grande" style="color:#fef08a;background:#0f3d21;padding:2px 8px;border-radius:6px;">${cand.nr}</div>
              <span class="cedula-status-fixo">✓ Já Confirmado!</span>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="cedula-cargo-titulo">${titulo}</div>
      <div class="cedula-area-clicavel ${isPreenchido ? 'preenchido' : 'vazio'}" data-acao-selecionar="${cfg.id}" role="button" tabindex="0" title="${isPreenchido ? 'Toque para mudar' : 'Toque para escolher'}">
        <div class="cedula-info-bloco">
          <span class="cedula-sublabel">${isPreenchido ? 'Candidato escolhido:' : 'Nenhum candidato escolhido ainda'}</span>
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
            <span class="cedula-toque-alterar">${isPreenchido ? 'Toque para mudar ↻' : 'Toque para escolher'}</span>
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
      showToast("⭐ O 1º voto já é do Marquinhos 4333! Escolha os outros 5.");
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
    const containerEl = document.getElementById("modal-alfabeto-container");
    const barEl = document.getElementById("modal-alfabeto-bar");
    if (!barEl) return;

    // Se tiver poucos candidatos (ex: Presidente/Governador com < 12 candidatos), oculta para não poluir
    if (candsDoCargo.length < 12) {
      if (containerEl) containerEl.style.display = "none";
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
    if (containerEl) containerEl.style.display = "block";

    // Função para centralizar suavemente uma letra no trilho
    const centralizarItem = (el) => {
      if (!el || !barEl) return;
      const elCenter = el.offsetLeft + el.offsetWidth / 2;
      const barCenter = barEl.clientWidth / 2;
      barEl.scrollTo({
        left: elCenter - barCenter,
        behavior: "smooth"
      });
    };

    // Atualiza estado visual e filtra
    const selecionarLetra = (btn, animarScroll = true) => {
      letraAtivaFiltro = btn.dataset.letra || "";
      barEl.querySelectorAll(".btn-alfabeto-pille").forEach(b => b.classList.remove("ativo"));
      btn.classList.add("ativo");

      if (animarScroll) {
        centralizarItem(btn);
      }

      const inputBusca = document.getElementById("modal-input-busca");
      const buscaTermo = inputBusca ? inputBusca.value.trim() : "";
      renderListaCandidatosModal(buscaTermo);
    };

    // Centraliza o item inicialmente ativo
    const itemAtivo = barEl.querySelector(".btn-alfabeto-pille.ativo");
    if (itemAtivo) {
      setTimeout(() => centralizarItem(itemAtivo), 80);
    }

    // Eventos de clique nas letras
    barEl.querySelectorAll(".btn-alfabeto-pille").forEach(btn => {
      btn.addEventListener("click", () => {
        selecionarLetra(btn, true);
      });
    });

    // Detecção magnética do item mais próximo do centro durante o scroll livre
    let scrollTimeout;
    barEl.onscroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const barCenter = barEl.scrollLeft + barEl.clientWidth / 2;
        let itemMaisProximo = null;
        let menorDist = Infinity;

        barEl.querySelectorAll(".btn-alfabeto-pille").forEach(btn => {
          const btnCenter = btn.offsetLeft + btn.offsetWidth / 2;
          const dist = Math.abs(barCenter - btnCenter);
          if (dist < menorDist) {
            menorDist = dist;
            itemMaisProximo = btn;
          }
        });

        if (itemMaisProximo && !itemMaisProximo.classList.contains("ativo")) {
          selecionarLetra(itemMaisProximo, false);
        }
      }, 140);
    };
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
          <div style="font-size:15px;color:#19261f;font-weight:700;">Não achamos esse candidato</div>
          <div style="font-size:13px;">Confira se o nome ou número de <strong>${cfg.cargo}</strong> estão certinhos.</div>
        </div>
      `;
      return;
    }

    // Renderiza lista vertical densa (exibe várias opções na viewport)
    listaEl.innerHTML = cands.map(c => {
      const fotoSrc = c.foto_url || (c.sq ? `fotos_tse/${c.sq}.webp` : "");
      const safeUrna = escapeHtml(c.urna);
      const safeSigla = escapeHtml(c.partido_sigla || "");
      const safeNr = escapeHtml(c.nr);
      const isSelected = colinhaState[cfg.id] && String(colinhaState[cfg.id].sq) === String(c.sq);

      return `
        <div class="cand-compact-row ${isSelected ? 'cand-compact-selected' : ''}" 
             data-sq="${c.sq}" 
             role="option" 
             aria-selected="${isSelected ? 'true' : 'false'}"
             tabindex="0"
             title="Escolher ${safeUrna} (${safeNr})">
          ${fotoSrc ? `
            <img src="${fotoSrc}" class="cand-compact-photo" alt="${safeUrna}" loading="lazy" onerror="this.outerHTML='<div class=\\'cand-compact-photo-placeholder\\'>👤</div>'">
          ` : `
            <div class="cand-compact-photo-placeholder">👤</div>
          `}
          <div class="cand-compact-info">
            <div class="cand-compact-nome">
              <span>${safeUrna}</span>
              ${isSelected ? `<span class="cand-compact-selected-badge">✓ ESCOLHIDO</span>` : ''}
            </div>
            <div class="cand-compact-partido">${safeSigla}</div>
          </div>
          <div class="cand-compact-numero">${safeNr}</div>
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

            showToast(`✓ ${escolhido.urna} escolhido com sucesso!`);

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

    // Proporção Exata 2:3 de Alta Resolução: 1000 x 1500 px (Fiel à Imagem de Referência 2)
    const W = 1000;
    const H = 1500;
    canvas.width = W;
    canvas.height = H;

    // 1. Fundo Geral Branco Puro com cantos suavemente arredondados
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 24);
    ctx.fill();

    // 2. PAINEL LATERAL ESQUERDO OFICIAL (Exatamente 41% da largura = 410px)
    const panelW = 410;

    ctx.save();
    // Máscara com cantos arredondados na esquerda
    ctx.beginPath();
    ctx.roundRect(0, 0, panelW, H, [24, 0, 0, 24]);
    ctx.clip();

    // Carrega a arte lateral oficial extraída da referência
    const painelOficial = (await carregarImagemAsync("marquinhos_painel_lateral.webp")) ||
                          (await carregarImagemAsync("marquinhos_painel_lateral.jpg"));

    if (painelOficial) {
      // Preenche todo o painel esquerdo sem folgas ou distorções
      ctx.drawImage(painelOficial, 0, 0, panelW, H);
    } else {
      // Fallback em degradê verde se imagem falhar
      const greenGrad = ctx.createLinearGradient(0, 0, 0, H);
      greenGrad.addColorStop(0, "#15803d");
      greenGrad.addColorStop(0.55, "#14532d");
      greenGrad.addColorStop(1, "#072815");
      ctx.fillStyle = greenGrad;
      ctx.fillRect(0, 0, panelW, H);

      const fotoOficialNova = await carregarImagemAsync("marquinhos_colinha_foto.jpg");
      if (fotoOficialNova) {
        ctx.drawImage(fotoOficialNova, 0, 0, panelW, 920);
      }
      const logoOficial = await carregarImagemAsync("marquinhos_logo_oficial.png");
      if (logoOficial) {
        ctx.drawImage(logoOficial, 20, 930, panelW - 40, 420);
      }
    }
    ctx.restore(); // Fecha o clip do painel lateral esquerdo

    // 3. PAINEL DIREITO: CÉDULA COM OS 6 VOTOS (FIEL À IMAGEM 2)
    const rightX = 435;
    const rightW = 535;
    const centerRightX = panelW + (W - panelW) / 2; // ~705px

    // 3.1 Cabeçalho Personalizado Oficial
    const eleitorNome = getEleitorNome();

    if (eleitorNome) {
      // Nome do eleitor em destaque verde escuro/esmeralda cívico
      ctx.save();
      ctx.textAlign = "center";
      const nomeCompletoTexto = `${eleitorNome} VOTA ASSIM`;
      ctx.fillStyle = "#15803d";
      ctx.font = '900 40px "Outfit", sans-serif';
      ctx.fillText(nomeCompletoTexto, centerRightX, 115);
      ctx.restore();
    } else {
      // Slogan oficial quando não há nome
      ctx.save();
      ctx.textAlign = "center";
      ctx.fillStyle = "#0c2c62";
      ctx.font = '900 42px "Outfit", sans-serif';
      ctx.fillText("VEM COM A GENTE", centerRightX, 115);
      ctx.restore();
    }

    // Barra de cores cívicas centralizada abaixo do título
    const barW = 240;
    const barH = 6;
    const barX = centerRightX - barW / 2;
    const barY = 155;
    const segW = barW / 3;

    ctx.fillStyle = "#15803d"; // Verde
    ctx.fillRect(barX, barY, segW, barH);
    ctx.fillStyle = "#eab308"; // Amarelo
    ctx.fillRect(barX + segW, barY, segW, barH);
    ctx.fillStyle = "#0284c7"; // Azul
    ctx.fillRect(barX + segW * 2, barY, segW, barH);

    // 3.2 As 6 Linhas de Votação com Badges Coloridas e Caixas Numéricas
    const ROW_COLORS = [
      { bg: "#15803d", text: "#ffffff" }, // 1: Verde (Marquinhos Trad)
      { bg: "#0284c7", text: "#ffffff" }, // 2: Azul/Ciano (Estadual)
      { bg: "#eab308", text: "#ffffff" }, // 3: Amarelo Ouro (Senador 1)
      { bg: "#15803d", text: "#ffffff" }, // 4: Verde (Senador 2)
      { bg: "#0284c7", text: "#ffffff" }, // 5: Azul/Ciano (Governador)
      { bg: "#eab308", text: "#ffffff" }  // 6: Amarelo Ouro (Presidente)
    ];

    const rowStartY = 210;
    const rowH = 130;
    const rowGap = 28;

    for (let i = 0; i < CARGOS_CONFIG.length; i++) {
      const cfg = CARGOS_CONFIG[i];
      const cand = colinhaState[cfg.id];
      const y = rowStartY + i * (rowH + rowGap);
      const rowColor = ROW_COLORS[i];

      // Badge com Número da Ordem (1 a 6)
      const badgeW = 54;
      const badgeH = 92;
      const badgeX = rightX;
      const badgeY = y + (rowH - badgeH) / 2;

      ctx.fillStyle = rowColor.bg;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
      ctx.fill();

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = rowColor.text;
      ctx.font = '900 42px "Outfit", sans-serif';
      ctx.fillText(String(i + 1), badgeX + badgeW / 2, badgeY + badgeH / 2 + 1);

      // Caixas de Dígitos Brancas (Otimizadas para 5 dígitos e garantia de espaço para o nome)
      const digitsArr = cand && cand.nr ? String(cand.nr).split("") : [];
      const boxW = cfg.digitos === 5 ? 46 : 52;
      const boxH = 88;
      const boxGap = cfg.digitos === 5 ? 6 : 8;
      const totalBoxesW = cfg.digitos * boxW + (cfg.digitos - 1) * boxGap;
      const boxesStartX = rightX + rightW - totalBoxesW;
      const boxY = y + (rowH - boxH) / 2;

      // Caixa das Informações do Candidato com Auto-Scaling Inteligente
      const infoX = badgeX + badgeW + 14;
      const maxTextW = Math.max(120, boxesStartX - infoX - 12);

      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      if (cfg.id === "depFed") {
        // Auto-scaling para MARQUINHOS TRAD
        const nomeTexto = "MARQUINHOS TRAD";
        let fontSizeNome = 34;
        ctx.font = `950 ${fontSizeNome}px "Outfit", sans-serif`;
        while (ctx.measureText(nomeTexto).width > maxTextW && fontSizeNome > 18) {
          fontSizeNome -= 1;
          ctx.font = `950 ${fontSizeNome}px "Outfit", sans-serif`;
        }

        ctx.fillStyle = "#15803d";
        ctx.fillText(nomeTexto, infoX, y + 26);

        ctx.fillStyle = "#15803d";
        ctx.font = '800 20px "Outfit", sans-serif';
        ctx.fillText("DEPUTADO FEDERAL", infoX, y + 74);
      } else {
        const candNome = cand && cand.urna ? cand.urna.toUpperCase() : "";
        const displayNome = candNome || "A DEFINIR";

        ctx.fillStyle = candNome ? "#0c2c62" : "#94a3b8";

        // Auto-scaling inteligente de fonte (de 32px até 16px)
        let fontSizeNome = 32;
        ctx.font = `900 ${fontSizeNome}px "Outfit", sans-serif`;
        let textMetrics = ctx.measureText(displayNome).width;

        while (textMetrics > maxTextW && fontSizeNome > 17) {
          fontSizeNome -= 1;
          ctx.font = `900 ${fontSizeNome}px "Outfit", sans-serif`;
          textMetrics = ctx.measureText(displayNome).width;
        }

        // Se ainda assim for muito longo (ex: nomes com mais de 20 caracteres), quebra em 2 linhas
        if (textMetrics > maxTextW && displayNome.includes(" ")) {
          const partes = displayNome.split(" ");
          const meio = Math.ceil(partes.length / 2);
          const l1 = partes.slice(0, meio).join(" ");
          const l2 = partes.slice(meio).join(" ");

          fontSizeNome = 20;
          ctx.font = `900 ${fontSizeNome}px "Outfit", sans-serif`;
          while ((ctx.measureText(l1).width > maxTextW || ctx.measureText(l2).width > maxTextW) && fontSizeNome > 13) {
            fontSizeNome -= 1;
            ctx.font = `900 ${fontSizeNome}px "Outfit", sans-serif`;
          }

          ctx.fillText(l1, infoX, y + 16);
          ctx.fillText(l2, infoX, y + 42);
        } else {
          ctx.fillText(displayNome, infoX, y + 28);
        }

        let cargoTitle = cfg.cargo.toUpperCase();
        if (cfg.id === "sen1") cargoTitle = "SENADOR (1ª VAGA)";
        else if (cfg.id === "sen2") cargoTitle = "SENADOR (2ª VAGA)";

        ctx.fillStyle = "#64748b";
        ctx.font = '800 19px "Outfit", sans-serif';
        ctx.fillText(cargoTitle, infoX, y + 74);
      }

      for (let d = 0; d < cfg.digitos; d++) {
        const bx = boxesStartX + d * (boxW + boxGap);
        const val = digitsArr[d] !== undefined ? digitsArr[d] : "";

        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(bx, boxY, boxW, boxH, 8);
        ctx.fill();
        ctx.stroke();

        if (val) {
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#000000";
          ctx.font = cfg.digitos === 5 ? '950 44px "Outfit", sans-serif' : '950 48px "Outfit", sans-serif';
          ctx.fillText(val, bx + boxW / 2, boxY + boxH / 2 + 2);
        }
      }
    }

    // 4. RODAPÉ CÍVICO ELEIÇÕES 2026 COM LINHAS CÍVICAS
    const footerY = H - 75;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#0c2c62";
    ctx.font = '800 20px "Outfit", sans-serif';
    ctx.fillText("ELEIÇÕES 2026", rightX, footerY);

    // Listras Cívicas do Rodapé
    const stripeW = 16;
    const stripeH = 6;
    const stripeStartX = rightX + 160;
    ctx.fillStyle = "#15803d";
    ctx.fillRect(stripeStartX, footerY - 3, stripeW, stripeH);
    ctx.fillStyle = "#eab308";
    ctx.fillRect(stripeStartX + stripeW + 6, footerY - 3, stripeW, stripeH);
    ctx.fillStyle = "#0284c7";
    ctx.fillRect(stripeStartX + (stripeW + 6) * 2, footerY - 3, stripeW, stripeH);

    ctx.textAlign = "right";
    ctx.fillStyle = "#0c2c62";
    ctx.font = '800 20px "Outfit", sans-serif';
    ctx.fillText("DEMOCRACIA SEMPRE", rightX + rightW, footerY);

    return canvas;
  }

  // ---------- Salvar Imagem na Galeria / Fototeca do Celular ----------
  async function baixarImagemGaleria() {
    showToast("Preparando sua colinha em alta qualidade...");
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
          showToast("✅ Colinha salva nas fotos do seu celular!");
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
      showToast("✅ Colinha baixada! Abra para salvar nas suas fotos.");
    }, "image/jpeg", 0.96);
  }

  // ---------- Compartilhamento no WhatsApp com Engajamento Oficial ----------
  async function compartilharColinha() {
    const canvas = await desenharColinhaCanvas();
    if (!canvas) return;

    // Resumo limpo e elegante dos votos definidos pelo eleitor
    const listaCandidatos = [];
    CARGOS_CONFIG.forEach(c => {
      const cand = colinhaState[c.id];
      if (cand) {
        listaCandidatos.push(`• *${c.cargo}:* ${cand.urna} (${cand.nr})`);
      }
    });

    const resumoVotos = listaCandidatos.length > 0 ? "\n📋 *Minha Colinha Completa:*\n" + listaCandidatos.join("\n") + "\n" : "";

    const eleitorNome = getEleitorNome();

    const tituloEngajamento = eleitorNome
      ? `COLINHA ELEITORAL 2026 DE ${eleitorNome}`
      : "COLINHA ELEITORAL 2026";

    const textoEngajamento = 
      `🗳️ *${tituloEngajamento}*\n\n` +
      `Já organizei meus votos para a urna! 🗳️\n` +
      `Meu Deputado Federal é *MARQUINHOS TRAD 4333* 💚💛\n` +
      resumoVotos +
      `\n👉 *Monte a sua também e leve para a urna sem erro:*\n${window.location.href}`;

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
    // Função central para reiniciar a colinha do zero e voltar à tela inicial de boas-vindas
    function reiniciarColinhaDoZero() {
      colinhaState = {
        depFed: CANDIDATO_MARQUINHOS_4333,
        depEst: null,
        sen1: null,
        sen2: null,
        gov: null,
        pres: null
      };
      setEleitorNome("");
      try {
        sessionStorage.removeItem("santinho_marquinhos_boas_vindas_vista");
        localStorage.removeItem("santinho_marquinhos_boas_vindas_vista");
      } catch (e) {}

      if (inputEleitorNome) {
        inputEleitorNome.value = "";
      }
      if (avisoNome) {
        avisoNome.style.display = "none";
      }

      etapaAtual = 1;
      salvarColinha();
      atualizarProgresso();
      window.scrollTo({ top: 0, behavior: "smooth" });
      showToast("Reiniciado do zero! Digite seu nome para começar.");
      setTimeout(() => {
        if (inputEleitorNome) inputEleitorNome.focus();
      }, 300);
    }

    // Botão Começar de Novo (Topo)
    const btnLimpar = document.getElementById("btn-limpar");
    if (btnLimpar) {
      btnLimpar.addEventListener("click", () => {
        if (confirm("Quer apagar essa colinha e começar uma nova com outro nome?")) {
          reiniciarColinhaDoZero();
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

    // Campo de nome do eleitor: Recupera nome se já informado ou inicia pronto para preencher
    const inputEleitorNome = document.getElementById("input-eleitor-nome");
    const boxInputNome = document.getElementById("box-input-nome");
    const avisoNome = document.getElementById("msg-aviso-nome");
    if (inputEleitorNome) {
      inputEleitorNome.value = getEleitorNome();
    }

    // Botão Começar a Preencher na Tela de Boas-Vindas
    const btnWelcomeStart = document.getElementById("btn-welcome-start");
    if (btnWelcomeStart) {
      btnWelcomeStart.addEventListener("click", () => {
        let nomeDigitado = inputEleitorNome ? inputEleitorNome.value.trim() : "";

        // Sanitização de segurança: remove caracteres de controle e tags html
        nomeDigitado = nomeDigitado.replace(/[<>{}[\]\/\\]/g, "").slice(0, 30).trim();

        // Condição: primeiro nome é necessário para avançar
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

        // Extrai apenas o primeiro nome e sanitiza
        const primeiroNome = escapeHtml(nomeDigitado.split(" ")[0].trim());
        setEleitorNome(primeiroNome);
        if (avisoNome) avisoNome.style.display = "none";

        sessionStorage.setItem("santinho_marquinhos_boas_vindas_vista", "true");
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
        if (confirm("Quer apagar essa colinha e começar uma nova com outro nome?")) {
          reiniciarColinhaDoZero();
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
