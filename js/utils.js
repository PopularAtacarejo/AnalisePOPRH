// ====== CONFIGURAÇÕES GLOBAIS ======
const CONFIG = {
    API_BASE: "https://formulariobk.onrender.com",
    ADMIN_TOKEN: "admin-secret-token",
    ITEMS_PER_PAGE: 10,
    MAX_WAKEUP_ATTEMPTS: 3
};

// ====== ESTADO GLOBAL DA APLICAÇÃO ======
const APP_STATE = {
    currentPage: 1,
    currentFilters: {},
    editingVagaId: null,
    wakeupAttempts: 0,
    currentTab: 'dashboard'
};

// ====== UTILITÁRIOS ======
const Utils = {
    formatarData(dataString) {
        if (!dataString) return 'N/A';
        try {
            const data = new Date(dataString);
            return data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } catch (error) {
            console.error('Erro ao formatar data:', error);
            return 'Data inválida';
        }
    },
    
    formatarNumero(numero) {
        if (numero === undefined || numero === null) return '0';
        return new Intl.NumberFormat('pt-BR').format(numero);
    },
    
    truncarTexto(texto, maxLength = 50) {
        if (!texto) return '';
        if (texto.length <= maxLength) return texto;
        return texto.substring(0, maxLength) + '...';
    },
    
    mostrarLoading(elemento) {
        if (!elemento) {
            console.warn('Elemento não encontrado para mostrar loading');
            return;
        }
        elemento.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem;">
                    <i class="fas fa-spinner fa-spin"></i> Carregando dados...
                </td>
            </tr>
        `;
    },
    
    mostrarErro(elemento, mensagem) {
        if (!elemento) {
            console.warn('Elemento não encontrado para mostrar erro');
            return;
        }
        elemento.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: var(--error-color);">
                    <i class="fas fa-exclamation-triangle"></i> ${mensagem}
                </td>
            </tr>
        `;
    },
    
    validarEmail(email) {
        if (!email) return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    safeForEach(array, callback) {
        if (Array.isArray(array)) {
            array.forEach(callback);
        } else {
            console.warn('Tentativa de iterar sobre não-array:', array);
        }
    },

    formatarCPF(cpf) {
        if (!cpf) return 'N/A';
        cpf = cpf.replace(/\D/g, '');
        if (cpf.length !== 11) return cpf;
        return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    },

    validarRespostaAPI(resposta) {
        return resposta && typeof resposta === 'object' && !resposta.error;
    },

    mostrarNotificacao(mensagem, tipo = 'success') {
        // Criar elemento de notificação
        const notificacao = document.createElement('div');
        notificacao.className = `notification ${tipo}`;
        notificacao.innerHTML = `
            <i class="fas fa-${tipo === 'success' ? 'check' : tipo === 'error' ? 'exclamation-triangle' : 'info'}-circle"></i>
            <span>${mensagem}</span>
        `;

        // Adicionar ao corpo
        document.body.appendChild(notificacao);

        // Remover após 5 segundos
        setTimeout(() => {
            if (notificacao.parentNode) {
                notificacao.parentNode.removeChild(notificacao);
            }
        }, 5000);
    },

    // Função para verificar se o servidor está respondendo
    async verificarServidor() {
        try {
            const response = await this.fetchWithTimeout(`${CONFIG.API_BASE}/health`, {}, 10000);
            return response.ok;
        } catch (error) {
            console.warn('Servidor não está respondendo:', error);
            return false;
        }
    },

    // Fetch com timeout
    async fetchWithTimeout(url, options = {}, timeout = 30000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'User-Agent': 'PainelAdmin/1.0',
                    ...options.headers
                }
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
};

// ====== GERENCIAMENTO DE API ======
const API = {
    async call(endpoint, options = {}) {
        try {
            const response = await Utils.fetchWithTimeout(`${CONFIG.API_BASE}${endpoint}`, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${CONFIG.ADMIN_TOKEN}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ${response.status}: ${errorText || response.statusText}`);
            }

            return response.json();
        } catch (error) {
            console.error('Erro na chamada da API:', error);
            
            // Se for erro de rede, tentar acordar o servidor
            if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
                await this.tentarAcordarServidor();
                // Tentar a requisição novamente após wakeup
                return this.call(endpoint, options);
            }
            
            throw error;
        }
    },

    async tentarAcordarServidor() {
        if (APP_STATE.wakeupAttempts >= CONFIG.MAX_WAKEUP_ATTEMPTS) {
            throw new Error(`Servidor não respondeu após ${CONFIG.MAX_WAKEUP_ATTEMPTS} tentativas`);
        }

        APP_STATE.wakeupAttempts++;
        console.log(`Tentativa ${APP_STATE.wakeupAttempts} de acordar o servidor...`);

        try {
            // Tentar endpoint de wakeup
            await Utils.fetchWithTimeout(`${CONFIG.API_BASE}/wakeup`, {}, 15000);
            
            // Aguardar um pouco para o servidor inicializar
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Verificar se o servidor está respondendo
            const healthOk = await Utils.verificarServidor();
            if (healthOk) {
                APP_STATE.wakeupAttempts = 0;
                return true;
            }
        } catch (error) {
            console.warn('Falha ao acordar servidor:', error);
        }

        return false;
    }
};

// ====== GERENCIAMENTO DE TEMAS ======
const ThemeManager = {
    init() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', this.toggleTheme);
        }
        
        // Carregar tema salvo
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
    },
    
    toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        ThemeManager.setTheme(newTheme);
    },
    
    setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        const icon = document.querySelector('#themeToggle i');
        
        if (icon) {
            if (theme === 'dark') {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            } else {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
            }
        }
        
        localStorage.setItem('theme', theme);
        
        // Disparar evento personalizado para que outros componentes saibam que o tema mudou
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
    }
};

// ====== GERENCIAMENTO DE MODAIS ======
const ModalManager = {
    init() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Fechar modais
        const closeModal = document.getElementById('close-modal');
        const closeVagaModal = document.getElementById('close-vaga-modal');
        const closeDistanciaModal = document.getElementById('close-distancia-modal');

        if (closeModal) closeModal.addEventListener('click', () => this.hide('candidato'));
        if (closeVagaModal) closeVagaModal.addEventListener('click', () => this.hide('vaga'));
        if (closeDistanciaModal) closeDistanciaModal.addEventListener('click', () => this.hide('distancia'));

        // Fechar modais ao clicar fora
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    const modalId = modal.id.replace('-modal', '');
                    this.hide(modalId);
                }
            });
        });

        // Fechar modais com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAll();
            }
        });
    },

    show(modalName) {
        const modal = document.getElementById(`${modalName}-modal`);
        if (modal) {
            modal.style.display = 'flex';
            // Focar no primeiro elemento interativo do modal
            const focusElement = modal.querySelector('button, input, select');
            if (focusElement) focusElement.focus();
        }
    },

    hide(modalName) {
        const modal = document.getElementById(`${modalName}-modal`);
        if (modal) {
            modal.style.display = 'none';
        }
    },

    hideAll() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }
};

// ====== GERENCIAMENTO DE ABAS ======
const TabManager = {
    init() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = tab.getAttribute('data-tab');
                this.switchTab(tabId);
            });
        });
    },

    switchTab(tabId) {
        // Atualizar estado
        APP_STATE.currentTab = tabId;

        // Atualizar UI das abas
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Ativar aba e conteúdo selecionados
        const selectedTab = document.querySelector(`[data-tab="${tabId}"]`);
        const selectedContent = document.getElementById(tabId);

        if (selectedTab) selectedTab.classList.add('active');
        if (selectedContent) selectedContent.classList.add('active');

        // Atualizar título da página
        this.updatePageTitle(tabId);

        // Carregar conteúdo da aba
        this.loadTabContent(tabId);
    },

    updatePageTitle(tabId) {
        const pageTitle = document.getElementById('page-title');
        if (!pageTitle) return;

        const titles = {
            'dashboard': 'Dashboard de Candidaturas',
            'curriculos': 'Análise de Currículos - Mercado Arapiraca',
            'vagas': 'Gerenciamento de Vagas - Mercado Arapiraca'
        };

        pageTitle.textContent = titles[tabId] || 'Painel Administrativo';
    },

    loadTabContent(tabId) {
        switch(tabId) {
            case 'dashboard':
                if (typeof Dashboard !== 'undefined') Dashboard.load();
                break;
            case 'curriculos':
                if (typeof Curriculos !== 'undefined') Curriculos.load();
                break;
            case 'vagas':
                if (typeof Vagas !== 'undefined') Vagas.load();
                break;
        }
    }
};

// ====== INICIALIZAÇÃO DA APLICAÇÃO ======
const App = {
    async init() {
        try {
            // Inicializar gerenciadores
            ThemeManager.init();
            ModalManager.init();
            TabManager.init();

            // Verificar se o servidor está online
            const servidorOnline = await Utils.verificarServidor();
            if (!servidorOnline) {
                Utils.mostrarNotificacao('Servidor offline. Algumas funcionalidades podem não estar disponíveis.', 'warning');
            }

            // Carregar conteúdo inicial
            TabManager.loadTabContent('dashboard');

            console.log('Aplicação inicializada com sucesso');
        } catch (error) {
            console.error('Erro ao inicializar aplicação:', error);
            Utils.mostrarNotificacao('Erro ao inicializar aplicação', 'error');
        }
    }
};

// ====== EXPORTAÇÕES PARA USO GLOBAL ======
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG,
        APP_STATE,
        Utils,
        API,
        ThemeManager,
        ModalManager,
        TabManager,
        App
    };
}
