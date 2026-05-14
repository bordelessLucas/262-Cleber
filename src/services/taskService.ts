import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebaseconfig";
import { parseFirebaseDate } from "../utils/parseFirebaseDate";
import type { Task, CreateTaskData, UpdateTaskData } from "../types/task";

export const taskService = {
  async createTask(userId: string, taskData: CreateTaskData): Promise<Task> {
    try {
      const now = new Date();
      const scheduledDate = new Date(`${taskData.scheduledDate}T00:00:00`);
      const taskRef = await addDoc(collection(db, "tasks"), {
        ...taskData,
        scheduledDate: Timestamp.fromDate(scheduledDate),
        completed: false,
        userId,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });

      return {
        id: taskRef.id,
        ...taskData,
        scheduledDate,
        completed: false,
        userId,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
      throw new Error("Erro ao criar tarefa");
    }
  },

  async getTasksByUser(userId: string): Promise<Task[]> {
    try {
      // Primeiro, buscar todas as tarefas do usuário
      const q = query(collection(db, "tasks"), where("userId", "==", userId));

      const querySnapshot = await getDocs(q);
      const tasks: Task[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const scheduledDate =
          parseFirebaseDate(data.scheduledDate ?? data.createdAt) || new Date();
        tasks.push({
          id: doc.id,
          description: data.description,
          time: data.time,
          scheduledDate,
          priority: data.priority,
          completed: data.completed,
          userId: data.userId,
          createdAt: parseFirebaseDate(data.createdAt) || new Date(),
          updatedAt: parseFirebaseDate(data.updatedAt) || new Date(),
        });
      });

      // Ordenar localmente por horário
      return tasks.sort((a, b) => a.time.localeCompare(b.time));
    } catch (error) {
      console.error("Erro ao buscar tarefas:", error);
      throw new Error("Erro ao buscar tarefas");
    }
  },

  async updateTask(taskId: string, updateData: UpdateTaskData): Promise<void> {
    try {
      const taskRef = doc(db, "tasks", taskId);
      const { scheduledDate, ...rest } = updateData;
      const payload: Omit<UpdateTaskData, "scheduledDate"> & {
        updatedAt: Timestamp;
        scheduledDate?: Timestamp;
      } = {
        ...rest,
        updatedAt: Timestamp.fromDate(new Date()),
      };
      if (scheduledDate) {
        payload.scheduledDate = Timestamp.fromDate(
          new Date(`${scheduledDate}T00:00:00`)
        );
      }
      await updateDoc(taskRef, {
        ...payload,
      });
    } catch (error) {
      console.error("Erro ao atualizar tarefa:", error);
      throw new Error("Erro ao atualizar tarefa");
    }
  },

  async deleteTask(taskId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "tasks", taskId));
    } catch (error) {
      console.error("Erro ao deletar tarefa:", error);
      throw new Error("Erro ao deletar tarefa");
    }
  },

  async toggleTaskCompletion(
    taskId: string,
    completed: boolean
  ): Promise<void> {
    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        completed,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      console.error("Erro ao alterar status da tarefa:", error);
      throw new Error("Erro ao alterar status da tarefa");
    }
  },

  async deleteOldTasks(): Promise<void> {
    // Mantido apenas para compatibilidade; não removemos tarefas automaticamente
    // para permitir histórico e navegação no calendário.
    return Promise.resolve();
  },
};
