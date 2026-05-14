import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "../lib/firebaseconfig";
import type { Company } from "../types/company";

const COMPANY_DOC_ID = "company_info";
const LOGO_STORAGE_PREFIX = "company/logo_";
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/** Remove caracteres problemáticos no path do Storage */
function sanitizeFileName(originalName: string): string {
  const base = originalName.replace(/[^\w.-]+/g, "_").replace(/^\.+/, "");
  return base || "logo";
}

function getStoragePathFromUrl(url: string): string | null {
  try {
    const decoded = decodeURIComponent(url);

    // pega o trecho entre /o/ e o ?
    const match = decoded.match(/\/o\/(.+)\?/);

    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function deleteLogoIfPossible(previousLogoUrl?: string): Promise<void> {
  if (!previousLogoUrl?.trim()) return;

  try {
    const path = getStoragePathFromUrl(previousLogoUrl);

    // se não conseguir extrair o path, não quebra o fluxo
    if (!path) {
      console.warn("Não foi possível extrair path do Storage:", previousLogoUrl);
      return;
    }

    const storageRef = ref(storage, path);
    await deleteObject(storageRef);

  } catch (error) {
    // nunca quebra upload por causa disso
    console.warn("Falha ao deletar logo antiga:", error);
  }
}

export const companyService = {
  // Buscar informações da empresa
  async getCompanyInfo(): Promise<Company | null> {
    try {
      const docRef = doc(db, "company", COMPANY_DOC_ID);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Company;
      }
      return null;
    } catch (error) {
      console.error("Erro ao buscar informações da empresa:", error);
      throw error;
    }
  },

  // Salvar/atualizar informações da empresa
  async saveCompanyInfo(companyData: Omit<Company, "id">): Promise<void> {
    try {
      const docRef = doc(db, "company", COMPANY_DOC_ID);
      await setDoc(
        docRef,
        {
          ...companyData,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Erro ao salvar informações da empresa:", error);
      throw error;
    }
  },

  /**
   * Upload de logo no Storage; opcionalmente remove a logo anterior (mesmo bucket).
   */
  async uploadLogo(
    file: File,
    options?: { previousLogoUrl?: string }
  ): Promise<string> {
    if (!file.type.startsWith("image/")) {
      throw new Error("Arquivo inválido: selecione uma imagem.");
    }
    if (file.size > MAX_LOGO_BYTES) {
      throw new Error("A imagem deve ter no máximo 5MB.");
    }

    const safeName = sanitizeFileName(file.name);
    const storageRef = ref(
      storage,
      `${LOGO_STORAGE_PREFIX}${Date.now()}_${safeName}`
    );

    try {
      await uploadBytes(storageRef, file, {
        contentType: file.type || "image/jpeg",
      });
      const downloadURL = await getDownloadURL(storageRef);

      if (options?.previousLogoUrl && options.previousLogoUrl !== downloadURL) {
        await deleteLogoIfPossible(options.previousLogoUrl);
      }

      return downloadURL;
    } catch (error) {
      console.error("Erro ao fazer upload da logo:", error);
      throw error;
    }
  },

  /**
   * Upload e persistência da logo no documento da empresa.
   * Garante que a URL da logo fique salva no banco imediatamente após o upload.
   */
  async uploadAndSaveLogo(
    file: File,
    options?: { previousLogoUrl?: string }
  ): Promise<string> {
    const logoUrl = await this.uploadLogo(file, options);
    const docRef = doc(db, "company", COMPANY_DOC_ID);
    await setDoc(
      docRef,
      {
        logoUrl,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return logoUrl;
  },
};
