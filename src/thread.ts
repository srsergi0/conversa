import type { WASocket } from 'baileys';
import type { PostableMessage, PostableButtons } from './types';
import { registerCallback } from './chat';
import { Button } from './button';

export class Thread {
	constructor(
		public readonly id: string, // Formato: `sessionId:jid`
		public readonly sessionId: string,
		public readonly jid: string,
		private readonly socket: WASocket
	) {}

	/**
	 * Envía un mensaje al hilo
	 */
	async post(content: PostableMessage) {
		if (typeof content === 'string') {
			return this.socket.sendMessage(this.jid, { text: content });
		}

		// 1. Manejar clase Button persistente (Propuesta A)
		if (content instanceof Button) {
			const buttonsContent = content.config;
			const text = buttonsContent.text;
			const footer = buttonsContent.footer;
			const header = buttonsContent.header;
			
			const formattedButtons = buttonsContent.buttons.map((btn, index) => {
				const buttonIdJson = JSON.stringify({
					stableId: content.id,
					index: index
				});
				return {
					name: 'quick_reply',
					buttonParamsJson: JSON.stringify({
						display_text: btn.label,
						id: buttonIdJson
					})
				};
			});

			const payload = {
				viewOnceMessage: {
					message: {
						interactiveMessage: {
							header: header ? {
								title: header,
								hasMediaAttachment: false
							} : undefined,
							body: {
								text: text
							},
							footer: footer ? {
								text: footer
							} : undefined,
							nativeFlowMessage: {
								buttons: formattedButtons
							}
						}
					}
				}
			};

			return this.socket.sendMessage(this.jid, payload as any);
		}

		// 2. Manejar objeto plano de botones interactivos (in-memory WeakRef fallback)
		if (typeof content === 'object' && 'buttons' in content) {
			const buttonsContent = content as PostableButtons;
			const text = buttonsContent.text;
			const footer = buttonsContent.footer;
			const header = buttonsContent.header;
			
			const formattedButtons = buttonsContent.buttons.map(btn => {
				const callbackId = registerCallback(btn.onClick);
				const buttonIdJson = JSON.stringify({
					click: callbackId
				});
				return {
					name: 'quick_reply',
					buttonParamsJson: JSON.stringify({
						display_text: btn.label,
						id: buttonIdJson
					})
				};
			});

			const payload = {
				viewOnceMessage: {
					message: {
						interactiveMessage: {
							header: header ? {
								title: header,
								hasMediaAttachment: false
							} : undefined,
							body: {
								text: text
							},
							footer: footer ? {
								text: footer
							} : undefined,
							nativeFlowMessage: {
								buttons: formattedButtons
							}
						}
					}
				}
			};

			return this.socket.sendMessage(this.jid, payload as any);
		}

		// 3. Manejar mensajes de texto y multimedia ordinarios
		const textContent = content.text || content.raw || content.markdown || '';

		if (content.files && content.files.length > 0) {
			const file = content.files[0];
			let mediaType: 'image' | 'video' | 'audio' | 'document' = 'document';
			const mime = file.mimeType || '';
			
			if (mime.startsWith('image/')) {
				mediaType = 'image';
			} else if (mime.startsWith('video/')) {
				mediaType = 'video';
			} else if (mime.startsWith('audio/')) {
				mediaType = 'audio';
			}

			const payload: any = {};
			
			let dataBuffer: Buffer;
			if (file.data instanceof Buffer) {
				dataBuffer = file.data;
			} else if (file.data instanceof ArrayBuffer) {
				dataBuffer = Buffer.from(file.data);
			} else {
				// Blob
				dataBuffer = Buffer.from(await (file.data as Blob).arrayBuffer());
			}

			payload[mediaType] = dataBuffer;
			
			if (textContent) {
				payload.caption = textContent;
			}
			
			if (mediaType === 'document') {
				payload.fileName = file.filename;
				payload.mimetype = mime;
			}

			return this.socket.sendMessage(this.jid, payload as any);
		}

		return this.socket.sendMessage(this.jid, { text: textContent });
	}

	/**
	 * Reacciona a un mensaje específico
	 */
	async react(emoji: string, messageId: string) {
		return this.socket.sendMessage(this.jid, {
			react: {
				text: emoji,
				key: {
					remoteJid: this.jid,
					id: messageId,
					fromMe: false,
				}
			}
		});
	}

	/**
	 * Envía multimedia directamente por URL
	 */
	async postMedia(url: string, type: 'image' | 'video' | 'audio' | 'document', options?: { caption?: string; fileName?: string }) {
		const payload: any = {};
		payload[type] = { url };
		
		if (options?.caption) {
			payload.caption = options.caption;
		}
		
		if (type === 'document' && options?.fileName) {
			payload.fileName = options.fileName;
		}

		return this.socket.sendMessage(this.jid, payload as any);
	}
}
