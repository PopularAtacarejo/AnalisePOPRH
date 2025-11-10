// Gerenciamento de Currículos
const Curriculos = {
    async load(page = 1) {
        try {
            APP_STATE.currentPage = page;
            Utils.mostrarLoading(document.getElementById('corpo-tabela'));
            
            const params = new URLSearchParams({
                page: page,
                limit: CONFIG.ITEMS_PER_PAGE,
                ...APP_STATE.currentFilters
            });

            const data = await API.call(`/api/admin/candidaturas?${params}`);
            this.displayCurriculos(data.candidaturas);
            this.setupPagination(data.total, data.page, data.totalPages);
            
            if (page === 1) {
                await this.loadFiltros();
            }

        } catch (error) {
            console.error('Erro ao carregar currículos:', error);
            Utils.mostrarErro(document.getElementById('corpo-tabela'), 'Erro ao carregar currículos: ' + error.message);
        }
    },

    async loadFiltros() {
        try {
            const filtros = await API.call('/api/admin/filtros');
            
            // CORREÇÃO: Verificar se os dados existem antes de usar forEach
            const filterVaga = document.getElementById('filter-vaga');
            const filterCidade = document.getElementById('filter-cidade');
            
            // Limpar options existentes, mantendo apenas a primeira opção
            while (filterVaga.children.length > 1) filterVaga.removeChild(filterVaga.lastChild);
            while (filterCidade.children.length > 1) filterCidade.removeChild(filterCidade.lastChild);

            // Preencher filtro de vagas com verificação de segurança
            if (filtros && Array.isArray(filtros.vagas)) {
                filtros.vagas.forEach(vaga => {
                    if (vaga && vaga.trim() !== '') {
                        const option = new Option(vaga, vaga);
                        filterVaga.add(option);
                    }
                });
            } else {
                console.warn('Dados de vagas não disponíveis ou formato inválido');
            }

            // Preencher filtro de cidades com verificação de segurança
            if (filtros && Array.isArray(filtros.cidades)) {
                filtros.cidades.forEach(cidade => {
                    if (cidade && cidade.trim() !== '') {
                        const option = new Option(cidade, cidade);
                        filterCidade.add(option);
                    }
                });
            } else {
                console.warn('Dados de cidades não disponíveis ou formato inválido');
            }

        } catch (error) {
            console.error('Erro ao carregar filtros:', error);
            // Não interrompe o funcionamento da página se os filtros falharem
        }
    },

    displayCurriculos(curriculos) {
        const corpoTabela = document.getElementById('corpo-tabela');
        
        if (!curriculos || curriculos.length === 0) {
            corpoTabela.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: var(--legend-text);">
                        <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhuma candidatura encontrada com os filtros aplicados.
                    </td>
                </tr>
            `;
            return;
        }

        corpoTabela.innerHTML = curriculos.map(curriculo => `
            <tr>
                <td><strong>${curriculo.nome || 'N/A'}</strong></td>
                <td>${curriculo.vaga || 'N/A'}</td>
                <td>${curriculo.cidade || 'N/A'}</td>
                <td>${curriculo.bairro || 'N/A'}</td>
                <td><span class="badge ${curriculo.transporte === 'Sim' ? 'badge-success' : 'badge-warning'}">${curriculo.transporte || 'N/A'}</span></td>
                <td>${Utils.formatarData(curriculo.enviado_em)}</td>
                <td>
                    <button class="action-btn view" onclick="Curriculos.visualizarCandidato(${curriculo.id})" title="Ver detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn distance" onclick="Curriculos.calcularDistanciaCandidato(${curriculo.id})" title="Calcular distância">
                        <i class="fas fa-route"></i>
                    </button>
                    <button class="action-btn delete" onclick="Curriculos.excluirCandidatura(${curriculo.id})" title="Excluir candidatura">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    setupPagination(total, currentPage, totalPages) {
        const pagination = document.getElementById('pagination');
        const paginationInfo = document.getElementById('pagination-info');
        
        paginationInfo.textContent = `Mostrando ${Utils.formatarNumero(total)} registros`;
        
        if (!totalPages || totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let html = '';
        
        // Botão anterior
        html += `<button class="btn btn-secondary" ${currentPage === 1 ? 'disabled' : ''} onclick="Curriculos.load(${currentPage - 1})">
            <i class="fas fa-chevron-left"></i> Anterior
        </button>`;
        
        // Páginas
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                html += `<button class="btn ${i === currentPage ? 'btn-primary' : 'btn-secondary'}" onclick="Curriculos.load(${i})">${i}</button>`;
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                html += `<span style="padding: 0.8rem 1rem;">...</span>`;
            }
        }
        
        // Botão próximo
        html += `<button class="btn btn-secondary" ${currentPage === totalPages ? 'disabled' : ''} onclick="Curriculos.load(${currentPage + 1})">
            Próximo <i class="fas fa-chevron-right"></i>
        </button>`;
        
        pagination.innerHTML = html;
    },

    async visualizarCandidato(id) {
        try {
            const candidato = await API.call(`/api/admin/candidaturas/${id}`);
            Modals.showCandidato(candidato);
        } catch (error) {
            console.error('Erro ao carregar candidato:', error);
            alert('Erro ao carregar informações do candidato: ' + error.message);
        }
    },

    async calcularDistanciaCandidato(id) {
        try {
            const candidato = await API.call(`/api/admin/candidaturas/${id}`);
            if (!candidato.rua || !candidato.bairro || !candidato.cidade) {
                alert('Endereço do candidato incompleto para cálculo de distância.');
                return;
            }
            
            const enderecoCandidato = `${candidato.rua}, ${candidato.bairro}, ${candidato.cidade}`;
            
            const resultado = await API.call('/api/admin/calcular-distancia', {
                method: 'POST',
                body: JSON.stringify({
                    enderecoCandidato: enderecoCandidato
                })
            });

            Modals.showDistancia(candidato, resultado);
        } catch (error) {
            console.error('Erro ao calcular distância:', error);
            alert('Erro ao calcular distância: ' + error.message);
        }
    },

    async excluirCandidatura(id) {
        if (!confirm('Tem certeza que deseja excluir esta candidatura? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            await API.call(`/api/admin/candidaturas/${id}`, { method: 'DELETE' });
            alert('Candidatura excluída com sucesso.');
            this.load(APP_STATE.currentPage);
        } catch (error) {
            console.error('Erro ao excluir candidatura:', error);
            alert('Erro ao excluir candidatura: ' + error.message);
        }
    },

    aplicarFiltros() {
        APP_STATE.currentFilters = {
            vaga: document.getElementById('filter-vaga').value !== 'todas' ? document.getElementById('filter-vaga').value : undefined,
            cidade: document.getElementById('filter-cidade').value !== 'todas' ? document.getElementById('filter-cidade').value : undefined,
            transporte: document.getElementById('filter-transporte').value !== 'todos' ? document.getElementById('filter-transporte').value : undefined,
            search: document.getElementById('filter-search').value || undefined
        };
        
        // Remover valores undefined
        Object.keys(APP_STATE.currentFilters).forEach(key => {
            if (APP_STATE.currentFilters[key] === undefined) {
                delete APP_STATE.currentFilters[key];
            }
        });
        
        this.load(1);
    },

    limparFiltros() {
        document.getElementById('filter-vaga').value = 'todas';
        document.getElementById('filter-cidade').value = 'todas';
        document.getElementById('filter-transporte').value = 'todos';
        document.getElementById('filter-periodo').value = 'todos';
        document.getElementById('filter-distancia').value = 'todas';
        document.getElementById('filter-search').value = '';
        
        APP_STATE.currentFilters = {};
        this.load(1);
    }
};

// Event listeners para filtros
document.addEventListener('DOMContentLoaded', () => {
    const aplicarFiltrosBtn = document.getElementById('aplicar-filtros');
    const limparFiltrosBtn = document.getElementById('limpar-filtros');
    
    if (aplicarFiltrosBtn) {
        aplicarFiltrosBtn.addEventListener('click', () => {
            Curriculos.aplicarFiltros();
        });
    }
    
    if (limparFiltrosBtn) {
        limparFiltrosBtn.addEventListener('click', () => {
            Curriculos.limparFiltros();
        });
    }
});
