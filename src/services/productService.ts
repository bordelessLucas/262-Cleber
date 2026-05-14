import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import type { DocumentData, UpdateData } from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "../lib/firebaseconfig";
import { parseFirebaseDate } from "../utils/parseFirebaseDate";
import type {
  Categoria,
  Cor,
  Tamanho,
  Produto,
  CategoriaForm,
  CorForm,
  TamanhoForm,
  ProdutoForm,
} from "../types/product";

const MAX_PRODUTO_IMAGE_BYTES = 5 * 1024 * 1024;

function sanitizeProdutoImageFileName(originalName: string): string {
  const base = originalName.replace(/[^\w.-]+/g, "_").replace(/^\.+/, "");
  return base || "imagem";
}

const PRODUCT_COLLECTIONS = {
  categorias: ["Categorias", "categorias"],
  cores: ["Cores", "cores"],
  tamanhos: ["tamanhos", "Tamanhos"],
} as const;

const uniqueById = <T extends { id: string }>(items: T[]): T[] =>
  Array.from(new Map(items.map((item) => [item.id, item])).values());

const toDate = (value: unknown): Date | undefined => {
  return parseFirebaseDate(value) ?? undefined;
};

const updateExistingDocument = async (
  collectionNames: readonly string[],
  id: string,
  data: UpdateData<DocumentData>
): Promise<void> => {
  for (const collectionName of collectionNames) {
    const documentRef = doc(db, collectionName, id);
    const documentSnapshot = await getDoc(documentRef);

    if (documentSnapshot.exists()) {
      await updateDoc(documentRef, data);
      return;
    }
  }

  await updateDoc(doc(db, collectionNames[0], id), data);
};

const deleteExistingDocument = async (
  collectionNames: readonly string[],
  id: string
): Promise<void> => {
  const existingDocuments = await Promise.all(
    collectionNames.map(async (collectionName) => {
      const documentRef = doc(db, collectionName, id);
      const documentSnapshot = await getDoc(documentRef);

      return documentSnapshot.exists() ? documentRef : null;
    })
  );

  const documentsToDelete = existingDocuments.filter(
    (documentRef): documentRef is NonNullable<typeof documentRef> =>
      documentRef !== null
  );

  if (documentsToDelete.length === 0) {
    await deleteDoc(doc(db, collectionNames[0], id));
    return;
  }

  await Promise.all(
    documentsToDelete.map((documentRef) => deleteDoc(documentRef))
  );
};

// ============= CATEGORIAS =============
export const categoriaService = {
  async getCategorias(userId: string): Promise<Categoria[]> {
    try {
      const snapshots = await Promise.all(
        PRODUCT_COLLECTIONS.categorias.map((collectionName) =>
          getDocs(
            query(collection(db, collectionName), where("userId", "==", userId))
          )
        )
      );
      const categorias = snapshots.flatMap((querySnapshot) =>
        querySnapshot.docs.map((documentSnapshot) => {
          const data = documentSnapshot.data();

          return {
            id: documentSnapshot.id,
            nome: data.nome || "",
            descricao: data.descricao || "",
            ativo: data.ativo !== false,
            createdAt: parseFirebaseDate(data.createdAt) || new Date(),
          };
        })
      );

      return uniqueById(categorias).sort((a, b) =>
        a.nome.localeCompare(b.nome)
      );
    } catch (error) {
      console.error("Erro ao buscar categorias:", error);
      throw error;
    }
  },

  async createCategoria(
    userId: string,
    categoriaForm: CategoriaForm
  ): Promise<string> {
    try {
      const docRef = await addDoc(
        collection(db, PRODUCT_COLLECTIONS.categorias[0]),
        {
          ...categoriaForm,
          userId,
          ativo: true,
          createdAt: serverTimestamp(),
        }
      );
      return docRef.id;
    } catch (error) {
      console.error("Erro ao criar categoria:", error);
      throw error;
    }
  },

  async updateCategoria(
    id: string,
    categoriaForm: CategoriaForm
  ): Promise<void> {
    try {
      await updateExistingDocument(PRODUCT_COLLECTIONS.categorias, id, {
        ...categoriaForm,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Erro ao atualizar categoria:", error);
      throw error;
    }
  },

  async deleteCategoria(id: string): Promise<void> {
    try {
      await deleteExistingDocument(PRODUCT_COLLECTIONS.categorias, id);
    } catch (error) {
      console.error("Erro ao deletar categoria:", error);
      throw error;
    }
  },
};

// ============= CORES =============
export const corService = {
  async getCores(userId: string): Promise<Cor[]> {
    try {
      const snapshots = await Promise.all(
        PRODUCT_COLLECTIONS.cores.map((collectionName) =>
          getDocs(
            query(collection(db, collectionName), where("userId", "==", userId))
          )
        )
      );
      const cores = snapshots.flatMap((querySnapshot) =>
        querySnapshot.docs.map((documentSnapshot) => {
          const data = documentSnapshot.data();

          return {
            id: documentSnapshot.id,
            nome: data.nome || "",
            codigo: data.codigo || "#000000",
            ativo: data.ativo !== false,
            createdAt: toDate(data.createdAt) || new Date(),
          };
        })
      );

      return uniqueById(cores).sort((a, b) => a.nome.localeCompare(b.nome));
    } catch (error) {
      console.error("Erro ao buscar cores:", error);
      throw error;
    }
  },

  async createCor(userId: string, corForm: CorForm): Promise<string> {
    try {
      const docRef = await addDoc(
        collection(db, PRODUCT_COLLECTIONS.cores[0]),
        {
          ...corForm,
          userId,
          ativo: true,
          createdAt: serverTimestamp(),
        }
      );
      return docRef.id;
    } catch (error) {
      console.error("Erro ao criar cor:", error);
      throw error;
    }
  },

  async updateCor(id: string, corForm: CorForm): Promise<void> {
    try {
      await updateExistingDocument(PRODUCT_COLLECTIONS.cores, id, {
        ...corForm,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Erro ao atualizar cor:", error);
      throw error;
    }
  },

  async deleteCor(id: string): Promise<void> {
    try {
      await deleteExistingDocument(PRODUCT_COLLECTIONS.cores, id);
    } catch (error) {
      console.error("Erro ao deletar cor:", error);
      throw error;
    }
  },
};

// ============= TAMANHOS =============
export const tamanhoService = {
  async getTamanhos(userId: string): Promise<Tamanho[]> {
    try {
      const snapshots = await Promise.all(
        PRODUCT_COLLECTIONS.tamanhos.map((collectionName) =>
          getDocs(
            query(collection(db, collectionName), where("userId", "==", userId))
          )
        )
      );
      const tamanhos = snapshots.flatMap((querySnapshot) =>
        querySnapshot.docs.map((documentSnapshot) => {
          const data = documentSnapshot.data();

          return {
            id: documentSnapshot.id,
            nome: data.nome || "",
            ordem: Number(data.ordem) || 1,
            ativo: data.ativo !== false,
            createdAt: toDate(data.createdAt) || new Date(),
          };
        })
      );

      return uniqueById(tamanhos).sort((a, b) => a.ordem - b.ordem);
    } catch (error) {
      console.error("Erro ao buscar tamanhos:", error);
      throw error;
    }
  },

  async createTamanho(
    userId: string,
    tamanhoForm: TamanhoForm
  ): Promise<string> {
    try {
      const docRef = await addDoc(
        collection(db, PRODUCT_COLLECTIONS.tamanhos[0]),
        {
          ...tamanhoForm,
          userId,
          ativo: true,
          createdAt: serverTimestamp(),
        }
      );
      return docRef.id;
    } catch (error) {
      console.error("Erro ao criar tamanho:", error);
      throw error;
    }
  },

  async updateTamanho(id: string, tamanhoForm: TamanhoForm): Promise<void> {
    try {
      await updateExistingDocument(PRODUCT_COLLECTIONS.tamanhos, id, {
        ...tamanhoForm,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Erro ao atualizar tamanho:", error);
      throw error;
    }
  },

  async deleteTamanho(id: string): Promise<void> {
    try {
      await deleteExistingDocument(PRODUCT_COLLECTIONS.tamanhos, id);
    } catch (error) {
      console.error("Erro ao deletar tamanho:", error);
      throw error;
    }
  },
};

// ============= PRODUTOS =============
export const produtoService = {
  async getProdutos(userId: string): Promise<Produto[]> {
    try {
      const q = query(
        collection(db, "produtos"),
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      const produtos = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          refCodigo: data.refCodigo || "",
          descricao: data.descricao || "",
          categoria: { id: "", nome: "", ativo: true, createdAt: new Date() },
          cores: [],
          tamanhos: [],
          etapasProducao: [],
          categoriaId: data.categoriaId || "",
          coresIds: data.coresIds || [],
          tamanhosIds: data.tamanhosIds || [],
          etapasProducaoIds: data.etapasProducaoIds || [],
          imagemUrl:
            typeof data.imagemUrl === "string" && data.imagemUrl.trim() !== ""
              ? data.imagemUrl
              : undefined,
          ativo: data.ativo !== false,
          userId: data.userId,
          createdAt: parseFirebaseDate(data.createdAt) || new Date(),
          updatedAt: parseFirebaseDate(data.updatedAt) || new Date(),
        };
      }) as Produto[];

      return produtos.sort((a, b) => {
        const refA = parseInt(a.refCodigo) || 0;
        const refB = parseInt(b.refCodigo) || 0;
        return refA - refB;
      });
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      throw error;
    }
  },

  async createProduto(
    userId: string,
    produtoForm: ProdutoForm
  ): Promise<string> {
    try {
      // Validar que o produto tem etapas de produção
      if (!produtoForm.etapasProducao || produtoForm.etapasProducao.length === 0) {
        throw new Error("O produto deve ter pelo menos uma etapa de produção definida");
      }

      const docRef = await addDoc(collection(db, "produtos"), {
        refCodigo: produtoForm.refCodigo,
        descricao: produtoForm.descricao,
        categoriaId: produtoForm.categoriaId,
        coresIds: produtoForm.coresIds,
        tamanhosIds: produtoForm.tamanhosIds,
        etapasProducaoIds: produtoForm.etapasProducao || [],
        ...(produtoForm.imagemUrl?.trim()
          ? { imagemUrl: produtoForm.imagemUrl.trim() }
          : {}),
        userId,
        ativo: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error("Erro ao criar produto:", error);
      throw error;
    }
  },

  async updateProduto(id: string, produtoForm: ProdutoForm): Promise<void> {
    try {
      // Validar que o produto tem etapas de produção
      if (!produtoForm.etapasProducao || produtoForm.etapasProducao.length === 0) {
        throw new Error("O produto deve ter pelo menos uma etapa de produção definida");
      }

      await updateDoc(doc(db, "produtos", id), {
        refCodigo: produtoForm.refCodigo,
        descricao: produtoForm.descricao,
        categoriaId: produtoForm.categoriaId,
        coresIds: produtoForm.coresIds,
        tamanhosIds: produtoForm.tamanhosIds,
        etapasProducaoIds: produtoForm.etapasProducao || [],
        imagemUrl: produtoForm.imagemUrl?.trim() || null,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Erro ao atualizar produto:", error);
      throw error;
    }
  },

  async deleteProduto(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "produtos", id));
    } catch (error) {
      console.error("Erro ao deletar produto:", error);
      throw error;
    }
  },

  /**
   * Envia imagem de referência ao Storage (pasta por usuário/produto).
   * Retorna a URL pública para gravar em Firestore.
   */
  async uploadProdutoImagem(
    userId: string,
    produtoId: string,
    file: File
  ): Promise<string> {
    if (!file.type.startsWith("image/")) {
      throw new Error("Arquivo inválido: selecione uma imagem.");
    }
    if (file.size > MAX_PRODUTO_IMAGE_BYTES) {
      throw new Error("A imagem deve ter no máximo 5 MB.");
    }

    const safeName = sanitizeProdutoImageFileName(file.name);
    const storageRef = ref(
      storage,
      `produtos/${userId}/${produtoId}/${Date.now()}_${safeName}`
    );

    await uploadBytes(storageRef, file, {
      contentType: file.type || "image/jpeg",
    });
    return getDownloadURL(storageRef);
  },
};
