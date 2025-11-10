// Gerenciamento de Vagas
const Vagas = {
    async load() {
        try {
            const vagas = await API.call('/api/admin/vagas');
            this.displayVagas(vagas);
        } catch (error) {
            console.error('Erro ao carregar vagas:', error);
            this.showError('Erro ao carregar vagas: ' + error.message);
        }
    },

    displayVagas(vagas) {
        const tabela = document.getElementById('tabela-vagas');

        if (vagas.length === 0) {
            tabela.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 2rem; color: var(--legend-text);">
                        <i class="fas fa-list" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhuma vaga cadastrada.
                    </td>
                </tr>
            `;
            return;
        }

        tabela.innerHTML = vagas.map(vaga => `
            <tr>
                <td><strong>${vaga.nome}</strong></td>
                <td>
                    <span class="badge ${vaga.ativa ? 'badge-success' : 'badge-warning'}">
                        ${vaga.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                </td>
                <td>-</td>
                <td>
                    <button class="action-btn edit" onclick="Vagas.editarVaga(${vaga.id}, '${vaga.nome.replace(/'/g, "\\'")}', ${vaga.ativa})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="Vagas.excluirVaga(${vaga.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    showError(message) {
        const tabela = document.getElementById('tabela-vagas');
        tabela.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 2rem; color: var(--error-color);">
                    <i class="fas fa-exclamation-triangle"></i> ${message}
                </td>
            </tr>
        `;
    },

    novaVaga() {
        APP_STATE.editingVagaId = null;
        document.getElementById('vaga-modal-title').textContent = 'Nova Vaga';
        document.getElementById('vaga-nome').value = '';
        document.getElementById('vaga-status').value = 'true';
        Modals.showVaga();
    },

    editarVaga(id, nome, ativa) {
        APP_STATE.editingVagaId = id;
        document.getElementById('vaga-modal-title').textContent = 'Editar Vaga';
        document.getElementById('vaga-nome').value = nome;
        document.getElementById('vaga-status').value = ativa.toString();
        Modals.showVaga();
    },

    async salvarVaga() {
        const nome = document.getElementById('vaga-nome').value;
        const ativa = document.getElementById('vaga-status').value === 'true';

        if (!nome) {
            alert('Nome da vaga é obrigatório.');
            return;
        }

        try {
            if (APP_STATE.editingVagaId) {
                await API.call(`/api/admin/vagas/${APP_STATE.editingVagaId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ nome, ativa })
                });
            } else {
                await API.call('/api/admin/vagas', {
                    method: 'POST',
                    body: JSON.stringify({ nome, ativa })
                });
            }

            Modals.hideVaga();
            this.load();
            alert('Vaga salva com sucesso!');

        } catch (error) {
            console.error('Erro ao salvar vaga:', error);
            alert('Erro ao salvar vaga: ' + error.message);
        }
    },

    async excluirVaga(id) {
        if (!confirm('Tem certeza que deseja excluir esta vaga? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            await API.call(`/api/admin/vagas/${id}`, { method: 'DELETE' });
            alert('Vaga excluída com sucesso.');
            this.load();
        } catch (error) {
            console.error('Erro ao excluir vaga:', error);
            alert('Erro ao excluir vaga: ' + error.message);
        }
    }
};

// Event listeners para vagas
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('add-vaga-btn').addEventListener('click', () => {
        Vagas.novaVaga();
    });

    document.getElementById('salvar-vaga-btn').addEventListener('click', () => {
        Vagas.salvarVaga();
    });
});
