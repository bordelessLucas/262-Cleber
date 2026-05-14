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
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebaseconfig";
import { removeUndefinedFields } from "../utils/firestoreHelpers";
import { parseFirebaseDate } from "../utils/parseFirebaseDate";
import type {
  LancamentoFinanceiro,
  CreateLancamentoPayload,
  UpdateLancamentoPayload,
} from "../types/financeiro";

const COLLECTION = "lancamentosFinanceiros";

const toLancamento = (
  docId: string,
  data: Record<string, unknown>
): LancamentoFinanceiro => {
  return {
    id: docId,
    ...(data as Omit<LancamentoFinanceiro, "id">),

    dataVencimento:
      parseFirebaseDate(data.dataVencimento) || new Date(),

    dataPagamento:
      parseFirebaseDate(data.dataPagamento) || undefined,

    createdAt:
      parseFirebaseDate(data.createdAt) || new Date(),

    updatedAt:
      parseFirebaseDate(data.updatedAt) || new Date(),
  };
};

const getDisplayStatus = (lancamento: LancamentoFinanceiro): LancamentoFinanceiro["status"] => {
  if (lancamento.status === "pago") return "pago";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(lancamento.dataVencimento);
  vencimento.setHours(0, 0, 0, 0);
  return vencimento < hoje ? "atrasado" : "pendente";
};

export const financeiroService = {
  async createLancamento(
    payload: CreateLancamentoPayload,
    userId: string
  ): Promise<string> {
    try {
      const lancamentoData = removeUndefinedFields({
        ...payload,
        dataVencimento: Timestamp.fromDate(payload.dataVencimento),
        status: "pendente",
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const docRef = await addDoc(collection(db, COLLECTION), lancamentoData);
      return docRef.id;
    } catch (error) {
      console.error("Erro ao criar lançamento financeiro:", error);
      throw error;
    }
  },

  async getLancamentosByUser(userId: string): Promise<LancamentoFinanceiro[]> {
    try {
      const q = query(
        collection(db, COLLECTION),
        where("userId", "==", userId),
        orderBy("dataVencimento", "desc")
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((entry) =>
        toLancamento(entry.id, entry.data())
      );
    } catch (error) {
      console.error("Erro ao buscar lançamentos:", error);
      throw error;
    }
  },

  async getLancamentosPendentes(
    userId: string
  ): Promise<LancamentoFinanceiro[]> {
    try {
      const q = query(
        collection(db, COLLECTION),
        where("userId", "==", userId),
        where("status", "in", ["pendente", "atrasado"]),
        orderBy("dataVencimento", "asc")
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((entry) => {
        const lancamento = toLancamento(entry.id, entry.data());
        return { ...lancamento, status: getDisplayStatus(lancamento) };
      });
    } catch (error) {
      console.error("Erro ao buscar lançamentos pendentes:", error);
      throw error;
    }
  },

  async getLancamentosPagos(userId: string): Promise<LancamentoFinanceiro[]> {
    try {
      const q = query(
        collection(db, COLLECTION),
        where("userId", "==", userId),
        where("status", "==", "pago"),
        orderBy("dataPagamento", "desc")
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((entry) =>
        toLancamento(entry.id, entry.data())
      );
    } catch (error) {
      console.error("Erro ao buscar lançamentos pagos:", error);
      throw error;
    }
  },

  async getLancamentoById(
    lancamentoId: string
  ): Promise<LancamentoFinanceiro | null> {
    try {
      const docRef = doc(db, COLLECTION, lancamentoId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return toLancamento(docSnap.id, data);
    } catch (error) {
      console.error("Erro ao buscar lançamento:", error);
      throw error;
    }
  },

  async updateLancamento(
    lancamentoId: string,
    payload: UpdateLancamentoPayload
  ): Promise<void> {
    try {
      const lancamentoRef = doc(db, COLLECTION, lancamentoId);
      const updateData = removeUndefinedFields({
        ...payload,
        dataPagamento: payload.dataPagamento
          ? Timestamp.fromDate(payload.dataPagamento)
          : undefined,
        updatedAt: serverTimestamp(),
      });

      await updateDoc(lancamentoRef, updateData);
    } catch (error) {
      console.error("Erro ao atualizar lançamento:", error);
      throw error;
    }
  },

  async marcarComoPago(lancamentoId: string): Promise<void> {
    try {
      await this.updateLancamento(lancamentoId, {
        status: "pago",
        dataPagamento: new Date(),
      });
    } catch (error) {
      console.error("Erro ao marcar lançamento como pago:", error);
      throw error;
    }
  },

  async marcarComoPagoSePendente(lancamentoId: string): Promise<"paid" | "already_paid"> {
    const lancamento = await this.getLancamentoById(lancamentoId);
    if (!lancamento) {
      throw new Error("Lançamento não encontrado");
    }
    if (lancamento.status === "pago") {
      return "already_paid";
    }
    await this.marcarComoPago(lancamentoId);
    return "paid";
  },

  async deleteLancamento(lancamentoId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION, lancamentoId));
    } catch (error) {
      console.error("Erro ao deletar lançamento:", error);
      throw error;
    }
  },

  async deleteLancamentosByOrdem(ordemProducaoId: string): Promise<void> {
    try {
      const q = query(
        collection(db, COLLECTION),
        where("ordemProducaoId", "==", ordemProducaoId)
      );

      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map((doc) =>
        deleteDoc(doc.ref)
      );

      await Promise.all(deletePromises);
    } catch (error) {
      console.error("Erro ao deletar lançamentos da ordem:", error);
      throw error;
    }
  },

  async upsertLancamentoByOrderStage(
    payload: CreateLancamentoPayload,
    userId: string
  ): Promise<string> {
    const q = query(
      collection(db, COLLECTION),
      where("ordemProducaoId", "==", payload.ordemProducaoId),
      where("etapaId", "==", payload.etapaId),
      where("faccaoId", "==", payload.faccaoId),
      where("userId", "==", userId)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return this.createLancamento(payload, userId);
    }

    const existing = snapshot.docs[0];
    const updateData = removeUndefinedFields({
      ...payload,
      dataVencimento: Timestamp.fromDate(payload.dataVencimento),
      updatedAt: serverTimestamp(),
    });
    await updateDoc(existing.ref, updateData);
    return existing.id;
  },
};
