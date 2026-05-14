import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "../components/ui/Button/Button";
import type { CreateStepData, ProductionStep } from "../types/step";
import "./StepModal.css";

interface StepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (stepData: CreateStepData) => Promise<void>;
  stepToEdit?: ProductionStep | null;
  isLoading?: boolean;
}

export const StepModal: React.FC<StepModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  stepToEdit,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<CreateStepData>({
    name: "",
    description: "",
    order: 0,
  });

  useEffect(() => {
    if (stepToEdit) {
      setFormData({
        name: stepToEdit.name,
        description: stepToEdit.description,
        order: stepToEdit.order,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        order: 0,
      });
    }
  }, [stepToEdit, isOpen]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "order" ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.description.trim()) {
      alert("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    try {
      await onSubmit(formData);
      setFormData({
        name: "",
        description: "",
        order: 0,
      });
      onClose();
    } catch (error) {
      console.error("Erro ao salvar etapa:", error);
    }
  };

  const handleClose = () => {
    setFormData({
      name: "",
      description: "",
      order: 0,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="step-modal-overlay" onClick={handleClose}>
      <div className="step-modal" onClick={(e) => e.stopPropagation()}>
        <div className="step-modal-header">
          <div className="step-modal-title-section">
            <h2 className="step-modal-title">
              {stepToEdit ? "Editar Etapa" : "Nova Etapa"}
            </h2>
            <p className="step-modal-subtitle">
              {stepToEdit
                ? "Atualize as informações da etapa"
                : "Configure uma etapa do processo produtivo"}
            </p>
          </div>
          <button className="step-modal-close" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <form className="step-modal-form" onSubmit={handleSubmit}>
          <div className="step-modal-field">
            <label className="step-modal-label" htmlFor="name">
              Nome da Etapa
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Ex: Corte, Costura, Silk..."
              className="step-modal-input"
              required
            />
          </div>

          <div className="step-modal-field">
            <label className="step-modal-label" htmlFor="description">
              Descrição
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Descreva o que é feito nesta etapa"
              className="step-modal-textarea"
              rows={4}
              required
            />
          </div>

          <div className="step-modal-field">
            <label className="step-modal-label" htmlFor="order">
              Ordem de Execução
            </label>
            <input
              id="order"
              name="order"
              type="number"
              min="0"
              value={formData.order}
              onChange={handleInputChange}
              className="step-modal-input"
              required
            />
          </div>

          <div className="step-modal-actions">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              disabled={!formData.name.trim() || !formData.description.trim()}
            >
              {stepToEdit ? "Salvar Alterações" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
