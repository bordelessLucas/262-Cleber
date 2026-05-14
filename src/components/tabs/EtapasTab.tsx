import React, { useState, useEffect, useCallback } from "react";
import { Plus, Edit, Trash2, Check } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { stepService } from "../../services/stepService";
import { StepModal } from "../../steps/StepModal";
import type { ProductionStep, CreateStepData } from "../../types/step";
import toast from "react-hot-toast";
import { DeleteConfirmModal } from "../../components/ui/DeleteConfirmModal/DeleteConfirmModal";
import "./EtapasTab.css";

export const EtapasTab: React.FC = () => {
  const { user } = useAuth();
  const [steps, setSteps] = useState<ProductionStep[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stepToEdit, setStepToEdit] = useState<ProductionStep | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSteps, setIsLoadingSteps] = useState(true);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadSteps = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoadingSteps(true);
      const userSteps = await stepService.getStepsByUser(user.uid);
      setSteps(userSteps);
    } catch (error) {
      console.error("Erro ao carregar etapas:", error);
    } finally {
      setIsLoadingSteps(false);
    }
  }, [user]);

  useEffect(() => {
    loadSteps();
  }, [loadSteps]);

  const handleCreateStep = async (stepData: CreateStepData) => {
    if (!user) return;

    try {
      setIsLoading(true);

      if (stepToEdit) {
        // Editar etapa existente
        await stepService.updateStep(stepToEdit.id, stepData);
        toast.success("Etapa atualizada com sucesso!", {
          icon: <Check size={20} />,
        });
      } else {
        // Criar nova etapa
        await stepService.createStep(user.uid, stepData);
        toast.success("Etapa criada com sucesso!", {
          icon: <Check size={20} />,
        });
      }

      await loadSteps(); // Recarregar a lista
      setStepToEdit(null); // Limpar etapa em edição
    } catch (error) {
      console.error("Erro ao salvar etapa:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erro ao salvar etapa. Tente novamente.";
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditStep = (step: ProductionStep) => {
    setStepToEdit(step);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setStepToEdit(null);
  };

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      setIsDeleting(true);
      await stepService.deleteStep(itemToDelete);
      await loadSteps();
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      toast.success("Etapa excluída com sucesso!", {
        icon: <Check size={20} />,
      });
    } catch (error) {
      console.error("Erro ao deletar etapa:", error);
      toast.error("Erro ao deletar etapa. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2 className="tab-title">Etapas de Produção</h2>
        <p className="tab-subtitle">
          Configure as etapas do processo produtivo
        </p>
      </div>
      <div className="tab-body">
        <div className="etapas-container">
          <div className="etapas-header">
            <div className="etapas-title-section">
              <h3 className="etapas-title">Etapas de Produção</h3>
              <p className="etapas-subtitle">
                Configure as etapas do processo produtivo
              </p>
            </div>
            <button
              className="etapas-add-button"
              onClick={() => {
                setStepToEdit(null);
                setIsModalOpen(true);
              }}
            >
              <Plus className="etapas-add-icon" size={16} />
              <span className="etapas-add-text">Nova Etapa</span>
            </button>
          </div>

          <div className="etapas-content">
            {isLoadingSteps ? (
              <div className="etapas-loading">
                <p>Carregando etapas...</p>
              </div>
            ) : steps.length === 0 ? (
              <div className="etapas-empty">
                <p>Nenhuma etapa cadastrada</p>
                <p className="etapas-empty-subtitle">
                  Clique no botão "Nova Etapa" para adicionar uma etapa
                </p>
              </div>
            ) : (
              <div className="etapas-table-container">
                <table className="etapas-table">
                  <thead>
                    <tr>
                      <th>Ordem</th>
                      <th>Nome</th>
                      <th>Descrição</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {steps.map((step) => (
                      <tr key={step.id}>
                        <td className="etapas-order">{step.order}</td>
                        <td className="etapas-name">{step.name}</td>
                        <td className="etapas-description">
                          {step.description}
                        </td>
                        <td className="etapas-actions">
                          <button
                            className="etapas-action etapas-edit"
                            onClick={() => handleEditStep(step)}
                            title="Editar etapa"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="etapas-action etapas-delete"
                            onClick={() => handleDeleteClick(step.id)}
                            title="Excluir etapa"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <StepModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleCreateStep}
        stepToEdit={stepToEdit}
        isLoading={isLoading}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        itemName={steps.find((s) => s.id === itemToDelete)?.name || ""}
        loading={isDeleting}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir esta etapa?"
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </div>
  );
};
