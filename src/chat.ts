import type { WASocket, WAMessage, ConnectionState } from 'baileys';
import { Thread } from './thread';
import { Channel } from './channel';
import { Message } from './message';
import type { ClickEvent, ConversaContext } from './types';

export type DirectMessageHandler = (thread: Thread, message: Message, channel: Channel) => void | Promise<void>;
export type SubscribedMessageHandler = (thread: Thread, message: Message) => void | Promise<void>;
export type NewMessageHandler = (thread: Thread, message: Message) => void | Promise<void>;
export type ChatCreatedCallback = (chat: Chat) => void;
export type ReactionHandler = (thread: Thread, event: { emoji: string; messageId: string; authorId: string; authorName?: string }) => void | Promise<void>;

export type ContextMessageHandler = (ctx: ConversaContext) => void | Promise<void>;
export type ContextReactionHandler = (thread: Thread, event: { emoji: string; messageId: string; authorId: string; authorName?: string }) => void | Promise<void>;

export type ConnectionStateHandler = (status: 'connecting' | 'open' | 'close', error?: Error) => void | Promise<void>;
export type QRCodeHandler = (qr: string) => void | Promise<void>;

interface FilterCriteria {
	type?: 'dm' | 'group' | 'thread';
	jid?: string;
}

export interface FilteredChat {
	onMessage: (handler: ContextMessageHandler) => void;
	onReaction: (handler: ContextReactionHandler) => void;
}

// Registro persistente de callbacks estables (Propuesta A - new Button)
const stableCallbacks = new Map<string, Function>();

export function registerStableCallback(buttonId: string, index: number, fn: Function) {
	stableCallbacks.set(`${buttonId}:${index}`, fn);
}

export function getStableCallback(buttonId: string, index: number): Function | undefined {
	return stableCallbacks.get(`${buttonId}:${index}`);
}

// Registro débil de callbacks en memoria (cero fugas de memoria y sin límites fijos)
const fnToId = new WeakMap<Function, string>();
const idToRef = new Map<string, WeakRef<Function>>();

const cleanupRegistry = new FinalizationRegistry<string>((id) => {
	idToRef.delete(id);
});

export function registerCallback(fn: Function): string {
	let id = fnToId.get(fn);
	if (!id) {
		id = `cb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
		fnToId.set(fn, id);
		idToRef.set(id, new WeakRef(fn));
		cleanupRegistry.register(fn, id);
	}
	return id;
}

export function getCallback(id: string): Function | undefined {
	const ref = idToRef.get(id);
	return ref?.deref();
}

export class Chat {
	private static readonly createdCallbacks: Set<ChatCreatedCallback> = new Set();

	// Manejadores compatibles antiguos
	private dmHandlers: DirectMessageHandler[] = [];
	private subscribedHandlers: SubscribedMessageHandler[] = [];
	private reactionHandlers: ReactionHandler[] = [];
	private newMessageHandlers: { pattern: RegExp; handler: NewMessageHandler }[] = [];

	// Nuevos filtros de enrutamiento y eventos de socket
	private messageFilters: { criteria: FilterCriteria; handler: ContextMessageHandler }[] = [];
	private reactionFilters: { criteria: FilterCriteria; handler: ContextReactionHandler }[] = [];
	private connectionHandlers: ConnectionStateHandler[] = [];
	private qrHandlers: QRCodeHandler[] = [];

	constructor(
		public readonly sessionId: string,
		private readonly socket: WASocket
	) {
		this.bindEvents();
		// Notificar a los suscriptores globales que se ha creado una nueva instancia de Chat
		for (const cb of Chat.createdCallbacks) {
			try {
				cb(this);
			} catch (err) {
				console.error('[Conversa SDK] Error en callback de Chat.onCreated:', err);
			}
		}
	}

	/**
	 * Registra un callback global para cuando se crea cualquier instancia de Chat (conexión/reconexión)
	 */
	public static onCreated(callback: ChatCreatedCallback) {
		Chat.createdCallbacks.add(callback);
		return () => {
			Chat.createdCallbacks.delete(callback);
		};
	}

	/**
	 * Remueve el listener de la conexión actual
	 */
	public destroy() {
		try {
			this.socket.ev.off('messages.upsert', this.onMessageUpsert);
			this.socket.ev.off('connection.update', this.onConnectionUpdate);
		} catch (e) {
			// ignore
		}
	}

	/**
	 * Registra un callback para Mensajes Directos (DMs)
	 */
	public onDirectMessage(handler: DirectMessageHandler) {
		this.dmHandlers.push(handler);
	}

	/**
	 * Registra un callback para Mensajes Suscritos
	 */
	public onSubscribedMessage(handler: SubscribedMessageHandler) {
		this.subscribedHandlers.push(handler);
	}

	/**
	 * Registra un callback para reacciones recibidas
	 */
	public onReaction(handler: ReactionHandler) {
		this.reactionHandlers.push(handler);
	}

	/**
	 * Registra un callback para mensajes que coincidan con un patrón regex
	 */
	public onNewMessage(pattern: RegExp, handler: NewMessageHandler) {
		this.newMessageHandlers.push({ pattern, handler });
	}

	// --- NUEVA API DE ENRUTAMIENTO FLUIDO Y EVENTOS ---
	
	public onMessage(handler: ContextMessageHandler) {
		this.messageFilters.push({ criteria: {}, handler });
	}

	public onConnection(handler: ConnectionStateHandler) {
		this.connectionHandlers.push(handler);
	}

	public onQR(handler: QRCodeHandler) {
		this.qrHandlers.push(handler);
	}

	public dm(): FilteredChat {
		return {
			onMessage: (handler) => this.messageFilters.push({ criteria: { type: 'dm' }, handler }),
			onReaction: (handler) => this.reactionFilters.push({ criteria: { type: 'dm' }, handler })
		};
	}

	public group(): FilteredChat {
		return {
			onMessage: (handler) => this.messageFilters.push({ criteria: { type: 'group' }, handler }),
			onReaction: (handler) => this.reactionFilters.push({ criteria: { type: 'group' }, handler })
		};
	}

	public thread(jid: string): FilteredChat {
		return {
			onMessage: (handler) => this.messageFilters.push({ criteria: { type: 'thread', jid }, handler }),
			onReaction: (handler) => this.reactionFilters.push({ criteria: { type: 'thread', jid }, handler })
		};
	}

	// ----------------------------------------

	private bindEvents() {
		this.socket.ev.on('messages.upsert', this.onMessageUpsert);
		this.socket.ev.on('connection.update', this.onConnectionUpdate);
	}

	private onConnectionUpdate = async (update: Partial<ConnectionState>) => {
		const { connection, lastDisconnect, qr } = update;
		
		if (qr) {
			for (const handler of this.qrHandlers) {
				try {
					await handler(qr);
				} catch (err) {
					console.error('[Conversa SDK] Error en callback de onQR:', err);
				}
			}
		}

		if (connection) {
			const error = lastDisconnect?.error as Error | undefined;
			for (const handler of this.connectionHandlers) {
				try {
					await handler(connection, error);
				} catch (err) {
					console.error('[Conversa SDK] Error en callback de onConnection:', err);
				}
			}
		}
	};

	private onMessageUpsert = async (m: { messages: WAMessage[]; type: 'notify' | 'append' }) => {
		if (!m.messages || m.messages.length === 0) return;
		const rawMessage = m.messages[0];
		if (!rawMessage || !rawMessage.message) return;

		// Evitar procesar mensajes propios
		if (rawMessage.key.fromMe) return;

		const jid = rawMessage.key.remoteJid;
		if (!jid) return;

		const msg = rawMessage.message;
		const unwrapped = (msg as any).ephemeralMessage?.message || 
		                  (msg as any).viewOnceMessage?.message || 
		                  (msg as any).viewOnceMessageV2?.message || 
		                  msg;

		if (!unwrapped) return;

		const isGroup = jid.endsWith('@g.us');

		// 1. Interceptar Reacciones
		const reactionMsg = unwrapped.reactionMessage;
		if (reactionMsg) {
			const emoji = reactionMsg.text;
			const targetMessageId = reactionMsg.key?.id;
			if (emoji && targetMessageId) {
				const thread = new Thread(`${this.sessionId}:${jid}`, this.sessionId, jid, this.socket);
				const authorId = rawMessage.key.participant || rawMessage.key.remoteJid || '';
				const authorName = rawMessage.pushName || undefined;
				
				// A. Ejecutar callbacks heredados
				for (const handler of this.reactionHandlers) {
					try {
						await handler(thread, { emoji, messageId: targetMessageId, authorId, authorName });
					} catch (err) {
						console.error('[Conversa SDK] Error en callback de onReaction:', err);
					}
				}

				// B. Ejecutar filtros del enrutamiento nuevo
				for (const { criteria, handler } of this.reactionFilters) {
					if (criteria.type === 'dm' && isGroup) continue;
					if (criteria.type === 'group' && !isGroup) continue;
					if (criteria.type === 'thread' && criteria.jid !== jid) continue;

					try {
						await handler(thread, { emoji, messageId: targetMessageId, authorId, authorName });
					} catch (err) {
						console.error('[Conversa SDK] Error en reaction filter:', err);
					}
				}
			}
			return; // Evitar procesar reacciones como mensajes de texto normales
		}

		// 2. Interceptar Respuestas de Botones Interactivos
		let buttonId: string | undefined;
		let buttonLabel: string | undefined;

		const interactiveResp = unwrapped.interactiveResponseMessage;
		if (interactiveResp) {
			buttonLabel = interactiveResp.body?.text;
			const nativeFlowResp = interactiveResp.nativeFlowResponseMessage;
			if (nativeFlowResp?.paramsJson) {
				try {
					const params = JSON.parse(nativeFlowResp.paramsJson);
					buttonId = params.id;
				} catch (e) {
					buttonId = nativeFlowResp.paramsJson;
				}
			}
		}

		const templateResp = unwrapped.templateButtonReplyMessage;
		if (templateResp) {
			buttonLabel = templateResp.selectedDisplayText;
			buttonId = templateResp.selectedId;
		}

		const buttonsResp = unwrapped.buttonsResponseMessage;
		if (buttonsResp) {
			buttonLabel = buttonsResp.selectedButtonText;
			buttonId = buttonsResp.selectedButtonId;
		}

		if (buttonId) {
			let callback: Function | undefined;

			// Intentar parsear el buttonId para ver si viene del sistema persistente (Propuesta A) o débil
			try {
				const parsed = JSON.parse(buttonId);
				if (parsed && typeof parsed === 'object') {
					if ('stableId' in parsed && 'index' in parsed) {
						callback = getStableCallback(parsed.stableId, parsed.index);
					} else if ('click' in parsed) {
						callback = getCallback(parsed.click);
					}
				}
			} catch (e) {
				// Fallback si no era JSON
				callback = getCallback(buttonId);
			}

			if (callback) {
				const authorId = rawMessage.key.participant || rawMessage.key.remoteJid || '';
				const author = {
					id: authorId,
					name: rawMessage.pushName || undefined,
					isBot: false,
				};
				const thread = new Thread(`${this.sessionId}:${jid}`, this.sessionId, jid, this.socket);
				const clickEvent: ClickEvent = {
					thread,
					author,
					buttonLabel: buttonLabel || '',
					messageId: rawMessage.key.id!,
					raw: rawMessage
				};

				try {
					await callback(clickEvent);
				} catch (err) {
					console.error('[Conversa SDK] Error al ejecutar callback de botón:', err);
				}
				return; // Detener flujo para no procesar el click como mensaje de texto normal
			}
		}

		// 3. Flujo normal de Mensajes de Texto
		const text = this.extractText(rawMessage);
		const authorId = rawMessage.key.participant || rawMessage.key.remoteJid || '';

		const author = {
			id: authorId,
			name: rawMessage.pushName || undefined,
			isBot: false,
		};

		const message = new Message(
			rawMessage.key.id!,
			text,
			author,
			new Date((rawMessage.messageTimestamp as number) * 1000),
			rawMessage,
			this.checkIfMentioned(rawMessage, this.socket)
		);

		const thread = new Thread(`${this.sessionId}:${jid}`, this.sessionId, jid, this.socket);
		const channel = new Channel(`${this.sessionId}:${jid}`, jid, isGroup);

		// --- EJECUTAR NUEVA API DE ENRUTAMIENTO FLUIDO (ONMESSAGE) ---
		const ctx: ConversaContext = {
			sessionId: this.sessionId,
			thread,
			message,
			author,
			text,
			isMention: message.isMention,
			reply: (content) => thread.post(content),
			react: (emoji) => thread.react(emoji, message.id)
		};

		for (const { criteria, handler } of this.messageFilters) {
			if (criteria.type === 'dm' && isGroup) continue;
			if (criteria.type === 'group' && !isGroup) continue;
			if (criteria.type === 'thread' && criteria.jid !== jid) continue;

			try {
				await handler(ctx);
			} catch (err) {
				console.error(`[Conversa] Error en filtro de mensaje de la sesión "${this.sessionId}":`, err);
			}
		}
		// -------------------------------------------------------------

		// A. Mensajes Directos (DMs - Legado)
		if (!isGroup) {
			for (const handler of this.dmHandlers) {
				try {
					await handler(thread, message, channel);
				} catch (err) {
					console.error(`[Conversa] Error en manejador de DMs de la sesión "${this.sessionId}":`, err);
				}
			}
		}

		// B. Mensajes Suscritos (Legado)
		for (const handler of this.subscribedHandlers) {
			try {
				await handler(thread, message);
			} catch (err) {
				console.error(`[Conversa] Error en manejador suscrito de la sesión "${this.sessionId}":`, err);
			}
		}

		// C. Comandos con Patrón Regex (Legado)
		for (const { pattern, handler } of this.newMessageHandlers) {
			if (pattern.test(text)) {
				try {
					await handler(thread, message);
				} catch (err) {
					console.error(`[Conversa] Error en manejador de patrón regex de la sesión "${this.sessionId}":`, err);
				}
			}
		}
	};

	private extractText(rawMessage: WAMessage): string {
		const msg = rawMessage.message;
		if (!msg) return '';

		const content = (msg as any).ephemeralMessage?.message || 
		                (msg as any).viewOnceMessage?.message || 
		                (msg as any).viewOnceMessageV2?.message || 
		                msg;

		if (typeof content.conversation === 'string') return content.conversation;
		if (typeof content.extendedTextMessage?.text === 'string') return content.extendedTextMessage.text;
		if (typeof content.imageMessage?.caption === 'string') return content.imageMessage.caption;
		if (typeof content.videoMessage?.caption === 'string') return content.videoMessage.caption;

		return '';
	}

	private checkIfMentioned(rawMessage: WAMessage, socket: WASocket): boolean {
		const myJid = socket.user?.id?.split(':')[0] + '@s.whatsapp.net';
		const msg = rawMessage.message;
		if (!msg) return false;

		const content = (msg as any).ephemeralMessage?.message || 
		                (msg as any).viewOnceMessage?.message || 
		                (msg as any).viewOnceMessageV2?.message || 
		                msg;

		const mentionedJid = content?.extendedTextMessage?.contextInfo?.mentionedJid || [];
		return mentionedJid.includes(myJid);
	}
}
