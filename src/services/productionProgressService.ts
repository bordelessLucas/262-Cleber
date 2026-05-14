import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebaseconfig";
import { removeUndefinedFields } from "../utils/firestoreHelpers";
import { formatDateToISO } from "../utils/dateFormatter";
import { parseFirebaseDate } from "../utils/parseFirebaseDate";
import type {
  ProductionOrderProgress,
  UpdateStageProgressPayload,
  StageProgress,
  ProductionProgressStatus,
} from "../types/productionProgress";
import type { ProductionStep } from "../types/step";

const COLLECTION = "producaoProgresso";

export const productionProgressService = {
  async getProgressByOrderId(
    ordemProducaoId: string
  ): Promise<ProductionOrderProgress | null> {
    const q = query(
      collection(db, COLLECTION),
      where("ordemProducaoId", "==", ordemProducaoId)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const docRef = snapshot.docs[0];
    const data = docRef.data();
    return {
      id: docRef.id,
      ordemProducaoId: data.ordemProducaoId,
      etapas: data.etapas ?? [],
      createdAt: parseFirebaseDate(data.createdAt) || new Date(),
      updatedAt: parseFirebaseDate(data.updatedAt) || new Date(),
      userId: data.userId,
    };
  },

  async getAllProgress(userId: string): Promise<ProductionOrderProgress[]> {
    const q = query(
      collection(db, COLLECTION),
      where("userId", "==", userId),
      orderBy("updatedAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docRef) => {
      const data = docRef.data();
      return {
        id: docRef.id,
        ordemProducaoId: data.ordemProducaoId,
        etapas: data.etapas ?? [],
        createdAt: parseFirebaseDate(data.createdAt) || new Date(),
        updatedAt: parseFirebaseDate(data.updatedAt) || new Date(),
        userId: data.userId,
      };
    });
  },

  async initializeProgress(
    userId: string,
    ordemProducaoId: string,
    steps: ProductionStep[]
  ): Promise<void> {
    // Verificar se já existe progresso para esta ordem
    const existing = await this.getProgressByOrderId(ordemProducaoId);
    if (existing) return;

    // Criar progresso inicial com todas as etapas
    const etapas: StageProgress[] = steps
      .sort((a, b) => a.order - b.order)
      .map((step, index) => {
        const etapa: StageProgress = {
          etapaId: step.id,
          etapaNome: step.name,
          ordem: step.order,
          finalizadas: 0,
          defeituosas: 0,
          status: (index === 0
            ? "em_andamento"
            : "pausada") as ProductionProgressStatus,
        };

        // Adicionar dataInicio apenas para a primeira etapa
        if (index === 0) {
          etapa.dataInicio = formatDateToISO(new Date());
        }

        return etapa;
      });

    // Limpar campos undefined das etapas antes de salvar
    const etapasLimpas = etapas.map((etapa) => removeUndefinedFields(etapa));

    await addDoc(collection(db, COLLECTION), {
      ordemProducaoId,
      etapas: etapasLimpas,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  async updateStageProgress(
    progressId: string,
    payload: UpdateStageProgressPayload
  ): Promise<void> {
    const progressRef = doc(db, COLLECTION, progressId);

    // Buscar o documento atual para obter as etapas
    const progressDoc = await getDoc(progressRef);

    if (!progressDoc.exists()) {
      throw new Error("Progresso não encontrado");
    }

    const data = progressDoc.data();
    const etapas: StageProgress[] = data.etapas ?? [];

    const etapaIndex = etapas.findIndex((e) => e.etapaId === payload.etapaId);

    if (etapaIndex === -1) {
      throw new Error("Etapa não encontrada no progresso");
    }

    // Atualizar a etapa (removendo campos undefined do payload)
    const etapaAtual = etapas[etapaIndex];
    const payloadLimpo: Partial<StageProgress> = {};

    if (payload.finalizadas !== undefined)
      payloadLimpo.finalizadas = payload.finalizadas;
    if (payload.defeituosas !== undefined)
      payloadLimpo.defeituosas = payload.defeituosas;
    if (payload.responsavelId !== undefined)
      payloadLimpo.responsavelId = payload.responsavelId;
    if (payload.status !== undefined) payloadLimpo.status = payload.status;
    if (payload.dataFim !== undefined) payloadLimpo.dataFim = payload.dataFim;

    etapas[etapaIndex] = {
      etapaId: etapaAtual.etapaId,
      etapaNome: etapaAtual.etapaNome,
      ordem: etapaAtual.ordem,
      finalizadas: payloadLimpo.finalizadas ?? etapaAtual.finalizadas ?? 0,
      defeituosas: payloadLimpo.defeituosas ?? etapaAtual.defeituosas ?? 0,
      status: payloadLimpo.status ?? etapaAtual.status,
      ...payloadLimpo,
    };

    // Manter campos opcionais existentes
    if (etapaAtual.responsavelId)
      etapas[etapaIndex].responsavelId = etapaAtual.responsavelId;
    if (etapaAtual.responsavelNome)
      etapas[etapaIndex].responsavelNome = etapaAtual.responsavelNome;
    if (etapaAtual.dataInicio)
      etapas[etapaIndex].dataInicio = etapaAtual.dataInicio;
    if (etapaAtual.observacoes && etapaAtual.observacoes.length > 0) {
      etapas[etapaIndex].observacoes = etapaAtual.observacoes;
    }

    // Limpar campos undefined antes de salvar
    const etapasLimpas = etapas.map((etapa) => removeUndefinedFields(etapa));

    await updateDoc(progressRef, {
      etapas: etapasLimpas,
      updatedAt: serverTimestamp(),
    });
  },

  async finalizeStage(
    progressId: string,
    etapaId: string,
    finalizadas: number,
    defeituosas: number = 0
  ): Promise<void> {
    await this.updateStageProgress(progressId, {
      etapaId,
      finalizadas,
      defeituosas,
      status: "finalizada",
      dataFim: formatDateToISO(new Date()),
    });
  },

  async pauseStage(progressId: string, etapaId: string): Promise<void> {
    await this.updateStageProgress(progressId, {
      etapaId,
      status: "pausada",
    });
  },

  async resumeStage(progressId: string, etapaId: string): Promise<void> {
    await this.updateStageProgress(progressId, {
      etapaId,
      status: "em_andamento",
    });
  },

  async finalizeStageWithDetails(
    progressId: string,
    etapaId: string,
    finalizadas: number,
    defeituosas: number,
    observacoes?: string
  ): Promise<void> {
    try {
      const progressRef = doc(db, COLLECTION, progressId);
      const progressDoc = await getDoc(progressRef);

      if (!progressDoc.exists()) {
        throw new Error("Progresso não encontrado");
      }

      const data = progressDoc.data();
      const etapas = data.etapas || [];

      const updatedEtapas = etapas.map((etapa: StageProgress) => {
        if (etapa.etapaId === etapaId) {
          const etapaAtualizada: StageProgress = {
            etapaId: etapa.etapaId,
            etapaNome: etapa.etapaNome,
            ordem: etapa.ordem,
            finalizadas,
            defeituosas,
            status: "finalizada",
            dataFim: formatDateToISO(new Date()),
          };

          // Adicionar campos opcionais apenas se existirem
          if (etapa.responsavelId)
            etapaAtualizada.responsavelId = etapa.responsavelId;
          if (etapa.responsavelNome)
            etapaAtualizada.responsavelNome = etapa.responsavelNome;
          if (etapa.dataInicio) etapaAtualizada.dataInicio = etapa.dataInicio;
          if (observacoes) {
            etapaAtualizada.observacoes = [observacoes];
          } else if (etapa.observacoes && etapa.observacoes.length > 0) {
            etapaAtualizada.observacoes = etapa.observacoes;
          }

          return etapaAtualizada;
        }
        // Limpar campos undefined das outras etapas
        const etapaLimpa: StageProgress = {
          etapaId: etapa.etapaId,
          etapaNome: etapa.etapaNome,
          ordem: etapa.ordem,
          finalizadas: etapa.finalizadas || 0,
          defeituosas: etapa.defeituosas || 0,
          status: etapa.status,
        };
        if (etapa.responsavelId) etapaLimpa.responsavelId = etapa.responsavelId;
        if (etapa.responsavelNome)
          etapaLimpa.responsavelNome = etapa.responsavelNome;
        if (etapa.dataInicio) etapaLimpa.dataInicio = etapa.dataInicio;
        if (etapa.dataFim) etapaLimpa.dataFim = etapa.dataFim;
        if (etapa.observacoes && etapa.observacoes.length > 0) {
          etapaLimpa.observacoes = etapa.observacoes;
        }
        return etapaLimpa;
      });

      // Limpar campos undefined antes de salvar
      const etapasLimpas = updatedEtapas.map((etapa: StageProgress) =>
        removeUndefinedFields(etapa)
      );

      await updateDoc(progressRef, {
        etapas: etapasLimpas,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Erro ao finalizar etapa:", error);
      throw error;
    }
  },

  async startNextStage(
    progressId: string,
    etapaId: string,
    responsavelId: string,
    responsavelNome: string
  ): Promise<void> {
    try {
      const progressRef = doc(db, COLLECTION, progressId);
      const progressDoc = await getDoc(progressRef);

      if (!progressDoc.exists()) {
        throw new Error("Progresso não encontrado");
      }

      const data = progressDoc.data();
      const etapas = data.etapas || [];

      const updatedEtapas = etapas.map((etapa: StageProgress) => {
        if (etapa.etapaId === etapaId) {
          const etapaAtualizada: StageProgress = {
            etapaId: etapa.etapaId,
            etapaNome: etapa.etapaNome,
            ordem: etapa.ordem,
            status: "em_andamento",
            responsavelId,
            responsavelNome,
            dataInicio: formatDateToISO(new Date()),
            finalizadas: 0,
            defeituosas: 0,
          };
          return etapaAtualizada;
        }
        // Limpar campos undefined das outras etapas
        const etapaLimpa: StageProgress = {
          etapaId: etapa.etapaId,
          etapaNome: etapa.etapaNome,
          ordem: etapa.ordem,
          finalizadas: etapa.finalizadas || 0,
          defeituosas: etapa.defeituosas || 0,
          status: etapa.status,
        };
        if (etapa.responsavelId) etapaLimpa.responsavelId = etapa.responsavelId;
        if (etapa.responsavelNome)
          etapaLimpa.responsavelNome = etapa.responsavelNome;
        if (etapa.dataInicio) etapaLimpa.dataInicio = etapa.dataInicio;
        if (etapa.dataFim) etapaLimpa.dataFim = etapa.dataFim;
        if (etapa.observacoes && etapa.observacoes.length > 0) {
          etapaLimpa.observacoes = etapa.observacoes;
        }
        return etapaLimpa;
      });

      // Limpar campos undefined antes de salvar
      const etapasLimpas = updatedEtapas.map((etapa: StageProgress) =>
        removeUndefinedFields(etapa)
      );

      await updateDoc(progressRef, {
        etapas: etapasLimpas,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Erro ao iniciar próxima etapa:", error);
      throw error;
    }
  },

  async deleteProgress(progressId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION, progressId));
    } catch (error) {
      console.error("Erro ao deletar progresso:", error);
      throw error;
    }
  },
};
