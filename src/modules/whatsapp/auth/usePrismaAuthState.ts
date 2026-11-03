import { prisma } from "@/lib/prisma";
import { AuthenticationCreds, AuthenticationState, BufferJSON, initAuthCreds, SignalDataTypeMap } from "@whiskeysockets/baileys";
import { logger } from "@/lib/logger";
import { encryptSessionData, decryptSessionData } from "@/lib/crypto";

export const usePrismaAuthState = async (sessionId: string): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> => {
    
    // Helper to read JSON with Buffer handling & transparent AES-256-GCM decryption
    const readData = async (type: string, id: string) => {
        try {
            const key = `${type}-${id}`;
            const data = await prisma.authState.findUnique({
                where: { sessionId_key: { sessionId, key } }
            });
            if (data && data.value) {
                const decryptedValue = decryptSessionData(data.value);
                return JSON.parse(JSON.stringify(decryptedValue), BufferJSON.reviver);
            }
            return null;
        } catch (error) {
            logger.error("Auth", 'Error reading auth state:', error);
            return null;
        }
    };

    // Helper to write data with authenticated AES-256-GCM encryption
    const writeData = async (type: string, id: string, data: any) => {
        try {
            const key = `${type}-${id}`;
            const rawValue = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
            const encryptedValue = encryptSessionData(rawValue);
            
            await prisma.authState.upsert({
                where: { sessionId_key: { sessionId, key } },
                create: { sessionId, key, value: encryptedValue as any },
                update: { value: encryptedValue as any }
            });
        } catch (error) {
             logger.error("Auth", 'Error writing auth state:', error);
        }
    };

    const removeData = async (type: string, id: string) => {
        try {
            const key = `${type}-${id}`;
             await prisma.authState.deleteMany({
                where: { sessionId, key }
            });
        } catch (error) {
            // ignore
        }
    };

    const creds: AuthenticationCreds = (await readData('creds', 'me')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data: { [key: string]: SignalDataTypeMap[typeof type] } = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(type, id);
                        if (type === 'app-state-sync-key' && value) {
                            value = BufferJSON.reviver(null, value);
                        }
                        if (value) {
                            data[id] = value;
                        }
                    }));
                    return data;
                },
                set: async (data) => {
                     const tasks: Promise<void>[] = [];
                    for (const category in data) {
                        const categoryData = data[category as keyof typeof data];
                        if (!categoryData) continue;
                        
                        for (const id in categoryData) {
                            const value = categoryData[id];
                             if (value) {
                                tasks.push(writeData(category, id, value));
                            } else {
                                tasks.push(removeData(category, id));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            await writeData('creds', 'me', creds);
        }
    };
};
