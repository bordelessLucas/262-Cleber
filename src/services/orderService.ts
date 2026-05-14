import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "../lib/firebaseconfig";
import { parseFirebaseDate } from "../utils/parseFirebaseDate";
import type {
  ProductionOrder,
  CreateProductionOrderPayload,
  OrderStatus,
} from "../types/order";

const COLLECTION = "ordensProducao";
const COUNTERS_COLLECTION = "counters";

/**
 * Gera o próximo número sequencial de Ordem de Produção
 * Formato: OP-0001, OP-0002, etc.
 * Usa transação para garantir que não haja duplicatas
 */
async function getNextOrderNumber(userId: string): Promise<string> {
  const counterDocRef = doc(db, COUNTERS_COLLECTION, `op_counter_${userId}`);

  try {
    const nextNumber = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterDocRef);

      let currentNumber = 1;
      if (counterDoc.exists()) {
        currentNumber = counterDoc.data().lastNumber + 1;
      }

      // Atualiza o contador
      transaction.set(
        counterDocRef,
        {
          lastNumber: currentNumber,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      return currentNumber;
    });

    // Formata o número com 4 dígitos (OP-0001, OP-0002, etc.)
    return `OP-${String(nextNumber).padStart(4, "0")}`;
  } catch (error) {
    console.error("Erro ao gerar número da OP:", error);
    // Fallback para o sistema antigo em caso de erro
    return `OP-${Date.now()}`;
  }
}

export const orderService = {
  async getOrders(userId: string): Promise<ProductionOrder[]> {
    const q = query(
      collection(db, COLLECTION),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docRef) => {
      const data = docRef.data();
      return {
        id: docRef.id,
        codigo: data.codigo,
        produtoId: data.produtoId,
        produtoDescricao: data.produtoDescricao,
        produtoRef: data.produtoRef,
        prioridade: data.prioridade,
        status: data.status,
        dataInicio: data.dataInicio,
        dataPrevista: data.dataPrevista,
        responsavelId: data.responsavelId || undefined,
        responsavelNome: data.responsavelNome || undefined,
        createdAt: parseFirebaseDate(data.createdAt) || new Date(),
        updatedAt: parseFirebaseDate(data.updatedAt) || new Date(),
        userId: data.userId,
        grade: data.grade ?? [],
      };
    }) as ProductionOrder[];
  },

  async createOrder(
    userId: string,
    payload: CreateProductionOrderPayload,
    produto: { descricao: string; refCodigo: string },
    responsavelNome?: string
  ) {
    // Gera o próximo número sequencial de OP
    const codigoOP = await getNextOrderNumber(userId);

    // Calcula o total de cada linha da grade
    const gradeWithTotals = payload.grade.map((row) => ({
      ...row,
      total: Object.values(row.quantidades).reduce((acc, qty) => acc + qty, 0),
    }));

    await addDoc(collection(db, COLLECTION), {
      produtoId: payload.produtoId,
      produtoDescricao: produto.descricao,
      produtoRef: produto.refCodigo,
      prioridade: payload.prioridade,
      dataInicio: payload.dataInicio,
      dataPrevista: payload.dataPrevista,
      responsavelId: payload.responsavelId || null,
      responsavelNome: responsavelNome || null,
      grade: gradeWithTotals,
      userId,
      status: "em_producao",
      codigo: codigoOP,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  async updateOrder(
    id: string,
    payload: CreateProductionOrderPayload,
    produto: { descricao: string; refCodigo: string },
    responsavelNome?: string
  ) {
    const gradeWithTotals = payload.grade.map((row) => ({
      ...row,
      total: Object.values(row.quantidades).reduce((acc, qty) => acc + qty, 0),
    }));

    await updateDoc(doc(db, COLLECTION, id), {
      produtoId: payload.produtoId,
      produtoDescricao: produto.descricao,
      produtoRef: produto.refCodigo,
      prioridade: payload.prioridade,
      dataInicio: payload.dataInicio,
      dataPrevista: payload.dataPrevista,
      responsavelId: payload.responsavelId || null,
      responsavelNome: responsavelNome || null,
      grade: gradeWithTotals,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteOrder(id: string) {
    await deleteDoc(doc(db, COLLECTION, id));
  },

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    await updateDoc(doc(db, COLLECTION, orderId), {
      status,
      updatedAt: serverTimestamp(),
    });
  },
};
